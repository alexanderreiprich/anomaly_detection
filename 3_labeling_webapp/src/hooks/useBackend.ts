import { useCallback, useEffect, useState } from 'react';
import { api, BackendError, type HealthResponse, type Strategy } from '../config/api';

interface UseBackendArgs {
  onToast?: (msg: string) => void;
  onAfterRetrain?: () => void;
  onAfterQuery?: () => void;
}

export function useBackend({ onToast, onAfterRetrain, onAfterQuery }: UseBackendArgs = {}) {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [retraining, setRetraining] = useState(false);
  const [querying, setQuerying] = useState(false);

  const refreshHealth = useCallback(async () => {
    try {
      const h = await api.health();
      setHealth(h);
      setHealthError(null);
    } catch (err) {
      setHealth(null);
      setHealthError(err instanceof Error ? err.message : 'Backend nicht erreichbar');
    }
  }, []);

  useEffect(() => {
    refreshHealth();
  }, [refreshHealth]);

  const retrain = useCallback(async () => {
    setRetraining(true);
    try {
      const res = await api.retrain();
      onToast?.(`Modell trainiert auf ${res.n_samples} Messungen (${res.classes.join(', ')})`);
      await refreshHealth();
      onAfterRetrain?.();
    } catch (err) {
      const msg = err instanceof BackendError ? err.detail : err instanceof Error ? err.message : 'Retrain fehlgeschlagen';
      onToast?.(`Retrain fehlgeschlagen: ${msg}`);
    } finally {
      setRetraining(false);
    }
  }, [onAfterRetrain, onToast, refreshHealth]);

  const refreshQueue = useCallback(
    async (n?: number, strategy?: Strategy) => {
      setQuerying(true);
      try {
        const res = await api.query(n, strategy);
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
    [onAfterQuery, onToast],
  );

  return {
    health,
    healthError,
    retraining,
    querying,
    retrain,
    refreshQueue,
    refreshHealth,
  };
}
