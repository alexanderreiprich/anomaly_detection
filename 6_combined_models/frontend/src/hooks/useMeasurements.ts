import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../config/supabase';
import type { LabelItem, ModelType } from '../types/measurement';
import { MODELS } from '../config/models';

type BiomarkerRow = LabelItem & { measurements?: { created_date?: string } };

const SEED_SIZE = 50;
const SEED_POOL = 1000; // candidate pool to sample from (PostgREST max rows)

function shuffle<T>(arr: T[]): T[] {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export function useMeasurements(modelType: ModelType, mode: 'seed' | 'review') {
  const [measurements, setMeasurements] = useState<LabelItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Increments on every fresh load (mount / refetch), but NOT on the in-place
  // optimistic updates from labeling — so consumers can reset the cursor to the
  // start of a newly loaded queue without jumping back on every label.
  const [reloadCount, setReloadCount] = useState(0);

  const fetch = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const cfg = MODELS[modelType];
      let rows: unknown[];

      if (mode === 'seed') {
        // Random seed sample (not the first 50 in chronological order).
        // PostgREST has no ORDER BY random(), so fetch unlabeled ids cheaply,
        // shuffle client-side, then load the chosen rows.
        const { data: idRows, error: idErr } = await supabase
          .from(cfg.table)
          .select('measurement_id')
          .is('label', null)
          .is('predicted_label', null)
          .limit(SEED_POOL);
        if (idErr) throw idErr;

        const idList = (idRows ?? []) as unknown as Array<{ measurement_id: string }>;
        const ids = shuffle(idList.map((r) => r.measurement_id));
        const pick = ids.slice(0, SEED_SIZE);
        if (pick.length === 0) {
          setMeasurements([]);
          setReloadCount((c) => c + 1);
          return;
        }

        const { data, error: err } = await supabase
          .from(cfg.table)
          .select(cfg.select)
          .in('measurement_id', pick);
        if (err) throw err;

        // PostgREST returns the rows in PK order, so re-apply the random order.
        const orderOf = new Map(pick.map((id, i) => [id, i]));
        rows = ((data ?? []) as unknown as LabelItem[])
          .slice()
          .sort((a, b) => (orderOf.get(a.measurement_id) ?? 0) - (orderOf.get(b.measurement_id) ?? 0));
      } else {
        const { data, error: err } = await supabase
          .from(cfg.table)
          .select(cfg.select)
          .is('label', null)
          .not('predicted_label', 'is', null)
          .order('confidence', { ascending: true })
          .limit(50);
        if (err) throw err;
        rows = data ?? [];
      }

      let items = rows as unknown as LabelItem[];
      // The biomarker queue reads from the `biomarkers` table; created_date
      // lives on the joined measurement, so lift it to the top level.
      if (modelType === 'biomarker') {
        items = (items as BiomarkerRow[]).map((r) => ({
          ...r,
          created_date: r.created_date ?? r.measurements?.created_date ?? '',
        })) as LabelItem[];
      }
      setMeasurements(items);
      setReloadCount((c) => c + 1);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Fehler beim Laden');
    } finally {
      setLoading(false);
    }
  }, [modelType, mode]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { measurements, setMeasurements, loading, error, refetch: fetch, reloadCount };
}
