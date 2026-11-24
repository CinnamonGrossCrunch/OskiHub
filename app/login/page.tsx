import SignInButton from './SignInButton'

export const metadata = {
  title: 'Sign in - OskiHub',
  description: 'Sign in to OskiHub with your @berkeley.edu Google account.',
}

/**
 * Public sign-in page. Unauthenticated visitors are sent here by the
 * middleware. Copy mirrors the scheduler that inspired this flow:
 * one button, Google only, berkeley.edu only.
 */
export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>
}) {
  const params = await searchParams
  const error = params.error
  const next = params.next

  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-4"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      <div
        className="w-full max-w-[340px] rounded-2xl border p-8 text-center"
        style={{
          backgroundColor: 'var(--surface-1)',
          borderColor: 'var(--border-1)',
        }}
      >
        <h1
          className="text-2xl font-bold"
          style={{ color: 'var(--text-1)' }}
        >
          Sign in
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: 'var(--text-2)' }}
        >
          Use your @berkeley.edu Google account
        </p>

        {error === 'domain' && (
          <p
            role="alert"
            className="mt-4 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: '#7f1d1d',
              backgroundColor: '#450a0a',
              color: '#fecaca',
            }}
          >
            Only Berkeley accounts are allowed.
          </p>
        )}
        {error === 'auth' && (
          <p
            role="alert"
            className="mt-4 rounded-lg border px-3 py-2 text-sm"
            style={{
              borderColor: '#7f1d1d',
              backgroundColor: '#450a0a',
              color: '#fecaca',
            }}
          >
            Sign in failed. Please try again.
          </p>
        )}

        <div className="mt-6">
          <SignInButton next={next} />
        </div>

        <p
          className="mt-6 text-xs leading-relaxed"
          style={{ color: 'var(--text-2)' }}
        >
          OskiHub is for Berkeley Haas EWMBA students. Signing in with a
          berkeley.edu Google account routes through CalNet automatically.
        </p>
      </div>
    </main>
  )
}
