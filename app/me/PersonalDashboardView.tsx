import type { ResolvedEvent, TimeShape } from '@/lib/foundation/types';

export type PersonalDashboardState =
  | { kind: 'loading' }
  | { kind: 'unauthorized' }
  | { kind: 'unavailable' }
  | { kind: 'empty' }
  | { kind: 'ready'; events: ResolvedEvent[] };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isInstant(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Number.isFinite(Date.parse(value));
}

function isTime(value: unknown): value is TimeShape {
  if (!isRecord(value)) return false;
  switch (value.kind) {
    case 'instant': return isInstant(value.at) && typeof value.timeZone === 'string';
    case 'interval': return isInstant(value.start) && isInstant(value.end) && typeof value.timeZone === 'string';
    case 'date': return typeof value.startDate === 'string' && typeof value.endDateExclusive === 'string';
    case 'unknown': return typeof value.reason === 'string';
    default: return false;
  }
}

function isEvent(value: unknown): value is ResolvedEvent {
  return isRecord(value)
    && typeof value.id === 'string'
    && typeof value.uid === 'string'
    && typeof value.ownerUserId === 'string'
    && typeof value.title === 'string'
    && ['deadline', 'meeting', 'exam', 'personal'].includes(String(value.eventKind))
    && isTime(value.time)
    && (value.conflict === undefined || typeof value.conflict === 'string')
    && Array.isArray(value.explanations)
    && value.explanations.every((item) => isRecord(item) && typeof item.field === 'string' && typeof item.reason === 'string');
}

export async function loadPersonalDashboard(
  fetcher: typeof fetch,
  signal?: AbortSignal,
): Promise<PersonalDashboardState> {
  try {
    const response = await fetcher('/api/me/dashboard', { cache: 'no-store', signal });
    if (response.status === 401) return { kind: 'unauthorized' };
    if (!response.ok) return { kind: 'unavailable' };
    const body: unknown = await response.json();
    if (!isRecord(body) || !Array.isArray(body.events) || !body.events.every(isEvent)) {
      return { kind: 'unavailable' };
    }
    if (body.state === 'empty' && body.events.length === 0) return { kind: 'empty' };
    if (body.state === 'ready' && body.events.length > 0) return { kind: 'ready', events: body.events };
    return { kind: 'unavailable' };
  } catch {
    return { kind: 'unavailable' };
  }
}

function formatInstant(at: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone, weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
      hour: 'numeric', minute: '2-digit', timeZoneName: 'short',
    }).format(new Date(at));
  } catch {
    return at;
  }
}

function describeTime(time: TimeShape): string {
  switch (time.kind) {
    case 'instant': return formatInstant(time.at, time.timeZone);
    case 'interval': return `${formatInstant(time.start, time.timeZone)} – ${formatInstant(time.end, time.timeZone)}`;
    case 'date': {
      // Calendar dates remain dates; never convert an all-day span to a local instant.
      const end = new Date(`${time.endDateExclusive}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() - 1);
      const lastDate = Number.isFinite(end.getTime()) ? end.toISOString().slice(0, 10) : time.endDateExclusive;
      return time.startDate === lastDate ? `${time.startDate} (all day)` : `${time.startDate} – ${lastDate} (all day)`;
    }
    case 'unknown': return time.reason;
  }
}

export function PersonalDashboardView({ state }: { state: PersonalDashboardState }) {
  return (
    <main style={{ padding: 24, maxWidth: 880, margin: '0 auto' }}>
      <h1>My OskiHub</h1>
      {state.kind === 'loading' && <p role="status">Loading your personal schedule…</p>}
      {state.kind === 'unauthorized' && <p role="status">Sign in to view your personal schedule. <a href="/login">Sign in</a></p>}
      {state.kind === 'unavailable' && <p role="alert">Your personal schedule is unavailable right now. Please try again shortly.</p>}
      {state.kind === 'empty' && <p role="status">No personal events yet.</p>}
      {state.kind === 'ready' && (
        <ul>
          {state.events.map((event) => (
            <li key={event.id} style={{ marginBlock: 20 }}>
              <h2 style={{ fontSize: '1.1rem' }}>{event.title}</h2>
              <p>{describeTime(event.time)}</p>
              {event.conflict && <p role="alert"><strong>Needs review:</strong> {event.conflict}</p>}
              {event.explanations.length > 0 && (
                <details>
                  <summary>Why this event has this value</summary>
                  <ul>{event.explanations.map((explanation, index) => <li key={`${explanation.field}-${index}`}>{explanation.reason}</li>)}</ul>
                </details>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
