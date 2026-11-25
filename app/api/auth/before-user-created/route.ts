import { createHmac, timingSafeEqual } from 'node:crypto';
import { isBerkeleyEmail } from '@/lib/auth';

/**
 * Supabase Auth "Before User Created" hook endpoint.
 *
 * Supabase calls this immediately before creating a user (first
 * Google sign-in). It enforces the @berkeley.edu domain at the auth
 * layer, as defense-in-depth behind the middleware and /auth/callback
 * checks: if any of those were ever bypassed, a non-Berkeley account
 * still cannot get a Supabase user row.
 *
 * Supabase hook contract (see Supabase docs, "Before User Created
 * Hook"): the request body is { metadata, user }, where user matches
 * the auth.users shape and carries the email. Return {} with HTTP 200
 * to allow creation, or { error: { http_code, message } } with a 4xx
 * to reject it. The hook is available on the Supabase Free plan.
 *
 * Authentication: Supabase signs the request with Standard Webhooks
 * HMAC-SHA256. Headers are webhook-id, webhook-timestamp, and
 * webhook-signature (format "v1,<base64-hmac>"); the signature covers
 * "{webhook-id}.{webhook-timestamp}.{raw body}". The secret is issued
 * by Supabase as "v1,whsec_<base64>" when the hook is enabled in the
 * dashboard, and is stored as SUPABASE_AUTH_HOOK_SECRET in Vercel.
 *
 * Rollout safety: if SUPABASE_AUTH_HOOK_SECRET is not set, signature
 * verification is skipped (a warning is logged) and only the domain
 * check runs. That keeps a missing secret from locking every signup
 * out while the hook is being wired up; once the secret is set, a bad
 * signature is a hard 401. The domain check itself always runs, so
 * the endpoint is never a bypass: calling it directly cannot create
 * a user, it can only return allow/deny.
 *
 * The middleware matcher excludes /api, so this route is reachable
 * without a session -- Supabase must be able to call it.
 */

const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function getHookSecret(): string | null {
  const raw = process.env.SUPABASE_AUTH_HOOK_SECRET;
  if (!raw) return null;
  // Supabase issues the secret as "v1,whsec_<base64>"; the HMAC key
  // is the base64-decoded part after the prefix.
  const withoutPrefix = raw.startsWith('v1,whsec_')
    ? raw.slice('v1,whsec_'.length)
    : raw;
  return withoutPrefix;
}

function verifySignature(
  rawBody: string,
  headers: Headers,
  secretBase64: string
): boolean {
  const webhookId = headers.get('webhook-id');
  const webhookTimestamp = headers.get('webhook-timestamp');
  const webhookSignature = headers.get('webhook-signature');
  if (!webhookId || !webhookTimestamp || !webhookSignature) {
    return false;
  }

  // Reject stale requests (replay protection).
  const timestampSeconds = Number(webhookTimestamp);
  if (!Number.isFinite(timestampSeconds)) return false;
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (
    Math.abs(nowSeconds - timestampSeconds) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const key = Buffer.from(secretBase64, 'base64');
  const signedContent = `${webhookId}.${webhookTimestamp}.${rawBody}`;
  const expected = createHmac('sha256', key)
    .update(signedContent, 'utf8')
    .digest('base64');

  // The header can carry several space-separated signatures
  // ("v1,<sig1> v1,<sig2>"); accept if any matches.
  for (const part of webhookSignature.split(' ')) {
    const presented = part.startsWith('v1,') ? part.slice(3) : part;
    const expectedBuffer = Buffer.from(expected, 'utf8');
    const presentedBuffer = Buffer.from(presented, 'utf8');
    if (
      expectedBuffer.length === presentedBuffer.length &&
      timingSafeEqual(expectedBuffer, presentedBuffer)
    ) {
      return true;
    }
  }
  return false;
}

export async function POST(request: Request) {
  const rawBody = await request.text();

  const secret = getHookSecret();
  if (secret) {
    if (!verifySignature(rawBody, request.headers, secret)) {
      return Response.json(
        { error: { http_code: 401, message: 'Invalid hook signature.' } },
        { status: 401 }
      );
    }
  } else {
    console.warn(
      '[before-user-created] SUPABASE_AUTH_HOOK_SECRET is not set; ' +
        'skipping signature verification (domain check still applies).'
    );
  }

  let payload: { user?: { email?: unknown } };
  try {
    payload = JSON.parse(rawBody) as { user?: { email?: unknown } };
  } catch {
    return Response.json(
      { error: { http_code: 400, message: 'Invalid JSON body.' } },
      { status: 400 }
    );
  }

  const email = payload?.user?.email;
  if (!isBerkeleyEmail(typeof email === 'string' ? email : null)) {
    return Response.json(
      {
        error: {
          http_code: 403,
          message: 'Only @berkeley.edu accounts can use OskiHub.',
        },
      },
      { status: 403 }
    );
  }

  // Allow: empty object, HTTP 200.
  return Response.json({});
}
