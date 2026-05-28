import { useEffect, useState } from 'react';
import { supabase } from '../config/supabase';
import type { IpssSubmission } from '../types/ipss';

const IPSS_QUERY = `
  submission_id,
  patient_id,
  score,
  submitted_at,
  ipss_responses(
    response_id,
    question_id,
    answer_option_id,
    answer_value,
    ipss_questions(question_id, question_number, question_text),
    ipss_answer_options(answer_option_id, option_text, points)
  )
`;

export function useIpssSubmissions(patientId: string | null | undefined) {
  const [submissions, setSubmissions] = useState<IpssSubmission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setSubmissions([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    supabase
      .from('ipss_submissions')
      .select(IPSS_QUERY)
      .eq('patient_id', patientId)
      .order('submitted_at', { ascending: false })
      .then(({ data, error: err }) => {
        if (cancelled) return;
        if (err) {
          setError(err.message);
          setSubmissions([]);
        } else {
          setSubmissions((data ?? []) as unknown as IpssSubmission[]);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [patientId]);

  return { submissions, loading, error };
}
