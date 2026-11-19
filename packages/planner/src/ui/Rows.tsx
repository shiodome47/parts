import { Check, CornerUpLeft, FileText } from 'lucide-react'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { dayKey, dueLabelWeekday, periodHorizon } from '../core'
import { HORIZON_NAME, PERIOD_NAME, PLACE_LABEL, PLACED_MARK, PRIORITY_NAME } from '../core'
import {
  habitPlaceTargets,
  habitToTask,
  placeDown,
  placeHabitDown,
  placeTargets,
  quickTarget,
  removeTask,
  returnUp,
  setDue,
  setPriority,
  toggleDone,
  toggleHabitAll,
  bringToToday,
  isForTomorrow,
  postponeToTomorrow,
  type HabitView,
  type TaskView,
} from '../core'
import { PRIORITIES, type BoardHorizon, type PlannerData, type Priority, type Project } from '../core'
import type { PlannerStore } from './types'
import { Menu, type MenuItem } from './Menu'
import { useDisplay } from './display'
import { useSortableRow } from './dnd'
import { DueChip } from './DueChip'
import { WhenSelect } from './WhenSelect'
import { isMonthOnly, whenLabel } from '../core'
import { NoteDialog, useClickOrDouble } from './NoteDialog'

/** やること 1 行（番号・丸いチェック・名前・下ろすボタン・…） */
export function TaskRow({
  view,
  data,
  store,
  now,
}: {
  view: TaskView
  data: PlannerData
  store: PlannerStore
  now: Date
}) {
  const { task, label, done, faded, placedTo, from, project } = view
  const { simple } = useDisplay()
  const [renaming, setRenaming] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const sortable = useSortableRow(task.id, renaming)
  /** 日付を決められるか（下ろした先のコピーや、習慣から下ろしたものは、元に合わせるので決めない） */
  const datable = !task.parentId && !task.habitId
  const openDate = useRef<(() => void) | null>(null)
  const titleClicks = useClickOrDouble(() => setNoteOpen(true), () => setRenaming(true))
  const targets = placeTargets(view.horizon)
  const quick = quickTarget(view.horizon)
  const apply = (c: Parameters<PlannerStore['apply']>[0]) => void store.apply(c)
  // 今日の列: 今日の分は「明日へ」、明日の欄のものは「今日へ」
  const inToday = view.horizon === 'today' && !done && !faded
  const forTomorrow = inToday && isForTomorrow(task, now)

  const items: (MenuItem | 'separator')[] = [
    ...(inToday
      ? [
          forTomorrow
            ? { label: '今日やる（今日にもどす）', onSelect: () => apply(bringToToday(task, now)) }
            : { label: '明日にまわす', onSelect: () => apply(postponeToTomorrow(task, now)) },
        ]
      : []),
    ...targets.map((t) => ({ label: PLACE_LABEL[t], onSelect: () => apply(placeDown(data, task, t, now)), disabled: done })),
    ...(targets.length ? ['separator' as const] : []),
    { label: '名前を変える', onSelect: () => setRenaming(true) },
    ...(datable
      ? [
          { label: task.due ? '日付を変える' : '日付を決める', onSelect: () => openDate.current?.() },
          ...(task.due ? [{ label: '日付を外す', onSelect: () => apply(setDue(task, '')) }] : []),
        ]
      : []),
    { label: task.note ? 'メモを見る' : 'メモを書く', onSelect: () => setNoteOpen(true) },
    'separator',
    ...(task.parentId || task.habitId ? [{ label: `${from ? HORIZON_NAME[from as BoardHorizon] ?? '元' : '元'}に戻す`, onSelect: () => apply(returnUp(data, task, now)) }] : []),
    { label: '消す', danger: true, onSelect: () => apply(removeTask(data, task, now)) },
  ]


  return (
    <li
      ref={sortable.ref}
      style={sortable.style}
      className={`pl-task pl-p-${task.priority}${faded ? ' pl-faded' : ''}${done ? ' pl-done' : ''}${sortable.isDragging ? ' pl-dragging' : ''}`}
      {...sortable.handleProps}
    >
      <span className="pl-task-label">{label}</span>
      <button
        type="button"
        role="checkbox"
        aria-checked={done}
        aria-label={done ? `「${task.title}」を終えたのを取り消す` : `「${task.title}」を終える`}
        className="pl-circle"
        onClick={() => apply(toggleDone(data, task, now))}
      >
        {done && <Check aria-hidden="true" />}
      </button>
      <div className="pl-task-main">
        {renaming ? (
          <InlineInput
            initial={task.title}
            label="名前"
            onDone={(title) => {
              setRenaming(false)
              if (title && title !== task.title) apply({ tasks: [{ ...task, title, updatedAt: new Date().toISOString() }] })
            }}
          />
        ) : (
          <button type="button" className="pl-task-title pl-title-button" title={task.note ? `${task.title}（押すとメモ）` : task.title} {...titleClicks}>
            {/* プロジェクトは色の丸 1 つで（名前は丸に重ねると出る）。名前の幅を広く取るため */}
            {project && <ProjectDot name={projectLabel(data, project)} color={project.color} />}
            <span className="pl-title-text">{task.title}</span>
            {task.note && <FileText className="pl-note-mark" aria-label="メモあり" />}
          </button>
        )}
        {!renaming && (
          <span className="pl-task-meta">
            {!simple && placedTo && <span className="pl-chip">→{PLACED_MARK[placedTo]}</span>}
            {!simple && from && from !== 'pool' && <span className="pl-chip">←{HORIZON_NAME[from as BoardHorizon]}</span>}
            {datable ? (
              <DueChip
                variant="inline"
                due={task.due}
                now={now}
                done={done}
                label={`「${task.title}」の日付`}
                opener={(open) => (openDate.current = open)}
                onChange={(value) => apply(setDue(task, value))}
              />
            ) : (
              task.due && <span className="pl-chip">{dueLabelWeekday(task.due, now)}</span>
            )}
          </span>
        )}
      </div>
      <div className="pl-task-actions">
        {(task.parentId || task.habitId) && (
          <button
            type="button"
            className="pl-row-button"
            aria-label={`「${task.title}」を${from ? HORIZON_NAME[from as BoardHorizon] : '元'}に戻す`}
            title={`${from ? HORIZON_NAME[from as BoardHorizon] : '元'}に戻す`}
            onClick={() => apply(returnUp(data, task, now))}
          >
            <CornerUpLeft aria-hidden="true" />
          </button>
        )}
        {quick && !done && !faded && (
          <button type="button" className="pl-place-button" onClick={() => apply(placeDown(data, task, quick, now))} title={PLACE_LABEL[quick]}>
            {PLACED_MARK[quick]}↓
          </button>
        )}
        {inToday && (
          <button
            type="button"
            className="pl-place-button"
            onClick={() => apply(forTomorrow ? bringToToday(task, now) : postponeToTomorrow(task, now))}
            title={forTomorrow ? '今日やる（今日にもどす）' : '明日にまわす'}
            aria-label={forTomorrow ? `「${task.title}」を今日にもどす` : `「${task.title}」を明日にまわす`}
          >
            {forTomorrow ? '今日↑' : '明日→'}
          </button>
        )}
        <Menu
          label={`「${task.title}」の操作`}
          items={items}
          header={
            <div className="pl-menu-priorities" role="group" aria-label="優先度">
              {PRIORITIES.map((p) => (
                <button
                  key={p}
                  type="button"
                  className={`pl-pchip pl-p-${p}`}
                  aria-pressed={task.priority === p}
                  title={PRIORITY_NAME[p]}
                  onClick={() => apply(setPriority(data, task, p, now))}
                >
                  {p}
                </button>
              ))}
            </div>
          }
        />
      </div>
      <NoteDialog
        open={noteOpen}
        title={task.title}
        note={task.note ?? ''}
        onClose={() => setNoteOpen(false)}
        onSave={(note) => {
          const { note: _n, ...rest } = task
          apply({ tasks: [{ ...rest, ...(note ? { note } : {}), updatedAt: new Date().toISOString() }] })
        }}
      />
    </li>
  )
}

/** 「その日」を決めるメニューの名前 */
const WHEN_NAME: Record<string, string> = { week: '毎週の曜日', month: '毎月の日', year: '毎年の日付・月' }

/** 習慣 1 行 */
export function HabitRow({ view, data, store, now }: { view: HabitView; data: PlannerData; store: PlannerStore; now: Date }) {
  const { habit, checked, project, faded, placedTo, auto, dueDay } = view
  const { simple } = useDisplay()
  const [renaming, setRenaming] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [dayEditing, setDayEditing] = useState(false)
  // 「その日」で自動で出しているもの（毎月の習慣を今日・今週の列に出したもの）は並べ替えない
  const sortable = useSortableRow(auto ? `auto-${habit.id}` : habit.id, renaming || auto)
  const titleClicks = useClickOrDouble(() => setNoteOpen(true), () => setRenaming(true))
  const apply = (c: Parameters<PlannerStore['apply']>[0]) => void store.apply(c)
  const targets = auto ? [] : habitPlaceTargets(habit)
  const quick = auto ? undefined : quickTarget(periodHorizon(habit.period))
  const overdue = auto && dueDay && !isMonthOnly(habit) && dayKey(dueDay) < dayKey(now)
  const when = whenLabel(habit)

  return (
    <li
      ref={sortable.ref}
      style={sortable.style}
      className={`pl-habit${checked ? ' pl-done' : ''}${faded ? ' pl-faded' : ''}${auto ? ' pl-habit-auto' : ''}${sortable.isDragging ? ' pl-dragging' : ''}`}
      {...sortable.handleProps}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? `「${habit.title}」のチェックを外す` : `「${habit.title}」をチェック`}
        className="pl-square"
        onClick={() => apply(toggleHabitAll(data, habit, now))}
      >
        {checked && <Check aria-hidden="true" />}
      </button>
      {renaming ? (
        <InlineInput
          initial={habit.title}
          label="習慣の名前"
          onDone={(title) => {
            setRenaming(false)
            if (title && title !== habit.title) apply({ habits: [{ ...habit, title, updatedAt: new Date().toISOString() }] })
          }}
        />
      ) : (
        <button type="button" className="pl-task-title pl-title-button" title={habit.note ? `${habit.title}（押すとメモ）` : habit.title} {...titleClicks}>
          {project && <ProjectDot name={projectLabel(data, project)} color={project.color} />}
          <span className="pl-title-text">{habit.title}</span>
          {habit.note && <FileText className="pl-note-mark" aria-label="メモあり" />}
        </button>
      )}
      {dayEditing ? (
        <WhenSelect
          autoFocus
          habit={habit}
          onBlur={habit.period === 'year' ? undefined : () => setDayEditing(false)}
          onChange={(next) => {
            apply({ habits: [next] })
            // 毎年は月と日の 2 つを選ぶので、閉じずに続けて選べるようにする
            if (habit.period !== 'year') setDayEditing(false)
          }}
        />
      ) : (
        when && (
          <span
            className={`pl-day${overdue && !checked ? ' pl-day-over' : ''}`}
            title={`${PERIOD_NAME[habit.period]}${when}${auto && dueDay ? `（${dueDay.getMonth() + 1}/${dueDay.getDate()}）` : ''}`}
          >
            {when}
          </span>
        )
      )}
      {dayEditing && habit.period === 'year' && (
        <button type="button" className="pl-place-button" onClick={() => setDayEditing(false)}>
          決定
        </button>
      )}
      {!simple && placedTo && <span className="pl-chip">→{PLACED_MARK[placedTo]}</span>}
      {quick && !checked && !faded && (
        <button type="button" className="pl-place-button" onClick={() => apply(placeHabitDown(data, habit, quick, now))} title={PLACE_LABEL[quick]}>
          {PLACED_MARK[quick]}↓
        </button>
      )}
      <Menu
        label={`「${habit.title}」の操作`}
        items={[
          ...targets.map((t) => ({ label: PLACE_LABEL[t], onSelect: () => apply(placeHabitDown(data, habit, t, now)), disabled: checked })),
          ...(targets.length ? ['separator' as const] : []),
          { label: '名前を変える', onSelect: () => setRenaming(true) },
          { label: habit.note ? 'メモを見る' : 'メモを書く', onSelect: () => setNoteOpen(true) },
          ...(habit.period !== 'day' ? [{ label: when ? `${WHEN_NAME[habit.period]}を変える（${when}）` : `${WHEN_NAME[habit.period]}を決める`, onSelect: () => setDayEditing(true) }] : []),
          { label: 'やることに移す（1 回で終わるもの）', onSelect: () => apply(habitToTask(data, habit, now)) },
          'separator',
          { label: '消す', danger: true, onSelect: () => apply({ deleteHabitIds: [habit.id] }) },
        ]}
      />
      <NoteDialog
        open={noteOpen}
        title={habit.title}
        note={habit.note ?? ''}
        onClose={() => setNoteOpen(false)}
        onSave={(note) => {
          const { note: _n, ...rest } = habit
          apply({ habits: [{ ...rest, ...(note ? { note } : {}), updatedAt: new Date().toISOString() }] })
        }}
      />
    </li>
  )
}

/** その場で書き換える入力欄（Enter・外を押すと保存、Esc でやめる） */
export function InlineInput({ initial, label, onDone }: { initial: string; label: string; onDone: (value: string) => void }) {
  const [value, setValue] = useState(initial)
  const ref = useRef<HTMLInputElement>(null)
  const done = useRef(false)
  useEffect(() => {
    ref.current?.focus()
    ref.current?.select()
  }, [])
  const finish = (v: string) => {
    if (done.current) return
    done.current = true
    onDone(v.trim())
  }
  return (
    <input
      ref={ref}
      className="pl-inline-input"
      value={value}
      aria-label={label}
      onChange={(e) => setValue(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' && !e.nativeEvent.isComposing) finish(value)
        if (e.key === 'Escape') finish(initial)
      }}
      onBlur={() => finish(value)}
    />
  )
}

/** 追加の入力欄（打って Enter。続けて打てる） */
export function AddInput({
  placeholder,
  label,
  onAdd,
  priority,
  onPriority,
}: {
  placeholder: string
  label: string
  onAdd: (title: string) => void
  /** 優先度を選ばせるとき */
  priority?: Priority
  onPriority?: (p: Priority) => void
}) {
  // 書きかけは、タブを切り替えても残す（この端末のこの画面のあいだだけ。足すと消える）
  const draftKey = `planner:draft:${label}`
  const [value, setValueState] = useState(() => readDraft(draftKey))
  const setValue = (v: string) => {
    setValueState(v)
    writeDraft(draftKey, v)
  }
  const { simple } = useDisplay()
  const submit = (e: FormEvent) => {
    e.preventDefault()
    const title = value.trim()
    if (!title) return
    onAdd(title)
    setValue('')
  }
  return (
    <form className="pl-add" onSubmit={submit}>
      {priority && onPriority && (
        <div className="pl-add-priorities" role="radiogroup" aria-label="優先度">
          {PRIORITIES.map((p) => (
            <button
              key={p}
              type="button"
              role="radio"
              aria-checked={priority === p}
              title={PRIORITY_NAME[p]}
              className={`pl-pchip pl-p-${p}`}
              onClick={() => onPriority(p)}
            >
              {p}
            </button>
          ))}
        </div>
      )}
      <div className="pl-add-line">
        <input
          className="pl-add-input"
          value={value}
          placeholder={simple ? '＋' : placeholder}
          aria-label={label}
          enterKeyHint="done"
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            // 日本語の変換を確定する Enter では追加しない
            if (e.key === 'Enter' && e.nativeEvent.isComposing) e.preventDefault()
          }}
        />
        {/* 書いているときは「追加」のボタンも出す（スマホでは Enter に気づきにくい） */}
        {value.trim() && (
          <button type="submit" className="pl-add-submit" aria-label={`${label}（追加）`}>
            追加
          </button>
        )}
      </div>
    </form>
  )
}

function readDraft(key: string): string {
  try {
    return sessionStorage.getItem(key) ?? ''
  } catch {
    return ''
  }
}
function writeDraft(key: string, value: string) {
  try {
    if (value) sessionStorage.setItem(key, value)
    else sessionStorage.removeItem(key)
  } catch {
    // 残せなくても、書くこと自体はできる
  }
}

/** プロジェクトの印（すっきり表示のとき、名前の代わりに色の点だけ出す） */
/** 丸に重ねたときに出す名前（テーマの中のプロジェクトは「自治会・防災イベント」） */
export function projectLabel(data: PlannerData, project: Project): string {
  const parent = project.parentId ? data.projects.find((p) => p.id === project.parentId) : undefined
  return parent ? `${parent.name}・${project.name}` : project.name
}

export function ProjectDot({ name, color }: { name: string; color: string }) {
  return <span className={`pl-pdot pl-color-${color}`} role="img" aria-label={name} title={name} />
}
