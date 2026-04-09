export type Label = 'normal' | 'warning' | 'critical';

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

export interface Measurement {
  measurement_id: string;
  patient_id: string;
  urine_volume: number;
  created_date: string;
  max_flow: number;
  avg_flow: number;
  micturition_time: number;
  flow_time: number;
  rise_time: number;
  // added columns
  label: Label | null;
  label_source: 'human' | 'model' | null;
  predicted_label: Label | null;
  confidence: number | null;
  reviewed_at: string | null;
  // joined relations
  patients: Patient;
  urine_flow: UrinFlowPoint[];
  biomarkers: Biomarker[];
}

export interface LabelingStats {
  total: number;
  labeled: number;
  remaining: number;
  accepted?: number;
  overridden?: number;
}
