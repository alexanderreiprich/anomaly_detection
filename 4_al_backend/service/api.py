from __future__ import annotations

import os
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from core.config import (
    AL_QUERY_BATCH_SIZE,
    AL_STRATEGY,
    FEATURES,
    MODEL_PATH,
    UNCERTAINTY_THRESHOLD,
)
from core.data import (
    get_labeled_measurements,
    get_unlabeled_measurements,
    write_predictions,
)
from core.model import PatientModel
from core.query_strategy import UncertaintySampler

app = FastAPI(title="AL Backend", version="0.1.0")


class RetrainResponse(BaseModel):
    trained: bool
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
    strategy: str
    n: int
    items: list[QueryItem]


class PredictRequest(BaseModel):
    measurements: list[dict[str, Optional[float]]] = Field(
        ..., description="Each entry must contain the FEATURES keys. Missing values may be null."
    )


class PredictItem(BaseModel):
    predicted_label: str
    confidence: float
    proba: dict[str, float]


class PredictResponse(BaseModel):
    classes: list[str]
    items: list[PredictItem]


def _load_model() -> PatientModel:
    if not Path(MODEL_PATH).exists():
        raise HTTPException(
            status_code=409,
            detail=f"No trained model at {MODEL_PATH}. Call POST /retrain first.",
        )
    return PatientModel().load(MODEL_PATH)


@app.get("/health")
def health() -> dict:
    return {
        "status": "ok",
        "model_loaded": Path(MODEL_PATH).exists(),
        "strategy": AL_STRATEGY,
    }


@app.post("/retrain", response_model=RetrainResponse)
def retrain() -> RetrainResponse:
    X, y = get_labeled_measurements()
    if len(y) == 0:
        raise HTTPException(status_code=400, detail="No labeled measurements available.")
    if y.nunique() < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 distinct label classes to train, got {sorted(set(y))}.",
        )
    model = PatientModel().fit(X, y)
    model.save(MODEL_PATH)
    return RetrainResponse(
        trained=True,
        n_samples=len(y),
        classes=list(map(str, model.classes_)),
        model_path=str(MODEL_PATH),
    )


@app.get("/query", response_model=QueryResponse)
def query(n: int = AL_QUERY_BATCH_SIZE, strategy: str = AL_STRATEGY) -> QueryResponse:
    model = _load_model()
    sampler = UncertaintySampler(strategy=strategy)  # type: ignore[arg-type]

    df = get_unlabeled_measurements()
    if df.empty:
        return QueryResponse(strategy=strategy, n=0, items=[])

    X = df[FEATURES].astype(float)
    proba = model.predict_proba(X)
    scores = sampler.score_from_proba(proba)
    conf = proba.max(axis=1)
    pred = np.asarray(model.classes_)[proba.argmax(axis=1)]

    df = df.copy()
    df["predicted_label"] = pred
    df["confidence"] = conf
    df["uncertainty"] = scores

    # Only surface cases the model is not already confident about
    df = df[df["confidence"] < UNCERTAINTY_THRESHOLD]
    df = df.sort_values("uncertainty", ascending=False).head(n).reset_index(drop=True)

    # Persist so the webapp's review queue (predicted_label, confidence) stays in sync
    write_predictions(
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
            features={f: _nan_to_none(row[f]) for f in FEATURES},
        )
        for _, row in df.iterrows()
    ]
    return QueryResponse(strategy=strategy, n=len(items), items=items)


@app.post("/predict", response_model=PredictResponse)
def predict(req: PredictRequest) -> PredictResponse:
    model = _load_model()
    if not req.measurements:
        return PredictResponse(classes=list(map(str, model.classes_)), items=[])
    X = pd.DataFrame(req.measurements)
    for f in FEATURES:
        if f not in X.columns:
            X[f] = np.nan
    X = X[FEATURES].astype(float)

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
    return PredictResponse(classes=classes, items=items)


def _nan_to_none(v):
    if v is None:
        return None
    try:
        if isinstance(v, float) and np.isnan(v):
            return None
    except (TypeError, ValueError):
        pass
    return float(v)
