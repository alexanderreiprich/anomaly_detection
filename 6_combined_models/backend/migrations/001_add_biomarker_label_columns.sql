-- Biomarker active-learning labels.
--
-- The uroflow model stores its labels on `measurements`. The biomarker model
-- runs separately and must not collide with those, so its labels live on the
-- `biomarkers` table (one row per measurement). Run this once in the Supabase
-- SQL editor before training the biomarker model.

ALTER TABLE biomarkers
  ADD COLUMN IF NOT EXISTS label           text,
  ADD COLUMN IF NOT EXISTS label_source    text,
  ADD COLUMN IF NOT EXISTS predicted_label text,
  ADD COLUMN IF NOT EXISTS confidence      double precision,
  ADD COLUMN IF NOT EXISTS reviewed_at     timestamptz;

-- Speeds up the webapp's seed/review queue filters.
CREATE INDEX IF NOT EXISTS biomarkers_label_idx ON biomarkers (label);
CREATE INDEX IF NOT EXISTS biomarkers_predicted_label_idx ON biomarkers (predicted_label);
