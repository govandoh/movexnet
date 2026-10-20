import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { NodeRing } from '../components/NodeRing';
import { IconPlay } from '../components/icons';
import { useAppState } from '../state/appStore';
import { useProgram, useProgramSessions } from '../state/useProgram';
import { nextSessions } from '../../domain/calendar';
import {
  DEFAULT_DAILY_GOAL_REPS, dayStats, lastSet, streakDays, weekActivity,
} from '../../domain/sessionHistory';
import { getExercise } from '../../domain/catalog';
import type { PlannedDay } from '../../domain/routineGenerator';

const WEEKDAYS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MONTHS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const SHORT_DAYS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];

/** Repeticiones que pide un día del programa (la plancha y lo que va por tiempo no suman). */
function dayGoalReps(day: PlannedDay): number {
  return day.exercises.reduce((s, e) => s + (e.reps ?? 0) * e.sets, 0);
}

/** Primer ejercicio con asistente del día: con él arranca "Empezar con asistente". */
function firstAssisted(day: PlannedDay): string | null {
  for (const e of day.exercises) {
    const assistant = getExercise(e.exerciseId)?.assistant;
    if (assistant) return assistant;
  }
  return null;
}

const stagger = (i: number) => ({ '--i': i }) as CSSProperties;

export function TodayScreen() {
  const now = new Date();
  const { history, questionnaire } = useAppState();
  const program = useProgram(now);
  // Las próximas sesiones sin contar hoy: la de hoy ya está en la tarjeta principal.
  const upcoming = nextSessions(useProgramSessions(now), now, 4).filter(s => s.status !== 'today' && s.status !== 'done').slice(0, 3);

  const stats = dayStats(history, now);
  const todayPlan = program?.nextIsToday ? program.next : null;
  const goal = todayPlan ? Math.max(dayGoalReps(todayPlan), 1) : DEFAULT_DAILY_GOAL_REPS;
  const progress = stats.reps / goal;
  const week = weekActivity(history, now);
  const plannedDays = questionnaire?.daysPerWeek ?? 3;
  const streak = streakDays(history, now);
  const last = lastSet(history);
  const weekday = WEEKDAYS[now.getDay()];
  const dateLabel = `${weekday[0].toUpperCase()}${weekday.slice(1)} ${now.getDate()} de ${MONTHS[now.getMonth()]}`;
  const todayIndex = (now.getDay() + 6) % 7;

  return (
    <div className="screen screen--dots stagger">
      <header className="screen-header" style={stagger(0)}>
        <div>
          <p className="muted today-date">{dateLabel}</p>
          <h1 className="screen-title">Hoy</h1>
        </div>
      </header>

      <section className="card card--framed today-rings" style={stagger(1)} aria-label="Progreso de hoy">
        <NodeRing value={progress} label={`Meta del día al ${Math.round(Math.min(progress, 1) * 100)} %`}>
          <span className="display-number today-rings__pct">
            {Math.round(Math.min(progress, 1) * 100)}<small>%</small>
          </span>
          <span className="muted today-rings__caption">meta del día</span>
        </NodeRing>
        <div className="today-rings__metrics">
          <div className="metric-row">
            <div className="metric-row__head"><span className="muted">Repeticiones</span><strong>{stats.reps}/{goal}</strong></div>
            <div className="bar"><span style={{ transform: `scaleX(${Math.min(progress, 1)})` }} /></div>
          </div>
          <div className="metric-row">
            <div className="metric-row__head"><span className="muted">Técnica</span><strong>{stats.techniquePct === null ? '—' : `${stats.techniquePct} %`}</strong></div>
            <div className="bar bar--indigo"><span style={{ transform: `scaleX(${(stats.techniquePct ?? 0) / 100})` }} /></div>
          </div>
          <div className="metric-row">
            <div className="metric-row__head"><span className="muted">Semana</span><strong>{week.filter(Boolean).length}/{plannedDays} días</strong></div>
            <div className="week-strip" aria-label="Días entrenados esta semana">
              {week.map((on, i) => (
                <span key={i} className={`week-strip__day${on ? ' on' : ''}${i === todayIndex ? ' today' : ''}`} title={SHORT_DAYS[i]} />
              ))}
            </div>
          </div>
        </div>
      </section>

      {program ? (
        <section className="card card--framed next-card" style={stagger(2)}>
          <svg className="next-card__figure" viewBox="0 0 120 120" aria-hidden="true">
            <path d="M60 20L60 62M60 30L36 50M60 30L84 50M60 62L42 100M60 62L78 100" />
            <circle cx="60" cy="14" r="6" className="head" />
            {[[36, 50], [84, 50], [60, 62], [42, 100], [78, 100]].map(([cx, cy]) => <circle key={`${cx}${cy}`} cx={cx} cy={cy} r="3.5" />)}
          </svg>
          <p className="eyebrow eyebrow--indigo">
            {program.nextIsToday ? 'Hoy' : 'Siguiente'} · Semana {Math.min(program.week, program.unlockedWeeks - 1) + 1}
          </p>
          {program.weekLocked && (
            <p className="notice notice--indigo">Tu semana libre terminó: repite la semana 1 o activa Premium para seguir progresando.</p>
          )}
          {program.next && (
            <>
              <div>
                <h2 className="card-title">{program.next.label}</h2>
                <p className="muted">
                  {program.next.exercises.length} ejercicios · {questionnaire?.sessionMinutes} min · {program.next.exercises.filter(e => e.withAssistant).length} con asistente
                </p>
              </div>
              <Link className="btn btn--primary btn--block" to={`/entrenar?ex=${firstAssisted(program.next) ?? 'squat'}`}>
                <IconPlay />Empezar con asistente
              </Link>
            </>
          )}
        </section>
      ) : (
        <section className="card card--framed next-card" style={stagger(2)}>
          <p className="eyebrow eyebrow--indigo">Tu programa</p>
          <div>
            <h2 className="card-title">Arma tu plan en 4 preguntas</h2>
            <p className="muted">Objetivo, nivel, dónde entrenas y cuántos días. La semana 1 es libre.</p>
          </div>
          <Link className="btn btn--primary btn--block" to="/cuestionario">Empezar</Link>
          <Link className="btn btn--secondary btn--block" to="/entrenar">Entrenar libre con asistente</Link>
        </section>
      )}

      {program && upcoming.length > 0 && (
        <section className="card card--framed" style={stagger(3)} aria-label="Próximas sesiones">
          <div className="day-card__head">
            <h2 className="card-title">Próximas sesiones</h2>
            <Link className="muted calendar-link" to="/rutinas">Ver calendario</Link>
          </div>
          <div className="list">
            {upcoming.map(s => {
              const [y, m, d] = s.date.split('-').map(Number);
              const date = new Date(y, m - 1, d);
              return (
                <div key={`${s.date}-${s.dayIndex}`} className="list-row">
                  <span className="list-row__main">
                    <span className="list-row__title">{program.routine.days[s.dayIndex]?.label ?? 'Sesión'}</span>
                    <span className="list-row__meta">
                      {WEEKDAYS[date.getDay()][0].toUpperCase() + WEEKDAYS[date.getDay()].slice(1)} {d} de {MONTHS[m - 1]} · Semana {s.week + 1}
                    </span>
                  </span>
                  {s.locked && <span className="pill pill--neutral">Premium</span>}
                </div>
              );
            })}
          </div>
        </section>
      )}

      <div className="grid-2" style={stagger(4)}>
        <div className="card">
          <span className="muted">Racha</span>
          <span className="display-number stat-number">{streak}<small> {streak === 1 ? 'día' : 'días'}</small></span>
        </div>
        <div className="card">
          <span className="muted">Fatiga, última serie</span>
          <span className={`display-number stat-number${last?.fatigue === 'baja' ? ' is-volt' : last?.fatigue === 'alta' ? ' is-amber' : ''}`}>
            {last?.fatigue ? last.fatigue[0].toUpperCase() + last.fatigue.slice(1) : '—'}
          </span>
        </div>
      </div>
    </div>
  );
}
