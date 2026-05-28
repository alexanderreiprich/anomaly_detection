import type { LabelItem, Label } from '../../types/measurement';
import type { IpssSubmission } from '../../types/ipss';
import { LABEL_COLORS } from '../../config/constants';
import { useIpssSubmissions } from '../../hooks/useIpssSubmissions';
import styles from './PatientInfo.module.css';

interface Props {
  measurement: LabelItem;
  mode: 'seed' | 'review';
}

// Total IPSS = the points of every answered question summed up.
function ipssTotal(sub: IpssSubmission): number {
  return sub.ipss_responses.reduce(
    (acc, r) => acc + (r.ipss_answer_options?.points ?? r.answer_value ?? 0),
    0,
  );
}

function formatDateTime(raw: string): string {
  const d = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleString('de-DE', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function PatientInfo({ measurement: m, mode }: Props) {
  const patient = m.patients;
  const { submissions } = useIpssSubmissions(m.patient_id);
  const latestIpss = submissions[0];
  const ipssScore = latestIpss ? ipssTotal(latestIpss) : null;

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
        <Row label="Datum" value={formatDateTime(m.created_date)} />
        <Row label="Alter" value={`${patient.age_range} Jahre`} />
        <Row label="Gewicht" value={`${patient.weight_range} kg`} />
        <Row label="Größe" value={`${patient.height_range} cm`} />
        {ipssScore != null && <Row label="IPSS (gesamt)" value={`${ipssScore} / 35`} />}
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
