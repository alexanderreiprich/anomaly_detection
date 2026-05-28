import { createClient } from '@supabase/supabase-js';
import { getIdToken } from './cognito';

const getHeaders = async () => {
  try {
    const token = await getIdToken();
    return { Authorization: `Bearer ${token}` };
  } catch {
    return {};
  }
};

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    global: {
      // Surpresses type errors
      headers: getHeaders as unknown as Record<string, string>,
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);
