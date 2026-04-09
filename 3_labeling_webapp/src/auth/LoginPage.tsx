import { useState, type FormEvent } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import styles from '../styles/LoginPage.module.css';

export function LoginPage() {
  const { username, signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  if (username) return <Navigate to="/seed" replace />;

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Anmeldung fehlgeschlagen');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <h1 className={styles.title}>Uroflow Labeling</h1>
        <p className={styles.subtitle}>Anmelden, um fortzufahren</p>
        {error && <div className={styles.error}>{error}</div>}
        <input
          className={styles.input}
          type="email"
          placeholder="E-Mail"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoFocus
        />
        <input
          className={styles.input}
          type="password"
          placeholder="Passwort"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <button className={styles.button} type="submit" disabled={submitting}>
          {submitting ? 'Wird angemeldet...' : 'Anmelden'}
        </button>
      </form>
    </div>
  );
}
