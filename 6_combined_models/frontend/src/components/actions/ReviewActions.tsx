import type { Label } from '../../types/measurement';
import styles from './ReviewActions.module.css';

interface Props {
  labels: readonly Label[];
  labelColors: Record<string, string>;
  predictionLabel: Label;
  onAccept: () => void;
  onOverride: (label: Label) => void;
}

export function ReviewActions({ labels, labelColors, predictionLabel, onAccept, onOverride }: Props) {
  const overrideLabels = labels.filter((l) => l !== predictionLabel);

  return (
    <div className={styles.row}>
      <button
        className={styles.acceptBtn}
        style={{ background: labelColors[predictionLabel] }}
        onClick={onAccept}
      >
        Akzeptieren: {predictionLabel.charAt(0).toUpperCase() + predictionLabel.slice(1)}
      </button>
      <span className={styles.overrideTitle}>Korrigieren:</span>
      <div className={styles.overrideBtns}>
        {overrideLabels.map((l) => (
          <button
            key={l}
            className={styles.overrideBtn}
            style={{ borderColor: labelColors[l], color: labelColors[l] }}
            onClick={() => onOverride(l)}
          >
            {l.charAt(0).toUpperCase() + l.slice(1)}
          </button>
        ))}
      </div>
    </div>
  );
}
