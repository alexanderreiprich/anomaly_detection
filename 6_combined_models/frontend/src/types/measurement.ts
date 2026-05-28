export type Label = 'normal' | 'warning' | 'critical' | 'invalid';
export type ModelType = 'uroflow' | 'biomarker';

export interface UrinFlowPoint {
  urine_flow_id: string;
  measurement_id: string;
  uro_flow: number;
  time: number;
}

export interface Biomarker {
  measurement_id: string;
  patient_id: string;
  leukocytes: string;
  nitrite: string;
  protein: string;
  blood: string;
  glucose: string;
  ascorbic_acid: string;
  bilirubin: string;
  ketone: string;
  urobilinogen: string;
  ph: number;
}

export interface Patient {
  patient_id: string;
  age_range: string;
  height_range: string;
  weight_range: string;
}

// Fields shared by every labeling item, regardless of model.
export interface BaseItem {
  measurement_id: string;
  patient_id: string;
  created_date: string;
  label: Label | null;
  label_source: 'human' | 'model' | null;
  predicted_label: Label | null;
  confidence: number | null;
  reviewed_at: string | null;
  patients: Patient;
}

// Uroflow labeling item — a row of the `measurements` table.
export interface Measurement extends BaseItem {
  urine_volume: number;
  max_flow: number;
  avg_flow: number;
  micturition_time: number;
  flow_time: number;
  rise_time: number;
  urine_flow: UrinFlowPoint[];
  biomarkers: Biomarker[];
}

// Biomarker labeling item — a row of the `biomarkers` table (raw dip-stick
// values). Streaks and derived features are computed by the backend and shown
// via the BiomarkerPanel, which fetches them per measurement.
export interface BiomarkerItem extends BaseItem {
  leukocytes: string;
  nitrite: string;
  protein: string;
  blood: string;
  glucose: string;
  ascorbic_acid: string;
  bilirubin: string;
  ketone: string;
  urobilinogen: string;
  ph: number;
}

export type LabelItem = Measurement | BiomarkerItem;

export interface LabelingStats {
  total: number;
  labeled: number;
  remaining: number;
  accepted?: number;
  overridden?: number;
}
