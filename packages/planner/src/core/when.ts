import { addDays, dayKey, inSamePeriod, monthDayDate, weekStart, dayLabel } from './period'
import type { BoardHorizon, Habit } from './types'

/**
 * 習慣の「その日」（毎週の曜日・毎月の日・毎年の日付や月）。
 * 決めておくと、その日が近づいたときに、短い期間の列（今日・今週・数か月）にも自動で出る。
 */

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 'MM-DD' / 'MM' を読む。形が違えば null */
export function parseYearDay(v: string | undefined): { month: number; day?: number } | null {
  const m = v ? /^(\d{1,2})(?:-(\d{1,2}))?$/.exec(v) : null
  if (!m) return null
  const month = Number(m[1])
  const day = m[2] ? Number(m[2]) : undefined
  if (month < 1 || month > 12 || (day !== undefined && (day < 1 || day > 31))) return null
  return { month, ...(day ? { day } : {}) }
}

/** その日を決めているか */
export function hasWhen(h: Habit): boolean {
  if (h.period === 'month') return !!h.day
  if (h.period === 'week') return h.weekday !== undefined && h.weekday >= 0 && h.weekday <= 6
  if (h.period === 'year') return !!parseYearDay(h.yearDay)
  return false
}

/** 短い印（毎月: 20日・第2水・月末／毎週: 水曜／毎年: 12/6・12月） */
export function whenLabel(h: Habit): string | undefined {
  if (!hasWhen(h)) return undefined
  if (h.period === 'month') return dayLabel(h.day!)
  if (h.period === 'week') return `${WEEKDAYS[h.weekday!]}曜`
  const y = parseYearDay(h.yearDay)!
  return y.day ? `${y.month}/${y.day}` : `${y.month}月`
}

/** 今の期間の「その日」（毎年の月だけのときは、その月の 1 日） */
export function whenDate(h: Habit, now: Date): Date | undefined {
  if (!hasWhen(h)) return undefined
  if (h.period === 'month') return monthDayDate(h.day!, now)
  if (h.period === 'week') return addDays(weekStart(now), (h.weekday! + 6) % 7)
  const y = parseYearDay(h.yearDay)!
  const last = new Date(now.getFullYear(), y.month, 0).getDate()
  return new Date(now.getFullYear(), y.month - 1, Math.min(y.day ?? 1, last))
}

/**
 * その列に、自動で出す「その日」（出さないなら undefined）。今の期間にもうチェックしていれば出さない
 * - 今日: 毎月の日・毎週の曜日・毎年の日付が、今日か、過ぎていてまだのとき
 * - 今週: 毎月の日・毎年の日付が、今週のとき
 * - 数か月: 毎年の日付・月が、今月のとき
 */
export function autoDue(h: Habit, column: BoardHorizon, now: Date): Date | undefined {
  if (!hasWhen(h) || h.period === 'day' || inSamePeriod(h.period, h.checkedAt, now)) return undefined
  const due = whenDate(h, now)
  if (!due) return undefined
  const yearMonthOnly = h.period === 'year' && !parseYearDay(h.yearDay)!.day
  if (column === 'today') return !yearMonthOnly && dayKey(due) <= dayKey(now) ? due : undefined
  if (column === 'week') {
    if (h.period === 'week' || yearMonthOnly) return undefined
    if (h.period === 'month') return dueInWeek(h, now)
    const start = weekStart(now)
    return dayKey(due) >= dayKey(start) && dayKey(due) <= dayKey(addDays(start, 6)) ? due : undefined
  }
  if (column === 'month') return h.period === 'year' && due.getMonth() === now.getMonth() ? due : undefined
  return undefined
}

/** 毎月の「その日」が今週（月〜日）なら、その日（週が月をまたぐときは、両方の月を見る） */
function dueInWeek(h: Habit, now: Date): Date | undefined {
  const start = weekStart(now)
  const end = addDays(start, 6)
  for (const m of [start, end]) {
    const due = monthDayDate(h.day!, m)
    if (due && dayKey(due) >= dayKey(start) && dayKey(due) <= dayKey(end)) return due
  }
  return undefined
}

/** その日を決める・外す（value は 曜日 0〜6 / 'MM-DD'・'MM'。undefined で外す。毎月は withDay を使う） */
export function withWhen(h: Habit, value: number | string | undefined): Habit {
  const { weekday: _w, yearDay: _y, ...rest } = h
  const t = new Date().toISOString()
  if (h.period === 'week') return { ...rest, ...(h.yearDay ? { yearDay: h.yearDay } : {}), ...(typeof value === 'number' ? { weekday: value } : {}), updatedAt: t }
  if (h.period === 'year')
    return { ...rest, ...(h.weekday !== undefined ? { weekday: h.weekday } : {}), ...(typeof value === 'string' && parseYearDay(value) ? { yearDay: value } : {}), updatedAt: t }
  return h
}

/** 毎年の「月だけ」か（その月のあいだ出すだけで、過ぎた日という考えは無い） */
export function isMonthOnly(h: Habit): boolean {
  return h.period === 'year' && !!parseYearDay(h.yearDay) && !parseYearDay(h.yearDay)!.day
}
