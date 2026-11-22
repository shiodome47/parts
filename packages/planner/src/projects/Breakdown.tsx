import { ChevronRight, CornerLeftUp } from 'lucide-react'
import { useEffect, useState } from 'react'
import { breakdownOf, goalBreakdown, linkableProjects, linkGoal, splitGoal } from '../core'
import type { PlannerData, Project, Task } from '../core'
import type { PlannerStore } from '../ui/types'
import { Dialog } from '../ui/Dialog'
import { projectLabel } from '../ui/Rows'
import { scrollToElement } from '../ui/JumpBar'

type Apply = (c: Parameters<PlannerStore['apply']>[0]) => void

/**
 * 目標を細かく分ける（目標と、その「中身」のプロジェクトをつなぐ）。
 * - 目標の行: 中身の進み具合（「中身 1/7 ›」）。押すと中身のプロジェクトへ
 * - 中身のプロジェクト: どの目標の中身か（「↰ TOEICお受験の「ALL IN ONE 完了」の中身」）。押すと目標のプロジェクトへ
 */

/** プロジェクトのカード（テーマの中のものも）へ移り、少しのあいだ枠を光らせる */
export function jumpToProject(id: string) {
  const el = document.querySelector<HTMLElement>(`[data-project="${CSS.escape(id)}"]`)
  if (!el) return
  scrollToElement(el)
  el.classList.remove('pl-flash')
  void el.offsetWidth // アニメーションを、はじめからにする
  el.classList.add('pl-flash')
  setTimeout(() => el.classList.remove('pl-flash'), 1600)
}

/** 目標の行に出す、中身の進み具合（中身が無ければ何も出さない） */
export function BreakdownChip({ goal, data }: { goal: Task; data: PlannerData }) {
  const inner = goalBreakdown(data, goal)
  if (!inner) return null
  const full = inner.total > 0 && inner.done === inner.total
  return (
    <button
      type="button"
      className={`pl-breakdown${full ? ' pl-breakdown-full' : ''}`}
      title={`中身「${inner.project.name}」へ移動（${inner.total} のうち ${inner.done} できた）`}
      aria-label={`中身「${inner.project.name}」${inner.done}/${inner.total}。押すと移動`}
      onClick={() => jumpToProject(inner.project.id)}
    >
      中身 {inner.done}/{inner.total}
      <ChevronRight aria-hidden="true" />
    </button>
  )
}

/** 中身のプロジェクトの見出しの下に出す、どの目標の中身か（目標が無ければ何も出さない） */
export function BreakdownOf({ project, data }: { project: Project; data: PlannerData }) {
  const of = breakdownOf(data, project)
  if (!of) return null
  return (
    <button
      type="button"
      className="pl-breakdown-of"
      title={`「${of.project.name}」へ移動`}
      onClick={() => jumpToProject(of.project.id)}
    >
      <CornerLeftUp aria-hidden="true" />
      <span>
        「{of.project.name}」の目標「{of.goal.title}」の中身{of.goal.doneAt ? '（目標は終えた）' : ''}
      </span>
    </button>
  )
}

/**
 * 「細かく分ける」の小窓。中身のプロジェクトを新しく作るか、今あるプロジェクトをつなぐ
 */
export function SplitGoalDialog({ goal, data, apply, onClose }: { goal: Task; data: PlannerData; apply: Apply; onClose: () => void }) {
  const [name, setName] = useState(goal.title)
  const [linkId, setLinkId] = useState('')
  useEffect(() => {
    setName(goal.title)
    setLinkId('')
  }, [goal.id, goal.title])
  const owner = data.projects.find((p) => p.id === goal.projectId)
  // 同じテーマの中のものを先に
  const theme = owner?.parentId ?? owner?.id
  const linkable = linkableProjects(data, goal).sort(
    (a, b) => Number(b.parentId === theme) - Number(a.parentId === theme) || a.order - b.order,
  )
  return (
    <Dialog open onClose={onClose} title={`「${goal.title}」を細かく分ける`}>
      <form
        className="pl-stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (!name.trim()) return
          apply(splitGoal(data, goal, name.trim(), new Date()))
          onClose()
        }}
      >
        <p className="pl-note">
          この目標の中身になるプロジェクトを作ります。細かいステップは、そちらに足していきます。目標の行には、中身の進み具合（1/7 など）が出ます。
        </p>
        <input
          className="pl-input"
          value={name}
          maxLength={200}
          aria-label="中身のプロジェクトの名前"
          placeholder="中身のプロジェクトの名前"
          onChange={(e) => setName(e.target.value)}
        />
        <div className="pl-row pl-row-end">
          <button type="submit" className="pl-button pl-button-primary" disabled={!name.trim()}>
            作る
          </button>
        </div>
      </form>
      {linkable.length > 0 && (
        <form
          className="pl-stack pl-split-link"
          onSubmit={(e) => {
            e.preventDefault()
            const project = linkable.find((p) => p.id === linkId)
            if (!project) return
            apply(linkGoal(data, goal, project, new Date()))
            onClose()
          }}
        >
          <p className="pl-note">もう作ってあるプロジェクトを、中身にすることもできます。</p>
          <select className="pl-select" value={linkId} aria-label="中身にするプロジェクト" onChange={(e) => setLinkId(e.target.value)}>
            <option value="">プロジェクトを選ぶ…</option>
            {linkable.map((p) => (
              <option key={p.id} value={p.id}>
                {projectLabel(data, p)}
              </option>
            ))}
          </select>
          <div className="pl-row pl-row-end">
            <button type="button" className="pl-button" onClick={onClose}>
              やめる
            </button>
            <button type="submit" className="pl-button pl-button-primary" disabled={!linkId}>
              つなぐ
            </button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
