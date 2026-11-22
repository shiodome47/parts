import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { addCount, countable, countedTask, setCount } from '../core'
import type { PlannerData, Task } from '../core'
import type { MenuItem } from './Menu'
import type { PlannerStore } from './types'
import { Dialog } from './Dialog'

type Apply = (c: Parameters<PlannerStore['apply']>[0]) => void

/**
 * 回数の目標（リーディング 30/100 回 など）。
 * - 行の名前の下に「30/100 回 ＋1」（＋1 で 1 回足す。足した日の記録が残る）
 * - … から「回数の目標にする…」「回数を変える…」「1 回へらす」
 * - めざす数に届くと終える
 * 下ろした先のコピーでは、元の回数を数える
 */

/** 行に出す回数と ＋1（回数の目標でなければ何も出さない） */
export function CountControl({ task, data, apply }: { task: Task; data: PlannerData; apply: Apply }) {
  const counted = countedTask(data, task)
  if (!counted?.count) return null
  const { done, target } = counted.count
  const finished = !!counted.doneAt
  const pct = Math.min(100, Math.round((done / target) * 100))
  return (
    <span className={`pl-count-control${finished ? ' pl-count-finished' : ''}`}>
      <span className="pl-count-value" style={{ '--pl-count-pct': `${pct}%` } as CSSProperties} title={`${target} 回のうち ${done} 回`}>
        {done}/{target} 回
      </span>
      {!finished && (
        <button
          type="button"
          className="pl-count-plus"
          aria-label={`「${counted.title}」を 1 回足す（今 ${done}/${target} 回）`}
          onClick={() => apply(addCount(data, counted, 1, new Date()))}
        >
          ＋1
        </button>
      )}
    </span>
  )
}

/** … に足す、回数のメニューと、その小窓 */
export function useCountMenu(task: Task, data: PlannerData, apply: Apply): { items: MenuItem[]; dialog: ReactNode } {
  const [editing, setEditing] = useState(false)
  const counted = countedTask(data, task)
  const items: MenuItem[] = []
  if (counted?.count) {
    if (counted.id === task.id) items.push({ label: '回数を変える…', onSelect: () => setEditing(true) })
    if (!counted.doneAt && counted.count.done > 0) items.push({ label: '1 回へらす', onSelect: () => apply(addCount(data, counted, -1, new Date())) })
  } else if (countable(task)) {
    items.push({ label: '回数の目標にする…', onSelect: () => setEditing(true) })
  }
  const dialog = editing ? (
    <CountDialog
      task={task}
      onClose={() => setEditing(false)}
      onSave={(input) => {
        setEditing(false)
        apply(setCount(data, task, input, new Date()))
      }}
    />
  ) : null
  return { items, dialog }
}

/** 回数の目標にする・変える小窓（めざす回数・今の回数）。回数の目標をやめることもできる */
export function CountDialog({
  task,
  onClose,
  onSave,
}: {
  task: Task
  onClose: () => void
  onSave: (input: { target: number; done: number } | undefined) => void
}) {
  const [target, setTarget] = useState(String(task.count?.target ?? ''))
  const [done, setDone] = useState(String(task.count?.done ?? 0))
  useEffect(() => {
    setTarget(String(task.count?.target ?? ''))
    setDone(String(task.count?.done ?? 0))
  }, [task.id, task.count?.target, task.count?.done])
  const t = Number(target)
  const d = Number(done)
  const valid = Number.isFinite(t) && t >= 1 && Number.isFinite(d) && d >= 0
  const editing = !!task.count
  return (
    <Dialog open onClose={onClose} title={editing ? `「${task.title}」の回数を変える` : `「${task.title}」を回数の目標にする`}>
      <form
        className="pl-stack"
        onSubmit={(e) => {
          e.preventDefault()
          if (valid) onSave({ target: t, done: d })
        }}
      >
        <p className="pl-note">
          行に「{Number.isFinite(d) ? d : 0}/{t >= 1 ? t : '◯'} 回」と ＋1 が出ます。足した日は振り返りに残り、めざす回数に届くと終えたことになります。
        </p>
        <div className="pl-count-fields">
          <label className="pl-count-field">
            <span>めざす回数</span>
            <input className="pl-input" type="number" inputMode="numeric" min={1} step={1} value={target} autoFocus onChange={(e) => setTarget(e.target.value)} />
          </label>
          <label className="pl-count-field">
            <span>今の回数</span>
            <input className="pl-input" type="number" inputMode="numeric" min={0} step={1} value={done} onChange={(e) => setDone(e.target.value)} />
          </label>
        </div>
        <div className="pl-row pl-row-end">
          {editing && (
            <button type="button" className="pl-button pl-button-danger pl-count-stop" onClick={() => onSave(undefined)}>
              回数の目標をやめる
            </button>
          )}
          <button type="button" className="pl-button" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="pl-button pl-button-primary" disabled={!valid}>
            決める
          </button>
        </div>
      </form>
    </Dialog>
  )
}
