import { useState, useCallback, useMemo } from 'react';
import { supabase } from '../config/supabase';
import type { Measurement, Label, LabelingStats } from '../types/measurement';

interface UseLabelingArgs {
  measurements: Measurement[];
  setMeasurements: React.Dispatch<React.SetStateAction<Measurement[]>>;
  mode: 'seed' | 'review';
  onToast?: (msg: string) => void;
}

export function useLabeling({ measurements, setMeasurements, mode, onToast }: UseLabelingArgs) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const current = measurements[currentIdx] ?? null;

  const applyLabel = useCallback(
    async (label: Label, accepted?: boolean) => {
      if (!current) return;
      const labelSource = accepted ? 'human' : 'human';
      // optimistic update
      setMeasurements((prev) =>
        prev.map((m) => (m.measurement_id === current.measurement_id ? { ...m, label, label_source: labelSource } : m)),
      );

      const toastText =
        mode === 'review'
          ? `${current.measurement_id} → ${label} (${accepted ? 'accepted' : 'corrected'})`
          : `${current.measurement_id} → ${label}`;
      onToast?.(toastText);

      // persist
      const { error: updateError } = await supabase
        .from('measurements')
        .update({
          label,
          label_source: 'human',
          reviewed_at: new Date().toISOString(),
        })
        .eq('measurement_id', current.measurement_id);
      if (updateError) console.error('Label update failed:', updateError);

      // auto-advance
      setTimeout(() => {
        setCurrentIdx((i) => Math.min(i + 1, measurements.length - 1));
      }, 400);
    },
    [current, measurements.length, setMeasurements, mode, onToast],
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
