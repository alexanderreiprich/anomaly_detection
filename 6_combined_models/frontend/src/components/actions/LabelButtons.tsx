import type { Label } from '../../types/measurement';
import styles from './LabelButtons.module.css';

interface Props {
  labels: readonly Label[];
  labelColors: Record<string, string>;
  onLabel: (label: Label) => void;
  onSkip: () => void;
  currentLabel?: Label | null;
}

export function LabelButtons({ labels, labelColors, onLabel, onSkip, currentLabel }: Props) {
  return (
    <div className={styles.row}>
      {labels.map((l) => (
        <button
          key={l}
          className={styles.btn}
          style={{
            background: labelColors[l],
            outline: currentLabel === l ? '3px solid var(--text)' : 'none',
            outlineOffset: 2,
          }}
          onClick={() => onLabel(l)}
        >
          {l.charAt(0).toUpperCase() + l.slice(1)}
        </button>
      ))}
      <button className={styles.skipBtn} onClick={onSkip}>
        Überspringen
      </button>
    </div>
  );
}
