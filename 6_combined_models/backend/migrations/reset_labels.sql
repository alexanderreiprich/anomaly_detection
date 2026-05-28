-- Reset ALL labels/predictions so the active-learning loop starts from zero.
-- Destructive — run in the Supabase SQL editor when you really want a clean slate.
-- The trained model artifacts on disk are not touched; retrain after re-seeding.

-- Uroflow model (labels live on `measurements`)
UPDATE measurements
SET label           = NULL,
    label_source    = NULL,
    predicted_label = NULL,
    confidence      = NULL,
    reviewed_at     = NULL;

-- Biomarker model (labels live on `biomarkers`)
UPDATE biomarkers
SET label           = NULL,
    label_source    = NULL,
    predicted_label = NULL,
    confidence      = NULL,
    reviewed_at     = NULL;
