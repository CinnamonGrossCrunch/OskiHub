import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

// Force dynamic rendering for this API route
export const dynamic = 'force-dynamic';

/**
 * GitHub Webhook Handler for Newsletter Sync
 * 
 * This endpoint receives push events from GitHub when new newsletters are committed
 * to the repository. It validates the webhook signature and triggers a Vercel redeployment
 * to pull the latest newsletter content.
 * 
 * Setup Instructions:
 * 1. Add GITHUB_WEBHOOK_SECRET to Vercel environment variables
 * 2. Add VERCEL_DEPLOY_HOOK_URL to Vercel environment variables (same as manual sync button)
 * 3. Configure GitHub webhook:
 *    - URL: https://oski.app/api/github-webhook
 *    - Content type: application/json
 *    - Secret: Same value as GITHUB_WEBHOOK_SECRET
 *    - Events: Just the push event
 *    - Active: Yes
 */

export async function POST(request: NextRequest) {
  try {
    console.log('📬 [GitHub Webhook] Received webhook request');

    // Get the GitHub signature from headers
    const signature = request.headers.get('x-hub-signature-256');
    if (!signature) {
      console.error('❌ [GitHub Webhook] No signature provided');
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 401 }
      );
    }

    // Get the webhook secret from environment
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (!secret) {
      console.error('❌ [GitHub Webhook] GITHUB_WEBHOOK_SECRET not configured');
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      );
    }

    // Read the request body
    const body = await request.text();
    
    // Verify the signature
    const expectedSignature = 'sha256=' + crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    if (signature !== expectedSignature) {
      console.error('❌ [GitHub Webhook] Invalid signature');
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      );
    }

    console.log('✅ [GitHub Webhook] Signature verified');

    // Parse the payload
    const payload = JSON.parse(body);
    
    // Check if this is a push event
    const event = request.headers.get('x-github-event');
    if (event !== 'push') {
      console.log(`ℹ️ [GitHub Webhook] Ignoring non-push event: ${event}`);
      return NextResponse.json({ 
        message: 'Event ignored (not a push event)',
        event 
      });
    }

    // Check if the push includes changes to the newsletters directory
    const commits = payload.commits || [];
    const hasNewsletterChanges = commits.some((commit: { added?: string[]; modified?: string[]; removed?: string[] }) => {
      const files = [
        ...(commit.added || []),
        ...(commit.modified || []),
        ...(commit.removed || [])
      ];
      return files.some((file: string) => file.startsWith('content/newsletters/'));
    });

    if (!hasNewsletterChanges) {
      console.log('ℹ️ [GitHub Webhook] No newsletter changes detected, skipping deployment');
      return NextResponse.json({ 
        message: 'No newsletter changes detected',
        commits: commits.length 
      });
    }

    console.log('📰 [GitHub Webhook] Newsletter changes detected!');
    console.log(`📝 [GitHub Webhook] Commits: ${commits.length}`);
    
    // Trigger Vercel deployment
    const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    if (!deployHookUrl) {
      console.error('❌ [GitHub Webhook] VERCEL_DEPLOY_HOOK_URL not configured');
      return NextResponse.json(
        { error: 'Deploy hook URL not configured' },
        { status: 500 }
      );
    }

    console.log('🚀 [GitHub Webhook] Triggering Vercel deployment...');
    const deployResponse = await fetch(deployHookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!deployResponse.ok) {
      throw new Error(`Vercel deployment failed: ${deployResponse.status}`);
    }

    const deployData = await deployResponse.json();
    console.log('✅ [GitHub Webhook] Deployment triggered successfully');
    console.log(`📦 [GitHub Webhook] Job: ${deployData.job?.id || 'unknown'}`);

    return NextResponse.json({
      success: true,
      message: 'Newsletter sync deployment triggered',
      deployment: {
        jobId: deployData.job?.id,
        state: deployData.job?.state,
      },
      webhook: {
        event,
        ref: payload.ref,
        commits: commits.length,
        pusher: payload.pusher?.name,
        repository: payload.repository?.full_name,
      },
    });

  } catch (error) {
    console.error('❌ [GitHub Webhook] Error:', error);
    return NextResponse.json(
      { 
        error: 'Webhook processing failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  return NextResponse.json({
    status: 'ok',
    endpoint: 'github-webhook',
    purpose: 'Automatic newsletter sync on GitHub push events',
    configured: {
      hasSecret: !!process.env.GITHUB_WEBHOOK_SECRET,
      hasDeployHook: !!process.env.VERCEL_DEPLOY_HOOK_URL,
    },
  });
}
