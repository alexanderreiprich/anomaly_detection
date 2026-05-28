import styles from './UncertaintyBanner.module.css';

interface Props {
  maxConf: number;
}

export function UncertaintyBanner({ maxConf }: Props) {
  const pct = Math.round(maxConf * 100);
  let level: 'high' | 'medium' | 'low';
  let text: string;

  if (pct < 45) {
    level = 'high';
    text = `Hohe Unsicherheit – Modell-Konfidenz: ${pct}% – Bitte sorgfältig prüfen`;
  } else if (pct < 65) {
    level = 'medium';
    text = `Mittlere Unsicherheit – Modell-Konfidenz: ${pct}%`;
  } else {
    level = 'low';
    text = `Niedrige Unsicherheit – Modell-Konfidenz: ${pct}%`;
  }

  return <div className={`${styles.banner} ${styles[level]}`}><strong>{text}</strong></div>;
}
