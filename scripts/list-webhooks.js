// List webhook subscriptions on the Linq account.
import { listWebhookSubscriptions } from '../src/linq.js';

const data = await listWebhookSubscriptions();
console.log(JSON.stringify(data, null, 2));
