import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Supabase client for server code (Server Components, Route Handlers).
 * Reads the session from the request cookies and writes refreshed
 * session cookies back. The user object it returns carries the email
 * Google verified, which lib/auth.ts checks against @berkeley.edu.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // setAll was called from a Server Component, where setting
            // cookies is not allowed. Middleware refreshes sessions,
            // so this can be safely ignored there.
          }
        },
      },
    }
  )
}
