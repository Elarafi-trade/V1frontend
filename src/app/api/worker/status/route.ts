/**
 * Worker Status API
 * 
 * Endpoint to monitor the background sync worker.
 * Returns statistics about sync operations and position states.
 * 
 * GET /api/worker/status          - Fast cached response
 * GET /api/worker/status?detailed=true  - Detailed DB query
 * 
 * ✅ Instant response: Uses in-memory cache from last run
 * ✅ No DB queries: Stats are cached during sync operations
 * ✅ Real-time: Reflects actual worker performance
 */

import { NextResponse } from 'next/server';
import { NextRequest } from 'next/server';
import { getWorkerStats, getCachedStats } from '@/workers/syncWorker';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const detailed = searchParams.get('detailed') === 'true';
    
    const stats = await getWorkerStats(detailed);
    
    return NextResponse.json({
      success: true,
      worker: stats.lastRunAgo >= 0 && stats.lastRunAgo < 120000 ? 'active' : 'idle',
      ...stats,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error('[Worker] Error fetching worker stats:', error);
    
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        worker: 'error',
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

