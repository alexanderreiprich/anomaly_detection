import styles from './Navigation.module.css';

interface Props {
  currentIdx: number;
  total: number;
  onPrev: () => void;
  onNext: () => void;
  mode: 'seed' | 'review';
}

export function Navigation({ currentIdx, total, onPrev, onNext, mode }: Props) {
  return (
    <div className={styles.row}>
      <button className={styles.btn} onClick={onPrev} disabled={currentIdx === 0}>
        &larr; Vorherige
      </button>
      <div className={styles.hints}>
        {mode === 'seed' ? (
          <>
            <kbd>1</kbd> Normal &nbsp; <kbd>2</kbd> Warning &nbsp; <kbd>3</kbd> Critical &nbsp;
            <kbd>S</kbd> Skip &nbsp; <kbd>&larr;</kbd><kbd>&rarr;</kbd> Nav
          </>
        ) : (
          <>
            <kbd>Enter</kbd> Akzeptieren &nbsp; <kbd>1</kbd> Normal &nbsp; <kbd>2</kbd> Warning &nbsp;
            <kbd>3</kbd> Critical &nbsp; <kbd>&larr;</kbd><kbd>&rarr;</kbd> Nav
          </>
        )}
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
