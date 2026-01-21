# GitHub Action Setup Guide

## ✅ Step 1: Add GitHub Secrets

You need to add 2 secrets to your GitHub repository:

### 1. Go to GitHub Secrets Page
Open this URL in your browser:
```
https://github.com/CinnamonGrossCrunch/OskiHub/settings/secrets/actions
```

### 2. Click "New repository secret"

### 3. Add Secret #1: PRODUCTION_URL
```
Name: PRODUCTION_URL
Secret: https://www.oski.app
```
Click "Add secret"

### 4. Add Secret #2: CRON_SECRET
```
Name: CRON_SECRET
Secret: b5f6eb7aef6326b4881fdc9e48f9ec367bf45b41354bdc44e83caf8359ebfd52
```
Click "Add secret"

---

## ✅ Step 2: Test the Action (Optional)

### Manual Test:
1. Go to: https://github.com/CinnamonGrossCrunch/OskiHub/actions
2. Click on "Warm Cache After Deployment" workflow
3. Click "Run workflow" button (dropdown)
4. Leave URL empty (uses production URL)
5. Click green "Run workflow" button

### Expected Result:
- Action runs for ~90 seconds
- Shows: ✅ Cache warmed successfully!
- Your production site now has instant loads

---

## ✅ Step 3: Verify It Works

After the action completes, visit your site:
```
https://newsletter-widget-sage.vercel.app
```

**Should load in ~100-300ms!** ⚡

---

## 🎯 How It Works Going Forward

**Every time you deploy to Vercel:**
1. Code pushes to GitHub
2. Vercel builds and deploys
3. GitHub Action automatically triggers
4. Cache warms in background (~90s)
5. All users get instant loads!

**No manual intervention needed!** 🎉

---

## 📊 Monitoring

View action runs:
```
https://github.com/CinnamonGrossCrunch/OskiHub/actions/workflows/warm-cache.yml
```

---

## 🔧 Troubleshooting

**Action fails with 401 Unauthorized:**
- Check `CRON_SECRET` matches Vercel environment variable

**Action fails with 404:**
- Check `PRODUCTION_URL` is correct
- Verify deployment finished before action ran

**Action timeout:**
- Normal if newsletter scraping takes >180s
- Cache will warm on first user visit

---

## ✅ Quick Setup Checklist

- [ ] Add `PRODUCTION_URL` secret to GitHub
- [ ] Add `CRON_SECRET` secret to GitHub  
- [ ] Test workflow manually (optional)
- [ ] Verify cache warming works
- [ ] Done! Future deployments auto-warm cache

**Time to complete: 2 minutes** ⏱️
