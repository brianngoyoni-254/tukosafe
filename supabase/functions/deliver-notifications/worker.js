import { sendEmail, sendSms, sendPush, critical } from './providers.js';

/**
 * Process one batch of claimed deliveries.
 * deps: { claim(limit), finish(id,status,ref,error,retry), recordPush(subId, ok, gone), webpush, env, fetchImpl }
 * Every outcome is written back, so notification_deliveries is the audit log.
 */
export async function processBatch({ claim, finish, recordPush, webpush, env, fetchImpl, limit = 25 }) {
  const rows = await claim(limit);
  const summary = { claimed: rows.length, provider_accepted: 0, failed: 0, not_configured: 0, requeued: 0 };
  for (const row of rows) {
    let result;
    try {
      const text = row.body ? `${row.title}\n${row.body}` : row.title;
      if (row.channel === 'push') {
        result = await sendPush({
          webpush, env, subscriptions: row.subscriptions || [],
          payload: { title: row.title, body: row.body || '', type: row.type, urgent: critical(row.type), data: row.data || {} },
        });
        for (const o of result.outcomes || []) await recordPush(o.id, o.ok, o.gone);
      } else if (row.channel === 'email') {
        result = await sendEmail({ fetchImpl, env, to: row.email, subject: `TukoSafe: ${row.title}`, text: `${text}\n\nThis is a TukoSafe notification. TukoSafe is not an emergency service: call 999 or 112 in an emergency.` });
      } else if (row.channel === 'sms') {
        result = await sendSms({ fetchImpl, env, to: row.phone, message: `TukoSafe: ${text}`.slice(0, 300) });
      } else {
        result = { status: 'failed', error: `unknown channel ${row.channel}` };
      }
    } catch (e) {
      result = { status: 'failed', error: `worker error: ${e.message}`, retry: true };
    }
    await finish(row.id, result.status, result.ref ?? null, result.error ?? null, !!result.retry);
    if (result.retry && row.attempts < 3) summary.requeued += 1;
    else summary[result.status] = (summary[result.status] || 0) + 1;
  }
  return summary;
}
