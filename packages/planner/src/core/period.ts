import type { BoardHorizon, MonthDay, Period } from './types'

/** 日付（端末の時刻で YYYY-MM-DD） */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 週（月曜はじまり）。その週の月曜の日付で表す（例: 2026-11-16） */
export function weekKey(d: Date): string {
  return dayKey(weekStart(d))
}

export function weekStart(d: Date): Date {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const shift = (s.getDay() + 6) % 7 // 月曜 0 … 日曜 6
  s.setDate(s.getDate() - shift)
  return s
}

export function monthKey(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`
}

export function yearKey(d: Date): string {
  return String(d.getFullYear())
}

export function periodKey(period: Period, d: Date): string {
  switch (period) {
    case 'day':
      return dayKey(d)
    case 'week':
      return weekKey(d)
    case 'month':
      return monthKey(d)
    case 'year':
      return yearKey(d)
  }
}

/** 列ごとの「今の期間」の数え方（一生の列は年で区切る：終えたものは年が変わるまで見せる） */
export const HORIZON_PERIOD: Record<BoardHorizon, Period> = {
  today: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
  life: 'year',
}

/** その列に並ぶ習慣のくり返し（一生の列には習慣を置かない） */
export const HORIZON_HABIT_PERIOD: Partial<Record<BoardHorizon, Period>> = {
  today: 'day',
  week: 'week',
  month: 'month',
  year: 'year',
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  r.setDate(r.getDate() + n)
  return r
}

/** その日時が、今と同じ期間に入っているか */
export function inSamePeriod(period: Period, iso: string | undefined, now: Date): boolean {
  if (!iso) return false
  const at = new Date(iso)
  if (Number.isNaN(at.getTime())) return false
  return periodKey(period, at) === periodKey(period, now)
}

const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']

/** 列の見出しの下に出す、今の期間（例: 11/17（火）、11/16〜11/22、11 月、2026 年） */
export function periodLabel(h: BoardHorizon, now: Date): string {
  switch (h) {
    case 'today':
      return `${now.getMonth() + 1}/${now.getDate()}（${WEEKDAYS[now.getDay()]}）`
    case 'week': {
      const s = weekStart(now)
      const e = addDays(s, 6)
      return `${s.getMonth() + 1}/${s.getDate()}〜${e.getMonth() + 1}/${e.getDate()}`
    }
    case 'month':
      return `${now.getMonth() + 1} 月〜`
    case 'year':
      return `${now.getFullYear()} 年`
    case 'life':
      return 'いつか・ずっと'
  }
}

/** 期日（YYYY-MM-DD）を短く（例: 1/18）。今年でなければ年の下 2 けたも（例: 27/1/24） */
export function dueLabel(due: string, now: Date): string {
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return due
  return y === now.getFullYear() ? `${m}/${d}` : `${String(y).slice(-2)}/${m}/${d}`
}

/** 期日まであと何日か（過ぎていれば負） */
export function daysUntil(due: string, now: Date): number | null {
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return null
  const target = new Date(y, m - 1, d)
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  return Math.round((target.getTime() - today.getTime()) / 86_400_000)
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 習慣のくり返しに対応する列（毎日 → 今日、毎週 → 今週、毎月 → 数か月、毎年 → 今年） */
export function periodHorizon(period: Period): BoardHorizon {
  return period === 'day' ? 'today' : period === 'week' ? 'week' : period === 'month' ? 'month' : 'year'
}

/** 毎月の「その日」の短い印（20日・月末・第2水・最終金） */
export function dayLabel(day: MonthDay): string {
  if (day === 'end') return '月末'
  if (typeof day === 'number') return `${day}日`
  const nth = parseNthWeekday(day)
  if (!nth) return String(day)
  return `${nth.week === 'L' ? '最終' : `第${nth.week}`}${WEEKDAYS[nth.weekday]}`
}

/** 'w2-3'（第 2 水曜）・'wL-5'（最終金曜）を読む。形が違えば null */
export function parseNthWeekday(day: unknown): { week: number | 'L'; weekday: number } | null {
  const m = typeof day === 'string' ? /^w([1-5L])-([0-6])$/.exec(day) : null
  if (!m) return null
  return { week: m[1] === 'L' ? 'L' : Number(m[1]), weekday: Number(m[2]) }
}

/**
 * その月の「その日」。日にちが無い月（31 日など）は月末に寄せる。
 * 第 5 の曜日が無い月は、最終の曜日に寄せる
 */
export function monthDayDate(day: MonthDay, month: Date): Date | undefined {
  const y = month.getFullYear()
  const mo = month.getMonth()
  const last = new Date(y, mo + 1, 0).getDate()
  if (day === 'end') return new Date(y, mo, last)
  if (typeof day === 'number') return day >= 1 ? new Date(y, mo, Math.min(day, last)) : undefined
  const nth = parseNthWeekday(day)
  if (!nth) return undefined
  const first = (nth.weekday - new Date(y, mo, 1).getDay() + 7) % 7 + 1 // その曜日の最初の日
  const lastOne = first + Math.floor((last - first) / 7) * 7 // その曜日の最後の日
  const d = nth.week === 'L' ? lastOne : Math.min(first + (nth.week - 1) * 7, lastOne)
  return new Date(y, mo, d)
}

/** 日付（YYYY-MM-DD）を曜日つきで短く（例: 11/24（火）。今年でなければ 27/1/24（日）） */
export function dueLabelWeekday(due: string, now: Date): string {
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return due
  const w = WEEKDAYS[new Date(y, m - 1, d).getDay()]
  return `${dueLabel(due, now)}（${w}）`
}

/**
 * 期日目標の日付を短く（例: 12/8）。1 年近く先（330 日より先）や過ぎた年のものだけ年を付ける（例: 27/1/24 は 2027 年でも 1/24 に）
 */
export function shortDueLabel(due: string, now: Date): string {
  const [y, m, d] = due.split('-').map(Number)
  if (!y || !m || !d) return due
  const days = daysUntil(due, now) ?? 0
  return days > 330 || days < -330 ? `${String(y).slice(-2)}/${m}/${d}` : `${m}/${d}`
}
