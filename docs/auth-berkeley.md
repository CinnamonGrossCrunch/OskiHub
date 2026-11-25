# Berkeley auth for OskiHub

OskiHub signs users in with their `@berkeley.edu` Google account. The
implementation copies the approach verified on the student-built Haas
MBA Course Scheduler (`haas-mba-course-scheduler.lovable.app`) in
November 2026: Supabase Auth with the Google provider, plus a
server-side `@berkeley.edu` domain check.

## How it works

```
User clicks "Sign in with Google"
  -> Supabase Auth, Google provider
     (queryParams: hd=berkeley.edu, prompt=select_account)
  -> accounts.google.com (berkeley.edu Workspace)
  -> Berkeley Shibboleth IdP / CalNet CAS (automatic: the berkeley.edu
     Workspace enforces SAML SSO to CalNet, no app-side work needed)
  -> /auth/callback?code=... (server exchanges the code for a session)
  -> server checks the Google-verified email ends in @berkeley.edu
  -> dashboard (or back to /login?error=domain)
```

The Berkeley CAS/Shibboleth leg is Berkeley infrastructure, not an
OskiHub integration. OskiHub never registers with Berkeley and never
talks to CalNet directly: the app talks to Google, Google talks to
Berkeley. That is also why this needs no Berkeley approval. Real
CalNet SSO (registering OskiHub as a Shibboleth Service Provider)
would require a Service Request to UC Berkeley IST; it is not needed
for this setup, and it would only matter if OskiHub ever became an
official campus service.

Domain enforcement has four layers:

1. `hd: 'berkeley.edu'` in the Google OAuth request (`app/login/
   SignInButton.tsx`): Google only offers berkeley.edu accounts at
   the account chooser.
2. `prompt: 'select_account'`: the chooser is shown every time, so a
   signed-in personal Google account cannot slip through silently.
3. Server-side check (`lib/auth.ts`, `isBerkeleyEmail`): the verified
   email must end in `@berkeley.edu`. Enforced in two places:
   - `app/auth/callback/route.ts`: a non-Berkeley account gets its
     session destroyed immediately after sign-in.
   - `lib/supabase/middleware.ts` (via `middleware.ts`): re-checked
     on every page request; a non-Berkeley session is sent to
     `/auth/signout`, which destroys it and redirects to
     `/login?error=domain`.
4. Supabase "Before User Created" hook
   (`app/api/auth/before-user-created/route.ts`): Supabase calls this
   endpoint immediately before creating a user row (first sign-in),
   and it rejects any email that is not @berkeley.edu. This is
   defense-in-depth behind layer 3: even if the callback and
   middleware checks were ever bypassed, a non-Berkeley account
   cannot get a Supabase user row. See "Before User Created hook"
   below for setup.

Layer 3 is the actual enforcement. Layers 1 and 2 are UX guardrails:
the scheduler this was modeled on did the domain check client-side
only, which anyone can bypass in their own browser. The check must
run on the server, reading the email from the signed session token,
because the browser cannot forge Supabase's signature.

Caveat: this proves *Berkeley*, not *Haas*. Any berkeley.edu
account can sign in. Restricting to the EWMBA cohort would need an
allowlist on top of this.

## What is gated, and what stays public

The gate is controlled by the `AUTH_GATE_ENABLED` env flag
(`middleware.ts`, `isGateEnabled`). Only the exact string `'true'`
turns it on; anything else (including unset) leaves the site public
as today. The flag exists because of the consent-screen lockout trap:
the Google consent screen cannot be published until `/privacy` and
`/terms` are live on www.oski.app, which only happens after the auth
code merges. So the ship sequence is: merge with the gate OFF, publish
the consent screen, then flip the flag ON (set the env var in Vercel
and redeploy). Production was flipped ON on Nov 25, 2026, after the
consent screen was published and the hook secret was set in Vercel.
The flag controls only whether pages require a sign-in;
the @berkeley.edu domain check always runs, gate on or off.

Gated when the flag is on (middleware redirects to
`/login?next=<path>` when signed out):

- `/` (dashboard), `/admin/*`, `/resources/*`, and any other page.

Public:

- `/login`, `/auth/*` (the sign-in flow itself).
- Static files under `public/`: `/course_ICS_files/*`,
  `/parking-events/*`, `/haas_academic_calendar*.ics`, icons and
  images. Calendar apps fetch these without a browser session, so
  gating them would break existing subscriptions.
- All `/api/*` routes (excluded by the middleware matcher): Vercel
  cron jobs and the calendar/newsletter APIs must work without a
  browser session.

## Code map

| File | Role |
| --- | --- |
| `lib/supabase/client.ts` | Browser Supabase client (client components). |
| `lib/supabase/server.ts` | Server Supabase client (Server Components, Route Handlers). |
| `lib/supabase/middleware.ts` | Session refresh + Berkeley check on every page request. |
| `lib/auth.ts` | `isBerkeleyEmail`, `getSafeNextPath`, domain constant. |
| `middleware.ts` | HTTPS redirect, security headers, session refresh, page gating (flag-controlled). |
| `app/api/auth/before-user-created/route.ts` | Supabase Before User Created hook: domain check at user creation + Standard Webhooks signature verification. |
| `app/login/page.tsx` | Public sign-in page (+ `SignInButton.tsx`). |
| `app/auth/callback/route.ts` | OAuth callback: code exchange + domain check. |
| `app/auth/signout/route.ts` | Destroys the session, redirects. |
| `app/components/UserChip.tsx` | Signed-in email + sign-out link, top-right of every page. |

## Setup

Do these once, in order. Steps 1-3 need Matt's accounts; step 4 is
Vercel dashboard; step 5 is the Supabase hook; step 6 is local only.

### 1. Create the Supabase project

1. Sign in at supabase.com (any Google account works; use one Matt
   controls long-term).
2. New project, name it `oskihub` (or similar), pick a database
   password, keep the region close to the Vercel region (`us-east-1`,
   matching `regions: ["iad1"]` in `vercel.json`).
3. Note the project URL, e.g. `https://<project-ref>.supabase.co`.

### 2. Create the Google Cloud OAuth client

1. In Google Cloud Console, create (or reuse) a project, e.g.
   `oskihub-auth`.
2. APIs & Services -> OAuth consent screen: User Type External,
   app name `OskiHub`, support email Matt's address. No scopes beyond
   the defaults (`openid`, `email`, `profile`) are needed. No test
   users are needed once the app is published; while in Testing mode,
   only listed test users can sign in, so publish the consent screen
   (or add test users) before relying on it.
3. APIs & Services -> Credentials -> Create Credentials -> OAuth
   client ID -> Web application, name `OskiHub web`.
4. Authorized redirect URI (exact):
   `https://<project-ref>.supabase.co/auth/v1/callback`
   (the Supabase project ref from step 1). No other redirect URI is
   needed: the app itself redirects to Supabase, Supabase redirects
   to Google, Google returns to Supabase, Supabase returns to the
   app's `/auth/callback`.
5. Note the Client ID and Client Secret.

### 3. Enable the Google provider in Supabase

1. Supabase Dashboard -> Authentication -> Providers -> Google ->
   Enable.
2. Paste the Client ID and Client Secret from step 2.
3. Authentication -> URL Configuration:
   - Site URL: `https://www.oski.app`
   - Additional Redirect URLs: `https://www.oski.app/auth/callback`
     and, for local development, `http://localhost:3000/auth/callback`
4. No `hd` setting is needed in Supabase: the app passes
   `hd: 'berkeley.edu'` and `prompt: 'select_account'` as
   `queryParams` in `signInWithOAuth` (`app/login/SignInButton.tsx`).

### 4. Set the Vercel environment variables

In the Vercel project settings (Production, Preview, Development):

- `NEXT_PUBLIC_SUPABASE_URL` = `https://<project-ref>.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = the anon/public key from
  Supabase Dashboard -> Settings -> API.
- `AUTH_GATE_ENABLED` = `false` at merge time (gate off); set to
  `true` and redeploy after the consent screen is published.
- `SUPABASE_AUTH_HOOK_SECRET` = the hook secret Supabase issues
  (see "Before User Created hook" below); set it after enabling the
  hook, then redeploy.

The anon key is public by design and is safe to ship in the browser.
Never add the `service_role` key to the app or to Vercel env vars;
it bypasses all access control.

### 5. Before User Created hook (defense-in-depth)

1. Deploy the app with the hook endpoint live:
   `https://www.oski.app/api/auth/before-user-created`.
2. Supabase Dashboard -> Authentication -> Hooks -> Before User
   Created -> Enable, HTTP hook, URL the endpoint above. Supabase
   issues a secret (`v1,whsec_...`); copy it.
3. Set `SUPABASE_AUTH_HOOK_SECRET` to that secret in Vercel (All
   Environments) and redeploy. Until the secret is set, the endpoint
   skips signature verification but still enforces the domain check,
   so a missing secret can never lock signups out; once set, a bad
   signature is a hard 401.
4. Verify: the hook fires on first sign-in only (it runs before the
   user row is created). A non-Berkeley Google account attempting
   sign-in must be rejected with "Only @berkeley.edu accounts can
   use OskiHub" and no user row created. If signups ever break
   after enabling the hook, disable it in the dashboard first and
   debug second: a failing hook blocks user creation.

The endpoint verifies the Standard Webhooks HMAC-SHA256 signature
(`webhook-id`, `webhook-timestamp`, `webhook-signature` headers,
5-minute timestamp tolerance) using Node's `crypto`, no extra
dependency. It returns `{}` (HTTP 200) to allow, or
`{ error: { http_code, message } }` with a 4xx to reject.

### 6. Local development

Copy `.env.local.example` to `.env.local` and fill in the two
Supabase values. Run `npm run dev` and visit
`http://localhost:3000`: with `AUTH_GATE_ENABLED=true` the middleware
redirects to `/login`, and signing in with a berkeley.edu account
returns to the dashboard. With the flag off (default), the site is
public locally as in production before the flip.

## Testing checklist

- [ ] With `AUTH_GATE_ENABLED` unset or `false`, a signed-out visit
      to `/` loads the dashboard (gate off, site public as today).
- [ ] With `AUTH_GATE_ENABLED=true`, a signed-out visit to `/`
      redirects to `/login?next=/`.
- [ ] `/login` shows the Google button; clicking it shows the Google
      account chooser (berkeley.edu accounts only).
- [ ] Signing in with a berkeley.edu account lands on the dashboard;
      the user chip shows the email, top-right.
- [ ] Signing in with a non-Berkeley Google account lands on
      `/login?error=domain` with "Only Berkeley accounts are allowed."
      and no session survives (revisiting `/` redirects to `/login`).
- [ ] `/course_ICS_files/*.ics` and `/api/calendar` still return
      without a session (calendar subscriptions keep working).
- [ ] Sign-out returns to `/login`; revisiting `/` redirects there.
- [ ] `npm run build` and `npm run type-check` pass.

## Troubleshooting

- **Google shows "Access blocked" / app not verified**: the OAuth
  consent screen is in Testing mode and the account is not a listed
  test user. Publish the consent screen or add the account as a test
  user.
- **Redirect loops to /login after signing in**: check the Supabase
  URL Configuration (Site URL and Additional Redirect URLs) and that
  the Vercel env vars match the Supabase project. A mismatched
  `redirectTo` makes Supabase send the user to the Site URL instead
  of `/auth/callback`.
- **"Only Berkeley accounts are allowed" for a berkeley.edu user**:
  check the email Supabase recorded (Dashboard -> Authentication ->
  Users). Alumni and some affiliate accounts keep a berkeley.edu
  address but authenticate differently; the check is purely on the
  email suffix.
- **Session does not persist across refreshes**: the middleware
  refreshes the session cookie on every page request. If cookies are
  blocked for the site, sign-in cannot persist.

## Live setup (Nov 24, 2026)

All four setup steps were completed in the browser on Nov 24, 2026
and verified on the live pages:

- Supabase project `oskihub`, org "CinnamonGrossCrunch's Org"
  (Free plan). Project URL:
  `https://egsvzmlwatueyhqwjyfm.supabase.co`. Region ended up
  **us-west-2** (West US / Oregon), not us-east-1: the project
  creation form only offered broad regions ("Americas"). Latency-only
  difference; no action needed unless the region ever matters.
- Google Cloud project `oskihub-auth-515723` under matt@gross.design
  (gross.design org; moved from the personal Gmail Nov 24, 2026 —
  the old project `oskihub-auth` under matthewrgross01@gmail.com was
  shut down and is pending deletion, restorable for 30 days).
  OAuth client "OskiHub web" with the exact redirect URI above.
  Consent screen support email matt@gross.design, homepage
  https://www.oski.app. Test users: matt@gross.design and
  mattgross@berkeley.edu. Google provider enabled in Supabase with
  the new client credentials.
- Vercel env vars `NEXT_PUBLIC_SUPABASE_URL` and
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` set for All Environments in the
  oskihub project. **A new deployment is needed for them to take
  effect.**

### Testing-mode limitation (open)

The Google OAuth consent screen is still in **Testing mode**:
"Publish app" is disabled because Google requires a homepage URL and
a privacy policy URL on the Branding page. Only the listed test users
(matt@gross.design and mattgross@berkeley.edu, cap 100) can sign in
while it is in Testing. Other berkeley.edu accounts are blocked until
either the app is published or each account is added as a test user.
Publish before opening sign-in to other Haas students.

The pages the consent screen needs already exist in the repo:
`/privacy` and `/terms` (`app/privacy/page.tsx`,
`app/terms/page.tsx`), linked from the sign-in page, and the consent
screen logo is `public/oskihub-logo-120.png` (120x120, resized from
the site's hub mark). They go live at `https://www.oski.app/privacy`
and `https://www.oski.app/terms` once this branch merges to main;
only then can the branding URLs be set and the brand submitted for
Google verification, which is what makes the consent screen show
"OskiHub" and the logo instead of the Supabase project domain.

## What this does not do (future work)

- **Row Level Security (RLS)**: no per-user rows exist in Supabase
  yet, so there is nothing to lock down at the database layer. If
  OskiHub ever stores per-user data (saved schedules, preferences),
  add RLS policies keyed on the `@berkeley.edu` email before writing
  user data.
- **Cohort restriction**: as noted above, any berkeley.edu account
  can sign in. An EWMBA-only allowlist would be a separate table +
  check in the callback route.
- **Vercel Blob**: deliberately not used here. Blob is object
  storage for files, not a database; auth state lives in Supabase
  Auth (Postgres). Blob would only come in if the app needs user
  file uploads later.
