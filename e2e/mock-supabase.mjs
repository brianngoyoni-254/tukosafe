// A small stand-in for Supabase Auth + PostgREST, used ONLY by the browser tests.
//
// Docker (needed for a real local Supabase) is not available in every dev environment, so these
// tests run the real app in a real browser against this stub. They verify OUR client behaviour:
// where the session is stored, what happens on restart, expiry, logout, route protection and
// per-account isolation in the browser. They do NOT test GoTrue itself, email delivery, or RLS
// (RLS is covered by supabase/tests/*.sql against real Postgres).
import http from 'node:http';
import crypto from 'node:crypto';

const PORT = Number(process.env.MOCK_PORT || 54321);
const ACCESS_TTL = Number(process.env.ACCESS_TTL || 3600);

let users, tokens, refresh, recoveries;
const reset = () => { users = new Map(); tokens = new Map(); refresh = new Map(); recoveries = new Map(); };
reset();

const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (payload) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64(payload)}.mock-signature`;

function userView(u) {
  return {
    id: u.id, aud: 'authenticated', role: 'authenticated', email: u.email,
    email_confirmed_at: u.confirmed ? u.confirmedAt : null, phone: '',
    app_metadata: { provider: 'email', providers: ['email'] }, user_metadata: u.meta,
    identities: [{ identity_id: u.id, id: u.id, user_id: u.id, provider: 'email' }],
    created_at: u.createdAt, updated_at: u.createdAt,
  };
}

function issue(u, { recovery = false } = {}) {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + ACCESS_TTL;
  const access = jwt({ sub: u.id, email: u.email, role: 'authenticated', aud: 'authenticated', exp, iat: now });
  const rt = crypto.randomBytes(12).toString('hex');
  tokens.set(access, { userId: u.id, exp, recovery });
  refresh.set(rt, { userId: u.id, used: false });
  return { access_token: access, token_type: 'bearer', expires_in: ACCESS_TTL, expires_at: exp, refresh_token: rt, user: userView(u) };
}

function authed(req) {
  const h = req.headers.authorization || '';
  const t = tokens.get(h.replace(/^Bearer /i, ''));
  if (!t || t.exp * 1000 < Date.now()) return null;
  return users.get(t.userId) || null;
}

const send = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(body === undefined ? '' : JSON.stringify(body));
};

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'] || '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Range');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }

  const url = new URL(req.url, `http://localhost:${PORT}`);
  const chunks = []; for await (const c of req) chunks.push(c);
  const raw = Buffer.concat(chunks).toString();
  let body = {}; try { body = raw ? JSON.parse(raw) : {}; } catch { /* form data */ }
  const p = url.pathname;

  // ── test control ──
  if (p === '/__test/reset') { reset(); return send(res, 200, {}); }
  if (p === '/__test/confirm') { const u = [...users.values()].find((x) => x.email === body.email); if (u) { u.confirmed = true; u.confirmedAt = new Date().toISOString(); } return send(res, 200, { ok: !!u }); }
  if (p === '/__test/expire-access') { for (const t of tokens.values()) t.exp = 1; return send(res, 200, {}); }
  if (p === '/__test/revoke-refresh') { refresh.clear(); return send(res, 200, {}); }
  if (p === '/__test/state') return send(res, 200, { users: [...users.values()].map((u) => u.email), refreshTokens: refresh.size });
  // What the browser lands on after clicking the confirmation link in the signup email (confirms + signs in).
  if (p === '/__test/signup-link') {
    const u = [...users.values()].find((x) => x.email === url.searchParams.get('email'));
    if (!u) return send(res, 404, {});
    u.confirmed = true; u.confirmedAt = new Date().toISOString();
    const s = issue(u);
    return send(res, 200, { hash: `#access_token=${s.access_token}&expires_in=${ACCESS_TTL}&refresh_token=${s.refresh_token}&token_type=bearer&type=signup` });
  }
  if (p === '/__test/recovery') {
    const u = users.get(recoveries.get(url.searchParams.get('email')));
    if (!u) return send(res, 404, {});
    const s = issue(u, { recovery: true });
    return send(res, 200, { hash: `#access_token=${s.access_token}&expires_in=${ACCESS_TTL}&refresh_token=${s.refresh_token}&token_type=bearer&type=recovery` });
  }

  // ── auth ──
  if (p === '/auth/v1/signup' && req.method === 'POST') {
    const email = String(body.email || '').toLowerCase();
    const existing = [...users.values()].find((u) => u.email === email);
    if (existing) return send(res, 200, { ...userView(existing), identities: [] }); // Supabase hides existing accounts
    const u = { id: crypto.randomUUID(), email, password: body.password, meta: body.data || {}, confirmed: false, createdAt: new Date().toISOString() };
    users.set(u.id, u);
    return send(res, 200, userView(u));
  }
  if (p === '/auth/v1/token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    if (grant === 'password') {
      const u = [...users.values()].find((x) => x.email === String(body.email || '').toLowerCase());
      if (!u || u.password !== body.password) return send(res, 400, { code: 400, error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (!u.confirmed) return send(res, 400, { code: 400, error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      return send(res, 200, issue(u));
    }
    if (grant === 'refresh_token') {
      const r = refresh.get(body.refresh_token);
      if (!r) return send(res, 400, { code: 400, error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token: Refresh Token Not Found' });
      refresh.delete(body.refresh_token);
      return send(res, 200, issue(users.get(r.userId)));
    }
    return send(res, 400, { msg: 'unsupported grant' });
  }
  if (p === '/auth/v1/user') {
    const u = authed(req);
    if (!u) return send(res, 401, { code: 401, msg: 'invalid JWT' });
    if (req.method === 'PUT') { if (body.password) u.password = body.password; if (body.data) u.meta = { ...u.meta, ...body.data }; }
    return send(res, 200, userView(u));
  }
  if (p === '/auth/v1/logout') {
    const t = tokens.get((req.headers.authorization || '').replace(/^Bearer /i, ''));
    if (t) for (const [k, v] of refresh) if (v.userId === t.userId) refresh.delete(k);
    return send(res, 204);
  }
  if (p === '/auth/v1/recover') {
    const u = [...users.values()].find((x) => x.email === String(body.email || '').toLowerCase());
    if (u) recoveries.set(u.email, u.id);
    return send(res, 200, {});     // identical response whether or not the account exists
  }
  if (p === '/auth/v1/resend') return send(res, 200, {});

  // ── data API: RLS-like behaviour is limited to "profiles are visible to their owner only" ──
  if (p.startsWith('/rest/v1/')) {
    const u = authed(req);
    if (!u) return send(res, 401, { code: 'PGRST301', message: 'JWT expired' });
    const table = p.replace('/rest/v1/', '');
    const wantsObject = (req.headers.accept || '').includes('vnd.pgrst.object');
    if (table === 'profiles') {
      const rows = [{ id: u.id, display_name: u.meta.display_name || u.email.split('@')[0], phone: u.meta.phone || null, email: u.email }];
      if (req.method === 'PATCH') { if (body.display_name) u.meta.display_name = body.display_name; return send(res, 204); }
      return wantsObject ? send(res, 200, rows[0]) : send(res, 200, rows);
    }
    if (wantsObject) return send(res, 406, { code: 'PGRST116', message: 'no rows' });
    // Set-returning functions (e.g. list_blocked) return [] in PostgREST when empty.
    return send(res, 200, table === 'rpc/list_blocked' || !table.startsWith('rpc/') ? [] : null);
  }

  return send(res, 404, { message: 'not found' });
});

server.listen(PORT, () => console.log(`mock supabase on :${PORT}`));
