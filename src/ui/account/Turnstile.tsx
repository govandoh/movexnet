import { useEffect, useRef, useState } from 'react';

/**
 * Captcha de Cloudflare Turnstile (DEC-069). El script de terceros se carga solo en las
 * pantallas de cuenta y solo si hay site key; en local no hay y no se carga nada.
 * El token es de un solo uso: la pantalla cambia `resetKey` después de cada intento.
 *
 * `appearance: 'interaction-only'`: casi siempre Cloudflare verifica sin pedir nada, y en iOS
 * el recuadro fijo se veía en blanco (issue #75). Solo se reserva espacio cuando Cloudflare
 * pide tocar la casilla; mientras tanto se dice qué pasa, porque el botón espera al token.
 */

type CaptchaState = 'checking' | 'interactive' | 'done' | 'failed';

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
  const [state, setState] = useState<CaptchaState>('checking');
  // Si el script no cargó no hay widget que reiniciar: reintentar vuelve a montarlo.
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { onTokenRef.current = onToken; });

  useEffect(() => {
    let cancelled = false;
    const fail = () => { onTokenRef.current(null); setState('failed'); };
    loadScript()
      .then(api => {
        if (cancelled || !box.current) return;
        widget.current = api.render(box.current, {
          sitekey: siteKey,
          theme: 'dark',
          language: 'es',
          appearance: 'interaction-only',
          callback: (t: string) => { onTokenRef.current(t); setState('done'); },
          'expired-callback': () => { onTokenRef.current(null); setState('checking'); },
          'error-callback': fail,
          'before-interactive-callback': () => setState('interactive'),
        });
      })
      .catch(() => { if (!cancelled) fail(); });
    return () => {
      cancelled = true;
      if (widget.current) window.turnstile?.remove(widget.current);
      widget.current = null;
    };
  }, [siteKey, attempt]);

  useEffect(() => {
    if (resetKey > 0 && widget.current) {
      window.turnstile?.reset(widget.current);
      onTokenRef.current(null);
      setState('checking');
    }
  }, [resetKey]);

  const retry = () => {
    setState('checking');
    if (widget.current) {
      window.turnstile?.reset(widget.current);
      onTokenRef.current(null);
    } else {
      setAttempt(a => a + 1);
    }
  };

  return (
    <div className="account-captcha" data-state={state}>
      <div ref={box} className="account-captcha__box" />
      {state === 'checking' && (
        <p className="account-field__hint" role="status">Verificando que eres una persona…</p>
      )}
      {state === 'failed' && (
        <p className="account-field__error" role="alert">
          No se pudo verificar que eres una persona.{' '}
          <button type="button" className="account-link" onClick={retry}>Reintentar</button>
        </p>
      )}
    </div>
  );
}
