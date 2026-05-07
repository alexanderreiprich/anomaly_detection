## Active Learning Backend

This module uses the components from 2_uroflow_labeling to build a backend that is connected to a Supabase instance where the database is hosted.
This allows local testing as well as communication between the 3_labeling_webapp to the actual training module.

### Prerequisites

- Python 3.11
- `.env` file structured like .env.example

### How to run

1. Make sure the information in the `.env` is valid and correct
2. Run `pip install -r 4_al_backend/requirements.txt`
3. Run `cd 4_al_backend && uvicorn service.api:app --reload`

You can now access http://localhost:8000/docs#/ and check using the /health endpoint if everything works as intended.

### Endpoints

- `GET  /health` — readiness + whether a trained model exists on disk
- `POST /retrain` — trains an XGBoost classifier on every labeled measurement
- `GET  /query?n=…&strategy=…` — top-N most uncertain unlabeled measurements; persists `predicted_label` + `confidence` back to Supabase
- `POST /predict` — predicts labels for arbitrary feature dicts
- `GET  /measurements/{measurement_id}/curve` — raw uroflow timeseries `{time, flow}` for a single measurement, used by the labeling webapp to render the curve next to the engineered features

### Features

Model inputs (14 columns, all NaN-tolerant):

- **Flow** (6): `urine_volume`, `max_flow`, `avg_flow`, `micturition_time`, `flow_time`, `rise_time`
- **IPSS** (3): `ipss_score`, `ipss_delta_prev`, `ipss_days_since` — joined to the closest IPSS submission within ±`IPSS_WINDOW_DAYS`
- **Curve shape** (5): `flow_skewness`, `flow_std`, `plateau_ratio`, `n_peaks`, `flow_smoothness` — derived per-measurement from `urine_flow`
