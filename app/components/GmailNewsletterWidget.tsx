"use client";

import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import type { CalendarEvent } from "@/lib/icsUtils";
import { trackEvent } from '@/lib/analytics';

const Lottie = dynamic(() => import("lottie-react"), { ssr: false });

const formatDisplayDate = (input: string | undefined) => {
  if (!input) return "Date TBD";
  const isoMatch = input.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoMatch) {
    const [, year, month, day] = isoMatch;
    return `${month}-${day}-${year.slice(-2)}`;
  }

  const parsed = new Date(input);
  if (!Number.isNaN(parsed.getTime())) {
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const year = parsed.getFullYear();
    return `${month}-${day}-${year}`;
  }

  return input;
};

type GmailNewsletter = {
  title: string;
  date: string;
  source: string;
  content: string;
  filename: string;
};

const GMAIL_VARIANT_VALUES = ["bluecrew", "ewwire"] as const;

export type NewsletterVariant = typeof GMAIL_VARIANT_VALUES[number];

export const GMAIL_NEWSLETTER_VARIANTS: NewsletterVariant[] = [...GMAIL_VARIANT_VALUES];

interface GmailNewsletterWidgetProps {
  variant: NewsletterVariant;
  selectedCohort?: 'blue' | 'gold';
}

const VARIANT_CONFIG: Record<NewsletterVariant, {
  title: string;
  subtitle: string;
  footer: string;
  match: (newsletter: GmailNewsletter) => boolean;
}> = {
  bluecrew: {
    title: "Blue Crew Review",
    subtitle: "EWMBA 28 Blue Cohort Newsletter",
    footer: "Published by Giovy Webb, Stetson Ackley, Sarjak Shah, Hilary Scanlin",
    match: (newsletter) => {
      const normalized = `${newsletter.title} ${newsletter.filename}`.toLowerCase();
      return normalized.includes("blue crew") || normalized.includes("bluecrew");
    }
  },
  ewwire: {
    title: "EW Wire",
    subtitle: "Evening & Weekend MBA Weekly Newsletter",
    footer: "Published by the Haas EWMBA Program Office",
    match: (newsletter) => {
      const normalized = `${newsletter.title} ${newsletter.filename}`.toLowerCase();
      return normalized.includes("ew wire") || normalized.includes("ewwire");
    }
  }
};

const COLORS = {
  headerBg: "bg-slate-800/70",
  footerBg: "bg-slate-800/70",
  sectionBg: "bg-slate-800/70",
  sectionBgHover: "hover:bg-blue-500/30",
  containerBg: "bg-slate-800/70",
  border: "border-slate-800",
  textPrimary: "text-slate-200",
  textHoverWhite: "group-hover:text-white",
  unreadDot: "bg-green-400 border-red-500 shadow-green-500/30 animate-pulse"
};

const convertToCalendarEvent = (
  newsletter: GmailNewsletter
): CalendarEvent & { htmlContent?: string } => ({
  uid: newsletter.filename,
  title: newsletter.title,
  start: newsletter.date,
  end: newsletter.date,
  allDay: true,
  description: "",
  location: undefined,
  url: undefined,
  source: "newsletter",
  htmlContent: newsletter.content
});

export default function GmailNewsletterWidget({ variant, selectedCohort = 'blue' }: GmailNewsletterWidgetProps) {
  const config = VARIANT_CONFIG[variant];
  
  // All hooks must be called before any conditional returns
  const [latestNewsletter, setLatestNewsletter] = useState<GmailNewsletter | null>(null);
  const [variantNewsletters, setVariantNewsletters] = useState<GmailNewsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [animationData, setAnimationData] = useState<object | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  useEffect(() => {
    fetch("/Gross-Haas-Click.json")
      .then((response) => response.json())
      .then((data) => setAnimationData(data))
      .catch((err) => console.error("Failed to load animation:", err));
  }, []);

  useEffect(() => {
    const fetchNewsletters = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/gmail-newsletters");

        if (!response.ok) {
          throw new Error("Failed to fetch Gmail newsletters");
        }

        const data = await response.json();
        const allNewsletters: GmailNewsletter[] = data.newsletters || [];
        const matches = allNewsletters.filter(config.match);

        setVariantNewsletters(matches);
        setLatestNewsletter(matches[0] ?? null);
      } catch (err) {
        console.error("Error fetching Gmail newsletters:", err);
        setError(err instanceof Error ? err.message : "Failed to load newsletters");
      } finally {
        setLoading(false);
      }
    };

    fetchNewsletters();
  }, [config]);

  useEffect(() => {
    setIsAnimating(false);
  }, [latestNewsletter?.filename]);

  // If this is Blue Crew Review variant and Gold cohort is selected, show placeholder
  if (variant === 'bluecrew' && selectedCohort === 'gold') {
    return (
      <div className={`flex flex-col h-full ${COLORS.containerBg} backdrop-blur-md rounded-xl  shadow-xl overflow-hidden`}>
        {/* Header */}
        <div className={`px-6 py-2 ${COLORS.headerBg} backdrop-blur-md border-b ${COLORS.border}`}>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-gray-500 mb-0">
                Gold Cohort
              </h2>
              <p className="text-xs text-slate-400">
                EWMBA 28 Gold Cohort Newsletter
              </p>
            </div>
          </div>
        </div>

        {/* Placeholder Content */}
        <div className="flex-1 flex items-center justify-center p-0">
          <div className="text-center">
            <div className="text-6xl mb-0"></div>
            <h3 className="text-sm font-semibold text-gray-500 mb-0">
              Gold Cohort Newsletter Not Yet Available
            </h3>
          
          </div>
        </div>

        {/* Footer */}
        <div className={`px-6 py-3 ${COLORS.footerBg} backdrop-blur-md border-t ${COLORS.border}`}>
          <p className="text-xs text-slate-400 text-center">
            Coming Soon
          </p>
        </div>
      </div>
    );
  }

  const handleNewsletterClick = () => {
    if (!latestNewsletter) return;

    setIsAnimating(true);
    trackEvent('gmail_newsletter_opened', { title: latestNewsletter.title || 'unknown' });

    const calendarEvent = convertToCalendarEvent(latestNewsletter);
    const event = new CustomEvent("openGmailNewsletter", {
      detail: {
        event: calendarEvent,
        newsletters: variantNewsletters.map(convertToCalendarEvent),
        currentIndex: 0,
        timestamp: Date.now()
      }
    });

    window.dispatchEvent(event);
  };

  const renderContent = () => {
    if (loading) {
      return (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-blue-900/30 rounded-full flex items-center justify-center mx-auto mb-3 animate-pulse">
            <span className="text-lg">📬</span>
          </div>
          <p className="text-sm text-slate-400">Loading {config.title}...</p>
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-red-900/30 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-lg">⚠️</span>
          </div>
          <p className="text-sm text-slate-400 mb-2">Unable to load {config.title}</p>
          <p className="text-xs text-slate-500">{error}</p>
        </div>
      );
    }

    if (!latestNewsletter) {
      return (
        <div className="text-center py-4">
          <div className="w-12 h-12 bg-slate-700 rounded-full flex items-center justify-center mx-auto mb-3">
            <span className="text-lg">📭</span>
          </div>
          <p className="text-sm text-slate-400">No {config.title} archived yet</p>
        </div>
      );
    }

    return (
      <button
        onClick={handleNewsletterClick}
        className={`section-button w-full text-left px-2 py-2.5 ${COLORS.sectionBg} ${COLORS.sectionBgHover} transition-all duration-300 ease-in-out flex items-center justify-between group cursor-pointer rounded-b-none`}
      >
        <div className="flex items-center space-x-3">
          <div className={`w-3 h-3 rounded-full border-2 ${COLORS.unreadDot}`}></div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Latest Release</p>
            <h3 className={`text-md urbanist-semibold transition-colors ${COLORS.textHoverWhite} ${COLORS.textPrimary}`}>
              {formatDisplayDate(latestNewsletter.date)}
            </h3>
          </div>
        </div>
        <div className="text-xs text-slate-400">
          {animationData && isAnimating ? (
            <div className="brightness-[.9] contrast-[2.5]">
              <Lottie animationData={animationData} loop={false} autoplay className="w-8 h-8 " />
            </div>
          ) : (
            <div className="w-6 h-6 flex items-center justify-center opacity-50 transition-colors duration-300 ease-in-out group-hover:text-white">
              <span className="text-sm font-semibold text-violet-300 pulse-animation">Open</span>
            </div>
          )}
        </div>
      </button>
    );
  };

  const titleWords = config.title.trim().split(" ");
  const lastTitleWord = titleWords.length > 0 ? titleWords.pop() : "";
  const leadingTitle = titleWords.join(" ");

  return (
  <section className="inset-0 w-full h-full flex flex-col">
      <div className={`rounded-t-lg border-b pt-2 px-3 pb-1 text-white relative overflow-hidden ${COLORS.headerBg} border-transparent shrink-0`}>
        <div className="relative z-10 select-none">
          <div className="flex items-start justify-between gap-1 sm:gap-0">
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-1 mb-1">
                <h2 className="text-lg font-semibold urbanist-black whitespace-nowrap truncate">
                  {leadingTitle && (
                    <span className="text-amber-300">{leadingTitle} </span>
                  )}
                  <span className="text-white">{lastTitleWord}</span>
                </h2>
              </div>
              <p className="text-gray-400 text-xs urbanist-medium mb-0">{config.subtitle}</p>
            </div>
          </div>
        </div>
      </div>
      <div className={`rounded-b-xl shadow-xl overflow-hidden ${COLORS.containerBg} flex flex-col min-h-[130px]  text-overflow-x-hidden`}>
        <div className="flex-1 flex flex-col  overflow-hidden">
          <div className="flex-1 flex">
            <div className="w-full">
              {renderContent()}
            </div>
          </div>
        </div>
        <div className={`border-slate-200 dark:border-slate-700 py-1 px-3 rounded-b-xl relative overflow-hidden ${COLORS.footerBg} border-transparent`}
        >
          <div className="relative z-10 min-h-[60px] text-center">
            <p className="text-xs py-0 italic text-slate-600 dark:text-slate-400 urbanist-regular mx-auto select-none">
              {config.footer}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
