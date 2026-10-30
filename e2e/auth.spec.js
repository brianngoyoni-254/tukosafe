import { test, expect } from '@playwright/test';

// Browser tests for authentication and session persistence.
// Backend = e2e/mock-supabase.mjs (see the header there for what this does and does not prove).
const MOCK = 'http://localhost:54399';
const PASSWORD = 'correct-horse-9';
const uniq = (tag) => `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.dev`;
const post = (path, data) => fetch(`${MOCK}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) });

async function register(page, { name, email, password = PASSWORD }) {
  await page.goto('/signup');
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
}

const confirm = (email) => post('/__test/confirm', { email });

async function login(page, { email, password = PASSWORD, remember }) {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(password);
  const box = page.getByLabel('Remember me on this device');
  if (remember) await box.check(); else await box.uncheck();
  await page.getByRole('button', { name: /^sign in/i }).click();
}

const greeting = (page, first) => expect(page.getByRole('heading', { level: 1 })).toContainText(`Hello, ${first}`);

// What the browser actually holds, split by storage area.
const storage = (page) => page.evaluate(() => ({
  local: Object.fromEntries(Object.entries(localStorage)),
  session: Object.fromEntries(Object.entries(sessionStorage)),
}));

async function newUser(page, tag, name) {
  const email = uniq(tag);
  await register(page, { name, email });
  await confirm(email);
  return email;
}

test.beforeEach(async () => { await post('/__test/reset'); });

test('registration requires email verification before login', async ({ page }) => {
  const email = uniq('reg');
  await register(page, { name: 'Wanjiru Kamau', email });
  // Unverified accounts cannot sign in.
  await login(page, { email, remember: true });
  await expect(page.getByRole('alert')).toContainText(/verify your email/i);
  await expect(page).toHaveURL(/\/login/);
  await confirm(email);
  await page.getByRole('button', { name: /^sign in/i }).click();
  await greeting(page, 'Wanjiru');
});

test('email verification link confirms the account and signs the user straight in', async ({ page }) => {
  const email = uniq('verify');
  await register(page, { name: 'Njeri Wambui', email });
  const { hash } = await (await fetch(`${MOCK}/__test/signup-link?email=${encodeURIComponent(email)}`)).json();
  await page.goto(`/login${hash}`);                       // the link target from the confirmation email
  await expect(page).toHaveURL(/\/$/);
  await greeting(page, 'Njeri');
  // The profile row was created at registration, so the dashboard shows the registered name.
  await page.goto('/profile');
  await expect(page.getByLabel('Name')).toHaveValue('Njeri Wambui');
});

test('an expired confirmation link explains itself and offers to resend', async ({ page }) => {
  await page.goto('/login#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired');
  await expect(page.getByRole('alert')).toContainText(/invalid or has expired/i);
  await expect(page.getByRole('button', { name: /enter your email above to resend/i })).toBeVisible();
  await page.locator('#email').fill('someone@test.dev');
  await page.getByRole('button', { name: 'Resend confirmation email' }).click();
  await expect(page.getByText(/Confirmation email sent/)).toBeVisible();
});

test('a signed-in user opening /login or /signup is sent to the app, not shown the form', async ({ page }) => {
  const email = await newUser(page, 'already', 'Kevin Mwangi');
  await login(page, { email, remember: true });
  await greeting(page, 'Kevin');
  await page.goto('/login');
  await expect(page).toHaveURL(/\/$/);
  await greeting(page, 'Kevin');
});

test('the sign-up page no longer claims data stays in the browser', async ({ page }) => {
  await page.goto('/signup');
  await expect(page.getByText(/stays in this browser|Nothing is sent to a server/i)).toHaveCount(0);
  await expect(page.getByText(/email you a link to confirm/i)).toBeVisible();
});

test('registering an existing email does not create a session or reveal anything extra', async ({ page }) => {
  const email = await newUser(page, 'dup', 'Brian Otieno');
  await page.goto('/signup');
  await page.locator('#name').fill('Someone Else');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('alert')).toContainText(/already exists/i);
});

test('login: wrong password is rejected, correct password signs in, password is never stored', async ({ page }) => {
  const email = await newUser(page, 'login', 'Achieng Odhiambo');
  await login(page, { email, password: 'wrong-password-1', remember: true });
  await expect(page.getByRole('alert')).toContainText(/incorrect email or password/i);

  await login(page, { email, remember: true });
  await greeting(page, 'Achieng');
  const s = await storage(page);
  const blob = JSON.stringify(s);
  expect(blob).not.toContain(PASSWORD);
});

test('password visibility toggle works', async ({ page }) => {
  await page.goto('/login');
  const pw = page.locator('#password');
  await pw.fill('secret-value-1');
  await expect(pw).toHaveAttribute('type', 'password');
  await page.getByRole('button', { name: 'Show password' }).click();
  await expect(pw).toHaveAttribute('type', 'text');
});

test('protected routes redirect to login and return to the requested page after sign-in', async ({ page }) => {
  const email = await newUser(page, 'guard', 'Kevin Mwangi');
  for (const path of ['/map', '/trust', '/outing', '/checkin', '/help', '/profile']) {
    await page.goto(path);
    await expect(page).toHaveURL(/\/login/);
  }
  await page.goto('/map');
  await expect(page).toHaveURL(/\/login/);
  await login(page, { email, remember: false });
  await expect(page).toHaveURL(/\/map/);
});

test('logout clears the session from both storage areas and re-locks protected routes', async ({ page }) => {
  const email = await newUser(page, 'logout', 'Wanjiru Kamau');
  await login(page, { email, remember: true });
  await greeting(page, 'Wanjiru');
  expect(Object.keys((await storage(page)).local)).toContain('tukosafe.auth');

  await page.getByRole('button', { name: /Wanjiru/ }).first().click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await expect(page).toHaveURL(/\/$/);
  const s = await storage(page);
  expect(Object.keys(s.local)).not.toContain('tukosafe.auth');
  expect(Object.keys(s.session)).not.toContain('tukosafe.auth');

  await page.goto('/trust');
  await expect(page).toHaveURL(/\/login/);
  // The server also revoked the refresh token.
  const state = await (await fetch(`${MOCK}/__test/state`)).json();
  expect(state.refreshTokens).toBe(0);
});

test('Remember Me ENABLED: session lives in localStorage and survives a browser restart', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const page = await ctx1.newPage();
  const email = await newUser(page, 'rem-on', 'Wanjiru Kamau');
  await login(page, { email, remember: true });
  await greeting(page, 'Wanjiru');

  const s = await storage(page);
  expect(Object.keys(s.local)).toContain('tukosafe.auth');
  expect(Object.keys(s.session)).not.toContain('tukosafe.auth');
  expect(s.local['tukosafe.remember']).toBe('1');

  // "Restart the browser": sessionStorage and in-memory state are lost; cookies + localStorage survive.
  const persisted = await ctx1.storageState();
  await ctx1.close();
  const ctx2 = await browser.newContext({ storageState: persisted });
  const page2 = await ctx2.newPage();
  await page2.goto('/');
  await greeting(page2, 'Wanjiru');
  await page2.goto('/trust');
  await expect(page2).toHaveURL(/\/trust/);
  await ctx2.close();
});

test('Remember Me DISABLED: session lives in sessionStorage only and is gone after a browser restart', async ({ browser }) => {
  const ctx1 = await browser.newContext();
  const page = await ctx1.newPage();
  const email = await newUser(page, 'rem-off', 'Brian Otieno');
  await login(page, { email, remember: false });
  await greeting(page, 'Brian');

  const s = await storage(page);
  expect(Object.keys(s.local)).not.toContain('tukosafe.auth');
  expect(Object.keys(s.session)).toContain('tukosafe.auth');
  expect(s.local['tukosafe.remember']).toBe('0');

  // A reload inside the same browser session keeps you signed in...
  await page.reload();
  await greeting(page, 'Brian');

  // ...but a restart does not.
  const persisted = await ctx1.storageState();
  expect(JSON.stringify(persisted)).not.toContain('"tukosafe.auth"');
  await ctx1.close();
  const ctx2 = await browser.newContext({ storageState: persisted });
  const page2 = await ctx2.newPage();
  await page2.goto('/trust');
  await expect(page2).toHaveURL(/\/login/);
  await ctx2.close();
});

test('switching the Remember Me choice moves the session between storage areas (no stale copy left behind)', async ({ page }) => {
  const email = await newUser(page, 'switch', 'Kevin Mwangi');
  await login(page, { email, remember: true });
  await greeting(page, 'Kevin');
  await page.getByRole('button', { name: /Kevin/ }).first().click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await login(page, { email, remember: false });
  await greeting(page, 'Kevin');
  const s = await storage(page);
  expect(Object.keys(s.local)).not.toContain('tukosafe.auth');
  expect(Object.keys(s.session)).toContain('tukosafe.auth');
});

test('session expiry: an expired access token is refreshed transparently', async ({ page }) => {
  const email = await newUser(page, 'refresh', 'Achieng Odhiambo');
  await login(page, { email, remember: true });
  await greeting(page, 'Achieng');
  const before = (await storage(page)).local['tukosafe.auth'];

  // Make the stored access token look expired (as it would after sitting idle).
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tukosafe.auth'));
    s.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem('tukosafe.auth', JSON.stringify(s));
  });
  await page.reload();
  await greeting(page, 'Achieng');
  const after = (await storage(page)).local['tukosafe.auth'];
  expect(JSON.parse(after).refresh_token).not.toBe(JSON.parse(before).refresh_token);   // rotated
  expect(JSON.parse(after).expires_at).toBeGreaterThan(Math.floor(Date.now() / 1000));
});

test('session expiry: when the refresh token is also dead the user is signed out and protected routes lock', async ({ page }) => {
  const email = await newUser(page, 'expired', 'Wanjiru Kamau');
  await login(page, { email, remember: true });
  await greeting(page, 'Wanjiru');
  await post('/__test/revoke-refresh');
  await page.evaluate(() => {
    const s = JSON.parse(localStorage.getItem('tukosafe.auth'));
    s.expires_at = Math.floor(Date.now() / 1000) - 60;
    localStorage.setItem('tukosafe.auth', JSON.stringify(s));
  });
  await page.goto('/trust');
  await expect(page).toHaveURL(/\/login/);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1 })).not.toContainText('Hello,');
});

test('password reset: request is non-enumerating, link sets a new password, old password stops working', async ({ page }) => {
  const email = await newUser(page, 'reset', 'Brian Otieno');

  // Same confirmation for a real and a non-existent account.
  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(`nobody-${Date.now()}@test.dev`);
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  await page.goto('/forgot-password');
  await page.getByLabel('Email').fill(email);
  await page.getByRole('button', { name: /send reset link/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();

  // Open the recovery link the stub "emailed".
  const { hash } = await (await fetch(`${MOCK}/__test/recovery?email=${encodeURIComponent(email)}`)).json();
  await page.goto(`/reset-password${hash}`);
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible();
  await page.getByLabel('New password').fill('a-brand-new-pass-7');
  await page.getByRole('button', { name: /update password/i }).click();
  await greeting(page, 'Brian');

  await page.getByRole('button', { name: /Brian/ }).first().click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();

  await login(page, { email, password: PASSWORD, remember: true });
  await expect(page.getByRole('alert')).toContainText(/incorrect email or password/i);
  await login(page, { email, password: 'a-brand-new-pass-7', remember: true });
  await greeting(page, 'Brian');
});

test('reset page without a valid recovery link says the link is invalid', async ({ page }) => {
  await page.goto('/reset-password');
  await expect(page.getByRole('heading', { name: 'Link expired' })).toBeVisible();
});

test('multiple browser contexts: two accounts stay isolated and signing one out does not affect the other', async ({ browser }) => {
  const ctxA = await browser.newContext();
  const ctxB = await browser.newContext();
  const a = await ctxA.newPage();
  const b = await ctxB.newPage();
  const emailA = await newUser(a, 'iso-a', 'Wanjiru Kamau');
  const emailB = await newUser(b, 'iso-b', 'Brian Otieno');
  await login(a, { email: emailA, remember: true });
  await login(b, { email: emailB, remember: true });
  await greeting(a, 'Wanjiru');
  await greeting(b, 'Brian');

  // Each browser holds only its own session.
  const sa = JSON.parse((await storage(a)).local['tukosafe.auth']);
  const sb = JSON.parse((await storage(b)).local['tukosafe.auth']);
  expect(sa.user.email).toBe(emailA);
  expect(sb.user.email).toBe(emailB);
  expect(JSON.stringify(await storage(a))).not.toContain(emailB);
  expect(JSON.stringify(await storage(b))).not.toContain(emailA);

  // Profile pages show only their own details.
  await a.goto('/profile');
  await expect(a.getByText(emailA).first()).toBeVisible();
  await expect(a.getByText(emailB)).toHaveCount(0);
  await b.goto('/profile');
  await expect(b.getByText(emailB).first()).toBeVisible();
  await expect(b.getByText(emailA)).toHaveCount(0);

  // Signing A out leaves B signed in.
  await a.getByRole('button', { name: /Wanjiru/ }).first().click();
  await a.getByRole('menuitem', { name: /sign out/i }).click();
  await b.reload();
  await expect(b.getByRole('heading', { name: 'Profile and settings' })).toBeVisible();
  await ctxA.close(); await ctxB.close();
});

test('account isolation in one browser: signing in as another user shows no trace of the previous user', async ({ page }) => {
  const emailA = await newUser(page, 'seq-a', 'Wanjiru Kamau');
  const emailB = await newUser(page, 'seq-b', 'Brian Otieno');
  await login(page, { email: emailA, remember: true });
  await greeting(page, 'Wanjiru');
  await page.getByRole('button', { name: /Wanjiru/ }).first().click();
  await page.getByRole('menuitem', { name: /sign out/i }).click();
  await login(page, { email: emailB, remember: true });
  await greeting(page, 'Brian');
  await expect(page.getByText('Wanjiru')).toHaveCount(0);
  expect(JSON.stringify(await storage(page))).not.toContain(emailA);
});
