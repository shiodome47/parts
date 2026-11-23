import { describe, expect, it } from 'vitest'
import {
  addCount,
  applyChanges,
  buildColumns,
  checkHabitFor,
  endHabit,
  finishOnDay,
  habitToTask,
  moveProject,
  newHabit,
  newProject,
  newTask,
  numbered,
  placeDown,
  placeHabitDown,
  projectGoals,
  removeHabit,
  setCount,
  setPriority,
  todayMarks,
  toggleDone,
  toggleHabit,
  toggleHabitAll,
  toggleHabitOnDay,
  withDay,
  HABIT_HISTORY_LIMIT,
} from '../logic'
import { withWhen } from '../when'
import { doneOn, habitDoneOn, habitRecord } from '../review'
import type { Habit, PlannerData, Task } from '../types'

/** 2026 年 m 月 d 日 h 時 */
const at = (m: number, d: number, h = 9) => new Date(2026, m - 1, d, h, 0)
const MON = at(11, 23)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })
const col = (d: PlannerData, now: Date, h: 'today' | 'week' | 'month') => buildColumns(d, now).find((c) => c.horizon === h)!

describe('習慣から下ろしたものを、さらに下ろしたとき', () => {
  /** 毎月の「家計簿」を今週へ、そこから今日へ */
  function chain() {
    let d = empty()
    d = applyChanges(d, { habits: [newHabit(d, { title: '家計簿', period: 'month' }, MON)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'week', MON))
    const wk = d.tasks[0]
    d = applyChanges(d, placeDown(d, wk, 'today', MON))
    const td = d.tasks.find((t) => t.parentId === wk.id)!
    return { d, wk, td }
  }

  it('今日の分を終えると、習慣にチェックが付く（今週の分も終わる）', () => {
    const { d: d0, td } = chain()
    const d = applyChanges(d0, toggleDone(d0, td, MON))
    expect(d.habits[0].checkedAt).toBeTruthy()
    expect(d.tasks.every((t) => t.doneAt)).toBe(true)
  })

  it('習慣をチェックすると、今週の分も今日の分も終わる', () => {
    const { d: d0 } = chain()
    const d = applyChanges(d0, toggleHabitAll(d0, d0.habits[0], MON))
    expect(d.tasks.every((t) => t.doneAt)).toBe(true)
  })

  it('習慣を終える（卒業・お休み）と、今日の分も消える', () => {
    const { d: d0 } = chain()
    const d = applyChanges(d0, endHabit(d0, d0.habits[0], 'paused', '', MON))
    expect(d.tasks).toEqual([])
  })

  it('今日のもの（プロジェクトの「今日」）は、習慣に数える', () => {
    const { d } = chain()
    expect(todayMarks(d, MON).habits.has(d.habits[0].id)).toBe(true)
    expect(todayMarks(d, MON).tasks.size).toBe(0)
  })

  it('習慣を下ろし直すと、前の分の先（今日の分）も消える', () => {
    const { d: d0 } = chain()
    const d = applyChanges(d0, placeHabitDown(d0, d0.habits[0], 'today', MON))
    expect(d.tasks).toHaveLength(1)
    expect(d.tasks[0].parentId).toBeUndefined()
  })

  it('前の版のデータ（さらに下ろした先に habitId が無い）でも、元をたどって習慣にチェックが付く', () => {
    const { d: d0, td } = chain()
    const { habitId: _h, ...old } = td
    const d1 = applyChanges(d0, { tasks: [old as Task] })
    const d = applyChanges(d1, toggleDone(d1, old as Task, MON))
    expect(d.habits[0].checkedAt).toBeTruthy()
  })
})

describe('週が月・年をまたぐとき（毎月・毎年の「その日」）', () => {
  it('11/30 にチェックした毎月 30 日の分は、12/2 の今週の列では済み（出さない）', () => {
    let d = empty()
    d = applyChanges(d, { habits: [withDay(newHabit(d, { title: '月末の締め', period: 'month' }, at(11, 1)), 30)] })
    d = applyChanges(d, { habits: [toggleHabit(d.habits[0], at(11, 30, 20))] })
    expect(col(d, at(12, 2), 'week').habits).toEqual([])
  })

  it('まだの 11/30 の分を 12/2 に押すと、11 月の分になり、12 月の分は残る', () => {
    let d = empty()
    d = applyChanges(d, { habits: [withDay(newHabit(d, { title: '月末の締め', period: 'month' }, at(11, 1)), 30)] })
    const view = col(d, at(12, 2), 'week').habits[0]
    expect(view.dueDay).toEqual(at(11, 30, 0))
    d = applyChanges(d, checkHabitFor(d, d.habits[0], view.dueDay, at(12, 2)))
    expect(habitDoneOn(d.habits[0], at(11, 30))).toBe(true)
    expect(habitDoneOn(d.habits[0], at(12, 30))).toBe(false)
    expect(col(d, at(12, 30), 'today').habits.map((v) => v.habit.title)).toEqual(['月末の締め'])
  })

  it('11 月にチェックした毎月 1 日は、11/30（月）の今週の列に 12/1 の分を出す', () => {
    let d = empty()
    d = applyChanges(d, { habits: [withDay(newHabit(d, { title: '家賃', period: 'month' }, at(10, 1)), 1)] })
    d = applyChanges(d, { habits: [toggleHabit(d.habits[0], at(11, 1))] })
    expect(col(d, at(11, 30), 'week').habits.map((v) => v.dueDay)).toEqual([at(12, 1, 0)])
  })

  it('毎年 1/1 は、12/28 の週（1/3 まで）に出す', () => {
    let d = empty()
    d = applyChanges(d, { habits: [withWhen(newHabit(d, { title: '年賀状', period: 'year' }, at(1, 1)), '01-01')] })
    expect(col(d, new Date(2026, 11, 28, 9), 'week').habits.map((v) => v.dueDay)).toEqual([new Date(2027, 0, 1)])
  })

  it('前の月に終えた下ろした先があっても、新しい月の習慣は薄くならない。外しても前の月の分はそのまま', () => {
    let d = empty()
    d = applyChanges(d, { habits: [newHabit(d, { title: '家計簿', period: 'month' }, at(11, 1))] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'week', at(11, 30)))
    d = applyChanges(d, toggleDone(d, d.tasks[0], at(11, 30)))
    const month = col(d, at(12, 1), 'month').habits[0]
    expect(month.faded).toBe(false)
    expect(month.checked).toBe(false)
    d = applyChanges(d, toggleHabitAll(d, d.habits[0], at(12, 1)))
    d = applyChanges(d, toggleHabitAll(d, d.habits[0], at(12, 1)))
    expect(d.tasks[0].doneAt).toBeTruthy()
  })

  it('毎週の曜日の習慣を今日に下ろしたら、今日の列に 2 行出さない', () => {
    let d = empty()
    d = applyChanges(d, { habits: [withWhen(newHabit(d, { title: 'ゴミ出し', period: 'week' }, MON), 1)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', MON))
    const today = col(d, MON, 'today')
    expect(today.habits).toEqual([])
    expect(today.tasks.map((v) => v.task.title)).toEqual(['ゴミ出し'])
  })
})

describe('振り返りから付け直す', () => {
  it('先週の下ろした先を、先週の日に終えたことにしても、今週のチェックは消えない', () => {
    let d = empty()
    d = applyChanges(d, { habits: [newHabit(d, { title: '掃除', period: 'week' }, at(11, 1))] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', at(11, 18)))
    const lastWeekCopy = d.tasks[0]
    d = applyChanges(d, { habits: [toggleHabit(d.habits[0], MON)] })
    d = applyChanges(d, finishOnDay(d, lastWeekCopy, at(11, 18), MON))
    expect(habitDoneOn(d.habits[0], MON)).toBe(true)
    expect(habitDoneOn(d.habits[0], at(11, 18))).toBe(true)
    expect(new Date(d.habits[0].checkedAt!).getDate()).toBe(23)
  })

  it('終えたものに「この日に終えた」を重ねても、取り消さない', () => {
    let d = empty()
    d = applyChanges(d, { tasks: [newTask(d, { title: '回覧板', horizon: 'today', priority: 'B' }, MON)] })
    d = applyChanges(d, toggleDone(d, d.tasks[0], MON))
    expect(finishOnDay(d, d.tasks[0], MON, MON)).toEqual({})
  })

  it('同じ週に 2 日チェックがあるとき、片方を外しても、時間軸と振り返りが食い違わない', () => {
    let h: Habit = newHabit(empty(), { title: 'ジム', period: 'week' }, MON)
    const tue = at(11, 24)
    h = toggleHabit(h, MON)
    h = toggleHabitOnDay(h, tue, tue)
    h = toggleHabitOnDay(h, MON, tue)
    expect(habitDoneOn(h, tue)).toBe(true)
    expect(h.checkedAt).toBeTruthy()
    // 時間軸で外すと、今週の記録は全部消える
    h = toggleHabit(h, tue)
    expect(habitDoneOn(h, tue)).toBe(false)
    expect(h.history).toEqual([])
  })
})

describe('並び（番号）', () => {
  it('期日目標を A にすると、今日の列の A の一番下へ', () => {
    let d = empty()
    const p = newProject(d, { name: '自治会', color: 'teal' }, MON)
    d = applyChanges(d, { projects: [p] })
    d = applyChanges(d, { tasks: [newTask(d, { title: 'X', horizon: 'today', priority: 'A' }, MON)] })
    d = applyChanges(d, { tasks: [newTask(d, { title: 'Y', horizon: 'today', priority: 'A' }, MON)] })
    d = applyChanges(d, { tasks: [newTask(d, { title: 'G', horizon: 'pool', priority: 'C', projectId: p.id, due: '2026-11-23' }, MON)] })
    const g = d.tasks.find((t) => t.title === 'G')!
    d = applyChanges(d, setPriority(d, g, 'A', MON))
    expect(numbered(col(d, MON, 'today').tasks.map((v) => v.task)).map((x) => `${x.label} ${x.task.title}`)).toEqual(['A1 X', 'A2 Y', 'A3 G'])
  })
})

describe('やることに移す（習慣 → やること）', () => {
  it('プロジェクトのルーチン目標は、プロジェクトの目標になり、同じ期間の列にも出る。下ろした分は消える', () => {
    let d = empty()
    const p = newProject(d, { name: 'ヨガ', color: 'yellow' }, MON)
    d = applyChanges(d, { projects: [p] })
    d = applyChanges(d, { habits: [newHabit(d, { title: 'マット買う', period: 'week', projectId: p.id }, MON)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', MON))
    d = applyChanges(d, habitToTask(d, d.habits[0], MON))
    expect(d.habits).toEqual([])
    expect(projectGoals(d, p.id).open.map((t) => t.title)).toEqual(['マット買う'])
    expect(col(d, MON, 'week').tasks.map((v) => v.task.title)).toEqual(['マット買う'])
    expect(col(d, MON, 'today').tasks).toEqual([])
  })
})

describe('振り返りの「やったこと」', () => {
  it('元を別の日にあらためて終えたときは、その日に出す', () => {
    let d = empty()
    d = applyChanges(d, { tasks: [newTask(d, { title: '資料', horizon: 'week', priority: 'B' }, MON)] })
    d = applyChanges(d, placeDown(d, d.tasks[0], 'today', MON))
    const child = d.tasks.find((t) => t.parentId)!
    d = applyChanges(d, toggleDone(d, child, MON))
    const tue = at(11, 24)
    const wed = at(11, 25)
    d = applyChanges(d, toggleDone(d, d.tasks[0], tue))
    d = applyChanges(d, toggleDone(d, d.tasks[0], wed))
    expect(doneOn(d, wed, wed).map((x) => x.task.title)).toEqual(['資料'])
  })
})

describe('回数の目標', () => {
  it('チェックを外したあとに 1 回へらしても、また終わらない', () => {
    let d = empty()
    d = applyChanges(d, { tasks: [newTask(d, { title: '腕立て', horizon: 'week', priority: 'B' }, MON)] })
    d = applyChanges(d, setCount(d, d.tasks[0], { target: 5, done: 7 }, MON))
    d = applyChanges(d, toggleDone(d, d.tasks[0], MON))
    expect(d.tasks[0].doneAt).toBeUndefined()
    d = applyChanges(d, addCount(d, d.tasks[0], -1, MON))
    expect(d.tasks[0].doneAt).toBeUndefined()
    expect(d.tasks[0].count?.done).toBe(6)
  })

  it('めざす数に Infinity・NaN は入れない', () => {
    let d = empty()
    d = applyChanges(d, { tasks: [newTask(d, { title: '腕立て', horizon: 'week', priority: 'B' }, MON)] })
    expect(setCount(d, d.tasks[0], { target: Infinity, done: 0 }, MON)).toEqual({})
    expect(setCount(d, d.tasks[0], { target: 10, done: NaN }, MON)).toEqual({})
  })
})

describe('習慣の記録の上限', () => {
  it('上限まであって 1 日外しても、振り返りの数が跳ねない', () => {
    let h: Habit = newHabit(empty(), { title: '瞑想', period: 'day' }, new Date(2024, 0, 1))
    const days: string[] = []
    for (let i = 0; i < HABIT_HISTORY_LIMIT + 1; i++) {
      const d = new Date(2024, 0, 1 + i)
      days.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`)
    }
    for (const k of days) h = toggleHabitOnDay(h, new Date(`${k}T12:00:00`), new Date(2026, 11, 1))
    const now = new Date(2026, 2, 12)
    const before = habitRecord(h, now).total
    h = toggleHabitOnDay(h, new Date(`${days[days.length - 1]}T12:00:00`), now)
    expect(habitRecord(h, now).total).toBeLessThanOrEqual(before)
    expect(h.historyFrom).toBe(days[1])
  })
})

describe('プロジェクトの入れ子は 1 段だけ', () => {
  it('テーマの中のプロジェクトには、入れない', () => {
    let d = empty()
    const theme = newProject(d, { name: '英語', color: 'blue' }, MON)
    d = applyChanges(d, { projects: [theme] })
    const inner = newProject(d, { name: 'TOEIC', color: 'blue', parentId: theme.id }, MON)
    d = applyChanges(d, { projects: [inner] })
    const p = newProject(d, { name: '単語', color: 'blue' }, MON)
    d = applyChanges(d, { projects: [p] })
    expect(moveProject(d, p, inner.id, MON)).toEqual({})
  })
})

describe('壊れたデータ（下ろした先と元が輪になっている）でも止まらない', () => {
  it('列・今日のもの・終える', () => {
    const t = (id: string, parentId: string): Task => ({ id, title: id, horizon: 'today', priority: 'B', order: 0, parentId, createdAt: '', updatedAt: '' })
    const d: PlannerData = { tasks: [t('a', 'b'), t('b', 'a')], habits: [], projects: [] }
    expect(() => buildColumns(d, MON)).not.toThrow()
    expect(() => todayMarks(d, MON)).not.toThrow()
    expect(toggleDone(d, d.tasks[0], MON).tasks).toHaveLength(2)
  })
})

describe('習慣を完全に消す', () => {
  it('下ろした先で、まだ終えていないものも消す（終えたものは振り返りに残す）', () => {
    let d = empty()
    d = applyChanges(d, { habits: [newHabit(d, { title: '週ごとの片付け', period: 'week' }, MON)] })
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', at(11, 16)))
    d = applyChanges(d, toggleDone(d, d.tasks[0], at(11, 16)))
    d = applyChanges(d, placeHabitDown(d, d.habits[0], 'today', MON))
    d = applyChanges(d, removeHabit(d, d.habits[0], MON))
    expect(d.habits).toEqual([])
    expect(d.tasks.map((t) => !!t.doneAt)).toEqual([true])
  })
})
