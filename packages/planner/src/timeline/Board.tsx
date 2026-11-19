import { Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { safeLocalStore } from '../ui/storage'
import { periodLabel } from '../core'
import { HORIZON_NAME, HORIZON_SUB, PRIORITY_NAME } from '../core'
import { buildColumns, newHabit, newTask, reorderHabits, reorderTasks, type ColumnView, type TaskView } from '../core'
import { verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableList } from '../ui/dnd'
import { PRIORITIES, type PlannerData, type Priority } from '../core'
import type { PlannerStore } from '../ui/types'
import { AddInput, HabitRow, TaskRow } from '../ui/Rows'
import { JumpBar, scrollToElement } from '../ui/JumpBar'

/** 広げている列（この端末だけに覚えておく） */
const WIDE_KEY = 'planner:wideColumn'

/**
 * 時間軸ボード。今日・今週・数か月・今年・一生を横に並べる（スマホでは横にめくる）。
 * どの列も「習慣」と「やること（A1, B1 …）」の 2 段。今日の列だけ「明日」の欄がある。
 */
export function Board({ data, store, now }: { data: PlannerData; store: PlannerStore; now: Date }) {
  const columns = useMemo(() => buildColumns(data, now), [data, now])
  const boardRef = useRef<HTMLDivElement>(null)
  // 見出しを押して広げている列（全文を折り返して出す）。この端末だけに覚えておく
  const [wide, setWideState] = useState<string | null>(() => safeLocalStore.get(WIDE_KEY))
  const setWide = (h: string | null) => {
    setWideState(h)
    if (h) safeLocalStore.set(WIDE_KEY, h)
    else safeLocalStore.remove(WIDE_KEY)
  }
  // スマホ（横にめくる）で、今見ている列
  const [active, setActive] = useState<string | null>(columns[0]?.horizon ?? null)
  useEffect(() => {
    const board = boardRef.current
    if (!board || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0]
        const h = seen?.target.getAttribute('data-horizon')
        if (h) setActive(h)
      },
      { root: board, threshold: [0.6] },
    )
    board.querySelectorAll('[data-horizon]').forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [columns.length])
  return (
    <>
      <JumpBar
        className="pl-jump-board"
        label="列へ移動"
        items={columns.map((c) => ({ id: c.horizon, label: HORIZON_NAME[c.horizon] }))}
        active={active}
        onJump={(h) => {
          setActive(h)
          scrollToElement(boardRef.current?.querySelector(`[data-horizon="${h}"]`), true)
        }}
      />
      <div
        ref={boardRef}
        className="pl-board"
        role="list"
        aria-label="時間軸"
        // PC: 広げた列だけ 2 倍の幅に（スマホでは CSS で横に並べてめくるので、これは効かない）
        style={wide ? { gridTemplateColumns: columns.map((c) => (c.horizon === wide ? 'minmax(440px, 2fr)' : 'minmax(260px, 1fr)')).join(' ') } : undefined}
      >
        {columns.map((col) => (
          <Column
            key={col.horizon}
            col={col}
            data={data}
            store={store}
            now={now}
            wide={wide === col.horizon}
            onToggleWide={() => {
              const next = wide === col.horizon ? null : col.horizon
              setWide(next)
              // 広げた（戻した）列が見えるように
              requestAnimationFrame(() => scrollToElement(boardRef.current?.querySelector(`[data-horizon="${col.horizon}"]`), true))
            }}
          />
        ))}
      </div>
    </>
  )
}

function Column({
  col,
  data,
  store,
  now,
  wide,
  onToggleWide,
}: {
  col: ColumnView
  data: PlannerData
  store: PlannerStore
  now: Date
  wide: boolean
  onToggleWide: () => void
}) {
  const [priority, setPriority] = useState<Priority>('B')
  const [tomorrowPriority, setTomorrowPriority] = useState<Priority>('B')
  const h = col.horizon
  const doneHabits = col.habits.filter((x) => x.checked).length
  // 並べ替えるのは、この列の期間の習慣だけ（「その日」で自動で出している毎月の習慣は除く）
  const ownHabitIds = col.habits.filter((v) => !v.auto).map((v) => v.habit.id)
  const openTasks = col.tasks.filter((x) => !x.done && !x.faded).length

  return (
    <section
      className={`pl-column pl-column-${h}${wide ? ' pl-column-wide' : ''}`}
      role="listitem"
      aria-label={HORIZON_NAME[h]}
      data-horizon={h}
    >
      <header className="pl-column-header">
        {/* 見出しを押すと、列を広げて名前を全部出す（もう一度押すと戻す） */}
        <button
          type="button"
          className="pl-column-toggle"
          aria-expanded={wide}
          title={wide ? '列の幅を戻す' : '列を広げて、名前を全部出す'}
          onClick={onToggleWide}
        >
          <h2>
            {HORIZON_NAME[h]}
            <span className="pl-column-sub">{HORIZON_SUB[h]}</span>
          </h2>
          {wide ? <Minimize2 className="pl-wide-mark" aria-hidden="true" /> : <Maximize2 className="pl-wide-mark" aria-hidden="true" />}
        </button>
        {col.habits.length > 0 && (
          <span className={`pl-header-count${doneHabits === col.habits.length ? ' pl-count-full' : ''}`} title="済んだ習慣">
            {doneHabits}/{col.habits.length}
          </span>
        )}
        <span className="pl-column-period">{periodLabel(h, now)}</span>
      </header>

      {col.habitPeriod && (
        <div className="pl-block">
          <h3 className="pl-block-title">
            習慣
            {col.habits.length > 0 && (
              <span className={`pl-count${doneHabits === col.habits.length ? ' pl-count-full' : ''}`} data-testid={`habits-${h}`}>
                {doneHabits}/{col.habits.length}
              </span>
            )}
          </h3>
          <SortableList
            ids={ownHabitIds}
            strategy={verticalListSortingStrategy}
            onMove={(a, o) => void store.apply(reorderHabits(data, ownHabitIds, a, o, new Date()))}
          >
            <ul className="pl-list">
              {col.habits.map((v) => (
                <HabitRow key={v.auto ? `auto-${v.habit.id}` : v.habit.id} view={v} data={data} store={store} now={now} />
              ))}
            </ul>
          </SortableList>
          <AddInput
            placeholder="＋ 習慣を足す"
            label={`${HORIZON_NAME[h]}の習慣を足す`}
            onAdd={(title) => void store.apply({ habits: [newHabit(data, { title, period: col.habitPeriod! }, now)] })}
          />
        </div>
      )}

      <div className="pl-block">
        <h3 className="pl-block-title">
          やること
          {openTasks > 0 && <span className="pl-count">{openTasks}</span>}
        </h3>
        <TaskGroups views={col.tasks} data={data} store={store} now={now} />
        <AddInput
          placeholder="＋ やることを足す"
          label={`${HORIZON_NAME[h]}のやることを足す`}
          priority={priority}
          onPriority={setPriority}
          onAdd={(title) => void store.apply({ tasks: [newTask(data, { title, horizon: h, priority }, now)] })}
        />
      </div>

      {h === 'today' && (
        <div className="pl-block pl-tomorrow">
          <h3 className="pl-block-title">明日</h3>
          <TaskGroups views={col.tomorrow} data={data} store={store} now={now} />
          <AddInput
            placeholder="＋ 明日やることを足す"
            label="明日やることを足す"
            priority={tomorrowPriority}
            onPriority={setTomorrowPriority}
            onAdd={(title) =>
              void store.apply({ tasks: [newTask(data, { title, horizon: 'today', priority: tomorrowPriority, tomorrow: true }, now)] })
            }
          />
        </div>
      )}

      {h === 'week' && (
        <div className="pl-block pl-tomorrow">
          <h3 className="pl-block-title">来週</h3>
          <TaskGroups views={col.nextWeek} data={data} store={store} now={now} />
          <AddInput
            placeholder="＋ 来週やることを足す"
            label="来週やることを足す"
            priority={tomorrowPriority}
            onPriority={setTomorrowPriority}
            onAdd={(title) =>
              void store.apply({ tasks: [newTask(data, { title, horizon: 'week', priority: tomorrowPriority, nextWeek: true }, now)] })
            }
          />
        </div>
      )}
    </section>
  )
}

/** 優先度ごとのまとまり（A 重要・緊急 … P Private）。空のまとまりは出さない */
function TaskGroups({ views, data, store, now }: { views: TaskView[]; data: PlannerData; store: PlannerStore; now: Date }) {
  if (views.length === 0) return null
  // 画面に並んでいる順（A → P）。別の優先度のまとまりへ落とすと、その優先度になる
  const ids = views.map((v) => v.task.id)
  return (
    <SortableList
      ids={ids}
      strategy={verticalListSortingStrategy}
      onMove={(a, o) => void store.apply(reorderTasks(data, ids, a, o, new Date()))}
    >
      {PRIORITIES.map((p) => {
        const group = views.filter((v) => v.task.priority === p)
        if (group.length === 0) return null
        return (
          <div key={p} className="pl-group">
            <div className={`pl-group-title pl-p-${p}`}>
              <span className="pl-pbadge">{p}</span>
              {PRIORITY_NAME[p]}
            </div>
            <ul className="pl-list">
              {group.map((v) => (
                <TaskRow key={v.task.id} view={v} data={data} store={store} now={now} />
              ))}
            </ul>
          </div>
        )
      })}
    </SortableList>
  )
}
