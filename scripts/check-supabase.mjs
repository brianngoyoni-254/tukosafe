#!/usr/bin/env node
// Verifies the Supabase connection TukoSafe will use:   npm run check:supabase
//
// Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) from .env.local / .env /
// the environment, then probes the live project with the PUBLIC key only (no secrets needed, nothing is written).
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { evaluateConfig, pickKey } from '../src/lib/supabaseConfig.js';

const DENIED = (r) => r.status === 401 || r.status === 403 || r.body?.code === '42501';

async function call(fetchImpl, url, key, { method = 'GET', body } = {}) {
  try {
    const res = await fetchImpl(url, {
      method,
      headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    let parsed = null;
    try { parsed = await res.json(); } catch { /* empty body */ }
    return { status: res.status, body: parsed };
  } catch (e) {
    return { error: e.message };
  }
}

/** Returns [{ name, status: 'pass'|'warn'|'fail', detail }]. Pure apart from the injected fetch. */
export async function diagnose({ url, key, fetchImpl = fetch }) {
  const out = [];
  const add = (name, status, detail) => out.push({ name, status, detail });

  const cfg = evaluateConfig({ url, key });
  if (!cfg.ok) {
    add('Frontend settings', 'fail', cfg.problem);
    return out;
  }
  add('Frontend settings', 'pass', `URL ${cfg.url}; public key accepted (not a secret/service_role key).`);

  // 1. Auth service reachable + how it is configured.
  const settings = await call(fetchImpl, `${cfg.url}/auth/v1/settings`, cfg.key);
  if (settings.error) {
    add('Auth reachable', 'fail', `Could not reach ${cfg.url}: ${settings.error}. Check the Project URL and your network.`);
    return out;
  }
  if (settings.status === 401 || settings.status === 403) {
    add('Auth reachable', 'fail', 'Supabase rejected the key (HTTP ' + settings.status + '). Copy the public key again from Project Settings > API.');
    return out;
  }
  if (settings.status !== 200) {
    add('Auth reachable', 'fail', `Unexpected HTTP ${settings.status} from /auth/v1/settings. Is the Project URL correct?`);
    return out;
  }
  add('Auth reachable', 'pass', 'Supabase Auth answered and accepted the key.');

  const s = settings.body || {};
  if (s.external && s.external.email === false) add('Email sign-up enabled', 'fail', 'The Email provider is turned off. Enable it in Authentication > Sign In / Providers.');
  else add('Email sign-up enabled', 'pass', 'Email provider is on.');
  if (s.disable_signup) add('Sign-ups allowed', 'fail', 'New sign-ups are disabled. Turn off "Disable sign-ups" in Authentication > Sign In / Providers.');
  else add('Sign-ups allowed', 'pass', 'New users can register.');
  if (s.mailer_autoconfirm) add('Email verification', 'warn', 'Auto-confirm is ON: people can sign in without verifying their email. Turn on "Confirm email" in Authentication > Sign In / Providers.');
  else add('Email verification', 'pass', 'Confirm email is required before sign-in.');

  // 2. Migrations applied? (anonymous access should be blocked, but the objects must exist)
  const profiles = await call(fetchImpl, `${cfg.url}/rest/v1/profiles?select=id&limit=1`, cfg.key);
  if (profiles.status === 404 || profiles.body?.code === 'PGRST205') {
    add('Migrations: tables', 'fail', 'Table public.profiles not found. Apply supabase/migrations (npx supabase db push, or run the .sql files in the SQL editor).');
  } else if (profiles.status === 200 && Array.isArray(profiles.body) && profiles.body.length > 0) {
    add('Row Level Security', 'fail', 'An anonymous request could read profiles. RLS/grants are not applied correctly.');
  } else if (DENIED(profiles) || profiles.status === 200) {
    add('Migrations: tables', 'pass', 'public.profiles exists and anonymous visitors cannot read it.');
  } else {
    add('Migrations: tables', 'warn', `Unexpected response HTTP ${profiles.status}: ${JSON.stringify(profiles.body)}`);
  }

  for (const [fn, migration] of [['ensure_profile', '20261030000005'], ['send_invitation', '20261030000002']]) {
    const r = await call(fetchImpl, `${cfg.url}/rest/v1/rpc/${fn}`, cfg.key, { method: 'POST', body: fn === 'send_invitation' ? { p_email: 'probe@example.com' } : {} });
    if (r.status === 404 || r.body?.code === 'PGRST202') {
      add(`Migrations: ${fn}()`, 'fail', `Function not found. Apply migrations up to ${migration}.`);
    } else if (DENIED(r)) {
      add(`Migrations: ${fn}()`, 'pass', 'Exists, and anonymous callers are denied.');
    } else if (r.status >= 200 && r.status < 300) {
      add(`Migrations: ${fn}()`, 'fail', 'Anonymous visitors can EXECUTE this function. Re-run the privilege statements in the migrations.');
    } else {
      add(`Migrations: ${fn}()`, 'warn', `Exists but answered HTTP ${r.status}: ${r.body?.message || ''}. Anonymous execution should be denied (42501).`);
    }
  }

  return out;
}

function loadEnv(root) {
  const env = {};
  for (const f of ['.env', '.env.local']) {          // .env.local wins, like Vite
    const p = join(root, f);
    if (!existsSync(p)) continue;
    for (const line of readFileSync(p, 'utf8').split(/\r?\n/)) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (m && !line.trim().startsWith('#')) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
  return { ...env, ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k.startsWith('VITE_'))) };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const root = join(dirname(fileURLToPath(import.meta.url)), '..');
  const env = loadEnv(root);
  const keyInfo = pickKey(env);
  console.log(`Using ${keyInfo.name || 'no key variable'} and VITE_SUPABASE_URL\n`);
  const results = await diagnose({ url: env.VITE_SUPABASE_URL, key: keyInfo.value });
  const icon = { pass: '✓', warn: '!', fail: '✗' };
  for (const r of results) console.log(`${icon[r.status]} ${r.name}\n    ${r.detail}`);
  const failed = results.filter((r) => r.status === 'fail').length;
  const warned = results.filter((r) => r.status === 'warn').length;
  console.log(`\n${failed ? `${failed} problem(s) to fix.` : 'Connection looks good.'}${warned ? ` ${warned} warning(s).` : ''}`);
  console.log('\nStill to check by hand in the Supabase dashboard: Authentication > URL Configuration (Site URL and Redirect URLs).');
  process.exit(failed ? 1 : 0);
}
