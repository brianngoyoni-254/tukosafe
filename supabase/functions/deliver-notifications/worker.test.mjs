// Unit tests with fake providers. They verify our adapter logic and status honesty.
// They do NOT prove delivery through Resend, Africa's Talking or a real push service.
import test from 'node:test';
import assert from 'node:assert/strict';
import { sendEmail, sendSms, sendPush } from './providers.js';
import { processBatch } from './worker.js';

const json = (status, body) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

test('email: not_configured without credentials, and nothing is sent', async () => {
  let called = false;
  const r = await sendEmail({ env: {}, fetchImpl: async () => { called = true; }, to: 'a@b.c', subject: 's', text: 't' });
  assert.equal(r.status, 'not_configured');
  assert.equal(called, false);
});

test('email: 2xx is provider_accepted with a reference, 4xx is failed without retry, 5xx retries', async () => {
  const env = { RESEND_API_KEY: 'k', EMAIL_FROM: 'a@x.dev' };
  assert.deepEqual(await sendEmail({ env, to: 'a@b.c', subject: 's', text: 't', fetchImpl: async () => json(200, { id: 'em_1' }) }),
    { status: 'provider_accepted', ref: 'em_1' });
  const bad = await sendEmail({ env, to: 'a@b.c', subject: 's', text: 't', fetchImpl: async () => json(422, { message: 'bad from' }) });
  assert.equal(bad.status, 'failed'); assert.equal(bad.retry, false);
  const down = await sendEmail({ env, to: 'a@b.c', subject: 's', text: 't', fetchImpl: async () => json(503, {}) });
  assert.equal(down.retry, true);
  const net = await sendEmail({ env, to: 'a@b.c', subject: 's', text: 't', fetchImpl: async () => { throw new Error('ECONNRESET'); } });
  assert.equal(net.status, 'failed'); assert.equal(net.retry, true);
});

test('sms: only Success/101 counts as accepted; sandbox host is honoured', async () => {
  const env = { AT_API_KEY: 'k', AT_USERNAME: 'sandbox', AT_SANDBOX: 'true' };
  let url;
  const ok = await sendSms({ env, to: '+254700000001', message: 'hi', fetchImpl: async (u) => { url = u; return json(201, { SMSMessageData: { Recipients: [{ statusCode: 101, status: 'Success', messageId: 'ATXid_1' }] } }); } });
  assert.equal(ok.status, 'provider_accepted'); assert.equal(ok.ref, 'ATXid_1');
  assert.match(url, /api\.sandbox\.africastalking\.com/);
  const rej = await sendSms({ env, to: '+254700000001', message: 'hi', fetchImpl: async () => json(201, { SMSMessageData: { Recipients: [{ statusCode: 403, status: 'InvalidPhoneNumber' }] } }) });
  assert.equal(rej.status, 'failed');
  assert.equal((await sendSms({ env: {}, to: '+1', message: 'x' })).status, 'not_configured');
});

const vapid = { VAPID_PUBLIC_KEY: 'pub', VAPID_PRIVATE_KEY: 'priv', VAPID_SUBJECT: 'mailto:ops@example.test' };
const subs = [{ id: 's1', endpoint: 'https://p/1', p256dh: 'a', auth: 'b' }, { id: 's2', endpoint: 'https://p/2', p256dh: 'a', auth: 'b' }];

test('push: not_configured without VAPID keys', async () => {
  const r = await sendPush({ webpush: {}, env: {}, subscriptions: subs, payload: {} });
  assert.equal(r.status, 'not_configured');
});

test('push: accepted if any subscription accepts; 410 marks that subscription gone', async () => {
  const webpush = {
    setVapidDetails() {},
    async sendNotification(sub) { if (sub.endpoint.endsWith('/2')) { const e = new Error('Gone'); e.statusCode = 410; throw e; } },
  };
  const r = await sendPush({ webpush, env: vapid, subscriptions: subs, payload: { title: 't' } });
  assert.equal(r.status, 'provider_accepted');
  assert.deepEqual(r.outcomes.map((o) => [o.id, o.ok, o.gone]), [['s1', true, false], ['s2', false, true]]);
});

test('push: all subscriptions gone => failed without retry', async () => {
  const webpush = { setVapidDetails() {}, async sendNotification() { const e = new Error('Gone'); e.statusCode = 404; throw e; } };
  const r = await sendPush({ webpush, env: vapid, subscriptions: subs, payload: {} });
  assert.equal(r.status, 'failed'); assert.equal(!!r.retry, false);
});

test('push: network error is retryable', async () => {
  const webpush = { setVapidDetails() {}, async sendNotification() { throw new Error('socket hang up'); } };
  const r = await sendPush({ webpush, env: vapid, subscriptions: subs, payload: {} });
  assert.equal(r.retry, true);
});

test('processBatch writes every outcome back and cleans dead subscriptions', async () => {
  const finished = []; const pushRecords = [];
  const rows = [
    { id: 'd1', channel: 'push', attempts: 1, type: 'sos', title: 'SOS from W', body: 'help', data: {}, subscriptions: subs },
    { id: 'd2', channel: 'email', attempts: 1, type: 'sos', title: 'SOS from W', body: 'help', email: 'b@x.dev', subscriptions: [] },
    { id: 'd3', channel: 'sms', attempts: 1, type: 'sos', title: 'SOS from W', body: 'help', phone: '+254700000002', subscriptions: [] },
  ];
  const webpush = { setVapidDetails() {}, async sendNotification(sub) { if (sub.endpoint.endsWith('/2')) { const e = new Error('Gone'); e.statusCode = 410; throw e; } } };
  const summary = await processBatch({
    claim: async () => rows,
    finish: async (...a) => finished.push(a),
    recordPush: async (...a) => pushRecords.push(a),
    webpush, env: vapid /* no email / sms credentials */, fetchImpl: async () => { throw new Error('must not be called'); },
  });
  assert.deepEqual(finished.map((f) => [f[0], f[1]]), [['d1', 'provider_accepted'], ['d2', 'not_configured'], ['d3', 'not_configured']]);
  assert.deepEqual(pushRecords, [['s1', true, false], ['s2', false, true]]);
  assert.equal(summary.provider_accepted, 1); assert.equal(summary.not_configured, 2);
});

test('processBatch: a throwing provider becomes a retryable failure, not a crash', async () => {
  const finished = [];
  await processBatch({
    claim: async () => [{ id: 'd1', channel: 'email', attempts: 1, type: 'sos', title: 't', body: '', email: 'a@b.c', subscriptions: [] }],
    finish: async (...a) => finished.push(a), recordPush: async () => {}, webpush: {},
    env: { RESEND_API_KEY: 'k', EMAIL_FROM: 'f@x.dev' }, fetchImpl: async () => { throw new Error('boom'); },
  });
  assert.equal(finished[0][1], 'failed'); assert.equal(finished[0][4], true);
});
