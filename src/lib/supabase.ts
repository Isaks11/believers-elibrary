import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

/**
 * Supabase client (Phase 1 backend).
 *
 * Stays `null` until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set in
 * `.env` (see `.env.example`). While it is null the app keeps working with
 * device-local storage — callers must handle the null case gracefully.
 *
 * Security note: frontend guards are UX only. Real enforcement lives in
 * Postgres Row Level Security (see `supabase/schema.sql`).
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(supabaseUrl as string, supabaseAnonKey as string)
  : null;
