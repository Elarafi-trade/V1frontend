/**
 * Background Worker Entry Point
 * 
 * Runs the sync worker as a separate Node.js process.
 * Can be run alongside Next.js dev server or as standalone service.
 * 
 * Usage:
 *   node worker.js                    # Run once
 *   node worker.js --daemon           # Run continuously
 *   npm run worker                    # Via package.json script
 * 
 * ✅ ESM-compatible: Uses transpiled .js in production
 * ✅ Dev-friendly: Uses .ts in development (with tsx/ts-node)
 * ✅ Self-healing: Wrapped in error recovery
 */

// Load environment variables
require('dotenv').config();

const LOG_PREFIX = '[Worker]';

// Dynamic import for ES modules
async function main() {
  console.log(`🚀 ${LOG_PREFIX} Background Worker Starting...\n`);
  
  // Use transpiled .js in production, .ts in development
  const isProduction = process.env.NODE_ENV === 'production';
  const workerPath = isProduction 
    ? './dist/workers/syncWorker.js'
    : './src/workers/syncWorker.ts';
  
  console.log(`📦 ${LOG_PREFIX} Loading from: ${workerPath}`);
  
  let syncModule;
  try {
    syncModule = await import(workerPath);
  } catch (error) {
    // Fallback to .ts if .js doesn't exist (first-time build)
    if (isProduction && error.code === 'ERR_MODULE_NOT_FOUND') {
      console.warn(`⚠️ ${LOG_PREFIX} Transpiled worker not found, falling back to .ts`);
      console.warn(`   Run: npm run build:worker`);
      syncModule = await import('./src/workers/syncWorker.ts');
    } else {
      throw error;
    }
  }
  
  // Handle both default and named exports
  const startSyncWorker = syncModule.startSyncWorker || syncModule.default?.startSyncWorker;
  const syncAllPositions = syncModule.syncAllPositions || syncModule.default?.syncAllPositions;
  
  if (!startSyncWorker || !syncAllPositions) {
    console.error(`❌ ${LOG_PREFIX} Failed to import worker functions`);
    console.error('Available exports:', Object.keys(syncModule));
    process.exit(1);
  }
  const isDaemon = process.argv.includes('--daemon');
  
  if (isDaemon) {
    console.log(`📡 ${LOG_PREFIX} Running in DAEMON mode (continuous sync)`);
    const interval = startSyncWorker();
    
    // Graceful shutdown
    process.on('SIGINT', () => {
      console.log(`\n🛑 ${LOG_PREFIX} Shutting down worker...`);
      clearInterval(interval);
      process.exit(0);
    });
    
    process.on('SIGTERM', () => {
      console.log(`\n🛑 ${LOG_PREFIX} Shutting down worker...`);
      clearInterval(interval);
      process.exit(0);
    });
    
    // Keep process alive
    console.log(`✅ ${LOG_PREFIX} Worker running. Press Ctrl+C to stop.\n`);
  } else {
    console.log(`🔄 ${LOG_PREFIX} Running in ONE-TIME mode (single sync)`);
    const stats = await syncAllPositions();
    console.log(`\n📊 ${LOG_PREFIX} Final Stats:`);
    console.log(`   Checked: ${stats.totalChecked}`);
    console.log(`   Closed: ${stats.closed}`);
    console.log(`   Errors: ${stats.errors}`);
    console.log(`   Duration: ${stats.duration}ms`);
    console.log(`   Avg Latency: ${Math.round(stats.avgLatency)}ms`);
    console.log(`\n✅ ${LOG_PREFIX} Worker complete. Exiting.\n`);
    process.exit(0);
  }
}

main().catch(err => {
  console.error(`❌ ${LOG_PREFIX} Worker failed:`, err);
  process.exit(1);
});

