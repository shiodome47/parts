import { describe, expect, it } from 'vitest'
import { applyChanges, breakdownOf, childProjects, goalBreakdown, linkableProjects, linkGoal, newProject, newTask, removeProject, removeTask, splitGoal, toggleDone, unlinkGoal } from '../logic'
import type { PlannerData, Project, Task } from '../types'

const NOW = new Date(2026, 10, 22, 9, 0)
const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })

/** テーマ「英語」の中に「TOEICお受験」と「金の文法」。TOEICお受験に目標「ALL IN ONE 完了」 */
function setup() {
  let d = empty()
  const eng = newProject(d, { name: '英語', color: 'blue' }, NOW)
  d = applyChanges(d, { projects: [eng] })
  const toeic = newProject(d, { name: 'TOEICお受験', color: 'blue', parentId: eng.id }, NOW)
  d = applyChanges(d, { projects: [toeic] })
  const bunpo = newProject(d, { name: '金の文法', color: 'blue', parentId: eng.id }, NOW)
  d = applyChanges(d, { projects: [bunpo] })
  const goal = newTask(d, { title: 'ALL IN ONE 完了', horizon: 'pool', priority: 'C', projectId: toeic.id, due: '2026-11-30' }, NOW)
  d = applyChanges(d, { tasks: [goal] })
  return { d, eng, toeic, bunpo, goal }
}

const byName = (d: PlannerData, name: string) => d.projects.find((p) => p.name === name)!
const addGoal = (d: PlannerData, project: Project, title: string): PlannerData =>
  applyChanges(d, { tasks: [newTask(d, { title, horizon: 'pool', priority: 'C', projectId: project.id }, NOW)] })

describe('目標を細かく分ける（中身のプロジェクト）', () => {
  it('同じテーマの中、目標のプロジェクトのすぐ後ろに、中身のプロジェクトを作る', () => {
    const { d, eng, goal } = setup()
    const next = applyChanges(d, splitGoal(d, goal, 'ALL IN ONE 完遂', NOW))
    expect(childProjects(next, eng.id).map((p) => p.name)).toEqual(['TOEICお受験', 'ALL IN ONE 完遂', '金の文法'])
    const inner = byName(next, 'ALL IN ONE 完遂')
    expect(inner.goalId).toBe(goal.id)
    expect(inner.color).toBe('blue')
  })

  it('目標のプロジェクトがいちばん上のカードなら、その中に作る（入れ子は 1 段のまま）', () => {
    let d = empty()
    const top = newProject(d, { name: 'TOEIC', color: 'teal' }, NOW)
    d = applyChanges(d, { projects: [top] })
    const goal = newTask(d, { title: '受験', horizon: 'pool', priority: 'C', projectId: top.id }, NOW)
    d = applyChanges(d, { tasks: [goal] })
    d = applyChanges(d, splitGoal(d, goal, '受験の準備', NOW))
    expect(childProjects(d, top.id).map((p) => p.name)).toEqual(['受験の準備'])
  })

  it('中身の進み具合（終えた数／全部）と、中身から見た目標', () => {
    const { d: d0, goal, toeic } = setup()
    let d = applyChanges(d0, splitGoal(d0, goal, 'ALL IN ONE 完遂', NOW))
    const inner = byName(d, 'ALL IN ONE 完遂')
    d = addGoal(d, inner, 'リーディング10回')
    d = addGoal(d, inner, 'リーディング20回')
    d = addGoal(d, inner, 'リーディング30回')
    const first = d.tasks.find((t) => t.title === 'リーディング10回')!
    d = applyChanges(d, toggleDone(d, first, NOW))
    expect(goalBreakdown(d, goal)).toMatchObject({ project: { id: inner.id }, done: 1, total: 3 })
    expect(breakdownOf(d, inner)).toMatchObject({ goal: { id: goal.id }, project: { id: toeic.id } })
  })

  it('中身はひとつだけ（もうあれば、作らない）', () => {
    const { d: d0, goal } = setup()
    const d = applyChanges(d0, splitGoal(d0, goal, '中身', NOW))
    expect(splitGoal(d, goal, 'もう 1 つ', NOW)).toEqual({})
  })
})

describe('今あるプロジェクトをつなぐ・外す', () => {
  it('つなげるのは、目標のプロジェクト・そのテーマ・もう中身のもの以外', () => {
    const { d, goal } = setup()
    expect(linkableProjects(d, goal).map((p) => p.name)).toEqual(['金の文法'])
  })

  it('つなぐと、前の中身のつなぎは外れる。外すと、プロジェクトも目標も残る', () => {
    const { d: d0, goal, bunpo } = setup()
    let d = applyChanges(d0, splitGoal(d0, goal, 'ALL IN ONE 完遂', NOW))
    d = applyChanges(d, linkGoal(d, goal, bunpo, NOW))
    expect(goalBreakdown(d, goal)?.project.id).toBe(bunpo.id)
    expect(byName(d, 'ALL IN ONE 完遂').goalId).toBeUndefined()
    d = applyChanges(d, unlinkGoal(byName(d, '金の文法'), NOW))
    expect(goalBreakdown(d, goal)).toBeUndefined()
    expect(d.projects).toHaveLength(4)
    expect(d.tasks.map((t: Task) => t.title)).toEqual(['ALL IN ONE 完了'])
  })

  it('目標を消すと、中身のプロジェクトはつなぎだけ外れて残る', () => {
    const { d: d0, goal } = setup()
    let d = applyChanges(d0, splitGoal(d0, goal, 'ALL IN ONE 完遂', NOW))
    d = applyChanges(d, removeTask(d, goal, NOW))
    expect(byName(d, 'ALL IN ONE 完遂').goalId).toBeUndefined()
  })

  it('目標のプロジェクトを消しても、中身のプロジェクトはつなぎだけ外れて残る', () => {
    const { d: d0, goal, toeic } = setup()
    let d = applyChanges(d0, splitGoal(d0, goal, 'ALL IN ONE 完遂', NOW))
    d = applyChanges(d, removeProject(d, toeic, NOW))
    expect(byName(d, 'ALL IN ONE 完遂').goalId).toBeUndefined()
    expect(d.projects.map((p) => p.name)).toEqual(['英語', '金の文法', 'ALL IN ONE 完遂'])
  })
})
