import { useRef } from 'react'
import { HORIZON_NAME } from '../core'
import { goalDueNextWeek, horizonForDue } from '../core'
import { CalendarPlus } from 'lucide-react'
import { daysUntil, dueLabelWeekday, shortDueLabel } from '../core'

/**
 * 日付のしるし（押すとカレンダーで日付を選べる）。
 * - goal: プロジェクトの期日目標（名前の左。日付が無ければ点線の「期日」）
 * - inline: 時間軸のやること（名前の右の小さな「11/24（火）」。日付が無ければ何も出さない）
 * どちらも、時間軸のどの列に出るかは、この日付から自動で決まる。
 * opener を渡すと、… のメニューなど外からカレンダーを開ける。
 */
export function DueChip({
  due,
  now,
  done,
  label,
  onChange,
  variant = 'goal',
  opener,
}: {
  due?: string
  now: Date
  done: boolean
  label: string
  onChange: (value: string) => void
  variant?: 'goal' | 'inline'
  opener?: (open: () => void) => void
}) {
  const ref = useRef<HTMLInputElement>(null)
  const open = () => {
    const input = ref.current
    if (!input) return
    // 日付を選ぶ画面を開く（使えないブラウザでは、入力欄にフォーカスする）
    try {
      input.showPicker()
    } catch {
      input.focus()
    }
  }
  opener?.(open)
  const days = due ? daysUntil(due, now) : null
  const where = due ? (goalDueNextWeek(due, now) ? '来週' : days === 1 ? '明日' : HORIZON_NAME[horizonForDue(due, now)]) : undefined
  const title = due
    ? `${dueLabelWeekday(due, now)} ${days === null || done ? '' : days > 0 ? `あと ${days} 日` : days === 0 ? '今日' : `${-days} 日過ぎ`}（時間軸の「${where}」に出ます）`
    : variant === 'goal'
      ? '期日を決めると、時間軸に出ます'
      : undefined
  const soon = days !== null && days <= (variant === 'inline' ? 0 : 7) && !done
  const hidden = variant === 'inline' && !due
  return (
    <span
      className={`pl-due${variant === 'inline' ? ' pl-due-inline' : ''}${due ? '' : ' pl-due-empty'}${soon ? ' pl-due-soon' : ''}${hidden ? ' pl-due-hidden' : ''}`}
      title={title}
    >
      {!hidden && (
        <button type="button" className="pl-due-button" aria-label={`${label}${due ? `（${due}）` : '（未定）'}を変える`} onClick={open}>
          {due ? (variant === 'inline' ? dueLabelWeekday(due, now) : shortDueLabel(due, now)) : <CalendarPlus aria-hidden="true" />}
        </button>
      )}
      <input
        ref={ref}
        type="date"
        className="pl-due-input"
        value={due ?? ''}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => onChange(e.target.value)}
      />
    </span>
  )
}
