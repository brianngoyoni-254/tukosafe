// Records where the key homepage elements sit (document coordinates) at several widths.
//   node scripts/layout-snapshot.mjs <out.json> [baseUrl]
// Used to prove a visual change did not move the phone, headline or buttons.
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';

const out = process.argv[2] || 'layout.json';
const base = process.argv[3] || 'http://localhost:5180';
const SELECTORS = {
  phone: '.phone',
  headline: 'h1',
  heroPrimaryCta: 'section a[href="/help"].bg-amber, section a[href="/help"]',
  carouselControls: '.phone-controls',
  caption: '.phone-caption',
};

const b = await chromium.launch();
const result = {};
for (const w of [1440, 1280, 1024, 768, 375]) {
  const p = await b.newPage({ viewport: { width: w, height: 900 } });
  await p.goto(base);
  await p.waitForSelector('.phone');
  await p.waitForTimeout(1200);        // let entrance animations finish
  result[w] = await p.evaluate((sel) => {
    const o = {};
    for (const [k, s] of Object.entries(sel)) {
      const r = document.querySelector(s)?.getBoundingClientRect();
      o[k] = r ? [r.x, r.y + scrollY, r.width, r.height].map((n) => Math.round(n * 10) / 10) : null;
    }
    o.pageWidth = document.documentElement.scrollWidth;
    o.pageHeight = document.documentElement.scrollHeight;
    return o;
  }, SELECTORS);
  await p.close();
}
await b.close();
writeFileSync(out, JSON.stringify(result, null, 2));
console.log(`wrote ${out}`);
