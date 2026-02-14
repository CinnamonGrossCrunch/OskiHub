"use client";

import { useEffect, useState, useCallback } from "react";
import EventDetailModal from "./EventDetailModal";
import type { CalendarEvent } from "@/lib/icsUtils";
import { trackEvent } from '@/lib/analytics';

interface GmailEventDetail {
  event: CalendarEvent;
  newsletters: CalendarEvent[];
  currentIndex: number;
}

export default function GmailNewsletterModalHost() {
  const [newsletters, setNewsletters] = useState<CalendarEvent[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [selectedEvent, setSelectedEvent] = useState<CalendarEvent | null>(null);

  useEffect(() => {
    const handleGmailNewsletterClick = (event: Event) => {
      const detail = (event as CustomEvent<GmailEventDetail>).detail;
      if (!detail || !detail.event) {
        return;
      }

      setNewsletters(detail.newsletters?.length ? detail.newsletters : [detail.event]);
      setCurrentIndex(detail.currentIndex ?? 0);
      setSelectedEvent(detail.event);
    };

    window.addEventListener("openGmailNewsletter", handleGmailNewsletterClick);
    return () => window.removeEventListener("openGmailNewsletter", handleGmailNewsletterClick);
  }, []);

  const goToEvent = useCallback(
    (index: number) => {
      if (index < 0 || index >= newsletters.length) return;
      setCurrentIndex(index);
      setSelectedEvent(newsletters[index]);
    },
    [newsletters]
  );

  const handleNext = useCallback(() => {
    if (currentIndex < newsletters.length - 1) {
      goToEvent(currentIndex + 1);
      trackEvent('gmail_newsletter_navigated', { direction: 'next' });
    }
  }, [currentIndex, newsletters.length, goToEvent]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      goToEvent(currentIndex - 1);
      trackEvent('gmail_newsletter_navigated', { direction: 'previous' });
    }
  }, [currentIndex, goToEvent]);

  const handleClose = useCallback(() => {
    setSelectedEvent(null);
    setCurrentIndex(-1);
    setNewsletters([]);
  }, []);

  const hasNext = currentIndex >= 0 && currentIndex < newsletters.length - 1;
  const hasPrevious = currentIndex > 0;

  return (
    <EventDetailModal
      event={selectedEvent}
      originalEvent={null}
      onClose={handleClose}
      onNext={handleNext}
      onPrevious={handlePrevious}
      hasNext={hasNext}
      hasPrevious={hasPrevious}
    />
  );
}
