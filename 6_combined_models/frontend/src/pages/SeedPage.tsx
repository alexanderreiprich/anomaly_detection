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
import { PatientInfo } from '../components/sidebar/PatientInfo';
import { Biomarkers } from '../components/sidebar/Biomarkers';
import { IpssCard } from '../components/sidebar/IpssCard';
import { LabelButtons } from '../components/actions/LabelButtons';
import { Navigation } from '../components/shared/Navigation';
import { UtilityBar } from '../components/shared/UtilityBar';
import { Toast } from '../components/shared/Toast';
import { getModelConfig } from '../config/models';
import type { Label, Measurement } from '../types/measurement';
import styles from './Page.module.css';

export function SeedPage() {
  const { model } = useParams();
  const cfg = getModelConfig(model);
  const { measurements, setMeasurements, loading, error, refetch, reloadCount } = useMeasurements(cfg.type, 'seed');
  const { overview, refresh: refreshStats } = useModelStats(cfg.type);
  const { message, visible, showToast } = useToast();
  const { currentIdx, current, applyLabel, skip, goNext, goPrev, stats } = useLabeling({
    measurements,
    setMeasurements,
    mode: 'seed',
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
  });

  const handleLabel = useCallback((l: Label) => applyLabel(l), [applyLabel]);

  useKeyboardShortcuts({
    onLabel: handleLabel,
    keyMap: cfg.keyMap,
    onSkip: skip,
    onNext: goNext,
    onPrev: goPrev,
  });

  return (
    <>
      <Header
        mode="seed"
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
            <div className="empty-state">Keine Messungen zum Labeln vorhanden.</div>
          ) : (
            <>
              <div className={styles.card}>
                <h2 className={styles.cardHeading}>{cfg.detailHeading}</h2>
                {cfg.type === 'uroflow' ? (
                  <FlowChart curve={(current as Measurement).urine_flow} label={current.label} />
                ) : (
                  <BiomarkerPanel measurementId={current.measurement_id} />
                )}
                <LabelButtons
                  labels={cfg.labels}
                  labelColors={cfg.labelColors}
                  onLabel={handleLabel}
                  onSkip={skip}
                  currentLabel={current.label}
                />
                <Navigation
                  currentIdx={currentIdx}
                  total={measurements.length}
                  onPrev={goPrev}
                  onNext={goNext}
                  mode="seed"
                  labels={cfg.labels}
                />
              </div>
              <div className={styles.detailsRow}>
                <PatientInfo measurement={current} mode="seed" />
                {cfg.type === 'uroflow' && (
                  <>
                    <Biomarkers measurement={current as Measurement} />
                    <IpssCard patientId={current.patient_id} />
                  </>
                )}
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
