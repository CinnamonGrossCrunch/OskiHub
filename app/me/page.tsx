'use client';

import { useEffect, useState } from 'react';
import { loadPersonalDashboard, PersonalDashboardView, type PersonalDashboardState } from './PersonalDashboardView';

export default function PersonalDashboardPage() {
  const [state, setState] = useState<PersonalDashboardState>({ kind: 'loading' });
  useEffect(() => {
    const controller = new AbortController();
    loadPersonalDashboard(fetch, controller.signal).then((nextState) => {
      if (!controller.signal.aborted) setState(nextState);
    });
    return () => controller.abort();
  }, []);
  return <PersonalDashboardView state={state} />;
}
