// Verify Upstash Redis REST connectivity + the store's Redis backend.
// Reads UPSTASH_REDIS_REST_URL / _TOKEN from the environment.
// Usage:  node scripts/test-redis.js
import { config } from '../src/config.js';
import { addScore, setActiveName, getScores, backendName } from '../src/store.js';

if (backendName() !== 'upstash-redis') {
  console.error('Redis env vars not set — store is using:', backendName());
  process.exit(1);
}

async function redis(cmd) {
  const r = await fetch(config.redisUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${config.redisToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(cmd),
  });
  return r.json();
}

console.log('Backend:', backendName());
console.log('Raw PING ->', JSON.stringify(await redis(['PING'])));

await setActiveName('+15550000001', 'Tester');
await addScore({ phone: '+15550000001', name: 'Tester', puzzle: 99, difficulty: 'Easy', seconds: 30, timeStr: '0:30' });
const scores = await getScores();
console.log('Store round-trip (scores):', JSON.stringify(scores.filter((s) => s.puzzle === 99)));

console.log('Cleanup DEL pips-bot:db ->', JSON.stringify(await redis(['DEL', 'pips-bot:db'])));
console.log('\n✅ Upstash REST creds work.');
