/**
 * Motor de análisis pedido en la URL (ver DEC-057 y DEC-078).
 *
 * Por defecto, los siete ejercicios usan el motor 3D (`FramePipeline`: One Euro →
 * nivelación → calibración → `Tracker3D`). Con `?engine=2d`, sentadilla, curl y press
 * vuelven a los contadores 2D del MVP: es el respaldo si el 3D falla en algún celular.
 * `?engine=3d` se acepta por compatibilidad y equivale al valor por defecto. Se evalúa una
 * sola vez al cargar.
 */
export type EngineOverride = '3d' | '2d' | null;

export const ENGINE_OVERRIDE: EngineOverride = (() => {
  try {
    const engine = new URLSearchParams(window.location.search).get('engine');
    return engine === '3d' || engine === '2d' ? engine : null;
  } catch {
    return null;
  }
})();
