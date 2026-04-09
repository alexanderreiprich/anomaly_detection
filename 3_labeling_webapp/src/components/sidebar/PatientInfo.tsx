import type { Measurement, Label } from '../../types/measurement';
import { LABEL_COLORS } from '../../config/constants';
import styles from './PatientInfo.module.css';

interface Props {
  measurement: Measurement;
  mode: 'seed' | 'review';
}

export function PatientInfo({ measurement: m, mode }: Props) {
  const patient = m.patients;

  const statusLabel = () => {
    if (!m.label) {
      return <span className={styles.muted}>{mode === 'review' ? 'ausstehend' : 'unlabeled'}</span>;
    }
    const color = LABEL_COLORS[m.label as Label];
    if (mode === 'review' && m.predicted_label) {
      const accepted = m.label === m.predicted_label;
      return <span style={{ color, fontWeight: 600 }}>{m.label} ({accepted ? 'akzeptiert' : 'korrigiert'})</span>;
    }
    return <span style={{ color, fontWeight: 600 }}>{m.label}</span>;
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.heading}>Messung</h2>
      <div className={styles.info}>
        <Row label="ID" value={m.measurement_id} />
        <Row label="Patient" value={m.patient_id} />
        <Row label="Datum" value={m.created_date} />
        <Row label="Alter" value={`${patient.age_range} Jahre`} />
        <Row label="Gewicht" value={`${patient.weight_range} kg`} />
        <Row label="Größe" value={`${patient.height_range} cm`} />
        <div className={styles.row}>
          <span className={styles.key}>Status</span>
          {statusLabel()}
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.row}>
      <span className={styles.key}>{label}</span>
      <span>{value}</span>
    </div>
  );
}
