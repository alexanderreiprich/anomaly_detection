import { LABELS, BIOMARKER_LABELS, LABEL_COLORS } from './constants';
import type { Label, ModelType } from '../types/measurement';

export interface ModelConfig {
  type: ModelType;
  /** Human-readable name shown in the header and nav. */
  title: string;
  /** Heading above the detail view (curve / biomarker panel). */
  detailHeading: string;
  /** Labels selectable for this model, in keyboard order. */
  labels: readonly Label[];
  labelColors: Record<string, string>;
  /** Keyboard key -> label (1..N). */
  keyMap: Record<string, Label>;
  /** Supabase table that holds the labels for this model. */
  table: 'measurements' | 'biomarkers';
  /** Supabase select string for the labeling queue. */
  select: string;
}

const UROFLOW_SELECT = `
  *,
  patients!inner(patient_id, age_range, height_range, weight_range),
  urine_flow(urine_flow_id, measurement_id, uro_flow, time),
  biomarkers(measurement_id, patient_id, leukocytes, nitrite, protein, blood, glucose, ascorbic_acid, bilirubin, ketone, urobilinogen, ph)
`;

// Biomarker labels live on the `biomarkers` table; created_date comes from the
// joined measurement so the panel can show the measurement date.
const BIOMARKER_SELECT = `
  *,
  patients!inner(patient_id, age_range, height_range, weight_range),
  measurements!inner(measurement_id, created_date)
`;

function keyMap(labels: readonly Label[]): Record<string, Label> {
  return Object.fromEntries(labels.map((l, i) => [String(i + 1), l]));
}

export const MODELS: Record<ModelType, ModelConfig> = {
  uroflow: {
    type: 'uroflow',
    title: 'Uroflow',
    detailHeading: 'Uroflow-Kurve',
    labels: LABELS,
    labelColors: LABEL_COLORS,
    keyMap: keyMap(LABELS),
    table: 'measurements',
    select: UROFLOW_SELECT,
  },
  biomarker: {
    type: 'biomarker',
    title: 'Biomarker',
    detailHeading: 'Biomarker-Panel',
    labels: BIOMARKER_LABELS,
    labelColors: LABEL_COLORS,
    keyMap: keyMap(BIOMARKER_LABELS),
    table: 'biomarkers',
    select: BIOMARKER_SELECT,
  },
};

export const MODEL_TYPES = Object.keys(MODELS) as ModelType[];

export function getModelConfig(model: string | undefined): ModelConfig {
  if (model && model in MODELS) return MODELS[model as ModelType];
  return MODELS.uroflow;
}
