import { NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Disabled on the legacy branch: the old handler called OpenAI with the
// server API key and no authentication.
export async function POST() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}

export async function GET() {
  return NextResponse.json({ error: 'Not found' }, { status: 404 });
}
