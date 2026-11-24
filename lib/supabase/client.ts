import { createBrowserClient } from '@supabase/ssr'

/**
 * Supabase client for browser (client component) code.
 * Uses the public anon key, which is safe to expose: row-level access is
 * enforced by Supabase Auth + the server-side @berkeley.edu check, never
 * by keeping this key secret. Never use the service_role key here.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
