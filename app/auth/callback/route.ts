import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeNextPath, isBerkeleyEmail } from '@/lib/auth'

/**
 * OAuth callback. Supabase redirects here after Google sign-in with a
 * `code`, which the server exchanges for a session. The email in the
 * resulting session is Google-verified, so this is where the Berkeley
 * domain is enforced server-side: a non-Berkeley account gets its
 * session destroyed immediately and is sent back to /login.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeNextPath(searchParams.get('next'))

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (user && !isBerkeleyEmail(user.email)) {
        await supabase.auth.signOut()
        return NextResponse.redirect(`${origin}/login?error=domain`)
      }

      return NextResponse.redirect(`${origin}${next}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
