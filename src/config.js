import 'dotenv/config';

export const config = {
  apiKey: process.env.LINQ_API_KEY || '',
  fromNumber: process.env.LINQ_FROM_NUMBER || '',
  webhookSecret: process.env.LINQ_WEBHOOK_SECRET || '',
  publicWebhookUrl: process.env.PUBLIC_WEBHOOK_URL || '',
  port: Number(process.env.PORT) || 3000,
  baseUrl: 'https://api.linqapp.com/api/partner/v3',
  // Optional persistent store (Upstash Redis REST). When both are set, the bot
  // uses Redis instead of the local data/scores.json file.
  redisUrl: process.env.UPSTASH_REDIS_REST_URL || '',
  redisToken: process.env.UPSTASH_REDIS_REST_TOKEN || '',
  // Admin phone (E.164). When set, DATA/CLEAR only work from this number.
  // When empty, they're open to anyone — set this in production.
  ownerPhone: process.env.OWNER_PHONE || '',
};

export function requireApiKey() {
  if (!config.apiKey) {
    throw new Error('LINQ_API_KEY is not set. Copy .env.example to .env and fill it in.');
  }
}
