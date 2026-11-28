import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { isBerkeleyEmail } from '@/lib/auth';
import { foundationFixtures } from './fixtures';
import type { UUID } from './types';

export const privateHeaders = { 'Cache-Control': 'private, no-store' };

export async function requirePersonalContext(request: Request): Promise<{ ownerUserId: UUID; email: string } | NextResponse> {
  const url = new URL(request.url);
  if (url.searchParams.has('user_id') || url.searchParams.has('userId')) {
    return NextResponse.json({ error: 'user_id is not accepted' }, { status: 400, headers: privateHeaders });
  }
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user || !isBerkeleyEmail(data.user.email)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: privateHeaders });
  }
  const email = data.user.email!.toLowerCase();
  const ownerUserId = foundationFixtures.profileByEmail[email] ?? data.user.id;
  return { ownerUserId, email };
}
