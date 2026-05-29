import type { ReactNode } from 'react';
import type { LabelingStats, ModelType } from '../../types/measurement';
import type { ModelOverview } from '../../hooks/useModelStats';
import { ModelTabs, PhaseTabs } from '../shared/ModelNav';
import styles from './Header.module.css';
import { useAuth } from '../../auth/AuthContext';

interface Props {
  mode: 'seed' | 'review' | 'predict' | 'analysis';
  modelType: ModelType;
  stats?: LabelingStats;
  title?: string;
  controls?: ReactNode;
  overview?: ModelOverview;
}

export function Header({ mode, modelType, stats, title = 'Labeling', controls, overview }: Props) {
  const { username, signOut } = useAuth();

  // The progress bar reflects model-wide labeling progress when available.
  const progress =
    overview && overview.total
      ? overview.labeled / overview.total
      : stats && stats.total
        ? stats.labeled / stats.total
        : 0;
  const overviewPct = overview && overview.total ? Math.round((overview.labeled / overview.total) * 100) : 0;

  return (
    <>
      <header className={styles.header}>
        <div className={styles.topRow}>
          <div className={styles.brand}>
            <h1 className={styles.title}>{title}</h1>
            <ModelTabs modelType={modelType} mode={mode} />
          </div>
          <span className={styles.user}>
            {username}
            <button className={styles.logoutBtn} onClick={signOut}>Logout</button>
          </span>
        </div>

        <div className={styles.toolbar}>
          <div className={styles.group}>
            <PhaseTabs modelType={modelType} mode={mode} />
            {stats && mode !== 'predict' && (
              <span className={styles.sessionStats}>
                {mode === 'seed' ? (
                  <>
                    Queue: <span>{stats.labeled}</span>/<span>{stats.total}</span>
                  </>
                ) : (
                  <>
                    Queue: <span>{stats.labeled}</span>/<span>{stats.total}</span>
                    &nbsp;·&nbsp;✓<span>{stats.accepted ?? 0}</span>
                    &nbsp;·&nbsp;✎<span>{stats.overridden ?? 0}</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className={styles.group}>
            {overview && !overview.loading && (
              <span className={styles.overview} title="Gesamtfortschritt über alle Messungen dieses Modells">
                Gesamt: <span>{overview.labeled}</span>/<span>{overview.total}</span> ({overviewPct}%)
                &nbsp;·&nbsp;{overview.unlabeled} offen
                &nbsp;·&nbsp;{overview.pendingReview} Review
              </span>
            )}
            {controls}
          </div>
        </div>
      </header>
      <div className={styles.progressWrap}>
        <div className={styles.progressBar} style={{ width: `${progress * 100}%` }} />
      </div>
    </>
  );
}
