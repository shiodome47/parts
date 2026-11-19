import { describe, expect, it } from 'vitest'
import { applyChanges, bringToToday, buildColumns, finishOnDay, postponeToTomorrow, toggleHabitOnDay, newHabit, newTask, placeDown, toggleDone, toggleHabit } from '../logic'
import { addDays } from '../period'
import { doneOn, habitDoneOn, streak } from '../review'
import type { PlannerData } from '../types'

const TUE = new Date(2026, 10, 17, 9, 0)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })

describe('習慣の記録', () => {
  it('チェックした日が残り、外すと消える。日をまたいでも前の日の記録は残る', () => {
    let h = newHabit(empty(), { title: '瞑想', period: 'day' }, TUE)
    h = toggleHabit(h, addDays(TUE, -2))
    h = toggleHabit(h, addDays(TUE, -1))
    h = toggleHabit(h, TUE)
    expect(h.history).toEqual(['2026-11-15', '2026-11-16', '2026-11-17'])
    h = toggleHabit(h, TUE)
    expect(h.history).toEqual(['2026-11-15', '2026-11-16'])
    expect(habitDoneOn(h, addDays(TUE, -1))).toBe(true)
    expect(habitDoneOn(h, TUE)).toBe(false)
  })

  it('続いている日数（今日まだなら昨日から数える）', () => {
    let h = newHabit(empty(), { title: '瞑想', period: 'day' }, TUE)
    for (const n of [-4, -2, -1]) h = toggleHabit(h, addDays(TUE, n))
    expect(streak(h, TUE)).toBe(2)
    h = toggleHabit(h, TUE)
    expect(streak(h, TUE)).toBe(3)
  })

  it('毎週の習慣は、その週のどこかでチェックしていれば、その週の日はどれも済み', () => {
    let h = newHabit(empty(), { title: '掃除', period: 'week' }, TUE)
    h = toggleHabit(h, TUE)
    expect(habitDoneOn(h, new Date(2026, 10, 22))).toBe(true) // 日曜
    expect(habitDoneOn(h, new Date(2026, 10, 23))).toBe(false) // 次の月曜
  })

  it('記録が始まる前の版でチェックしたものも、その日に数える', () => {
    const h = { ...newHabit(empty(), { title: '瞑想', period: 'day' as const }, TUE), checkedAt: TUE.toISOString() }
    expect(habitDoneOn(h, TUE)).toBe(true)
  })
})

describe('その日にやったこと', () => {
  it('終えた日で分け、下ろした先と元が両方終わっていれば、下ろした先だけ出す', () => {
    let d = applyChanges(empty(), { tasks: [newTask(empty(), { title: '散髪', horizon: 'week', priority: 'B' }, TUE)] })
    d = applyChanges(d, placeDown(d, d.tasks[0], 'today', TUE))
    const child = d.tasks.find((t) => t.parentId)!
    d = applyChanges(d, toggleDone(d, child, TUE))
    d = applyChanges(d, { tasks: [newTask(d, { title: '月初処理', horizon: 'today', priority: 'A' }, TUE)] })
    d = applyChanges(d, toggleDone(d, d.tasks.find((t) => t.title === '月初処理')!, addDays(TUE, -1)))
    expect(doneOn(d, TUE, TUE).map((x) => x.task.id)).toEqual([child.id])
    expect(doneOn(d, addDays(TUE, -1), TUE).map((x) => x.task.title)).toEqual(['月初処理'])
  })
})

describe('アプリが足した項目', () => {
  it('applyChanges は、データにアプリが足した項目（日記など）を変えずに残す', () => {
    const d = { ...empty(), diaries: [{ id: '2026-11-17', text: 'メモ' }] }
    const next = applyChanges(d, { tasks: [newTask(d, { title: '下見', horizon: 'today', priority: 'B' }, TUE)] })
    expect(next.diaries).toBe(d.diaries)
    expect(next.tasks.map((t) => t.title)).toEqual(['下見'])
  })
})

describe('振り返りから付け直す', () => {
  const MON = new Date(2026, 10, 16, 9, 0)

  it('過ぎた日の習慣を、できたことにする・外す（今のチェックは変えない）', () => {
    const h = newHabit(empty(), { title: '瞑想', period: 'day' }, TUE)
    const on = toggleHabitOnDay(h, MON, TUE)
    expect(habitDoneOn(on, MON)).toBe(true)
    expect(on.checkedAt).toBeUndefined()
    const off = toggleHabitOnDay(on, MON, TUE)
    expect(habitDoneOn(off, MON)).toBe(false)
  })

  it('今日の分を付けると、今のチェックも付く。外すと消える', () => {
    const h = newHabit(empty(), { title: '瞑想', period: 'day' }, TUE)
    const on = toggleHabitOnDay(h, TUE, TUE)
    expect(on.checkedAt).toBeDefined()
    expect(habitDoneOn(on, TUE)).toBe(true)
    const off = toggleHabitOnDay(on, TUE, TUE)
    expect(off.checkedAt).toBeUndefined()
    expect(habitDoneOn(off, TUE)).toBe(false)
  })

  it('チェックし忘れたやることを、その日に終えたことにする', () => {
    let d = applyChanges(empty(), { tasks: [newTask(empty(), { title: '回覧板', horizon: 'today', priority: 'B' }, MON)] })
    d = applyChanges(d, finishOnDay(d, d.tasks[0], MON, TUE))
    expect(doneOn(d, MON, TUE).map((x) => x.task.title)).toEqual(['回覧板'])
    expect(doneOn(d, TUE, TUE)).toEqual([])
  })
})

describe('明日にまわす', () => {
  const titlesOf = (d: PlannerData, part: 'tasks' | 'tomorrow') => buildColumns(d, TUE).find((c) => c.horizon === 'today')![part].map((v) => v.task.title)

  it('今日の分 → 明日の欄 → 今日にもどす', () => {
    let d = applyChanges(empty(), { tasks: [newTask(empty(), { title: '回覧板', horizon: 'today', priority: 'B' }, TUE)] })
    d = applyChanges(d, postponeToTomorrow(d.tasks[0], TUE))
    expect(titlesOf(d, 'tasks')).toEqual([])
    expect(titlesOf(d, 'tomorrow')).toEqual(['回覧板'])
    // 次の日には、今日の分になる
    const WED = new Date(2026, 10, 18, 9, 0)
    expect(buildColumns(d, WED).find((c) => c.horizon === 'today')!.tasks.map((v) => v.task.title)).toEqual(['回覧板'])
    d = applyChanges(d, bringToToday(d.tasks[0], TUE))
    expect(titlesOf(d, 'tasks')).toEqual(['回覧板'])
  })

  it('日付のあるものは、日付を明日にする', () => {
    let d = applyChanges(empty(), { tasks: [newTask(empty(), { title: '体重計る', horizon: 'pool', priority: 'C', due: '2026-11-17' }, TUE)] })
    d = applyChanges(d, postponeToTomorrow(d.tasks[0], TUE))
    expect(d.tasks[0].due).toBe('2026-11-18')
    expect(titlesOf(d, 'tomorrow')).toEqual(['体重計る'])
  })

  it('下ろした先のものも、明日の欄へ（元は薄いまま）', () => {
    let d = applyChanges(empty(), { tasks: [newTask(empty(), { title: '資料', horizon: 'week', priority: 'B' }, TUE)] })
    d = applyChanges(d, placeDown(d, d.tasks[0], 'today', TUE))
    const child = d.tasks.find((t) => t.parentId)!
    d = applyChanges(d, postponeToTomorrow(child, TUE))
    expect(titlesOf(d, 'tomorrow')).toEqual(['資料'])
  })
})
