import { createRedisClient, closeRedisClient } from '@ascend/redis-client';

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
const TEST_ITERATIONS = 10000;

interface BenchmarkResult {
  operation: string;
  iterations: number;
  totalTimeMs: number;
  avgTimeMs: number;
  opsPerSecond: number;
}

async function benchmark(
  name: string,
  operation: () => Promise<void>,
  iterations: number = TEST_ITERATIONS,
): Promise<BenchmarkResult> {
  const start = performance.now();

  for (let i = 0; i < iterations; i++) {
    await operation();
  }

  const end = performance.now();
  const totalTimeMs = end - start;
  const avgTimeMs = totalTimeMs / iterations;
  const opsPerSecond = (iterations / totalTimeMs) * 1000;

  return {
    operation: name,
    iterations,
    totalTimeMs: Math.round(totalTimeMs * 100) / 100,
    avgTimeMs: Math.round(avgTimeMs * 1000) / 1000,
    opsPerSecond: Math.round(opsPerSecond),
  };
}

async function runBenchmarks() {
  console.log('Starting Redis Leaderboard Benchmarks\n');
  console.log(`Iterations per test: ${TEST_ITERATIONS.toLocaleString()}`);
  console.log(`Redis URL: ${REDIS_URL}\n`);

  const redis = createRedisClient(REDIS_URL);
  await redis.ping();
  console.log('Redis connected\n');

  const testKey = 'benchmark:leaderboard:test';
  await redis.del(testKey);

  const results: BenchmarkResult[] = [];

  console.log('Running benchmarks...\n');

  // Benchmark 1: ZADD (set score)
  results.push(
    await benchmark('ZADD (set score)', async () => {
      const userId = `user_${Math.floor(Math.random() * 1000)}`;
      const score = Math.floor(Math.random() * 10000);
      await redis.zadd(testKey, score, userId);
    }),
  );

  // Benchmark 2: ZINCRBY (increment score)
  results.push(
    await benchmark('ZINCRBY (increment)', async () => {
      const userId = `user_${Math.floor(Math.random() * 1000)}`;
      await redis.zincrby(testKey, 1, userId);
    }),
  );

  // Benchmark 3: ZSCORE (get single score)
  results.push(
    await benchmark('ZSCORE (get score)', async () => {
      const userId = `user_${Math.floor(Math.random() * 1000)}`;
      await redis.zscore(testKey, userId);
    }),
  );

  // Benchmark 4: ZREVRANK (get rank)
  results.push(
    await benchmark('ZREVRANK (get rank)', async () => {
      const userId = `user_${Math.floor(Math.random() * 1000)}`;
      await redis.zrevrank(testKey, userId);
    }),
  );

  // Benchmark 5: ZREVRANGE (top 10)
  results.push(
    await benchmark('ZREVRANGE (top 10)', async () => {
      await redis.zrevrange(testKey, 0, 9, 'WITHSCORES');
    }),
  );

  // Benchmark 6: ZREVRANGE (top 100)
  results.push(
    await benchmark('ZREVRANGE (top 100)', async () => {
      await redis.zrevrange(testKey, 0, 99, 'WITHSCORES');
    }),
  );

  // Benchmark 7: ZCARD (count entries)
  results.push(
    await benchmark('ZCARD (count)', async () => {
      await redis.zcard(testKey);
    }),
  );

  // Benchmark 8: Pipeline (batch 10 operations)
  results.push(
    await benchmark(
      'PIPELINE (10 ZADDs)',
      async () => {
        const pipeline = redis.pipeline();
        for (let i = 0; i < 10; i++) {
          const userId = `user_${Math.floor(Math.random() * 1000)}`;
          const score = Math.floor(Math.random() * 10000);
          pipeline.zadd(testKey, score, userId);
        }
        await pipeline.exec();
      },
      Math.floor(TEST_ITERATIONS / 10),
    ),
  );

  console.log('\nBenchmark Results:\n');
  console.table(results);

  console.log('\nKey Insights:');
  console.log(
    `  • Average write latency: ${results[0].avgTimeMs.toFixed(3)}ms (ZADD)`,
  );
  console.log(
    `  • Average read latency: ${results[4].avgTimeMs.toFixed(3)}ms (ZREVRANGE top 10)`,
  );
  console.log(
    `  • Max throughput: ${results.reduce((max, r) => Math.max(max, r.opsPerSecond), 0).toLocaleString()} ops/sec`,
  );

  const totalEntries = await redis.zcard(testKey);
  console.log(
    `\nFinal leaderboard size: ${totalEntries.toLocaleString()} entries`,
  );

  await redis.del(testKey);
  await closeRedisClient();
  console.log('\nCleanup complete');
}

runBenchmarks().catch(console.error);
