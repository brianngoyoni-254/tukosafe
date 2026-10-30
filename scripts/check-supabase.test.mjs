// Unit tests for the config validation and the connection diagnostic, using a fake fetch (no real Supabase calls).
import test from 'node:test';
import assert from 'node:assert/strict';
import { evaluateConfig, pickKey } from '../src/lib/supabaseConfig.js';
import { diagnose } from './check-supabase.mjs';

const jwt = (payload) => `eyJhbGciOiJIUzI1NiJ9.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
const GOOD_URL = 'https://abcdefghij.supabase.co';

test('config: missing, placeholder and malformed values are rejected with an actionable message', () => {
  assert.match(evaluateConfig({}).problem, /VITE_SUPABASE_URL/);
  assert.match(evaluateConfig({ url: GOOD_URL }).problem, /public key is missing/i);
  assert.match(evaluateConfig({ key: 'k' }).problem, /VITE_SUPABASE_URL is missing/);
  assert.match(evaluateConfig({ url: 'https://YOUR-PROJECT-REF.supabase.co', key: 'abc' }).problem, /placeholder/i);
  assert.match(evaluateConfig({ url: GOOD_URL, key: 'YOUR-PUBLIC-PUBLISHABLE-OR-ANON-KEY' }).problem, /placeholder/i);
  assert.match(evaluateConfig({ url: 'not a url', key: 'abc' }).problem, /not a valid URL/);
  assert.match(evaluateConfig({ url: 'http://abc.supabase.co', key: 'abc' }).problem, /https/);
});

test('config: accepts publishable keys, anon JWTs and local http URLs; strips trailing slashes', () => {
  assert.equal(evaluateConfig({ url: `${GOOD_URL}/`, key: 'sb_publishable_AbC123' }).ok, true);
  assert.equal(evaluateConfig({ url: `${GOOD_URL}/`, key: 'sb_publishable_AbC123' }).url, GOOD_URL);
  assert.equal(evaluateConfig({ url: GOOD_URL, key: jwt({ role: 'anon' }) }).ok, true);
  assert.equal(evaluateConfig({ url: 'http://localhost:54321', key: 'abc' }).ok, true);
});

test('config: secret and service_role keys are refused so they can never ship to a browser', () => {
  const secret = evaluateConfig({ url: GOOD_URL, key: 'sb_secret_abcdef' });
  assert.equal(secret.ok, false); assert.match(secret.problem, /SECRET key/);
  const service = evaluateConfig({ url: GOOD_URL, key: jwt({ role: 'service_role' }) });
  assert.equal(service.ok, false); assert.match(service.problem, /service_role/);
});

test('pickKey: publishable wins over anon, either alone works', () => {
  assert.deepEqual(pickKey({ VITE_SUPABASE_ANON_KEY: 'a', VITE_SUPABASE_PUBLISHABLE_KEY: 'p' }), { name: 'VITE_SUPABASE_PUBLISHABLE_KEY', value: 'p' });
  assert.deepEqual(pickKey({ VITE_SUPABASE_ANON_KEY: 'a' }), { name: 'VITE_SUPABASE_ANON_KEY', value: 'a' });
  assert.deepEqual(pickKey({}), { name: null, value: '' });
});

const res = (status, body) => ({ status, json: async () => body });
function fakeProject({ settings = { external: { email: true }, disable_signup: false, mailer_autoconfirm: false }, migrated = true, anonOk = false } = {}) {
  return async (url) => {
    if (url.endsWith('/auth/v1/settings')) return res(200, settings);
    if (url.includes('/rest/v1/profiles')) return migrated ? res(401, { code: '42501' }) : res(404, { code: 'PGRST205' });
    if (url.includes('/rest/v1/rpc/')) return !migrated ? res(404, { code: 'PGRST202' }) : anonOk ? res(200, null) : res(401, { code: '42501' });
    return res(404, {});
  };
}
const byName = (list, n) => list.find((r) => r.name.startsWith(n));

test('diagnose: a correctly configured project passes every check', async () => {
  const r = await diagnose({ url: GOOD_URL, key: 'sb_publishable_x', fetchImpl: fakeProject() });
  assert.deepEqual(r.filter((x) => x.status !== 'pass'), []);
  assert.ok(r.length >= 6);
});

test('diagnose: reports unapplied migrations, disabled signups and auto-confirm precisely', async () => {
  const r = await diagnose({
    url: GOOD_URL, key: 'sb_publishable_x',
    fetchImpl: fakeProject({ migrated: false, settings: { external: { email: true }, disable_signup: true, mailer_autoconfirm: true } }),
  });
  assert.equal(byName(r, 'Migrations: tables').status, 'fail');
  assert.equal(byName(r, 'Migrations: ensure_profile').status, 'fail');
  assert.equal(byName(r, 'Sign-ups allowed').status, 'fail');
  assert.equal(byName(r, 'Email verification').status, 'warn');
});

test('diagnose: flags a function that anonymous visitors can execute', async () => {
  const r = await diagnose({ url: GOOD_URL, key: 'sb_publishable_x', fetchImpl: fakeProject({ anonOk: true }) });
  assert.equal(byName(r, 'Migrations: send_invitation').status, 'fail');
});

test('diagnose: bad key, unreachable host and unsafe key give clear single failures', async () => {
  const bad = await diagnose({ url: GOOD_URL, key: 'sb_publishable_x', fetchImpl: async () => res(401, { message: 'Invalid API key' }) });
  assert.equal(bad.at(-1).status, 'fail'); assert.match(bad.at(-1).detail, /rejected the key/);
  const down = await diagnose({ url: GOOD_URL, key: 'sb_publishable_x', fetchImpl: async () => { throw new Error('ENOTFOUND'); } });
  assert.match(down.at(-1).detail, /Could not reach/);
  let called = false;
  const secret = await diagnose({ url: GOOD_URL, key: 'sb_secret_x', fetchImpl: async () => { called = true; } });
  assert.equal(secret[0].status, 'fail'); assert.equal(called, false);   // never sends a secret key anywhere
});
