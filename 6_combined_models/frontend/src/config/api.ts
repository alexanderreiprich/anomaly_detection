import { getIdToken } from './cognito';
import type { Label, ModelType } from '../types/measurement';

const BASE_URL = (import.meta.env.VITE_AL_BACKEND_URL ?? '').replace(/\/$/, '');

export type Strategy = 'entropy' | 'margin' | 'least_confident';

export interface HealthResponse {
  status: string;
  model_type: ModelType;
  model_loaded: boolean;
  strategy: Strategy;
  models: string[];
}

export interface RetrainResponse {
  trained: boolean;
  model_type: ModelType;
  n_samples: number;
  classes: string[];
  model_path: string;
}

export interface QueryItem {
  measurement_id: string;
  patient_id: string | null;
  predicted_label: Label;
  confidence: number;
  uncertainty: number;
  features: Record<string, number | null>;
}

export interface QueryResponse {
  model_type: ModelType;
  strategy: Strategy;
  n: number;
  items: QueryItem[];
}

export interface PredictItem {
  predicted_label: Label;
  confidence: number;
  proba: Record<string, number>;
}

export interface PredictResponse {
  model_type: ModelType;
  classes: string[];
  items: PredictItem[];
}

export interface AutoLabelResponse {
  model_type: ModelType;
  auto_labeled: number;
  threshold: number;
  remaining_unlabeled: number;
}

export interface ResetResponse {
  model_type: ModelType;
  reset: number;
}

export interface CurveResponse {
  measurement_id: string;
  time: number[];
  flow: number[];
}

export interface BiomarkerMarker {
  name: string;
  value: string | null;
  streak: number;
}

export interface BiomarkerDetailResponse {
  measurement_id: string;
  patient_id: string | null;
  markers: BiomarkerMarker[];
  ph: number | null;
  n_positive: number;
  n_no_data: number;
  max_pos_streak: number;
  n_prior_measurements: number;
  age_mid: number | null;
  height_mid: number | null;
  weight_mid: number | null;
}

export class BackendError extends Error {
  status: number;
  detail: string;
  constructor(status: number, detail: string) {
    super(`Backend ${status}: ${detail}`);
    this.status = status;
    this.detail = detail;
  }
}

async function authHeaders(): Promise<Record<string, string>> {
  try {
    const token = await getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  if (!BASE_URL) {
    throw new BackendError(0, 'VITE_AL_BACKEND_URL is not set');
  }
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(await authHeaders()),
    ...((init.headers as Record<string, string>) ?? {}),
  };
  const res = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      const body = await res.json();
      detail = body?.detail ?? detail;
    } catch {
      /* ignore */
    }
    throw new BackendError(res.status, detail);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: (modelType: ModelType) =>
    request<HealthResponse>(`/health?model_type=${modelType}`),

  retrain: (modelType: ModelType) =>
    request<RetrainResponse>(`/retrain?model_type=${modelType}`, { method: 'POST' }),

  query: (modelType: ModelType, n?: number, strategy?: Strategy) => {
    const params = new URLSearchParams({ model_type: modelType });
    if (n != null) params.set('n', String(n));
    if (strategy) params.set('strategy', strategy);
    return request<QueryResponse>(`/query?${params.toString()}`);
  },

  autoLabel: (modelType: ModelType, mode: 'standard' | 'plateau' = 'standard') =>
    request<AutoLabelResponse>(`/auto_label?model_type=${modelType}&mode=${mode}`, { method: 'POST' }),

  reset: (modelType: ModelType) =>
    request<ResetResponse>(`/reset?model_type=${modelType}`, { method: 'POST' }),

  predict: (modelType: ModelType, measurements: Array<Record<string, number | null>>) =>
    request<PredictResponse>(`/predict?model_type=${modelType}`, {
      method: 'POST',
      body: JSON.stringify({ measurements }),
    }),

  curve: (measurementId: string) =>
    request<CurveResponse>(
      `/measurements/${encodeURIComponent(measurementId)}/curve`,
    ),

  biomarkerDetail: (measurementId: string) =>
    request<BiomarkerDetailResponse>(
      `/measurements/${encodeURIComponent(measurementId)}/biomarker`,
    ),
};
