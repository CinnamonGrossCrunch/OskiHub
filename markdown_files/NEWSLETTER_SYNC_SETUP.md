# Newsletter Sync Setup Guide

This guide explains how to set up the "Sync Newsletters" feature in the admin panel.

## What It Does

The "Sync Newsletters from GitHub" button triggers a Vercel redeployment, which:
1. Pulls the latest code from your GitHub repository
2. Includes any new newsletter markdown files in `content/newsletters/`
3. Redeploys your site with the updated content

## Setup Steps

### 1. Create a Vercel Deploy Hook

1. Go to your Vercel Dashboard: https://vercel.com/dashboard
2. Select your project (OskiHub / oski.app)
3. Go to **Settings** → **Git** → **Deploy Hooks**
4. Click **Create Hook**
   - **Hook Name**: "Newsletter Sync" (or any name you prefer)
   - **Git Branch**: `main` (or your default branch)
5. Copy the generated webhook URL (it looks like: `https://api.vercel.com/v1/integrations/deploy/...`)

### 2. Add Environment Variable to Vercel

1. Still in your Vercel project settings
2. Go to **Settings** → **Environment Variables**
3. Click **Add New**
   - **Key**: `VERCEL_DEPLOY_HOOK_URL`
   - **Value**: Paste the webhook URL from step 1
   - **Environment**: Select all environments (Production, Preview, Development)
4. Click **Save**

### 3. Redeploy (One Time)

After adding the environment variable, you need to trigger one redeployment for the change to take effect:

- Go to **Deployments** tab
- Click the **...** menu on your latest deployment
- Click **Redeploy**

Or simply push a new commit to trigger a deployment.

## How to Use

Once set up:

1. Go to **www.oski.app/admin/cache-refresh**
2. Enter password: `beta`
3. Scroll to "📧 Sync Gmail Newsletters" section
4. Click **"🚀 Sync Newsletters from GitHub"**
5. Wait ~30-60 seconds for deployment to complete
6. Refresh the main dashboard to see new newsletters

## When to Use This

Use the "Sync Newsletters" button when:
- ✅ New newsletters have been pushed to GitHub (via Google Apps Script or manual commit)
- ✅ Newsletters aren't showing on the site yet
- ✅ You want to pull latest content without waiting for automatic deployment

**Note**: This is different from "Refresh Cache" which only regenerates cached data from existing sources.

## Troubleshooting

### Error: "Deploy hook not configured"
- You forgot to add the `VERCEL_DEPLOY_HOOK_URL` environment variable
- Follow Setup Steps 2-3 above

### Deployment triggered but newsletters not updating
- Check that newsletter files are actually in your GitHub repo at `content/newsletters/`
- Verify the files are on the `main` branch (or whichever branch you configured)
- Wait 30-60 seconds for deployment to fully complete

### How to verify it's working
- After clicking the button, you should see: "🚀 Deployment triggered! Job ID: ..."
- Go to Vercel dashboard → Deployments to see the new deployment in progress
- Once deployment completes, visit your site and check for new newsletters

## Future Enhancement (Todo #2)

The task list includes implementing automatic GitHub webhooks (Option 1), which would:
- Automatically trigger deployment when newsletters are pushed to GitHub
- No manual button click needed
- Fully automated newsletter sync

This requires setting up a GitHub webhook that calls a custom API endpoint on your site.

