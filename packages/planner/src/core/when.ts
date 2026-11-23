import { addDays, dayKey, monthDayDate, periodKey, weekStart, dayLabel } from './period'
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

/** YYYY-MM-DD を、その日の Date に（端末の時刻） */
function dayDate(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}

/**
 * 習慣の、その日を含む期間（毎月ならその月）に、チェックがあるか（今のチェック checkedAt か、日ごとの記録）。
 * 「今」の期間ではなく、その日の期間で見る（週や月の変わり目に、前の期間の分を正しく扱うため）
 */
export function habitDoneInPeriod(h: Habit, day: Date): boolean {
  const key = periodKey(h.period, day)
  const at = h.checkedAt ? new Date(h.checkedAt) : undefined
  if (at && !Number.isNaN(at.getTime()) && periodKey(h.period, at) === key) return true
  return (h.history ?? []).some((d) => typeof d === 'string' && periodKey(h.period, dayDate(d)) === key)
}

/** 毎年の「その日」の、その年の日付（日が無い月は月末に寄せる。月だけのときは 1 日） */
function yearDate(h: Habit, year: number): Date | undefined {
  const y = parseYearDay(h.yearDay)
  if (!y) return undefined
  const last = new Date(year, y.month, 0).getDate()
  return new Date(year, y.month - 1, Math.min(y.day ?? 1, last))
}

/** その週（月〜日）の中の「その日」（毎月・毎年。週が月・年をまたぐときは、両方の月・年を見る） */
function datesInWeek(h: Habit, now: Date): Date[] {
  const start = weekStart(now)
  const end = addDays(start, 6)
  const found = new Map<string, Date>()
  for (const m of [start, end]) {
    const due = h.period === 'month' ? monthDayDate(h.day!, m) : yearDate(h, m.getFullYear())
    if (due && dayKey(due) >= dayKey(start) && dayKey(due) <= dayKey(end)) found.set(dayKey(due), due)
  }
  return [...found.values()].sort((a, b) => a.getTime() - b.getTime())
}

/**
 * その列に、自動で出す「その日」（出さないなら undefined）。その日の期間に、もうチェックしていれば出さない
 * - 今日: 毎月の日・毎週の曜日・毎年の日付が、今日か、過ぎていてまだのとき（今の期間の分）
 * - 今週: 毎月の日・毎年の日付が、今週のとき（週が月・年をまたぐときは、両方の分）
 * - 数か月: 毎年の日付・月が、今月のとき
 */
export function autoDue(h: Habit, column: BoardHorizon, now: Date): Date | undefined {
  if (!hasWhen(h) || h.period === 'day') return undefined
  const yearMonthOnly = isMonthOnly(h)
  if (column === 'today') {
    if (yearMonthOnly) return undefined
    const due = whenDate(h, now)
    return due && dayKey(due) <= dayKey(now) && !habitDoneInPeriod(h, due) ? due : undefined
  }
  if (column === 'week') {
    if (h.period === 'week' || yearMonthOnly) return undefined
    return datesInWeek(h, now).find((d) => !habitDoneInPeriod(h, d))
  }
  if (column === 'month') {
    if (h.period !== 'year') return undefined
    const due = whenDate(h, now)
    return due && due.getMonth() === now.getMonth() && !habitDoneInPeriod(h, due) ? due : undefined
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
