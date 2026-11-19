import { describe, expect, it } from 'vitest'
import { layoutCards, moveCard, type CardDrop } from 'linkshelf'
import { cardSize, changedProjects, projectCards, projectsInReadingOrder, type ProjectCardItem } from '../projectCards'
import { applyChanges, newTask } from '../../core'
import type { PlannerData, Project } from '../../core'

const NOW = new Date('2026-11-19T09:00:00Z')

const P = (id: string, order: number, column?: number, parentId?: string): Project => ({
  id,
  name: id,
  color: 'teal',
  order,
  ...(column !== undefined ? { column } : {}),
  ...(parentId ? { parentId } : {}),
  createdAt: 't',
  updatedAt: 't',
})

/** プロジェクトに、期日目標を n 個入れたデータ */
function withGoals(projects: Project[], goals: Record<string, number> = {}): PlannerData {
  let d: PlannerData = { tasks: [], habits: [], projects }
  for (const [projectId, n] of Object.entries(goals))
    for (let i = 0; i < n; i++) d = applyChanges(d, { tasks: [newTask(d, { title: `${projectId}${i}`, horizon: 'pool', priority: 'C', projectId }, NOW)] })
  return d
}

const ids = (cols: Project[][]) => cols.map((c) => c.map((p) => p.id))
/** 画面の並び（<CardBoard> と同じ layoutCards） */
const layoutProjects = (cards: ProjectCardItem[], n: number) => layoutCards(cards, n).map((col) => col.map((c) => c.project))
/** カードを動かしたとき（<CardBoard> が moveCard で求めた並びを onMove に渡す） */
const moveProjectCard = (cards: ProjectCardItem[], n: number, id: string, drop: CardDrop, now: Date) =>
  changedProjects(cards, moveCard(cards, n, id, drop), now)
const cardsOf = (d: PlannerData) => projectCards(d, d.projects.filter((p) => !p.parentId))

describe('プロジェクトのカードの並び（linkshelf の <CardBoard> と同じ決まり）', () => {
  it('大きさの目安: 中の目標の数。中のプロジェクトは見出しの分も足す', () => {
    const d = withGoals([P('T', 0), P('c', 0, undefined, 'T')], { T: 2, c: 1 })
    expect(cardSize(d, d.projects[0])).toBe(2 + 3 + 1)
  })

  it('まだ置いていないカードは、順番どおりにいちばん短い列の下へ', () => {
    const d = withGoals([P('A', 0), P('B', 1), P('C', 2), P('D', 3)], { A: 8, B: 1, C: 1 })
    expect(ids(layoutProjects(cardsOf(d), 3))).toEqual([['A'], ['B', 'D'], ['C']])
  })

  it('これまでの保存の形（列と、左上から読む全体の順番）も、同じ並びになる', () => {
    // 以前は [['A','B'],['C']] を A:0・C:1・B:2 のように覚えていた
    const d = withGoals([P('A', 0, 0), P('C', 1, 1), P('B', 2, 0)])
    expect(ids(layoutProjects(cardsOf(d), 2))).toEqual([['A', 'B'], ['C']])
    expect(projectsInReadingOrder(cardsOf(d)).map((p) => p.id)).toEqual(['A', 'C', 'B'])
  })

  it('背の高いカードを、となりの列の短いカードの上へ置ける', () => {
    const d = withGoals([P('A', 0, 0), P('B', 1, 0), P('C', 0, 1), P('Y', 1, 1)], { A: 2, B: 2, C: 1, Y: 12 })
    const changed = moveProjectCard(cardsOf(d), 2, 'Y', { kind: 'card', id: 'C', position: 'before' }, NOW)
    const after = applyChanges(d, { projects: changed })
    expect(ids(layoutProjects(cardsOf(after), 2))).toEqual([['A', 'B'], ['Y', 'C']])
    // 変わったものだけを返す（A・B はそのまま）
    expect(changed.map((p) => p.id).sort()).toEqual(['C', 'Y'])
    expect(changed.every((p) => p.updatedAt === NOW.toISOString())).toBe(true)
  })

  it('列のいちばん下へ置ける', () => {
    const d = withGoals([P('A', 0, 0), P('B', 1, 0), P('C', 0, 1)])
    const after = applyChanges(d, { projects: moveProjectCard(cardsOf(d), 2, 'A', { kind: 'end', column: 1 }, NOW) })
    expect(ids(layoutProjects(cardsOf(after), 2))).toEqual([['B'], ['C', 'A']])
  })

  it('スマホ（1 列）で動かしても、PC で置いた列は崩さない', () => {
    const d = withGoals([P('A', 0, 0), P('B', 1, 0), P('C', 0, 1), P('D', 1, 1)])
    const after = applyChanges(d, { projects: moveProjectCard(cardsOf(d), 1, 'D', { kind: 'card', id: 'A', position: 'after' }, NOW) })
    expect(ids(layoutProjects(cardsOf(after), 2))).toEqual([['A', 'D', 'B'], ['C']])
  })

  it('まだ列に置いたことが無いまま 1 列で動かすと、順番だけを覚える（列の欄は付けない）', () => {
    const d = withGoals([P('A', 0), P('B', 1), P('C', 2)])
    const changed = moveProjectCard(cardsOf(d), 1, 'C', { kind: 'card', id: 'A', position: 'before' }, NOW)
    expect(changed.every((p) => !('column' in p))).toBe(true)
    const after = applyChanges(d, { projects: changed })
    expect(ids(layoutProjects(cardsOf(after), 1))).toEqual([['C', 'A', 'B']])
  })
})
