import { useEffect, useState } from 'react';
import { api, BackendError, type BiomarkerDetailResponse } from '../../config/api';

interface Props {
  measurementId: string;
}

const NAMES: Record<string, string> = {
  leukocytes: 'Leukozyten',
  nitrite: 'Nitrit',
  protein: 'Protein',
  blood: 'Blut',
  glucose: 'Glukose',
};

function chipStyle(value: string | null, streak: number): React.CSSProperties {
  let bg = '#bbb'; // NO_DATA / null
  if (value === 'NEGATIVE') bg = '#4C9F6F';
  else if (value === 'POSITIVE') bg = streak >= 2 ? '#A82A1B' : '#D95F3B';
  return {
    background: bg,
    color: '#fff',
    borderRadius: 6,
    padding: '8px 10px',
    minWidth: 120,
    textAlign: 'center',
    fontSize: '0.82rem',
  };
}

function chipText(value: string | null, streak: number): string {
  if (value === 'POSITIVE') return streak >= 2 ? `POSITIVE × ${streak}` : 'POSITIVE';
  if (value === 'NEGATIVE') return 'negativ';
  return 'keine Daten';
}

function fmt(v: number | null, unit = ''): string {
  if (v == null) return 'n/a';
  return `${Number.isInteger(v) ? v : v.toFixed(1)}${unit ? ' ' + unit : ''}`;
}

export function BiomarkerPanel({ measurementId }: Props) {
  const [detail, setDetail] = useState<BiomarkerDetailResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .biomarkerDetail(measurementId)
      .then((d) => {
        if (!cancelled) setDetail(d);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof BackendError ? e.detail : e instanceof Error ? e.message : 'Fehler');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [measurementId]);

  if (loading) {
    return <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>Biomarker werden geladen…</div>;
  }
  if (error || !detail) {
    return <div style={{ minHeight: 240, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999' }}>{error ?? 'Keine Biomarker-Daten vorhanden'}</div>;
  }

  const derived: Array<[string, string]> = [
    ['pH', fmt(detail.ph)],
    ['Positive Marker', fmt(detail.n_positive)],
    ['Ohne Daten', fmt(detail.n_no_data)],
    ['Max. Streak', `${fmt(detail.max_pos_streak)}×`],
    ['Vorherige Messungen', fmt(detail.n_prior_measurements)],
    ['Alter (Mitte)', fmt(detail.age_mid, 'J')],
    ['Größe (Mitte)', fmt(detail.height_mid, 'cm')],
    ['Gewicht (Mitte)', fmt(detail.weight_mid, 'kg')],
  ];

  return (
    <div style={{ minHeight: 240 }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
        {detail.markers.map((m) => (
          <div key={m.name} style={chipStyle(m.value, m.streak)}>
            <b>{NAMES[m.name] ?? m.name}</b>
            <br />
            {chipText(m.value, m.streak)}
          </div>
        ))}
      </div>
      <table style={{ borderCollapse: 'collapse', fontSize: '0.88rem' }}>
        <tbody>
          {derived.map(([k, v]) => (
            <tr key={k}>
              <td style={{ padding: '3px 16px 3px 0', fontWeight: 500, color: 'var(--muted, #555)' }}>{k}</td>
              <td style={{ padding: '3px 0' }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
