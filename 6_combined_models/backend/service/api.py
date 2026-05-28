from __future__ import annotations

from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from core.biomarker_data import get_biomarker_detail
from core.config import (
    AL_QUERY_BATCH_SIZE,
    AL_STRATEGY,
    UNCERTAINTY_THRESHOLD,
    WEBAPP_ORIGINS,
    apply_clinical_rule,
)
from core.data import get_uroflow_curve
from core.model import PatientModel
from core.query_strategy import UncertaintySampler
from core.registry import REGISTRY, ModelSpec, get_spec

# Relaxed confidence floor for the plateau finishing pass: above this a label
# is written as 'model', below it as 'model_low_conf'. Matches the notebook.
PLATEAU_CERTAINTY = 0.65

# Severity ordering for clinical-rule overrides. A safety rule may only raise
# the predicted severity, never lower it (e.g. it must not turn the model's
# 'critical' into 'warning'). 'invalid' is a data-quality verdict, not a
# severity, so it is left untouched by rules.
SEVERITY = {"normal": 0, "warning": 1, "critical": 2}


def _rule_escalates(model_label: str, rule_label: str) -> bool:
    return model_label in SEVERITY and SEVERITY.get(rule_label, -1) > SEVERITY[model_label]

app = FastAPI(title="Combined AL Backend", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=WEBAPP_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class RetrainResponse(BaseModel):
    trained: bool
    model_type: str
    n_samples: int
    classes: list[str]
    model_path: str


class QueryItem(BaseModel):
    measurement_id: str
    patient_id: Optional[str] = None
    predicted_label: str
    confidence: float
    uncertainty: float
    features: dict[str, Optional[float]]


class QueryResponse(BaseModel):
    model_type: str
    strategy: str
    n: int
    items: list[QueryItem]


class PredictRequest(BaseModel):
    measurements: list[dict[str, Optional[float]]] = Field(
        ..., description="Each entry must contain the model's feature keys. Missing values may be null."
    )


class PredictItem(BaseModel):
    predicted_label: str
    confidence: float
    proba: dict[str, float]


class PredictResponse(BaseModel):
    model_type: str
    classes: list[str]
    items: list[PredictItem]


class AutoLabelResponse(BaseModel):
    model_type: str
    auto_labeled: int
    threshold: float
    remaining_unlabeled: int


class ResetResponse(BaseModel):
    model_type: str
    reset: int


class CurveResponse(BaseModel):
    measurement_id: str
    time: list[float]
    flow: list[float]


class BiomarkerMarker(BaseModel):
    name: str
    value: Optional[str]
    streak: int


class BiomarkerDetailResponse(BaseModel):
    measurement_id: str
    patient_id: Optional[str] = None
    markers: list[BiomarkerMarker]
    ph: Optional[float] = None
    n_positive: int
    n_no_data: int
    max_pos_streak: int
    n_prior_measurements: int
    age_mid: Optional[float] = None
    height_mid: Optional[float] = None
    weight_mid: Optional[float] = None


def _resolve_spec(model_type: str) -> ModelSpec:
    try:
        return get_spec(model_type)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))


def _load_model(spec: ModelSpec) -> PatientModel:
    if not Path(spec.model_path).exists():
        raise HTTPException(
            status_code=409,
            detail=(
                f"No trained {spec.name} model at {spec.model_path}. "
                f"Call POST /retrain?model_type={spec.name} first."
            ),
        )
    return PatientModel().load(spec.model_path)


@app.get("/health")
def health(model_type: str = "uroflow") -> dict:
    spec = _resolve_spec(model_type)
    return {
        "status": "ok",
        "model_type": spec.name,
        "model_loaded": Path(spec.model_path).exists(),
        "strategy": AL_STRATEGY,
        "models": list(REGISTRY),
    }


@app.post("/retrain", response_model=RetrainResponse)
def retrain(model_type: str = "uroflow") -> RetrainResponse:
    spec = _resolve_spec(model_type)
    X, y = spec.load_labeled()
    if len(y) == 0:
        raise HTTPException(status_code=400, detail="No labeled measurements available.")
    if y.nunique() < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 distinct label classes to train, got {sorted(set(y))}.",
        )
    model = PatientModel(features=spec.features, **spec.model_kwargs).fit(X, y)
    model.save(spec.model_path)
    return RetrainResponse(
        trained=True,
        model_type=spec.name,
        n_samples=len(y),
        classes=list(map(str, model.classes_)),
        model_path=str(spec.model_path),
    )


@app.get("/query", response_model=QueryResponse)
def query(
    model_type: str = "uroflow",
    n: int = AL_QUERY_BATCH_SIZE,
    strategy: str = AL_STRATEGY,
) -> QueryResponse:
    spec = _resolve_spec(model_type)
    model = _load_model(spec)
    sampler = UncertaintySampler(strategy=strategy)  # type: ignore[arg-type]

    df = spec.load_unlabeled()
    if df is None or df.empty:
        return QueryResponse(model_type=spec.name, strategy=strategy, n=0, items=[])

    X = df[spec.features].astype(float)
    proba = model.predict_proba(X)
    scores = sampler.score_from_proba(proba)
    conf = proba.max(axis=1)
    pred = np.asarray(model.classes_)[proba.argmax(axis=1)]

    df = df.copy()
    df["predicted_label"] = pred
    df["confidence"] = conf
    df["uncertainty"] = scores
    df["rule_override"] = False

    # Clinical-rule overrides: deterministic checks for medically clear
    # patterns. A matching case always surfaces for human confirmation
    # (bypassing the confidence filter below), but the prediction is only
    # replaced when the rule *escalates* severity — a safety rule may raise
    # 'normal'→'warning' etc., but must never downgrade the model's 'critical'.
    if spec.clinical_rules:
        for i in df.index:
            label, rconf, _name = apply_clinical_rule(df.loc[i].to_dict())
            if label is None:
                continue
            df.at[i, "rule_override"] = True
            if _rule_escalates(str(df.at[i, "predicted_label"]), label):
                df.at[i, "predicted_label"] = label
                df.at[i, "confidence"] = float(rconf)

    keep = df["rule_override"] | (df["confidence"] < UNCERTAINTY_THRESHOLD)
    df = df[keep]
    # Surface rule-flagged (clinically important) cases first, then most uncertain.
    df = (
        df.sort_values(["rule_override", "uncertainty"], ascending=[False, False])
        .head(n)
        .reset_index(drop=True)
    )

    # Persist so the webapp's review queue (predicted_label, confidence) stays in sync.
    spec.write_predictions(
        [
            {
                "measurement_id": row["measurement_id"],
                "predicted_label": row["predicted_label"],
                "confidence": float(row["confidence"]),
            }
            for _, row in df.iterrows()
        ]
    )

    items = [
        QueryItem(
            measurement_id=str(row["measurement_id"]),
            patient_id=row.get("patient_id"),
            predicted_label=str(row["predicted_label"]),
            confidence=float(row["confidence"]),
            uncertainty=float(row["uncertainty"]),
            features={f: _nan_to_none(row[f]) for f in spec.features},
        )
        for _, row in df.iterrows()
    ]
    return QueryResponse(model_type=spec.name, strategy=strategy, n=len(items), items=items)


@app.post("/auto_label", response_model=AutoLabelResponse)
def auto_label(model_type: str = "uroflow", mode: str = "standard") -> AutoLabelResponse:
    """Auto-label confident model predictions as final labels.

    mode="standard": predictions at or above an adaptive threshold (floored at
    UNCERTAINTY_THRESHOLD, raised to the 70th percentile) get a final label with
    label_source='model'. A single pass deliberately leaves the rest.

    mode="plateau": relaxed finishing pass to break a confidence plateau —
    labels *every* remaining (non-rule) case, tagging the less-confident ones
    (< PLATEAU_CERTAINTY) with label_source='model_low_conf' so they can be
    revisited. Use this to clear the long tail once standard passes stall.

    Clinical-rule cases are always skipped in both modes — they stay in the
    human review queue (see /query).
    """
    if mode not in ("standard", "plateau"):
        raise HTTPException(status_code=422, detail=f"Unknown mode '{mode}'. Use 'standard' or 'plateau'.")

    spec = _resolve_spec(model_type)
    model = _load_model(spec)

    df = spec.load_unlabeled()
    if df is None or df.empty:
        return AutoLabelResponse(
            model_type=spec.name,
            auto_labeled=0,
            threshold=UNCERTAINTY_THRESHOLD,
            remaining_unlabeled=0,
        )

    n_unlabeled = len(df)
    X = df[spec.features].astype(float)
    proba = model.predict_proba(X)
    conf = proba.max(axis=1)
    pred = np.asarray(model.classes_)[proba.argmax(axis=1)]

    df = df.copy()
    df["predicted_label"] = pred
    df["confidence"] = conf

    # Clinical-rule cases are left for human review, not auto-labeled.
    if spec.clinical_rules:
        rule_mask = df.apply(lambda r: apply_clinical_rule(r.to_dict())[0] is not None, axis=1)
        df = df[~rule_mask]

    def _rows(frame) -> list[dict]:
        return [
            {
                "measurement_id": row["measurement_id"],
                "label": row["predicted_label"],
                "confidence": float(row["confidence"]),
            }
            for _, row in frame.iterrows()
        ]

    if mode == "plateau":
        high = df[df["confidence"] >= PLATEAU_CERTAINTY]
        low = df[df["confidence"] < PLATEAU_CERTAINTY]
        n = spec.write_labels(_rows(high))
        n += spec.write_labels(_rows(low), label_source="model_low_conf")
        threshold = PLATEAU_CERTAINTY
    else:
        threshold = max(UNCERTAINTY_THRESHOLD, float(np.quantile(conf, 0.70)))
        n = spec.write_labels(_rows(df[df["confidence"] >= threshold]))

    return AutoLabelResponse(
        model_type=spec.name,
        auto_labeled=n,
        threshold=round(threshold, 4),
        remaining_unlabeled=n_unlabeled - n,
    )


@app.post("/reset", response_model=ResetResponse)
def reset(model_type: str = "uroflow") -> ResetResponse:
    """Clear every label/prediction for the model — start the loop from scratch.

    Destructive: nulls label, label_source, predicted_label, confidence and
    reviewed_at on the model's table. The trained model artifact is left in
    place; the next retrain (after re-seeding) overwrites it.
    """
    spec = _resolve_spec(model_type)
    n = spec.reset_labels()
    return ResetResponse(model_type=spec.name, reset=n)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest, model_type: str = "uroflow") -> PredictResponse:
    spec = _resolve_spec(model_type)
    model = _load_model(spec)
    if not req.measurements:
        return PredictResponse(
            model_type=spec.name, classes=list(map(str, model.classes_)), items=[]
        )
    X = pd.DataFrame(req.measurements)
    for f in spec.features:
        if f not in X.columns:
            X[f] = np.nan
    X = X[spec.features].astype(float)

    proba = model.predict_proba(X)
    classes = list(map(str, model.classes_))
    pred = np.asarray(classes)[proba.argmax(axis=1)]
    conf = proba.max(axis=1)

    items = [
        PredictItem(
            predicted_label=str(p),
            confidence=float(c),
            proba={cls: float(v) for cls, v in zip(classes, row)},
        )
        for p, c, row in zip(pred, conf, proba)
    ]
    return PredictResponse(model_type=spec.name, classes=classes, items=items)


@app.get("/measurements/{measurement_id}/curve", response_model=CurveResponse)
def measurement_curve(measurement_id: str) -> CurveResponse:
    payload = get_uroflow_curve(measurement_id)
    if not payload["time"]:
        raise HTTPException(
            status_code=404,
            detail=f"No uroflow curve data for measurement {measurement_id}.",
        )
    return CurveResponse(**payload)


@app.get(
    "/measurements/{measurement_id}/biomarker",
    response_model=BiomarkerDetailResponse,
)
def measurement_biomarker(measurement_id: str) -> BiomarkerDetailResponse:
    payload = get_biomarker_detail(measurement_id)
    if payload is None:
        raise HTTPException(
            status_code=404,
            detail=f"No biomarker data for measurement {measurement_id}.",
        )
    return BiomarkerDetailResponse(**payload)


def _nan_to_none(v):
    if v is None:
        return None
    try:
        if isinstance(v, float) and np.isnan(v):
            return None
    except (TypeError, ValueError):
        pass
    return float(v)
