// Delete a webhook subscription by id.
// Usage:  node scripts/delete-webhook.js <subscription_id>
import { deleteWebhookSubscription } from '../src/linq.js';

const id = process.argv[2];
if (!id) {
  console.error('Usage: node scripts/delete-webhook.js <subscription_id>');
  process.exit(1);
}

await deleteWebhookSubscription(id);
console.log(`✅ Deleted webhook subscription ${id}`);
