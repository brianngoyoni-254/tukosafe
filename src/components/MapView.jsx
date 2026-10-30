import { useMemo } from 'react';
import { useApp } from '../context/app-context';

const METERS_PER_PIXEL = 2;

export default function MapView({ showMembers = true }) {
  const { pos, members, sharing } = useApp();

  const svg = useMemo(() => {
    const m = METERS_PER_PIXEL;
    const p = pos;
    let x = 0, y = 0, grid = '';

    if (p) {
      x = (p.lng * 111320 * Math.cos((p.lat * Math.PI) / 180)) / m;
      y = (p.lat * 110574) / m;
    }
    const mod = (a) => ((a % 40) + 40) % 40;

    for (let k = -1; k <= 10; k++) {
      const gx = k * 40 - mod(x);
      const v = k + Math.floor(x / 40);
      const road = ((v % 3) + 3) % 3 === 0;
      grid += `<line x1="${gx}" y1="0" x2="${gx}" y2="300" stroke="${road ? 'var(--color-maprd)' : 'var(--color-mapln)'}" stroke-width="${road ? 5 : 1}" />`;
    }
    for (let k = -1; k <= 8; k++) {
      const gy = k * 40 + mod(y);
      const h = k - Math.floor(y / 40);
      const road = ((h % 3) + 3) % 3 === 0;
      grid += `<line x1="0" y1="${gy}" x2="400" y2="${gy}" stroke="${road ? 'var(--color-maprd)' : 'var(--color-mapln)'}" stroke-width="${road ? 5 : 1}" />`;
    }

    let over = '';
    if (p) {
      if (showMembers && sharing) {
        members
          .filter((f) => !f.you && f.consent)
          .forEach((f) => {
            const px = 200 + f.east / m;
            const py = 150 - f.north / m;
            over += `<circle cx="${px}" cy="${py}" r="7" fill="var(--color-amber)" stroke="#fff" stroke-width="2" />`;
            over += `<text x="${px + 11}" y="${py + 4}" font-size="11" font-weight="700" fill="var(--color-ink)">${f.name} (demo)</text>`;
          });
      }
      const r = Math.min(140, Math.max(14, p.accuracy / m));
      over += `<circle cx="200" cy="150" r="${r}" fill="var(--color-teal2)" fill-opacity=".16" stroke="var(--color-teal2)" stroke-opacity=".5" />`;
      over += `<circle cx="200" cy="150" r="10" fill="var(--color-teal2)" opacity=".35" />`;
      if (p.heading != null && !isNaN(p.heading)) {
        over += `<path d="M200 118 L191 140 L209 140Z" fill="var(--color-teal)" opacity=".85" transform="rotate(${p.heading} 200 150)" />`;
      }
      over += `<circle cx="200" cy="150" r="8" fill="var(--color-teal)" stroke="#fff" stroke-width="3" />`;
    } else {
      over += `<text x="200" y="154" text-anchor="middle" font-size="14" fill="var(--color-mut)">Waiting for your location…</text>`;
    }

    const bar = 50 / m > 10 ? 50 : 100;
    over += `<g transform="translate(14 282)"><line x1="0" y1="0" x2="${bar / m}" y2="0" stroke="var(--color-ink)" stroke-width="3" /><text y="-6" font-size="11" fill="var(--color-ink)">${bar} m</text></g>`;
    over += `<g transform="translate(372 36)"><circle r="16" fill="white" stroke="var(--color-line)" /><path d="M0-11L5 3 0 0-5 3Z" fill="var(--color-red)" /></g>`;

    return `<svg viewBox="0 0 400 300" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Map centred on your position" style="width:100%;height:100%;display:block">${grid}${over}</svg>`;
  }, [pos, members, sharing, showMembers]);

  return (
    <div className="relative rounded-2xl overflow-hidden border border-line bg-mapbg aspect-[4/3]">
      <div className="absolute left-3 top-3 flex gap-1.5 flex-wrap z-10">
        <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${pos ? 'bg-safebg text-safe' : 'bg-line text-mut'}`}>
          {pos ? 'Located' : 'Not located'}
        </span>
      </div>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
    </div>
  );
}