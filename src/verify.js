// Standard Webhooks signature verification (https://www.standardwebhooks.com).
// Adapted from the Linq docs example.
import crypto from 'node:crypto';

/**
 * @param {string} secret   signing secret (may start with "whsec_")
 * @param {string} rawBody  the exact raw request body string
 * @param {object} headers  request headers (lower-cased keys)
 * @returns {boolean}
 */
export function verifyWebhook(secret, rawBody, headers) {
  const msgId = headers['webhook-id'];
  const timestamp = headers['webhook-timestamp'];
  const signature = headers['webhook-signature'];
  if (!msgId || !timestamp || !signature) return false;

  const secretStr = secret.startsWith('whsec_') ? secret.slice(6) : secret;
  const keyBytes = Buffer.from(secretStr, 'base64');
  const signedContent = `${msgId}.${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', keyBytes)
    .update(signedContent)
    .digest('base64');

  // The header can carry multiple space-separated "v1,<sig>" values.
  return signature.split(' ').some((sig) => {
    if (!sig.startsWith('v1,')) return false;
    try {
      return crypto.timingSafeEqual(
        Buffer.from(expected, 'base64'),
        Buffer.from(sig.slice(3), 'base64')
      );
    } catch {
      return false;
    }
  });
}
