import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  BarElement,
  CategoryScale,
  LinearScale,
  Tooltip,
  type TooltipItem,
} from 'chart.js';
import { Header } from '../components/layout/Header';
import { getModelConfig, type ModelConfig } from '../config/models';
import { api, BackendError, type AnalysisResponse } from '../config/api';
import styles from './Page.module.css';

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

export function AnalysisPage() {
  const { model } = useParams();
  const cfg = getModelConfig(model);

  return (
    <>
      <Header mode="analysis" modelType={cfg.type} title={`${cfg.title} Labeling`} />
      <div className={styles.container}>
        <div className={styles.main}>
          {/* key remounts (re-fetches) when the model changes */}
          <AnalysisView key={cfg.type} cfg={cfg} />
        </div>
      </div>
    </>
  );
}

function AnalysisView({ cfg }: { cfg: ModelConfig }) {
  const [data, setData] = useState<AnalysisResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setData(null);
    api
      .analysis(cfg.type)
      .then((res) => {
        if (!cancelled) setData(res);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(
          err instanceof BackendError
            ? err.detail
            : err instanceof Error
              ? err.message
              : 'Analyse konnte nicht geladen werden',
        );
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [cfg.type]);

  if (loading) {
    return (
      <div className={styles.card}>
        <span style={{ color: 'var(--muted)' }}>Analyse wird geladen…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Keine Analyse verfügbar</h2>
        <div style={{ color: '#d9534f', marginBottom: 8 }}>{error}</div>
        <p style={{ fontSize: '0.85rem', color: 'var(--muted)', margin: 0 }}>
          Falls noch kein Modell trainiert wurde: zuerst über „Retrain" ein
          Modell trainieren, dann die Analyse erneut öffnen.
        </p>
      </div>
    );
  }

  if (!data) return null;

  return (
    <>
      <MetadataCard data={data} />
      <ClassDistributionCard data={data} cfg={cfg} />
      <FeatureImportanceCard data={data} />
      <PermutationImportanceCard data={data} />
    </>
  );
}

function MetadataCard({ data }: { data: AnalysisResponse }) {
  const hp = data.hyperparameters;
  const rows: Array<[string, string]> = [
    ['Modell', data.model_type],
    ['Klassen', data.classes.join(', ')],
    ['Features', String(data.n_features)],
    ['Gelabelte Messungen', String(data.n_labeled)],
    ['n_estimators', hp.n_estimators != null ? String(hp.n_estimators) : '–'],
    ['max_depth', hp.max_depth != null ? String(hp.max_depth) : '–'],
    ['learning_rate', hp.learning_rate != null ? String(hp.learning_rate) : '–'],
    ['Artefakt', data.model_path],
  ];

  return (
    <div className={styles.card}>
      <h2 className={styles.cardHeading}>Modell-Übersicht</h2>
      <div style={metaGrid}>
        {rows.map(([k, v]) => (
          <div key={k} style={{ display: 'contents' }}>
            <span style={metaKey}>{k}</span>
            <span style={metaVal}>{v}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ClassDistributionCard({ data, cfg }: { data: AnalysisResponse; cfg: ModelConfig }) {
  const total = data.class_distribution.reduce((s, c) => s + c.count, 0);
  return (
    <div className={styles.card}>
      <h2 className={styles.cardHeading}>Klassenverteilung (gelabelte Daten)</h2>
      {total === 0 ? (
        <span style={{ color: 'var(--muted)' }}>Keine gelabelten Daten.</span>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {data.class_distribution.map((c) => {
            const frac = total ? c.count / total : 0;
            return (
              <div key={c.label} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 90, fontSize: '0.85rem' }}>{c.label}</span>
                <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 14 }}>
                  <div
                    style={{
                      width: `${frac * 100}%`,
                      height: '100%',
                      borderRadius: 4,
                      background: cfg.labelColors[c.label] ?? 'var(--primary)',
                    }}
                  />
                </div>
                <span style={{ width: 96, textAlign: 'right', fontSize: '0.85rem' }}>
                  {c.count} ({Math.round(frac * 100)}%)
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FeatureImportanceCard({ data }: { data: AnalysisResponse }) {
  const items = data.feature_importances;
  const labels = items.map((f) => f.feature);
  const values = items.map((f) => f.importance * 100);
  const height = Math.max(160, items.length * 26 + 40);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Wichtigkeit',
        data: values,
        backgroundColor: '#5B8FC9',
        borderRadius: 3,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) => `${(ctx.parsed.x ?? 0).toFixed(1)}%`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Wichtigkeit (%)', font: { size: 12 } },
        beginAtZero: true,
        grid: { color: '#f0f0f0' },
      },
      y: {
        grid: { display: false },
        ticks: { font: { size: 11 } },
      },
    },
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardHeading}>Feature-Wichtigkeit</h2>
      {items.length === 0 ? (
        <span style={{ color: 'var(--muted)' }}>Keine Feature-Wichtigkeiten verfügbar.</span>
      ) : (
        <div style={{ position: 'relative', width: '100%', height }}>
          <Bar data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}

function PermutationImportanceCard({ data }: { data: AnalysisResponse }) {
  const items = data.permutation_importances;
  const labels = items.map((f) => f.feature);
  const values = items.map((f) => f.importance * 100);
  const stds = items.map((f) => f.std * 100);
  const height = Math.max(160, items.length * 26 + 40);

  const chartData = {
    labels,
    datasets: [
      {
        label: 'Permutation',
        data: values,
        backgroundColor: '#7CB07C',
        borderRadius: 3,
      },
    ],
  };

  const options = {
    indexAxis: 'y' as const,
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (ctx: TooltipItem<'bar'>) =>
            `${values[ctx.dataIndex].toFixed(2)} ± ${stds[ctx.dataIndex].toFixed(2)} pp`,
        },
      },
    },
    scales: {
      x: {
        title: { display: true, text: 'Genauigkeits-Abfall (Prozentpunkte)', font: { size: 12 } },
        grid: { color: '#f0f0f0' },
      },
      y: { grid: { display: false }, ticks: { font: { size: 11 } } },
    },
  };

  return (
    <div className={styles.card}>
      <h2 className={styles.cardHeading}>Permutation Importance (Holdout)</h2>
      <p style={{ fontSize: '0.82rem', color: 'var(--muted)', margin: '0 0 14px' }}>
        Echter Vorhersage-Beitrag auf ungesehenen Daten: wie stark die Genauigkeit fällt, wenn ein
        Feature durchmischt wird. Werte nahe 0 (oder negativ) = trägt kaum zur Generalisierung bei.
        {data.permutation_holdout_score != null && (
          <>
            {' '}
            {data.permutation_n_splits}-fach kreuzvalidiert: Ø{' '}
            {Math.round(data.permutation_holdout_score * 100)}% Genauigkeit · n=
            {data.permutation_holdout_n}. ± = Streuung über die Folds.
          </>
        )}
      </p>
      {items.length === 0 ? (
        <span style={{ color: 'var(--muted)' }}>
          Nicht genug gelabelte Daten (mind. 10 Labels, ≥2 pro Klasse).
        </span>
      ) : (
        <div style={{ position: 'relative', width: '100%', height }}>
          <Bar data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}

const metaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'max-content 1fr',
  gap: '8px 16px',
  alignItems: 'baseline',
};
const metaKey: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--muted)' };
const metaVal: React.CSSProperties = { fontSize: '0.9rem', wordBreak: 'break-all' };
