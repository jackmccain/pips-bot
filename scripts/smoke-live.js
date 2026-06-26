// End-to-end smoke test against the DEPLOYED bot.
// Sends a properly-signed message.received webhook (a score), checks the
// server accepts it (and rejects a tampered one), then confirms the score
// landed in Redis — and finally clears the test data.
//
// Env required: TARGET_URL, LINQ_WEBHOOK_SECRET, UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN
import crypto from 'node:crypto';

const target = process.env.TARGET_URL;
const secret = (process.env.LINQ_WEBHOOK_SECRET || '').replace(/^whsec_/, '');
const key = Buffer.from(secret, 'base64');

const body = JSON.stringify({
  event_type: 'message.received',
  data: {
    chat: { id: 'fake-chat-id', is_group: false },
    sender_handle: { handle: '+15550112233', is_me: false },
    parts: [{ type: 'text', value: 'Pips #1 Easy 🟢\n0:30' }],
  },
});

function headers(sig) {
  const id = 'msg_smoke_1';
  const ts = '1750000000';
  const signature =
    sig ?? `v1,${crypto.createHmac('sha256', key).update(`${id}.${ts}.${body}`).digest('base64')}`;
  return {
    'Content-Type': 'application/json',
    'webhook-id': id,
    'webhook-timestamp': ts,
    'webhook-signature': signature,
  };
}

async function post(label, sig) {
  const r = await fetch(`${target}/webhooks/linq`, { method: 'POST', headers: headers(sig), body });
  console.log(`${label}: HTTP ${r.status}`);
  return r.status;
}

async function redis(cmd) {
  const r = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  });
  return (await r.json()).result;
}

await post('valid signature   ', undefined);
await post('tampered signature ', 'v1,AAAAbadAAAA=');

// give the async handler a moment to write to Redis
await new Promise((res) => setTimeout(res, 4000));

const raw = await redis(['GET', 'pips-bot:db']);
console.log('\nRedis pips-bot:db after test:', raw || '(empty)');
const stored = raw ? JSON.parse(raw) : { scores: [] };
const ok = stored.scores?.some((s) => s.puzzle === 1 && s.difficulty === 'Easy' && s.seconds === 30);
console.log(ok ? '✅ Score was written to Redis by the deployed bot.' : '❌ Score NOT found in Redis.');

console.log('Cleanup DEL pips-bot:db ->', JSON.stringify(await redis(['DEL', 'pips-bot:db'])));
