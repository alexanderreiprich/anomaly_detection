import { useCallback } from 'react';
import { useMeasurements } from '../hooks/useMeasurements';
import { useLabeling } from '../hooks/useLabeling';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { Header } from '../components/layout/Header';
import { FlowChart } from '../components/chart/FlowChart';
import { UncertaintyBanner } from '../components/chart/UncertaintyBanner';
import { PatientInfo } from '../components/sidebar/PatientInfo';
import { Biomarkers } from '../components/sidebar/Biomarkers';
import { IpssCard } from '../components/sidebar/IpssCard';
import { PredictionCard } from '../components/sidebar/PredictionCard';
import { ReviewActions } from '../components/actions/ReviewActions';
import { Navigation } from '../components/shared/Navigation';
import { Toast } from '../components/shared/Toast';
import type { Label } from '../types/measurement';
import styles from './Page.module.css';

export function ReviewPage() {
  const { measurements, setMeasurements, loading, error } = useMeasurements('review');
  const { message, visible, showToast } = useToast();
  const { currentIdx, current, applyLabel, goNext, goPrev, stats } = useLabeling({
    measurements,
    setMeasurements,
    mode: 'review',
    onToast: showToast,
  });

  const predLabel = current?.predicted_label ?? 'normal';
  const predConf = current?.confidence ?? 0;

  const handleAccept = useCallback(() => {
    applyLabel(predLabel, true);
  }, [applyLabel, predLabel]);

  const handleOverride = useCallback(
    (label: Label) => {
      applyLabel(label, false);
    },
    [applyLabel],
  );

  const handleLabel = useCallback(
    (label: Label) => {
      if (label === predLabel) {
        handleAccept();
      } else {
        handleOverride(label);
      }
    },
    [predLabel, handleAccept, handleOverride],
  );

  useKeyboardShortcuts({
    onLabel: handleLabel,
    onAccept: handleAccept,
    onNext: goNext,
    onPrev: goPrev,
  });

  if (loading) return <div className="loading-screen">Messungen werden geladen...</div>;
  if (error) return <div className="empty-state">Fehler: {error}</div>;
  if (!current) return <div className="empty-state">Keine Messungen zum Reviewen vorhanden.</div>;

  return (
    <>
      <Header mode="review" stats={stats} />
      <div className={styles.container}>
        <div className={styles.main}>
          <div className={styles.card}>
            <UncertaintyBanner maxConf={predConf} />
            <h2 className={styles.cardHeading}>Uroflow-Kurve</h2>
            <FlowChart curve={current.urine_flow} label={current.label} />
            <ReviewActions
              predictionLabel={predLabel}
              onAccept={handleAccept}
              onOverride={handleOverride}
            />
            <Navigation
              currentIdx={currentIdx}
              total={measurements.length}
              onPrev={goPrev}
              onNext={goNext}
              mode="review"
            />
          </div>
          <div className={styles.detailsRow}>
            <PatientInfo measurement={current} mode="review" />
            <Biomarkers measurement={current} />
            <PredictionCard label={predLabel} confidence={predConf} />
            <IpssCard patientId={current.patient_id} />
          </div>
        </div>
      </div>
      <Toast message={message} visible={visible} />
    </>
  );
}
