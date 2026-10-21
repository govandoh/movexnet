import { useCallback, useSyncExternalStore } from 'react';

/*
 * iOS (y Chrome) solo dejan hablar si la primera locución ocurre dentro de un toque de la
 * persona (activación de usuario); si no, todas las siguientes se pierden en silencio. Antes
 * lo cubría el toque en "Empezar serie", pero los ejercicios de suelo ahora arrancan solos
 * (DEC-071) y la bienvenida solo aparece la primera vez. Por eso la voz se habilita con el
 * primer toque que ocurra en cualquier parte de la app.
 */
const ACTIVATION_EVENTS = ['touchend', 'click', 'keydown'] as const;
const hasSpeech = typeof window !== 'undefined' && 'speechSynthesis' in window;
let unlocked = false;
const subscribers = new Set<() => void>();

function unlock() {
  if (unlocked) return;
  unlocked = true;
  try {
    window.speechSynthesis.speak(new SpeechSynthesisUtterance(''));
  } catch { /* sin síntesis de voz utilizable */ }
  for (const type of ACTIVATION_EVENTS) window.removeEventListener(type, unlock, true);
  subscribers.forEach(notify => notify());
}

if (hasSpeech) {
  for (const type of ACTIVATION_EVENTS) window.addEventListener(type, unlock, { capture: true, passive: true });
}

/** true cuando la voz ya puede sonar: hubo un toque o el navegador no tiene síntesis de voz. */
export function useSpeechReady(): boolean {
  return useSyncExternalStore(
    notify => { subscribers.add(notify); return () => { subscribers.delete(notify); }; },
    () => unlocked || !hasSpeech,
    () => true,
  );
}

/**
 * Hook para síntesis de voz en español.
 * Cancela la locución anterior antes de iniciar la siguiente para evitar
 * que los mensajes se acumulen cuando el usuario hace reps rápidas.
 */
export function useSpeech() {
  const speak = useCallback((text: string) => {
    if (!hasSpeech) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang   = 'es-ES';
    utterance.rate   = 1.05;
    utterance.volume = 1.0;
    window.speechSynthesis.speak(utterance);
  }, []);

  return speak;
}
