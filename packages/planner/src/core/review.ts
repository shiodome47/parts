import { addDays, dayKey, periodKey } from './period'
import { effectiveHorizon } from './logic'
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
  const doneParents = new Set(data.tasks.filter((t) => t.parentId && t.doneAt).map((t) => t.parentId!))
  return data.tasks
    .filter((t) => t.doneAt && dayKey(new Date(t.doneAt)) === key && !doneParents.has(t.id))
    .sort((a, b) => a.doneAt!.localeCompare(b.doneAt!))
    .map((task) => ({
      task,
      horizon: effectiveHorizon(task, now),
      project: task.projectId ? projects.get(task.projectId) : undefined,
    }))
}

/** 直近 n 日（古い順。最後が今日） */
export function lastDays(now: Date, n: number): Date[] {
  return Array.from({ length: n }, (_, i) => addDays(now, i - n + 1))
}
