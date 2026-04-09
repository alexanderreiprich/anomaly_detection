import type { LabelingStats } from '../../types/measurement';
import styles from './Header.module.css';
import { useAuth } from '../../auth/AuthContext';

interface Props {
  mode: 'seed' | 'review';
  stats: LabelingStats;
}

export function Header({ mode, stats }: Props) {
  const { username, signOut } = useAuth();

  return (
    <>
      <header className={styles.header}>
        <div className={styles.left}>
          <h1 className={styles.title}>Uroflow Labeling</h1>
          <span className={`${styles.badge} ${mode === 'seed' ? styles.badgeSeed : styles.badgeReview}`}>
            {mode === 'seed' ? 'Seed-Phase' : 'Human-in-the-Loop'}
          </span>
        </div>
        <div className={styles.stats}>
          {mode === 'seed' ? (
            <>
              Gesamt: <span>{stats.total}</span>
              &nbsp;&nbsp;Gelabelt: <span>{stats.labeled}</span>
              &nbsp;&nbsp;Offen: <span>{stats.remaining}</span>
            </>
          ) : (
            <>
              Reviewed: <span>{stats.labeled}</span>
              &nbsp;&nbsp;Accepted: <span>{stats.accepted ?? 0}</span>
              &nbsp;&nbsp;Overridden: <span>{stats.overridden ?? 0}</span>
              &nbsp;&nbsp;Offen: <span>{stats.remaining}</span>
            </>
          )}
          <span className={styles.user}>
            {username}
            <button className={styles.logoutBtn} onClick={signOut}>Logout</button>
          </span>
        </div>
      </header>
      <div className={styles.progressWrap}>
        <div
          className={styles.progressBar}
          style={{ width: stats.total ? `${(stats.labeled / stats.total) * 100}%` : '0%' }}
        />
      </div>
    </>
  );
}
