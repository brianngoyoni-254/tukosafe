// Pure validation of the Supabase settings the frontend was given. Used by the app and by scripts/check-supabase.mjs.
// It never invents or defaults credentials: missing or unsafe values simply mean "not configured".

export const URL_VARS = ['VITE_SUPABASE_URL'];
// The newer "publishable" key and the older "anon" key are the same kind of public key; either works.
export const KEY_VARS = ['VITE_SUPABASE_PUBLISHABLE_KEY', 'VITE_SUPABASE_ANON_KEY'];

const PLACEHOLDER = /your[-_ ]|<[^>]+>|placeholder|changeme|xxxx|paste[-_ ]/i;

function decodeJwtPayload(token) {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(b64));   // atob exists in browsers and Node 16+; it accepts unpadded base64
  } catch {
    return null;
  }
}

/** Pick the key from an env-like object: publishable first, then anon. */
export function pickKey(env) {
  for (const name of KEY_VARS) {
    const v = (env[name] || '').trim();
    if (v) return { name, value: v };
  }
  return { name: null, value: '' };
}

/**
 * Returns { ok, problem, url, key }. `problem` is a short, user-facing sentence naming exactly what to fix.
 */
export function evaluateConfig({ url = '', key = '' }) {
  const u = (url || '').trim();
  const k = (key || '').trim();

  if (!u && !k) {
    return { ok: false, problem: 'No Supabase settings found. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) in .env.local, then restart the dev server.' };
  }
  if (!u) return { ok: false, problem: 'VITE_SUPABASE_URL is missing. Copy your Project URL from Supabase > Project Settings > API.' };
  if (!k) return { ok: false, problem: 'The public key is missing. Set VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY) from Supabase > Project Settings > API.' };

  if (PLACEHOLDER.test(u)) return { ok: false, problem: 'VITE_SUPABASE_URL still contains the placeholder text. Replace it with your real Project URL.' };
  if (PLACEHOLDER.test(k)) return { ok: false, problem: 'The Supabase key still contains the placeholder text. Replace it with your real public key.' };

  let parsed;
  try { parsed = new URL(u); } catch { return { ok: false, problem: 'VITE_SUPABASE_URL is not a valid URL. It should look like https://<project-ref>.supabase.co' }; }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(parsed.hostname);
  if (parsed.protocol !== 'https:' && !(local && parsed.protocol === 'http:')) {
    return { ok: false, problem: 'VITE_SUPABASE_URL must start with https:// (http:// is only allowed for localhost).' };
  }

  // Secret keys must never ship to a browser.
  if (k.startsWith('sb_secret_')) {
    return { ok: false, problem: 'This is a Supabase SECRET key. Never put it in the frontend. Use the publishable (anon) key instead and rotate the secret key in the dashboard.' };
  }
  const payload = k.startsWith('eyJ') ? decodeJwtPayload(k) : null;
  if (payload && payload.role === 'service_role') {
    return { ok: false, problem: 'This is the service_role key, which bypasses all security. Never put it in the frontend. Use the anon/publishable key and rotate the service_role key in the dashboard.' };
  }

  return { ok: true, problem: '', url: u.replace(/\/+$/, ''), key: k };
}
