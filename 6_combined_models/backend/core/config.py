import os
from dotenv import load_dotenv

load_dotenv()

FLOW_FEATURES = [
    "urine_volume",
    "max_flow",
    "avg_flow",
    "micturition_time",
    "flow_time",
    "rise_time",
]
IPSS_FEATURES = ["ipss_score", "ipss_delta_prev", "ipss_days_since"]
TIMESERIES_FEATURES = [
    "flow_skewness",
    "flow_std",
    "plateau_ratio",
    "n_peaks",
    "flow_smoothness",
]
FEATURES = FLOW_FEATURES + IPSS_FEATURES + TIMESERIES_FEATURES
# Alias for the registry — uroflow keeps the original feature set unchanged.
UROFLOW_FEATURES = FEATURES

LABEL_OPTIONS = ["normal", "warning", "critical", "invalid"]
UROFLOW_LABELS = LABEL_OPTIONS
BIOMARKER_LABELS = ["normal", "warning", "critical", "invalid"]

# ── Biomarker model features ────────────────────────────────────────────────
# The five dip-stick markers fed to the model (POSITIVE=1, NEGATIVE=0,
# NO_DATA=NaN). The other four markers are NO_DATA in most measurements and
# carry no signal, so they are excluded — same choice as the source notebook.
BIOMARKER_CATS = ["leukocytes", "nitrite", "protein", "blood", "glucose"]
# Per-biomarker consecutive-POSITIVE streak, computed per patient in
# chronological order of created_date.
STREAK_FEATURES = [f"{b}_streak" for b in BIOMARKER_CATS]
# Urine pH normal band. Outside [PH_LOW, PH_HIGH] is clinically abnormal. Both
# the engineered `ph_abn` model feature and the extreme_ph clinical rule key off
# these thresholds, so they stay aligned by construction.
PH_LOW = 4.0
PH_HIGH = 8.5

# The model sees pH only as a monotonic abnormality distance (`ph_abn`), never
# the raw value: raw pH risk is U-shaped (both extremes bad), which XGBoost can
# only approximate with many noisy splits on a high-cardinality feature.
BIOMARKER_NUMERIC_FEATURES = ["ph_abn"]
BIOMARKER_DERIVED_FEATURES = [
    "n_positive",
    "n_no_data",
    "max_pos_streak",
    "n_prior_measurements",
]
# Demographic midpoints parsed from range strings ("20-29" -> 24.5).
BIOMARKER_DEMO_FEATURES = ["age_mid", "height_mid", "weight_mid"]
BIOMARKER_FEATURES = (
    BIOMARKER_CATS
    + STREAK_FEATURES
    + BIOMARKER_NUMERIC_FEATURES
    + BIOMARKER_DERIVED_FEATURES
    + BIOMARKER_DEMO_FEATURES
)

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

# Comma-separated list of allowed CORS origins for the labeling webapp.
# Use "*" to allow any origin (dev only).
WEBAPP_ORIGINS = [
    o.strip()
    for o in os.getenv("WEBAPP_ORIGINS", "http://localhost:5173").split(",")
    if o.strip()
]

AL_STRATEGY = os.getenv("AL_STRATEGY", "entropy")
AL_QUERY_BATCH_SIZE = int(os.getenv("AL_QUERY_BATCH_SIZE", "10"))
UNCERTAINTY_THRESHOLD = float(os.getenv("UNCERTAINTY_THRESHOLD", "0.75"))
IPSS_WINDOW_DAYS = int(os.getenv("IPSS_WINDOW_DAYS", "30"))

# Sampling rate of the uroflow timeseries (matches urine_flow_pseudo.csv)
UROFLOW_DT = 0.25

MODEL_PATH = os.getenv("MODEL_PATH", "./models/patient_model.joblib")

# Separate artifacts per model — never mix feature sets across the two.
UROFLOW_MODEL_PATH = os.getenv("UROFLOW_MODEL_PATH", "./models/uroflow_model.joblib")
BIOMARKER_MODEL_PATH = os.getenv(
    "BIOMARKER_MODEL_PATH", "./models/biomarker_model.joblib"
)


def _notnan(v) -> bool:
    return v is not None and not (isinstance(v, float) and v != v)


# Clinical safety rules for the biomarker model — deterministic overrides for
# medically unambiguous patterns. Applied at /query time: a matching row gets
# its predicted_label/confidence replaced and is always surfaced for human
# confirmation (it bypasses the uncertainty-threshold filter). The model is
# never trained on these — they only shape predictions, keeping the learning
# signal intact. Ordered: the first matching rule wins.
CLINICAL_RULES = [
    {
        "name": "many_positives",
        "check": lambda r: _notnan(r.get("n_positive")) and r["n_positive"] >= 4,
        "label": "critical",
        "confidence": 1.0,
    },
    {
        "name": "positive_streak",
        "check": lambda r: _notnan(r.get("max_pos_streak")) and r["max_pos_streak"] >= 2,
        "label": "warning",
        "confidence": 0.9,
    },
    {
        "name": "extreme_ph",
        "check": lambda r: _notnan(r.get("ph")) and (r["ph"] < PH_LOW or r["ph"] > PH_HIGH),
        "label": "warning",
        "confidence": 0.9,
    },
]


def apply_clinical_rule(row: dict):
    """Return (label, confidence, rule_name) for the first matching rule, else (None, None, None)."""
    for rule in CLINICAL_RULES:
        try:
            if rule["check"](row):
                return rule["label"], rule["confidence"], rule["name"]
        except Exception:
            continue
    return None, None, None
