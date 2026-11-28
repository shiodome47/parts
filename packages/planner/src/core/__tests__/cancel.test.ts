import { describe, expect, it } from 'vitest'
import {
  applyChanges,
  buildColumns,
  cancelTask,
  goalBreakdown,
  isVisible,
  newHabit,
  newProject,
  newTask,
  placeDown,
  placeHabitDown,
  toggleDone,
  toggleHabitAll,
} from '../logic'
import { addDays } from '../period'
import { canceledOn, doneOn } from '../review'
import type { PlannerData, Task } from '../types'

const NOW = new Date(2026, 10, 28, 9, 0)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })
const find = (d: PlannerData, title: string) => d.tasks.find((t) => t.title === title)!

function withTask(title: string, horizon: 'today' | 'week' = 'today') {
  const d = empty()
  return applyChanges(d, { tasks: [newTask(d, { title, horizon, priority: 'B' }, NOW)] })
}

describe('やめる（やらないことにする）', () => {
  it('やめると ✕（doneAt と canceled）。その日は列に残り、次の日には消える', () => {
    let d = withTask('総会の資料')
    d = applyChanges(d, cancelTask(d, find(d, '総会の資料'), NOW))
    const t = find(d, '総会の資料')
    expect(t.canceled).toBe(true)
    expect(t.doneAt).toBeTruthy()
    expect(isVisible(t, NOW)).toBe(true)
    expect(isVisible(t, addDays(NOW, 1))).toBe(false)
    const view = buildColumns(d, NOW).find((c) => c.horizon === 'today')!.tasks[0]
    expect(view.done).toBe(true)
  })

  it('✕ を押すと（toggleDone）、やめたのを取り消して、まだの状態に戻る', () => {
    let d = withTask('総会の資料')
    d = applyChanges(d, cancelTask(d, find(d, '総会の資料'), NOW))
    d = applyChanges(d, toggleDone(d, find(d, '総会の資料'), NOW))
    const t = find(d, '総会の資料')
    expect(t.doneAt).toBeUndefined()
    expect(t.canceled).toBeUndefined()
  })

  it('もう終えたものには付けない', () => {
    let d = withTask('総会の資料')
    d = applyChanges(d, toggleDone(d, find(d, '総会の資料'), NOW))
    expect(cancelTask(d, find(d, '総会の資料'), NOW)).toEqual({})
  })

  it('下ろした先でやめると、元もやめたことになる（終えるときと同じ）。取り消すと両方戻る', () => {
    let d = withTask('防災訓練の準備', 'week')
    d = applyChanges(d, placeDown(d, find(d, '防災訓練の準備'), 'today', NOW))
    const copy = d.tasks.find((t) => t.parentId)!
    d = applyChanges(d, cancelTask(d, copy, NOW))
    expect(d.tasks.every((t) => t.canceled)).toBe(true)
    d = applyChanges(d, toggleDone(d, d.tasks.find((t) => t.parentId)!, NOW))
    expect(d.tasks.every((t) => !t.canceled && !t.doneAt)).toBe(true)
  })
})

describe('習慣から下ろしたものをやめる', () => {
  function placed() {
    let d = empty()
    d = applyChanges(d, { habits: [newHabit(d, { title: 'レシート記入', period: 'day' }, NOW)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', NOW))
    return d
  }

  it('習慣のチェックは付かない。習慣の行は薄くならず、もう一度下ろせる', () => {
    let d = placed()
    d = applyChanges(d, cancelTask(d, d.tasks[0], NOW))
    expect(d.habits[0].checkedAt).toBeUndefined()
    const habitView = buildColumns(d, NOW).find((c) => c.horizon === 'today')!.habits[0]
    expect(habitView.faded).toBe(false)
    // もう一度下ろしても、やめた記録は消さない
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', NOW))
    expect(d.tasks).toHaveLength(2)
    expect(d.tasks.filter((t) => t.canceled)).toHaveLength(1)
  })

  it('習慣をチェックしても・外しても、やめたものは、やめたまま', () => {
    let d = placed()
    d = applyChanges(d, cancelTask(d, d.tasks[0], NOW))
    d = applyChanges(d, toggleHabitAll(d, d.habits[0], NOW))
    expect(d.tasks[0].canceled).toBe(true)
    d = applyChanges(d, toggleHabitAll(d, d.habits[0], NOW))
    expect(d.tasks[0].canceled).toBe(true)
  })

  it('やめたのを取り消しても、習慣のチェックには触れない', () => {
    let d = placed()
    d = applyChanges(d, cancelTask(d, d.tasks[0], NOW))
    d = applyChanges(d, toggleHabitAll(d, d.habits[0], NOW))
    expect(d.habits[0].checkedAt).toBeTruthy()
    d = applyChanges(d, toggleDone(d, d.tasks[0], NOW))
    expect(d.tasks[0].doneAt).toBeUndefined()
    expect(d.habits[0].checkedAt).toBeTruthy()
  })
})

describe('振り返り・目標の中身', () => {
  it('振り返りでは、やったこと（doneOn）に入れず、やめたこと（canceledOn）に出す', () => {
    let d = withTask('総会の資料')
    d = applyChanges(d, { tasks: [newTask(d, { title: '回覧板', horizon: 'today', priority: 'B' }, NOW)] })
    d = applyChanges(d, cancelTask(d, find(d, '総会の資料'), NOW))
    d = applyChanges(d, toggleDone(d, find(d, '回覧板'), NOW))
    expect(doneOn(d, NOW, NOW).map((x) => x.task.title)).toEqual(['回覧板'])
    expect(canceledOn(d, NOW, NOW).map((x) => x.task.title)).toEqual(['総会の資料'])
  })

  it('下ろした先でやめたときは、やめたことに 1 つだけ出す', () => {
    let d = withTask('防災訓練の準備', 'week')
    d = applyChanges(d, placeDown(d, find(d, '防災訓練の準備'), 'today', NOW))
    d = applyChanges(d, cancelTask(d, d.tasks.find((t) => t.parentId)!, NOW))
    expect(canceledOn(d, NOW, NOW)).toHaveLength(1)
  })

  it('目標の中身の進み具合では、やめた目標を数えない（2/5 のうち 1 つやめたら 2/4）', () => {
    let d = empty()
    const goal: Task = { ...newTask(d, { title: '英検', horizon: 'pool', priority: 'B' }, NOW) }
    d = applyChanges(d, { tasks: [goal] })
    const inner = { ...newProject(d, { name: '英検の中身', color: 'blue' }, NOW), goalId: goal.id }
    d = applyChanges(d, { projects: [inner] })
    for (const title of ['単語', '文法', '長文', 'リスニング', '面接']) {
      d = applyChanges(d, { tasks: [{ ...newTask(d, { title, horizon: 'pool', priority: 'C' }, NOW), projectId: inner.id }] })
    }
    d = applyChanges(d, toggleDone(d, find(d, '単語'), NOW))
    d = applyChanges(d, toggleDone(d, find(d, '文法'), NOW))
    expect(goalBreakdown(d, goal)).toMatchObject({ done: 2, total: 5 })
    d = applyChanges(d, cancelTask(d, find(d, '面接'), NOW))
    expect(goalBreakdown(d, goal)).toMatchObject({ done: 2, total: 4 })
  })
})
