import { describe, expect, it } from 'vitest'
import { addCount, applyChanges, countable, countedTask, newTask, placeDown, setCount, toggleDone } from '../logic'
import { countsOn, doneOn } from '../review'
import type { PlannerData, Task } from '../types'

/** 2026 年 11 月 d 日の夜 */
const on = (d: number, h = 21) => new Date(2026, 10, d, h, 0)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })

/** 「リーディング」を足して、回数の目標（めざす数 target・今 done）にしたデータ */
function reading(target: number, done = 0): { d: PlannerData; task: () => Task } {
  let d = empty()
  d = applyChanges(d, { tasks: [newTask(d, { title: 'リーディング', horizon: 'week', priority: 'B' }, on(20))] })
  d = applyChanges(d, setCount(d, d.tasks[0], { target, done }, on(20)))
  return { d, task: () => d.tasks[0] }
}

describe('回数の目標', () => {
  it('回数の目標にする（めざす数・今の数）', () => {
    const { d } = reading(100, 20)
    expect(d.tasks[0].count).toEqual({ target: 100, done: 20 })
    expect(d.tasks[0].doneAt).toBeUndefined()
  })

  it('足すと、その日の記録にも残る（同じ日はまとめる）', () => {
    let { d } = reading(100, 20)
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21)))
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21, 22)))
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(22)))
    expect(d.tasks[0].count).toEqual({ target: 100, done: 23, log: { '2026-11-21': 2, '2026-11-22': 1 } })
  })

  it('へらす（0 より下にはならない。その日に足した分が 0 になれば、その日の記録は消える）', () => {
    let { d } = reading(100, 0)
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21)))
    d = applyChanges(d, addCount(d, d.tasks[0], -1, on(21)))
    expect(d.tasks[0].count).toEqual({ target: 100, done: 0 })
    expect(addCount(d, d.tasks[0], -1, on(21))).toEqual({})
  })

  it('めざす数に届くと終える。終えた項目には足さない', () => {
    let { d } = reading(3, 2)
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21)))
    expect(d.tasks[0].doneAt).toBe(on(21).toISOString())
    expect(doneOn(d, on(21), on(21)).map((x) => x.task.title)).toEqual(['リーディング'])
    expect(addCount(d, d.tasks[0], 1, on(22))).toEqual({})
  })

  it('めざす数を上げると、終えていないことに戻る。届く数に直すと終える', () => {
    let { d } = reading(3, 3)
    expect(d.tasks[0].doneAt).toBeTruthy()
    d = applyChanges(d, setCount(d, d.tasks[0], { target: 5, done: 3 }, on(21)))
    expect(d.tasks[0].doneAt).toBeUndefined()
    d = applyChanges(d, setCount(d, d.tasks[0], { target: 5, done: 5 }, on(21)))
    expect(d.tasks[0].doneAt).toBeTruthy()
  })

  it('回数の目標をやめると、ふつうの項目に戻る（終えた・終えていないはそのまま）', () => {
    let { d } = reading(100, 20)
    d = applyChanges(d, setCount(d, d.tasks[0], undefined, on(21)))
    expect(d.tasks[0].count).toBeUndefined()
    expect(d.tasks[0].doneAt).toBeUndefined()
  })

  it('下ろした先のコピーは、元の回数を数える。届けば、下ろした先も元も終える', () => {
    let { d } = reading(2, 1)
    d = applyChanges(d, placeDown(d, d.tasks[0], 'today', on(21)))
    const child = d.tasks.find((t) => t.parentId)!
    expect(countable(child)).toBe(false)
    const counted = countedTask(d, child)!
    expect(counted.id).toBe(d.tasks[0].id)
    d = applyChanges(d, addCount(d, counted, 1, on(21)))
    expect(d.tasks.every((t) => t.doneAt)).toBe(true)
  })

  it('チェックを外すと、回数はそのまま（もう一度足せる）', () => {
    let { d } = reading(2, 1)
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21)))
    d = applyChanges(d, toggleDone(d, d.tasks[0], on(21)))
    expect(d.tasks[0].doneAt).toBeUndefined()
    expect(d.tasks[0].count?.done).toBe(2)
  })

  it('振り返り: その日に回数を足した項目と、足した数', () => {
    let { d } = reading(100, 20)
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21)))
    d = applyChanges(d, addCount(d, d.tasks[0], 1, on(21)))
    expect(countsOn(d, on(21)).map((x) => [x.task.title, x.added])).toEqual([['リーディング', 2]])
    expect(countsOn(d, on(22))).toEqual([])
  })
})
