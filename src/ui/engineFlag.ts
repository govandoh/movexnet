/**
 * Motor de análisis activo (ver DEC-057).
 *
 * Por defecto, curl y press usan los contadores 2D de producción; la sentadilla y la ola 1
 * ya usan el motor 3D (DEC-059, DEC-072). Con `?engine=3d` en la URL, curl y press también
 * pasan al 3D (`FramePipeline`: One Euro → nivelación → calibración → `Tracker3D`), para
 * probarlos en celular sin afectar a nadie más. Se evalúa una sola vez al cargar.
 */
export const ENGINE_3D: boolean = (() => {
  try {
    return new URLSearchParams(window.location.search).get('engine') === '3d';
  } catch {
    return false;
  }
})();
