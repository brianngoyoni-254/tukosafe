const KEY = 'tukosafe.outing';

export function loadOuting() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function saveOuting(outing) {
  try {
    if (!outing) localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, JSON.stringify(outing));
  } catch {}
}

export function newOutingId() {
  return `out_${Date.now().toString(36)}`;
}

export function makeDefaultReturnPlan() {
  return {
    departureTime: '',
    homeEta: '',
    transport: 'Uber',
    notify: '',
  };
}

export function minutesBetween(fromHHMM, toHHMM) {
  if (!fromHHMM || !toHHMM) return null;
  const [fh, fm] = fromHHMM.split(':').map(Number);
  const [th, tm] = toHHMM.split(':').map(Number);
  let a = fh * 60 + fm;
  let b = th * 60 + tm;
  if (b < a) b += 24 * 60;
  return b - a;
}

export function formatHHMM(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  const period = h < 12 ? 'AM' : 'PM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(m).padStart(2, '0')} ${period}`;
}

export function createOuting({ title, venue, startsAt, endsAt, returnPlan, hostName }) {
  const id = newOutingId();
  const now = Date.now();
  const endsMs = new Date(endsAt).getTime() || now + 4 * 3_600_000;

  return {
    id,
    title: title.trim(),
    venue: venue.trim(),
    startsAt,
    endsAt,
    expiresAt: endsMs,
    sharing: true,
    endedAt: null,
    createdAt: now,
    returnPlan: {
      ...makeDefaultReturnPlan(),
      ...returnPlan,
    },
    members: [
      { id: 'me', name: hostName || 'You', you: true, consent: true, joinedAt: now, leftAt: null },
    ],
    checkin: {
      dueAt: endsMs,
      graceMinutes: 15,
      state: 'scheduled',
      reminderAt: null,
      graceEndsAt: null,
      alertedAt: null,
      resolvedAt: null,
    },
  };
}