import { describe, expect, it } from 'vitest'
import { applyChanges, buildColumns, endHabit, endedHabits, newHabit, placeHabitDown, resumeHabit, toggleHabit, withDay } from '../logic'
import { habitActiveOn, habitRecord } from '../review'
import type { Habit, PlannerData } from '../types'

/** 2026 年 11 月 d 日の朝 9 時 */
const on = (d: number, h = 9) => new Date(2026, 10, d, h, 0)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })
const withHabit = (h: Habit): PlannerData => ({ ...empty(), habits: [h] })

/** 毎日の習慣を、作った日と、チェックした日（11 月の日にち）で作る */
function daily(created: number, checks: number[], title = '23時までに寝る'): Habit {
  let h = newHabit(empty(), { title, period: 'day' }, on(created))
  for (const d of checks) h = toggleHabit(h, on(d, 22))
  return h
}

describe('習慣を終える（卒業・お休み）', () => {
  it('時間軸のチェックの一覧から外れ、一番下の「これまでの習慣」に出る。記録は残る', () => {
    const h = daily(10, [10, 11])
    const d = applyChanges(withHabit(h), endHabit(withHabit(h), h, 'graduated', ' 身についた ', on(17)))
    const today = buildColumns(d, on(17)).find((c) => c.horizon === 'today')!
    expect(today.habits).toEqual([])
    expect(today.ended.map((x) => x.title)).toEqual(['23時までに寝る'])
    expect(d.habits[0]).toMatchObject({ endedAs: 'graduated', endNote: '身についた', endedAt: on(17).toISOString() })
    expect(d.habits[0].history).toEqual(['2026-11-10', '2026-11-11'])
  })

  it('毎月の「その日」で今日の列に出ていた習慣も、終えると出ない', () => {
    const h = withDay(newHabit(empty(), { title: '家計簿', period: 'month' }, on(1)), 10)
    expect(buildColumns(withHabit(h), on(17)).find((c) => c.horizon === 'today')!.habits).toHaveLength(1)
    const d = applyChanges(withHabit(h), endHabit(withHabit(h), h, 'paused', '', on(17)))
    expect(buildColumns(d, on(17)).find((c) => c.horizon === 'today')!.habits).toEqual([])
    expect(buildColumns(d, on(17)).find((c) => c.horizon === 'month')!.ended).toHaveLength(1)
  })

  it('下ろした先で、まだ終えていないやることは消す', () => {
    const h = newHabit(empty(), { title: '掃除', period: 'week' }, on(16))
    let d = applyChanges(withHabit(h), placeHabitDown(withHabit(h), h, 'today', on(17)))
    expect(d.tasks).toHaveLength(1)
    d = applyChanges(d, endHabit(d, d.habits[0], 'paused', '', on(17)))
    expect(d.tasks).toEqual([])
  })

  it('もう終えた習慣なら、終えた日はそのままで、終え方とひとことだけ変わる', () => {
    const h = daily(10, [10])
    let d = applyChanges(withHabit(h), endHabit(withHabit(h), h, 'paused', '朝が忙しかった', on(12)))
    d = applyChanges(d, endHabit(d, d.habits[0], 'graduated', '', on(17)))
    expect(d.habits[0].endedAt).toBe(on(12).toISOString())
    expect(d.habits[0].endedAs).toBe('graduated')
    expect(d.habits[0].endNote).toBeUndefined()
  })

  it('「これまでの習慣」は、新しく終えた順', () => {
    const a = { ...daily(1, [], 'A'), endedAt: on(5).toISOString(), endedAs: 'paused' as const }
    const b = { ...daily(1, [], 'B'), endedAt: on(9).toISOString(), endedAs: 'graduated' as const }
    expect(endedHabits([a, daily(1, [], 'C'), b]).map((x) => x.title)).toEqual(['B', 'A'])
  })
})

describe('また始める', () => {
  it('終えた日と同じ日なら、取り消すだけ（休んでいた間は残さない）', () => {
    const h = daily(10, [10])
    let d = applyChanges(withHabit(h), endHabit(withHabit(h), h, 'paused', 'まちがえた', on(17)))
    d = applyChanges(d, resumeHabit(d, d.habits[0], on(17, 10)))
    expect(d.habits[0].endedAt).toBeUndefined()
    expect(d.habits[0].endedAs).toBeUndefined()
    expect(d.habits[0].endNote).toBeUndefined()
    expect(d.habits[0].breaks).toBeUndefined()
    expect(buildColumns(d, on(17)).find((c) => c.horizon === 'today')!.habits).toHaveLength(1)
  })

  it('別の日なら、休んでいた間を残し、同じ期間の習慣の一番下へ', () => {
    const other = daily(1, [], '白湯')
    const h = { ...daily(1, [1]), order: 0 }
    let d: PlannerData = { ...empty(), habits: [h, { ...other, order: 1 }] }
    d = applyChanges(d, endHabit(d, h, 'paused', '眠れなかった', on(5)))
    d = applyChanges(d, resumeHabit(d, d.habits[0], on(10)))
    const back = d.habits.find((x) => x.id === h.id)!
    expect(back.endedAt).toBeUndefined()
    expect(back.breaks).toEqual([{ endedAt: on(5).toISOString(), endedAs: 'paused', endNote: '眠れなかった', resumedAt: on(10).toISOString() }])
    expect(buildColumns(d, on(10)).find((c) => c.horizon === 'today')!.habits.map((v) => v.habit.title)).toEqual(['白湯', '23時までに寝る'])
  })
})

describe('その日に続けていたか（振り返りの数）', () => {
  it('始めた日より前は数えない。ただし、チェックを付け直した日は数える', () => {
    const h = daily(10, [])
    expect(habitActiveOn(h, on(9))).toBe(false)
    expect(habitActiveOn(h, on(10))).toBe(true)
    expect(habitActiveOn({ ...h, history: ['2026-11-08'] }, on(8))).toBe(true)
  })

  it('終えた日から後は数えない。終えた日も、チェックしていなければ数えない', () => {
    const h = { ...daily(1, [5]), endedAt: on(5, 23).toISOString(), endedAs: 'graduated' as const }
    expect(habitActiveOn(h, on(4))).toBe(true)
    expect(habitActiveOn(h, on(5))).toBe(true) // チェックしてから卒業した
    expect(habitActiveOn(h, on(6))).toBe(false)
    const g = { ...daily(1, []), endedAt: on(5).toISOString(), endedAs: 'paused' as const }
    expect(habitActiveOn(g, on(5))).toBe(false)
  })

  it('休んでいた間は数えない（また始めた日からは数える）', () => {
    const h = daily(1, [1, 2])
    let d = applyChanges(withHabit(h), endHabit(withHabit(h), h, 'paused', '', on(5)))
    d = applyChanges(d, resumeHabit(d, d.habits[0], on(10)))
    const back = d.habits[0]
    expect(habitActiveOn(back, on(4))).toBe(true)
    expect(habitActiveOn(back, on(5))).toBe(false)
    expect(habitActiveOn(back, on(9))).toBe(false)
    expect(habitActiveOn(back, on(10))).toBe(true)
  })
})

describe('習慣の記録（始めてから終えるまで）', () => {
  it('毎日: 続けていた日のうち、できた日', () => {
    const h = { ...daily(10, [10, 11, 13, 16]), endedAt: on(17).toISOString(), endedAs: 'graduated' as const }
    const r = habitRecord(h, on(20))
    expect(r).toMatchObject({ done: 4, total: 7 })
    expect(r.start).toEqual(new Date(2026, 10, 10))
    expect(r.end).toEqual(on(17))
  })

  it('終えていなければ今日まで。今日まだなら、今日は数えない', () => {
    const h = daily(10, [10, 11])
    expect(habitRecord(h, on(17))).toMatchObject({ done: 2, total: 7 })
    expect(habitRecord(toggleHabit(h, on(17)), on(17))).toMatchObject({ done: 3, total: 8 })
    expect(habitRecord(h, on(17)).end).toBeUndefined()
  })

  it('毎週: 続けていた週のうち、できた週（途中で終えた週は、できていれば数える）', () => {
    let h = newHabit(empty(), { title: 'ジム', period: 'week' }, on(2))
    h = toggleHabit(h, on(4)) // 11/2 の週
    h = toggleHabit(h, on(17)) // 11/16 の週（11/9 の週はできなかった）
    const ended = { ...h, endedAt: on(18).toISOString(), endedAs: 'graduated' as const }
    expect(habitRecord(ended, on(20))).toMatchObject({ done: 2, total: 3 })
    const notYet = { ...newHabit(empty(), { title: 'ジム', period: 'week' }, on(2)), history: ['2026-11-04'], endedAt: on(18).toISOString(), endedAs: 'paused' as const }
    expect(habitRecord(notYet, on(20))).toMatchObject({ done: 1, total: 2 })
  })

  it('休んでいた間は数えない', () => {
    const h = daily(1, [1, 2, 10, 11])
    let d = applyChanges(withHabit(h), endHabit(withHabit(h), h, 'paused', '', on(5)))
    d = applyChanges(d, resumeHabit(d, d.habits[0], on(10)))
    // 11/1〜11/4 の 4 日と、11/10・11/11 の 2 日（11/12 の今日は、まだなので数えない）
    expect(habitRecord(d.habits[0], on(12))).toMatchObject({ done: 4, total: 6 })
  })
})
