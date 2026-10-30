import { test, expect } from '@playwright/test';

// Public homepage: navbar behaviour, phone slideshow, Find My Circle demo and SOS demo isolation.
// The backend is the stub from e2e/mock-supabase.mjs; visitors are signed out, so any data/RPC request would be a bug.
const WIDTHS = [1440, 1280, 1024, 768, 375];

async function openHome(page, width = 1440, height = 1000, { clock = false } = {}) {
  await page.setViewportSize({ width, height });
  if (clock) await page.clock.install();
  await page.goto('/');
  await expect(page.locator('.phone')).toBeVisible();
}

const activeSlide = (page) => page.evaluate(() => [...document.querySelectorAll('.phone-stage-item')].findIndex((x) => x.dataset.active === 'true'));
const activeDot = (page) => page.evaluate(() => [...document.querySelectorAll('.phone-dots button')].findIndex((x) => x.classList.contains('on')));

// ───────────── Navbar ─────────────
test.describe('navbar', () => {
  for (const w of WIDTHS) {
    test(`at ${w}px: fits, 68-76px tall, no horizontal overflow, labels never wrap`, async ({ page }) => {
      await openHome(page, w);
      const m = await page.evaluate(() => {
        const header = document.querySelector('.tk-header').getBoundingClientRect();
        const inner = document.querySelector('.tk-header-inner');
        const nav = document.querySelector('nav[aria-label="Main"]');
        const links = [...nav.querySelectorAll('.tk-nav-link')];
        return {
          h: header.height, headerOverflow: inner.scrollWidth - inner.clientWidth, pageOverflow: document.documentElement.scrollWidth - innerWidth,
          navShown: getComputedStyle(nav).display !== 'none', tall: links.filter((l) => l.getBoundingClientRect().height > 44).length,
          ys: new Set(links.map((l) => Math.round(l.getBoundingClientRect().top))).size,
        };
      });
      expect(m.h).toBeGreaterThanOrEqual(68);
      expect(m.h).toBeLessThanOrEqual(76);
      expect(m.headerOverflow).toBe(0);
      expect(m.pageOverflow).toBe(0);
      if (w >= 1280) {
        expect(m.navShown).toBe(true);
        expect(m.tall).toBe(0);
        expect(m.ys).toBe(1);                 // all six links on one line
        await expect(page.getByRole('link', { name: 'Get Me Home' }).first()).toBeVisible();
        await expect(page.getByRole('button', { name: /Language/ })).toBeVisible();
        await expect(page.getByRole('link', { name: 'Sign in' }).first()).toBeVisible();
      } else {
        expect(m.navShown).toBe(false);
        await expect(page.getByRole('button', { name: 'Open menu' })).toBeVisible();
      }
      await expect(page.getByRole('link', { name: 'Call emergency number 999' })).toBeVisible();   // always reachable
    });
  }

  test('active route is marked and shows the amber underline', async ({ page }) => {
    await openHome(page, 1440);
    const home = page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'Home' });
    await expect(home).toHaveAttribute('aria-current', 'page');
    await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveCount(1);
    await page.locator('nav[aria-label="Main"]').getByRole('link', { name: 'How it works' }).click();
    await expect(page).toHaveURL(/\/how/);
    await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveText('How it works');
  });

  test('language selector changes the app language', async ({ page }) => {
    await openHome(page, 1440);
    await page.getByRole('button', { name: /Language: English/ }).click();
    await page.getByRole('menuitemradio', { name: 'Kiswahili' }).click();
    await expect(page.getByRole('button', { name: /Language: Kiswahili/ })).toBeVisible();
    await expect(page.getByText(/Habari Wanjiru, umefika nyumbani salama/)).toBeVisible();   // Msaidizi preview follows the language
  });

  test('mobile menu: opens, traps/returns focus, Escape closes, closes after navigating, marks active route', async ({ page }) => {
    await openHome(page, 375, 800);
    const toggle = page.getByRole('button', { name: 'Open menu' });
    await toggle.click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('button', { name: 'Close menu' })).toHaveAttribute('aria-expanded', 'true');
    expect(await page.evaluate(() => document.getElementById('mobile-menu').contains(document.activeElement))).toBe(true);
    await expect(dialog.getByRole('link', { name: 'Home', exact: true })).toHaveAttribute('aria-current', 'page');

    await page.keyboard.press('Escape');
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Open menu' })).toBeFocused();

    await page.getByRole('button', { name: 'Open menu' }).click();
    await page.getByRole('dialog', { name: 'Menu' }).getByRole('link', { name: 'Safety' }).click();
    await expect(page).toHaveURL(/\/safety/);
    await expect(page.getByRole('dialog', { name: 'Menu' })).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  });

  test('mobile menu: language and Sign in are available, Tab stays inside', async ({ page }) => {
    await openHome(page, 768, 900);
    await page.getByRole('button', { name: 'Open menu' }).click();
    const dialog = page.getByRole('dialog', { name: 'Menu' });
    await expect(dialog.getByRole('link', { name: 'Sign in' })).toBeVisible();
    await dialog.getByRole('radio', { name: 'Sheng' }).click();
    await expect(dialog.getByRole('radio', { name: 'Sheng' })).toHaveAttribute('aria-checked', 'true');
    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press('Tab');
      const inside = await page.evaluate(() => {
        const a = document.activeElement;
        return a.id === 'mobile-menu' || document.getElementById('mobile-menu').contains(a) || a.getAttribute('aria-controls') === 'mobile-menu';
      });
      expect(inside).toBe(true);
    }
  });
});

// ───────────── Phone slideshow ─────────────
test.describe('phone slideshow', () => {
  test('three slides; prev/next/dots/arrow keys work and caption + dots stay in sync; phone size never changes', async ({ page }) => {
    await openHome(page, 1440);
    await page.getByRole('region', { name: /app preview/i }).hover();   // stop autoplay for deterministic checks
    const size = async () => { const b = await page.locator('.phone').boundingBox(); return `${Math.round(b.width)}x${Math.round(b.height)}`; };
    const base = await size();
    const captions = ['Stay connected with smart check-ins.', 'Share your location with people you trust.', 'Get help when you need it most.'];
    expect(await page.locator('.phone-stage-item').count()).toBe(3);

    for (let n = 0; n < 3; n += 1) {
      await page.getByRole('tab', { name: new RegExp(`slide ${n + 1} of 3`) }).click();
      expect(await activeSlide(page)).toBe(n);
      expect(await activeDot(page)).toBe(n);
      await expect(page.locator('.phone-caption')).toHaveText(captions[n]);
      expect(await size()).toBe(base);
    }
    await page.getByRole('button', { name: 'Next slide' }).click();       // wraps 3 -> 1
    expect(await activeSlide(page)).toBe(0);
    await page.getByRole('button', { name: 'Previous slide' }).click();   // wraps 1 -> 3
    expect(await activeSlide(page)).toBe(2);
    await page.getByRole('tab', { name: /slide 1 of 3/ }).focus();
    await page.keyboard.press('ArrowRight');             // from slide 3 wraps to slide 1
    expect(await activeSlide(page)).toBe(0);
    await page.keyboard.press('ArrowLeft');              // and back
    expect(await activeSlide(page)).toBe(2);
    // Hidden slides are removed from the accessibility tree and tab order.
    expect(await page.locator('.phone-stage-item[aria-hidden="true"]').count()).toBe(2);
  });

  test('Msaidizi slide keeps its original content and fits without overflow', async ({ page }) => {
    await openHome(page, 1440);
    await page.getByRole('region', { name: /app preview/i }).hover();
    await expect(page.getByRole('heading', { name: 'Msaidizi', exact: true })).toBeVisible();
    await expect(page.locator('.phone').getByText('Scripted example')).toBeVisible();
    await expect(page.getByRole('button', { name: /I’m okay/ })).toBeVisible();
    await page.getByRole('button', { name: /I’m okay/ }).click();
    await expect(page.getByText(/No one was notified/)).toBeVisible();
    for (let n = 0; n < 3; n += 1) {
      await page.getByRole('tab', { name: new RegExp(`slide ${n + 1} of 3`) }).click();
      const o = await page.evaluate(() => { const e = document.querySelector('.phone-stage-item[data-active="true"] .phone-slide'); return [e.scrollHeight - e.clientHeight, e.scrollWidth - e.clientWidth]; });
      expect(o).toEqual([0, 0]);
    }
  });

  test('autoplay advances every 6 s, pauses on hover and keyboard focus, resumes afterwards', async ({ page }) => {
    await openHome(page, 1440, 1000, { clock: true });
    expect(await activeSlide(page)).toBe(0);
    await page.clock.runFor(5500);
    expect(await activeSlide(page)).toBe(0);
    await page.clock.runFor(700);
    expect(await activeSlide(page)).toBe(1);

    await page.getByRole('region', { name: /app preview/i }).hover();
    await page.clock.runFor(20000);
    expect(await activeSlide(page)).toBe(1);                    // hovered: paused
    await page.mouse.move(5, 5);
    await page.clock.runFor(6100);
    expect(await activeSlide(page)).toBe(2);                    // resumed

    await page.getByRole('button', { name: 'Next slide' }).focus();
    await page.mouse.move(5, 5);
    await page.clock.runFor(20000);
    expect(await activeSlide(page)).toBe(2);                    // keyboard focus: paused
  });

  test('autoplay pauses while the tab is hidden', async ({ page }) => {
    await openHome(page, 1440, 1000, { clock: true });
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(20000);
    expect(await activeSlide(page)).toBe(0);
    await page.evaluate(() => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.clock.runFor(6100);
    expect(await activeSlide(page)).toBe(1);
  });

  test('reduced motion: no autoplay, manual navigation still works', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await openHome(page, 1440, 1000, { clock: true });
    await page.clock.runFor(30000);
    expect(await activeSlide(page)).toBe(0);
    await page.getByRole('button', { name: 'Next slide' }).click();
    expect(await activeSlide(page)).toBe(1);
  });

  test('timers are cleaned up when leaving the page (no updates after unmount)', async ({ page }) => {
    const errors = [];
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && /unmounted|memory leak/i.test(m.text())) errors.push(m.text()); });
    await openHome(page, 1440, 1000, { clock: true });
    await page.getByRole('link', { name: 'Sign in' }).first().click();
    await expect(page).toHaveURL(/\/login/);
    await page.clock.runFor(30000);
    expect(errors).toEqual([]);
  });
});

// ───────────── Find My Circle ─────────────
test.describe('Find My Circle demo', () => {
  async function toCircle(page) {
    await page.addInitScript(() => {
      window.__geoCalls = 0;
      const fake = { getCurrentPosition() { window.__geoCalls += 1; }, watchPosition() { window.__geoCalls += 1; return 1; }, clearWatch() {} };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: fake });
    });
    await openHome(page, 1440);
    await page.getByRole('region', { name: /app preview/i }).hover();
    await page.getByRole('tab', { name: /slide 2 of 3/ }).click();
  }

  test('shows the demo friends, marks the screen as demo, and never asks for geolocation', async ({ page }) => {
    await toCircle(page);
    await expect(page.getByText('Find My Circle', { exact: true })).toBeVisible();
    await expect(page.locator('.fmc-demo-tag')).toHaveText('Demo');
    const sheet = page.getByRole('region', { name: /Your circle \(demo\)/ });
    await expect(sheet.getByText('Wanjiru')).toBeVisible();
    await expect(sheet.getByText('Updated just now')).toBeVisible();
    await expect(sheet.getByText('Updated 2 minutes ago')).toBeVisible();
    await expect(sheet.getByText('Location unavailable')).toBeVisible();
    await expect(page.getByText(/needs each person.s consent/)).toBeVisible();
    // Achieng has no marker: unavailable locations are never drawn.
    await expect(page.getByRole('button', { name: /^Achieng,/ })).toHaveCount(0);
    expect(await page.evaluate(() => window.__geoCalls)).toBe(0);
  });

  test('selecting a marker highlights its card; selecting a card focuses its marker', async ({ page }) => {
    await toCircle(page);
    const sheet = page.getByRole('region', { name: /Your circle \(demo\)/ });
    await page.getByRole('button', { name: /^Brian, sharing/i }).click();
    await expect(sheet.locator('.fmc-row[data-selected="true"]')).toContainText('Brian');
    await expect(sheet.getByRole('button', { name: 'View Friend' })).toBeVisible();

    const worldLeft = () => page.locator('.fmc-world').evaluate((e) => e.style.left);
    const before = await worldLeft();
    await sheet.getByRole('button', { name: /Wanjiru/ }).first().click();
    await expect(page.getByRole('button', { name: /^Wanjiru, sharing/i })).toHaveAttribute('aria-pressed', 'true');
    await expect(sheet.locator('.fmc-row[data-selected="true"]')).toContainText('Wanjiru');
    expect(await worldLeft()).not.toBe(before);          // map panned to the selected friend
  });

  test('View Friend detail, Stop sharing demo, unavailable friend, My Location', async ({ page }) => {
    await toCircle(page);
    const sheet = page.getByRole('region', { name: /Your circle \(demo\)/ });
    await page.getByRole('button', { name: /^Wanjiru, sharing/i }).click();
    await sheet.getByRole('button', { name: 'View Friend' }).click();
    await expect(sheet.getByText(/You are sharing your location with them/)).toBeVisible();
    await sheet.getByRole('button', { name: /Stop sharing with Wanjiru \(demo\)/ }).click();
    await expect(sheet.getByText(/You stopped sharing with them/)).toBeVisible();
    await expect(page.getByText('Sharing with 1 person')).toBeVisible();
    await sheet.getByRole('button', { name: 'Circle' }).click();

    await sheet.getByRole('button', { name: /Achieng/ }).first().click();
    await expect(sheet.getByRole('button', { name: 'View Friend' })).toBeVisible();
    await sheet.getByRole('button', { name: 'View Friend' }).click();
    await expect(sheet.getByText(/never guesses a location/)).toBeVisible();
    await expect(sheet.getByRole('button', { name: /Stop sharing/ })).toHaveCount(0);

    await page.getByRole('button', { name: 'My location (demo)' }).click();
    await expect(page.getByRole('button', { name: 'My location (demo)' })).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => window.__geoCalls)).toBe(0);
  });

  test('"Open Live Map" goes to the real, authenticated page (visitors are sent to sign in)', async ({ page }) => {
    await toCircle(page);
    await page.getByRole('link', { name: 'Open Live Map' }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});

// ───────────── SOS demo isolation ─────────────
test.describe('SOS demo (public homepage)', () => {
  async function toSos(page) {
    const calls = { requests: [], geo: 0, tel: 0 };
    page.on('request', (r) => { if (/\/rest\/v1\/|\/rpc\//.test(r.url())) calls.requests.push(r.url()); });
    await page.addInitScript(() => {
      window.__geo = 0; window.__tel = 0;
      const fake = { getCurrentPosition() { window.__geo += 1; }, watchPosition() { window.__geo += 1; return 1; }, clearWatch() {} };
      Object.defineProperty(navigator, 'geolocation', { configurable: true, value: fake });
      document.addEventListener('click', (e) => { const a = e.target.closest?.('a[href^="tel:"]'); if (a) window.__tel += 1; }, true);
    });
    await openHome(page, 1440);
    await page.getByRole('region', { name: /app preview/i }).hover();
    await page.getByRole('tab', { name: /slide 3 of 3/ }).click();
    return calls;
  }
  const sosButton = (page) => page.getByRole('button', { name: /SOS demo: hold for three seconds/ });
  const assertIsolated = async (page, calls) => {
    expect(calls.requests).toEqual([]);                                           // no backend call of any kind
    expect(await page.evaluate(() => window.__geo)).toBe(0);                      // no geolocation
    expect(await page.evaluate(() => window.__tel)).toBe(0);                      // no emergency dial
  };

  test('content: heading, instructions, sample contacts, 999/112 references, separate real Get Help link', async ({ page }) => {
    await toSos(page);
    await expect(page.getByRole('heading', { name: 'Emergency SOS' })).toBeVisible();
    await expect(page.getByText('Help when you need it.')).toBeVisible();
    await expect(page.getByText('Press and hold for 3 seconds. Release to cancel.')).toBeVisible();
    await expect(page.getByText(/Trusted contacts/)).toBeVisible();
    await expect(page.locator('.sos-numbers')).toContainText('999');
    await expect(page.locator('.sos-numbers')).toContainText('112');
    await expect(page.locator('.phone a[href^="tel:"]')).toHaveCount(0);            // no dialling links inside the demo
    await expect(page.getByRole('link', { name: /Open Get Help/ })).toHaveAttribute('href', '/help');
  });

  test('releasing before 3 s cancels and nothing is shown or sent', async ({ page }) => {
    const calls = await toSos(page);
    const b = await sosButton(page).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(1300);
    await expect(page.getByText(/Keep holding/)).toBeVisible();
    const ring = await page.locator('.sos-bar').evaluate((e) => e.getAttribute('stroke-dashoffset'));
    expect(Number(ring)).toBeGreaterThan(0);                                       // progress ring is animating (not full)
    await page.mouse.up();
    await page.waitForTimeout(2600);                                               // past the 3 s mark
    await expect(page.getByText('Cancelled before activation. Nothing happened.')).toBeVisible();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await assertIsolated(page, calls);
  });

  test('mouse hold for 3 s shows a sample alert that states nothing was sent', async ({ page }) => {
    const calls = await toSos(page);
    const b = await sosButton(page).boundingBox();
    await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
    await page.mouse.down();
    await expect(page.getByRole('alertdialog', { name: 'Sample alert preview' })).toBeVisible({ timeout: 5000 });
    await page.mouse.up();
    await expect(page.getByText('No real alert was sent. No message, location or call was made.')).toBeVisible();
    await expect(page.getByText('Sample alert shown below. Nothing was sent.')).toBeVisible();
    await page.getByRole('button', { name: 'Reset demo' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByText('Press and hold for 3 seconds. Release to cancel.')).toBeVisible();
    await assertIsolated(page, calls);
  });

  test('keyboard hold (Space) and Escape-to-cancel work', async ({ page }) => {
    const calls = await toSos(page);
    await sosButton(page).focus();
    await page.keyboard.down('Space');
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await page.keyboard.up('Space');
    await expect(page.getByText('Cancelled before activation. Nothing happened.')).toBeVisible();

    await sosButton(page).focus();
    await page.keyboard.down('Space');
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
    await page.keyboard.up('Space');
    await assertIsolated(page, calls);
  });

  test('touch hold works, and autoplay stays paused during the hold', async ({ browser }) => {
    const ctx = await browser.newContext({ hasTouch: true, viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    const calls = { requests: [] };
    page.on('request', (r) => { if (/\/rest\/v1\/|\/rpc\//.test(r.url())) calls.requests.push(r.url()); });
    await page.goto('/');
    await page.getByRole('tab', { name: /slide 3 of 3/ }).click();
    // The phone sits below the hero text on mobile; centre it so the sticky header isn't over it.
    await sosButton(page).evaluate((el) => el.scrollIntoView({ block: 'center', behavior: 'instant' }));
    const b = await sosButton(page).boundingBox();
    const client = await ctx.newCDPSession(page);
    const pt = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    await client.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [pt] });
    await expect(page.getByRole('alertdialog')).toBeVisible({ timeout: 5000 });
    expect(await activeSlide(page)).toBe(2);                                       // not auto-advanced away mid-demo
    await client.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    expect(calls.requests).toEqual([]);
    await ctx.close();
  });

  test('the real Get Help page is separate and still requires sign-in', async ({ page }) => {
    await toSos(page);
    await page.getByRole('link', { name: /Open Get Help/ }).click();
    await expect(page).toHaveURL(/\/login/);
  });
});
