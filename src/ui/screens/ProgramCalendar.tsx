import { useMemo, useState } from 'react';
import { IconBack, IconCheck, IconLock } from '../components/icons';
import { dayKey } from '../../domain/sessionHistory';
import type { SessionStatus, SessionWithStatus } from '../../domain/calendar';
import './calendar.css';

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const WEEKDAYS_SHORT = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const WEEKDAYS_LONG = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

/** El estado nunca se comunica solo con color (DESIGN.md §2): cada uno tiene su texto. */
const STATUS_LABEL: Record<SessionStatus, string> = {
  done: 'Hecha',
  missed: 'Perdida',
  today: 'Hoy',
  upcoming: 'Próxima',
  locked: 'Premium',
};

/** El primer estado manda si un día tiene dos sesiones. */
const STATUS_ORDER: SessionStatus[] = ['today', 'missed', 'upcoming', 'done', 'locked'];

function monthGrid(year: number, month: number): (Date | null)[] {
  const first = new Date(year, month, 1);
  const lead = (first.getDay() + 6) % 7; // semana empieza en lunes
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = Array.from({ length: lead }, () => null);
  for (let d = 1; d <= days; d++) cells.push(new Date(year, month, d));
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function longDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return `${WEEKDAYS_LONG[date.getDay()]} ${d} de ${MONTHS[m - 1].toLowerCase()}`;
}

/**
 * Calendario del programa (#35): las sesiones de cada mes con su estado, cruzadas con el
 * historial (`calendar.ts`). Tocar un día muestra qué toca y lleva a esa semana del programa.
 */
export function ProgramCalendar({ sessions, dayLabels, now, onPickWeek }: {
  sessions: SessionWithStatus[];
  /** Nombre de cada día del programa por `dayIndex` (p. ej. "Torso"). */
  dayLabels: string[];
  now: Date;
  onPickWeek: (week: number) => void;
}) {
  const today = dayKey(now);
  const [cursor, setCursor] = useState({ year: now.getFullYear(), month: now.getMonth() });
  const [selected, setSelected] = useState(today);

  const byDate = useMemo(() => {
    const map = new Map<string, SessionWithStatus[]>();
    for (const s of sessions) map.set(s.date, [...(map.get(s.date) ?? []), s]);
    return map;
  }, [sessions]);

  const first = sessions[0]?.date;
  const last = sessions[sessions.length - 1]?.date;
  const monthKey = (y: number, m: number) => `${y}-${String(m + 1).padStart(2, '0')}`;
  const canPrev = first !== undefined && monthKey(cursor.year, cursor.month) > first.slice(0, 7);
  const canNext = last !== undefined && monthKey(cursor.year, cursor.month) < last.slice(0, 7);

  function shift(delta: number) {
    const d = new Date(cursor.year, cursor.month + delta, 1);
    setCursor({ year: d.getFullYear(), month: d.getMonth() });
  }

  const daySessions = byDate.get(selected) ?? [];
  const done = sessions.filter(s => s.status === 'done').length;
  const due = sessions.filter(s => s.status === 'done' || s.status === 'missed').length;

  return (
    <section className="card card--framed calendar" aria-label="Calendario del programa">
      <div className="calendar__head">
        <button type="button" className="icon-btn" onClick={() => shift(-1)} disabled={!canPrev} aria-label="Mes anterior">
          <IconBack />
        </button>
        <h2 className="card-title" aria-live="polite">{MONTHS[cursor.month]} {cursor.year}</h2>
        <button type="button" className="icon-btn calendar__next" onClick={() => shift(1)} disabled={!canNext} aria-label="Mes siguiente">
          <IconBack />
        </button>
      </div>
      {due > 0 && <p className="muted calendar__summary">{done} de {due} sesiones hechas hasta hoy</p>}

      <div className="calendar__grid" role="grid" aria-label={`${MONTHS[cursor.month]} ${cursor.year}`}>
        {WEEKDAYS_SHORT.map((d, i) => <span key={i} className="calendar__weekday" aria-hidden="true">{d}</span>)}
        {monthGrid(cursor.year, cursor.month).map((date, i) => {
          if (!date) return <span key={i} className="calendar__cell calendar__cell--empty" />;
          const key = dayKey(date);
          const list = byDate.get(key);
          const status = list ? STATUS_ORDER.find(st => list.some(s => s.status === st)) : undefined;
          const label = `${longDate(key)}${status ? `, sesión ${STATUS_LABEL[status].toLowerCase()}` : ''}`;
          return (
            <button key={key} type="button" role="gridcell"
              className={`calendar__cell${status ? ` is-${status}` : ''}${key === today ? ' is-current' : ''}`}
              aria-selected={key === selected} aria-label={label} onClick={() => setSelected(key)}>
              <span className="calendar__num">{date.getDate()}</span>
              {status === 'done' && <span className="calendar__mark"><IconCheck /></span>}
              {status === 'locked' && <span className="calendar__mark"><IconLock /></span>}
              {status && status !== 'done' && status !== 'locked' && <span className="calendar__dot" />}
            </button>
          );
        })}
      </div>

      <ul className="calendar__legend" aria-label="Leyenda">
        {(['done', 'today', 'upcoming', 'missed', 'locked'] as SessionStatus[]).map(st => (
          <li key={st}><span className={`calendar__swatch is-${st}`} />{STATUS_LABEL[st]}</li>
        ))}
      </ul>

      <div className="calendar__detail" aria-live="polite">
        <p className="eyebrow">{longDate(selected)}</p>
        {daySessions.length === 0 ? (
          <p className="muted">Día de descanso.</p>
        ) : daySessions.map(s => (
          <div key={`${s.date}-${s.dayIndex}`} className="list-row">
            <span className="list-row__main">
              <span className="list-row__title">{dayLabels[s.dayIndex] ?? 'Sesión'}</span>
              <span className="list-row__meta">Semana {s.week + 1} · {STATUS_LABEL[s.status]}</span>
            </span>
            <button type="button" className="btn btn--secondary calendar__go" onClick={() => onPickWeek(s.week)}>
              Ver semana
            </button>
          </div>
        ))}
      </div>
    </section>
  );
}
