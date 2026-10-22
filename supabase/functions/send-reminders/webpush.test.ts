import { describe, expect, it } from 'vitest';
import {
  b64urlToBytes, bytesToB64url, encryptPayload, isPushEndpoint, sendPush, vapidAuthorization, type VapidKeys,
} from './webpush.ts';

/** RFC 8291, Apéndice A (sin los espacios del texto del RFC). */
const RFC = {
  plaintext: 'V2hlbiBJIGdyb3cgdXAsIEkgd2FudCB0byBiZSBhIHdhdGVybWVsb24',
  asPublic: 'BP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8', // ggignore: vector público del RFC 8291
  asPrivate: 'yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw', // ggignore: vector público del RFC 8291
  uaPublic: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4', // ggignore: vector público del RFC 8291
  salt: 'DGv6ra1nlYgDCS1FRnbzlw',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg', // ggignore: vector público del RFC 8291
  header: 'DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A8',
  ciphertext: '8pfeW0KbunFT06SuDKoJH9Ql87S1QUrdirN6GcG7sFz1y1sqLgVi1VhjVkHsUoEsbI_0LpXMuGvnzQ',
};

async function newVapidKeys(): Promise<VapidKeys> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign', 'verify']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return { publicKey: bytesToB64url(pub), privateKey: jwk.d!, subject: 'mailto:prueba@movexnet.test' };
}

function decodeJson(part: string): Record<string, unknown> {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

describe('base64url', () => {
  it('ida y vuelta sin relleno', () => {
    const bytes = new Uint8Array([0, 251, 255, 1, 2]);
    expect(bytesToB64url(bytes)).toBe('APv_AQI');
    expect([...b64urlToBytes('APv_AQI')]).toEqual([...bytes]);
    expect([...b64urlToBytes('APv_AQI=')]).toEqual([...bytes]);
  });
});

describe('encryptPayload (RFC 8291)', () => {
  it('reproduce el mensaje del Apéndice A', async () => {
    const out = await encryptPayload(b64urlToBytes(RFC.plaintext), { p256dh: RFC.uaPublic, auth: RFC.auth }, {
      salt: b64urlToBytes(RFC.salt),
      sender: { publicKey: b64urlToBytes(RFC.asPublic), privateKey: b64urlToBytes(RFC.asPrivate) },
    });
    expect(bytesToB64url(out.subarray(0, 86))).toBe(RFC.header);
    expect(bytesToB64url(out.subarray(86))).toBe(RFC.ciphertext);
  });

  it('con sal y claves nuevas en cada envío', async () => {
    const plaintext = new TextEncoder().encode('{"title":"Hoy toca entrenar"}');
    const target = { p256dh: RFC.uaPublic, auth: RFC.auth };
    const a = await encryptPayload(new Uint8Array(plaintext), target);
    const b = await encryptPayload(new Uint8Array(plaintext), target);
    // Encabezado de 86 bytes + contenido + delimitador + etiqueta GCM de 16.
    expect(a.length).toBe(86 + plaintext.length + 1 + 16);
    expect(bytesToB64url(a)).not.toBe(bytesToB64url(b));
  });

  it('rechaza claves del navegador mal formadas y contenidos que no caben en un registro', async () => {
    await expect(encryptPayload(new Uint8Array(1), { p256dh: 'AAAA', auth: RFC.auth })).rejects.toThrow('p256dh');
    await expect(encryptPayload(new Uint8Array(1), { p256dh: RFC.uaPublic, auth: 'AAAA' })).rejects.toThrow('auth');
    await expect(encryptPayload(new Uint8Array(5000), { p256dh: RFC.uaPublic, auth: RFC.auth })).rejects.toThrow('largo');
  });
});

describe('vapidAuthorization (RFC 8292)', () => {
  it('firma un JWT ES256 con la audiencia del servicio de push', async () => {
    const keys = await newVapidKeys();
    const now = Date.UTC(2026, 9, 22, 18, 0);
    const header = await vapidAuthorization('https://fcm.googleapis.com/fcm/send/abc', keys, now);
    const match = /^vapid t=([^.]+)\.([^.]+)\.([^,]+), k=(.+)$/.exec(header);
    expect(match).not.toBeNull();
    const [, h, c, sig, k] = match!;
    expect(k).toBe(keys.publicKey);
    expect(decodeJson(h)).toEqual({ typ: 'JWT', alg: 'ES256' });
    expect(decodeJson(c)).toEqual({ aud: 'https://fcm.googleapis.com', exp: now / 1000 + 12 * 3600, sub: keys.subject });

    const pub = await crypto.subtle.importKey('raw', b64urlToBytes(keys.publicKey), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    const ok = await crypto.subtle.verify(
      { name: 'ECDSA', hash: 'SHA-256' }, pub, b64urlToBytes(sig), new TextEncoder().encode(`${h}.${c}`),
    );
    expect(ok).toBe(true);
  });
});

describe('isPushEndpoint', () => {
  it('acepta solo servicios de push conocidos', () => {
    expect(isPushEndpoint('https://fcm.googleapis.com/fcm/send/abc')).toBe(true);
    expect(isPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/abc')).toBe(true);
    expect(isPushEndpoint('https://wns2-bl2p.notify.windows.com/w/?token=abc')).toBe(true);
    expect(isPushEndpoint('https://web.push.apple.com/QABC')).toBe(true);
    expect(isPushEndpoint('http://fcm.googleapis.com/fcm/send/abc')).toBe(false);
    expect(isPushEndpoint('https://fcm.googleapis.com.evil.example/x')).toBe(false);
    expect(isPushEndpoint('https://127.0.0.1/x')).toBe(false);
  });
});

describe('sendPush', () => {
  it('envía el contenido cifrado con los encabezados de Web Push', async () => {
    const keys = await newVapidKeys();
    const calls: { url: string; init: RequestInit }[] = [];
    const fetchFake = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(null, { status: 201 });
    }) as unknown as typeof fetch;
    const status = await sendPush(
      { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', p256dh: RFC.uaPublic, auth: RFC.auth },
      '{"title":"Hoy toca entrenar"}', keys, { ttlSeconds: 14400, topic: 'recordatorio' },
      { fetch: fetchFake, now: () => Date.UTC(2026, 9, 22) },
    );
    expect(status).toBe(201);
    expect(calls).toHaveLength(1);
    const headers = calls[0].init.headers as Record<string, string>;
    expect(headers['Content-Encoding']).toBe('aes128gcm');
    expect(headers.TTL).toBe('14400');
    expect(headers.Topic).toBe('recordatorio');
    expect(headers.Urgency).toBe('normal');
    expect(headers.Authorization).toMatch(/^vapid t=/);
    expect((calls[0].init.body as Uint8Array).length).toBeGreaterThan(86);
  });

  it('no envía a un endpoint que no es de un servicio de push', async () => {
    const keys = await newVapidKeys();
    const fetchFake = (async () => new Response(null, { status: 201 })) as unknown as typeof fetch;
    await expect(sendPush(
      { endpoint: 'https://evil.example.com/x', p256dh: RFC.uaPublic, auth: RFC.auth }, '{}', keys, { ttlSeconds: 60 },
      { fetch: fetchFake, now: Date.now },
    )).rejects.toThrow('endpoint');
  });
});
