import { addDays, dayKey, periodKey } from './period'
import { effectiveHorizon, HABIT_HISTORY_LIMIT } from './logic'
import type { Habit, Horizon, PlannerData, Project, Task } from './types'

/**
 * 振り返り（日ごとに、やったこと・できた習慣を見る）の計算。
 * やったことは、終えた日時（doneAt）で日を決める。習慣は、チェックした日の記録（history）で決める。
 */

/** 習慣をチェックした日の一覧（記録が始まる前の版でチェックしたものも含める） */
export function habitDays(habit: Habit): Set<string> {
  const days = new Set(habit.history ?? [])
  if (habit.checkedAt) days.add(dayKey(new Date(habit.checkedAt)))
  return days
}

/** その日に、その習慣が済んでいたか（毎週・毎月などは、その日を含む期間にチェックがあれば済み） */
export function habitDoneOn(habit: Habit, day: Date): boolean {
  const days = habitDays(habit)
  if (habit.period === 'day') return days.has(dayKey(day))
  const key = periodKey(habit.period, day)
  for (const d of days) {
    const [y, m, dd] = d.split('-').map(Number)
    if (periodKey(habit.period, new Date(y, m - 1, dd)) === key) return true
  }
  return false
}

/** 日時（ISO）を日付（YYYY-MM-DD）に。読めなければ undefined */
function isoDay(at: string | undefined): string | undefined {
  if (!at) return undefined
  const d = new Date(at)
  return Number.isNaN(d.getTime()) ? undefined : dayKey(d)
}

/** 習慣を始めた日（記録が上限まであって古い分が消えているときは、残っている一番古い日から） */
function startDay(habit: Habit, days: Set<string>): string {
  const created = isoDay(habit.createdAt) ?? ''
  const history = habit.history ?? []
  const first = [...days].sort()[0]
  // 記録の上限で古い日を消したときは、残っている一番古い日から（historyFrom。前の版のデータは、上限まであれば最初の日から）
  if (habit.historyFrom && habit.historyFrom > created) return habit.historyFrom
  if (!habit.historyFrom && history.length >= HABIT_HISTORY_LIMIT && history[0] > created) return history[0]
  // 始めた日より前の日にチェックを付け直したときは、その日から
  return first && first < created ? first : created
}

/** その日に続けていたか（days は habitDays の結果。何度も数えるときに作り直さないように受け取る） */
function activeOn(habit: Habit, days: Set<string>, key: string, start: string): boolean {
  // チェックがある日は、いつでも数える
  if (days.has(key)) return true
  if (key < start) return false
  const ended = isoDay(habit.endedAt)
  if (ended && key >= ended) return false
  return !(habit.breaks ?? []).some((b) => {
    const from = isoDay(b.endedAt)
    const to = isoDay(b.resumedAt)
    return !!from && !!to && key >= from && key < to
  })
}

/**
 * その日に、その習慣を続けていたか（振り返り・カレンダーの「毎日 3/4」の数に入れるか）。
 * 始めた日より前・終えた日（卒業・お休み）から後・休んでいた間は数えない。チェックがある日は数える
 */
export function habitActiveOn(habit: Habit, day: Date): boolean {
  const days = habitDays(habit)
  return activeOn(habit, days, dayKey(day), startDay(habit, days))
}

export interface HabitRecord {
  /** 始めた日 */
  start: Date
  /** 終えた日（終えていなければ無し） */
  end?: Date
  /** 続けていた期間（毎日なら日、毎週なら週…）のうち、できた数 */
  done: number
  /** 続けていた期間の数 */
  total: number
}

/**
 * 習慣の、始めてから終えるまで（終えていなければ今日まで）の記録。
 * 休んでいた間は数えない。最後の期間（終えた日・今日を含む日・週…）は、できていれば数える
 */
export function habitRecord(habit: Habit, now: Date): HabitRecord {
  const days = habitDays(habit)
  const start = startDay(habit, days)
  const at = habit.endedAt ? new Date(habit.endedAt) : undefined
  const endAt = at && !Number.isNaN(at.getTime()) ? at : undefined
  const last = endAt ?? now
  const lastKey = dayKey(last)
  const [y, m, d] = (start || lastKey).split('-').map(Number)
  const all = new Set<string>()
  const done = new Set<string>()
  for (let day = new Date(y, m - 1, d); dayKey(day) <= lastKey; day = addDays(day, 1)) {
    const key = dayKey(day)
    if (!activeOn(habit, days, key, start)) continue
    const p = periodKey(habit.period, day)
    all.add(p)
    if (days.has(key)) done.add(p)
  }
  // 最後の期間は、まだ途中（または途中で終えた）なので、できたときだけ数える
  const lastPeriod = periodKey(habit.period, last)
  if (!done.has(lastPeriod)) all.delete(lastPeriod)
  return { start: new Date(y, m - 1, d), ...(endAt ? { end: endAt } : {}), done: done.size, total: all.size }
}

/** 続いている日数（毎日の習慣だけ。今日まだなら昨日から数える） */
export function streak(habit: Habit, now: Date): number {
  if (habit.period !== 'day') return 0
  const days = habitDays(habit)
  let d = days.has(dayKey(now)) ? now : addDays(now, -1)
  let n = 0
  while (days.has(dayKey(d))) {
    n++
    d = addDays(d, -1)
  }
  return n
}

export interface DoneItem {
  task: Task
  /** 終えたときに出ていた列（期日目標は今の期日から） */
  horizon: Horizon
  project?: Project
}

/**
 * その日に終えたやること。
 * 下ろした先と元の両方が終わっているときは、下ろした先（実際にやった方）だけを出す。
 */
export function doneOn(data: PlannerData, day: Date, now: Date): DoneItem[] {
  const key = dayKey(day)
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  // 同じ日に、下ろした先で終えた元だけを除く（元を別の日にあらためて終えたときは、その日に出す）
  const doneParents = new Set(data.tasks.filter((t) => t.parentId && t.doneAt && dayKey(new Date(t.doneAt)) === key).map((t) => t.parentId!))
  return data.tasks
    .filter((t) => t.doneAt && dayKey(new Date(t.doneAt)) === key && !doneParents.has(t.id))
    .sort((a, b) => a.doneAt!.localeCompare(b.doneAt!))
    .map((task) => ({
      task,
      horizon: effectiveHorizon(task, now),
      project: task.projectId ? projects.get(task.projectId) : undefined,
    }))
}

export interface CountItem {
  task: Task
  /** その日に足した回数（へらしたときは負） */
  added: number
  project?: Project
}

/** その日に回数を足した、回数の目標（振り返りの「やったこと」に、終えたものと並べて出す） */
export function countsOn(data: PlannerData, day: Date): CountItem[] {
  const key = dayKey(day)
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  return data.tasks
    .filter((t) => t.count?.log?.[key])
    .map((task) => ({ task, added: task.count!.log![key], project: task.projectId ? projects.get(task.projectId) : undefined }))
}

/** 直近 n 日（古い順。最後が今日） */
export function lastDays(now: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => addDays(now, i - n + 1))
}
