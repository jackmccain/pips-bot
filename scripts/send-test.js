// Send a test text from the bot's number.
// Usage:  node scripts/send-test.js +15551234567 "hello from pips bot"
import { sendNewChat } from '../src/linq.js';

const to = process.argv[2];
const message = process.argv[3] || 'Hello from Pips bot 🎲 — text HELP for commands.';

if (!to) {
  console.error('Usage: node scripts/send-test.js +1XXXXXXXXXX "message"');
  process.exit(1);
}

const res = await sendNewChat(to, message);
console.log('✅ Sent. Chat:', res.id);
console.log(JSON.stringify(res, null, 2));
