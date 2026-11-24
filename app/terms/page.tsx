import Link from 'next/link'

export const metadata = {
  title: 'Terms of Service - OskiHub',
  description: 'The terms for using OskiHub.',
}

/**
 * Public terms of service. Google requires this page to be live at a
 * public URL before the OAuth consent screen can be published and the
 * OskiHub brand verified: it is linked from the consent screen as
 * https://www.oski.app/terms.
 */
export default function TermsPage() {
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
          Terms of Service
        </h1>
        <p
          className="mt-2 text-sm"
          style={{ color: 'var(--text-2)' }}
        >
          Effective November 24, 2026.
        </p>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            What OskiHub is
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            OskiHub is a student-built dashboard for Berkeley Haas
            EWMBA students, run by Matt Gross. It gathers course
            schedules, calendars, and newsletters in one place. It is
            provided as-is, as a student project, with no guarantee of
            availability or accuracy.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Who can use it
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            Access requires signing in with a @berkeley.edu Google
            account. Your account is for your use only.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Acceptable use
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            Use the site for your own coursework and planning. Do not
            try to bypass the sign-in or access controls, do not scrape
            or redistribute course data in ways that conflict with
            Berkeley policies, and do not use the site to misrepresent
            yourself or anyone else.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Accuracy
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            Schedules and dates come from Haas program sources and
            course platforms. They can change, and snapshots on this
            site can lag behind. For anything that matters, confirm
            against the official source, such as OLR or bCourses.
          </p>
        </section>

        <section className="mt-8">
          <h2
            className="text-lg font-semibold"
            style={{ color: 'var(--text-1)' }}
          >
            Changes and contact
          </h2>
          <p
            className="mt-2 text-sm leading-relaxed"
            style={{ color: 'var(--text-2)' }}
          >
            These terms may change; the effective date above will be
            updated when they do. Questions: matt@gross.design.
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
