/**
 * Motor de análisis pedido en la URL (ver DEC-057 y DEC-072).
 *
 * Por defecto, curl y press usan los contadores 2D de producción; la sentadilla y la ola 1
 * ya usan el motor 3D (DEC-059, DEC-072). Con `?engine=3d`, curl y press también pasan al 3D
 * (`FramePipeline`: One Euro → nivelación → calibración → `Tracker3D`), para probarlos en
 * celular sin afectar a nadie más. Con `?engine=2d`, los ejercicios que tienen contador 2D
 * vuelven a él: es el respaldo si el 3D falla en algún celular. Se evalúa una sola vez al cargar.
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
