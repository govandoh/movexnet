export type NotifResult = 'granted' | 'denied' | 'default' | 'unsupported';

/** Pide permiso para mostrar notificaciones (hay que llamarlo desde un toque del usuario). */
export async function requestNotifications(): Promise<NotifResult> {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return 'unsupported';
  return Notification.requestPermission();
}

/** Muestra la notificación desde el service worker (la forma que funciona en Android). */
export async function showTestNotification(delayMs = 0): Promise<void> {
  const reg = await navigator.serviceWorker.ready;
  if (delayMs > 0) await new Promise(resolve => setTimeout(resolve, delayMs));
  await reg.showNotification('MovexNet', {
    body: 'Prueba de recordatorio: ¡hoy toca entrenar!',
    icon: '/icons/icon-192.png',
    tag: 'prueba-35',
  });
}