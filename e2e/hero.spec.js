import { test, expect } from '@playwright/test';

// Cinematic hero background: assets, cloud motion, stacking, performance-safe animation, reduced motion, layout stability.
const WIDTHS = [1440, 1280, 1024, 768, 375];

async function openHome(page, width = 1440, height = 900) {
  await page.setViewportSize({ width, height });
  await page.goto('/');
  await expect(page.locator('.phone')).toBeVisible();
  await expect(page.locator('.hero-bg')).toBeAttached();
}

test('background assets load (map + three cloud tiles) and are reasonably small', async ({ page }) => {
  const seen = {};
  page.on('response', (r) => { if (r.url().includes('/hero/')) seen[new URL(r.url()).pathname] = { status: r.status(), type: r.headers()['content-type'] }; });
  await openHome(page);
  await page.waitForLoadState('networkidle');
  for (const f of ['nairobi-map', 'clouds-large', 'clouds-medium', 'clouds-wisps']) {
    expect(seen[`/hero/${f}.webp`], f).toMatchObject({ status: 200, type: 'image/webp' });
  }
  // Optimised: the whole hero artwork stays well under 1 MB.
  const sizes = await page.evaluate(async () => {
    const out = [];
    for (const f of ['nairobi-map', 'clouds-large', 'clouds-medium', 'clouds-wisps']) out.push((await (await fetch(`/hero/${f}.webp`)).arrayBuffer()).byteLength);
    return out;
  });
  expect(sizes.reduce((a, b) => a + b, 0)).toBeLessThan(1_000_000);
});

test('three independent cloud layers with different speeds and offsets; transform + opacity only', async ({ page }) => {
  await openHome(page);
  const info = await page.evaluate(() => {
    const layers = ['large', 'medium', 'wisps'].map((v) => {
      const track = document.querySelector(`.cloud--${v} .cloud-track`); const cs = getComputedStyle(track);
      return { v, dur: parseFloat(cs.animationDuration), delay: parseFloat(cs.animationDelay), name: cs.animationName, img: cs.backgroundImage };
    });
    const props = new Set();
    for (const a of document.getAnimations()) {
      if (!a.effect?.target?.closest?.('.hero-bg')) continue;
      for (const kf of a.effect.getKeyframes()) Object.keys(kf).forEach((k) => { if (!['offset', 'easing', 'composite', 'computedOffset'].includes(k)) props.add(k); });
    }
    return { layers, props: [...props] };
  });
  const byName = Object.fromEntries(info.layers.map((l) => [l.v, l]));
  expect(byName.large.dur).toBe(90);       // 70-100 s
  expect(byName.medium.dur).toBe(58);      // 45-70 s
  expect(byName.wisps.dur).toBe(38);       // 30-50 s
  expect(new Set(info.layers.map((l) => l.delay)).size).toBe(3);        // different starting offsets
  expect(byName.large.name).toBe('cloud-x');
  expect(byName.medium.name).toBe('cloud-diag');                         // diagonal drift
  // Only compositor-friendly properties are animated: no layout, no paint-heavy properties.
  expect(info.props.sort()).toEqual(['opacity', 'transform', 'translate']);
  for (const l of info.layers) expect(l.img).toContain(`clouds-${l.v}.webp`);
});

test('clouds actually move: right-to-left (large) and diagonally (medium), continuously', async ({ page }) => {
  await openHome(page);
  const pos = () => page.evaluate(() => ['large', 'medium', 'wisps'].map((v) => {
    const m = new DOMMatrix(getComputedStyle(document.querySelector(`.cloud--${v} .cloud-track`)).transform); return [m.m41, m.m42];
  }));
  const a = await pos(); await page.waitForTimeout(2500); const b = await pos(); await page.waitForTimeout(2500); const c = await pos();
  for (let i = 0; i < 3; i += 1) {
    expect(b[i][0]).toBeLessThan(a[i][0]);            // moving left
    expect(c[i][0]).toBeLessThan(b[i][0]);            // still moving: continuous, not a one-off
  }
  expect(b[1][1]).toBeLessThan(a[1][1]);              // medium layer also drifts upward (diagonal)
  expect(Math.abs(b[0][0] - a[0][0])).toBeLessThan(Math.abs(b[2][0] - a[2][0]));   // wisps are faster than the big clouds
});

test('stacking: the artwork never intercepts clicks and sits behind navbar, text, buttons and phone', async ({ page }) => {
  await openHome(page);
  const r = await page.evaluate(() => {
    const pe = [...document.querySelectorAll('.hero-bg, .hero-bg *')].every((e) => getComputedStyle(e).pointerEvents === 'none');
    const hit = (sel) => { const b = document.querySelector(sel).getBoundingClientRect(); const e = document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2); return !!e && !e.closest('.hero-bg') && document.querySelector(sel).contains(e); };
    return { pe, phone: hit('.phone'), h1: hit('h1'), cta: hit('main section a[href="/help"]'), nav: hit('.tk-header .tk-cta') };
  });
  expect(r).toEqual({ pe: true, phone: true, h1: true, cta: true, nav: true });
  await page.getByRole('button', { name: 'Next slide' }).click();                 // slideshow still works over the artwork
  await expect(page.locator('.phone-stage-item[data-active="true"]')).toHaveAttribute('aria-label', /2 of 3/);
  await page.getByRole('link', { name: 'How it works' }).first().click();          // navigation still works
  await expect(page).toHaveURL(/\/how/);
});

for (const w of WIDTHS) {
  test(`at ${w}px the phone, headline and buttons do not move when the artwork is removed (layout-neutral)`, async ({ page }) => {
    await openHome(page, w);
    await page.waitForTimeout(1200);
    const rects = () => page.evaluate(() => ['.phone', 'h1', '.phone-controls', '.phone-caption', 'main section a[href="/help"]']
      .map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return [r.x, r.y + scrollY, r.width, r.height].map((n) => Math.round(n * 10) / 10); }));
    const withArt = await rects();
    const pageSize = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight]);
    await page.addStyleTag({ content: '.hero-bg { display: none !important; }' });
    expect(await rects()).toEqual(withArt);
    expect(await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.scrollHeight])).toEqual(pageSize);
    expect(pageSize[0], 'no horizontal scroll').toBe(w);
  });
}

test('responsive density: wisps are dropped and clouds calmer on phones; all layers on desktop', async ({ page }) => {
  await openHome(page, 1440);
  const shown = (v) => page.evaluate((x) => getComputedStyle(document.querySelector(`.cloud--${x}`)).display !== 'none', v);
  expect([await shown('large'), await shown('medium'), await shown('wisps')]).toEqual([true, true, true]);
  await openHome(page, 375);
  expect([await shown('large'), await shown('medium'), await shown('wisps')]).toEqual([true, true, false]);
});

test('reduced motion: nothing animates, but the map and a still cloud frame remain', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openHome(page);
  const r = await page.evaluate(() => ({
    running: document.getAnimations().filter((a) => a.effect?.target?.closest?.('.hero-bg') && a.playState === 'running').length,
    cloudOpacity: parseFloat(getComputedStyle(document.querySelector('.cloud--large')).opacity),
    map: getComputedStyle(document.querySelector('.hero-bg-map')).backgroundImage,
  }));
  expect(r.running).toBe(0);
  expect(r.cloudOpacity).toBeGreaterThan(0.3);
  expect(r.map).toContain('nairobi-map.webp');
});

test('animations pause when the tab is hidden and resume when it is shown', async ({ page }) => {
  await openHome(page);
  const state = () => page.evaluate(() => ({
    flag: document.querySelector('.hero-bg').dataset.paused,
    playState: getComputedStyle(document.querySelector('.cloud--large .cloud-track')).animationPlayState,
  }));
  expect(await state()).toEqual({ flag: 'false', playState: 'running' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await state()).toEqual({ flag: 'true', playState: 'paused' });
  await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => false }); document.dispatchEvent(new Event('visibilitychange')); });
  expect(await state()).toEqual({ flag: 'false', playState: 'running' });
});

test('animations pause while the hero is scrolled out of view', async ({ page }) => {
  await openHome(page, 1440, 700);
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => document.querySelector('.hero-bg').dataset.paused)).toBe('true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect.poll(() => page.evaluate(() => document.querySelector('.hero-bg').dataset.paused)).toBe('false');
});

test('navbar is translucent over the artwork on the home page and solid elsewhere; stays readable after scrolling', async ({ page }) => {
  await openHome(page, 1440);
  const header = () => page.evaluate(() => {
    const h = document.querySelector('.tk-header'); const cs = getComputedStyle(h);
    const alpha = (c) => { const m = c.match(/rgba?\(([^)]+)\)/); return m ? (m[1].split(',')[3] === undefined ? 1 : parseFloat(m[1].split(',')[3])) : 1; };
    return { overlay: h.dataset.overlay, scrolled: h.dataset.scrolled, alpha: alpha(cs.backgroundColor) , blur: cs.backdropFilter, bg: cs.backgroundImage, color: getComputedStyle(h.querySelector('.tk-nav-link')).color };
  });
  const top = await header();
  expect(top.overlay).toBe('true'); expect(top.scrolled).toBe('false');
  expect(top.blur).toContain('blur');                     // frosted glass on wide screens
  expect(top.bg).toContain('rgba');                       // translucent gradient, not a solid block
  expect(top.color).toMatch(/255, 255, 255|rgba\(255, 255, 255/);
  await page.evaluate(() => window.scrollTo({ top: 400, behavior: 'instant' }));
  await expect.poll(async () => (await header()).scrolled).toBe('true');
  await expect.poll(async () => (await header()).alpha).toBeGreaterThan(0.85);   // after its 0.25s fade
  await page.goto('/how');
  expect((await header()).overlay).toBe('false');
  // The active link keeps its amber underline on the translucent bar.
  await page.goto('/');
  await expect(page.locator('nav[aria-label="Main"] [aria-current="page"]')).toHaveText('Home');
});

test('decorative location markers are hidden from assistive tech and never use real data', async ({ page }) => {
  await page.addInitScript(() => { window.__geo = 0; Object.defineProperty(navigator, 'geolocation', { configurable: true, value: { getCurrentPosition() { window.__geo += 1; }, watchPosition() { window.__geo += 1; return 1; }, clearWatch() {} } }); });
  const requests = [];
  page.on('request', (r) => { if (/\/rest\/v1\/|\/rpc\//.test(r.url())) requests.push(r.url()); });
  await openHome(page);
  expect(await page.locator('.hero-bg[aria-hidden="true"] .loc').count()).toBeGreaterThanOrEqual(4);
  expect(await page.evaluate(() => window.__geo)).toBe(0);
  expect(requests).toEqual([]);
});
