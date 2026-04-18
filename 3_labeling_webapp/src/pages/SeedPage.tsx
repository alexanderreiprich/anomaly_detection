import { useCallback } from 'react';
import { useMeasurements } from '../hooks/useMeasurements';
import { useLabeling } from '../hooks/useLabeling';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { Header } from '../components/layout/Header';
import { FlowChart } from '../components/chart/FlowChart';
import { PatientInfo } from '../components/sidebar/PatientInfo';
import { Biomarkers } from '../components/sidebar/Biomarkers';
import { IpssCard } from '../components/sidebar/IpssCard';
import { LabelButtons } from '../components/actions/LabelButtons';
import { Navigation } from '../components/shared/Navigation';
import { Toast } from '../components/shared/Toast';
import type { Label } from '../types/measurement';
import styles from './Page.module.css';

export function SeedPage() {
  const { measurements, setMeasurements, loading, error } = useMeasurements('seed');
  const { message, visible, showToast } = useToast();
  const { currentIdx, current, applyLabel, skip, goNext, goPrev, stats } = useLabeling({
    measurements,
    setMeasurements,
    mode: 'seed',
    onToast: showToast,
  });

  const handleLabel = useCallback((l: Label) => applyLabel(l), [applyLabel]);

  useKeyboardShortcuts({
    onLabel: handleLabel,
    onSkip: skip,
    onNext: goNext,
    onPrev: goPrev,
  });

  if (loading) return <div className="loading-screen">Messungen werden geladen...</div>;
  if (error) return <div className="empty-state">Fehler: {error}</div>;
  if (!current) return <div className="empty-state">Keine Messungen zum Labeln vorhanden.</div>;

  return (
    <>
      <Header mode="seed" stats={stats} />
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.card}>
            <h2 className={styles.cardHeading}>Uroflow-Kurve</h2>
            <FlowChart curve={current.urine_flow} label={current.label} />
            <LabelButtons onLabel={handleLabel} onSkip={skip} currentLabel={current.label} />
            <Navigation
              currentIdx={currentIdx}
              total={measurements.length}
              onPrev={goPrev}
              onNext={goNext}
              mode="seed"
            />
          </div>
          <div className={styles.detailsRow}>
            <PatientInfo measurement={current} mode="seed" />
            <Biomarkers measurement={current} />
            <IpssCard patientId={current.patient_id} />
          </div>
        </div>
      </div>
      <Toast message={message} visible={visible} />
    </>
  );
}
