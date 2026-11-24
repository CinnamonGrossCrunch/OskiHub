/**
 * Berkeley domain lock for OskiHub auth.
 *
 * Only @berkeley.edu accounts may use the site. This is enforced
 * server-side (middleware + the /auth/callback route handler), reading
 * the email from the Supabase session token Google verified. A
 * client-side check alone would not be enforcement: anyone can edit or
 * skip JavaScript in their own browser.
 *
 * Layers, in order:
 * 1. `hd: 'berkeley.edu'` in the Google OAuth request: Google only
 *    offers berkeley.edu accounts at the chooser.
 * 2. `prompt: 'select_account'`: the chooser is shown every time, so a
 *    signed-in personal Google account cannot slip through silently.
 * 3. This server-side check: the verified email must end in
 *    @berkeley.edu, or the session is destroyed.
 * The Berkeley CAS/Shibboleth leg needs no app-side work: any
 * berkeley.edu Google login routes through CalNet automatically,
 * because that Workspace enforces SAML SSO to CalNet.
 */

export const BERKELEY_EMAIL_DOMAIN = '@berkeley.edu'

export function isBerkeleyEmail(
  email: string | null | undefined
): boolean {
  return (
    typeof email === 'string' &&
    email.toLowerCase().endsWith(BERKELEY_EMAIL_DOMAIN)
  )
}

/**
 * Accept only relative in-app redirect targets. Anything else (absolute
 * URLs, protocol-relative URLs) falls back to '/'. Guards the `next`
 * parameter against open-redirect abuse.
 */
export function getSafeNextPath(next: string | null | undefined): string {
  if (
    typeof next === 'string' &&
    next.startsWith('/') &&
    !next.startsWith('//')
  ) {
    return next
  }
  return '/'
}
