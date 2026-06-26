import express from 'express';
import { config } from './config.js';
import { verifyWebhook } from './verify.js';
import { handleMessage } from './handler.js';
import { replyToChat } from './linq.js';
import { backendName } from './store.js';

const app = express();

// Capture the raw body (needed for signature verification) while still parsing JSON.
app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf.toString('utf8');
    },
  })
);

app.get('/', (_req, res) => res.send('pips-bot is running 🎲'));
app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/webhooks/linq', (req, res) => {
  // Verify signature if a secret is configured; otherwise warn (dev mode).
  if (config.webhookSecret) {
    const ok = verifyWebhook(config.webhookSecret, req.rawBody || '', req.headers);
    if (!ok) {
      console.warn('⚠️  Rejected webhook: bad signature');
      return res.status(401).send('invalid signature');
    }
  } else {
    console.warn('⚠️  LINQ_WEBHOOK_SECRET not set — skipping signature verification');
  }

  // Acknowledge immediately, then process. Linq retries on non-2xx, so never
  // let our handler errors turn into duplicate-delivery storms.
  res.sendStatus(200);
  processEvent(req.body).catch((err) =>
    console.error('Error processing event:', err?.body ?? err)
  );
});

async function processEvent(event) {
  if (!event || event.event_type !== 'message.received') return;

  const data = event.data || {};
  if (data.sender_handle?.is_me) return; // ignore our own messages

  const chatId = data.chat?.id;
  const phone = data.sender_handle?.handle;
  const text = (data.parts || [])
    .filter((p) => p.type === 'text')
    .map((p) => p.value)
    .join('\n')
    .trim();

  if (!chatId || !phone) return;
  console.log(`📥 ${phone}: ${text.replace(/\n/g, ' / ')}`);

  const reply = await handleMessage(phone, text);
  if (!reply) return;

  await replyToChat(chatId, reply);
  console.log(`📤 ${phone}: ${reply.replace(/\n/g, ' / ')}`);
}

app.listen(config.port, () => {
  console.log(`🎲 pips-bot listening on http://localhost:${config.port}`);
  console.log(`   Webhook endpoint: POST /webhooks/linq`);
  console.log(`   Storage: ${backendName()}`);
  if (!config.webhookSecret) {
    console.log('   (dev mode: signature verification disabled)');
  }
});
