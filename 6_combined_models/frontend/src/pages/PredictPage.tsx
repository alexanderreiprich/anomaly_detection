import { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Header } from '../components/layout/Header';
import { getModelConfig, type ModelConfig } from '../config/models';
import { PREDICT_FORMS, type FormField } from '../config/predictForms';
import { api, BackendError, type PredictItem } from '../config/api';
import styles from './Page.module.css';

export function PredictPage() {
  const { model } = useParams();
  const cfg = getModelConfig(model);

  return (
    <>
      <Header mode="predict" modelType={cfg.type} title={`${cfg.title} Labeling`} />
      <div className={styles.container}>
        <div className={styles.main}>
          {/* key remounts the bench (fresh inputs) when the model changes */}
          <PredictBench key={cfg.type} cfg={cfg} />
        </div>
      </div>
    </>
  );
}

function initialState(fields: FormField[]): Record<string, string> {
  const s: Record<string, string> = {};
  for (const f of fields) s[f.key] = f.defaultValue ?? '';
  return s;
}

function PredictBench({ cfg }: { cfg: ModelConfig }) {
  const form = PREDICT_FORMS[cfg.type];
  const [state, setState] = useState<Record<string, string>>(() => initialState(form.fields));
  const [result, setResult] = useState<PredictItem | null>(null);
  const [classes, setClasses] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const groups = useMemo(() => {
    const g: Record<string, FormField[]> = {};
    for (const f of form.fields) (g[f.group] ??= []).push(f);
    return g;
  }, [form]);

  const setField = (k: string, v: string) => setState((p) => ({ ...p, [k]: v }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const features = form.buildFeatures(state);
      const res = await api.predict(cfg.type, [features]);
      setResult(res.items[0] ?? null);
      setClasses(res.classes);
    } catch (err) {
      setError(
        err instanceof BackendError
          ? err.detail
          : err instanceof Error
            ? err.message
            : 'Vorhersage fehlgeschlagen',
      );
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setState(initialState(form.fields));
    setResult(null);
    setError(null);
  };

  return (
    <>
      <div className={styles.card}>
        <h2 className={styles.cardHeading}>Messdaten eingeben</h2>
        <form onSubmit={handleSubmit}>
          {Object.entries(groups).map(([group, fields]) => (
            <fieldset key={group} style={fieldsetStyle}>
              <legend style={legendStyle}>{group}</legend>
              <div style={gridStyle}>
                {fields.map((f) => (
                  <label key={f.key} style={labelStyle}>
                    <span style={fieldLabelStyle}>
                      {f.label}
                      {f.unit ? ` (${f.unit})` : ''}
                    </span>
                    {f.type === 'select' ? (
                      <select value={state[f.key]} onChange={(e) => setField(f.key, e.target.value)} style={inputStyle}>
                        {f.options!.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    ) : (
                      <input
                        type="number"
                        step="any"
                        value={state[f.key]}
                        placeholder={f.placeholder ?? ''}
                        onChange={(e) => setField(f.key, e.target.value)}
                        style={inputStyle}
                      />
                    )}
                  </label>
                ))}
              </div>
            </fieldset>
          ))}

          {form.hint && <p style={hintStyle}>{form.hint}</p>}

          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <button type="submit" disabled={loading} style={primaryBtn}>
              {loading ? 'Berechne…' : 'Label vorhersagen'}
            </button>
            <button type="button" onClick={handleReset} style={secondaryBtn}>
              Zurücksetzen
            </button>
          </div>
        </form>
      </div>

      {(result || error) && (
        <div className={styles.card}>
          <h2 className={styles.cardHeading}>Ergebnis</h2>
          {error ? (
            <div style={{ color: '#d9534f' }}>{error}</div>
          ) : (
            result && <ResultView result={result} classes={classes} cfg={cfg} />
          )}
        </div>
      )}
    </>
  );
}

function ResultView({ result, classes, cfg }: { result: PredictItem; classes: string[]; cfg: ModelConfig }) {
  const color = cfg.labelColors[result.predicted_label] ?? '#333';
  const order = classes.length ? classes : Object.keys(result.proba);
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: '1.6rem', fontWeight: 700, color }}>
          {result.predicted_label.charAt(0).toUpperCase() + result.predicted_label.slice(1)}
        </span>
        <span style={{ color: 'var(--muted)' }}>{Math.round(result.confidence * 100)}% Konfidenz</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {order.map((cls) => {
          const p = result.proba[cls] ?? 0;
          return (
            <div key={cls} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 90, fontSize: '0.85rem' }}>{cls}</span>
              <div style={{ flex: 1, background: 'var(--border)', borderRadius: 4, height: 14 }}>
                <div
                  style={{
                    width: `${p * 100}%`,
                    height: '100%',
                    borderRadius: 4,
                    background: cfg.labelColors[cls] ?? 'var(--primary)',
                  }}
                />
              </div>
              <span style={{ width: 48, textAlign: 'right', fontSize: '0.85rem' }}>{Math.round(p * 100)}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const fieldsetStyle: React.CSSProperties = {
  border: '1px solid var(--border)',
  borderRadius: 8,
  padding: '12px 16px',
  marginBottom: 14,
};
const legendStyle: React.CSSProperties = { fontSize: '0.85rem', fontWeight: 600, padding: '0 6px', color: 'var(--muted)' };
const gridStyle: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
  gap: 12,
};
const labelStyle: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 4 };
const fieldLabelStyle: React.CSSProperties = { fontSize: '0.8rem', color: 'var(--muted)' };
const inputStyle: React.CSSProperties = {
  padding: '6px 8px',
  border: '1px solid var(--border)',
  borderRadius: 6,
  fontSize: '0.9rem',
};
const hintStyle: React.CSSProperties = { fontSize: '0.78rem', color: 'var(--muted)', marginTop: 10 };
const primaryBtn: React.CSSProperties = {
  background: 'var(--primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  fontSize: '0.9rem',
  cursor: 'pointer',
};
const secondaryBtn: React.CSSProperties = {
  background: 'transparent',
  color: 'var(--text)',
  border: '1px solid var(--border)',
  borderRadius: 6,
  padding: '8px 16px',
  fontSize: '0.9rem',
  cursor: 'pointer',
};
