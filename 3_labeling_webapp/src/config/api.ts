import { getIdToken } from './cognito';
import type { Label } from '../types/measurement';

const BASE_URL = (import.meta.env.VITE_AL_BACKEND_URL ?? '').replace(/\/$/, '');

export type Strategy = 'entropy' | 'margin' | 'least_confident';

export interface HealthResponse {
  status: string;
  model_loaded: boolean;
  strategy: Strategy;
}

export interface RetrainResponse {
  trained: boolean;
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
  classes: string[];
  items: PredictItem[];
}

export interface CurveResponse {
  measurement_id: string;
  time: number[];
  flow: number[];
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
  health: () => request<HealthResponse>('/health'),

  retrain: () => request<RetrainResponse>('/retrain', { method: 'POST' }),

  query: (n?: number, strategy?: Strategy) => {
    const params = new URLSearchParams();
    if (n != null) params.set('n', String(n));
    if (strategy) params.set('strategy', strategy);
    const qs = params.toString();
    return request<QueryResponse>(`/query${qs ? `?${qs}` : ''}`);
  },

  predict: (measurements: Array<Record<string, number | null>>) =>
    request<PredictResponse>('/predict', {
      method: 'POST',
      body: JSON.stringify({ measurements }),
    }),

  curve: (measurementId: string) =>
    request<CurveResponse>(
      `/measurements/${encodeURIComponent(measurementId)}/curve`,
    ),
};
