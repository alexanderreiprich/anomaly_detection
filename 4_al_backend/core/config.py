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

LABEL_OPTIONS = ["normal", "warning", "critical", "invalid"]

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
