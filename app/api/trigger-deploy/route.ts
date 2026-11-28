import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Disabled on the legacy branch: the old handler triggered a Vercel
// deployment with no authentication.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
