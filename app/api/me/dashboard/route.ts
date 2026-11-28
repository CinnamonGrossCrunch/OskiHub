import { NextResponse } from 'next/server';
import { loadFoundationData } from '@/lib/foundation/db';
import { resolveUserEvents } from '@/lib/foundation/resolver';
import { privateHeaders, requirePersonalContext } from '@/lib/foundation/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await requirePersonalContext(request);
  if (context instanceof NextResponse) return context;
  const loaded = await loadFoundationData(context.supabase, context.ownerUserId);
  if (!loaded.ok) return NextResponse.json({ error: 'Personal schedule unavailable', state: 'unavailable' }, { status: 503, headers: privateHeaders });
  const events = resolveUserEvents(context.ownerUserId, loaded.data);
  return NextResponse.json({ events, counts: { events: events.length }, state: events.length ? 'ready' : 'empty' }, { headers: privateHeaders });
}
