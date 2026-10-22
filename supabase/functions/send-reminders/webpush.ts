/**
 * Web Push sin dependencias (issue #88, DEC-080): firma VAPID (RFC 8292) y cifrado del
 * contenido `aes128gcm` (RFC 8291 sobre RFC 8188), solo con Web Crypto. Corre igual en Deno
 * (Edge Function) y en Node 22 (Vitest); el cifrado se prueba con el vector del Apéndice A
 * del RFC 8291. Módulo puro: la red entra por `fetch` inyectado.
 */

type Bytes = Uint8Array<ArrayBuffer>;

export interface VapidKeys {
  /** Clave pública P-256 sin comprimir (65 bytes), base64url. Es la misma del cliente. */
  publicKey: string;
  /** Escalar privado (32 bytes), base64url. Solo como secreto de la función. */
  privateKey: string;
  /** `mailto:` o `https:` de contacto para el servicio de push (RFC 8292 §2.1). */
  subject: string;
}

export interface PushTarget {
  endpoint: string;
  /** Clave pública ECDH del navegador (65 bytes), base64url. */
  p256dh: string;
  /** Secreto de autenticación del navegador (16 bytes), base64url. */
  auth: string;
}

/**
 * Servicios de push aceptados: Chrome, Edge (FCM o WNS), Firefox y Safari. La misma lista está
 * en el `check` de `push_subscriptions` (20261022000000_web_push.sql): la función nunca
 * hace POST a una URL que no sea de un servicio de push.
 */
const PUSH_ENDPOINT = /^https:\/\/(fcm\.googleapis\.com|updates\.push\.services\.mozilla\.com|[a-z0-9-]+\.notify\.windows\.com|web\.push\.apple\.com)\//;

export function isPushEndpoint(url: string): boolean {
  return url.length <= 1024 && PUSH_ENDPOINT.test(url);
}

/** Un solo registro de 4096 bytes: el contenido más el delimitador y la etiqueta de GCM. */
const RECORD_SIZE = 4096;
const MAX_PLAINTEXT = RECORD_SIZE - 1 - 16;
/** RFC 8292 §2: `exp` no puede pasar de 24 h. */
const VAPID_TTL_S = 12 * 3600;

const text = new TextEncoder();

function utf8(s: string): Bytes {
  return new Uint8Array(text.encode(s));
}

export function b64urlToBytes(s: string): Bytes {
  const b64 = s.replace(/-/g, '+').replace(/_/g, '/').replace(/=+$/, '');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64url(bytes: Uint8Array): string {
  let bin = '';
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function concat(...parts: Uint8Array[]): Bytes {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const p of parts) {
    out.set(p, at);
    at += p.length;
  }
  return out;
}

async function hmac(key: Bytes, data: Bytes): Promise<Bytes> {
  const k = await crypto.subtle.importKey('raw', key, { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, data));
}

/** JWK de una clave privada P-256 a partir de su punto público sin comprimir y su escalar. */
function privateJwk(publicKey: Bytes, d: Bytes): JsonWebKey {
  if (publicKey.length !== 65 || publicKey[0] !== 4 || d.length !== 32) {
    throw new Error('clave P-256 inválida');
  }
  return {
    kty: 'EC', crv: 'P-256', ext: true,
    x: bytesToB64url(publicKey.subarray(1, 33)),
    y: bytesToB64url(publicKey.subarray(33, 65)),
    d: bytesToB64url(d),
  };
}

/**
 * Encabezado `Authorization` de VAPID (RFC 8292 §3): JWT ES256 con la audiencia del servicio
 * de push. Web Crypto firma en formato r‖s, que es justo el de JWS.
 */
export async function vapidAuthorization(endpoint: string, keys: VapidKeys, nowMs: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk', privateJwk(b64urlToBytes(keys.publicKey), b64urlToBytes(keys.privateKey)),
    { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'],
  );
  const header = bytesToB64url(utf8(JSON.stringify({ typ: 'JWT', alg: 'ES256' })));
  const claims = bytesToB64url(utf8(JSON.stringify({
    aud: new URL(endpoint).origin,
    exp: Math.floor(nowMs / 1000) + VAPID_TTL_S,
    sub: keys.subject,
  })));
  const signature = await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, key, utf8(`${header}.${claims}`));
  return `vapid t=${header}.${claims}.${bytesToB64url(new Uint8Array(signature))}, k=${keys.publicKey}`;
}

/** Solo para el vector de prueba: en producción la sal y las claves del emisor son nuevas en cada envío. */
export interface EncryptOptions {
  salt?: Bytes;
  sender?: { publicKey: Bytes; privateKey: Bytes };
}

/** Cifra el contenido para un navegador (RFC 8291 §3.4) en un único registro `aes128gcm`. */
export async function encryptPayload(plaintext: Bytes, target: Pick<PushTarget, 'p256dh' | 'auth'>, options: EncryptOptions = {}): Promise<Bytes> {
  if (plaintext.length > MAX_PLAINTEXT) throw new Error('contenido demasiado largo');
  const uaPublic = b64urlToBytes(target.p256dh);
  const authSecret = b64urlToBytes(target.auth);
  if (uaPublic.length !== 65 || uaPublic[0] !== 4) throw new Error('p256dh inválida');
  if (authSecret.length !== 16) throw new Error('auth inválido');

  const salt = options.salt ?? crypto.getRandomValues(new Uint8Array(16));
  let asPrivate: CryptoKey;
  let asPublic: Bytes;
  if (options.sender) {
    asPublic = options.sender.publicKey;
    asPrivate = await crypto.subtle.importKey(
      'jwk', privateJwk(asPublic, options.sender.privateKey), { name: 'ECDH', namedCurve: 'P-256' }, false, ['deriveBits'],
    );
  } else {
    const pair = await crypto.subtle.generateKey({ name: 'ECDH', namedCurve: 'P-256' }, true, ['deriveBits']);
    asPrivate = pair.privateKey;
    asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  }

  const uaKey = await crypto.subtle.importKey('raw', uaPublic, { name: 'ECDH', namedCurve: 'P-256' }, false, []);
  const ecdhSecret = new Uint8Array(await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPrivate, 256));

  // HKDF a mano (extraer = HMAC con la sal, expandir un bloque = HMAC con info‖0x01): cada paso
  // corresponde a un valor intermedio del Apéndice A, así el test los puede comparar.
  const prkKey = await hmac(authSecret, ecdhSecret);
  const keyInfo = concat(utf8('WebPush: info\0'), uaPublic, asPublic);
  const ikm = await hmac(prkKey, concat(keyInfo, new Uint8Array([1])));
  const prk = await hmac(salt, ikm);
  const cek = (await hmac(prk, concat(utf8('Content-Encoding: aes128gcm\0'), new Uint8Array([1])))).slice(0, 16);
  const nonce = (await hmac(prk, concat(utf8('Content-Encoding: nonce\0'), new Uint8Array([1])))).slice(0, 12);

  // 0x02: delimitador del último (y único) registro, sin relleno extra (RFC 8188 §2).
  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt']);
  const ciphertext = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv: nonce }, aesKey, concat(plaintext, new Uint8Array([2]))),
  );

  const rs = new Uint8Array(4);
  new DataView(rs.buffer).setUint32(0, RECORD_SIZE);
  return concat(salt, rs, new Uint8Array([asPublic.length]), asPublic, ciphertext);
}

export interface PushOptions {
  /** Segundos que el servicio de push guarda el mensaje si el celular está apagado. */
  ttlSeconds: number;
  /** Un mensaje pendiente con el mismo tema lo reemplaza el nuevo (RFC 8030 §5.4). */
  topic?: string;
  urgency?: 'very-low' | 'low' | 'normal' | 'high';
}

/** Envía un mensaje cifrado. Devuelve el estado HTTP del servicio de push. */
export async function sendPush(
  target: PushTarget, payload: string, keys: VapidKeys, options: PushOptions,
  deps: { fetch: typeof fetch; now: () => number },
): Promise<number> {
  if (!isPushEndpoint(target.endpoint)) throw new Error('endpoint fuera de los servicios de push');
  const body = await encryptPayload(utf8(payload), target);
  const headers: Record<string, string> = {
    Authorization: await vapidAuthorization(target.endpoint, keys, deps.now()),
    'Content-Encoding': 'aes128gcm',
    'Content-Type': 'application/octet-stream',
    TTL: String(Math.max(0, Math.floor(options.ttlSeconds))),
    Urgency: options.urgency ?? 'normal',
  };
  if (options.topic) headers.Topic = options.topic;
  const res = await deps.fetch(target.endpoint, { method: 'POST', headers, body });
  // El cuerpo no se usa; cancelarlo libera la conexión en Deno.
  await res.body?.cancel();
  return res.status;
}
