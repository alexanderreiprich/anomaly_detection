# Combined Models

Combines the labeling webapp (`3_labeling_webapp`) and the active-learning
backend (`4_al_backend`) into one app that can train **two independent models**
from the same UI:

- **Uroflow** — severity classification of uroflow curves (unchanged behaviour).
- **Biomarker** — anomaly detection on urinalysis biomarkers (ported from
  `5_biomarker_model`).

The two models run completely separately — own feature sets, own saved
artifacts, and own label storage (uroflow on `measurements`, biomarker on
`biomarkers`) — but are reached through one backend service (`?model_type=…`)
and one webapp (separate `/uroflow/…` and `/biomarker/…` routes).

```
6_combined_models/
  backend/    FastAPI service serving both models   (based on 4_al_backend)
  frontend/   React + Vite labeling webapp          (based on 3_labeling_webapp)
```

## Setup

### 1. Supabase migration (biomarker model only)

Run `backend/migrations/001_add_biomarker_label_columns.sql` once in the
Supabase SQL editor. It adds the label columns to the `biomarkers` table so
biomarker labels don't collide with the uroflow labels on `measurements`.

### 2. Backend

```
cd backend
cp .env.example .env          # fill in SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY
pip install -r requirements.txt
uvicorn service.api:app --reload
```

Verify both models: http://localhost:8000/health?model_type=uroflow and
`?model_type=biomarker`.

### 3. Frontend

```
cd frontend
cp .env.example .env          # fill in Supabase + Cognito + VITE_AL_BACKEND_URL
npm install
npm run dev
```

Open the app and switch models / phases from the header nav:

- `/uroflow/seed`, `/uroflow/review`, `/uroflow/predict`
- `/biomarker/seed`, `/biomarker/review`, `/biomarker/predict`

The **predict** ("Test") page is a manual test bench: enter measurement values
and the trained model returns a predicted label with per-class probabilities.

## Workflow (per model)

1. **Seed** — hand-label a handful of measurements to bootstrap the model.
2. **Retrain** — train the model on all labeled rows (header button). For the
   **biomarker** model, retrain first auto-marks every still-unlabeled
   measurement whose five model dip-stick markers are *all* `NO_DATA` as
   `invalid` (`label_source='rule_no_data'`): with no readings there is nothing
   for the model to judge, so these are resolved deterministically instead of
   being queued for review, and then train as `invalid` examples. Only
   unlabeled rows are touched, so it never overrides a human/model label.
3. **Refresh Queue** — the backend predicts the most uncertain unlabeled rows
   (for biomarker, clinical safety rules pre-fill clear cases) and writes them
   back as `predicted_label` for review.
4. **Auto-Label** (optional, header button) — confident predictions are written
   as final labels (`label_source='model'`) so the labeled % climbs without
   reviewing every case. Uncertain and clinical-rule cases stay for review.
5. **Review** — confirm or correct the queued predictions; retrain and repeat.
6. **Plateau-Lauf** (optional, bottom utility bar) — once the loop stalls and a
   handful of cases get stuck in the dead zone (too confident for review, not
   confident enough for auto-label), this relaxed pass labels every remaining
   non-rule case (low-confidence ones tagged `model_low_conf`) so you can finish.

Only human labels (seed + review) and auto-/plateau-labels count toward
"labeled" — a plain Retrain or Refresh Queue does not change the count on its own.

See `backend/README.md` for the API and feature details.
