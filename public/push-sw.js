// ═══════════════════════════════════════════════════════════
// Gestion des notifications push — importé par le service
// worker généré par vite-plugin-pwa (workbox.importScripts).
// ═══════════════════════════════════════════════════════════

self.addEventListener('push', (event) => {
  let data = { title: 'Neoclima Field', body: '', url: '/' }
  try {
    data = { ...data, ...event.data.json() }
  } catch {
    if (event.data) data.body = event.data.text()
  }

  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      vibrate: [100, 50, 100],
      data: { url: data.url },
      tag: data.tag || 'nc-field',
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url || '/'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ('focus' in client) {
          client.navigate(url)
          return client.focus()
        }
      }
      return clients.openWindow(url)
    })
  )
})
