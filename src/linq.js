// Thin client for the Linq Partner API (https://docs.linqapp.com).
import { config, requireApiKey } from './config.js';

async function linqFetch(path, { method = 'GET', body } = {}) {
  requireApiKey();
  const res = await fetch(`${config.baseUrl}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { raw: text };
  }

  if (!res.ok) {
    const err = new Error(`Linq ${method} ${path} failed: ${res.status}`);
    err.status = res.status;
    err.body = data;
    throw err;
  }
  return data;
}

function textMessage(text) {
  return { parts: [{ type: 'text', value: text }] };
}

// List the phone numbers provisioned on the account.
export function listNumbers() {
  return linqFetch('/phone_numbers');
}

// Start a new conversation (and send the first message) to one or more recipients.
export function sendNewChat(to, text) {
  const recipients = Array.isArray(to) ? to : [to];
  return linqFetch('/chats', {
    method: 'POST',
    body: { from: config.fromNumber, to: recipients, message: textMessage(text) },
  });
}

// Reply into an existing chat.
export function replyToChat(chatId, text) {
  return linqFetch(`/chats/${chatId}/messages`, {
    method: 'POST',
    body: { message: textMessage(text) },
  });
}

// Create a webhook subscription. Returns an object containing a one-time signing_secret.
export function createWebhookSubscription(targetUrl, subscribedEvents) {
  return linqFetch('/webhook-subscriptions', {
    method: 'POST',
    body: { target_url: targetUrl, subscribed_events: subscribedEvents },
  });
}

export function listWebhookSubscriptions() {
  return linqFetch('/webhook-subscriptions');
}

export function deleteWebhookSubscription(id) {
  return linqFetch(`/webhook-subscriptions/${id}`, { method: 'DELETE' });
}
