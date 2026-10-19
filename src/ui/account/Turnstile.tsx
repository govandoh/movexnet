import { useEffect, useRef } from 'react';

/**
 * Captcha de Cloudflare Turnstile (DEC-069). El script de terceros se carga solo en las
 * pantallas de cuenta y solo si hay site key; en local no hay y no se carga nada.
 * El token es de un solo uso: la pantalla cambia `resetKey` después de cada intento.
 */

const SCRIPT_URL = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(widgetId: string): void;
  remove(widgetId: string): void;
}

declare global {
  interface Window { turnstile?: TurnstileApi }
}

let scriptPromise: Promise<TurnstileApi> | null = null;

function loadScript(): Promise<TurnstileApi> {
  scriptPromise ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = SCRIPT_URL;
    s.async = true;
    s.referrerPolicy = 'no-referrer';
    s.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error('turnstile')));
    s.onerror = () => { scriptPromise = null; reject(new Error('turnstile')); };
    document.head.appendChild(s);
  });
  return scriptPromise;
}

export function Turnstile({ siteKey, resetKey, onToken }: {
  siteKey: string;
  resetKey: number;
  onToken: (token: string | null) => void;
}) {
  const box = useRef<HTMLDivElement>(null);
  const widget = useRef<string | null>(null);
  const onTokenRef = useRef(onToken);
  useEffect(() => { onTokenRef.current = onToken; });

  useEffect(() => {
    let cancelled = false;
    loadScript()
      .then(api => {
        if (cancelled || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: siteKey,
          theme: 'dark',
          language: 'es',
          callback: (t: string) => onTokenRef.current(t),
          'expired-callback': () => onTokenRef.current(null),
          'error-callback': () => onTokenRef.current(null),
        });
      })
      .catch(() => onTokenRef.current(null));
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey]);

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      window.turnstile?.reset(widget.current);
      onTokenRef.current(null);
    }
  }, [resetKey]);

  return <div ref={box} className="account-captcha" />;
}
