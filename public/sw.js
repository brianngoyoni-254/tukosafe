/* TukoSafe service worker: shows web-push notifications. It does not cache anything.
   Push delivery is best effort: browsers/OSes may delay or drop pushes (battery savers,
   Do Not Disturb, offline devices). It is not a guarantee. */
const ROUTES = {
  friend_invitation: '/trust', invitation_accepted: '/trust', message: '/trust',
  sos: '/help', help_request: '/help', sos_acknowledged: '/help',
  checkin: '/checkin', missed_checkin: '/checkin', arrived: '/checkin',
  outing_invitation: '/outing', outing_update: '/outing', outing_cancelled: '/outing', location_share: '/map',
};

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('push', (event) => {
  let d;
  try { d = event.data ? event.data.json() : {}; } catch { d = { title: 'TukoSafe', body: event.data ? event.data.text() : '' }; }
  event.waitUntil(self.registration.showNotification(d.title || 'TukoSafe', {
    body: d.body || '',
    tag: (d.data && d.data.alert_id) || d.type || 'tukosafe',
    requireInteraction: !!d.urgent,
    data: { url: ROUTES[d.type] || '/' },
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || '/';
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((wins) => {
    for (const w of wins) { if ('focus' in w) { w.navigate(url); return w.focus(); } }
    return self.clients.openWindow(url);
  }));
});
