import { LABELS, LABEL_COLORS } from '../../config/constants';
import type { Label } from '../../types/measurement';
import styles from './ReviewActions.module.css';

interface Props {
  predictionLabel: Label;
  onAccept: () => void;
  onOverride: (label: Label) => void;
}

export function ReviewActions({ predictionLabel, onAccept, onOverride }: Props) {
  const overrideLabels = LABELS.filter((l) => l !== predictionLabel);

  return (
    <div className={styles.row}>
      <button
        className={styles.acceptBtn}
        style={{ background: LABEL_COLORS[predictionLabel] }}
        onClick={onAccept}
      >
        Akzeptieren: {predictionLabel.charAt(0).toUpperCase() + predictionLabel.slice(1)}
      </button>
      <span className={styles.overrideTitle}>Korrigieren:</span>
      <div className={styles.overrideBtns}>
        {overrideLabels.map((l) => (
          <button
            key={l}
            className={`${styles.overrideBtn} ${styles[l]}`}
            onClick={() => onOverride(l)}
          >
            {l.charAt(0).toUpperCase() + l.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
