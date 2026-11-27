import { describe, expect, it } from 'vitest'
import { applyChanges, buildColumns, moveHabitToProject, newHabit, newProject, placeHabitDown, type PlannerData } from '../../core'
import { GROUP_DROP, groupHabits, habitDropChanges } from '../habitGroups'

const NOW = new Date(2026, 10, 27, 9, 0)

/**
 * 今日の列の習慣: 朝ルーチン・レシート記入（プロジェクト無し）、3桁暗算（そろばん。1 つだけなので、まとめない）、
 * 「習慣」プロジェクトの朝ルーチン++・明日の食事（2 つなので、まとまりになる）
 */
function sample() {
  let d: PlannerData = { tasks: [], habits: [], projects: [] }
  const life = newProject(d, { name: '習慣', color: 'purple' }, NOW)
  d = applyChanges(d, { projects: [life] })
  const soro = newProject(d, { name: 'そろばん', color: 'pink' }, NOW)
  d = applyChanges(d, { projects: [soro] })
  const add = (title: string, projectId?: string) => {
    d = applyChanges(d, { habits: [newHabit(d, { title, period: 'day', projectId }, NOW)] })
  }
  add('朝ルーチン')
  add('レシート記入')
  add('3桁暗算', soro.id)
  add('朝ルーチン++', life.id)
  add('明日の食事', life.id)
  const id = (title: string) => d.habits.find((h) => h.title === title)!.id
  return { d, life, soro, id }
}

/** 時間軸の今日の列の、画面の並び（まとまりは開いているものとして） */
function today(d: PlannerData) {
  const col = buildColumns(d, NOW).find((c) => c.horizon === 'today')!
  const { single, groups } = groupHabits(col.habits, d)
  const ids = [...single, ...groups.flatMap((g) => g.views)].map((v) => v.habit.id)
  return { single, groups, ids }
}

const titlesIn = (d: PlannerData, projectId: string) => d.habits.filter((h) => h.projectId === projectId).map((h) => h.title).sort()

describe('習慣を、ドラッグでプロジェクトのまとまりへ移す', () => {
  it('まとまりの見出しへ落とすと、そのプロジェクトへ移る（閉じていても）', () => {
    const { d, life, id } = sample()
    const { groups, ids } = today(d)
    const next = applyChanges(d, habitDropChanges(d, ids, groups, id('レシート記入'), GROUP_DROP + life.id, NOW))
    expect(titlesIn(next, life.id)).toEqual(['レシート記入', '明日の食事', '朝ルーチン++'].sort())
    expect(today(next).groups[0].views.map((v) => v.habit.title)).toContain('レシート記入')
  })

  it('開いたまとまりの中の行へ落とすと、そのプロジェクトへ移り、その位置に並ぶ', () => {
    const { d, life, id } = sample()
    const { groups, ids } = today(d)
    const next = applyChanges(d, habitDropChanges(d, ids, groups, id('レシート記入'), id('明日の食事'), NOW))
    expect(titlesIn(next, life.id)).toContain('レシート記入')
    expect(today(next).groups[0].views.map((v) => v.habit.title)).toEqual(['朝ルーチン++', '明日の食事', 'レシート記入'])
  })

  it('まとまりの中から外の行へ落とすと、プロジェクトから外れる', () => {
    const { d, life, id } = sample()
    const { groups, ids } = today(d)
    const next = applyChanges(d, habitDropChanges(d, ids, groups, id('明日の食事'), id('朝ルーチン'), NOW))
    expect(next.habits.find((h) => h.title === '明日の食事')!.projectId).toBeUndefined()
    expect(titlesIn(next, life.id)).toEqual(['朝ルーチン++'])
    // 1 つになったので、まとまりは無くなる
    expect(today(next).groups).toHaveLength(0)
  })

  it('まとまりの外どうし・同じまとまりの中どうしは、並べ替えだけ（プロジェクトは変えない）', () => {
    const { d, soro, life, id } = sample()
    const { groups, ids } = today(d)
    // 3桁暗算（そろばん）を、プロジェクト無しの朝ルーチンの上へ
    const a = applyChanges(d, habitDropChanges(d, ids, groups, id('3桁暗算'), id('朝ルーチン'), NOW))
    expect(a.habits.find((h) => h.title === '3桁暗算')!.projectId).toBe(soro.id)
    expect(today(a).single.map((v) => v.habit.title)).toEqual(['3桁暗算', '朝ルーチン', 'レシート記入'])
    const b = applyChanges(d, habitDropChanges(d, ids, groups, id('明日の食事'), id('朝ルーチン++'), NOW))
    expect(titlesIn(b, life.id)).toEqual(['明日の食事', '朝ルーチン++'].sort())
    expect(today(b).groups[0].views.map((v) => v.habit.title)).toEqual(['明日の食事', '朝ルーチン++'])
  })

  it('自分のまとまりの見出しへ落としても、何も変わらない', () => {
    const { d, life, id } = sample()
    const { groups, ids } = today(d)
    expect(habitDropChanges(d, ids, groups, id('明日の食事'), GROUP_DROP + life.id, NOW)).toEqual({})
  })
})

describe('moveHabitToProject', () => {
  it('今日に下ろしたまだのやること（コピー）のプロジェクトも、そろえる', () => {
    const { d, life, id } = sample()
    const receipt = d.habits.find((h) => h.id === id('レシート記入'))!
    const placed = applyChanges(d, placeHabitDown(d, receipt, 'today', NOW))
    const next = applyChanges(placed, moveHabitToProject(placed, [], receipt.id, life.id, undefined, NOW))
    expect(next.tasks.find((t) => t.habitId === receipt.id)!.projectId).toBe(life.id)
    // 外すと、コピーも外れる
    const out = applyChanges(next, moveHabitToProject(next, [], receipt.id, undefined, undefined, NOW))
    expect(out.tasks.find((t) => t.habitId === receipt.id)!.projectId).toBeUndefined()
    expect(out.habits.find((h) => h.id === receipt.id)!.projectId).toBeUndefined()
  })

  it('無いプロジェクト・無い習慣には何もしない', () => {
    const { d, id } = sample()
    expect(moveHabitToProject(d, [], id('レシート記入'), 'nope', undefined, NOW)).toEqual({})
    expect(moveHabitToProject(d, [], 'nope', undefined, undefined, NOW)).toEqual({})
  })
})
