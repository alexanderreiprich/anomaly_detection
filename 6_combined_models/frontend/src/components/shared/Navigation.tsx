import type { Label } from '../../types/measurement';
import styles from './Navigation.module.css';

interface Props {
  currentIdx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  mode: 'seed' | 'review';
  labels: readonly Label[];
}

export function Navigation({ currentIdx, total, onPrev, onNext, mode, labels }: Props) {
  return (
    <div className={styles.row}>
      <button className={styles.btn} onClick={onPrev} disabled={currentIdx === 0}>
        &larr; Vorherige
      </button>
      <div className={styles.hints}>
        {mode === 'review' && (
          <>
            <kbd>Enter</kbd> Akzeptieren &nbsp;
          </>
        )}
        {labels.map((l, i) => (
          <span key={l}>
            <kbd>{i + 1}</kbd> {l.charAt(0).toUpperCase() + l.slice(1)} &nbsp;
          </span>
        ))}
        {mode === 'seed' && (
          <>
            <kbd>S</kbd> Skip &nbsp;
          </>
        )}
        <kbd>&larr;</kbd>
        <kbd>&rarr;</kbd> Nav
      </div>
      <span className={styles.counter}>
        {currentIdx + 1} / {total}
      </span>
      <button className={styles.btn} onClick={onNext} disabled={currentIdx >= total - 1}>
        Nächste &rarr;
      </button>
    </div>
  );
}
