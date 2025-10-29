/**
 * Health Check Endpoint
 * Used by Railway and other monitoring services
 */

import { NextResponse } from 'next/server';

export async function GET() {
  try {
    // Basic health check
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV,
      services: {
        nextjs: 'running',
        database: process.env.DATABASE_URL ? 'configured' : 'missing',
        redis: process.env.REDIS_URL ? 'configured' : 'missing',
      }
    };

    return NextResponse.json(health, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { 
        status: 'error', 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }, 
      { status: 500 }
    );
  }
}

