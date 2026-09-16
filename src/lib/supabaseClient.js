import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

const isConfigured = Boolean(supabaseUrl && supabaseAnonKey);

if (!isConfigured) {
  console.warn('Supabase environment variables are not configured. Running in preview mode; backend features are unavailable until Supabase is configured.');
}

// Keep the client constructible for static previews before Supabase is configured.
// Never use the fallback values for production; configure the real environment variables.
export const supabase = createClient(
  supabaseUrl || 'https://preview-placeholder.supabase.co',
  supabaseAnonKey || 'preview-placeholder-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  },
);

export const supabaseConfigured = isConfigured;
