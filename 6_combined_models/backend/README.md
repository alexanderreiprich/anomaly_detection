## Combined Active Learning Backend

A single FastAPI service that trains **two independent models** against the same
Supabase instance:

- **uroflow** — XGBoost severity classifier on flow / IPSS / curve-shape features
  (the original `4_al_backend` model, behaviour unchanged).
- **biomarker** — XGBoost multi-class classifier on urinalysis dip-stick features
  (ported from `5_biomarker_model`).

The two models are fully separate — different feature sets, label tables and
saved artifacts — but share the API, the model wrapper and the uncertainty
sampler. Every endpoint takes a `model_type` query parameter
(`uroflow` | `biomarker`, default `uroflow`).

### Prerequisites

- Python 3.11
- `.env` file structured like `.env.example`
- **Biomarker only:** run `migrations/001_add_biomarker_label_columns.sql` once
  in the Supabase SQL editor. It adds `label`, `label_source`, `predicted_label`,
  `confidence`, `reviewed_at` to the `biomarkers` table so biomarker labels stay
  separate from the uroflow labels on `measurements`.

### How to run

1. Make sure the information in the `.env` is valid and correct
2. Run `pip install -r requirements.txt`
3. Run `uvicorn service.api:app --reload`

Open http://localhost:8000/docs and call `/health?model_type=uroflow` and
`/health?model_type=biomarker` to verify both models are wired up.

### CORS

The backend exposes CORS for the labeling webapp via `WEBAPP_ORIGINS`
(comma-separated origins). Default is `http://localhost:5173` (Vite dev server).
Set this to the deployed webapp URL in production.

### Endpoints

All of these accept `?model_type=uroflow|biomarker`:

- `GET  /health` — readiness + whether a trained model exists on disk
- `POST /retrain` — trains an XGBoost classifier on every labeled row for the model
- `GET  /query?n=…&strategy=…` — top-N most uncertain unlabeled rows; persists
  `predicted_label` + `confidence`. For the biomarker model, clinical safety
  rules override predictions for medically unambiguous patterns and always
  surface for human confirmation.
- `POST /auto_label?mode=standard|plateau` — auto-labels confident predictions
  as final labels with `label_source='model'`. `standard` (default) uses an
  adaptive threshold (floored at `UNCERTAINTY_THRESHOLD`, raised to the 70th
  percentile). `plateau` is a relaxed finishing pass that labels *every*
  remaining non-rule case, tagging the less-confident ones (< `PLATEAU_CERTAINTY`
  = 0.65) as `label_source='model_low_conf'` — use it to clear the long tail
  when standard passes stall in the dead zone between the review and auto-label
  thresholds. Clinical-rule cases are always skipped (they stay in review).
- `POST /predict` — predicts labels for arbitrary feature dicts

Detail endpoints (used by the webapp to render the per-measurement view):

- `GET /measurements/{id}/curve` — raw uroflow timeseries `{time, flow}` (uroflow)
- `GET /measurements/{id}/biomarker` — marker chips + streaks + pH + demographics (biomarker)

### Model artifacts

Separate joblib files, configured via `.env`:

- `UROFLOW_MODEL_PATH` (default `./models/uroflow_model.joblib`)
- `BIOMARKER_MODEL_PATH` (default `./models/biomarker_model.joblib`)

### Features

**Uroflow** (14 columns, all NaN-tolerant):

- **Flow** (6): `urine_volume`, `max_flow`, `avg_flow`, `micturition_time`, `flow_time`, `rise_time`
- **IPSS** (3): `ipss_score`, `ipss_delta_prev`, `ipss_days_since` — joined to the closest IPSS submission within ±`IPSS_WINDOW_DAYS`
- **Curve shape** (5): `flow_skewness`, `flow_std`, `plateau_ratio`, `n_peaks`, `flow_smoothness` — derived per-measurement from `urine_flow`

**Biomarker** (18 columns, all NaN-tolerant):

- **Markers** (5): `leukocytes`, `nitrite`, `protein`, `blood`, `glucose` (POSITIVE=1, NEGATIVE=0, NO_DATA=NaN)
- **Streaks** (5): `<marker>_streak` — consecutive POSITIVE count per patient in chronological order
- **Numeric** (1): `ph`
- **Derived** (4): `n_positive`, `n_no_data`, `max_pos_streak`, `n_prior_measurements`
- **Demographics** (3): `age_mid`, `height_mid`, `weight_mid` — midpoints of the range strings

### Tests

`pytest` — `tests/test_core.py` covers the uroflow path, `tests/test_biomarker.py`
covers biomarker feature engineering, clinical rules and the model registry.
