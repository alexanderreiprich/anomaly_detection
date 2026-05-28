import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import type { ModelType } from '../types/measurement';
import { MODELS } from '../config/models';

export interface ModelOverview {
  total: number;
  labeled: number;
  unlabeled: number;
  pendingReview: number;
  loading: boolean;
}

const EMPTY: ModelOverview = { total: 0, labeled: 0, unlabeled: 0, pendingReview: 0, loading: true };

// Model-wide counts (across the whole table, not just the loaded queue) so the
// user has an overview of labeling progress.
export function useModelStats(modelType: ModelType) {
  const [overview, setOverview] = useState<ModelOverview>(EMPTY);

  const refresh = useCallback(async () => {
    const table = MODELS[modelType].table;
    try {
      const head = { count: 'exact' as const, head: true };
      const [totalRes, labeledRes, pendingRes] = await Promise.all([
        supabase.from(table).select('*', head),
        supabase.from(table).select('*', head).not('label', 'is', null),
        supabase.from(table).select('*', head).is('label', null).not('predicted_label', 'is', null),
      ]);
      const total = totalRes.count ?? 0;
      const labeled = labeledRes.count ?? 0;
      setOverview({
        total,
        labeled,
        unlabeled: total - labeled,
        pendingReview: pendingRes.count ?? 0,
        loading: false,
      });
    } catch {
      setOverview((o) => ({ ...o, loading: false }));
    }
  }, [modelType]);

  useEffect(() => {
    setOverview(EMPTY);
    refresh();
  }, [refresh]);

  return { overview, refresh };
}
