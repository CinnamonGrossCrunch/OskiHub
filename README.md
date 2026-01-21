# OskiHub 🐻

**Your Haas daily dashboard: classes, events, and resources in one place.**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://oski.app)
[![Next.js 15.5](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| **Production** | https://www.oski.app |
| **GitHub Repo** | https://github.com/CinnamonGrossCrunch/OskiHub |
| **Vercel Dashboard** | https://vercel.com/matt-gross-projects-2589e68e/oskihub |
| **Vercel Project ID** | `prj_4PcZTaos2UlHV9bXLGlQEXlUINVC` |

---

## 🎯 The Story

OskiHub started with a simple frustration: **checking multiple calendars, newsletters, and websites just to figure out what's happening this week at Haas.**

As an EWMBA student, you're juggling:
- 📅 **6+ calendar feeds** (Microeconomics, Leading People, Data & Decisions, Marketing, Teams@Haas, bCourses)
- 📰 **Weekly newsletters** from the program office
- 🎓 **Campus events** (UC Launch, club fairs, guest speakers)
- 🏈 **Cal Bears home games** (because Go Bears!)
- 📚 **Resource links** scattered across Slack, email, and bookmarks

**The old way:** Open 8 tabs, cross-reference dates, manually compile what matters this week.

**The OskiHub way:** Open one URL. See everything. Get AI-powered weekly insights. Go live your life.

---

## ✨ Features

### 📊 Unified Dashboard
- **Cohort-aware calendar** - Automatically shows Blue or Gold cohort events
- **My Week AI Summary** - GPT-4o analyzes your upcoming week and highlights what matters
- **Smart event filtering** - Only shows events within your current week window
- **Newsletter integration** - Scrapes and parses weekly Bear Necessities newsletter

### 🗓️ Intelligent Calendar
- **Multi-source aggregation** - Combines 10+ ICS feeds into one view
- **Rich event details** - Shows class readings, assignment descriptions, due dates
- **Month grid view** - Visual calendar with event density heatmap
- **Campus Groups** - Discover EWMBA club events and networking opportunities

### 🔗 Quick Resources
- Direct links to bCourses, Slack, Zoom, Canvas, Gradescope
- One-click access to Haas services (IT, Career, Wellness)
- Berkeley essentials (Library, Gym, Parking, WiFi)

### 🤖 AI-Powered Insights
- Analyzes your week's workload and suggests priorities
- Identifies potential scheduling conflicts
- Highlights time-sensitive deadlines

---

## 🚀 Tech Stack

- **Framework**: Next.js 15.5 (App Router)
- **Language**: TypeScript 5.0
- **Styling**: Tailwind CSS
- **AI**: OpenAI GPT-4o-mini
- **Cache**: Upstash Redis KV + Static JSON fallback
- **Hosting**: Vercel (Edge Functions)
- **Email**: Resend (notifications)

---

## 🛠️ Development

### Prerequisites
- Node.js 22+
- npm

### Getting Started

```bash
# Clone the repository
git clone https://github.com/CinnamonGrossCrunch/OskiHub.git
cd OskiHub

# Install dependencies
npm install

# Create .env.local with required variables
cp .env.example .env.local

# Run development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the dashboard.

### Environment Variables

| Variable | Required | Purpose |
|----------|----------|---------|
| `OPENAI_API_KEY` | Yes | AI processing |
| `CRON_SECRET` | Yes | Cron job auth |
| `UPSTASH_REDIS_REST_URL` | Yes | KV cache |
| `UPSTASH_REDIS_REST_TOKEN` | Yes | KV cache |
| `RESEND_API_KEY` | No | Email notifications |
| `NOTIFICATION_EMAIL` | No | Alert recipient |

---

## 📦 Deployment

Deployment is automatic via Vercel on push to `main`:

```bash
# Push changes to production
git push origin main
```

The deployment pipeline:
1. Push to `main` branch
2. Vercel auto-builds and deploys
3. GitHub Action warms the cache post-deploy
4. Live at www.oski.app

---

## 📁 Project Structure

```
newsletter-widget/
├── app/
│   ├── api/              # API routes (unified-dashboard, cron, calendar)
│   ├── components/       # React components
│   └── page.tsx          # Main page (server component)
├── lib/
│   ├── cache.ts          # Hybrid KV + static cache
│   ├── scrape.ts         # Newsletter scraper
│   ├── icsUtils.ts       # ICS calendar parser
│   ├── openai-organizer.ts # Newsletter AI
│   └── my-week-analyzer.ts # Weekly summary AI
├── public/
│   ├── cache/            # Static cache JSON
│   └── *.ics             # Course calendars
└── vercel.json           # Cron schedules, function config
```

---

## 📝 License

Private project for UC Berkeley EWMBA students.

---

**Go Bears! 🐻💙💛**
