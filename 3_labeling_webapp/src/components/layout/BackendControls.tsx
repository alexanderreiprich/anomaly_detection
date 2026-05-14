import type { HealthResponse } from '../../config/api';
import styles from './BackendControls.module.css';

interface Props {
  health: HealthResponse | null;
  healthError: string | null;
  retraining: boolean;
  querying: boolean;
  onRetrain: () => void;
  onRefreshQueue: () => void;
}

export function BackendControls({
  health,
  healthError,
  retraining,
  querying,
  onRetrain,
  onRefreshQueue,
}: Props) {
  const status: 'down' | 'no-model' | 'ready' = healthError
    ? 'down'
    : health && !health.model_loaded
      ? 'no-model'
      : 'ready';

  const dotClass =
    status === 'ready' ? styles.dotReady : status === 'no-model' ? styles.dotWarn : styles.dotDown;
  const tooltip =
    status === 'down'
      ? `Backend nicht erreichbar${healthError ? `: ${healthError}` : ''}`
      : status === 'no-model'
        ? 'Backend OK – Modell noch nicht trainiert'
        : `Backend OK – Strategie: ${health?.strategy}`;

  return (
    <div className={styles.controls}>
      <span className={styles.health} title={tooltip}>
        <span className={`${styles.dot} ${dotClass}`} />
        ML
      </span>
      <button
        className={styles.btn}
        onClick={onRetrain}
        disabled={retraining || status === 'down'}
        title="Modell neu trainieren auf allen aktuell gelabelten Messungen"
      >
        {retraining ? 'Trainiere…' : 'Retrain'}
      </button>
      <button
        className={styles.btn}
        onClick={onRefreshQueue}
        disabled={querying || status !== 'ready'}
        title="Review-Queue mit neuen unsicheren Predictions auffüllen"
      >
        {querying ? 'Lade…' : 'Refresh Queue'}
      </button>
    </div>
  );
}
