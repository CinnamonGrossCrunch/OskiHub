'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * Signed-in user chip, fixed to the top-right of every page. Renders
 * nothing when there is no session (including on the login page), so
 * it never affects the logged-out view. Plain anchor to the sign-out
 * route handler, no JavaScript needed for the sign-out itself.
 */
export default function UserChip() {
  const [email, setEmail] = useState<string | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setEmail(user?.email ?? null)
    })
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (!email) return null

  return (
    <div
      className="fixed right-4 top-4 z-50 flex items-center gap-3 rounded-full border px-3 py-1.5 text-xs"
      style={{
        backgroundColor: 'var(--surface-1)',
        borderColor: 'var(--border-1)',
        color: 'var(--text-2)',
      }}
    >
      <span className="max-w-[180px] truncate">{email}</span>
      <a
        href="/auth/signout"
        className="font-semibold"
        style={{ color: 'var(--berkeley-gold)' }}
      >
        Sign out
      </a>
    </div>
  )
}
