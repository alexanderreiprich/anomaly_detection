import { useCallback, useEffect, useState } from 'react';
import { api, BackendError, type HealthResponse, type Strategy } from '../config/api';
import type { ModelType } from '../types/measurement';

interface UseBackendArgs {
  modelType: ModelType;
  onToast?: (msg: string) => void;
  onAfterRetrain?: () => void;
  onAfterQuery?: () => void;
}

export function useBackend({ modelType, onToast, onAfterRetrain, onAfterQuery }: UseBackendArgs) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [querying, setQuerying] = useState(false);
  const [autoLabeling, setAutoLabeling] = useState(false);
  const [plateauing, setPlateauing] = useState(false);
  const [resetting, setResetting] = useState(false);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health(modelType);
      setHealth(h);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(err instanceof Error ? err.message : 'Backend nicht erreichbar');
    }
  }, [modelType]);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const retrain = useCallback(async () => {
    setRetraining(true);
    try {
      const res = await api.retrain(modelType);
      onToast?.(`Modell trainiert auf ${res.n_samples} Messungen (${res.classes.join(', ')})`);
      await refreshHealth();
      onAfterRetrain?.();
    } catch (err) {
      const msg = err instanceof BackendError ? err.detail : err instanceof Error ? err.message : 'Retrain fehlgeschlagen';
      onToast?.(`Retrain fehlgeschlagen: ${msg}`);
    } finally {
      setRetraining(false);
    }
  }, [modelType, onAfterRetrain, onToast, refreshHealth]);

  const refreshQueue = useCallback(
    async (n?: number, strategy?: Strategy) => {
      setQuerying(true);
      try {
        const res = await api.query(modelType, n, strategy);
        onToast?.(
          res.n === 0
            ? 'Keine unsicheren Messungen gefunden'
            : `${res.n} neue Predictions in der Review-Queue`,
        );
        onAfterQuery?.();
      } catch (err) {
        const msg = err instanceof BackendError ? err.detail : err instanceof Error ? err.message : 'Query fehlgeschlagen';
        onToast?.(`Query fehlgeschlagen: ${msg}`);
      } finally {
        setQuerying(false);
      }
    },
    [modelType, onAfterQuery, onToast],
  );

  const runAutoLabel = useCallback(
    async (mode: 'standard' | 'plateau') => {
      const setBusy = mode === 'plateau' ? setPlateauing : setAutoLabeling;
      setBusy(true);
      try {
        const res = await api.autoLabel(modelType, mode);
        const action = mode === 'plateau' ? 'Plateau-Lauf' : 'Auto-Label';
        onToast?.(
          res.auto_labeled === 0
            ? `${action}: keine passenden Vorhersagen`
            : `${action}: ${res.auto_labeled} Messungen gelabelt (≥ ${Math.round(res.threshold * 100)}% Konfidenz), ${res.remaining_unlabeled} offen`,
        );
        onAfterQuery?.();
      } catch (err) {
        const msg = err instanceof BackendError ? err.detail : err instanceof Error ? err.message : 'Fehlgeschlagen';
        onToast?.(`${mode === 'plateau' ? 'Plateau-Lauf' : 'Auto-Label'} fehlgeschlagen: ${msg}`);
      } finally {
        setBusy(false);
      }
    },
    [modelType, onAfterQuery, onToast],
  );

  const autoLabel = useCallback(() => runAutoLabel('standard'), [runAutoLabel]);
  const plateau = useCallback(() => runAutoLabel('plateau'), [runAutoLabel]);

  const reset = useCallback(async () => {
    setResetting(true);
    try {
      const res = await api.reset(modelType);
      onToast?.(`${res.reset} Labels zurückgesetzt — alles auf Anfang`);
      await refreshHealth();
      onAfterQuery?.();
    } catch (err) {
      const msg = err instanceof BackendError ? err.detail : err instanceof Error ? err.message : 'Reset fehlgeschlagen';
      onToast?.(`Reset fehlgeschlagen: ${msg}`);
    } finally {
      setResetting(false);
    }
  }, [modelType, onAfterQuery, onToast, refreshHealth]);

  return {
    health,
    healthError,
    retraining,
    querying,
    autoLabeling,
    plateauing,
    resetting,
    retrain,
    refreshQueue,
    autoLabel,
    plateau,
    reset,
    refreshHealth,
  };
}
