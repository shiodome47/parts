import { flattenCards, type CardLike, type CardPlace } from 'linkshelf'
import { childProjects, isProjectGoal } from '../core'
import type { PlannerData, Project } from '../core'

/**
 * プロジェクトの画面のカードの並び（何列目の何番目か）。
 * 並べ方とドラッグは、linkshelf の <CardBoard>（棚と同じ）が受け持つ。ここはプロジェクトとカードの橋渡しだけ。
 * - ドラッグで置いたカードは、その列（column）と列の中の順番（order）を覚え、画面の列が足りていればそのとおりに並べる
 * - まだ置いていないカードや、画面が狭くて列が足りないとき（スマホ）は、左上から右へ読む順に、いちばん短い列から詰める
 */

export interface ProjectCardItem extends CardLike {
  project: Project
}

/** カードの大きさの目安（中の行の数。中のプロジェクトは、見出しの分も足す） */
export function cardSize(data: PlannerData, project: Project): number {
  const own = (p: Project) =>
    data.tasks.filter((t) => isProjectGoal(t) && t.projectId === p.id).length + data.habits.filter((h) => h.projectId === p.id).length
  return own(project) + childProjects(data, project.id).reduce((n, c) => n + 3 + own(c), 0)
}

export function projectCards(data: PlannerData, projects: Project[]): ProjectCardItem[] {
  return projects.map((project) => ({ id: project.id, order: project.order, column: project.column, size: cardSize(data, project), project }))
}

/** 左上から右へ、上の段から読む順（上の帯の並び） */
export function projectsInReadingOrder(cards: ProjectCardItem[]): Project[] {
  return flattenCards(cards).map((c) => c.project)
}

/** カードを動かしたあと（<CardBoard> の onMove）の、列か順番が変わったプロジェクト */
export function changedProjects(cards: ProjectCardItem[], places: CardPlace[], now: Date): Project[] {
  const byId = new Map(cards.map((c) => [c.id, c.project]))
  const t = now.toISOString()
  return places.flatMap((place) => {
    const p = byId.get(place.id)
    if (!p || (p.column === place.column && p.order === place.order)) return []
    // 列を覚えないとき（まだ一度も列に置いていない）は、列の欄ごと外す
    const { column: _column, ...rest } = p
    return [{ ...rest, order: place.order, ...(place.column !== undefined ? { column: place.column } : {}), updatedAt: t }]
  })
}
