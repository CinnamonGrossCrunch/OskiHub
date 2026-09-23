# OskiHub 🐻

**Your Haas daily dashboard: classes, events, and resources in one place.**

[![Deployed on Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black)](https://oski.app)
[![Next.js 15.5](https://img.shields.io/badge/Next.js-15.5-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)](https://www.typescriptlang.org/)

> **Latest Update:** September 2026 - Fall 2026 course calendars (EW200C/204/209) + newsletter failure-spam filter

---

## 🔗 Links

| Resource | URL |
|----------|-----|
| **Production** | https://www.oski.app |
| **GitHub Repo** | https://github.com/CinnamonGrossCrunch/OskiHub |
| **Vercel Dashboard** | https://vercel.com/matt-gross-projects-2589e68e/oskihub |

---

## 🎯 What It Does

OskiHub aggregates everything an EWMBA student needs:

| Feature | Description |
|---------|-------------|
| **Unified Calendar** | Combines 10+ ICS feeds (courses, Teams@Haas, Cal Bears, UC Launch) |
| **Newsletter Integration** | Scrapes Bear Necessities + auto-ingests Blue Crew Review & EW Wire from Gmail |
| **My Week AI Summary** | GPT-4o analyzes your week and highlights priorities |
| **Cohort Switching** | Toggle between Blue/Gold cohort schedules |
| **Quick Resources** | Direct links to bCourses, Slack, Zoom, Gradescope |

---

## 🚀 Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 15.5 (App Router) |
| Language | TypeScript 5.0 |
| Styling | Tailwind CSS 4 |
| AI | OpenAI GPT-4o-mini |
| Cache | Upstash Redis KV + Static JSON fallback |
| Hosting | Vercel (Serverless Functions) |
| Email | Resend |

---

## 🛠️ Quick Start

```bash
git clone https://github.com/CinnamonGrossCrunch/OskiHub.git
cd OskiHub
npm install
cp .env.example .env.local  # Then fill in required vars
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `OPENAI_API_KEY` | AI newsletter processing |
| `CRON_SECRET` | Cron job authentication |
| `UPSTASH_REDIS_REST_URL` | KV cache URL |
| `UPSTASH_REDIS_REST_TOKEN` | KV cache token |
| `GITHUB_WEBHOOK_SECRET` | Webhook signature validation |
| `VERCEL_DEPLOY_HOOK_URL` | Trigger Vercel redeploy |

See [`markdown_files/ENV_SETUP.md`](markdown_files/ENV_SETUP.md) for detailed setup instructions.

---

## 📦 Deployment

Push to `main` → Vercel auto-deploys → `warm-cache.yml` pre-warms cache

```bash
npm run build        # Verify build passes
git push origin main # Auto-deploys to production
```

---

## 📁 Project Structure

```
newsletter-widget/
├── app/
│   ├── api/
│   │   ├── unified-dashboard/   # Main data endpoint
│   │   ├── cron/                # Vercel cron handlers
│   │   ├── gmail-newsletters/   # Gmail-sourced newsletters
│   │   └── github-webhook/      # GitHub push → Vercel redeploy
│   ├── components/              # React components
│   └── page.tsx                 # Entry point
├── lib/
│   ├── cache.ts                 # Hybrid KV + static cache
│   ├── scrape.ts                # Mailchimp newsletter scraper
│   ├── aiClient.ts              # OpenAI with model fallback
│   ├── icsUtils.ts              # ICS calendar parser
│   ├── date-utils.ts            # Berkeley timezone handling
│   └── my-week-analyzer.ts      # AI weekly summary
├── content/newsletters/         # Gmail-ingested newsletters
├── public/*.ics                 # Course calendars
├── scripts/                     # Google Apps Scripts (reference)
└── markdown_files/              # Setup guides & documentation
```

---

## 📚 Documentation

| Guide | Description |
|-------|-------------|
| [`.github/copilot-instructions.md`](.github/copilot-instructions.md) | **AI coding agent instructions** - architecture, patterns, debugging |
| [`markdown_files/ENV_SETUP.md`](markdown_files/ENV_SETUP.md) | Environment variable configuration |
| [`markdown_files/CACHE_SETUP_GUIDE.md`](markdown_files/CACHE_SETUP_GUIDE.md) | Upstash Redis setup |
| [`markdown_files/GITHUB_WEBHOOK_SETUP.md`](markdown_files/GITHUB_WEBHOOK_SETUP.md) | GitHub webhook configuration |
| [`markdown_files/ICS_CALENDAR_GUIDE.md`](markdown_files/ICS_CALENDAR_GUIDE.md) | Adding/troubleshooting calendars |
| [`markdown_files/NEWSLETTER_SYNC_SETUP.md`](markdown_files/NEWSLETTER_SYNC_SETUP.md) | Gmail newsletter pipeline |
| [`scripts/GMAIL_DISPATCHER_SETUP.md`](scripts/GMAIL_DISPATCHER_SETUP.md) | Google Apps Script setup |

---

## 📝 License

Private project for UC Berkeley EWMBA students.

---

**Go Bears! 🐻💙💛**
