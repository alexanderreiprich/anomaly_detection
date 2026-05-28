import { useEffect, useState } from 'react';
import { useIpssSubmissions } from '../../hooks/useIpssSubmissions';
import styles from './IpssCard.module.css';

interface Props {
  patientId: string;
}

function severity(score: number): { label: string; className: string } {
  if (score <= 7) return { label: 'mild', className: styles.sevMild };
  if (score <= 19) return { label: 'moderat', className: styles.sevModerate };
  return { label: 'schwer', className: styles.sevSevere };
}

function formatDate(raw: string): string {
  const d = new Date(raw.replace(' ', 'T'));
  if (Number.isNaN(d.getTime())) return raw;
  return d.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function IpssCard({ patientId }: Props) {
  const { submissions, loading, error } = useIpssSubmissions(patientId);
  const [idx, setIdx] = useState(0);

  useEffect(() => {
    setIdx(0);
  }, [patientId, submissions.length]);

  if (loading) {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>IPSS</h2>
        <div className={styles.muted}>Lade...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>IPSS</h2>
        <div className={styles.muted}>Fehler: {error}</div>
      </div>
    );
  }

  if (submissions.length === 0) {
    return (
      <div className={styles.card}>
        <h2 className={styles.heading}>IPSS</h2>
        <div className={styles.muted}>Keine IPSS-Einträge für diesen Patienten.</div>
      </div>
    );
  }

  const current = submissions[Math.min(idx, submissions.length - 1)];
  const sev = severity(current.score);
  const responses = [...current.ipss_responses].sort(
    (a, b) => (a.ipss_questions?.question_number ?? 0) - (b.ipss_questions?.question_number ?? 0),
  );

  return (
    <div className={styles.card}>
      <div className={styles.headerRow}>
        <h2 className={styles.heading}>IPSS</h2>
        {submissions.length > 1 && (
          <div className={styles.nav}>
            <button
              className={styles.navBtn}
              onClick={() => setIdx((i) => Math.min(i + 1, submissions.length - 1))}
              disabled={idx >= submissions.length - 1}
              title="Ältere Submission"
            >
              &larr;
            </button>
            <span className={styles.counter}>
              {idx + 1} / {submissions.length}
            </span>
            <button
              className={styles.navBtn}
              onClick={() => setIdx((i) => Math.max(i - 1, 0))}
              disabled={idx === 0}
              title="Neuere Submission"
            >
              &rarr;
            </button>
          </div>
        )}
      </div>

      <div className={styles.summary}>
        <div>
          <div className={styles.label}>Datum</div>
          <div className={styles.date}>{formatDate(current.submitted_at)}</div>
        </div>
        <div className={styles.scoreBlock}>
          <div className={styles.label}>Score</div>
          <div className={styles.scoreRow}>
            <span className={styles.score}>{current.score}</span>
            <span className={styles.scoreMax}>/ 35</span>
            <span className={`${styles.sevTag} ${sev.className}`}>{sev.label}</span>
          </div>
        </div>
      </div>

      <div className={styles.divider} />

      <ul className={styles.responses}>
        {responses.map((r) => (
          <li key={r.response_id} className={styles.responseRow}>
            <div className={styles.questionLine}>
              <span className={styles.qNum}>
                {r.ipss_questions?.question_number ?? '?'}.
              </span>
              <span className={styles.qText}>
                {r.ipss_questions?.question_text ?? 'Unbekannte Frage'}
              </span>
            </div>
            <div className={styles.answerLine}>
              <span className={styles.answerText}>
                {r.ipss_answer_options?.option_text ?? '—'}
              </span>
              <span className={styles.points}>
                {r.ipss_answer_options?.points ?? r.answer_value}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
