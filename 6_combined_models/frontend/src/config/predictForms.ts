import type { ModelType } from '../types/measurement';

export interface FormField {
  key: string;
  label: string;
  type: 'number' | 'select';
  group: string;
  options?: { value: string; label: string }[];
  placeholder?: string;
  unit?: string;
  defaultValue?: string;
}

export interface PredictForm {
  fields: FormField[];
  /** Maps the form state to the feature dict the /predict endpoint expects. */
  buildFeatures: (state: Record<string, string>) => Record<string, number | null>;
  hint?: string;
}

function num(s: string | undefined): number | null {
  if (s == null || s.trim() === '') return null;
  const n = Number(s);
  return Number.isNaN(n) ? null : n;
}

// ── Uroflow: plain numeric features, all optional (blank -> NaN) ─────────────
const UROFLOW_FIELDS: FormField[] = [
  { key: 'urine_volume', label: 'Urinvolumen', unit: 'ml', type: 'number', group: 'Flow' },
  { key: 'max_flow', label: 'Max. Flow', unit: 'ml/s', type: 'number', group: 'Flow' },
  { key: 'avg_flow', label: 'Avg. Flow', unit: 'ml/s', type: 'number', group: 'Flow' },
  { key: 'micturition_time', label: 'Miktionszeit', unit: 's', type: 'number', group: 'Flow' },
  { key: 'flow_time', label: 'Flowzeit', unit: 's', type: 'number', group: 'Flow' },
  { key: 'rise_time', label: 'Anstiegszeit', unit: 's', type: 'number', group: 'Flow' },
  { key: 'ipss_score', label: 'IPSS Score', type: 'number', group: 'IPSS' },
  { key: 'ipss_delta_prev', label: 'IPSS Δ vorher', type: 'number', group: 'IPSS' },
  { key: 'ipss_days_since', label: 'Tage seit IPSS', type: 'number', group: 'IPSS' },
  { key: 'flow_skewness', label: 'Flow Skewness', type: 'number', group: 'Kurvenform' },
  { key: 'flow_std', label: 'Flow Std', type: 'number', group: 'Kurvenform' },
  { key: 'plateau_ratio', label: 'Plateau Ratio', type: 'number', group: 'Kurvenform' },
  { key: 'n_peaks', label: 'Anzahl Peaks', type: 'number', group: 'Kurvenform' },
  { key: 'flow_smoothness', label: 'Flow Smoothness', type: 'number', group: 'Kurvenform' },
];

const uroflowForm: PredictForm = {
  fields: UROFLOW_FIELDS,
  buildFeatures: (s) =>
    Object.fromEntries(UROFLOW_FIELDS.map((f) => [f.key, num(s[f.key])])),
  hint: 'Leere Felder werden als „fehlend" behandelt (das Modell toleriert das).',
};

// ── Biomarker: friendly inputs; derived features are computed here ───────────
// pH normal band — mirrors backend PH_LOW / PH_HIGH (core/config.py). The model
// sees only the monotonic distance from this band, never the raw pH.
const PH_LOW = 4.0;
const PH_HIGH = 8.5;
const phAbnormality = (ph: number | null): number | null =>
  ph == null ? null : Math.max(0, PH_LOW - ph) + Math.max(0, ph - PH_HIGH);

const MARKERS = ['leukocytes', 'nitrite', 'protein', 'blood', 'glucose'] as const;
const MARKER_LABELS: Record<string, string> = {
  leukocytes: 'Leukozyten',
  nitrite: 'Nitrit',
  protein: 'Protein',
  blood: 'Blut',
  glucose: 'Glukose',
};
const MARKER_OPTIONS = [
  { value: 'NO_DATA', label: 'keine Daten' },
  { value: 'NEGATIVE', label: 'negativ' },
  { value: 'POSITIVE', label: 'positiv' },
];

const BIOMARKER_FIELDS: FormField[] = [
  ...MARKERS.map((m) => ({
    key: m,
    label: MARKER_LABELS[m],
    type: 'select' as const,
    options: MARKER_OPTIONS,
    group: 'Biomarker',
    defaultValue: 'NO_DATA',
  })),
  { key: 'streak', label: 'Positiv-Streak (für positive Marker)', type: 'number', group: 'Kontext', defaultValue: '1' },
  { key: 'n_prior_measurements', label: 'Vorherige Messungen', type: 'number', group: 'Kontext', defaultValue: '0' },
  { key: 'ph', label: 'pH', type: 'number', group: 'Werte', placeholder: 'z.B. 6.0' },
  { key: 'age', label: 'Alter', unit: 'J', type: 'number', group: 'Demografie' },
  { key: 'height', label: 'Größe', unit: 'cm', type: 'number', group: 'Demografie' },
  { key: 'weight', label: 'Gewicht', unit: 'kg', type: 'number', group: 'Demografie' },
];

const biomarkerForm: PredictForm = {
  fields: BIOMARKER_FIELDS,
  buildFeatures: (s) => {
    const encode = (v: string): number | null => (v === 'POSITIVE' ? 1 : v === 'NEGATIVE' ? 0 : null);
    const streak = num(s.streak) ?? 0;
    const feats: Record<string, number | null> = {};
    let nPositive = 0;
    let nNoData = 0;
    let anyPositive = false;

    for (const m of MARKERS) {
      const v = s[m] ?? 'NO_DATA';
      feats[m] = encode(v);
      const isPos = v === 'POSITIVE';
      feats[`${m}_streak`] = isPos ? streak : 0;
      if (isPos) {
        nPositive += 1;
        anyPositive = true;
      }
      if (v === 'NO_DATA') nNoData += 1;
    }

    feats.n_positive = nPositive;
    feats.n_no_data = nNoData;
    feats.max_pos_streak = anyPositive ? streak : 0;
    feats.n_prior_measurements = num(s.n_prior_measurements) ?? 0;
    feats.ph_abn = phAbnormality(num(s.ph));
    feats.age_mid = num(s.age);
    feats.height_mid = num(s.height);
    feats.weight_mid = num(s.weight);
    return feats;
  },
  hint: 'Streaks und Zähler (n_positive usw.) werden aus den Eingaben berechnet. Der Positiv-Streak gilt für alle als positiv gewählten Marker.',
};

export const PREDICT_FORMS: Record<ModelType, PredictForm> = {
  uroflow: uroflowForm,
  biomarker: biomarkerForm,
};
