import { describe, expect, it } from 'vitest';
import { spokenPeakPhrase } from './coaching';

describe('spokenPeakPhrase (DEC-076)', () => {
  const drift = { code: 'elbow_drift', message: 'Pega el codo al cuerpo, estás usando impulso' };

  it('sin aviso de técnica dice la frase del recorrido', () => {
    expect(spokenPeakPhrase('curl', 60, true, null)).toBe('¡Excelente contracción!');
    expect(spokenPeakPhrase('curl', 90, true, null)).toBe('Sube un poco más');
  });

  it('con los codos despegados en el pico dice el aviso, no el elogio', () => {
    expect(spokenPeakPhrase('curl', 60, true, drift)).toBe(drift.message);
  });

  it('los avisos sin validar no cambian la voz (falsos positivos en el press)', () => {
    const arch = { code: 'lumbar_arch', message: 'No arquees la espalda' };
    const asym = { code: 'asymmetry', message: 'Un brazo va adelantado, iguala el recorrido' };
    expect(spokenPeakPhrase('press', 170, true, arch)).toBe('¡Extensión completa!');
    expect(spokenPeakPhrase('curl', 60, true, asym)).toBe('¡Excelente contracción!');
  });
});
