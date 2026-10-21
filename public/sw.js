// v9: la navegación clona la respuesta antes de devolverla (error "Response body is already used"). v8: abrir la app al tocar un recordatorio del programa (#35). v7: logo "M" de MovexNet en los íconos de la PWA (DEC-068). v6: nombre MovexNet en manifest y título (DEC-068). v5: íconos PNG para instalar la PWA (Android, iOS) y manifest sin bloqueo de orientación
// (DEC-060). El manifest se sirve cache-first: sin subir la versión, quien ya abrió la app
// seguiría con el manifest viejo. Subir en cada cambio (DEC-025).
const CACHE = 'entrenador-ia-v9';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  // Recursos de CDN externos (WASM y modelo de MediaPipe): dejar pasar a la red.
  // Son demasiado grandes para el cache del SW y el browser HTTP cache ya los maneja.
  if (!e.request.url.startsWith(self.location.origin)) return;

  // Navegación (index.html): network-first para que el usuario siempre reciba el HTML
  // más reciente con las referencias correctas a los assets hasheados del deploy actual.
  // Sin esto, un HTML cacheado puede apuntar a assets inexistentes después de un deploy.
  if (e.request.mode === 'navigate') {
    e.respondWith(
      fetch(e.request)
        .then(res => {
          if (res.ok) {
            // Clonar antes de devolver `res`: después el navegador ya empezó a leerlo.
            const copy = res.clone();
            caches.open(CACHE).then(c => c.put(e.request, copy));
          }
          return res;
        })
        .catch(async () => (await caches.match(e.request)) ?? Response.error())
    );
    return;
  }

  // Assets estáticos (JS, CSS, iconos): cache-first.
  // Son content-hashed e inmutables; si cambian de contenido, cambian de nombre.
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(e.request);
      const networkFetch = fetch(e.request).then(res => {
        if (res.ok) cache.put(e.request, res.clone());
        return res;
      }).catch(() => cached);
      return cached ?? networkFetch;
    })
  );
});

// Recordatorios del programa (#35): tocar el aviso enfoca la app si ya está abierta o la abre.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = new URL(e.notification.data?.url ?? '/', self.location.origin).href;
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const open = list.find(c => c.url.startsWith(self.location.origin));
      return open ? open.focus() : self.clients.openWindow(url);
    })
  );
});
