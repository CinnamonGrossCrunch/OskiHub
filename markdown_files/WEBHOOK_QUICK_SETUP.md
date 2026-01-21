# Quick Setup Guide: GitHub Webhook

## ✅ What's Done
- [x] API endpoint created at `/api/github-webhook`
- [x] Signature validation implemented (HMAC-SHA256)
- [x] Smart filtering for newsletter changes only
- [x] Health check endpoint available
- [x] Code deployed to production

## 🔧 What You Need to Do

### 1. Generate Webhook Secret (2 minutes)

Run this in PowerShell:
```powershell
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

**Copy the output** - you'll need it for steps 2 and 3.

### 2. Add Secret to Vercel (3 minutes)

1. Go to: https://vercel.com/cinnamongrosscrunch/newsletter-widget/settings/environment-variables
2. Click **Add New**
3. Fill in:
   - **Name**: `GITHUB_WEBHOOK_SECRET`
   - **Value**: [Paste the secret from step 1]
   - **Environment**: Select all three (Production, Preview, Development)
4. Click **Save**
5. **Redeploy** your project so the new env var takes effect

### 3. Configure GitHub Webhook (5 minutes)

1. Go to: https://github.com/CinnamonGrossCrunch/OskiHub/settings/hooks
2. Click **Add webhook**
3. Fill in:
   - **Payload URL**: `https://oski.app/api/github-webhook`
   - **Content type**: `application/json`
   - **Secret**: [Paste the same secret from step 1]
   - **Which events?**: Select **Just the push event**
   - **Active**: ✅ Checked
4. Click **Add webhook**

### 4. Verify It Works (2 minutes)

**Test 1: Health Check**
Visit: https://oski.app/api/github-webhook

You should see:
```json
{
  "status": "ok",
  "configured": {
    "hasSecret": true,    // ← Should be true
    "hasDeployHook": true // ← Should be true
  }
}
```

**Test 2: Real Push**
1. Edit any newsletter in `content/newsletters/`
2. Commit and push to GitHub
3. Go to GitHub webhook page (Recent Deliveries tab)
4. You should see a green checkmark ✅
5. Check Vercel - new deployment should trigger automatically

## ⚡ Total Setup Time: ~12 minutes

## 🎯 What This Gives You

**Before:**
1. Edit newsletter in Google Apps Script
2. Push to GitHub
3. Go to oski.app/admin/cache-refresh
4. Click "Sync Newsletters"
5. Wait for deployment

**After:**
1. Edit newsletter in Google Apps Script
2. Push to GitHub
3. ✅ **DONE!** (automatic deployment)

## 📚 Full Documentation
See [GITHUB_WEBHOOK_SETUP.md](./GITHUB_WEBHOOK_SETUP.md) for complete details, troubleshooting, and monitoring.

## 🆘 Troubleshooting

**Health check shows `hasSecret: false`**
→ Add GITHUB_WEBHOOK_SECRET to Vercel and redeploy

**Webhook shows "Invalid signature" in GitHub**
→ Ensure the secret matches in both GitHub and Vercel

**Webhook succeeds but no deployment**
→ Check VERCEL_DEPLOY_HOOK_URL is set correctly

**All pushes trigger deployment (not just newsletters)**
→ This is a bug - file an issue. Should only trigger for `content/newsletters/` changes
