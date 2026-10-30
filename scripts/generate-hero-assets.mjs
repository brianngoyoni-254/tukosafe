// Generates the homepage hero artwork. Everything is ORIGINAL procedural art (no third-party imagery or map tiles),
// so there is nothing to license:
//   public/hero/nairobi-map.webp      satellite-style Nairobi region: vegetation, relief, illuminated roads, city lights
//   public/hero/clouds-large.webp     seamless tile, big soft clouds       (alpha)
//   public/hero/clouds-medium.webp    seamless tile, scattered clouds      (alpha)
//   public/hero/clouds-wisps.webp     seamless tile, thin wisps            (alpha)
//
//   npm run build:hero      (needs Chromium: npx playwright install chromium)
//
// The geography is a stylised, approximate layout (main highways radiating from the city, the national park to the
// south, the airport to the south-east). It is decorative, not survey data.
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'hero');
mkdirSync(outDir, { recursive: true });

// ───────────────────────── runs inside Chromium ─────────────────────────
function renderInBrowser(job) {
  const rngFactory = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const smooth = (t) => t * t * (3 - 2 * t);
  const lerp = (a, b, t) => a + (b - a) * t;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const smoothstep = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function makeNoise(seed, period = 0) {
    const h = (ix, iy) => {
      if (period) { ix = ((ix % period) + period) % period; iy = ((iy % period) + period) % period; }
      const s = Math.sin(ix * 127.1 + iy * 311.7 + seed * 74.7) * 43758.5453;
      return s - Math.floor(s);
    };
    return (x, y) => {
      const ix = Math.floor(x); const iy = Math.floor(y);
      const fx = smooth(x - ix); const fy = smooth(y - iy);
      return lerp(lerp(h(ix, iy), h(ix + 1, iy), fx), lerp(h(ix, iy + 1), h(ix + 1, iy + 1), fx), fy);
    };
  }
  function makeFbm(seed, octaves) {
    const ns = [];
    for (let o = 0; o < octaves; o += 1) ns.push(makeNoise(seed + o * 13, 0));
    return (x, y) => {
      let sum = 0; let amp = 0.5; let norm = 0; let f = 1;
      for (let o = 0; o < octaves; o += 1) { sum += amp * ns[o](x * f, y * f); norm += amp; amp *= 0.5; f *= 2; }
      return sum / norm;
    };
  }

  // ─────────────── clouds (seamless tiles with alpha) ───────────────
  if (job.kind === 'clouds') {
    const { w, h, seed, cells, aspect, octaves, lo, hi, maxA, warp, tint } = job;
    const c = document.createElement('canvas'); c.width = w; c.height = h;
    const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h);
    const nx = Math.round(cells * aspect); const ny = cells;
    const fbm = makeFbm(seed, octaves);
    // Blend the field with copies shifted by one period so it wraps seamlessly in both axes.
    const field = (u, v) => {
      const a = fbm(u * nx, v * ny); const b = fbm((u - 1) * nx, v * ny); const c2 = fbm(u * nx, (v - 1) * ny); const d = fbm((u - 1) * nx, (v - 1) * ny);
      return lerp(lerp(a, b, u), lerp(c2, d, u), v);
    };
    const warpN = makeFbm(seed + 91, 3);
    for (let y = 0; y < h; y += 1) {
      for (let x = 0; x < w; x += 1) {
        const u = x / w; const v = y / h;
        const wu = u + (warpN(u * 3 * aspect, v * 3) - 0.5) * warp; const wv = v + (warpN(u * 3 * aspect + 7, v * 3 + 7) - 0.5) * warp;
        const d = field(((wu % 1) + 1) % 1, ((wv % 1) + 1) % 1);
        const cov = smoothstep(lo, hi, d);
        const dl = field((((wu - 0.012) % 1) + 1) % 1, (((wv - 0.012) % 1) + 1) % 1);
        const light = clamp(0.62 + (d - dl) * 5.5, 0, 1);              // lit from the upper left
        const i = (y * w + x) * 4;
        img.data[i] = lerp(tint[0][0], tint[1][0], light);
        img.data[i + 1] = lerp(tint[0][1], tint[1][1], light);
        img.data[i + 2] = lerp(tint[0][2], tint[1][2], light);
        img.data[i + 3] = 255 * cov * maxA * (0.55 + 0.45 * d);
      }
    }
    ctx.putImageData(img, 0, 0);
    return c.toDataURL('image/webp', job.quality);
  }

  // ─────────────── Nairobi satellite-style night map ───────────────
  const { W, H } = job;
  const rnd = rngFactory(254);
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const ctx = c.getContext('2d');
  const P = (p) => [p[0] * W, p[1] * H];

  // 1. vegetation + relief: ridged hills, canopy grain, dry savannah patches
  const elevN = makeFbm(11, 7); const ridgeN = makeFbm(53, 5); const moistN = makeFbm(37, 4); const canopyN = makeFbm(71, 3);
  const elev = new Float32Array(W * H);
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const r = 1 - Math.abs(2 * ridgeN(x / 210, y / 210) - 1);
      elev[y * W + x] = elevN(x / 430, y / 430) * 0.72 + r * r * 0.28;
    }
  }
  const img = ctx.createImageData(W, H);
  const stops = [[0.0, [12, 62, 50]], [0.30, [16, 78, 54]], [0.48, [30, 104, 60]], [0.62, [52, 130, 66]], [0.78, [30, 94, 52]], [1.0, [14, 58, 40]]];
  const ramp = (e) => { for (let s = 1; s < stops.length; s += 1) if (e <= stops[s][0]) { const t = (e - stops[s - 1][0]) / (stops[s][0] - stops[s - 1][0]); return stops[s - 1][1].map((v, k) => lerp(v, stops[s][1][k], t)); } return stops[stops.length - 1][1]; };
  for (let y = 0; y < H; y += 1) {
    for (let x = 0; x < W; x += 1) {
      const e = elev[y * W + x];
      const col = ramp(e);
      const m = moistN(x / 330, y / 330);
      const dry = smoothstep(0.5, 0.7, m) * 0.6;
      const ex = elev[y * W + Math.min(W - 1, x + 3)] - elev[y * W + Math.max(0, x - 3)];
      const ey = elev[Math.min(H - 1, y + 3) * W + x] - elev[Math.max(0, y - 3) * W + x];
      const shade = clamp(1 + (-ex - ey) * 26, 0.5, 1.6);
      const canopy = 0.82 + canopyN(x / 5.5, y / 5.5) * 0.36;           // fine tree-canopy texture
      const i = (y * W + x) * 4;
      img.data[i] = lerp(col[0], 112, dry) * shade * canopy;
      img.data[i + 1] = lerp(col[1], 98, dry * 0.85) * shade * canopy;
      img.data[i + 2] = lerp(col[2], 52, dry) * shade * canopy;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // 2. farmland / plot patchwork
  for (let n = 0; n < 6500; n += 1) {
    const x = rnd() * W; const y = rnd() * H; const s = 5 + rnd() * 28;
    ctx.save(); ctx.translate(x, y); ctx.rotate(Math.floor(rnd() * 3) * 0.5 + (rnd() - 0.5) * 0.1);
    ctx.fillStyle = rnd() < 0.45 ? `rgba(140,170,90,${0.05 + rnd() * 0.08})` : rnd() < 0.5 ? `rgba(6,28,20,${0.1 + rnd() * 0.12})` : `rgba(120,100,60,${0.04 + rnd() * 0.06})`;
    ctx.fillRect(-s, -s * (0.4 + rnd() * 0.6), s * 2, s * (0.8 + rnd() * 0.6));
    ctx.restore();
  }

  // 3. night grading of the terrain (done BEFORE any lights so roads stay a true amber)
  ctx.save(); ctx.globalCompositeOperation = 'multiply'; ctx.fillStyle = 'rgb(86,136,168)'; ctx.fillRect(0, 0, W, H); ctx.restore();
  ctx.save(); ctx.globalCompositeOperation = 'soft-light';
  const gr = ctx.createLinearGradient(0, 0, W, H); gr.addColorStop(0, 'rgba(8,48,96,0.6)'); gr.addColorStop(1, 'rgba(8,112,112,0.45)'); ctx.fillStyle = gr; ctx.fillRect(0, 0, W, H); ctx.restore();

  // 4. places and roads (stylised layout)
  const city = [0.60, 0.56];
  const towns = [[0.40, 0.21, 1], [0.79, 0.21, 1], [0.40, 0.52, 0.9], [0.86, 0.88, 0.9], [0.30, 0.72, 0.7], [0.66, 0.40, 0.55], [0.55, 0.70, 0.6]];
  const roads = {
    thika: [city, [0.64, 0.46], [0.70, 0.36], [0.76, 0.27], [0.80, 0.21], [0.90, 0.08], [1.02, -0.03]],
    mombasa: [city, [0.65, 0.62], [0.72, 0.67], [0.78, 0.78], [0.84, 0.89], [0.92, 1.03]],
    waiyaki: [city, [0.53, 0.54], [0.45, 0.52], [0.40, 0.52], [0.28, 0.47], [0.15, 0.42], [-0.02, 0.36]],
    limuru: [city, [0.57, 0.48], [0.52, 0.38], [0.46, 0.28], [0.40, 0.21], [0.36, 0.10], [0.32, -0.03]],
    ngong: [city, [0.56, 0.62], [0.49, 0.68], [0.40, 0.75], [0.30, 0.72], [0.20, 0.86], [0.12, 1.03]],
    northernBypass: [[0.40, 0.23], [0.50, 0.19], [0.62, 0.21], [0.72, 0.25], [0.79, 0.23]],
    easternBypass: [[0.79, 0.23], [0.755, 0.42], [0.775, 0.60], [0.80, 0.76], [0.86, 0.88]],
    southernBypass: [[0.40, 0.54], [0.43, 0.66], [0.52, 0.72], [0.66, 0.72], [0.78, 0.76]],
    jogoo: [city, [0.66, 0.54], [0.72, 0.52], [0.80, 0.50], [0.92, 0.44], [1.03, 0.40]],
    lang: [city, [0.55, 0.57], [0.48, 0.60], [0.42, 0.58], [0.36, 0.62], [0.28, 0.58]],
  };
  const secondary = ['jogoo', 'lang'];

  // Organic polyline: resample, add noise displacement, return smooth points in pixels.
  const wobN = makeNoise(5);
  const wob = (pts, amp, scale) => {
    const q = pts.map(P); const out = [];
    for (let i = 0; i < q.length - 1; i += 1) {
      const dx = q[i + 1][0] - q[i][0]; const dy = q[i + 1][1] - q[i][1]; const len = Math.hypot(dx, dy); const n = Math.max(2, Math.floor(len / 12));
      for (let s = 0; s < n; s += 1) {
        const t = s / n; const x = q[i][0] + dx * t; const y = q[i][1] + dy * t;
        const nx = (dy / len) * (wobN(x / scale, y / scale) - 0.5) * 2 * amp; const ny = (-dx / len) * (wobN(x / scale + 40, y / scale + 40) - 0.5) * 2 * amp;
        out.push([x + nx, y + ny]);
      }
    }
    out.push(q[q.length - 1]);
    return out;
  };
  const stroke = (pts, style, width) => { ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]); for (let i = 1; i < pts.length - 1; i += 1) ctx.quadraticCurveTo(pts[i][0], pts[i][1], (pts[i][0] + pts[i + 1][0]) / 2, (pts[i][1] + pts[i + 1][1]) / 2); ctx.lineTo(pts[pts.length - 1][0], pts[pts.length - 1][1]); ctx.strokeStyle = style; ctx.lineWidth = width; ctx.stroke(); };
  const roadPts = {}; Object.entries(roads).forEach(([k, v]) => { roadPts[k] = wob(v, 11, 120); });

  // water: wobbling rivers with a lighter bank line, lakes
  ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  const river = (pts, w1) => { const p = wob(pts, 22, 90); stroke(p, 'rgba(10,46,86,0.95)', w1 + 3); stroke(p, 'rgba(24,96,150,0.95)', w1); stroke(p, 'rgba(130,200,235,0.5)', Math.max(1.2, w1 * 0.28)); };
  river([[0.60, 1.03], [0.69, 0.93], [0.77, 0.86], [0.88, 0.79], [1.03, 0.70]], 11);
  river([[0.46, 0.50], [0.55, 0.57], [0.64, 0.58], [0.73, 0.54], [0.84, 0.50], [1.03, 0.47]], 6);
  river([[0.28, 0.12], [0.37, 0.30], [0.46, 0.36], [0.55, 0.43]], 5);
  river([[0.20, 0.64], [0.31, 0.60], [0.42, 0.66]], 4);
  [[0.43, 0.655, 0.02, 0.014, 0.4], [0.18, 0.30, 0.012, 0.009, -0.3], [0.93, 0.25, 0.014, 0.01, 0.6]].forEach(([x, y, rx, ry, a]) => { ctx.beginPath(); ctx.ellipse(x * W, y * H, rx * W, ry * H, a, 0, 6.3); ctx.fillStyle = 'rgba(16,76,128,0.95)'; ctx.fill(); ctx.strokeStyle = 'rgba(130,200,235,0.45)'; ctx.lineWidth = 1.6; ctx.stroke(); });
  ctx.restore();

  // national park (south): darker, fenced, almost no lights
  ctx.save();
  ctx.beginPath(); ctx.ellipse(0.52 * W, 0.82 * H, 0.14 * W, 0.075 * H, -0.08, 0, 6.3);
  ctx.fillStyle = 'rgba(2,30,18,0.5)'; ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,80,0.35)'; ctx.lineWidth = 1.8; ctx.setLineDash([12, 9]); ctx.stroke();
  ctx.restore();

  // dim the land under built-up areas so light pops
  const dark = (cx, cy, r, a) => { const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(6,14,24,${a})`); g.addColorStop(1, 'rgba(6,14,24,0)'); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); };
  dark(...P(city), 0.2 * W, 0.7);
  towns.forEach(([x, y, s]) => dark(x * W, y * H, 0.06 * W * s, 0.6));

  // the national park ellipse (also used to keep streets and lights out of it)
  const inPark = (x, y) => ((x / W - 0.52) / 0.14) ** 2 + ((y / H - 0.82) / 0.075) ** 2 < 1;

  // 5. street grids: orthogonal tree-like branches, dense near the city
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const names = Object.keys(roadPts);
  const gridAng = (x, y) => (makeNoise(9)(x / 600, y / 600) - 0.5) * 1.4;
  for (let n = 0; n < 2600; n += 1) {
    const pts = roadPts[names[Math.floor(rnd() * names.length)]]; const base = pts[Math.floor(rnd() * pts.length)];
    let x = base[0]; let y = base[1];
    const distCity = Math.hypot(x / W - city[0], (y / H - city[1]) * 0.6);
    const dense = distCity < 0.16;
    if (!dense && rnd() > 0.45) continue;
    if (inPark(x, y)) continue;
    let ang = gridAng(x, y) + (rnd() < 0.5 ? 0 : Math.PI / 2) + (rnd() < 0.5 ? Math.PI : 0) + (rnd() - 0.5) * 0.5;
    const len = dense ? 24 + rnd() * 110 : 24 + rnd() * 80;
    ctx.beginPath(); ctx.moveTo(x, y);
    for (let s = 0; s < len; s += 9) {
      if (rnd() < 0.07) ang += (rnd() < 0.5 ? 1 : -1) * Math.PI / 2;     // grid-like right-angle turns
      ang += (rnd() - 0.5) * 0.12; x += Math.cos(ang) * 9; y += Math.sin(ang) * 9; ctx.lineTo(x, y);
    }
    ctx.strokeStyle = dense ? `rgba(255,140,40,${0.13 + rnd() * 0.2})` : 'rgba(255,140,40,0.1)'; ctx.lineWidth = dense ? 1 : 0.8; ctx.stroke();
  }
  ctx.restore();

  // 6. highways with amber illumination (wide glow, body, hot core)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  Object.entries(roadPts).forEach(([name, pts]) => {
    const major = !name.includes('Bypass') && !secondary.includes(name);
    const minor = secondary.includes(name);
    [[major ? 22 : minor ? 9 : 12, 0.07], [major ? 7 : minor ? 3 : 4.4, 0.34], [major ? 2.6 : minor ? 1.4 : 1.8, 0.95]].forEach(([w, a], k) => {
      stroke(pts, k === 2 ? `rgba(255,222,150,${a})` : `rgba(255,128,20,${a})`, w);
    });
  });
  ctx.restore();

  // 7. city and town lights
  function lights(cx, cy, sigma, count, bright) {
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    for (let n = 0; n < count; n += 1) {
      const a = rnd() * 6.283; const r = Math.sqrt(-2 * Math.log(1 - rnd() * 0.999)) * sigma * (0.55 + 0.45 * rnd());
      const x = cx + Math.cos(a) * r * 1.15; const y = cy + Math.sin(a) * r * 0.9;
      if (inPark(x, y) && rnd() > 0.06) continue;
      const warm = rnd();
      ctx.fillStyle = warm < 0.8 ? `rgba(255,${140 + rnd() * 70},${30 + rnd() * 50},${bright * (0.4 + rnd() * 0.6)})` : `rgba(255,238,210,${bright * (0.35 + rnd() * 0.6)})`;
      const s = 0.7 + rnd() * 1.5; ctx.fillRect(x, y, s, s);
    }
    ctx.restore();
  }
  lights(...P(city), 0.02 * W, 3600, 0.8);
  lights(...P(city), 0.06 * W, 20000, 0.8);
  lights(...P(city), 0.12 * W, 8000, 0.55);
  towns.forEach(([x, y, s]) => lights(x * W, y * H, 0.02 * W * s, 2600 * s, 0.95));
  ctx.save(); ctx.globalCompositeOperation = 'lighter';
  Object.values(roadPts).forEach((pts) => {
    for (let i = 0; i < pts.length - 1; i += 1) {
      const steps = Math.floor(Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]) / 3);
      for (let s = 0; s < steps; s += 1) {
        if (rnd() > 0.55) continue;
        const t = s / steps; const x = lerp(pts[i][0], pts[i + 1][0], t) + (rnd() - 0.5) * 9; const y = lerp(pts[i][1], pts[i + 1][1], t) + (rnd() - 0.5) * 9;
        ctx.fillStyle = `rgba(255,${180 + rnd() * 60},${70 + rnd() * 90},${0.3 + rnd() * 0.6})`; ctx.fillRect(x, y, 1.3, 1.3);
      }
    }
  });
  ctx.restore();

  const glow = (cx, cy, r, a) => { ctx.save(); ctx.globalCompositeOperation = 'lighter'; const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, r); g.addColorStop(0, `rgba(255,150,50,${a})`); g.addColorStop(0.45, `rgba(255,115,25,${a * 0.38})`); g.addColorStop(1, 'rgba(255,110,25,0)'); ctx.fillStyle = g; ctx.fillRect(cx - r, cy - r, r * 2, r * 2); ctx.restore(); };
  glow(...P(city), 0.22 * W, 0.3);
  glow(...P(city), 0.07 * W, 0.2);
  towns.forEach(([x, y, s]) => glow(x * W, y * H, 0.055 * W * s, 0.3));

  // airport (runway + terminal)
  ctx.save(); ctx.globalCompositeOperation = 'lighter'; ctx.lineCap = 'round';
  const ap = P([0.745, 0.665]); const ang = -0.42;
  [[11, 0.14], [3.6, 0.55], [1.5, 0.95]].forEach(([w, a]) => { ctx.beginPath(); ctx.moveTo(ap[0] - Math.cos(ang) * 100, ap[1] - Math.sin(ang) * 100); ctx.lineTo(ap[0] + Math.cos(ang) * 100, ap[1] + Math.sin(ang) * 100); ctx.strokeStyle = `rgba(225,238,255,${a})`; ctx.lineWidth = w; ctx.stroke(); });
  glow(ap[0] + 24, ap[1] + 22, 0.03 * W, 0.34);
  ctx.restore();

  // 8. atmosphere: edge vignette (lights are already in place, so only darken, never tint them)
  const vg = ctx.createRadialGradient(W * 0.62, H * 0.5, H * 0.32, W * 0.5, H * 0.5, W * 0.75); vg.addColorStop(0, 'rgba(3,12,22,0)'); vg.addColorStop(1, 'rgba(3,12,22,0.62)'); ctx.fillStyle = vg; ctx.fillRect(0, 0, W, H);

  // 9. cartographic labels (map content, not website text)
  const fs = Math.round(W / 92);
  ctx.save(); ctx.textBaseline = 'middle'; ctx.shadowColor = 'rgba(0,10,20,0.95)'; ctx.shadowBlur = 9;
  const label = (txt, x, y, color, size = 1, align = 'left') => { ctx.font = `600 ${Math.round(fs * size)}px "Segoe UI", "Helvetica Neue", Arial, sans-serif`; ctx.textAlign = align; ctx.fillStyle = color; ctx.fillText(txt, x * W, y * H); };
  label('Kiambu', 0.425, 0.115, 'rgba(240,247,255,0.94)', 1.12);
  label('Ruiru', 0.865, 0.155, 'rgba(240,247,255,0.94)', 1.12);
  label('Nairobi National Park', 0.52, 0.835, 'rgba(160,235,185,0.96)', 1, 'center');
  label('Jomo Kenyatta', 0.775, 0.715, 'rgba(180,215,255,0.96)', 0.9);
  label('International Airport', 0.775, 0.74, 'rgba(180,215,255,0.96)', 0.9);
  label('Athi River', 0.89, 0.955, 'rgba(240,247,255,0.94)', 1.12);
  ctx.restore();

  return c.toDataURL('image/webp', job.quality);
}
// ────────────────────────────────────────────────────────────────────────

const jobs = [
  { file: 'nairobi-map.webp', job: { kind: 'map', W: 2200, H: 1238, quality: 0.8 } },
  { file: 'clouds-large.webp', job: { kind: 'clouds', w: 1600, h: 900, seed: 5, cells: 3, aspect: 1.78, octaves: 6, lo: 0.45, hi: 0.68, maxA: 0.98, warp: 0.18, tint: [[150, 168, 196], [244, 249, 255]], quality: 0.7 } },
  { file: 'clouds-medium.webp', job: { kind: 'clouds', w: 1200, h: 1200, seed: 23, cells: 5, aspect: 1, octaves: 6, lo: 0.5, hi: 0.72, maxA: 0.95, warp: 0.22, tint: [[160, 176, 200], [250, 252, 255]], quality: 0.7 } },
  { file: 'clouds-wisps.webp', job: { kind: 'clouds', w: 1600, h: 640, seed: 77, cells: 3, aspect: 2.5, octaves: 5, lo: 0.54, hi: 0.82, maxA: 0.5, warp: 0.4, tint: [[175, 190, 212], [240, 246, 255]], quality: 0.65 } },
];

const only = process.argv[2];
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto('about:blank');
for (const { file, job } of jobs) {
  if (only && !file.includes(only)) continue;
  const t0 = Date.now();
  const url = await page.evaluate(renderInBrowser, job);
  const buf = Buffer.from(url.split(',')[1], 'base64');
  writeFileSync(join(outDir, file), buf);
  console.log(`${file.padEnd(20)} ${(statSync(join(outDir, file)).size / 1024).toFixed(0).padStart(5)} KB  (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
}
await browser.close();
