import { NextResponse } from 'next/server';
import { foundationFixtures } from '@/lib/foundation/fixtures';
import { resolveUserEvents } from '@/lib/foundation/resolver';
import { privateHeaders, requirePersonalContext } from '@/lib/foundation/http';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const context = await requirePersonalContext(request);
  if (context instanceof NextResponse) return context;
  const events = resolveUserEvents(context.ownerUserId, foundationFixtures);
  return NextResponse.json({ events, state: events.length ? 'ready' : 'empty' }, { headers: privateHeaders });
}
