import { describe, expect, it } from 'vitest'
import { applyChanges, newHabit, newProject, reorderRoutine } from '../logic'
import type { PlannerData } from '../types'

const NOW = new Date(2026, 10, 23, 9, 0)

/** 毎日の習慣: 朝ルーチン（プロジェクト無し）・瞑想・トラータカ・ムドラー（ヨガ）・23時（無し）、毎週: 掃除（ヨガ） */
function sample(): PlannerData {
  let d: PlannerData = { tasks: [], habits: [], projects: [] }
  const yoga = newProject(d, { name: 'ヨガ', color: 'yellow' }, NOW)
  d = applyChanges(d, { projects: [yoga] })
  const add = (title: string, period: 'day' | 'week', projectId?: string) => {
    d = applyChanges(d, { habits: [newHabit(d, { title, period, projectId }, NOW)] })
  }
  add('朝ルーチン', 'day')
  add('瞑想', 'day', yoga.id)
  add('トラータカ', 'day', yoga.id)
  add('ムドラー', 'day', yoga.id)
  add('23時までに寝る', 'day')
  add('掃除', 'week', yoga.id)
  return d
}
const id = (d: PlannerData, title: string) => d.habits.find((h) => h.title === title)!.id
const dayOrder = (d: PlannerData) =>
  d.habits.filter((h) => h.period === 'day').sort((a, b) => a.order - b.order).map((h) => h.title)

describe('プロジェクトのルーチン目標をドラッグで並べ替える', () => {
  it('落とした先の位置へ動く。ほかのプロジェクトの習慣との前後はそのまま', () => {
    let d = sample()
    d = applyChanges(d, reorderRoutine(d, id(d, 'ムドラー'), id(d, '瞑想'), NOW))
    expect(dayOrder(d)).toEqual(['朝ルーチン', 'ムドラー', '瞑想', 'トラータカ', '23時までに寝る'])
    d = applyChanges(d, reorderRoutine(d, id(d, 'ムドラー'), id(d, 'トラータカ'), NOW))
    expect(dayOrder(d)).toEqual(['朝ルーチン', '瞑想', 'トラータカ', 'ムドラー', '23時までに寝る'])
  })

  it('くり返しのちがうもの（毎日と毎週）の間では動かさない', () => {
    const d = sample()
    expect(reorderRoutine(d, id(d, '掃除'), id(d, '瞑想'), NOW)).toEqual({})
  })
})
