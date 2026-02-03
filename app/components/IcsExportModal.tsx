'use client';

import { useState, useEffect } from 'react';
import { buildIcsSubscriptionUrl, type IcsFilterOptions } from '@/lib/icsGenerator';

interface IcsExportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface EventPreview {
  title: string;
  start: string;
  source?: string;
}

export default function IcsExportModal({ isOpen, onClose }: IcsExportModalProps) {
  const [filters, setFilters] = useState<IcsFilterOptions>({
    blueClasses: false,
    goldClasses: false,
    ucLaunch: false,
    calBears: false,
    campusGroups: false,
    newsletter: false,
    greekTheater: false,
    teamsAtHaas: false,
  });
  
  const [copied, setCopied] = useState(false);
  const [baseUrl, setBaseUrl] = useState('');
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});
  const [eventPreviews, setEventPreviews] = useState<Record<string, EventPreview[]>>({});
  const [loadingPreviews, setLoadingPreviews] = useState<Record<string, boolean>>({});

  useEffect(() => {
    // Get the current base URL
    if (typeof window !== 'undefined') {
      setBaseUrl(`${window.location.origin}/api/calendar/export.ics`);
    }
  }, []);

  const toggleFilter = (key: keyof IcsFilterOptions) => {
    setFilters(prev => ({ ...prev, [key]: !prev[key] }));
    setCopied(false); // Reset copied state when filters change
  };

  const selectAll = () => {
    setFilters({
      blueClasses: true,
      goldClasses: true,
      ucLaunch: true,
      calBears: true,
      campusGroups: true,
      newsletter: true,
      greekTheater: true,
      teamsAtHaas: true,
    });
    setCopied(false);
  };

  const clearAll = () => {
    setFilters({
      blueClasses: false,
      goldClasses: false,
      ucLaunch: false,
      calBears: false,
      campusGroups: false,
      newsletter: false,
      greekTheater: false,
      teamsAtHaas: false,
    });
    setCopied(false);
  };

  const subscriptionUrl = buildIcsSubscriptionUrl(baseUrl, filters);
  const hasAnyFilter = Object.values(filters).some(v => v === true);

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(subscriptionUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  const toggleSection = async (key: string, filterKey: keyof IcsFilterOptions) => {
    const isExpanding = !expandedSections[key];
    setExpandedSections(prev => ({ ...prev, [key]: isExpanding }));
    
    // Load events if expanding and not already loaded
    if (isExpanding && !eventPreviews[key]) {
      setLoadingPreviews(prev => ({ ...prev, [key]: true }));
      try {
        const response = await fetch(`${baseUrl}?${filterKey.replace('Classes', '').toLowerCase()}=1`);
        const icsContent = await response.text();
        
        // Parse ICS to extract event summaries
        const events: EventPreview[] = [];
        const lines = icsContent.split('\n');
        let currentEvent: Partial<EventPreview> = {};
        
        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed === 'BEGIN:VEVENT') {
            currentEvent = {};
          } else if (trimmed.startsWith('SUMMARY:')) {
            currentEvent.title = trimmed.substring(8).replace(/\\n/g, ' ').replace(/\\,/g, ',');
          } else if (trimmed.startsWith('DTSTART')) {
            const dateMatch = trimmed.match(/:([\dT]+)/);
            if (dateMatch) {
              const dateStr = dateMatch[1];
              if (dateStr.includes('T')) {
                // DateTime format
                currentEvent.start = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
              } else {
                // Date only format
                currentEvent.start = `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
              }
            }
          } else if (trimmed === 'END:VEVENT' && currentEvent.title) {
            events.push(currentEvent as EventPreview);
          }
        }
        
        // Sort by date and limit to 10 most recent/upcoming
        const sortedEvents = events
          .sort((a, b) => (a.start || '').localeCompare(b.start || ''))
          .slice(0, 10);
        
        setEventPreviews(prev => ({ ...prev, [key]: sortedEvents }));
      } catch (error) {
        console.error('Failed to load event preview:', error);
        setEventPreviews(prev => ({ ...prev, [key]: [] }));
      } finally {
        setLoadingPreviews(prev => ({ ...prev, [key]: false }));
      }
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-gradient-to-br from-slate-500/20 to-slate-500/20 backdrop-blur-xl rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 backdrop-blur-md px-6 py-4 rounded-t-xl flex items-center justify-between">
          <div className="flex items-center gap-3">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <h2 className="text-xl font-bold text-white">Subscribe to OskiHub Calendar</h2>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-slate-200 transition-colors"
            aria-label="Close modal"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-500/20 backdrop-blur-sm rounded-lg p-4">
            <h3 className="font-semibold text-blue-300 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
              </svg>
              How to Subscribe
            </h3>
            <ol className="text-sm text-slate-300 space-y-1 ml-1">
              <li>1. Select the event types you want below</li>
              <li>2. Copy the generated URL</li>
              <li>3. In Google Calendar: Settings → Add calendar → From URL</li>
              <li>4. Paste the URL and your calendar will auto-update!</li>
            </ol>
          </div>

          {/* Filter Selection */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-slate-200">Select Event Types</h3>
              <div className="flex gap-2">
                <button
                  onClick={selectAll}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={clearAll}
                  className="text-xs px-3 py-1 rounded bg-slate-700 hover:bg-slate-600 text-slate-200 transition-colors"
                >
                  Clear All
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {/* Blue Cohort */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.blueClasses}
                    onChange={() => toggleFilter('blueClasses')}
                    className="w-5 h-5 rounded text-green-600 focus:ring-green-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-green-600"></div>
                    <span className="text-slate-200 font-medium">Blue Cohort Classes</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('blue', 'blueClasses'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['blue'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['blue'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['blue'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['blue']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['blue'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Gold Cohort */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.goldClasses}
                    onChange={() => toggleFilter('goldClasses')}
                    className="w-5 h-5 rounded text-yellow-600 focus:ring-yellow-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
                    <span className="text-slate-200 font-medium">Gold Cohort Classes</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('gold', 'goldClasses'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['gold'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['gold'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['gold'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['gold']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['gold'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Cal Bears */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.calBears}
                    onChange={() => toggleFilter('calBears')}
                    className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-blue-600"></div>
                    <span className="text-slate-200 font-medium">Cal Bears Sports</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('calbears', 'calBears'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['calbears'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['calbears'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['calbears'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['calbears']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['calbears'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* UC Launch */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.ucLaunch}
                    onChange={() => toggleFilter('ucLaunch')}
                    className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                    <span className="text-slate-200 font-medium">UC Launch Events</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('uclaunch', 'ucLaunch'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['uclaunch'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['uclaunch'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['uclaunch'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['uclaunch']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['uclaunch'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Newsletter */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.newsletter}
                    onChange={() => toggleFilter('newsletter')}
                    className="w-5 h-5 rounded text-purple-600 focus:ring-purple-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-purple-600"></div>
                    <span className="text-slate-200 font-medium">Newsletter Events</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('newsletter', 'newsletter'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['newsletter'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['newsletter'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['newsletter'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['newsletter']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['newsletter'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Campus Groups */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.campusGroups}
                    onChange={() => toggleFilter('campusGroups')}
                    className="w-5 h-5 rounded text-blue-500 focus:ring-blue-400 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                    <span className="text-slate-200 font-medium">Campus Groups</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('campusgroups', 'campusGroups'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['campusgroups'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['campusgroups'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['campusgroups'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['campusgroups']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['campusgroups'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Greek Theater */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.greekTheater}
                    onChange={() => toggleFilter('greekTheater')}
                    className="w-5 h-5 rounded text-pink-600 focus:ring-pink-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-pink-600"></div>
                    <span className="text-slate-200 font-medium">Greek Theater Concerts</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('greektheater', 'greekTheater'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['greektheater'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['greektheater'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['greektheater'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['greektheater']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['greektheater'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>

              {/* Teams@Haas */}
              <div className="rounded-lg bg-slate-700/50 transition-colors">
                <label className="flex items-center gap-3 p-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.teamsAtHaas}
                    onChange={() => toggleFilter('teamsAtHaas')}
                    className="w-5 h-5 rounded text-violet-600 focus:ring-violet-500 focus:ring-offset-slate-800"
                  />
                  <div className="flex items-center gap-2 flex-1">
                    <div className="w-3 h-3 rounded-full bg-violet-600"></div>
                    <span className="text-slate-200 font-medium">Teams@Haas</span>
                  </div>
                  <button
                    onClick={(e) => { e.preventDefault(); toggleSection('teamsathaas', 'teamsAtHaas'); }}
                    className="text-slate-400 hover:text-slate-200 transition-colors"
                    aria-label="Toggle event preview"
                  >
                    <svg className={`w-5 h-5 transition-transform ${expandedSections['teamsathaas'] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </label>
                {expandedSections['teamsathaas'] && (
                  <div className="px-3 pb-3 text-sm">
                    {loadingPreviews['teamsathaas'] ? (
                      <div className="text-slate-400 italic">Loading events...</div>
                    ) : eventPreviews['teamsathaas']?.length > 0 ? (
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {eventPreviews['teamsathaas'].map((event, idx) => (
                          <div key={idx} className="flex justify-between text-slate-300 py-1">
                            <span className="truncate flex-1 pr-2">{event.title}</span>
                            <span className="text-slate-400 text-xs whitespace-nowrap">{formatDate(event.start)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="text-slate-400 italic">No events found</div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Generated URL */}
          {hasAnyFilter && (
            <div className="space-y-3">
              <h3 className="font-semibold text-slate-200">Your Subscription URL</h3>
              <div className="relative">
                <label htmlFor="subscription-url" className="sr-only">Calendar subscription URL</label>
                <input
                  id="subscription-url"
                  type="text"
                  value={subscriptionUrl}
                  readOnly
                  placeholder="Select event types to generate URL"
                  className="w-full px-4 py-3 pr-24 bg-slate-700 rounded-lg text-slate-200 text-sm font-mono focus:outline-none"
                />
                <button
                  onClick={copyToClipboard}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 px-4 py-1.5 rounded-md font-medium text-sm transition-all ${
                    copied 
                      ? 'bg-green-600 text-white' 
                      : 'bg-blue-600 hover:bg-blue-700 text-white'
                  }`}
                >
                  {copied ? (
                    <span className="flex items-center gap-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      Copied!
                    </span>
                  ) : (
                    'Copy'
                  )}
                </button>
              </div>
              
              {/* Quick Actions */}
              <div className="flex flex-wrap gap-2">
                <a
                  href={subscriptionUrl}
                  download="oskihub-calendar.ics"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download .ics File
                </a>
                <button
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors text-sm font-medium"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy URL for Calendar App
                </button>
              </div>
            </div>
          )}

          {!hasAnyFilter && (
            <div className="text-center py-8 text-slate-400">
              <svg className="w-16 h-16 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-lg">Select at least one event type to generate your calendar feed</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-slate-500/20 backdrop-blur-md px-6 py-4 rounded-b-xl flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-colors font-medium"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
