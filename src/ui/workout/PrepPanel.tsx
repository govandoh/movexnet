import type { RefObject } from 'react';
import type { AssistantId } from '../../domain/catalog';
import { IconCheck } from '../components/icons';
import type { PrepState } from './prep';

interface PrepPanelProps {
  ex: AssistantId;
  exercises: readonly AssistantId[];
  names: Record<AssistantId, string>;
  onSelect: (ex: AssistantId) => void;
  prep: PrepState;
  tilt: number | null;
  bubbleRef: RefObject<HTMLDivElement | null>;
  onStart: () => void;
  onTechnique: () => void;
  /** La voz está activa pero el navegador aún no la deja sonar: falta un primer toque. */
  voiceLocked?: boolean;
}

function Check({ state }: { state: 'ok' | 'pending' | 'progress' }) {
  return (
    <span className={`prep-check prep-check--${state}`} aria-hidden="true">
      {state === 'ok' && <IconCheck />}
    </span>
  );
}

/**
 * Preparación de la serie (DESIGN.md §5): nivelador de burbuja y lista de tres puntos.
 * La burbuja la mueve el bucle de cuadros sobre `bubbleRef`; aquí solo se pinta el estado,
 * que cambia pocas veces. La serie arranca sola cuando los tres puntos siguen listos.
 */
export function PrepPanel({ ex, exercises, names, onSelect, prep, tilt, bubbleRef, onStart, onTechnique, voiceLocked = false }: PrepPanelProps) {
  const levelled = prep.levelOk !== false;
  const levelText = prep.levelOk === null
    ? 'Sin sensor de movimiento: apoya el celular derecho'
    : prep.levelOk ? 'Celular nivelado con el sensor' : 'Endereza el celular';

  return (
    <div className="prep">
      <div className="prep__frame" aria-hidden="true" />

      <div className="prep__level" data-ok={levelled}>
        <div className="level">
          <span className="level__target" />
          <div ref={bubbleRef} className="level__bubble" />
        </div>
        <span className="display-number level__deg">{tilt === null ? '—' : `${tilt}°`}</span>
        <span className="level__text">{levelText}</span>
      </div>

      <section className="prep__card" aria-label="Antes de empezar" data-minimap-floor>
        <div className="chip-row prep__chips" role="radiogroup" aria-label="Ejercicio">
          {exercises.map(id => (
            <button key={id} className="chip" role="radio" aria-checked={id === ex} onClick={() => onSelect(id)}>{names[id]}</button>
          ))}
        </div>
        <div className="prep__head">
          <h2 className="card-title">Antes de empezar</h2>
          <button className="btn btn--ghost prep__technique" onClick={onTechnique}>Ver técnica</button>
        </div>
        <ul className="prep__list" aria-live="polite">
          <li><Check state={levelled ? 'ok' : 'pending'} />Celular apoyado y nivelado</li>
          <li><Check state={prep.bodyOk ? 'ok' : 'pending'} />{ex === 'curl' || ex === 'press' ? 'Torso y brazos dentro del cuadro' : 'Cuerpo completo dentro del cuadro'}</li>
          {prep.calibration !== null && (
            <li className="prep__calibration">
              <Check state={prep.calibration >= 1 ? 'ok' : 'progress'} />
              <span>{prep.calibration >= 1 ? 'Postura calibrada' : 'Párate derecho: calibrando tu postura'}</span>
              <span className="bar bar--indigo"><span style={{ transform: `scaleX(${prep.calibration})` }} /></span>
            </li>
          )}
        </ul>
        <button className="btn btn--primary btn--block" onClick={onStart}>Empezar serie</button>
        <p className="muted prep__hint">La serie arranca sola cuando los puntos están listos</p>
        {voiceLocked && <p className="muted prep__hint" role="status">Toca la pantalla una vez para activar la voz</p>}
      </section>
    </div>
  );
}
