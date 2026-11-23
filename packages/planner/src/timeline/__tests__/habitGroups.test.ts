import { describe, expect, it } from 'vitest'
import { applyChanges, buildColumns, newHabit, newProject, toggleHabit, withDay, type PlannerData } from '../../core'
import { groupHabits } from '../habitGroups'

const MON = new Date(2026, 10, 23, 9, 0)

/** ヨガ（3 つ）とその中の筋トレ（2 つ）、そろばん（1 つ）、プロジェクトの無い習慣 */
function sample(): PlannerData {
  let d: PlannerData = { tasks: [], habits: [], projects: [] }
  const soroban = newProject(d, { name: 'そろばん', color: 'pink' }, MON)
  d = applyChanges(d, { projects: [soroban] })
  const yoga = { ...newProject(d, { name: 'ヨガ', color: 'yellow' }, MON), order: -1 }
  d = applyChanges(d, { projects: [yoga] })
  const kintore = newProject(d, { name: '筋トレ', color: 'yellow', parentId: yoga.id }, MON)
  d = applyChanges(d, { projects: [kintore] })
  const add = (title: string, projectId?: string) => {
    d = applyChanges(d, { habits: [newHabit(d, { title, period: 'day', projectId }, MON)] })
  }
  add('朝ルーチン')
  add('瞑想30分', yoga.id)
  add('スクワット10', kintore.id)
  add('トラータカ1分', yoga.id)
  add('3桁暗算', soroban.id)
  add('TABATA', kintore.id)
  add('ムドラー', yoga.id)
  add('23時までに寝る')
  return d
}
const today = (d: PlannerData) => buildColumns(d, MON).find((c) => c.horizon === 'today')!.habits

describe('時間軸: プロジェクトの習慣をまとめる', () => {
  it('2 つ以上あるプロジェクトだけまとめる。並びはプロジェクトの画面の順（テーマの中のものはすぐ後ろ）', () => {
    const d = sample()
    const { single, groups } = groupHabits(today(d), d)
    expect(single.map((v) => v.habit.title)).toEqual(['朝ルーチン', '3桁暗算', '23時までに寝る'])
    expect(groups.map((g) => [g.label, g.views.map((v) => v.habit.title)])).toEqual([
      ['ヨガ', ['瞑想30分', 'トラータカ1分', 'ムドラー']],
      ['ヨガ・筋トレ', ['スクワット10', 'TABATA']],
    ])
  })

  it('まとまりの「あと」は、チェックの残り', () => {
    let d = sample()
    const h = d.habits.find((x) => x.title === '瞑想30分')!
    d = applyChanges(d, { habits: [toggleHabit(h, MON)] })
    const { groups } = groupHabits(today(d), d)
    expect(groups.map((g) => g.left)).toEqual([2, 2])
  })

  it('毎月の「その日」で出ているものは、まとめない', () => {
    let d = sample()
    const yoga = d.projects.find((p) => p.name === 'そろばん')!
    d = applyChanges(d, { habits: [withDay(newHabit(d, { title: '月例テスト', period: 'month', projectId: yoga.id }, MON), 20)] })
    const { single, groups } = groupHabits(today(d), d)
    expect(single.map((v) => v.habit.title)).toContain('月例テスト')
    expect(groups.some((g) => g.label === 'そろばん')).toBe(false)
  })
})
