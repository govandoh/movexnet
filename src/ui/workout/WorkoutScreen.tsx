import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { startCamera, stopCamera } from '../../pose/camera';
import { initPoseDetector, detectAndDraw, getLastWorldLandmarks } from '../../pose/poseDetector';
import { DeviceGravityTracker, motionPermissionRequired, requestMotionPermission } from '../../pose/deviceGravity';
import { RECORD_MODE, RECORD_SCRIPT, captureFrame, downloadFixture, type RecordedFrame } from '../../testing/fixtureRecorder';
import type { PlankResult } from '../../exercises/plankTracker';
import type { FeedbackLevel, Tracker3DResult } from '../../exercises/tracker3d';
import type { EngineOutput } from '../../exercises/exerciseTrackers';
import { needsStandingCalibration } from '../../exercises/definitions3d';
import { SetSummaryBuilder, type SetSummary } from '../../analysis/setSummary';
import { FeedbackPolicy } from '../../feedback/feedbackPolicy';
import type { AssistantId } from '../../domain/catalog';
import { useSpeech, useSpeechReady } from '../useSpeech';
import { appActions, useAppState } from '../state/appStore';
import { ASSISTED, ASSISTED_NAMES, catalogIdFor, createWorkoutTrackers, isAssistantId, usesEngine3D } from './exercises';
import {
  DEFAULT_TARGET_REPS, FEEDBACK_STRATEGY, PLANK_ANNOUNCE_EVERY_S, PLANK_WARNING_MIN_MS,
  fatigueSummary, spokenPeakPhrase,
} from './coaching';
import { AUTO_START_MS, LEVEL_OK_DEG, bodyInFrame, bubbleOffset, isReady, phoneTilt, type PrepState } from './prep';
import { PrepPanel } from './PrepPanel';
import { SetHud, type HudState } from './SetHud';
import { SetSummaryView } from './SetSummaryView';
import { IconBack, IconBulb, IconCube, IconHelp, IconSwitchCamera, IconVoice, IconVoiceOff } from '../components/icons';
import { MiniMap3D, type MiniMapHandle } from './MiniMap3D';
import { SetTips } from './SetTips';
import { TechniqueSheet } from '../technique/TechniqueSheet';
import { buildSetRecord } from '../../domain/sessionBuild';
import type { BodyOrientation, Landmark3D } from '../../geometry/vectors3d';
import { VIEW_LABEL, ViewStabilizer, bodyView } from './bodyView';
import './workout.css';

type Status = 'loading' | 'ready' | 'error';
type Phase = 'prep' | 'active' | 'summary';
type FacingMode = 'environment' | 'user';

/** Espera antes de ofrecer el permiso de sensores en iOS si no llegó ninguna lectura, en ms. */
const MOTION_PERMISSION_WAIT_MS = 1500;
/** Recorrido de la burbuja como fracción del diámetro del nivelador (que cambia con la pantalla). */
const BUBBLE_TRAVEL_RATIO = 0.35;
/** Suavizado de la burbuja por cuadro: sigue al sensor sin temblar (DESIGN.md §6). */
const BUBBLE_SMOOTHING = 0.18;
/** Intervalo mínimo entre actualizaciones del mini mapa 3D, en ms (~25 fps bastan para verlo fluido). */
const MINI_MAP_EVERY_MS = 40;
/** Cada cuántos frames se refresca el contador del botón de grabación. */
const RECORD_UI_EVERY = 15;

function serializeError(err: unknown): string {
  if (err instanceof Error) return err.message;
  // Un Event (fallo al descargar el WASM o el modelo) no trae mensaje útil.
  if (typeof Event !== 'undefined' && err instanceof Event) return 'no se pudo descargar el detector de poses; revisa tu conexión.';
  try { return JSON.stringify(err); } catch { return String(err); }
}

function newId(): string {
  try { return crypto.randomUUID(); } catch { return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`; }
}

const EMPTY_HUD: HudState = { reps: 0, level: 'idle', message: '', extreme: null, lastConcentricMs: null, qualities: [], rejected: 0 };

export function WorkoutScreen() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { voiceEnabled, view } = useAppState();
  const [techniqueOpen, setTechniqueOpen] = useState(false);
  const initialEx = params.get('ex');
  const targetReps = Number(params.get('reps')) || DEFAULT_TARGET_REPS;

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef(0);
  const cameraStopPendingRef = useRef(false);

  const [ex, setEx] = useState<AssistantId>(isAssistantId(initialEx) ? initialEx : 'squat');
  // Un contador por ejercicio (DEC-063); se crean una vez y el bucle usa el del ejercicio activo.
  const [{ pipeline, trackers }] = useState(() => createWorkoutTrackers(ex));
  const [phase, setPhase] = useState<Phase>('prep');
  const [status, setStatus] = useState<Status>('loading');
  const [errorMsg, setErrorMsg] = useState('');
  const [facingMode, setFacingMode] = useState<FacingMode>(() => {
    try {
      const v = localStorage.getItem('preferred_camera');
      return v === 'user' || v === 'environment' ? v : 'environment';
    } catch { return 'environment'; }
  });
  const [setNumber, setSetNumber] = useState(1);
  const [prep, setPrep] = useState<PrepState>({ levelOk: null, bodyOk: false, calibration: null });
  const [tilt, setTilt] = useState<number | null>(null);
  const [needsMotion, setNeedsMotion] = useState(false);
  const [hud, setHud] = useState<HudState>(EMPTY_HUD);
  const [summary, setSummary] = useState<{ summary: SetSummary | null; heldSeconds: number | null } | null>(null);
  const [recordedCount, setRecordedCount] = useState(0);
  // Estado que se ve en todas las fases: celular nivelado y vista del cuerpo. Solo cambian
  // cuando cambia el valor, nunca por cuadro.
  const [levelOk, setLevelOk] = useState<boolean | null>(null);
  const [orientation, setOrientation] = useState<BodyOrientation | null>(null);

  // La primera vez con cada ejercicio la ficha se abre sola en la preparación (Video_1 y
  // Video_3); al cerrarla queda marcada como vista.
  const catalogId = catalogIdFor(ex);
  const firstTime = status === 'ready' && phase === 'prep' && !view.seenTechnique.includes(catalogId);
  const sheetOpen = techniqueOpen || firstTime;

  // Estado leído desde el bucle de cuadros (evita closures viejos).
  const exRef = useRef(ex);
  const phaseRef = useRef<Phase>('prep');
  const voiceRef = useRef(voiceEnabled);
  const gravityRef = useRef<DeviceGravityTracker | null>(null);
  const policyRef = useRef(new FeedbackPolicy(FEEDBACK_STRATEGY[ex]));
  const builderRef = useRef(new SetSummaryBuilder());
  const lastPeakLevelRef = useRef<FeedbackLevel>('good');
  const readySinceRef = useRef<number | null>(null);
  const prepKeyRef = useRef('');
  const hudKeyRef = useRef('');
  const hudRef = useRef<HudState>(EMPTY_HUD);
  const plankAnnouncedRef = useRef(0);
  const plankWarnedAtRef = useRef(-Infinity);
  const plankSecondsRef = useRef(0);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const bubblePos = useRef({ x: 0, y: 0 });
  const recordingRef = useRef<RecordedFrame[]>([]);
  const startSetRef = useRef<() => void>(() => {});
  // Mini mapa 3D (DEC-061): se alimenta desde el bucle, como mucho cada MINI_MAP_EVERY_MS.
  const miniRef = useRef<MiniMapHandle | null>(null);
  const miniVisibleRef = useRef(view.showMiniMap);
  const lastMiniRef = useRef(0);
  const levelOkRef = useRef<boolean | null>(null);
  const viewRef = useRef(new ViewStabilizer());
  const shownViewRef = useRef<BodyOrientation | null>(null);
  // Con la ficha de técnica abierta no se cuenta ni arranca la serie: la persona se acerca
  // al celular a leer y no debe sumar ni perder repeticiones.
  const pausedRef = useRef(false);

  const rawSpeak = useSpeech();
  // Sin un primer toque el navegador no deja hablar: la preparación lo pide (DEC-071).
  const speechReady = useSpeechReady();
  const speak = useCallback((text: string) => { if (voiceRef.current && text) rawSpeak(text); }, [rawSpeak]);

  useEffect(() => { voiceRef.current = voiceEnabled; }, [voiceEnabled]);
  useEffect(() => { miniVisibleRef.current = view.showMiniMap; }, [view.showMiniMap]);
  useEffect(() => { exRef.current = ex; }, [ex]);
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { pausedRef.current = sheetOpen; }, [sheetOpen]);

  /** HUD: solo se actualiza cuando cambia lo que se ve, nunca por cuadro. */
  const pushHud = useCallback((next: HudState) => {
    hudRef.current = next;
    const key = `${next.reps}|${next.level}|${next.message}|${next.extreme}|${next.qualities.join('')}|${next.rejected}`;
    if (key === hudKeyRef.current) return;
    hudKeyRef.current = key;
    setHud(next);
  }, []);

  function resetCounters(next: AssistantId) {
    // Solo el contador que se va a usar: los demás se reinician al activarlos.
    trackers[next].reset();
    plankAnnouncedRef.current = 0;
    plankSecondsRef.current = 0;
    lastPeakLevelRef.current = 'good';
    builderRef.current = new SetSummaryBuilder();
    policyRef.current = new FeedbackPolicy(FEEDBACK_STRATEGY[next]);
    hudKeyRef.current = '';
    pushHud(EMPTY_HUD);
  }

  function startSet() {
    resetCounters(exRef.current);
    pipeline.startNewSet();
    readySinceRef.current = null;
    phaseRef.current = 'active';
    setPhase('active');
    speak(exRef.current === 'plank' ? 'Mantén la posición' : '¡Vamos!');
  }
  // El bucle de cuadros arranca la serie sola; lee siempre la versión actual.
  useEffect(() => { startSetRef.current = startSet; });

  function finishSet() {
    const current = exRef.current;
    const timed = current === 'plank';
    const s = timed ? null : builderRef.current.summary();
    const held = timed ? plankSecondsRef.current : null;
    phaseRef.current = 'summary';
    setSummary({ summary: s, heldSeconds: held });
    setPhase('summary');
    const valid = timed ? held ?? 0 : s?.validReps ?? 0;
    // Misma construcción que el modo manual (`domain/sessionBuild`): el historial no distingue el origen.
    const record = buildSetRecord({
      id: newId(),
      now: new Date(),
      exerciseId: catalogIdFor(current),
      validReps: valid,
      rejectedReps: s?.rejectedReps ?? 0,
      goodReps: timed ? valid : s?.goodReps ?? 0,
      timed,
      fatigue: s ? fatigueSummary(s.fatigue.level, s.validReps) : null,
    });
    if (record) appActions.addSet(record);
    speak(timed ? `Serie completada. ${valid} segundos` : `Serie completada. ${valid} repeticiones`);
  }

  function selectExercise(next: AssistantId) {
    if (next === exRef.current) return;
    exRef.current = next;
    setEx(next);
    setSetNumber(1);
    resetCounters(next);
    readySinceRef.current = null;
    prepKeyRef.current = '';
    if (RECORD_MODE) { recordingRef.current = []; setRecordedCount(0); }
  }

  function nextSet() {
    setSummary(null);
    setSetNumber(n => n + 1);
    resetCounters(exRef.current);
    readySinceRef.current = null;
    prepKeyRef.current = '';
    phaseRef.current = 'prep';
    setPhase('prep');
  }

  useEffect(() => {
    let cancelled = false;
    let motionTimer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;
    if (!navigator.mediaDevices) return;

    async function setup() {
      try {
        // Tras detener una cámara, el hardware tarda ~300-500 ms en liberarse (DEC-021).
        if (cameraStopPendingRef.current) {
          cameraStopPendingRef.current = false;
          await new Promise<void>(resolve => setTimeout(resolve, 450));
          if (cancelled) return;
        }
        await initPoseDetector();
        if (cancelled || !videoRef.current) return;
        streamRef.current = await startCamera(videoRef.current, facingMode);
        if (cancelled) return;
        setStatus('ready');

        // Cámara nueva: filtro y calibración desde cero.
        pipeline.reset();

        // El acelerómetro alimenta el nivelador, el motor 3D y la gravedad de las grabaciones.
        if (!gravityRef.current) gravityRef.current = new DeviceGravityTracker();
        gravityRef.current.start();
        if (motionPermissionRequired()) {
          motionTimer = setTimeout(() => {
            if (!cancelled && !gravityRef.current?.hasReading) setNeedsMotion(true);
          }, MOTION_PERMISSION_WAIT_MS);
        }

        rafRef.current = requestAnimationFrame(loop);
      } catch (err) {
        if (!cancelled) {
          setErrorMsg(serializeError(err));
          setStatus('error');
        }
      }
    }

    function loop() {
      if (cancelled || !videoRef.current || !canvasRef.current) return;
      const now = performance.now();
      const landmarkSets = detectAndDraw(videoRef.current, canvasRef.current, now);
      const worldDown = gravityRef.current?.worldDown(facingMode) ?? null;
      const current = exRef.current;
      const engine3D = usesEngine3D(current);
      const world = landmarkSets.length > 0 ? getLastWorldLandmarks() : null;

      if (RECORD_MODE && landmarkSets.length > 0) {
        const buf = recordingRef.current;
        buf.push(captureFrame(now, landmarkSets[0], getLastWorldLandmarks(), worldDown));
        if (buf.length % RECORD_UI_EVERY === 0) setRecordedCount(buf.length);
      }

      // Lo que muestra el mini mapa: el esqueleto ya nivelado y calibrado en el motor 3D,
      // el que da MediaPipe en el 2D.
      let liveWorld: readonly Landmark3D[] | null = world;

      const tiltDeg = phoneTilt(worldDown);
      const level = tiltDeg === null ? null : tiltDeg <= LEVEL_OK_DEG;
      if (level !== levelOkRef.current) {
        levelOkRef.current = level;
        setLevelOk(level);
      }
      const shownView = viewRef.current.update(bodyView(world), now);
      if (shownView !== shownViewRef.current) {
        shownViewRef.current = shownView;
        setOrientation(shownView);
      }

      if (pausedRef.current) {
        // Ficha de técnica abierta: ni cuenta ni arranca sola.
        readySinceRef.current = null;
      } else if (phaseRef.current === 'prep') {
        updateBubble(worldDown);
        let calibration: number | null = null;
        // Los ejercicios de suelo no esperan la calibración de pie (DEC-071): `null` no la exige.
        const standing = needsStandingCalibration(current);
        if (engine3D && world) {
          // En preparación solo se aprende la calibración de pie (el contador no cuenta).
          const prepared = pipeline.prepare({ world, t: now, worldDown });
          calibration = standing ? prepared.diagnostics.calibrationProgress : null;
          liveWorld = prepared.world;
        } else if (engine3D) {
          calibration = standing ? 0 : null;
        }
        const next: PrepState = {
          levelOk: level,
          bodyOk: bodyInFrame(landmarkSets[0], current),
          calibration: calibration === null ? null : Math.round(calibration * 10) / 10,
        };
        const key = `${next.levelOk}|${next.bodyOk}|${next.calibration}|${tiltDeg === null ? '' : Math.round(tiltDeg)}`;
        if (key !== prepKeyRef.current) {
          // Vibración corta al quedar nivelado (DESIGN.md §6, nivelador), donde exista.
          if (next.levelOk && prepKeyRef.current.startsWith('false')) navigator.vibrate?.(10);
          prepKeyRef.current = key;
          setPrep(next);
          setTilt(tiltDeg === null ? null : Math.round(tiltDeg));
        }
        if (isReady(next)) {
          readySinceRef.current ??= now;
          if (now - readySinceRef.current >= AUTO_START_MS) startSetRef.current();
        } else {
          readySinceRef.current = null;
        }
      } else if (phaseRef.current === 'active' && landmarkSets.length > 0) {
        const out = trackers[current].update({ t: now, image: landmarkSets[0], world: world ?? undefined, down: worldDown });
        const d = out.detail;
        switch (d.engine) {
          case 'hold': liveWorld = d.world; handlePlank(d.result, now); break;
          case '3d': liveWorld = d.world; handleReps(out, d.result, current, now); break;
          case '2d': handleReps(out, null, current, now); break;
          case 'none': break; // el motor 3D no recibió landmarks 3D en este frame
        }
      }

      if (liveWorld && miniVisibleRef.current && now - lastMiniRef.current >= MINI_MAP_EVERY_MS) {
        lastMiniRef.current = now;
        miniRef.current?.updateLive(liveWorld);
      }

      rafRef.current = requestAnimationFrame(loop);
    }

    /** Burbuja del nivelador: `transform` directo sobre el elemento, sin renders de React. */
    function updateBubble(worldDown: Parameters<typeof bubbleOffset>[0]) {
      const level = bubbleRef.current?.parentElement;
      const target = bubbleOffset(worldDown, (level?.clientWidth ?? 176) * BUBBLE_TRAVEL_RATIO);
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
      const k = reduce ? 1 : BUBBLE_SMOOTHING;
      bubblePos.current.x += (target.x - bubblePos.current.x) * k;
      bubblePos.current.y += (target.y - bubblePos.current.y) * k;
      if (bubbleRef.current) {
        bubbleRef.current.style.transform = `translate(${bubblePos.current.x.toFixed(1)}px, ${bubblePos.current.y.toFixed(1)}px)`;
      }
    }

    /** Ejercicios por repeticiones, en cualquier motor. `result3D` alimenta el resumen 3D. */
    function handleReps(out: EngineOutput, result3D: Tracker3DResult | null, current: AssistantId, now: number) {
      let peakDeg: number | null = null;
      let repCounted = false;
      let rejection: string | null = null;
      for (const e of out.events) {
        if (e.kind === 'peak') peakDeg = e.extremeAngle;
        else if (e.kind === 'complete') repCounted = true;
        else rejection = e.message;
      }

      const b = builderRef.current;
      if (result3D) {
        b.addFrame(result3D);
      } else {
        // Motor 2D: la calidad de la rep es el nivel de aviso del último pico o fondo.
        if (peakDeg !== null) lastPeakLevelRef.current = out.feedbackLevel;
        if (repCounted) b.addRep2D(lastPeakLevelRef.current);
      }
      for (const u of policyRef.current.decide({
        now, reps: b.validReps, repCounted,
        peakPhrase: peakDeg === null ? null : spokenPeakPhrase(
          current, peakDeg, usesEngine3D(current),
          result3D?.formIssue ? { code: result3D.formIssue, message: result3D.feedbackMessage } : null,
        ),
        rejectionMessage: rejection,
      })) speak(u);

      // El contador del motor 3D acumula entre series; el HUD y la voz cuentan la serie en curso.
      const prev = hudRef.current;
      const s = repCounted || rejection ? b.summary() : null;
      pushHud({
        reps: b.validReps,
        level: rejection ? 'bad' : out.feedbackLevel,
        message: rejection ?? out.feedbackMessage,
        extreme: peakDeg === null ? prev.extreme : Math.round(peakDeg),
        lastConcentricMs: s ? s.reps.at(-1)?.concentricMs ?? prev.lastConcentricMs : prev.lastConcentricMs,
        qualities: s ? s.reps.map(x => x.quality) : prev.qualities,
        rejected: s ? s.rejectedReps : prev.rejected,
      });
    }

    function handlePlank(r: PlankResult, now: number) {
      plankSecondsRef.current = r.heldSeconds;
      if (r.heldSeconds >= plankAnnouncedRef.current + PLANK_ANNOUNCE_EVERY_S) {
        plankAnnouncedRef.current = r.heldSeconds - (r.heldSeconds % PLANK_ANNOUNCE_EVERY_S);
        speak(`${plankAnnouncedRef.current} segundos`);
      } else if (r.formIssue && now - plankWarnedAtRef.current > PLANK_WARNING_MIN_MS) {
        plankWarnedAtRef.current = now;
        speak(r.feedbackMessage);
      }
      pushHud({ ...hudRef.current, reps: r.heldSeconds, level: r.feedbackLevel, message: r.feedbackMessage, extreme: Math.round(r.bodyLineDeg) });
    }

    void setup();

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafRef.current);
      if (motionTimer) clearTimeout(motionTimer);
      gravityRef.current?.stop();
      if (streamRef.current) {
        stopCamera(streamRef.current);
        streamRef.current = null;
        // Soltar srcObject para que el hardware se libere antes del siguiente getUserMedia (DEC-021).
        if (video) video.srcObject = null;
        cameraStopPendingRef.current = true;
      }
    };
  }, [facingMode, speak, pushHud, pipeline, trackers]);

  function askMotion() {
    // iOS: el permiso se pide directamente desde el toque, antes de cualquier await.
    void requestMotionPermission().then(ok => {
      if (ok) gravityRef.current?.start();
      setNeedsMotion(!ok);
    });
  }

  function switchCamera() {
    const next: FacingMode = facingMode === 'environment' ? 'user' : 'environment';
    try { localStorage.setItem('preferred_camera', next); } catch { /* storage bloqueado */ }
    setStatus('loading');
    setFacingMode(next);
  }

  // Sin contexto seguro no existe `mediaDevices`: la cámara no puede arrancar.
  const insecure = typeof navigator !== 'undefined' && !navigator.mediaDevices;
  const shownStatus: Status = insecure ? 'error' : status;
  const shownError = insecure ? 'abre la app con HTTPS: la cámara no funciona en una conexión no segura.' : errorMsg;

  const mirrorStyle = facingMode === 'user' ? { transform: 'scaleX(-1)' } : undefined;
  const levelPill = needsMotion
    ? <button className="pill pill--amber" onClick={askMotion}>Nivelar</button>
    : tilt === null
      ? null
      : <span className={`pill ${tilt <= LEVEL_OK_DEG ? 'pill--volt' : 'pill--amber'}`}>{tilt}°</span>;

  return (
    <div className="workout">
      <video ref={videoRef} className="workout__video" style={mirrorStyle} playsInline muted />
      <canvas ref={canvasRef} className="workout__canvas" style={mirrorStyle} />

      {phase !== 'summary' && <header className="workout__top">
        <button className="icon-btn icon-btn--glass" aria-label="Salir del entrenamiento" onClick={() => navigate(-1)}><IconBack /></button>
        <div className="workout__title">
          <strong>{ASSISTED_NAMES[ex]}</strong>
          {/* Vista: cómo te ve la cámara; la ficha de técnica dice cuál conviene (Video_2 y Video_3). */}
          <span>Serie {setNumber}{orientation && <> · <b>{VIEW_LABEL[orientation]}</b></>}</span>
        </div>
        {levelPill}
        <button className="icon-btn icon-btn--glass" aria-label="Técnica del ejercicio" onClick={() => setTechniqueOpen(true)}><IconHelp /></button>
      </header>}

      {/* Herramientas en columna: se leen de un vistazo y no compiten con el título (DEC-061). */}
      {phase !== 'summary' && (
        <div className="workout__tools" role="toolbar" aria-label="Opciones del entrenamiento" data-minimap-ceiling="right">
          <button className="icon-btn icon-btn--glass" aria-label={voiceEnabled ? 'Silenciar voz' : 'Activar voz'} aria-pressed={voiceEnabled}
            onClick={() => appActions.setVoice(!voiceEnabled)}>
            {voiceEnabled ? <IconVoice /> : <IconVoiceOff />}
          </button>
          <button className="icon-btn icon-btn--glass" aria-label="Cambiar cámara" onClick={switchCamera}><IconSwitchCamera /></button>
          <button className="icon-btn icon-btn--glass" aria-label={view.showMiniMap ? 'Ocultar el modelo 3D' : 'Mostrar el modelo 3D'}
            aria-pressed={view.showMiniMap} onClick={() => appActions.setView({ showMiniMap: !view.showMiniMap })}><IconCube /></button>
          {phase === 'active' && (
            <button className="icon-btn icon-btn--glass" aria-label={view.showTips ? 'Ocultar consejos' : 'Mostrar consejos'}
              aria-pressed={view.showTips} onClick={() => appActions.setView({ showTips: !view.showTips })}><IconBulb /></button>
          )}
        </div>
      )}

      {status === 'ready' && phase !== 'summary' && view.showMiniMap && (
        <MiniMap3D ref={miniRef} demoId={catalogId} layoutKey={phase} onHide={() => appActions.setView({ showMiniMap: false })}
          levelOk={levelOk}
          hint={phase === 'prep' && prep.calibration !== null && prep.calibration < 1 ? 'Párate derecho para calibrar' : null} />
      )}

      {shownStatus === 'loading' && <p className="workout__status" role="status">Preparando la cámara y el detector…</p>}
      {shownStatus === 'error' && <p className="workout__status workout__status--error" role="alert">No se pudo iniciar la cámara: {shownError}</p>}

      {status === 'ready' && phase === 'prep' && (
        <PrepPanel
          ex={ex}
          exercises={ASSISTED}
          names={ASSISTED_NAMES}
          onSelect={selectExercise}
          prep={prep}
          tilt={tilt}
          bubbleRef={bubbleRef}
          onStart={() => startSetRef.current()}
          onTechnique={() => setTechniqueOpen(true)}
          voiceLocked={voiceEnabled && !speechReady}
        />
      )}

      {status === 'ready' && phase === 'active' && (
        <SetHud
          ex={ex}
          hud={hud}
          target={ex === 'plank' ? null : targetReps}
          engine3D={usesEngine3D(ex)}
          onFinish={finishSet}
          onCancel={nextSet}
          tips={view.showTips ? <SetTips exerciseId={catalogIdFor(ex)} onHide={() => appActions.setView({ showTips: false })} /> : null}
        />
      )}
      {sheetOpen && (
        <TechniqueSheet
          key={catalogId}
          exerciseId={catalogId}
          firstTime={firstTime}
          onClose={() => setTechniqueOpen(false)}
          primaryAction={{ label: phase === 'active' ? 'Seguir con la serie' : 'Entendido, empezar' }}
        />
      )}

      {phase === 'summary' && summary && (
        <SetSummaryView
          ex={ex}
          setNumber={setNumber}
          summary={summary.summary}
          heldSeconds={summary.heldSeconds}
          onNextSet={nextSet}
          onFinish={() => navigate('/', { replace: true })}
        />
      )}

      {RECORD_MODE && status === 'ready' && (
        <button
          className="record-fixture-btn"
          onClick={() => {
            const frames = recordingRef.current;
            if (frames.length === 0) return;
            downloadFixture(exRef.current, frames, { script: RECORD_SCRIPT, engine: usesEngine3D(exRef.current) ? '3d' : '2d' });
            recordingRef.current = [];
            setRecordedCount(0);
          }}
        >
          Guardar grabación ({recordedCount} frames)
        </button>
      )}
    </div>
  );
}

