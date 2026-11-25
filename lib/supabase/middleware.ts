import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { User } from '@supabase/supabase-js'
import { isBerkeleyEmail } from '@/lib/auth'

export type SessionResult = {
  response: NextResponse
  /** The signed-in user, or null. Email is Google-verified. */
  user: User | null
}

/**
 * Refreshes the Supabase session on every page request (standard
 * @supabase/ssr pattern) and enforces the Berkeley domain server-side.
 * Returns the user so the middleware can gate on a validated session
 * rather than on cookie presence: a stale or forged cookie is not a
 * session, only a token Supabase validates counts.
 *
 * If a session exists but the verified email is not @berkeley.edu, the
 * user is sent to /auth/signout, which destroys the session and then
 * redirects to /login?error=domain. The sign-out happens in the route
 * handler, not here, because only there can the cleared session
 * cookies be set reliably on the redirect response.
 */
export async function updateSession(
  request: NextRequest
): Promise<SessionResult> {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user && !isBerkeleyEmail(user.email)) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/signout'
    url.searchParams.set('next', '/login?error=domain')
    return { response: NextResponse.redirect(url), user: null }
  }

  return { response: supabaseResponse, user }
}
