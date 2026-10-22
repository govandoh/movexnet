import { useEffect, useMemo, useReducer, useRef, useState, type ReactNode } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { getExercise } from '../../domain/catalog';
import {
  REST_PAUSE_SECONDS, completedSets, initManual, isTimedPlan, manualReducer, methodHint, remainingMs, totalAmount,
  type ManualPlan, type ManualState,
} from '../../domain/manualWorkout';
import { defaultPlan, findEntry, manualRecords, planFromEntry } from '../../domain/sessionBuild';
import { IconBack } from '../components/icons';
import { appActions, newId, useAppState } from '../state/appStore';
import { TechniqueSheet } from '../technique/TechniqueSheet';
import './manual.css';

const RING_R = 90;
const RING_C = 2 * Math.PI * RING_R;

function TimerRing({ fraction, seconds, sub, tone }: { fraction: number; seconds: number; sub: string; tone: 'work' | 'rest' }) {
  const f = Math.min(1, Math.max(0, fraction));
  return (
    <div className="timer-ring" data-tone={tone} role="timer" aria-label={`${seconds} segundos. ${sub}`}>
      <svg viewBox="0 0 200 200" aria-hidden="true">
        <circle className="timer-ring__track" cx="100" cy="100" r={RING_R} />
        <circle className="timer-ring__bar" cx="100" cy="100" r={RING_R} strokeDasharray={RING_C} strokeDashoffset={RING_C * (1 - f)} />
      </svg>
      <div className="timer-ring__label" aria-hidden="true">
        <span className="timer-ring__time display-number">{seconds}</span>
        <span className="timer-ring__sub">{sub}</span>
      </div>
    </div>
  );
}

/** Mantiene la pantalla encendida mientras se entrena; si el navegador no lo soporta, la app funciona igual. */
function useWakeLock(): void {
  useEffect(() => {
    if (!('wakeLock' in navigator)) return;
    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const s = await navigator.wakeLock.request('screen');
        if (cancelled) await s.release(); else sentinel = s;
      } catch { /* permiso denegado o ahorro de batería: se sigue sin bloquear la pantalla */ }
    };
    void request();
    // Al volver a primer plano el sistema libera el bloqueo: hay que pedirlo de nuevo.
    const onVisible = () => { if (document.visibilityState === 'visible') void request(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      sentinel?.release().catch(() => { /* ya liberado */ });
    };
  }, []);
}

function describePlan(plan: ManualPlan): string {
  const volume = isTimedPlan(plan) ? `${plan.holdSeconds} s` : `${plan.reps ?? 0} repeticiones`;
  const load = plan.loadKg !== undefined ? ` · ${plan.loadKg} kg` : '';
  return `${plan.sets} ${plan.sets === 1 ? 'serie' : 'series'} de ${volume}${load}`;
}

function ManualWorkout({ plan }: { plan: ManualPlan }) {
  const navigate = useNavigate();
  const [state, dispatch] = useReducer(manualReducer, plan, initManual);
  const [now, setNow] = useState(() => Date.now());
  const [technique, setTechnique] = useState(false);
  const savedRef = useRef(false);
  const latest = useRef<ManualState>(state);
  // Se actualiza en un efecto, no al renderizar: la salida inesperada lee siempre el último estado.
  useEffect(() => { latest.current = state; });
  const exercise = getExercise(plan.exerciseId);
  const timed = isTimedPlan(plan);

  useWakeLock();

  /**
   * Guarda una sola vez, y solo si hubo trabajo: así un montaje doble o una salida sin series no
   * bloquea nada. Las series del ejercicio forman una sesión ya cerrada (DEC-079).
   */
  function saveOnce(s: ManualState): void {
    const records = manualRecords(s, newId, newId());
    if (savedRef.current || records.length === 0) return;
    savedRef.current = true;
    appActions.addSets(records);
  }

  // Los relojes son marcas de fin: el intervalo solo repinta y avisa al reductor la hora real.
  useEffect(() => {
    if (state.timerEndsAt === null) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      dispatch({ type: 'tick', now: t });
    }, 250);
    return () => clearInterval(id);
  }, [state.timerEndsAt]);

  // Terminar la última serie guarda el ejercicio.
  useEffect(() => {
    if (state.phase === 'finished') saveOnce(state);
  }, [state]);

  // Salir por el gesto de volver, sin pasar por el botón: lo hecho no se pierde.
  useEffect(() => () => saveOnce(manualReducer(latest.current, { type: 'finish', now: Date.now() })), []);

  const act = (a: { type: 'start' | 'complete' | 'continue' | 'close' | 'skipRest' | 'finish' }) => {
    const t = Date.now();
    setNow(t);
    dispatch({ ...a, now: t });
  };

  function exit() {
    saveOnce(manualReducer(state, { type: 'finish', now: Date.now() }));
    navigate(-1);
  }

  const left = remainingMs(state, now);
  const seconds = Math.ceil(left / 1000);
  const hint = methodHint(state);
  const done = completedSets(state);
  const setLabel = `Serie ${Math.min(state.setIndex + 1, plan.sets)} de ${plan.sets}`;

  let stage: ReactNode = null;
  let controls: ReactNode = null;

  switch (state.phase) {
    case 'ready':
      stage = (
        <>
          <p className="muted">{state.setIndex === 0 ? 'Listo para empezar' : 'Descanso terminado'}</p>
          <p className="display-number manual__counter">{timed ? plan.holdSeconds : plan.reps}<small>{timed ? 'segundos' : 'repeticiones objetivo'}</small></p>
        </>
      );
      controls = <button className="btn btn--primary btn--block" onClick={() => act({ type: 'start' })}>Empezar {setLabel.toLowerCase()}</button>;
      break;

    case 'working':
      if (timed) {
        stage = <TimerRing fraction={left / ((plan.holdSeconds as number) * 1000)} seconds={seconds} sub="Mantén la posición" tone="work" />;
        controls = <button className="btn btn--primary btn--block" onClick={() => act({ type: 'complete' })}>Terminar ahora</button>;
      } else {
        stage = (
          <>
            <p className="muted" aria-live="polite">{state.extras > 0 ? `Tramo extra ${state.extras}` : `Objetivo: ${plan.reps} repeticiones`}</p>
            <p className="display-number manual__counter" aria-live="polite">{state.amount}<small>repeticiones</small></p>
            <div className="manual__rep-buttons">
              <button className="btn manual__rep-minus" aria-label="Quitar una repetición" onClick={() => dispatch({ type: 'rep', delta: -1 })}>−1</button>
              <button className="btn manual__rep-plus" aria-label="Sumar una repetición" onClick={() => dispatch({ type: 'rep', delta: 1 })}>+1</button>
            </div>
          </>
        );
        controls = <button className="btn btn--primary btn--block" onClick={() => act({ type: 'complete' })}>Terminar serie</button>;
      }
      break;

    case 'pause':
      stage = <TimerRing fraction={left / (REST_PAUSE_SECONDS * 1000)} seconds={seconds} sub="Rest-pause" tone="rest" />;
      controls = (
        <div className="manual__bar-row">
          <button className="btn btn--ghost" onClick={() => act({ type: 'close' })}>Cerrar serie</button>
          <button className="btn btn--primary" disabled={left > 0} onClick={() => act({ type: 'continue' })}>{left > 0 ? 'Descansa…' : 'Mini-serie'}</button>
        </div>
      );
      break;

    case 'drop':
      stage = (
        <>
          <p className="display-number manual__counter">{state.amount}<small>repeticiones hasta ahora</small></p>
          <p className="notice notice--indigo">Baja la carga entre 20 y 30 % y sigue sin descansar.</p>
        </>
      );
      controls = (
        <div className="manual__bar-row">
          <button className="btn btn--ghost" onClick={() => act({ type: 'close' })}>Cerrar serie</button>
          <button className="btn btn--primary" onClick={() => act({ type: 'continue' })}>Seguir con menos carga</button>
        </div>
      );
      break;

    case 'resting':
      stage = <TimerRing fraction={left / (plan.restSeconds * 1000)} seconds={seconds} sub={`Descanso · sigue la serie ${state.setIndex + 1}`} tone="rest" />;
      controls = <button className="btn btn--secondary btn--block" onClick={() => act({ type: 'skipRest' })}>Saltar descanso</button>;
      break;

    case 'finished':
      stage = (
        <section className="card card--framed" style={{ width: '100%', textAlign: 'left' }}>
          <h2 className="card-title">{done.length > 0 ? 'Ejercicio terminado' : 'Sin series registradas'}</h2>
          {done.map(d => (
            <div key={d.index} className="manual-summary__row">
              <span>Serie {d.index + 1}{d.extras > 0 ? ` (+${d.extras} extra)` : ''}</span>
              <strong>{d.amount} {d.timed ? 's' : 'rep.'}</strong>
            </div>
          ))}
          {done.length > 0 && (
            <>
              <div className="manual-summary__row"><span>Total</span><strong>{totalAmount(state)} {timed ? 's' : 'rep.'}</strong></div>
              <p className="muted">Guardado en tu historial: cuenta para tu perfil y tus logros.</p>
            </>
          )}
        </section>
      );
      controls = <button className="btn btn--primary btn--block" onClick={() => navigate('/', { replace: true })}>Listo</button>;
      break;
  }

  return (
    <div className="manual">
      <div className="manual__body">
        <div className="manual__top">
          <button className="icon-btn" aria-label="Salir del entrenamiento" onClick={exit}><IconBack /></button>
          <div className="manual__title">
            <p className="muted">{state.phase === 'finished' ? 'Resumen' : setLabel}</p>
            <h1>{exercise?.name ?? plan.exerciseId}</h1>
          </div>
          <button className="btn btn--secondary" style={{ minHeight: 44, padding: '0 var(--space-3)', fontSize: 'var(--text-body)' }} onClick={() => setTechnique(true)}>Técnica</button>
        </div>
        <p className="muted">{describePlan(plan)} · descanso {plan.restSeconds} s</p>
        {hint && state.phase !== 'finished' && <p className="muted">{hint}</p>}
        <div className="manual__stage">{stage}</div>
      </div>

      <div className="manual__bar">
        {controls}
        {state.phase !== 'finished' && state.phase !== 'ready' && (
          <button className="btn btn--ghost btn--block" onClick={() => act({ type: 'finish' })}>Terminar ejercicio</button>
        )}
      </div>
      {technique && <TechniqueSheet exerciseId={plan.exerciseId} onClose={() => setTechnique(false)} />}
    </div>
  );
}

/**
 * Pantalla de entrenamiento manual (DEC-047). Llega con `?entry=<id de la entrada de rutina>`
 * y usa los números de la rutina, o con `?ex=<id del catálogo>` y usa un plan por defecto.
 */
export function ManualWorkoutScreen() {
  const [params] = useSearchParams();
  const { routines } = useAppState();
  const entryId = params.get('entry');
  const exId = params.get('ex');
  const plan = useMemo(() => {
    const entry = entryId ? findEntry(routines, entryId) : null;
    if (entry) return planFromEntry(entry);
    return exId ? defaultPlan(exId) : null;
    // La rutina puede cambiar en el almacenamiento mientras se entrena; el plan se fija al entrar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryId, exId]);

  if (!plan) return <Navigate to="/ejercicios" replace />;
  // La `key` reinicia el entrenamiento si la ruta cambia de ejercicio sin desmontar la pantalla.
  return <ManualWorkout key={`${entryId ?? ''}|${exId ?? ''}`} plan={plan} />;
}
