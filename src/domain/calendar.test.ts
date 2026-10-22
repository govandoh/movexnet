import { describe, expect, it } from 'vitest'
import {
  nextSessions, programWeek, pushReminderItems, reminderTimes, scheduleProgram, sessionsBetween, withStatus,
  PUSH_MAX_REMINDERS,
} from './calendar.ts'
import { PROGRAM_WEEKS } from './routineGenerator.ts'
import type { SetRecord } from './sessionHistory.ts'

/** Lunes, miércoles y viernes: el programa de 3 días. */
const MWF = [{ weekday: 1 }, { weekday: 3 }, { weekday: 5 }]
/** Miércoles 7 de octubre de 2026. */
const WED = new Date(2026, 9, 7, 15, 30)

function rec(date: Date, id = 'r'): SetRecord {
  return {
    id, completedAt: date.toISOString(), exerciseId: 'sentadilla',
    validReps: 10, rejectedReps: 0, goodReps: 10, timed: false, fatigue: null,
  }
}

describe('scheduleProgram', () => {
  it('genera días × semanas sesiones, ordenadas, y cada fecha cae en su día de la semana', () => {
    const s = scheduleProgram(MWF, new Date(2026, 9, 5))
    expect(s).toHaveLength(3 * PROGRAM_WEEKS)
    expect(s.map(x => x.date)).toEqual([...s.map(x => x.date)].sort())
    for (const x of s) {
      const [y, m, d] = x.date.split('-').map(Number)
      expect(new Date(y, m - 1, d).getDay()).toBe(x.weekday)
    }
  })

  it('si el programa empieza a mitad de semana, la semana 1 dura 7 días desde el inicio', () => {
    const s = scheduleProgram(MWF, WED)
    expect(s.slice(0, 4).map(x => [x.date, x.week, x.dayIndex])).toEqual([
      ['2026-10-07', 0, 1], ['2026-10-09', 0, 2], ['2026-10-12', 0, 0], ['2026-10-14', 1, 1],
    ])
  })

  it('si el día de inicio no está en el programa, la primera sesión es la siguiente', () => {
    expect(scheduleProgram(MWF, new Date(2026, 9, 6))[0].date).toBe('2026-10-07')
  })

  it('cruza el fin de mes y de año', () => {
    const s = scheduleProgram([{ weekday: 1 }], new Date(2026, 11, 28), { weeks: 2 })
    expect(s.map(x => x.date)).toEqual(['2026-12-28', '2027-01-04'])
  })

  it('suma días de calendario: las fechas son consecutivas aunque haya cambio de hora', () => {
    const everyDay = [0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday }))
    const s = scheduleProgram(everyDay, new Date(2026, 2, 2), { weeks: 8 })
    expect(s).toHaveLength(56)
    expect(new Set(s.map(x => x.date)).size).toBe(56)
    s.forEach((x, i) => expect(x.date).toBe(
      new Date(2026, 2, 2 + i).toLocaleDateString('en-CA'),
    ))
  })

  it('con el plan libre solo la semana 1 está accesible', () => {
    const s = scheduleProgram(MWF, WED, { unlockedWeeks: 1 })
    expect(s.filter(x => !x.locked)).toHaveLength(3)
    expect(s.filter(x => !x.locked).every(x => x.week === 0)).toBe(true)
    expect(s.filter(x => x.locked)).toHaveLength(3 * PROGRAM_WEEKS - 3)
  })

  it('valores numéricos descontrolados no cuelgan ni abren el paywall', () => {
    expect(scheduleProgram(MWF, WED, { weeks: Infinity })).toHaveLength(3 * 52)
    expect(scheduleProgram(MWF, WED, { weeks: NaN })).toEqual([])
    expect(scheduleProgram(MWF, WED, { weeks: 1, unlockedWeeks: NaN }).every(x => x.locked)).toBe(true)
    expect(scheduleProgram(MWF, WED, { weeks: 1, unlockedWeeks: Infinity }).some(x => x.locked)).toBe(false)
  })

  it('entradas vacías o inválidas dan una lista vacía y no lanzan', () => {
    expect(scheduleProgram([], WED)).toEqual([])
    expect(scheduleProgram(MWF, new Date('no-es-fecha'))).toEqual([])
    expect(scheduleProgram(MWF, WED, { weeks: 0 })).toEqual([])
    expect(scheduleProgram([{ weekday: 9 }], WED)).toEqual([])
  })

  it('dos días el mismo día de la semana dan dos sesiones ordenadas por posición', () => {
    const s = scheduleProgram([{ weekday: 3 }, { weekday: 3 }], WED, { weeks: 1 })
    expect(s.map(x => x.dayIndex)).toEqual([0, 1])
  })
})

describe('programWeek', () => {
  it('coincide con la semana de cada sesión de scheduleProgram, a cualquier hora del día', () => {
    for (const s of scheduleProgram(MWF, WED)) {
      const [y, m, d] = s.date.split('-').map(Number)
      expect(programWeek(WED, new Date(y, m - 1, d, 0, 5))).toBe(s.week)
      expect(programWeek(WED, new Date(y, m - 1, d, 23, 55))).toBe(s.week)
    }
  })

  it('la mañana del día 8 ya es la semana 2 aunque no hayan pasado 7 días de 24 horas', () => {
    expect(programWeek(WED, new Date(2026, 9, 13, 23, 0))).toBe(0)
    expect(programWeek(WED, new Date(2026, 9, 14, 8, 0))).toBe(1)
  })

  it('antes del inicio o con fechas inválidas devuelve 0, y no se acota por el fin del programa', () => {
    expect(programWeek(WED, new Date(2026, 9, 1))).toBe(0)
    expect(programWeek(WED, new Date('x'))).toBe(0)
    expect(programWeek(new Date('x'), WED)).toBe(0)
    expect(programWeek(WED, new Date(2027, 9, 7))).toBeGreaterThan(PROGRAM_WEEKS)
  })

  it('no se desfasa con el cambio de hora', () => {
    const start = new Date(2026, 2, 1)
    for (let i = 0; i < 70; i++) expect(programWeek(start, new Date(2026, 2, 1 + i, 12))).toBe(Math.floor(i / 7))
  })
})

describe('consultas', () => {
  const all = scheduleProgram(MWF, WED)

  it('sessionsBetween incluye ambos extremos', () => {
    const r = sessionsBetween(all, new Date(2026, 9, 9, 23), new Date(2026, 9, 14, 1))
    expect(r.map(x => x.date)).toEqual(['2026-10-09', '2026-10-12', '2026-10-14'])
  })

  it('nextSessions empieza hoy, respeta el límite y no falla con límites raros', () => {
    expect(nextSessions(all, new Date(2026, 9, 9, 20), 2).map(x => x.date)).toEqual(['2026-10-09', '2026-10-12'])
    expect(nextSessions(all, new Date(2026, 9, 10), 1).map(x => x.date)).toEqual(['2026-10-12'])
    expect(nextSessions(all, new Date(2030, 0, 1), 3)).toEqual([])
    expect(nextSessions(all, WED, -1)).toEqual([])
  })
})

describe('withStatus', () => {
  const now = new Date(2026, 9, 12, 10, 0)

  it('cruza lo planificado con el historial: hecha, perdida, hoy y próxima', () => {
    const s = withStatus(scheduleProgram(MWF, WED, { weeks: 2 }), [rec(new Date(2026, 9, 7, 18))], now)
    expect(s.slice(0, 4).map(x => x.status)).toEqual(['done', 'missed', 'today', 'upcoming'])
  })

  it('una serie hoy marca la sesión de hoy como hecha', () => {
    const s = withStatus(scheduleProgram(MWF, WED, { weeks: 1 }), [rec(new Date(2026, 9, 12, 9))], now)
    expect(s.find(x => x.date === '2026-10-12')?.status).toBe('done')
  })

  it('las sesiones bloqueadas son locked, no perdidas', () => {
    const s = withStatus(scheduleProgram(MWF, WED, { unlockedWeeks: 0 }), [], new Date(2027, 0, 1))
    expect(s.every(x => x.status === 'locked')).toBe(true)
  })

  it('no muta las sesiones recibidas', () => {
    const base = scheduleProgram(MWF, WED, { weeks: 1 })
    withStatus(base, [], now)
    expect(base.every(x => !('status' in x))).toBe(true)
  })
})

describe('reminderTimes', () => {
  const sessions = scheduleProgram(MWF, WED, { weeks: 2 })
  const at8 = { hour: 8, minute: 0 }

  it('avisa a la hora local del día de cada sesión pendiente y omite lo pasado', () => {
    const r = reminderTimes(sessions, [], new Date(2026, 9, 12, 10, 0), at8)
    expect(r[0].at).toBe(new Date(2026, 9, 14, 8, 0).getTime())
    expect(r.every(x => x.at > new Date(2026, 9, 12, 10, 0).getTime())).toBe(true)
  })

  it('si aún no es la hora de hoy, el aviso de hoy sigue pendiente', () => {
    const r = reminderTimes(sessions, [], new Date(2026, 9, 12, 7, 0), at8)
    expect(r[0].session.date).toBe('2026-10-12')
  })

  it('no avisa de un día que ya se entrenó', () => {
    const r = reminderTimes(sessions, [rec(new Date(2026, 9, 12, 6))], new Date(2026, 9, 12, 7, 0), at8)
    expect(r[0].session.date).toBe('2026-10-14')
  })

  it('no avisa de sesiones bloqueadas', () => {
    const locked = scheduleProgram(MWF, WED, { weeks: 2, unlockedWeeks: 1 })
    const r = reminderTimes(locked, [], new Date(2026, 9, 13), at8)
    expect(r).toEqual([])
  })

  it('acota la hora a valores válidos', () => {
    const r = reminderTimes(sessions, [], new Date(2026, 9, 6), { hour: 40, minute: -5 })
    expect(r[0].at).toBe(new Date(2026, 9, 7, 23, 0).getTime())
  })
})

describe('pushReminderItems', () => {
  const sessions = scheduleProgram(MWF, WED, { weeks: 8 })
  const at18 = { hour: 18, minute: 0 }
  const label = (s: { dayIndex: number }) => ['Pierna', 'Torso', 'Cuerpo completo'][s.dayIndex]

  it('sube solo los avisos de los próximos 14 días, con hora absoluta', () => {
    const now = new Date(2026, 9, 12, 10, 0)
    const items = pushReminderItems(reminderTimes(sessions, [], now, at18), now, label)
    // Del lunes 12 a las 10:00 al lunes 26 a las 10:00: el aviso del 26 a las 18:00 queda fuera.
    expect(items.map(i => new Date(i.sendAt).getDate())).toEqual([12, 14, 16, 19, 21, 23])
    expect(items[0].sendAt).toBe(new Date(2026, 9, 12, 18, 0).toISOString())
  })

  it('el texto es solo el día del programa y abre su semana', () => {
    const now = new Date(2026, 9, 12, 10, 0)
    const [first] = pushReminderItems(reminderTimes(sessions, [], now, at18), now, label)
    expect(first).toEqual({
      sendAt: new Date(2026, 9, 12, 18, 0).toISOString(),
      title: 'Hoy toca entrenar',
      // El programa empezó el miércoles 7: el lunes 12 aún es la semana 1.
      body: 'Semana 1 · Pierna',
      url: '/#/rutinas?semana=1',
    })
  })

  it('sin nombre del día, dice solo la semana', () => {
    const now = new Date(2026, 9, 12, 10, 0)
    const [first] = pushReminderItems(reminderTimes(sessions, [], now, at18), now, () => undefined)
    expect(first.body).toBe('Semana 1 de tu programa')
  })

  it('al entrenar un día, su aviso deja de subirse', () => {
    const now = new Date(2026, 9, 12, 10, 0)
    const items = pushReminderItems(reminderTimes(sessions, [rec(new Date(2026, 9, 12, 7))], now, at18), now, label)
    expect(items[0].sendAt).toBe(new Date(2026, 9, 14, 18, 0).toISOString())
  })

  it('respeta el tope de avisos por suscripción', () => {
    const daily = scheduleProgram([0, 1, 2, 3, 4, 5, 6].map(weekday => ({ weekday })), WED, { weeks: 8 })
    const many = [...daily, ...daily, ...daily].sort((a, b) => a.date.localeCompare(b.date))
    const now = new Date(2026, 9, 8, 6, 0)
    expect(pushReminderItems(reminderTimes(many, [], now, at18), now, label)).toHaveLength(PUSH_MAX_REMINDERS)
  })
})
