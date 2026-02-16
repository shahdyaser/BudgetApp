import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let cachedClient: SupabaseClient | null = null;

/**
 * Lazily create the Supabase client.
 *
 * Important: we validate env vars at call-time (not import-time) so builds
 * don't crash during Next.js "collect page data" if env vars aren't present.
 */
export function getSupabaseClient(): SupabaseClient {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  cachedClient ??= createClient(supabaseUrl, supabaseAnonKey);
  return cachedClient;
}
