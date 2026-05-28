import { useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useMeasurements } from '../hooks/useMeasurements';
import { useLabeling } from '../hooks/useLabeling';
import { useModelStats } from '../hooks/useModelStats';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useToast } from '../hooks/useToast';
import { useBackend } from '../hooks/useBackend';
import { Header } from '../components/layout/Header';
import { BackendControls } from '../components/layout/BackendControls';
import { FlowChart } from '../components/chart/FlowChart';
import { BiomarkerPanel } from '../components/biomarker/BiomarkerPanel';
import { UncertaintyBanner } from '../components/chart/UncertaintyBanner';
import { PatientInfo } from '../components/sidebar/PatientInfo';
import { Biomarkers } from '../components/sidebar/Biomarkers';
import { IpssCard } from '../components/sidebar/IpssCard';
import { PredictionCard } from '../components/sidebar/PredictionCard';
import { ReviewActions } from '../components/actions/ReviewActions';
import { Navigation } from '../components/shared/Navigation';
import { UtilityBar } from '../components/shared/UtilityBar';
import { Toast } from '../components/shared/Toast';
import { getModelConfig } from '../config/models';
import type { Label, Measurement } from '../types/measurement';
import styles from './Page.module.css';

export function ReviewPage() {
  const { model } = useParams();
  const cfg = getModelConfig(model);
  const { measurements, setMeasurements, loading, error, refetch, reloadCount } = useMeasurements(cfg.type, 'review');
  const { overview, refresh: refreshStats } = useModelStats(cfg.type);
  const { message, visible, showToast } = useToast();
  const { currentIdx, current, applyLabel, goNext, goPrev, stats } = useLabeling({
    measurements,
    setMeasurements,
    mode: 'review',
    modelType: cfg.type,
    onToast: showToast,
    onAfterLabel: refreshStats,
    resetKey: reloadCount,
  });
  const backend = useBackend({
    modelType: cfg.type,
    onToast: showToast,
    onAfterQuery: () => {
      refetch();
      refreshStats();
    },
    onAfterRetrain: () => {
      refetch();
      refreshStats();
    },
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
    keyMap: cfg.keyMap,
    onAccept: handleAccept,
    onNext: goNext,
    onPrev: goPrev,
  });

  return (
    <>
      <Header
        mode="review"
        modelType={cfg.type}
        stats={stats}
        overview={overview}
        title={`${cfg.title} Labeling`}
        controls={
          <BackendControls
            health={backend.health}
            healthError={backend.healthError}
            retraining={backend.retraining}
            querying={backend.querying}
            autoLabeling={backend.autoLabeling}
            onRetrain={backend.retrain}
            onRefreshQueue={() => backend.refreshQueue()}
            onAutoLabel={backend.autoLabel}
          />
        }
      />
      <div className={styles.container}>
        <div className={styles.main}>
          {loading ? (
            <div className="loading-screen">Messungen werden geladen...</div>
          ) : error ? (
            <div className="empty-state">Fehler: {error}</div>
          ) : !current ? (
            <div className="empty-state">
              Keine Messungen zum Reviewen vorhanden. Trainiere das Modell und fülle die Review-Queue über die Buttons oben.
            </div>
          ) : (
            <>
              <div className={styles.card}>
                <UncertaintyBanner maxConf={predConf} />
                <h2 className={styles.cardHeading}>{cfg.detailHeading}</h2>
                {cfg.type === 'uroflow' ? (
                  <FlowChart curve={(current as Measurement).urine_flow} label={current.label} />
                ) : (
                  <BiomarkerPanel measurementId={current.measurement_id} />
                )}
                <ReviewActions
                  labels={cfg.labels}
                  labelColors={cfg.labelColors}
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
                  labels={cfg.labels}
                />
              </div>
              <div className={styles.detailsRow}>
                <PatientInfo measurement={current} mode="review" />
                {cfg.type === 'uroflow' && <Biomarkers measurement={current as Measurement} />}
                <PredictionCard label={predLabel} confidence={predConf} />
                {cfg.type === 'uroflow' && <IpssCard patientId={current.patient_id} />}
              </div>
            </>
          )}
        </div>
      </div>
      <UtilityBar
        modelTitle={cfg.title}
        plateauing={backend.plateauing}
        resetting={backend.resetting}
        onPlateau={backend.plateau}
        onReset={backend.reset}
      />
      <Toast message={message} visible={visible} />
    </>
  );
}
