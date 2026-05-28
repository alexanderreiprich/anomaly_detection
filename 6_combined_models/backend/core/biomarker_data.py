from __future__ import annotations

import re
from datetime import datetime
from typing import Optional

import numpy as np
import pandas as pd

from .config import (
    BIOMARKER_CATS,
    BIOMARKER_DEMO_FEATURES,
    BIOMARKER_FEATURES,
    STREAK_FEATURES,
)
from .data import _fetch_all, get_supabase_client

POS, NEG, NA = "POSITIVE", "NEGATIVE", "NO_DATA"

_BIOMARKER_COLS = (
    "measurement_id,patient_id,leukocytes,nitrite,protein,blood,glucose,"
    "ascorbic_acid,bilirubin,ketone,urobilinogen,ph,"
    "label,label_source,predicted_label,confidence,reviewed_at"
)


def encode_biomarker(v) -> float:
    """POSITIVE -> 1.0, NEGATIVE -> 0.0, NO_DATA/anything else -> NaN."""
    if v == POS:
        return 1.0
    if v == NEG:
        return 0.0
    return np.nan


def range_midpoint(s) -> float:
    """'20-29' -> 24.5; returns NaN on unparseable input."""
    if s is None or (isinstance(s, float) and np.isnan(s)):
        return np.nan
    m = re.match(r"^\s*(-?\d+)\s*-\s*(-?\d+)\s*$", str(s))
    if not m:
        return np.nan
    lo, hi = int(m.group(1)), int(m.group(2))
    return (lo + hi) / 2.0


def _streak_for_series(values_is_pos) -> np.ndarray:
    """Consecutive-POSITIVE counts for a chronological sequence (1=positive, 0=other)."""
    out = np.zeros(len(values_is_pos), dtype=int)
    cur = 0
    for i, v in enumerate(values_is_pos):
        cur = cur + 1 if v else 0
        out[i] = cur
    return out


def _add_sequential_features(df: pd.DataFrame) -> pd.DataFrame:
    """Add per-patient streak features in chronological order of created_date.

    Adds `<biomarker>_streak`, `max_pos_streak` and `n_prior_measurements`,
    returning a frame with the same index as the input.
    """
    orig_idx = df.index
    df = df.sort_values(
        ["patient_id", "created_date"], kind="stable", na_position="last"
    ).copy()

    df["n_prior_measurements"] = df.groupby("patient_id").cumcount()

    for b in BIOMARKER_CATS:
        is_pos = (df[b] == POS).astype(int).to_numpy()
        streaks = np.zeros(len(df), dtype=int)
        # groupby(..., sort=False).indices keeps the sorted order within each group
        for _pid, idxs in df.groupby("patient_id", sort=False).indices.items():
            streaks[idxs] = _streak_for_series(is_pos[idxs])
        df[f"{b}_streak"] = streaks

    df["max_pos_streak"] = df[STREAK_FEATURES].max(axis=1)
    return df.reindex(orig_idx)


def build_feature_frame(client=None) -> pd.DataFrame:
    """Return a DataFrame with the biomarker model's feature columns.

    Streaks need every measurement of a patient in chronological order, so the
    full table is always processed; callers filter labeled/unlabeled afterwards.
    Raw biomarker strings are preserved under `<marker>_raw` for the detail view.
    """
    client = client or get_supabase_client()
    bio = _fetch_all(client, "biomarkers", _BIOMARKER_COLS)
    if bio.empty:
        return pd.DataFrame()

    meas = _fetch_all(client, "measurements", "measurement_id,created_date")
    pat = _fetch_all(client, "patients", "patient_id,age_range,height_range,weight_range")

    df = bio.merge(meas, on="measurement_id", how="left")  # adds created_date

    # Keep the raw categorical strings, then encode under the model feature names.
    for c in BIOMARKER_CATS:
        df[c + "_raw"] = df[c]
        df[c + "_enc"] = df[c].map(encode_biomarker)

    # Per-patient sequential features need the raw strings + created_date.
    df = _add_sequential_features(df)

    # Simple counters over the five model biomarkers (from raw strings).
    raw = df[BIOMARKER_CATS]
    df["n_positive"] = (raw == POS).sum(axis=1)
    df["n_no_data"] = (raw == NA).sum(axis=1)

    # Demographic midpoints.
    if not pat.empty:
        pat = pat.copy()
        pat["age_mid"] = pat["age_range"].map(range_midpoint)
        pat["height_mid"] = pat["height_range"].map(range_midpoint)
        pat["weight_mid"] = pat["weight_range"].map(range_midpoint)
        df = df.merge(
            pat[["patient_id"] + BIOMARKER_DEMO_FEATURES], on="patient_id", how="left"
        )
    else:
        for f in BIOMARKER_DEMO_FEATURES:
            df[f] = np.nan

    # Expose encoded biomarker values under the plain feature names for the model.
    for c in BIOMARKER_CATS:
        df[c] = df[c + "_enc"]
    return df


def get_labeled_biomarkers(client=None) -> tuple[pd.DataFrame, pd.Series]:
    """Return (X, y) for training. X is a DataFrame of BIOMARKER_FEATURES."""
    df = build_feature_frame(client)
    if df.empty:
        return pd.DataFrame(columns=BIOMARKER_FEATURES), pd.Series([], dtype=str)
    labeled = df[df["label"].notna()].reset_index(drop=True)
    X = labeled[BIOMARKER_FEATURES].astype(float)
    y = labeled["label"].astype(str)
    return X, y


def get_unlabeled_biomarkers(client=None) -> pd.DataFrame:
    """Unlabeled biomarker measurements with all model features attached."""
    df = build_feature_frame(client)
    if df.empty:
        return df
    return df[df["label"].isna()].reset_index(drop=True)


def write_biomarker_predictions(predictions: list[dict], client=None) -> int:
    """Write predicted_label + confidence back to the biomarkers table."""
    if not predictions:
        return 0
    client = client or get_supabase_client()
    now = datetime.utcnow().isoformat()
    n = 0
    for p in predictions:
        client.table("biomarkers").update(
            {
                "predicted_label": p["predicted_label"],
                "confidence": float(p["confidence"]),
                "reviewed_at": now,
            }
        ).eq("measurement_id", p["measurement_id"]).execute()
        n += 1
    return n


def write_biomarker_labels(rows: list[dict], client=None, label_source: str = "model") -> int:
    """Write a final label back to the biomarkers table (used by auto-labeling).

    rows: [{"measurement_id": ..., "label": ..., "confidence": ...}, ...]
    """
    if not rows:
        return 0
    client = client or get_supabase_client()
    now = datetime.utcnow().isoformat()
    n = 0
    for r in rows:
        client.table("biomarkers").update(
            {
                "label": r["label"],
                "label_source": label_source,
                "confidence": float(r["confidence"]),
                "reviewed_at": now,
            }
        ).eq("measurement_id", r["measurement_id"]).execute()
        n += 1
    return n


def reset_biomarker_labels(client=None) -> int:
    """Clear all labels/predictions on the biomarkers table. Returns rows reset."""
    client = client or get_supabase_client()
    res = (
        client.table("biomarkers")
        .update(
            {
                "label": None,
                "label_source": None,
                "predicted_label": None,
                "confidence": None,
                "reviewed_at": None,
            }
        )
        .neq("measurement_id", "")
        .execute()
    )
    return len(res.data or [])


def _clean(v):
    if v is None:
        return None
    if isinstance(v, float) and np.isnan(v):
        return None
    if isinstance(v, (np.floating,)):
        return float(v)
    if isinstance(v, (np.integer,)):
        return int(v)
    return v


def get_biomarker_detail(measurement_id: str, client=None) -> Optional[dict]:
    """Panel data for one measurement: marker chips + streaks + ph + demographics.

    Used by the webapp to render the biomarker panel during seed/review, the
    same role the uroflow curve endpoint plays for the flow model.
    """
    df = build_feature_frame(client)
    if df.empty:
        return None
    rows = df[df["measurement_id"] == measurement_id]
    if rows.empty:
        return None
    row = rows.iloc[0]

    markers = [
        {
            "name": c,
            "value": (None if pd.isna(row[c + "_raw"]) else str(row[c + "_raw"])),
            "streak": int(row[f"{c}_streak"]),
        }
        for c in BIOMARKER_CATS
    ]
    return {
        "measurement_id": str(row["measurement_id"]),
        "patient_id": _clean(row.get("patient_id")),
        "markers": markers,
        "ph": _clean(row.get("ph")),
        "n_positive": int(row["n_positive"]),
        "n_no_data": int(row["n_no_data"]),
        "max_pos_streak": int(row["max_pos_streak"]),
        "n_prior_measurements": int(row["n_prior_measurements"]),
        "age_mid": _clean(row.get("age_mid")),
        "height_mid": _clean(row.get("height_mid")),
        "weight_mid": _clean(row.get("weight_mid")),
    }
