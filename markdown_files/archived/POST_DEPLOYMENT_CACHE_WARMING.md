# Post-Deployment Cache Warming

## The Problem
After each deployment, the first user waits 8-20 seconds while the cache warms up.

## Solutions (Pick One)

### ✅ Option 1: Manual Trigger (Simplest)
After each Vercel deployment, run this command:

```bash
curl https://newsletter-widget-sage.vercel.app/api/cron/refresh-newsletter \
  -H "Authorization: Bearer YOUR_CRON_SECRET"
```

**Takes 90 seconds → All subsequent users get instant loads!**

---

### 🤖 Option 2: Automatic via GitHub Actions (Best)

**Setup:**
1. Go to: https://github.com/CinnamonGrossCrunch/OskiHub/settings/secrets/actions
2. Add secrets:
   - `PRODUCTION_URL` = `https://newsletter-widget-sage.vercel.app`
   - `CRON_SECRET` = `your-cron-secret`
3. Push code with `.github/workflows/warm-cache.yml`

**Result:** Cache automatically warms after every successful deployment!

---

### ⚡ Option 3: Vercel Deploy Hook (Advanced)

**Setup:**
1. Vercel Dashboard → Settings → Git → Deploy Hooks
2. Create hook: "Cache Warmer"
3. Copy URL: `https://api.vercel.com/v1/integrations/deploy/...`
4. Add to `scripts/warm-cache.js` (already created)
5. Enable in `package.json`: `"postbuild": "node scripts/warm-cache.js"`

**Caveat:** Only works if newsletter exists at build time

---

## 📊 Comparison

| Option | Setup Time | Effectiveness | Recommendation |
|--------|-----------|---------------|----------------|
| **Manual** | 0 min | 100% | ⭐ Start here |
| **GitHub Action** | 5 min | 100% | ⭐⭐⭐ Best long-term |
| **Postbuild Hook** | 10 min | 50% (newsletter timing) | ❌ Skip |

---

## 🎯 Recommended Workflow

**Short term (today):**
- Use **Manual Trigger** after each deployment

**Long term (this weekend):**
- Set up **GitHub Action** for automatic cache warming

---

## Current Status

Your cron jobs still run automatically:
- 🌙 **Midnight (7 AM UTC)** - Warm calendar cache
- 📰 **Morning (3:10 PM UTC / 8:10 AM Pacific)** - Warm newsletter cache

So users visiting after 8:10 AM get instant loads anyway!

The post-deployment warming is just for **immediate testing after deployment**.
