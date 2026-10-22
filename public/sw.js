// v10: recordatorios por Web Push con la app cerrada y el toque abre la semana del aviso (#88, DEC-080). v9: la navegación clona la respuesta antes de devolverla (error "Response body is already used"). v8: abrir la app al tocar un recordatorio del programa (#35). v7: logo "M" de MovexNet en los íconos de la PWA (DEC-068). v6: nombre MovexNet en manifest y título (DEC-068). v5: íconos PNG para instalar la PWA (Android, iOS) y manifest sin bloqueo de orientación
// (DEC-060). El manifest se sirve cache-first: sin subir la versión, quien ya abrió la app
// seguiría con el manifest viejo. Subir en cada cambio (DEC-025).
const CACHE = 'entrenador-ia-v10';

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

const ICON = '/icons/icon-192.png';
// Mismo `tag` que el aviso local (src/ui/state/reminders.ts): uno reemplaza al otro.
const REMINDER_TAG = 'movexnet-recordatorio';

/** Solo rutas de la app: un contenido raro nunca abre otra web. */
function appUrl(raw) {
  const url = new URL(typeof raw === 'string' && raw.startsWith('/') ? raw : '/', self.location.origin);
  return url.origin === self.location.origin ? url.href : self.location.origin + '/';
}

// Recordatorios con la app cerrada (#88, DEC-080): el contenido llega cifrado desde la Edge
// Function `send-reminders` como {title, body, url}. `userVisibleOnly` obliga a mostrar algo.
self.addEventListener('push', e => {
  let data = {};
  try {
    data = e.data ? e.data.json() : {};
  } catch {
    // Contenido ilegible: igual se muestra el aviso genérico.
  }
  const title = typeof data.title === 'string' && data.title ? data.title : 'Hoy toca entrenar';
  const body = typeof data.body === 'string' ? data.body : 'Tu sesión del programa te espera en MovexNet.';
  e.waitUntil(
    self.registration.showNotification(title, {
      body, icon: ICON, badge: ICON, tag: REMINDER_TAG, data: { url: appUrl(data.url) },
    })
  );
});

// Recordatorios del programa (#35, #88): tocar el aviso enfoca la app y la lleva a la semana del
// aviso, o la abre ahí. Enfocar va primero: el permiso para hacerlo dura poco tras el toque.
self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = appUrl(e.notification.data?.url);
  e.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async list => {
      const open = list.find(c => c.url.startsWith(self.location.origin));
      if (!open) return self.clients.openWindow(url);
      const focused = await open.focus();
      // `navigate` falla en una ventana que este service worker no controla; queda enfocada.
      if (focused.url !== url) await focused.navigate(url).catch(() => {});
      return focused;
    })
  );
});
