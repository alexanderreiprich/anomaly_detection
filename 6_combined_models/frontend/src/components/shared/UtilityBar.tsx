interface Props {
  modelTitle: string;
  plateauing: boolean;
  resetting: boolean;
  onPlateau: () => void;
  onReset: () => void;
}

const btnBase: React.CSSProperties = {
  background: 'transparent',
  borderRadius: 6,
  padding: '4px 10px',
  fontSize: '0.76rem',
  cursor: 'pointer',
};

// Occasional, lower-frequency actions kept out of the (already busy) top bar.
export function UtilityBar({ modelTitle, plateauing, resetting, onPlateau, onReset }: Props) {
  const handlePlateau = () => {
    const ok = window.confirm(
      `Plateau-Lauf für das ${modelTitle}-Modell starten?\n\n` +
        'Alle übrigen ungelabelten Messungen werden anhand der Modellvorhersage gelabelt — ' +
        'weniger sichere Fälle (< 65 %) als „model_low_conf" markiert. Klinische Regel-Fälle ' +
        'bleiben im Review. So lässt sich ein Konfidenz-Plateau auflösen.',
    );
    if (ok) onPlateau();
  };

  const handleReset = () => {
    const ok = window.confirm(
      `Wirklich ALLE Labels und Vorhersagen des ${modelTitle}-Modells löschen?\n\n` +
        'Damit fängst du komplett bei null an. Das kann nicht rückgängig gemacht werden.',
    );
    if (ok) onReset();
  };

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 24px 24px',
        gap: 12,
      }}
    >
      <button
        onClick={handlePlateau}
        disabled={plateauing}
        title="Übrige Messungen am Konfidenz-Plateau auflösen: Rest anhand der Modellvorhersage labeln"
        style={{
          ...btnBase,
          border: '1px solid var(--primary)',
          color: 'var(--primary)',
          opacity: plateauing ? 0.5 : 0.85,
          cursor: plateauing ? 'default' : 'pointer',
        }}
      >
        {plateauing ? 'Labele Rest…' : 'Plateau-Lauf: Rest labeln'}
      </button>

      <button
        onClick={handleReset}
        disabled={resetting}
        title={`Alle Labels des ${modelTitle}-Modells löschen und von vorne beginnen`}
        style={{
          ...btnBase,
          border: '1px solid #d9534f',
          color: '#d9534f',
          opacity: resetting ? 0.5 : 0.75,
          cursor: resetting ? 'default' : 'pointer',
        }}
      >
        {resetting ? 'Setze zurück…' : `Alle Labels zurücksetzen (${modelTitle})`}
      </button>
    </div>
  );
}
