/*
 * JobRadar — service worker des notifications Web Push.
 * Enregistré avec le scope « /push/ » pour ne pas gêner un autre service worker (PWA Angular).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));

// Message envoyé par le serveur : { title, body, url, tag }
self.addEventListener('push', event => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || 'JobRadar';
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/favicon.ico',
      lang: 'fr',
      // Même tag = la nouvelle notification remplace l'ancienne au lieu de s'empiler
      tag: data.tag || undefined,
      renotify: Boolean(data.tag),
      data: { url: data.url || '/app' },
    }),
  );
});

// Clic sur la notification : on revient sur JobRadar, à la bonne page
self.addEventListener('notificationclick', event => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || '/app', self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    const open = windows.find(w => w.url.startsWith(self.location.origin));
    if (open) {
      // L'onglet ouvert navigue lui-même (WebPushService écoute ce message)
      open.postMessage({ type: 'jobradar-push-navigate', url });
      return open.focus();
    }
    return self.clients.openWindow(url);
  })());
});