import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAppState } from '../state/appStore';
import { useProgram, useProgramSessions } from '../state/useProgram';
import { ProgramCalendar } from './ProgramCalendar';
import { PremiumSheet } from '../components/PremiumSheet';
import { TechniqueSheet } from '../technique/TechniqueSheet';
import { IconAssist, IconLock } from '../components/icons';
import { MyRoutines } from '../routines/MyRoutines';
import { weekPlan, type PlannedExercise, type ProgramType } from '../../domain/routineGenerator';

const GOAL_LABEL = { muscle_gain: 'Ganar músculo', weight_loss: 'Perder peso', strength_gain: 'Ganar fuerza' } as const;
const LEVEL_LABEL = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' } as const;
const LOCATION_LABEL = { gym_full: 'Gimnasio', home_none: 'Casa sin equipo', home_limited: 'Casa con equipo' } as const;
const PROGRAM_LABEL: Record<ProgramType, string> = { full_body: 'Cuerpo completo', upper_lower: 'Torso / pierna', ppl: 'Empuje / tracción / pierna' };
const METHOD_LABEL = { normal: null, rest_pause: 'Rest-pause', dropset: 'Dropset', superset: 'Superserie' } as const;
const WEEKDAY = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

function dose(e: PlannedExercise): string {
  return e.holdSeconds !== undefined ? `${e.sets} × ${e.holdSeconds} s` : `${e.sets} × ${e.reps}`;
}

export function ProgramScreen() {
  const now = new Date();
  const { questionnaire, entitlement } = useAppState();
  const program = useProgram(now);
  const sessions = useProgramSessions(now);
  const [selected, setSelected] = useState<number | null>(null);
  const [premiumOpen, setPremiumOpen] = useState(false);
  const [technique, setTechnique] = useState<string | null>(null);

  if (!questionnaire || !program) {
    return (
      <div className="screen">
        <h1 className="screen-title">Rutinas</h1>
        <section className="card card--framed">
          <h2 className="card-title">Todavía no tienes programa</h2>
          <p className="muted">Responde 4 preguntas y armamos tu rutina con los ejercicios que puedes hacer donde entrenas.</p>
          <Link className="btn btn--primary btn--block" to="/cuestionario">Armar mi programa</Link>
        </section>
        <MyRoutines />
      </div>
    );
  }

  const week = selected ?? Math.min(program.week, program.unlockedWeeks - 1);
  const days = weekPlan(program.routine, week);

  function pickWeek(w: number) {
    if (w >= program!.unlockedWeeks) setPremiumOpen(true);
    else setSelected(w);
  }

  return (
    <div className="screen">
      <header className="screen-header">
        <h1 className="screen-title">Tu programa</h1>
        {entitlement.premium && <span className="pill pill--volt">Premium de prueba</span>}
      </header>
      <div className="tag-row">
        <span className="pill pill--neutral">{GOAL_LABEL[questionnaire.goal]}</span>
        <span className="pill pill--neutral">{LEVEL_LABEL[questionnaire.level]}</span>
        <span className="pill pill--neutral">{LOCATION_LABEL[questionnaire.location]}</span>
        <span className="pill pill--neutral">{questionnaire.daysPerWeek} días</span>
        <span className="pill pill--neutral">{PROGRAM_LABEL[program.routine.programType]}</span>
      </div>

      {program.routine.adjustedFrom && (
        <p className="notice notice--indigo">
          Con tu equipo no hay ejercicios suficientes para {PROGRAM_LABEL[program.routine.adjustedFrom].toLowerCase()}, así que te proponemos cuerpo completo.
        </p>
      )}

      <ProgramCalendar sessions={sessions} dayLabels={program.routine.days.map(d => d.label)} now={now} onPickWeek={pickWeek} />

      <div className="chip-row week-tabs" role="tablist" aria-label="Semanas del programa">
        {Array.from({ length: program.routine.weeks }, (_, w) => {
          const locked = w >= program.unlockedWeeks;
          return (
            <button key={w} className="chip" role="tab" aria-selected={w === week}
              aria-label={`Semana ${w + 1}${locked ? ', Premium' : ''}`} onClick={() => pickWeek(w)}>
              {locked && <IconLock />}Semana {w + 1}
            </button>
          );
        })}
      </div>

      {days.map(day => (
        <section key={day.weekday} className="card card--framed">
          <div className="day-card__head">
            <h2 className="card-title">{day.label}</h2>
            <span className="muted">{WEEKDAY[day.weekday]} · {questionnaire.sessionMinutes} min</span>
          </div>
          <div className="list">
            {day.exercises.map(e => {
              const method = METHOD_LABEL[e.method];
              const row = (
                <>
                  <span className="list-row__main">
                    <span className="list-row__title">{e.name}</span>
                    <span className="list-row__meta">
                      Descanso {e.restSeconds} s{method ? ` · ${method}` : ''}{e.supersetGroup !== undefined ? ` ${e.supersetGroup}` : ''}
                    </span>
                  </span>
                  {e.withAssistant && <span className="badge-assist"><IconAssist />Asistente</span>}
                  <span className="list-row__value">{dose(e)}</span>
                </>
              );
              // Tocar un ejercicio abre su ficha de técnica; desde ahí se entrena con asistente.
              return (
                <button key={e.exerciseId} className="list-row exercise-row" onClick={() => setTechnique(e.exerciseId)}
                  aria-label={`${e.name}: ver técnica`}>{row}</button>
              );
            })}
          </div>
        </section>
      ))}

      <Link className="btn btn--secondary btn--block" to="/cuestionario">Cambiar mis respuestas</Link>
      <MyRoutines />
      {premiumOpen && <PremiumSheet onClose={() => setPremiumOpen(false)} />}
      {technique && <TechniqueSheet exerciseId={technique} onClose={() => setTechnique(null)} showTrainAction />}
    </div>
  );
}
