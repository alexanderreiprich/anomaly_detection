import { LABEL_COLORS } from '../../config/constants';
import type { Label } from '../../types/measurement';
import styles from './PredictionCard.module.css';

interface Props {
  label: Label;
  confidence: number;
}

export function PredictionCard({ label, confidence }: Props) {
  const confPct = Math.round(confidence * 100);
  const confClass = confPct < 45 ? styles.confLow : confPct < 65 ? styles.confMedium : styles.confHigh;

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Modell-Vorhersage</h2>
      <div className={styles.predHeader}>
        <span className={styles.predLabel} style={{ color: LABEL_COLORS[label] }}>
          {label.charAt(0).toUpperCase() + label.slice(1)}
        </span>
        <span className={`${styles.confTag} ${confClass}`}>{confPct}%</span>
      </div>
      <div className={styles.bars}>
        <div className={styles.confRow}>
          <span className={styles.confName}>{label}</span>
          <div className={styles.barBg}>
            <div
              className={styles.barFill}
              style={{ width: `${confPct}%`, background: LABEL_COLORS[label] }}
            />
          </div>
          <span className={styles.confPct}>{confPct}%</span>
        </div>
      </div>
    </div>
  );
}
