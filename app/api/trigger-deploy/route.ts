import { NextResponse } from 'next/server';
import { invalidateAllCaches } from '@/lib/cache';

export const dynamic = 'force-dynamic';

/**
 * Triggers a Vercel deployment to pull latest code/newsletters from GitHub
 * This calls the Vercel Deploy Hook which causes a fresh build.
 * Also invalidates KV cache so stale data doesn't survive the deploy.
 */
export async function POST() {
  try {
    // Get the deploy hook URL from environment variables
    const deployHookUrl = process.env.VERCEL_DEPLOY_HOOK_URL;
    
    if (!deployHookUrl) {
      return NextResponse.json(
        { 
          error: 'Deploy hook not configured',
          message: 'VERCEL_DEPLOY_HOOK_URL environment variable is missing'
        },
        { status: 500 }
      );
    }

    // Invalidate KV cache before triggering deploy
    console.log('🗑️ [Trigger Deploy] Invalidating KV cache...');
    await invalidateAllCaches();

    // Trigger the deployment
    const response = await fetch(deployHookUrl, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Deploy hook returned ${response.status}`);
    }

    const data = await response.json();

    return NextResponse.json({
      success: true,
      message: 'Deployment triggered successfully',
      job: data.job,
    });

  } catch (error) {
    console.error('Error triggering deployment:', error);
    return NextResponse.json(
      { 
        error: 'Failed to trigger deployment',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
