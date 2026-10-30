// Offline queue for alerts. Items live in localStorage until the server confirms them.
// "pending" = not yet confirmed by the server, "failed" = server rejected it (needs the user).
// Alerts are idempotent on client_id, so retrying can never create duplicates.
const KEY = 'tukosafe.alertQueue';

const read = () => { try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return []; } };
const write = (items) => { try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* storage full/blocked */ } };

export const isNetworkError = (e) =>
  (typeof navigator !== 'undefined' && navigator.onLine === false) || /failed to fetch|network|load failed/i.test(e?.message || '');

export function queued(userId) {
  return read().filter((i) => i.userId === userId);
}

export function enqueue(item) {
  write([...read(), { ...item, status: 'pending', attempts: 0, queuedAt: Date.now() }]);
}

export function remove(clientId) {
  write(read().filter((i) => i.clientId !== clientId));
}

function patch(clientId, fields) {
  write(read().map((i) => (i.clientId === clientId ? { ...i, ...fields } : i)));
}

/** Try to send one item. Returns { ok, id } or { ok:false, network, error }. */
export async function attempt(item, createAlert) {
  patch(item.clientId, { attempts: (item.attempts || 0) + 1, status: 'pending', error: null });
  try {
    const id = await createAlert(item);
    remove(item.clientId);
    return { ok: true, id };
  } catch (e) {
    if (isNetworkError(e)) return { ok: false, network: true, error: e.message };
    patch(item.clientId, { status: 'failed', error: e.message });
    return { ok: false, network: false, error: e.message };
  }
}

export function retryable(userId) {
  return queued(userId).filter((i) => i.status === 'pending');
}
