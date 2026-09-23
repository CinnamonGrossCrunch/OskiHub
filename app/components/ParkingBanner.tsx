'use client';

import { useEffect, useState } from 'react';

type Props = {
  /** YYYY-MM-DD key: dismissal is remembered per day */
  dateKey: string;
  /** Human-readable impacting event labels, e.g. "Cal Bears: Football vs Stanford" */
  events: string[];
};

/**
 * Day-of parking alert banner. Shown at the top of the calendar when a
 * stadium / Greek Theater event is expected to disrupt campus parking.
 * Dismissible; the dismissal is remembered for the rest of the day.
 */
export default function ParkingBanner({ dateKey, events }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(`parking-banner-${dateKey}`) === '1');
    } catch {
      setDismissed(false);
    }
  }, [dateKey]);

  if (dismissed || events.length === 0) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(`parking-banner-${dateKey}`, '1');
    } catch {
      /* storage unavailable — just hide for this render */
    }
    setDismissed(true);
  };

  return (
    <div className="mx-1 mb-2 rounded-lg border border-yellow-400/50 bg-yellow-400/10 px-3 py-2 flex items-start gap-2">
      <svg className="w-5 h-5 flex-shrink-0 mt-px" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="11" fill="#FACC15" />
        <text x="12" y="16.5" textAnchor="middle" fontSize="12" fontWeight="900" fill="#111827">P</text>
        <line x1="4.5" y1="19.5" x2="19.5" y2="4.5" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
      </svg>
      <p className="flex-1 text-xs leading-snug text-yellow-100/90">
        <span className="font-semibold text-yellow-300">Parking alert today — </span>
        {events.join(' · ')}. Expect event crowds and limited parking near campus; allow extra commute time.
      </p>
      <button
        onClick={dismiss}
        aria-label="Dismiss parking alert"
        className="flex-shrink-0 text-yellow-200/70 hover:text-yellow-100 transition-colors text-sm leading-none px-1"
      >
        ✕
      </button>
    </div>
  );
}
