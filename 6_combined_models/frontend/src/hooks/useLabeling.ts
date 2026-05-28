import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import type { LabelItem, Label, LabelingStats, ModelType } from '../types/measurement';
import { MODELS } from '../config/models';

interface UseLabelingArgs {
  measurements: LabelItem[];
  setMeasurements: React.Dispatch<React.SetStateAction<LabelItem[]>>;
  mode: 'seed' | 'review';
  modelType: ModelType;
  onToast?: (msg: string) => void;
  onAfterLabel?: () => void;
  /** Changes whenever a fresh queue is loaded; resets the cursor to the start. */
  resetKey?: number;
}

export function useLabeling({ measurements, setMeasurements, mode, modelType, onToast, onAfterLabel, resetKey }: UseLabelingArgs) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const current = measurements[currentIdx] ?? null;

  // Jump back to the first item when a new queue is loaded (retrain / refresh /
  // navigation), so you don't stay stranded at the end of the previous queue.
  useEffect(() => {
    setCurrentIdx(0);
  }, [resetKey]);

  const applyLabel = useCallback(
    async (label: Label, accepted?: boolean) => {
      if (!current) return;
      // optimistic update
      setMeasurements((prev) =>
        prev.map((m) => (m.measurement_id === current.measurement_id ? { ...m, label, label_source: 'human' } : m)),
      );

      const toastText =
        mode === 'review'
          ? `${current.measurement_id} → ${label} (${accepted ? 'accepted' : 'corrected'})`
          : `${current.measurement_id} → ${label}`;
      onToast?.(toastText);

      // persist to the table that owns this model's labels
      const { error: updateError } = await supabase
        .from(MODELS[modelType].table)
        .update({
          label,
          label_source: 'human',
          reviewed_at: new Date().toISOString(),
        })
        .eq('measurement_id', current.measurement_id);
      if (updateError) console.error('Label update failed:', updateError);
      else onAfterLabel?.();

      // auto-advance
      setTimeout(() => {
        setCurrentIdx((i) => Math.min(i + 1, measurements.length - 1));
      }, 400);
    },
    [current, measurements.length, setMeasurements, mode, modelType, onToast, onAfterLabel],
  );

  const skip = useCallback(() => {
    if (!current) return;
    onToast?.(`${current.measurement_id} übersprungen`);
    setCurrentIdx((i) => Math.min(i + 1, measurements.length - 1));
  }, [current, measurements.length, onToast]);

  const goNext = useCallback(() => {
    setCurrentIdx((i) => Math.min(i + 1, measurements.length - 1));
  }, [measurements.length]);

  const goPrev = useCallback(() => {
    setCurrentIdx((i) => Math.max(i - 1, 0));
  }, []);

  const stats: LabelingStats = useMemo(() => {
    const labeled = measurements.filter((m) => m.label).length;
    const accepted = measurements.filter(
      (m) => m.label && m.predicted_label && m.label === m.predicted_label,
    ).length;
    const overridden = measurements.filter(
      (m) => m.label && m.predicted_label && m.label !== m.predicted_label,
    ).length;
    return {
      total: measurements.length,
      labeled,
      remaining: measurements.length - labeled,
      accepted,
      overridden,
    };
  }, [measurements]);

  return { currentIdx, current, applyLabel, skip, goNext, goPrev, stats };
}
