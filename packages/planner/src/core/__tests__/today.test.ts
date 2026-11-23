import { describe, expect, it } from 'vitest'
import { applyChanges, buildColumns, newHabit, newProject, newTask, placeDown, placeHabitDown, projectGoals, todayMarks, toggleHabit } from '../logic'
import type { PlannerData } from '../types'

const MON = new Date(2026, 10, 23, 9, 0)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })

describe('今日のもの（プロジェクトの画面で目立たせる）', () => {
  it('今日の列の習慣（毎日）と、期日が今日までの目標。済んだかも分かる', () => {
    let d = empty()
    const yoga = newProject(d, { name: 'ヨガ', color: 'yellow' }, MON)
    d = applyChanges(d, { projects: [yoga] })
    d = applyChanges(d, { habits: [newHabit(d, { title: '瞑想30分', period: 'day', projectId: yoga.id }, MON)] })
    d = applyChanges(d, { habits: [newHabit(d, { title: '週 1 の掃除', period: 'week', projectId: yoga.id }, MON)] })
    d = applyChanges(d, { habits: [toggleHabit(d.habits[0], MON)] })
    d = applyChanges(d, { tasks: [newTask(d, { title: '健康診断', horizon: 'pool', priority: 'C', projectId: yoga.id, due: '2026-11-23' }, MON)] })
    d = applyChanges(d, { tasks: [newTask(d, { title: '明日の予約', horizon: 'pool', priority: 'C', projectId: yoga.id, due: '2026-11-24' }, MON)] })
    const m = todayMarks(d, MON)
    expect([...m.habits]).toEqual([[d.habits[0].id, true]])
    expect([...m.tasks]).toEqual([[d.tasks.find((t) => t.title === '健康診断')!.id, false]])
  })

  it('今日に下ろしたものは、元（目標・習慣）に数える', () => {
    let d = empty()
    const p = newProject(d, { name: '英語', color: 'blue' }, MON)
    d = applyChanges(d, { projects: [p] })
    d = applyChanges(d, { tasks: [newTask(d, { title: 'パート7', horizon: 'week', priority: 'B', projectId: p.id }, MON)] })
    d = applyChanges(d, placeDown(d, d.tasks[0], 'today', MON))
    d = applyChanges(d, { habits: [newHabit(d, { title: '単語', period: 'week', projectId: p.id }, MON)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', MON))
    const m = todayMarks(d, MON)
    expect(m.tasks.has(d.tasks[0].id)).toBe(true)
    expect(m.habits.get(d.habits[0].id)).toBe(false)
  })
})

describe('プロジェクトのルーチン目標を下ろす', () => {
  it('今日に下ろすと、今日の列に出る（プロジェクトの期日目標にはならない）', () => {
    let d = empty()
    const p = newProject(d, { name: '英語', color: 'blue' }, MON)
    d = applyChanges(d, { projects: [p] })
    d = applyChanges(d, { habits: [newHabit(d, { title: '単語', period: 'week', projectId: p.id }, MON)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', MON))
    expect(buildColumns(d, MON).find((c) => c.horizon === 'today')!.tasks.map((v) => v.task.title)).toEqual(['単語'])
    expect(projectGoals(d, p.id).open).toEqual([])
  })
})
