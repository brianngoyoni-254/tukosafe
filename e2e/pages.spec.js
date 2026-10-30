import { test, expect } from '@playwright/test';

// Smoke tests for every signed-in page against the stub backend (empty data set), plus the SOS hold behaviour.
// These catch runtime crashes and empty-state regressions. Multi-user behaviour is covered by supabase/tests/*.sql.
const MOCK = 'http://localhost:54399';
const PASSWORD = 'correct-horse-9';
const post = (path, data) => fetch(`${MOCK}${path}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data || {}) });

async function signedIn(page, name = 'Wanjiru Kamau') {
  const email = `pages-${Date.now()}-${Math.floor(Math.random() * 1e4)}@test.dev`;
  await page.goto('/signup');
  await page.locator('#name').fill(name);
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /create account/i }).click();
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible();
  await post('/__test/confirm', { email });
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(PASSWORD);
  await page.getByRole('button', { name: /^sign in/i }).click();
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello,');
  return email;
}

test.beforeEach(async () => { await post('/__test/reset'); });

const PAGES = [
  ['/', /Hello, Wanjiru/, /No trusted friends|You have no trusted friends/],
  ['/outing', /Opt in for one night/, /You have no active outing/],
  ['/checkin', /A calm check-in/, /Plan your journey home/],
  ['/help', /Ask quietly\. Or hold SOS/, /No alerts sent/],
  ['/contacts', /Who looks out for you/, /No trusted friends yet/],
  ['/contact', /No trusted friends yet/, null],
  ['/trust', /People First, AI Second/, /No trusted friends yet/],
  ['/map', /Where you are, on your terms/, /Nobody is sharing their location with you/],
  ['/profile', /Profile and settings/, /How you are notified/],
];

for (const [path, heading, empty] of PAGES) {
  test(`signed-in page ${path} renders with an honest empty state and no runtime errors`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await signedIn(page);
    await page.goto(path);
    await expect(page.getByText(heading).first()).toBeVisible();
    if (empty) await expect(page.getByText(empty).first()).toBeVisible();
    // No leftover demo people for a brand-new account.
    for (const fake of ['Achieng', 'Kevin', 'Westlands', 'Uhuru Gardens, Nairobi']) {
      await expect(page.getByText(fake, { exact: false })).toHaveCount(0);
    }
    expect(errors).toEqual([]);
  });
}

test('dashboard shows the signed-in user, not a hardcoded one', async ({ page }) => {
  await signedIn(page, 'Njeri Wambui');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Hello, Njeri');
  await expect(page.getByText('Wanjiru')).toHaveCount(0);
});

test.describe('SOS hold', () => {
  const alertCalls = (page) => {
    const calls = [];
    page.on('request', (r) => { if (r.url().includes('/rpc/create_alert')) calls.push(r.postData()); });
    return calls;
  };

  test('releasing before three seconds cancels: no alert is created', async ({ page }) => {
    await signedIn(page);
    const calls = alertCalls(page);
    await page.goto('/help');
    const sos = page.getByRole('button', { name: /hold for three seconds/i });
    const box = await sos.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1500);
    await expect(page.getByText(/Keep holding/)).toBeVisible();   // visible progress
    await page.mouse.up();
    await page.waitForTimeout(2500);                               // past the 3 s mark: must not fire
    expect(calls).toHaveLength(0);
    await expect(page.getByText(/Keep holding/)).toHaveCount(0);
  });

  test('keyboard: holding Space for three seconds creates exactly one alert; early release creates none', async ({ page }) => {
    await signedIn(page);
    const calls = alertCalls(page);
    await page.goto('/help');
    const sos = page.getByRole('button', { name: /hold for three seconds/i });
    await sos.focus();

    await page.keyboard.down('Space');
    await page.waitForTimeout(1200);
    await page.keyboard.up('Space');
    await page.waitForTimeout(500);
    expect(calls).toHaveLength(0);

    await page.keyboard.down('Space');
    await page.waitForTimeout(3600);
    await page.keyboard.up('Space');
    await expect.poll(() => calls.length).toBe(1);
    const payload = JSON.parse(calls[0]);
    expect(payload.p_kind).toBe('sos');
    expect(payload.p_lat).toBeNull();          // no location unless the user ticked the box
    expect(payload.p_client_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('the UI never claims delivery it cannot know about', async ({ page }) => {
    await signedIn(page);
    await page.goto('/help');
    await expect(page.getByText(/does not\s+contact police|does\s*not.*contact.*emergency/i).first()).toBeVisible();
    await expect(page.getByText(/SOS delivered/i)).toHaveCount(0);
  });
});
