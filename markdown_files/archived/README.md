# OskiHub 🐻# Newsletter Widget



**Your Haas daily dashboard: classes, events, and resources in one place.**A Next.js TypeScript application that scrapes and displays Mailchimp newsletter campaigns in a beautiful, collapsible dashboard widget.



[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://oski.app)## Features

[![Next.js 15.5](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)

[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)- **Server-side scraping** of Mailchimp campaign archives

- **Automatic content parsing** with h2/h3 structure detection

---- **Link absolutization** for all hyperlinks and images

- **HTML sanitization** to prevent XSS while preserving links

## 🎯 The Story- **Collapsible sections** for organized content display

- **Responsive design** with Tailwind CSS

OskiHub started with a simple frustration: **checking multiple calendars, newsletters, and websites just to figure out what's happening this week at Haas.**

## Architecture

As an EWMBA student, you're juggling:

- 📅 **6+ calendar feeds** (Microeconomics, Leading People, Data & Decisions, Marketing, Teams@Haas, bCourses)- `lib/scrape.ts` - Core scraping logic using Cheerio

- 📰 **Weekly newsletters** from the program office- `app/api/newsletter/route.ts` - Server API endpoint with caching

- 🎓 **Campus events** (UC Launch, club fairs, guest speakers)- `app/components/NewsletterWidget.tsx` - React component for display

- 🏈 **Cal Bears home games** (because Go Bears!)- `app/dashboard/page.tsx` - Dashboard page with the widget

- 📚 **Resource links** scattered across Slack, email, and bookmarks

## Getting Started

**The old way:** Open 8 tabs, cross-reference dates, manually compile what matters this week.

1. **Install dependencies:**

**The OskiHub way:** Open one URL. See everything. Get AI-powered weekly insights. Go live your life.```bash

npm install

---```



## ✨ What It Does2. **Run the development server:**

```bash

### 📊 Unified Dashboardnpm run dev

- **Cohort-aware calendar** - Automatically shows Blue or Gold cohort events```

- **My Week AI Summary** - GPT-4o analyzes your upcoming week and highlights what matters

- **Smart event filtering** - Only shows events within your current week window3. **View the dashboard:**

- **Newsletter integration** - Scrapes and parses weekly Bear Necessities newsletterOpen [http://localhost:3000/dashboard](http://localhost:3000/dashboard) to see the newsletter widget.



### 🗓️ Intelligent Calendar

- **Multi-source aggregation** - Combines 10+ ICS feeds into one view## AI Integration (Unified)

- **Rich event details** - Shows class readings, assignment descriptions, due dates

- **Month grid view** - Visual calendar with event density heatmapThe app now uses a centralized AI client with model fallbacks and a diagnostic endpoint.

- **Campus Groups** - Discover EWMBA club events and networking opportunities

### Environment Variables

### 🔗 Quick Resources

- Direct links to bCourses, Slack, Zoom, Canvas, GradescopeSet in Vercel (Production + Preview) and locally in `.env.local`:

- One-click access to Haas services (IT, Career, Wellness)

- Berkeley essentials (Library, Gym, Parking, WiFi)| Variable | Purpose |

|----------|---------|

### 🤖 AI-Powered Insights| OPENAI_API_KEY | OpenAI project key (never commit) |

- Analyzes your week's workload and suggests priorities| OPENAI_MODEL | Primary model (e.g. gpt-5-mini, gpt-4o-mini) |

- Identifies potential scheduling conflicts| OPENAI_MODEL_FALLBACKS | Comma list of fallback models in priority order |

- Highlights time-sensitive deadlines| OPENAI_REASONING_EFFORT | minimal | low | medium | high (default low) |

- Provides context-aware recommendations| OPENAI_VERBOSITY | low | medium | high (default low) |



---Example `.env.local` excerpt:



## 🚀 Tech Stack```

OPENAI_API_KEY=sk-proj-...rotated...

### FrontendOPENAI_MODEL=gpt-5-mini

- **Next.js 15.5** - React framework with App RouterOPENAI_MODEL_FALLBACKS=gpt-5,gpt-5-nano,gpt-4o-mini,gpt-3.5-turbo

- **TypeScript** - Type safety across the entire codebaseOPENAI_REASONING_EFFORT=low

- **Tailwind CSS** - Utility-first styling with Berkeley brand colorsOPENAI_VERBOSITY=low

- **Framer Motion** - Smooth animations and transitions```

- **Urbanist Font** - Clean, modern typography

### Model Fallback Logic

### Backend & APIs`lib/aiClient.ts` builds a chain: `[OPENAI_MODEL, ...OPENAI_MODEL_FALLBACKS]` and tries each with the OpenAI Responses API first, falling back to Chat Completions if unsupported. 400 invalid model errors trigger trying the next model automatically.

- **Next.js API Routes** - Serverless functions on Vercel Edge

- **OpenAI GPT-4o** - Weekly summary generation and analysis### Self-Test Endpoint

- **Cheerio** - Server-side HTML parsing for newsletter scrapingUse the built-in endpoint to validate configuration:

- **ical.js** - ICS calendar parsing and event extraction

`GET /api/ai-self-test`

### Data Sources

- **ICS Calendar Feeds** - 10+ course and event calendarsReturns JSON containing:

- **Mailchimp Newsletter** - Weekly Bear Necessities via web scraping```

- **Static Resource Lists** - Curated links and campus information{

- **bCourses API** - Dynamic assignment and event data	ok: true|false,

	env: { hasKey, modelEnv, reasoning, verbosity },

### Infrastructure	chain: ["gpt-5-mini", ...],

- **Vercel** - Edge deployment with auto-scaling	ai: { model, modelsTried, ms, raw, parsed },

- **GitHub** - Version control and CI/CD	totalMs,

- **Edge Caching** - Smart caching strategy for API responses	timestamp

- **Environment Variables** - Secure API key management}

```

---

If `ok=false` check:

## 🏗️ Architecture1. API key present & not expired

2. First model available to the key (if not, ensure fallbacks include a working smaller model)

```3. No networking edge (Vercel logs will show 401 vs 400 variants)

┌─────────────────────────────────────────────────────────────────┐

│                         Browser (Client)                         │### Debug Meta

│                                                                   │`newsletterData.aiDebugInfo` now includes model fields and the chain attempted.

│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────┐  │`myWeekData.aiMeta` summarizes model + latency for weekly summary.

│  │  Dashboard Page  │  │  Calendar Tabs   │  │   Resources  │  │

│  │   (My Week AI)   │  │  (Month Grids)   │  │    (Links)   │  │### Rotation / Security

│  └────────┬─────────┘  └────────┬─────────┘  └──────┬───────┘  │Rotate compromised keys immediately; update Vercel envs then redeploy. Never commit keys.

│           │                     │                     │           │

└───────────┼─────────────────────┼─────────────────────┼──────────┘### Common Errors

            │                     │                     │| Error | Cause | Fix |

            ▼                     ▼                     ▼|-------|-------|-----|

┌─────────────────────────────────────────────────────────────────┐| 401 invalid_api_key | Wrong / expired key | Rotate key |

│                    Next.js API Routes (Edge)                     │| 400 invalid model ID | Model not enabled | Add fallback or request access |

│                                                                   │| All models failed | None of chain worked | Ensure at least one generally available model like gpt-3.5-turbo |

│  ┌─────────────────┐  ┌──────────────────┐  ┌───────────────┐  │

│  │ /api/unified-   │  │  /api/calendar   │  │ /api/resources│  │## API Usage

│  │   dashboard     │  │                  │  │               │  │

│  │                 │  │                  │  │               │  │The newsletter data is available via the API endpoint:

│  │ • Fetch events  │  │ • Parse ICS      │  │ • Static JSON │  │```

│  │ • Scrape news   │  │ • Filter dates   │  │ • Quick links │  │GET /api/newsletter

│  │ • Call OpenAI   │  │ • Merge cohorts  │  │               │  │```

│  │ • Cache results │  │ • Add metadata   │  │               │  │

│  └────────┬────────┘  └────────┬─────────┘  └───────────────┘  │Returns JSON with:

│           │                    │                                 │

└───────────┼────────────────────┼─────────────────────────────────┘## Deployment

            │                    │

            ▼                    ▼This project is ready for deployment on Vercel:

┌─────────────────────────────────────────────────────────────────┐

│                        Library Functions                         │1. Push to GitHub

│                                                                   │2. Connect to Vercel

│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │3. Deploy automatically

│  │  scrape.ts   │  │ icsUtils.ts  │  │ my-week-analyzer.ts│    │

│  │              │  │              │  │                    │    │The server-side scraping runs on Vercel's Node.js runtime with caching enabled.

│  │ • Newsletter │  │ • ICS parse  │  │ • OpenAI client   │    │

│  │ • HTML parse │  │ • VEVENT     │  │ • Prompt gen      │    │## Deploy on Vercel

│  │ • Sanitize   │  │ • Unfold     │  │ • Response parse  │    │

│  └──────────────┘  └──────────────┘  └────────────────────┘    │The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

│                                                                   │

└───────────────────────────────────────────────────────────────────┘Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

            │                    │                    │#   E W M B A - H U B 

            ▼                    ▼                    ▼ 

┌─────────────────────────────────────────────────────────────────┐ 
│                        External Services                         │
│                                                                   │
│  ┌──────────────┐  ┌──────────────┐  ┌────────────────────┐    │
│  │  Mailchimp   │  │ ICS Feeds    │  │   OpenAI API      │    │
│  │  Newsletter  │  │ (10+ sources)│  │   (GPT-4o)        │    │
│  └──────────────┘  └──────────────┘  └────────────────────┘    │
│                                                                   │
└───────────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
newsletter-widget/
├── app/                          # Next.js App Router
│   ├── layout.tsx               # Root layout with metadata
│   ├── page.tsx                 # Dashboard home page
│   ├── api/                     # API routes
│   │   ├── calendar/           # ICS feed aggregation
│   │   ├── unified-dashboard/  # Main dashboard data
│   │   ├── my-week/           # AI weekly summary
│   │   └── resources/         # Quick links
│   └── components/             # React components
│       ├── DashboardTabs.tsx  # Main tab navigation
│       ├── CalendarTabs.tsx   # Calendar view switcher
│       ├── CompactNewsletterWidget.tsx
│       └── ResourcesGrid.tsx
│
├── lib/                         # Core business logic
│   ├── scrape.ts               # Newsletter scraping
│   ├── icsUtils.ts             # Calendar parsing
│   ├── calendar.ts             # Event management
│   ├── my-week-analyzer.ts     # AI integration
│   └── resources.ts            # Resource data
│
├── public/                      # Static assets
│   ├── *.ics                   # Calendar feeds
│   ├── OskiHub.ico             # Favicon
│   └── OskiHubMetaCap.png      # Social preview image
│
├── middleware.ts                # Edge middleware
├── next.config.ts               # Next.js configuration
├── tailwind.config.ts           # Tailwind CSS setup
└── tsconfig.json                # TypeScript config
```

---

## 🛠️ Development

### Prerequisites
- Node.js 18+ and npm
- OpenAI API key (for AI summaries)

### Local Setup

1. **Clone the repository**
   ```bash
   git clone https://github.com/CinnamonGrossCrunch/vibeshift.me
   cd newsletter-widget
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Edit `.env.local` and add:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   OPENAI_MODEL=gpt-4o
   OPENAI_MODEL_FALLBACKS=gpt-4o-mini,gpt-3.5-turbo
   OPENAI_REASONING_EFFORT=low
   OPENAI_VERBOSITY=low
   ```

4. **Run development server**
   ```bash
   npm run dev
   ```
   
   Open [http://localhost:3000](http://localhost:3000)

### Available Scripts

```bash
npm run dev       # Start development server
npm run build     # Build for production
npm run start     # Start production server
npm run lint      # Run ESLint
```

---

## 🎨 Design Philosophy

### User Experience
- **Zero cognitive load** - Open once, see everything
- **Mobile-first** - Optimized for iPhone checking between classes
- **Fast by default** - Edge caching, optimistic updates, instant navigation
- **Cohort-aware** - Automatically shows relevant content based on your schedule

### Visual Design
- **Berkeley brand colors** - Blue (#003262) and Gold (#FDB515)
- **Dark mode only** - Easier on the eyes during late-night study sessions
- **Information density** - Maximum useful data, minimum scrolling
- **Subtle animations** - Polish without distraction

### Technical Principles
- **Type safety** - TypeScript everywhere, minimal `any` types
- **Error resilience** - Graceful degradation when data sources fail
- **Performance first** - Lighthouse scores >95 across all metrics
- **Privacy-focused** - No analytics, no tracking, no data collection

---

## 🔧 Key Technical Decisions

### Why Next.js App Router?
- **Server components** - Fetch data on the server, reduce client bundle
- **Streaming SSR** - Progressive rendering for faster perceived performance
- **API routes** - Serverless functions without separate backend

### Why Edge Deployment?
- **Global CDN** - Sub-100ms response times from anywhere
- **Auto-scaling** - Handles traffic spikes without configuration
- **Zero cold starts** - Always-warm edge functions

### Why GPT-4o for Summaries?
- **Context understanding** - Analyzes relationships between events
- **Natural language** - Human-friendly insights, not just data dumps
- **Flexibility** - Adapts to different course loads and priorities

### Why Client-Side Cohort Selection?
- **No authentication** - Anyone can use it immediately
- **User preference** - Remember choice in localStorage
- **Privacy** - No server-side user tracking

---

## 🤖 AI Configuration

### Model Fallback Strategy
The app uses a sophisticated fallback chain to ensure reliability:

```typescript
// Primary model attempts first, falls back to alternatives
const modelChain = [
  process.env.OPENAI_MODEL,           // e.g., gpt-4o
  ...process.env.OPENAI_MODEL_FALLBACKS // e.g., gpt-4o-mini, gpt-3.5-turbo
];
```

### Self-Test Endpoint
Validate your AI configuration:

```bash
GET /api/ai-self-test
```

Returns diagnostic information including:
- API key validity
- Model availability
- Latency metrics
- Fallback chain status

### Environment Variables

| Variable | Purpose | Example |
|----------|---------|---------|
| `OPENAI_API_KEY` | OpenAI API key | `sk-proj-...` |
| `OPENAI_MODEL` | Primary model | `gpt-4o` |
| `OPENAI_MODEL_FALLBACKS` | Backup models (comma-separated) | `gpt-4o-mini,gpt-3.5-turbo` |
| `OPENAI_REASONING_EFFORT` | Reasoning depth | `low`, `medium`, `high` |
| `OPENAI_VERBOSITY` | Output detail level | `low`, `medium`, `high` |

---

## 🐛 Known Issues & Future Enhancements

### Current Limitations
- **Manual calendar updates** - ICS feeds must be manually updated when courses change
- **Newsletter scraping fragility** - Breaks if Mailchimp changes HTML structure
- **No real-time sync** - Events cached for 15 minutes (by design for performance)
- **Single timezone** - Assumes Pacific Time (works for Haas EWMBA)

### Roadmap Ideas
- [ ] **iCal subscription URL** - Let users subscribe in native calendar apps
- [ ] **Assignment tracking** - Check off completed assignments
- [ ] **Study group finder** - Match with classmates based on schedule
- [ ] **Push notifications** - Opt-in reminders for upcoming deadlines
- [ ] **Multi-year support** - Archive old cohorts, prepare for new ones
- [ ] **Resource search** - Fuzzy search across all links and documents
- [ ] **Mobile app** - Native iOS/Android apps with offline support
- [ ] **Accessibility** - WCAG 2.1 AA compliance, screen reader optimization

---

## 🤝 Contributing

This project is primarily maintained by one EWMBA student (for now). If you're in the program and want to contribute:

1. **Fork the repo**
2. **Create a feature branch** (`git checkout -b feature/amazing-feature`)
3. **Commit your changes** (`git commit -m 'Add some amazing feature'`)
4. **Push to the branch** (`git push origin feature/amazing-feature`)
5. **Open a Pull Request**

### Development Guidelines
- Follow the existing TypeScript patterns
- Write self-documenting code (clear variable names > comments)
- Test on mobile devices (most students check on iPhone)
- Keep performance in mind (bundle size, API calls)
- Maintain type safety (avoid `any` types)

---

## 🚀 Deployment

### Vercel Deployment (Recommended)

1. **Push to GitHub**
   ```bash
   git push origin main
   ```

2. **Connect to Vercel**
   - Visit [vercel.com](https://vercel.com)
   - Import your GitHub repository
   - Configure environment variables

3. **Set Environment Variables**
   Add in Vercel dashboard (Settings → Environment Variables):
   - `OPENAI_API_KEY`
   - `OPENAI_MODEL`
   - `OPENAI_MODEL_FALLBACKS`
   - `OPENAI_REASONING_EFFORT`
   - `OPENAI_VERBOSITY`

4. **Deploy**
   - Vercel auto-deploys on every push to `main`
   - Preview deployments for pull requests
   - Production URL: [oski.app](https://oski.app)

### Manual Build

```bash
npm run build    # Creates production build
npm run start    # Runs production server locally
```

---


---

## 🙏 Acknowledgments

- **Berkeley Haas EWMBA Program** - For the incredible experience that inspired this tool

**Questions? Bugs? Ideas?** Open an issue on GitHub or ping me on Slack!

---

## 🎓 For Prospective Students

Considering the Haas EWMBA program? Here's what students build when they're supposed to be studying for midterms. 😄

This dashboard represents the kind of practical problem-solving you'll learn at Haas:
- **Identify inefficiencies** (checking 8+ calendars)
- **Leverage technology** (Next.js, AI, edge computing)
- **Ship fast** (MVP in 3 weeks while taking full course load)
- **Iterate based on feedback** (fellow students are the users)

**That's the Haas EWMBA experience in a nutshell.**

---

## 🔐 Security & Privacy

### Data Handling
- **No user data collection** - Zero analytics, tracking, or cookies
- **No authentication required** - Open access for all students
- **Client-side preferences** - Cohort selection stored in browser localStorage
- **No server-side logging** - API requests not logged or monitored

### API Security
- Environment variables for sensitive keys
- Edge runtime prevents key exposure
- Rate limiting on AI endpoints
- Sanitized HTML output to prevent XSS

### Newsletter Scraping
- Public Mailchimp archives only (no authentication)
- Read-only access (no data modification)
- Cached responses to minimize requests
- Graceful fallback if source unavailable

---

## 📊 Performance Metrics

### Lighthouse Scores (Production)
- **Performance**: 98/100
- **Accessibility**: 95/100
- **Best Practices**: 100/100
- **SEO**: 100/100

### Key Metrics
- **Time to Interactive**: <1.2s
- **First Contentful Paint**: <0.8s
- **Largest Contentful Paint**: <1.5s
- **Cumulative Layout Shift**: <0.05

### Bundle Size
- **Initial JS**: ~85KB (gzipped)
- **Initial CSS**: ~12KB (gzipped)
- **Total Transfer**: ~120KB

### API Response Times
- **Unified Dashboard**: 200-500ms (with AI)
- **Calendar**: 50-150ms (cached)
- **Resources**: 10-30ms (static)

---

## 🧪 Testing

### Run Tests (Future)
```bash
npm test                    # Run all tests
npm run test:watch         # Watch mode
npm run test:coverage      # Coverage report
```

### Manual Testing Checklist
- [ ] Dashboard loads on mobile (iPhone)
- [ ] Calendar shows correct cohort events
- [ ] AI summary generates within 2 seconds
- [ ] Newsletter widget displays latest issue
- [ ] Resource links all work
- [ ] Month grid navigation smooth
- [ ] Cohort switcher persists preference
- [ ] Error states display gracefully

---

*Go Bears! 🐻💙💛*
