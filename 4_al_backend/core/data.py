from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

import numpy as np
import pandas as pd

from .config import (
    FEATURES,
    IPSS_WINDOW_DAYS,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
)

_PAGE_SIZE = 1000


def get_supabase_client():
    from supabase import create_client

    if not SUPABASE_URL or not SUPABASE_SERVICE_ROLE_KEY:
        raise RuntimeError(
            "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in the environment."
        )
    return create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)


def _fetch_all(client, table: str, columns: str) -> pd.DataFrame:
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        res = (
            client.table(table)
            .select(columns)
            .range(offset, offset + _PAGE_SIZE - 1)
            .execute()
        )
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return pd.DataFrame(rows)


def fetch_measurements(client) -> pd.DataFrame:
    cols = (
        "measurement_id,patient_id,created_date,urine_volume,max_flow,avg_flow,"
        "micturition_time,flow_time,rise_time,label,label_source,predicted_label,"
        "confidence,reviewed_at"
    )
    return _fetch_all(client, "measurements", cols)


def fetch_ipss_submissions(client) -> pd.DataFrame:
    return _fetch_all(client, "ipss_submissions", "patient_id,submitted_at,score")


def enrich_ipss_features(
    measurements: pd.DataFrame,
    ipss_submissions: pd.DataFrame,
    window_days: int = IPSS_WINDOW_DAYS,
) -> pd.DataFrame:
    """Attach ipss_score, ipss_delta_prev, ipss_days_since to each measurement.

    For each measurement, finds the closest IPSS submission of the same patient
    within ±window_days. Missing matches stay NaN — XGBoost handles NaN natively.
    """
    df = measurements.copy()
    df["ipss_score"] = np.nan
    df["ipss_delta_prev"] = np.nan
    df["ipss_days_since"] = np.nan

    if ipss_submissions.empty or df.empty:
        return df

    subs = ipss_submissions.copy()
    subs["submitted_at"] = pd.to_datetime(subs["submitted_at"], utc=True, errors="coerce")
    subs = subs.dropna(subset=["submitted_at"])
    subs = subs.sort_values(["patient_id", "submitted_at"]).reset_index(drop=True)

    df["created_date"] = pd.to_datetime(df["created_date"], utc=True, errors="coerce")

    subs_by_pid = {pid: g.reset_index(drop=True) for pid, g in subs.groupby("patient_id")}

    for idx, row in df.iterrows():
        pid = row["patient_id"]
        m_date = row["created_date"]
        if pid is None or pd.isna(m_date) or pid not in subs_by_pid:
            continue
        ps = subs_by_pid[pid]

        days_diff = (ps["submitted_at"] - m_date).dt.total_seconds() / 86400.0
        abs_days = days_diff.abs()
        within = abs_days <= window_days
        if not within.any():
            continue

        i_closest = abs_days[within].idxmin()
        closest = ps.loc[i_closest]
        score = float(closest["score"])
        days_since = float(days_diff.loc[i_closest])

        prior = ps[ps["submitted_at"] < closest["submitted_at"]]
        delta = float(score - prior.iloc[-1]["score"]) if len(prior) else np.nan

        df.at[idx, "ipss_score"] = score
        df.at[idx, "ipss_delta_prev"] = delta
        df.at[idx, "ipss_days_since"] = days_since

    return df


def get_unlabeled_measurements(client=None) -> pd.DataFrame:
    """Unlabeled measurements with IPSS features attached."""
    client = client or get_supabase_client()
    meas = fetch_measurements(client)
    ipss = fetch_ipss_submissions(client)
    enriched = enrich_ipss_features(meas, ipss)
    return enriched[enriched["label"].isna()].reset_index(drop=True)


def get_labeled_measurements(client=None) -> tuple[pd.DataFrame, pd.Series]:
    """Return (X, y) for training. X is a DataFrame of FEATURES, y the labels."""
    client = client or get_supabase_client()
    meas = fetch_measurements(client)
    ipss = fetch_ipss_submissions(client)
    enriched = enrich_ipss_features(meas, ipss)
    labeled = enriched[enriched["label"].notna()].reset_index(drop=True)
    X = labeled[FEATURES].astype(float)
    y = labeled["label"].astype(str)
    return X, y


def write_predictions(
    predictions: list[dict],
    client=None,
) -> int:
    """Write predicted_label + confidence back to measurements.

    predictions: [{"measurement_id": ..., "predicted_label": ..., "confidence": ...}, ...]
    Returns number of rows updated.
    """
    if not predictions:
        return 0
    client = client or get_supabase_client()
    now = datetime.utcnow().isoformat()
    n = 0
    for p in predictions:
        client.table("measurements").update(
            {
                "predicted_label": p["predicted_label"],
                "confidence": float(p["confidence"]),
                "reviewed_at": now,
            }
        ).eq("measurement_id", p["measurement_id"]).execute()
        n += 1
    return n


def load_measurements_from_sqlite(db_path: str) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Offline helper for notebook experiments — loads the mock SQLite DB
    created by 2_uroflow_labeling/active_learning/uro_active_learning.ipynb.

    Returns (measurements, ipss_submissions) in the same shape as the
    Supabase fetch functions, so enrich_ipss_features works unchanged.
    """
    import sqlite3

    conn = sqlite3.connect(db_path)
    meas = pd.read_sql(
        "SELECT id AS measurement_id, patient_id, created_date, urine_volume, "
        "max_flow, avg_flow, micturition_time, flow_time, rise_time, "
        "label, label_source, confidence, reviewed_at FROM measurements",
        conn,
    )
    meas["predicted_label"] = None
    ipss = pd.read_sql(
        "SELECT patient_id, submitted_at, score FROM ipss_submissions", conn
    )
    conn.close()
    return meas, ipss
