// Register the webhook subscription so Linq delivers inbound messages to your bot.
//
// Prereqs:
//   1) Your server is reachable at a public HTTPS URL (e.g. via ngrok).
//   2) PUBLIC_WEBHOOK_URL in .env points at <that URL>/webhooks/linq
//
// Run:  npm run register-webhook
// Then copy the printed signing secret into LINQ_WEBHOOK_SECRET in .env and restart.
import { config } from '../src/config.js';
import { createWebhookSubscription } from '../src/linq.js';

const EVENTS = ['message.received'];

if (!config.publicWebhookUrl) {
  console.error('Set PUBLIC_WEBHOOK_URL in .env first (e.g. https://abc123.ngrok.io/webhooks/linq).');
  process.exit(1);
}

console.log(`Registering webhook → ${config.publicWebhookUrl}`);
console.log(`Events: ${EVENTS.join(', ')}`);

const sub = await createWebhookSubscription(config.publicWebhookUrl, EVENTS);

console.log('\n✅ Subscription created.');
console.log(JSON.stringify(sub, null, 2));

const secret = sub.signing_secret || sub.signingSecret;
if (secret) {
  console.log('\n🔑 Save this signing secret to LINQ_WEBHOOK_SECRET in .env (shown only once):');
  console.log(`   LINQ_WEBHOOK_SECRET=${secret}`);
} else {
  console.log('\n(No signing_secret field found — check the response above.)');
}
