import { childProjects, moveHabitToProject, reorderHabits, topProjects, type Changes, type HabitView, type PlannerData, type Project } from '../core'
import { projectCards, projectsInReadingOrder } from '../projects/projectCards'
import { projectLabel } from '../ui/Rows'

/** 同じプロジェクトの習慣をまとめた 1 行 */
export interface HabitGroup {
  project: Project
  /** 「ヨガ」「ヨガ・筋トレ」（テーマの中のプロジェクトは、テーマ・プロジェクト） */
  label: string
  views: HabitView[]
  /** チェックの残り */
  left: number
}

/**
 * 列の習慣を、プロジェクトごとにまとめる（時間軸でたたんで出すため）。
 * - 同じ列に、同じプロジェクトの習慣が min 個以上あるときだけまとめる（1 つだけなら、たたんでも行は減らない）
 * - 毎月の「その日」で出ているもの（auto）は、まとめない
 * - single: まとめないもの（今までの順のまま）／groups: プロジェクトの画面の並び（左上から右へ。テーマの中のものはテーマのすぐ後ろ）
 */
export function groupHabits(views: HabitView[], data: PlannerData, min = 2): { single: HabitView[]; groups: HabitGroup[] } {
  const counts = new Map<string, number>()
  for (const v of views) if (!v.auto && v.habit.projectId) counts.set(v.habit.projectId, (counts.get(v.habit.projectId) ?? 0) + 1)
  const grouped = (v: HabitView) => !v.auto && !!v.habit.projectId && (counts.get(v.habit.projectId) ?? 0) >= min
  const order = projectsInReadingOrder(projectCards(data, topProjects(data))).flatMap((p) => [p, ...childProjects(data, p.id)])
  const groups = order
    .map((project) => {
      const mine = views.filter((v) => grouped(v) && v.habit.projectId === project.id)
      return { project, label: projectLabel(data, project), views: mine, left: mine.filter((v) => !v.checked).length }
    })
    .filter((g) => g.views.length > 0)
  return { single: views.filter((v) => !grouped(v)), groups }
}

/** まとまりの見出し（▸ ● ヨガ）を、ドラッグの落とし先にするときの id（習慣の id とぶつからないように頭に付ける） */
export const GROUP_DROP = 'habit-group:'

/**
 * 時間軸の習慣を、ドラッグで落としたときの変更（ids は、いま並んでいる順）。
 * - まとまりの見出しへ: そのプロジェクトへ移す（閉じているまとまりにも入れられる）
 * - ほかのまとまりの中の行へ: そのプロジェクトへ移し、その位置へ
 * - まとまりの中から、まとまりの外の行へ: プロジェクトから外し、その位置へ
 * - それ以外（同じまとまりの中どうし・まとまりの外どうし）: 並べ替えだけ（プロジェクトは変えない）
 */
export function habitDropChanges(
  data: PlannerData,
  ids: string[],
  groups: HabitGroup[],
  activeId: string,
  overId: string,
  now: Date,
): Changes {
  if (overId.startsWith(GROUP_DROP)) return moveHabitToProject(data, ids, activeId, overId.slice(GROUP_DROP.length), undefined, now)
  const groupOf = (id: string) => groups.find((g) => g.views.some((v) => v.habit.id === id))?.project.id
  const from = groupOf(activeId)
  const to = groupOf(overId)
  if (from === to) return reorderHabits(data, ids, activeId, overId, now)
  return moveHabitToProject(data, ids, activeId, to, overId, now)
}
