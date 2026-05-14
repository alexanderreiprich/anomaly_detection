## Biomarker Active Learning

Concept notebook for an active-learning workflow that labels urinalysis biomarker measurements as `normal`, `warning`, `critical` or `invalid`.

The setup mirrors `2_uroflow_labeling/active_learning/` but uses the urinalysis biomarker data instead of uroflow curves. Source data:

- `1_pseudonymization/data/out/biomarkers_pseudo.csv` — one row per urinalysis measurement (nine dip-stick biomarkers, pH, avg_flow)
- `1_pseudonymization/data/out/patients_pseudo.csv` — demographic ranges per patient
- `1_pseudonymization/data/out/measurements_pseudo.csv` — provides `created_date` per measurement (used to order each patient's measurements chronologically for the per-biomarker streak features)

Only five biomarkers are fed to the model — `leukocytes`, `nitrite`, `protein`, `blood`, `glucose`. The four remaining markers (urobilinogen, ketone, bilirubin, ascorbic_acid) are kept in the database but excluded from the feature set because they are `NO_DATA` in the vast majority of measurements.

For each of the modelled biomarkers, the notebook computes a per-patient **streak** — the number of consecutive `POSITIVE` results ending at the current measurement. This lets the model distinguish a first-time positive (streak = 1) from a repeating finding (streak ≥ 2). A clinical safety rule additionally escalates any case with `max_pos_streak ≥ 2` to `warning`.

The seed labels, model predictions and confidences are persisted in a small SQLite database under `data/db/biomarkers.db`, so an interrupted session can be resumed.

### Prerequisites

- Python 3.11
- Dependencies from the repository-level `requirements.txt`
- Both source CSVs must exist (see paths above). If they live elsewhere, adjust `SRC_BIOMARKERS` / `SRC_PATIENTS` in the "Load source data" cell.

### How to run

1. Activate the project venv: `source ../venv/bin/activate`
2. Open `biomarker_active_learning.ipynb` in Jupyter.
3. Run the cells top to bottom. The "Seed Labeling" cell opens an interactive widget — label ~50 measurements before training the first time.
4. After training, the "Auto-Labeling" cell labels all measurements above the confidence threshold; the "Human-in-the-Loop" cell asks for input on the most uncertain remaining cases. Iterate until satisfied.

Labeled data is exported to `data/out/labeled_biomarkers_biomarkers.db.csv`.
