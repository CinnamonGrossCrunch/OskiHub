'use client';

import { useEffect, useState } from 'react';

type PersonalEvent = { id: string; title: string; time: { kind: string; at?: string; reason?: string } };

export default function PersonalDashboardPage() {
  const [events, setEvents] = useState<PersonalEvent[]>([]);
  const [state, setState] = useState('loading');
  useEffect(() => {
    fetch('/api/me/dashboard', { cache: 'no-store' })
      .then(async (res) => {
        if (!res.ok) throw new Error('unauthorized');
        const data = await res.json();
        setEvents(data.events ?? []);
        setState(data.state ?? 'ready');
      })
      .catch(() => setState('unauthorized'));
  }, []);
  return (
    <main style={{ padding: 24 }}>
      <h1>My OskiHub</h1>
      <p>Personal foundation dashboard. State: {state}</p>
      {events.length === 0 ? <p>No personal events yet.</p> : (
        <ul>{events.map((event) => <li key={event.id}>{event.title} - {event.time.at ?? event.time.reason ?? event.time.kind}</li>)}</ul>
      )}
    </main>
  );
}
