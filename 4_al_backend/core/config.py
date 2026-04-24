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
FEATURES = FLOW_FEATURES + IPSS_FEATURES

LABEL_OPTIONS = ["normal", "warning", "critical"]

SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")

AL_STRATEGY = os.getenv("AL_STRATEGY", "entropy")
AL_QUERY_BATCH_SIZE = int(os.getenv("AL_QUERY_BATCH_SIZE", "10"))
UNCERTAINTY_THRESHOLD = float(os.getenv("UNCERTAINTY_THRESHOLD", "0.75"))
IPSS_WINDOW_DAYS = int(os.getenv("IPSS_WINDOW_DAYS", "30"))

MODEL_PATH = os.getenv("MODEL_PATH", "./models/patient_model.joblib")
