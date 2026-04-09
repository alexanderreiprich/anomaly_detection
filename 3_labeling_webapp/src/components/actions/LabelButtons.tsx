import { LABELS, LABEL_COLORS } from '../../config/constants';
import type { Label } from '../../types/measurement';
import styles from './LabelButtons.module.css';

interface Props {
  onLabel: (label: Label) => void;
  onSkip: () => void;
  currentLabel?: Label | null;
}

export function LabelButtons({ onLabel, onSkip, currentLabel }: Props) {
  return (
    <div className={styles.row}>
      {LABELS.map((l) => (
        <button
          key={l}
          className={styles.btn}
          style={{
            background: LABEL_COLORS[l],
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
