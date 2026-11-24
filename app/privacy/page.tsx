import Link from 'next/link'

export const metadata = {
  title: 'Privacy Policy - OskiHub',
  description:
    'How OskiHub collects, uses, and protects your information.',
}

/**
 * Public privacy policy. Google requires this page to be live at a
 * public URL before the OAuth consent screen can be published and the
 * OskiHub brand verified: it is linked from the consent screen as
 * https://www.oski.app/privacy.
 */
export default function PrivacyPage() {
  return (
    <main
      className="flex min-h-screen flex-col items-center px-4 py-12"
      style={{ backgroundColor: 'var(--surface-0)' }}
    >
      <div className="w-full max-w-[680px]">
        <h1
          className="text-3xl font-bold"
          style={{ color: 'var(--text-1)' }}
        >
          Privacy Policy
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: 'var(--text-2)' }}
        >
          Effective November 24, 2026. OskiHub is a student-built
          dashboard for Berkeley Haas EWMBA students, run by Matt
          Gross.
        </p>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            What we collect
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            When you sign in with Google, Google shares your name,
            email address, and profile picture with OskiHub. We store
            that sign-in information with our authentication provider,
            Supabase, to keep you signed in and to restrict access to
            @berkeley.edu accounts. The schedules, calendars, and
            newsletters shown on the site come from Haas program
            sources and course data you already have access to as a
            student.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            How we use it
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            Your sign-in information is used only to confirm you are a
            Berkeley student and to keep your session working. We do
            not sell personal information, and we do not use it for
            advertising. We use Vercel Analytics and Microsoft Clarity
            to understand, in aggregate, how the site is used.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Third parties
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            Your sign-in runs through Google Sign-In and Supabase
            Auth. The site is hosted on Vercel. Each of those services
            processes data under its own privacy policy.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Your choices
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            You can sign out at any time from the user menu on any
            page. To request deletion of your OskiHub sign-in record,
            email matt@gross.design and we will remove it.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Changes
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            If this policy changes, the effective date above will be
            updated. Questions: matt@gross.design.
          </p>
        </section>

        <p className="mt-10 text-sm">
          <Link
            href="/login"
            style={{ color: 'var(--berkeley-gold)' }}
          >
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  )
}
