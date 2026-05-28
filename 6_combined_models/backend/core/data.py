from __future__ import annotations

from datetime import datetime
from typing import Any, Optional

import numpy as np
import pandas as pd
from scipy.signal import find_peaks

from .config import (
    FEATURES,
    IPSS_WINDOW_DAYS,
    SUPABASE_SERVICE_ROLE_KEY,
    SUPABASE_URL,
    TIMESERIES_FEATURES,
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


def fetch_urine_flow(
    client, measurement_id: Optional[str] = None
) -> pd.DataFrame:
    """Fetch urine_flow rows. Optionally filter to a single measurement.

    Returns columns: measurement_id, time, uro_flow.
    """
    rows: list[dict[str, Any]] = []
    offset = 0
    while True:
        q = client.table("urine_flow").select(
            "measurement_id,time,uro_flow"
        )
        if measurement_id is not None:
            q = q.eq("measurement_id", measurement_id)
        res = q.range(offset, offset + _PAGE_SIZE - 1).execute()
        batch = res.data or []
        rows.extend(batch)
        if len(batch) < _PAGE_SIZE:
            break
        offset += _PAGE_SIZE
    return pd.DataFrame(rows)


def extract_curve_features(t, q) -> dict[str, float]:
    """Compute the 5 shape descriptors from a single uroflow curve.

    Operates on the active flow portion only (q > 0) so the post-flow zero
    plateau doesn't dominate skewness/std/peak detection. Returns NaN values
    when fewer than 3 active points are available.
    """
    t = np.asarray(t, dtype=float)
    q = np.asarray(q, dtype=float)
    active = q > 0
    if active.sum() < 3:
        return dict(
            flow_skewness=np.nan,
            flow_std=np.nan,
            plateau_ratio=np.nan,
            n_peaks=np.nan,
            flow_smoothness=np.nan,
        )
    qa = q[active]
    qmax = qa.max()

    flow_std = float(np.std(qa))

    mu = qa.mean()
    sd = qa.std()
    flow_skewness = float(np.mean(((qa - mu) / sd) ** 3)) if sd > 1e-9 else 0.0

    plateau_ratio = float(np.mean(qa >= 0.8 * qmax))

    # distance=4 → ≥1 s separation at dt=0.25 s
    peaks, _ = find_peaks(qa, height=0.3 * qmax, distance=4)
    n_peaks = float(max(1, len(peaks)))

    flow_smoothness = float(np.sum(np.abs(np.diff(qa))) / max(qmax, 1e-9))

    return dict(
        flow_skewness=flow_skewness,
        flow_std=flow_std,
        plateau_ratio=plateau_ratio,
        n_peaks=n_peaks,
        flow_smoothness=flow_smoothness,
    )


def enrich_timeseries_features(
    measurements: pd.DataFrame,
    timeseries: pd.DataFrame,
) -> pd.DataFrame:
    """Attach the 5 curve-shape features to each measurement.

    Measurements without a matching timeseries entry keep NaN feature values —
    XGBoost handles NaN natively, same as for IPSS features.
    """
    df = measurements.copy()
    for f in TIMESERIES_FEATURES:
        df[f] = np.nan
    if timeseries.empty or df.empty:
        return df

    ts = timeseries.sort_values(["measurement_id", "time"])
    feats_by_mid: dict[Any, dict[str, float]] = {}
    for mid, grp in ts.groupby("measurement_id"):
        feats_by_mid[mid] = extract_curve_features(
            grp["time"].values, grp["uro_flow"].values
        )

    for idx, row in df.iterrows():
        mid = row.get("measurement_id")
        if mid in feats_by_mid:
            for f, v in feats_by_mid[mid].items():
                df.at[idx, f] = v
    return df


def get_uroflow_curve(measurement_id: str, client=None) -> dict:
    """Return the raw uroflow curve for one measurement.

    Used by the labeling webapp to display the curve during seed/review labeling
    — easier to interpret clinically than the engineered shape features alone.
    """
    client = client or get_supabase_client()
    df = fetch_urine_flow(client, measurement_id=measurement_id)
    if df.empty:
        return {"measurement_id": measurement_id, "time": [], "flow": []}
    df = df.sort_values("time")
    return {
        "measurement_id": measurement_id,
        "time": df["time"].astype(float).tolist(),
        "flow": df["uro_flow"].astype(float).tolist(),
    }


def get_unlabeled_measurements(client=None) -> pd.DataFrame:
    """Unlabeled measurements with IPSS + curve-shape features attached."""
    client = client or get_supabase_client()
    meas = fetch_measurements(client)
    ipss = fetch_ipss_submissions(client)
    ts = fetch_urine_flow(client)
    enriched = enrich_ipss_features(meas, ipss)
    enriched = enrich_timeseries_features(enriched, ts)
    return enriched[enriched["label"].isna()].reset_index(drop=True)


def get_labeled_measurements(client=None) -> tuple[pd.DataFrame, pd.Series]:
    """Return (X, y) for training. X is a DataFrame of FEATURES, y the labels."""
    client = client or get_supabase_client()
    meas = fetch_measurements(client)
    ipss = fetch_ipss_submissions(client)
    ts = fetch_urine_flow(client)
    enriched = enrich_ipss_features(meas, ipss)
    enriched = enrich_timeseries_features(enriched, ts)
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


def write_labels(
    rows: list[dict],
    client=None,
    label_source: str = "model",
) -> int:
    """Write a final label back to measurements (used by auto-labeling).

    rows: [{"measurement_id": ..., "label": ..., "confidence": ...}, ...]
    Returns number of rows updated.
    """
    if not rows:
        return 0
    client = client or get_supabase_client()
    now = datetime.utcnow().isoformat()
    n = 0
    for r in rows:
        client.table("measurements").update(
            {
                "label": r["label"],
                "label_source": label_source,
                "confidence": float(r["confidence"]),
                "reviewed_at": now,
            }
        ).eq("measurement_id", r["measurement_id"]).execute()
        n += 1
    return n


def reset_labels(client=None) -> int:
    """Clear all labels/predictions on measurements — start the loop over.

    Nulls label, label_source, predicted_label, confidence and reviewed_at on
    every row. Returns the number of rows reset.
    """
    client = client or get_supabase_client()
    res = (
        client.table("measurements")
        .update(
            {
                "label": None,
                "label_source": None,
                "predicted_label": None,
                "confidence": None,
                "reviewed_at": None,
            }
        )
        .neq("measurement_id", "")  # matches every row (measurement_id is non-empty)
        .execute()
    )
    return len(res.data or [])


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


def load_urine_flow_from_sqlite(db_path: str) -> pd.DataFrame:
    """Offline helper — loads urine_flow rows from the mock SQLite DB.

    Returns columns: measurement_id, time, uro_flow. Same shape as
    fetch_urine_flow so enrich_timeseries_features works unchanged.
    """
    import sqlite3

    conn = sqlite3.connect(db_path)
    ts = pd.read_sql(
        "SELECT measurement_id, time, uro_flow FROM urine_flow "
        "ORDER BY measurement_id, time",
        conn,
    )
    conn.close()
    return ts
