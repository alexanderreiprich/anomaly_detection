import type { Measurement } from '../../types/measurement';
import styles from './Biomarkers.module.css';

interface Props {
  measurement: Measurement;
}

const FLOW_ITEMS = [
  { key: 'urine_volume', name: 'Urinvolumen', unit: 'ml' },
  { key: 'max_flow', name: 'Max. Flow', unit: 'ml/s' },
  { key: 'avg_flow', name: 'Avg. Flow', unit: 'ml/s' },
  { key: 'micturition_time', name: 'Miktionszeit', unit: 's' },
  { key: 'flow_time', name: 'Flowzeit', unit: 's' },
  { key: 'rise_time', name: 'Anstiegszeit', unit: 's' },
] as const;

const URINE_ITEMS = [
  { key: 'blood', name: 'Blut' },
  { key: 'nitrite', name: 'Nitrit' },
  { key: 'protein', name: 'Protein' },
  { key: 'leukocytes', name: 'Leukozyten' },
  { key: 'glucose', name: 'Glukose' },
  { key: 'ascorbic_acid', name: 'Ascorbinsäure' },
  { key: 'bilirubin', name: 'Bilirubin' },
  { key: 'ketone', name: 'Keton' },
  { key: 'urobilinogen', name: 'Urobilinogen' },
] as const;

export function Biomarkers({ measurement: m }: Props) {

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Biomarker</h2>
      <div className={styles.grid}>
        <div className={styles.sectionTitle}>Uroflow</div>
        {FLOW_ITEMS.map((b) => (
          <div key={b.key} className={styles.item}>
            <div className={styles.value}>{m[b.key]}</div>
            <div className={styles.unit}>{b.unit}</div>
            <div className={styles.label}>{b.name}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
