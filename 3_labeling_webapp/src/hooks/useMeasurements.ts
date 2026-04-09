import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import type { Measurement } from '../types/measurement';

const MEASUREMENT_QUERY = `
  *,
  patients!inner(patient_id, age_range, height_range, weight_range),
  urine_flow(urine_flow_id, measurement_id, uro_flow, time),
  biomarkers(measurement_id, patient_id, leukocytes, nitrite, protein, blood, glucose, ascorbic_acid, bilirubin, ketone, urobilinogen, ph)
`;

export function useMeasurements(mode: 'seed' | 'review') {
  const [measurements, setMeasurements] = useState<Measurement[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase.from('measurements').select(MEASUREMENT_QUERY).is('label', null);

      if (mode === 'seed') {
        query = query.is('predicted_label', null).limit(50);
      } else {
        query = query.not('predicted_label', 'is', null).order('confidence', { ascending: true }).limit(50);
      }

      const { data, error: err } = await query;
      if (err) throw err;
      setMeasurements((data ?? []) as Measurement[]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { measurements, setMeasurements, loading, error, refetch: fetch };
}
