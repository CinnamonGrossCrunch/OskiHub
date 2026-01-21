# GitHub Webhook Setup for Automatic Newsletter Sync

## Overview
This webhook automatically triggers a Vercel redeployment whenever new newsletters are pushed to the GitHub repository, eliminating the need for manual synchronization.

## Architecture
```
GitHub Push → Webhook → Signature Validation → Newsletter Change Detection → Vercel Deployment
```

## Setup Instructions

### Step 1: Generate Webhook Secret

Generate a secure random secret for webhook signing:

```bash
# On Mac/Linux:
openssl rand -hex 32

# On Windows (PowerShell):
[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))
```

Save this secret - you'll need it for both GitHub and Vercel.

### Step 2: Add Environment Variables to Vercel

1. Go to your Vercel project: https://vercel.com/your-team/your-project
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variable:

**GITHUB_WEBHOOK_SECRET**
- **Value**: The secret you generated in Step 1
- **Environment**: Production, Preview, Development (all three)
- **Save**

**Note**: `VERCEL_DEPLOY_HOOK_URL` should already be configured from the manual sync button setup. If not, add it from Settings → Git → Deploy Hooks.

### Step 3: Configure GitHub Webhook

1. Go to your GitHub repository: https://github.com/CinnamonGrossCrunch/OskiHub
2. Navigate to **Settings** → **Webhooks** → **Add webhook**
3. Configure the webhook:

**Payload URL**
```
https://oski.app/api/github-webhook
```

**Content type**
```
application/json
```

**Secret**
```
[Paste the secret from Step 1]
```

**Which events would you like to trigger this webhook?**
- Select: **Just the push event**

**Active**
- ✅ Checked

4. Click **Add webhook**

### Step 4: Verify Setup

#### Test the Health Check Endpoint
Visit: https://oski.app/api/github-webhook

You should see:
```json
{
  "status": "ok",
  "endpoint": "github-webhook",
  "purpose": "Automatic newsletter sync on GitHub push events",
  "configured": {
    "hasSecret": true,
    "hasDeployHook": true
  }
}
```

Both `hasSecret` and `hasDeployHook` should be `true`.

#### Test with a Real Push
1. Make a small change to any newsletter file in `content/newsletters/`
2. Commit and push to GitHub:
   ```bash
   git add content/newsletters/test.md
   git commit -m "Test webhook trigger"
   git push origin main
   ```
3. Check GitHub webhook delivery:
   - Go to GitHub → Settings → Webhooks
   - Click on your webhook
   - Click **Recent Deliveries**
   - You should see a successful delivery (green checkmark)
   - Response should show:
     ```json
     {
       "success": true,
       "message": "Newsletter sync deployment triggered"
     }
     ```

4. Check Vercel deployment:
   - Go to Vercel dashboard
   - You should see a new deployment triggered
   - Deployment comment should indicate it was triggered via deploy hook

## How It Works

### Webhook Flow
1. **GitHub Push Event**: Developer pushes newsletter changes to repository
2. **Signature Validation**: Webhook verifies request is from GitHub using HMAC-SHA256
3. **Change Detection**: Checks if any files in `content/newsletters/` were modified
4. **Deployment Trigger**: If newsletter changes detected, calls Vercel deploy hook
5. **Response**: Returns deployment status to GitHub

### Security Features
- **HMAC-SHA256 Signature Validation**: Ensures webhook is from GitHub
- **Event Filtering**: Only processes push events
- **Path Filtering**: Only triggers deployment for newsletter directory changes
- **Environment Validation**: Checks for required environment variables

### Smart Filtering
The webhook only triggers deployments when:
- ✅ Event type is `push`
- ✅ Changes include files in `content/newsletters/` directory
- ❌ Ignores changes to other files (code, docs, images, etc.)

This prevents unnecessary deployments and saves build minutes.

## Monitoring & Debugging

### Check Webhook Deliveries (GitHub)
1. Go to GitHub → Settings → Webhooks
2. Click on your webhook
3. Click **Recent Deliveries**
4. View request/response for each delivery
5. Click **Redeliver** to retry failed deliveries

### Check Vercel Deployment Logs
1. Go to Vercel dashboard
2. Click on deployment
3. View **Build Logs** for deployment details
4. Look for "Triggered via Deploy Hook" indicator

### Common Issues

**Issue**: Webhook shows "Invalid signature"
- **Solution**: Ensure GITHUB_WEBHOOK_SECRET matches in both GitHub and Vercel

**Issue**: Webhook succeeds but no deployment
- **Solution**: Check that VERCEL_DEPLOY_HOOK_URL is configured correctly

**Issue**: All pushes trigger deployment
- **Solution**: Verify change detection logic is checking `content/newsletters/` path

**Issue**: Health check shows `hasSecret: false` or `hasDeployHook: false`
- **Solution**: Add missing environment variables to Vercel and redeploy

## Example Webhook Payload

Successful newsletter sync:
```json
{
  "success": true,
  "message": "Newsletter sync deployment triggered",
  "deployment": {
    "jobId": "xyz123",
    "state": "PENDING"
  },
  "webhook": {
    "event": "push",
    "ref": "refs/heads/main",
    "commits": 1,
    "pusher": "YourGitHubUsername",
    "repository": "CinnamonGrossCrunch/OskiHub"
  }
}
```

Ignored (no newsletter changes):
```json
{
  "message": "No newsletter changes detected",
  "commits": 1
}
```

## Benefits

### Before (Manual Sync)
1. Edit newsletter in Google Apps Script
2. Push to GitHub
3. Go to oski.app/admin/cache-refresh
4. Click "Sync Newsletters" button
5. Wait for deployment

### After (Automatic Webhook)
1. Edit newsletter in Google Apps Script
2. Push to GitHub
3. ✅ **Done!** Deployment triggers automatically

**Time saved**: ~2 minutes per newsletter update
**User experience**: Seamless, no manual intervention required
**Reliability**: No risk of forgetting to sync

## Maintenance

### Rotating the Secret
If you need to change the webhook secret:
1. Generate a new secret (see Step 1)
2. Update GITHUB_WEBHOOK_SECRET in Vercel
3. Update Secret in GitHub webhook settings
4. Test with a push to verify

### Disabling Auto-Sync
To temporarily disable automatic sync:
1. Go to GitHub → Settings → Webhooks
2. Uncheck **Active** on the webhook
3. Manual sync via /admin/cache-refresh will still work

## Related Documentation
- [Manual Newsletter Sync Setup](./NEWSLETTER_SYNC_COMPLETE.md)
- [GitHub Webhooks Documentation](https://docs.github.com/en/webhooks)
- [Vercel Deploy Hooks Documentation](https://vercel.com/docs/concepts/git/deploy-hooks)

## Support
For issues or questions:
- Check Vercel deployment logs
- Check GitHub webhook delivery logs
- Verify environment variables are set correctly
- Test health check endpoint
