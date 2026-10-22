import { describe, expect, it } from 'vitest';
import { handleRequest, readEnv, secretMatches, type ClaimedReminder, type DispatchEnv } from './dispatch.ts';
import { bytesToB64url } from './webpush.ts';

// Claves del navegador del RFC 8291 (Apéndice A): sirven para cifrar de verdad.
const UA = {
  p256dh: 'BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4',
  auth: 'BTBZMqHH6r4Tts7J_aSIgg',
};

async function env(): Promise<DispatchEnv> {
  const pair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
  const pub = new Uint8Array(await crypto.subtle.exportKey('raw', pair.publicKey));
  const jwk = await crypto.subtle.exportKey('jwk', pair.privateKey);
  return {
    supabaseUrl: 'http://supabase.test',
    serviceRoleKey: 'eyJservicio',
    cronSecret: 'secreto',
    vapid: { publicKey: bytesToB64url(pub), privateKey: jwk.d!, subject: 'mailto:prueba@movexnet.test' },
  };
}

function reminder(id: string, sub: string, endpoint: string): ClaimedReminder {
  return { reminder_id: id, subscription_id: sub, endpoint, ...UA, title: 'Hoy toca entrenar', body: 'Semana 2 · Pierna', url: '/#/rutinas?semana=2' };
}

/** Simula PostgREST y los servicios de push: cada endpoint responde con el estado dado. */
function fakeNetwork(claimed: ClaimedReminder[], pushStatus: Record<string, number | 'throw'>) {
  const calls: { method: string; url: string; headers: Record<string, string>; body?: unknown }[] = [];
  const fetchFake = (async (url: string, init: RequestInit) => {
    const headers = (init.headers ?? {}) as Record<string, string>;
    calls.push({ method: init.method ?? 'GET', url, headers, body: init.body });
    if (url.endsWith('/rest/v1/rpc/claim_due_push_reminders')) return Response.json(claimed);
    if (url.includes('/rest/v1/push_subscriptions')) return new Response(null, { status: 204 });
    const status = pushStatus[url];
    if (status === 'throw') throw new TypeError('red caída');
    return new Response(null, { status: status ?? 201 });
  }) as unknown as typeof fetch;
  return { fetchFake, calls };
}

function request(secret: string | null, method = 'POST'): Request {
  return new Request('http://functions.test/send-reminders', {
    method, headers: secret === null ? {} : { 'x-cron-secret': secret },
  });
}

describe('handleRequest', () => {
  it('rechaza sin el secreto del cron o con otro', async () => {
    const e = await env();
    const { fetchFake, calls } = fakeNetwork([], {});
    const deps = { fetch: fetchFake, now: Date.now, log: () => {} };
    expect((await handleRequest(request(null), e, deps)).status).toBe(401);
    expect((await handleRequest(request('otro'), e, deps)).status).toBe(401);
    expect((await handleRequest(request('secreto', 'GET'), e, deps)).status).toBe(405);
    expect(calls).toHaveLength(0);
  });

  it('sin secretos configurados responde 500 sin tocar la base', async () => {
    const { fetchFake, calls } = fakeNetwork([], {});
    const res = await handleRequest(request('secreto'), null, { fetch: fetchFake, now: Date.now, log: () => {} });
    expect(res.status).toBe(500);
    expect(calls).toHaveLength(0);
  });

  it('envía lo reclamado, borra las suscripciones vencidas y no reintenta los errores', async () => {
    const e = await env();
    const ok = 'https://fcm.googleapis.com/fcm/send/ok';
    const gone = 'https://updates.push.services.mozilla.com/wpush/v2/gone';
    const missing = 'https://web.push.apple.com/missing';
    const broken = 'https://fcm.googleapis.com/fcm/send/broken';
    const down = 'https://fcm.googleapis.com/fcm/send/down';
    const claimed = [
      reminder('r1', 's-ok', ok),
      reminder('r2', 's-gone', gone),
      reminder('r3', 's-gone', gone),
      reminder('r4', 's-missing', missing),
      reminder('r5', 's-broken', broken),
      reminder('r6', 's-down', down),
    ];
    const { fetchFake, calls } = fakeNetwork(claimed, { [gone]: 410, [missing]: 404, [broken]: 500, [down]: 'throw' });
    const logs: string[] = [];
    const res = await handleRequest(request('secreto'), e, { fetch: fetchFake, now: Date.now, log: m => logs.push(m) });

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ claimed: 6, sent: 1, gone: 2, failed: 2 });

    const claim = calls.find(c => c.url.endsWith('claim_due_push_reminders'))!;
    expect(claim.headers.apikey).toBe('eyJservicio');
    expect(claim.headers.Authorization).toBe('Bearer eyJservicio');
    expect(JSON.parse(claim.body as string)).toEqual({ p_limit: 200 });

    const del = calls.filter(c => c.method === 'DELETE');
    expect(del).toHaveLength(1);
    expect(del[0].url).toBe('http://supabase.test/rest/v1/push_subscriptions?id=in.(s-gone,s-missing)');

    // Cada aviso se intenta una sola vez, y los logs no llevan endpoints.
    expect(calls.filter(c => c.url === broken)).toHaveLength(1);
    expect(logs.join('\n')).not.toMatch(/https?:\/\//);
    expect(logs).toHaveLength(2);
  });

  it('no envía a un endpoint que no es de un servicio de push y borra su suscripción', async () => {
    const e = await env();
    const { fetchFake, calls } = fakeNetwork([reminder('r1', 's-evil', 'https://evil.example.com/x')], {});
    const res = await handleRequest(request('secreto'), e, { fetch: fetchFake, now: Date.now, log: () => {} });
    expect(await res.json()).toEqual({ claimed: 1, sent: 0, gone: 1, failed: 0 });
    expect(calls.some(c => c.url.startsWith('https://evil'))).toBe(false);
  });

  it('si el reclamo falla responde 502', async () => {
    const e = await env();
    const fetchFake = (async () => new Response('{}', { status: 503 })) as unknown as typeof fetch;
    const res = await handleRequest(request('secreto'), e, { fetch: fetchFake, now: Date.now, log: () => {} });
    expect(res.status).toBe(502);
  });

  it('una clave sb_secret_ va solo en apikey', async () => {
    const e = { ...(await env()), serviceRoleKey: 'sb_secret_abc' };
    const { fetchFake, calls } = fakeNetwork([], {});
    await handleRequest(request('secreto'), e, { fetch: fetchFake, now: Date.now, log: () => {} });
    expect(calls[0].headers.apikey).toBe('sb_secret_abc');
    expect(calls[0].headers.Authorization).toBeUndefined();
  });
});

describe('readEnv', () => {
  it('exige todos los secretos', () => {
    const all: Record<string, string> = {
      SUPABASE_URL: 'u', SUPABASE_SERVICE_ROLE_KEY: 'k', CRON_SECRET: 'c',
      VAPID_PUBLIC_KEY: 'p', VAPID_PRIVATE_KEY: 'd', VAPID_SUBJECT: 'mailto:x',
    };
    expect(readEnv(n => all[n])).toEqual({
      supabaseUrl: 'u', serviceRoleKey: 'k', cronSecret: 'c', vapid: { publicKey: 'p', privateKey: 'd', subject: 'mailto:x' },
    });
    expect(readEnv(n => (n === 'VAPID_PRIVATE_KEY' ? undefined : all[n]))).toBeNull();
  });
});

describe('secretMatches', () => {
  it('compara sin depender del largo', async () => {
    expect(await secretMatches('abc', 'abc')).toBe(true);
    expect(await secretMatches('abd', 'abc')).toBe(false);
    expect(await secretMatches('', 'abc')).toBe(false);
    expect(await secretMatches(null, 'abc')).toBe(false);
  });
});
