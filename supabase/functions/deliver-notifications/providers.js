// Delivery provider adapters. Pure functions: network access is injected so they can be unit tested.
// Every adapter returns { status, ref?, error?, retry? } using ONLY these honest statuses:
//   provider_accepted  the provider's API accepted the message (NOT proof a person received it)
//   not_configured     credentials are missing on the server; nothing was sent
//   failed             the provider rejected it (retry=true when the failure looks transient)

const TRANSIENT = (code) => code === 408 || code === 429 || code >= 500;

export function critical(type) {
  return type === 'sos' || type === 'help_request' || type === 'missed_checkin';
}

export async function sendEmail({ fetchImpl = fetch, env, to, subject, text }) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return { status: 'not_configured', error: 'RESEND_API_KEY / EMAIL_FROM not set' };
  if (!to) return { status: 'failed', error: 'recipient has no email address' };
  try {
    const res = await fetchImpl('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, text }),
    });
    const body = await res.json().catch(() => ({}));
    if (res.ok) return { status: 'provider_accepted', ref: body.id };
    return { status: 'failed', error: `Resend ${res.status}: ${body.message || body.name || 'error'}`, retry: TRANSIENT(res.status) };
  } catch (e) {
    return { status: 'failed', error: `network: ${e.message}`, retry: true };
  }
}

// Africa's Talking SMS. Set AT_USERNAME=sandbox and AT_SANDBOX=true to test without sending real SMS.
export async function sendSms({ fetchImpl = fetch, env, to, message }) {
  if (!env.AT_API_KEY || !env.AT_USERNAME) return { status: 'not_configured', error: 'AT_API_KEY / AT_USERNAME not set' };
  if (!to) return { status: 'failed', error: 'recipient has no phone number' };
  const host = env.AT_SANDBOX === 'true' ? 'api.sandbox.africastalking.com' : 'api.africastalking.com';
  const form = new URLSearchParams({ username: env.AT_USERNAME, to, message });
  if (env.AT_SENDER_ID) form.set('from', env.AT_SENDER_ID);
  try {
    const res = await fetchImpl(`https://${host}/version1/messaging`, {
      method: 'POST',
      headers: { apiKey: env.AT_API_KEY, Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { status: 'failed', error: `AfricasTalking ${res.status}`, retry: TRANSIENT(res.status) };
    const r = body?.SMSMessageData?.Recipients?.[0];
    if (r && (r.statusCode === 101 || r.status === 'Success')) return { status: 'provider_accepted', ref: r.messageId };
    return { status: 'failed', error: `AfricasTalking: ${r?.status || body?.SMSMessageData?.Message || 'rejected'}` };
  } catch (e) {
    return { status: 'failed', error: `network: ${e.message}`, retry: true };
  }
}

/**
 * Web Push to every subscription of one user.
 * `webpush` is the `web-push` module (injected). Returns the aggregate result plus per-subscription outcomes
 * so dead subscriptions (404/410) can be deleted.
 */
export async function sendPush({ webpush, env, subscriptions, payload }) {
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY || !env.VAPID_SUBJECT) {
    return { status: 'not_configured', error: 'VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT not set', outcomes: [] };
  }
  if (!subscriptions.length) return { status: 'failed', error: 'no active push subscription', outcomes: [] };
  webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY);
  const outcomes = [];
  for (const s of subscriptions) {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 3600, urgency: payload.urgent ? 'high' : 'normal' });
      outcomes.push({ id: s.id, ok: true, gone: false });
    } catch (e) {
      const code = e.statusCode;
      outcomes.push({ id: s.id, ok: false, gone: code === 404 || code === 410, code, error: e.message });
    }
  }
  const accepted = outcomes.filter((o) => o.ok).length;
  if (accepted) return { status: 'provider_accepted', ref: `${accepted}/${outcomes.length} subscriptions`, outcomes };
  const transient = outcomes.some((o) => !o.gone && (!o.code || TRANSIENT(o.code)));
  return { status: 'failed', error: outcomes.map((o) => o.error).filter(Boolean).join('; ').slice(0, 300), retry: transient, outcomes };
}
