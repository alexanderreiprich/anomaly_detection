import { Link } from 'react-router-dom';
import type { ModelType } from '../../types/measurement';
import { MODELS, MODEL_TYPES } from '../../config/models';

interface Props {
  modelType: ModelType;
  mode: 'seed' | 'review' | 'predict' | 'analysis';
}

const linkBase: React.CSSProperties = {
  padding: '4px 12px',
  borderRadius: 6,
  textDecoration: 'none',
  fontSize: '0.85rem',
  color: 'var(--text)',
};

function tab(active: boolean): React.CSSProperties {
  return active
    ? { ...linkBase, background: 'var(--text)', color: '#fff', fontWeight: 600 }
    : { ...linkBase, background: 'rgba(0,0,0,0.05)' };
}

const group: React.CSSProperties = { display: 'flex', alignItems: 'center', gap: 6 };

// Switches between models (keeps the current phase).
export function ModelTabs({ modelType, mode }: Props) {
  return (
    <nav style={group}>
      {MODEL_TYPES.map((mt) => (
        <Link key={mt} to={`/${mt}/${mode}`} style={tab(mt === modelType)}>
          {MODELS[mt].title}
        </Link>
      ))}
    </nav>
  );
}

// Switches between seed, review and the prediction test bench for the model.
export function PhaseTabs({ modelType, mode }: Props) {
  return (
    <nav style={group}>
      <Link to={`/${modelType}/seed`} style={tab(mode === 'seed')}>
        Seed
      </Link>
      <Link to={`/${modelType}/review`} style={tab(mode === 'review')}>
        Review
      </Link>
      <Link to={`/${modelType}/predict`} style={tab(mode === 'predict')}>
        Test
      </Link>
      <Link to={`/${modelType}/analysis`} style={tab(mode === 'analysis')}>
        Analyse
      </Link>
    </nav>
  );
}
