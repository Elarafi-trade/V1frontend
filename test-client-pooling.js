/**
 * Test Script: Drift Client Pooling Performance
 * 
 * Run this to verify the singleton manager works correctly.
 * Usage: node test-client-pooling.js
 */

const { getReadOnlyDriftClient, getDriftClientStats, invalidateDriftClient } = require('./src/lib/drift/clientManager.ts');

async function testPooling() {
  console.log('\n🧪 Testing Drift Client Pooling...\n');

  // Test 1: First call (should create new client)
  console.log('Test 1: First call (cold start)');
  const start1 = Date.now();
  try {
    const client1 = await getReadOnlyDriftClient();
    const duration1 = Date.now() - start1;
    console.log(`✅ Client created in ${duration1}ms`);
    console.log('Stats:', getDriftClientStats());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Test 2: Second call (should reuse cached)
  console.log('\nTest 2: Second call (cache hit)');
  const start2 = Date.now();
  try {
    const client2 = await getReadOnlyDriftClient();
    const duration2 = Date.now() - start2;
    console.log(`✅ Client retrieved in ${duration2}ms (${duration2 < 100 ? 'CACHE HIT ⚡' : 'MISS'})`);
    console.log('Stats:', getDriftClientStats());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Test 3: Manual invalidation
  console.log('\nTest 3: Manual invalidation');
  await invalidateDriftClient();
  console.log('✅ Cache invalidated');
  console.log('Stats:', getDriftClientStats());

  // Test 4: After invalidation (should create new)
  console.log('\nTest 4: After invalidation (cold start again)');
  const start4 = Date.now();
  try {
    const client4 = await getReadOnlyDriftClient();
    const duration4 = Date.now() - start4;
    console.log(`✅ Client created in ${duration4}ms`);
    console.log('Stats:', getDriftClientStats());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  // Test 5: Rapid successive calls (stress test)
  console.log('\nTest 5: Rapid successive calls (10x)');
  const start5 = Date.now();
  try {
    await Promise.all([
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
      getReadOnlyDriftClient(),
    ]);
    const duration5 = Date.now() - start5;
    console.log(`✅ 10 concurrent calls completed in ${duration5}ms (avg: ${duration5/10}ms per call)`);
    console.log('Stats:', getDriftClientStats());
  } catch (err) {
    console.error('❌ Error:', err.message);
  }

  console.log('\n✅ All tests complete!\n');
  process.exit(0);
}

// Run tests
testPooling().catch(err => {
  console.error('Test failed:', err);
  process.exit(1);
});

