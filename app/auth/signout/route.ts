import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeNextPath } from '@/lib/auth'

/**
 * Destroys the Supabase session and redirects. Used by the sign-out
 * control and by the middleware when a session exists for a
 * non-Berkeley email (the middleware redirects here because only a
 * route handler can set the cleared session cookies on the response).
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const next = getSafeNextPath(searchParams.get('next') ?? '/login')

  const supabase = await createClient()
  await supabase.auth.signOut()

  return NextResponse.redirect(`${origin}${next}`)
}
