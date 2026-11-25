'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

/**
 * The single sign-in control. Starts Supabase Google OAuth with the
 * Berkeley domain lock, mirroring the scheduler this flow was modeled
 * on: `hd` restricts the Google chooser to berkeley.edu accounts and
 * `prompt: 'select_account'` forces the chooser every time.
 * The server-side @berkeley.edu check (middleware + /auth/callback) is
 * the actual enforcement; these params are the first layer.
 */
export default function SignInButton({ next }: { next?: string }) {
  const [status, setStatus] = useState<'idle' | 'opening' | 'failed'>(
    'idle'
  )

  const handleSignIn = async () => {
    if (status === 'opening') return
    setStatus('opening')
    const supabase = createClient()
    const redirectTo =
      window.location.origin +
      '/auth/callback' +
      (next ? `?next=${encodeURIComponent(next)}` : '')
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo,
        queryParams: {
          hd: 'berkeley.edu',
          prompt: 'select_account',
        },
      },
    })
    if (error) {
      setStatus('failed')
    }
  }

  return (
    <button
      type="button"
      onClick={handleSignIn}
      disabled={status === 'opening'}
      className="w-full rounded-lg px-4 py-3 text-sm font-semibold transition-opacity disabled:opacity-60"
      style={{
        backgroundColor: 'var(--berkeley-blue)',
        color: '#ffffff',
      }}
    >
      {status === 'opening'
        ? 'Opening Google...'
        : status === 'failed'
          ? 'Try again with Google'
          : 'Sign in with Google'}
    </button>
  )
}
