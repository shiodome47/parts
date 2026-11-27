import { ChevronRight, Maximize2, Minimize2 } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { safeLocalStore } from '../ui/storage'
import { periodLabel } from '../core'
import { HORIZON_NAME, HORIZON_SUB, PRIORITY_NAME } from '../core'
import { buildColumns, emptyPriorityGaps, newHabit, newTask, reorderTasks, setPriority, type ColumnView, type TaskView } from '../core'
import { useDroppable } from '@dnd-kit/core'
import { verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableList } from '../ui/dnd'
import { PRIORITIES, type PlannerData, type Priority } from '../core'
import type { PlannerStore } from '../ui/types'
import { AddInput, HabitRow, ProjectDot, TaskRow } from '../ui/Rows'
import { GROUP_DROP, groupHabits, habitDropChanges, type HabitGroup } from './habitGroups'
import { JumpBar, scrollToElement } from '../ui/JumpBar'
import { EndedHabits } from '../ui/EndedHabits'

/** 広げている列（この端末だけに覚えておく） */
const WIDE_KEY = 'planner:wideColumn'
/** 開いている、プロジェクトごとの習慣のまとまり（「today:プロジェクトの id」の一覧。この端末だけに覚えておく） */
const GROUPS_KEY = 'planner:openHabitGroups'

function readOpenGroups(): Set<string> {
  try {
    const list: unknown = JSON.parse(safeLocalStore.get(GROUPS_KEY) ?? '[]')
    return new Set(Array.isArray(list) ? list.filter((x): x is string => typeof x === 'string') : [])
  } catch {
    return new Set()
  }
}

/** 開いているまとまりと、開く・閉じる（ほかの列の分を消さないよう、覚えている値を読み直してから書く） */
function useOpenGroups(): [Set<string>, (key: string) => void] {
  const [open, setOpen] = useState(readOpenGroups)
  const toggle = (key: string) => {
    const next = readOpenGroups()
    if (next.has(key)) next.delete(key)
    else next.add(key)
    safeLocalStore.set(GROUPS_KEY, JSON.stringify([...next]))
    setOpen(next)
  }
  return [open, toggle]
}

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
  // 同じプロジェクトの習慣が 2 つ以上あれば、1 行（「ヨガ あと 8」）にまとめてたたむ
  const [openGroups, toggleGroup] = useOpenGroups()
  const { single, groups } = groupHabits(col.habits, data)
  const groupKey = (g: HabitGroup) => `${h}:${g.project.id}`
  // 並べ替えるのは、この列の期間の習慣で、見えているものだけ（「その日」で自動で出している毎月の習慣は除く）。画面の並び順
  const ownHabitIds = [...single, ...groups.flatMap((g) => (openGroups.has(groupKey(g)) ? g.views : []))]
    .filter((v) => !v.auto)
    .map((v) => v.habit.id)
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
            onMove={(a, o) => {
              // まとまり（プロジェクト）へ落とせば、そのプロジェクトへ移る。外へ出せば外れる。ほかは並べ替え
              void store.apply(habitDropChanges(data, ownHabitIds, groups, a, o, new Date()))
              // 閉じているまとまりの見出しへ落としたら、開いて、入ったのが見えるようにする
              const g = o.startsWith(GROUP_DROP) ? groups.find((x) => GROUP_DROP + x.project.id === o) : undefined
              if (g && !openGroups.has(groupKey(g))) toggleGroup(groupKey(g))
            }}
          >
            <ul className="pl-list">
              {single.map((v) => (
                <HabitRow key={v.auto ? `auto-${v.habit.id}` : v.habit.id} view={v} data={data} store={store} now={now} />
              ))}
              {groups.map((g) => (
                <HabitGroupRow
                  key={g.project.id}
                  group={g}
                  open={openGroups.has(groupKey(g))}
                  onToggle={() => toggleGroup(groupKey(g))}
                  data={data}
                  store={store}
                  now={now}
                />
              ))}
            </ul>
          </SortableList>
          <AddInput
            placeholder="＋ 習慣を足す"
            label={`${HORIZON_NAME[h]}の習慣を足す`}
            onAdd={(title) => void store.apply({ habits: [newHabit(data, { title, period: col.habitPeriod! }, now)] })}
          />
          {/* 終えた習慣（卒業・お休み）は、一番下にたたんでおく */}
          <EndedHabits habits={col.ended} data={data} store={store} now={now} />
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

/**
 * プロジェクトの習慣をまとめた 1 行（▸ ● ヨガ　あと 8）。押すと、その場で開いてチェックもできる
 */
function HabitGroupRow({
  group,
  open,
  onToggle,
  data,
  store,
  now,
}: {
  group: HabitGroup
  open: boolean
  onToggle: () => void
  data: PlannerData
  store: PlannerStore
  now: Date
}) {
  const { project, label, views, left } = group
  // 見出しは、習慣をドラッグで落とせる（そのプロジェクトへ移る）
  const drop = useDroppable({ id: `${GROUP_DROP}${project.id}` })
  return (
    <li className={`pl-habit-group${open ? ' pl-habit-group-open' : ''}${left === 0 ? ' pl-done' : ''}`}>
      <button
        ref={drop.setNodeRef}
        type="button"
        className={`pl-habit-group-toggle${drop.isOver ? ' pl-habit-group-drop-over' : ''}`}
        aria-expanded={open}
        aria-label={`「${label}」の習慣 ${views.length} 個（${left ? `あと ${left}` : '全部済み'}）`}
        onClick={onToggle}
      >
        <ChevronRight className="pl-habit-group-chevron" aria-hidden="true" />
        <ProjectDot name={label} color={project.color} />
        <span className="pl-title-text">{label}</span>
        <span className={`pl-habit-group-left${left === 0 ? ' pl-count-full' : ''}`}>{left ? `あと ${left}` : '✓ 済み'}</span>
      </button>
      {open && (
        <ul className="pl-list pl-habit-group-items">
          {views.map((v) => (
            <HabitRow key={v.habit.id} view={v} data={data} store={store} now={now} />
          ))}
        </ul>
      )}
    </li>
  )
}

/** ドラッグで、空の優先度に移すときの落とし先の id（行の id とぶつからないように頭に付ける） */
const PRIORITY_DROP = 'priority:'

/** 落とし先の id から優先度を読む（行の id なら undefined） */
function droppedPriority(id: string): Priority | undefined {
  const p = id.startsWith(PRIORITY_DROP) ? id.slice(PRIORITY_DROP.length) : ''
  return (PRIORITIES as string[]).includes(p) ? (p as Priority) : undefined
}

/**
 * 優先度ごとのまとまり（A 重要・緊急 … P Private）。空のまとまりは出さない。
 * ドラッグしている間だけ、空の優先度の落とし先（細い帯）を、その優先度の場所に重ねて出す
 * （B の上に A、C の下に D・P など）。帯に落とすと、その優先度に変わる。
 * 帯は行の上に重ねるので、出ても行は動かない（つかんだ行が指からずれない）
 */
function TaskGroups({ views, data, store, now }: { views: TaskView[]; data: PlannerData; store: PlannerStore; now: Date }) {
  const [dragging, setDragging] = useState(false)
  if (views.length === 0) return null
  // 画面に並んでいる順（A → P）。別の優先度のまとまりへ落とすと、その優先度になる
  const ids = views.map((v) => v.task.id)
  const present = PRIORITIES.filter((p) => views.some((v) => v.task.priority === p))
  const gaps = emptyPriorityGaps(present)
  const last = present[present.length - 1]
  const onMove = (activeId: string, overId: string) => {
    const to = droppedPriority(overId)
    if (!to) return void store.apply(reorderTasks(data, ids, activeId, overId, new Date()))
    const task = views.find((v) => v.task.id === activeId)?.task
    if (task) void store.apply(setPriority(data, task, to, new Date()))
  }
  return (
    <SortableList ids={ids} strategy={verticalListSortingStrategy} onMove={onMove} onDragging={setDragging}>
      {present.map((p, i) => {
        const group = views.filter((v) => v.task.priority === p)
        const above = gaps.before[p]
        return (
          <div key={p} className="pl-group">
            {dragging && above && <PriorityDrops priorities={above} place={i === 0 ? 'top' : 'between'} />}
            <div className={`pl-group-title pl-p-${p}`}>
              <span className="pl-pbadge">{p}</span>
              {PRIORITY_NAME[p]}
            </div>
            <ul className="pl-list">
              {group.map((v) => (
                <TaskRow key={v.task.id} view={v} data={data} store={store} now={now} />
              ))}
            </ul>
            {dragging && p === last && gaps.after.length > 0 && <PriorityDrops priorities={gaps.after} place="bottom" />}
          </div>
        )
      })}
    </SortableList>
  )
}

/** 空の優先度の落とし先を横に並べた帯（place: まとまりの上の端・まとまりの間・最後のまとまりの下） */
function PriorityDrops({ priorities, place }: { priorities: Priority[]; place: 'top' | 'between' | 'bottom' }) {
  return (
    <div className={`pl-pdrops pl-pdrops-${place}`} aria-hidden="true">
      {priorities.map((p) => (
        <PriorityDrop key={p} priority={p} />
      ))}
    </div>
  )
}

function PriorityDrop({ priority }: { priority: Priority }) {
  const { setNodeRef, isOver } = useDroppable({ id: `${PRIORITY_DROP}${priority}` })
  return (
    <div ref={setNodeRef} className={`pl-pdrop pl-p-${priority}${isOver ? ' pl-pdrop-over' : ''}`} data-testid={`priority-drop-${priority}`}>
      <span className="pl-pbadge">{priority}</span>
      {PRIORITY_NAME[priority]}へ
    </div>
  )
}
