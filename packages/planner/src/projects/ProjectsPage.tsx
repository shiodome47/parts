import { Check, GripVertical, Plus, Sun } from 'lucide-react'
import { verticalListSortingStrategy } from '@dnd-kit/sortable'
import { SortableList, useLampSensors, useSortableRow } from '../ui/dnd'
import { CardBoard, type CardBoardCardState } from 'linkshelf'
import { changedProjects, projectCards, projectsInReadingOrder } from './projectCards'
import { createContext, useContext, useMemo, useState } from 'react'
import { safeLocalStore } from '../ui/storage'
import { inSamePeriod } from '../core'
import { PERIOD_NAME } from '../core'
import {
  childProjects,
  goalBreakdown,
  moveProject,
  nextGoalOrder,
  projectGoals,
  reorderGoals,
  newHabit,
  newProject,
  newTask,
  removeProject,
  removeTask,
  reorderProjects,
  reorderRoutine,
  toggleDone,
  toggleHabit,
  todayMarks,
  topProjects,
  unlinkGoal,
  type TodayMarks,
} from '../core'
import { endedHabits, type Habit, type PlannerData, type Period, type Project, type Task } from '../core'
import { PROJECT_COLORS } from './colors'
import type { PlannerStore } from '../ui/types'
import { Menu, type MenuItem } from '../ui/Menu'
import { AddInput, InlineInput } from '../ui/Rows'
import { DueChip } from '../ui/DueChip'
import { NoteTitle } from '../ui/NoteDialog'
import { JumpBar, scrollToElement } from '../ui/JumpBar'
import { WhenSelect } from '../ui/WhenSelect'
import { EndedHabits, useHabitEnd } from '../ui/EndedHabits'
import { BreakdownChip, BreakdownOf, SplitGoalDialog, jumpToProject } from './Breakdown'
import { CountControl, useCountMenu } from '../ui/Count'

const PERIODS: Period[] = ['day', 'week', 'month', 'year']

/** カードの幅の下限と、カードの間 */
const CARD_MIN = 290
const CARD_GAP = 10

type Apply = (c: Parameters<PlannerStore['apply']>[0]) => void

/** 「今日」を目立たせているか（この端末だけに覚えておく） */
const TODAY_KEY = 'planner:projectsToday'
/** 「今日」を目立たせているときの、今日のもの（目立たせていなければ null） */
const TodayContext = createContext<TodayMarks | null>(null)

/** そのプロジェクト（ids）の、今日のものの数と、まだの数 */
function todayCount(data: PlannerData, marks: TodayMarks, ids: Set<string>): { total: number; left: number } {
  let total = 0
  let left = 0
  for (const t of data.tasks) {
    const done = t.projectId && ids.has(t.projectId) ? marks.tasks.get(t.id) : undefined
    if (done === undefined) continue
    total++
    if (!done) left++
  }
  for (const h of data.habits) {
    const done = h.projectId && ids.has(h.projectId) ? marks.habits.get(h.id) : undefined
    if (done === undefined) continue
    total++
    if (!done) left++
  }
  return { total, left }
}

/** カードの見出しに出す「今日 あと 4」（目立たせていないとき・今日のものが無いときは出さない） */
function TodayBadge({ data, ids }: { data: PlannerData; ids: string[] }) {
  const marks = useContext(TodayContext)
  if (!marks) return null
  const { total, left } = todayCount(data, marks, new Set(ids))
  if (total === 0) return null
  return <span className={`pl-today-badge${left === 0 ? ' pl-today-badge-done' : ''}`}>{left ? `今日 あと ${left}` : '今日 ✓'}</span>
}

/** 今日のものが 1 つも無いカードか（目立たせているときだけ。薄く出す） */
function useTodayNone(data: PlannerData, ids: string[]): boolean {
  const marks = useContext(TodayContext)
  return !!marks && todayCount(data, marks, new Set(ids)).total === 0
}

/**
 * プロジェクト。1 枚のカードが 1 つのプロジェクト（または「英語」「自治会」のような続けていくテーマ）で、
 * 「期日目標」（期日つきのやること。期日から自動で時間軸の列に出る。優先度は時間軸で変える）と
 * 「ルーチン目標」（毎日・毎週…の習慣。時間軸の同じ期間の列に並ぶ）の 2 本柱。
 * テーマのカードの中には、プロジェクト（防災イベントの開催 など）を入れられる。
 */
export function ProjectsPage({ data, store, now }: { data: PlannerData; store: PlannerStore; now: Date }) {
  const [adding, setAdding] = useState(false)
  const cards = projectCards(data, topProjects(data))
  const sensors = useLampSensors()
  // 「今日」: 時間軸の今日の列に出ているものを目立たせ、ほかを薄くする
  const [todayOn, setTodayOn] = useState(() => safeLocalStore.get(TODAY_KEY) === '1')
  const marks = useMemo(() => (todayOn ? todayMarks(data, now) : null), [todayOn, data, now])
  const allLeft = marks ? todayCount(data, marks, new Set(data.projects.map((p) => p.id))).left : 0
  const toggleToday = () => {
    setTodayOn((on) => {
      if (on) safeLocalStore.remove(TODAY_KEY)
      else safeLocalStore.set(TODAY_KEY, '1')
      return !on
    })
  }
  const addCard = adding ? (
    <section className="pl-project pl-project-new">
      <AddInput
        placeholder="名前（例: そろばん・英語・自治会）"
        label="新しいプロジェクトの名前"
        onAdd={(name) => {
          const color = PROJECT_COLORS[data.projects.length % PROJECT_COLORS.length]
          void store.apply({ projects: [newProject(data, { name, color }, now)] })
          setAdding(false)
        }}
      />
      <button type="button" className="pl-button" onClick={() => setAdding(false)}>
        やめる
      </button>
    </section>
  ) : (
    <button type="button" className="pl-project-add" onClick={() => setAdding(true)}>
      <Plus aria-hidden="true" /> プロジェクト・テーマを足す
    </button>
  )
  return (
    <>
      <JumpBar
        className="pl-jump-projects"
        label="プロジェクトへ移動"
        items={projectsInReadingOrder(cards).map((p) => ({ id: p.id, label: p.name, color: p.color }))}
        onJump={(id) => scrollToElement(document.querySelector(`[data-project="${CSS.escape(id)}"]`))}
      />
      <div className="pl-projects-tools">
        <button
          type="button"
          className="pl-today-toggle"
          aria-pressed={todayOn}
          title={todayOn ? '目立たせるのをやめる' : '今日の列に出ているものを目立たせる'}
          onClick={toggleToday}
        >
          <Sun aria-hidden="true" />
          今日
          {todayOn && <span className="pl-today-toggle-left">{allLeft ? `あと ${allLeft}` : '✓'}</span>}
        </button>
        {todayOn && <span className="pl-note pl-today-hint">今日の列に出ているものを目立たせています</span>}
      </div>
      {/*
        左上ほど優先が高い。見出しの ⋮⋮ をつかんで並べ替える。
        並べ方とドラッグは linkshelf の <CardBoard>（棚と同じ）。カードは列ごとに上から詰める
      */}
      <TodayContext.Provider value={marks}>
      <CardBoard
        className={todayOn ? 'pl-projects pl-projects-today' : 'pl-projects'}
        columnClassName="pl-projects-col"
        cards={cards}
        minColumnWidth={CARD_MIN}
        gap={CARD_GAP}
        columnEndHeight={40}
        dropLineColor="var(--accent)"
        sensors={sensors}
        addon={addCard}
        onMove={(places) => {
          const changed = changedProjects(cards, places, new Date())
          if (changed.length) void store.apply({ projects: changed })
        }}
        renderCard={(card, state) => <ProjectCard project={card.project} data={data} store={store} now={now} drag={state} />}
      />
      </TodayContext.Provider>
    </>
  )
}

/** いちばん上のカード（プロジェクト、またはテーマ） */
function ProjectCard({
  project,
  data,
  store,
  now,
  drag,
}: {
  project: Project
  data: PlannerData
  store: PlannerStore
  now: Date
  /** <CardBoard> から（つかむところ・ドラッグ中か） */
  drag: CardBoardCardState
}) {
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [addingChild, setAddingChild] = useState(false)
  const apply: Apply = (c) => void store.apply(c)
  const children = childProjects(data, project.id)
  // ほかのテーマに入れられるのは、中にプロジェクトが無いものだけ（1 段だけ）
  const themes = children.length === 0 ? topProjects(data).filter((p) => p.id !== project.id) : []
  const ids = [project.id, ...children.map((c) => c.id)]
  const quiet = useTodayNone(data, ids)

  return (
    <section
      className={`pl-project${drag.isDragging ? ' pl-dragging' : ''}${quiet ? ' pl-today-none' : ''}`}
      aria-label={project.name}
      data-project={project.id}
    >
      <header className="pl-project-header">
        <button
          type="button"
          className="pl-grip"
          aria-label={`「${project.name}」を並べ替える（左ほど優先）`}
          title="ドラッグで並べ替え（左ほど優先）"
          {...(renaming ? {} : drag.dragHandle)}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <span className={`pl-dot pl-color-${project.color}`} aria-hidden="true" />
        {renaming ? (
          <InlineInput
            initial={project.name}
            label="プロジェクトの名前"
            onDone={(name) => {
              setRenaming(false)
              if (name && name !== project.name) apply({ projects: [{ ...project, name, updatedAt: new Date().toISOString() }] })
            }}
          />
        ) : (
          <h2 onDoubleClick={() => setRenaming(true)}>{project.name}</h2>
        )}
        <TodayBadge data={data} ids={ids} />
        <Menu
          label={`「${project.name}」の操作`}
          items={[
            { label: '名前を変える', onSelect: () => setRenaming(true) },
            { label: '中にプロジェクトを足す', onSelect: () => setAddingChild(true) },
            ...colorItems(project, apply),
            ...(themes.length ? ['separator' as const] : []),
            ...themes.map((th) => ({ label: `「${th.name}」の中に入れる`, onSelect: () => apply(moveProject(data, project, th.id, new Date())) })),
            ...unlinkItems(project, apply),
            'separator' as const,
            { label: children.length ? 'テーマを消す' : 'プロジェクトを消す', danger: true, onSelect: () => setConfirmDelete(true) },
          ]}
        />
      </header>
      <BreakdownOf project={project} data={data} />

      {confirmDelete && (
        <ConfirmRemove
          project={project}
          extra={children.length ? `中のプロジェクト（${children.map((c) => c.name).join('・')}）も消えます。` : ''}
          onCancel={() => setConfirmDelete(false)}
          onRemove={() => apply(removeProject(data, project))}
        />
      )}

      <ProjectBody project={project} data={data} apply={apply} now={now} compact={children.length > 0} />

      {/* 中のプロジェクト（テーマのとき） */}
      {children.length > 0 && (
        <SortableList
          ids={children.map((c) => c.id)}
          strategy={verticalListSortingStrategy}
          onMove={(a, o) => apply(reorderProjects(data, a, o, new Date()))}
        >
          {children.map((c) => (
            <SubProject key={c.id} project={c} parent={project} data={data} apply={apply} now={now} />
          ))}
        </SortableList>
      )}
      {addingChild ? (
        <div className="pl-subproject pl-subproject-new">
          <AddInput
            placeholder="中のプロジェクトの名前（例: 防災イベントの開催）"
            label={`${project.name}の中にプロジェクトを足す`}
            onAdd={(name) => {
              apply({ projects: [newProject(data, { name, color: project.color, parentId: project.id }, now)] })
              setAddingChild(false)
            }}
          />
          <button type="button" className="pl-button" onClick={() => setAddingChild(false)}>
            やめる
          </button>
        </div>
      ) : (
        children.length > 0 && (
          <button type="button" className="pl-subproject-add" onClick={() => setAddingChild(true)}>
            <Plus aria-hidden="true" /> 中にプロジェクトを足す
          </button>
        )
      )}
    </section>
  )
}

/** テーマの中のプロジェクト */
function SubProject({ project, parent, data, apply, now }: { project: Project; parent: Project; data: PlannerData; apply: Apply; now: Date }) {
  const [renaming, setRenaming] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const sortable = useSortableRow(project.id, renaming)
  const otherThemes = topProjects(data).filter((p) => p.id !== parent.id)
  const quiet = useTodayNone(data, [project.id])
  return (
    <section
      ref={sortable.ref}
      style={sortable.style}
      className={`pl-subproject${sortable.isDragging ? ' pl-dragging' : ''}${quiet ? ' pl-today-none' : ''}`}
      aria-label={`${parent.name}・${project.name}`}
      data-project={project.id}
    >
      <header className="pl-subproject-header">
        <button
          type="button"
          ref={sortable.activatorRef}
          className="pl-grip"
          aria-label={`「${project.name}」を並べ替える`}
          title="ドラッグで並べ替え"
          {...sortable.handleProps}
        >
          <GripVertical aria-hidden="true" />
        </button>
        <span className={`pl-dot pl-color-${project.color}`} aria-hidden="true" />
        {renaming ? (
          <InlineInput
            initial={project.name}
            label="プロジェクトの名前"
            onDone={(name) => {
              setRenaming(false)
              if (name && name !== project.name) apply({ projects: [{ ...project, name, updatedAt: new Date().toISOString() }] })
            }}
          />
        ) : (
          <h3 onDoubleClick={() => setRenaming(true)}>{project.name}</h3>
        )}
        <TodayBadge data={data} ids={[project.id]} />
        <Menu
          label={`「${project.name}」の操作`}
          items={[
            { label: '名前を変える', onSelect: () => setRenaming(true) },
            ...colorItems(project, apply),
            'separator',
            { label: `「${parent.name}」から出す`, onSelect: () => apply(moveProject(data, project, undefined, new Date())) },
            ...otherThemes.map((th) => ({ label: `「${th.name}」の中に移す`, onSelect: () => apply(moveProject(data, project, th.id, new Date())) })),
            ...unlinkItems(project, apply),
            'separator',
            { label: 'プロジェクトを消す', danger: true, onSelect: () => setConfirmDelete(true) },
          ]}
        />
      </header>
      <BreakdownOf project={project} data={data} />
      {confirmDelete && (
        <ConfirmRemove project={project} extra="" onCancel={() => setConfirmDelete(false)} onRemove={() => apply(removeProject(data, project))} />
      )}
      <ProjectBody project={project} data={data} apply={apply} now={now} />
    </section>
  )
}

function ConfirmRemove({ project, extra, onCancel, onRemove }: { project: Project; extra: string; onCancel: () => void; onRemove: () => void }) {
  return (
    <div className="pl-confirm" role="alertdialog" aria-label="プロジェクトを消す">
      <p className="pl-text">
        「{project.name}」と、その期日目標・ルーチン目標（列に置いたものも）を消します。{extra}取り消せません。
      </p>
      <div className="pl-row pl-row-end">
        <button type="button" className="pl-button" onClick={onCancel}>
          キャンセル
        </button>
        <button type="button" className="pl-button pl-button-danger" onClick={onRemove}>
          消す
        </button>
      </div>
    </div>
  )
}

/** 目標の「中身」になっているプロジェクトの … に足す、つなぎを外す */
function unlinkItems(project: Project, apply: Apply): MenuItem[] {
  return project.goalId ? [{ label: '目標の中身をやめる（つなぎを外す）', onSelect: () => apply(unlinkGoal(project, new Date())) }] : []
}

function colorItems(project: Project, apply: Apply): MenuItem[] {
  return PROJECT_COLORS.filter((c) => c !== project.color).map((c) => ({
    label: `色: ${COLOR_NAME[c]}`,
    onSelect: () => apply({ projects: [{ ...project, color: c, updatedAt: new Date().toISOString() }] }),
  }))
}

/** 期日目標とルーチン目標（カードにも、テーマの中のプロジェクトにも） */
function ProjectBody({
  project,
  data,
  apply,
  now,
  compact = false,
}: {
  project: Project
  data: PlannerData
  apply: Apply
  now: Date
  /** 中にプロジェクトのあるテーマ: 自分の目標が何も無ければ、足す欄を 1 行にたたむ */
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  // 足す欄の日付も、タブを切り替えても残す（足すと消える）
  const dueKey = `planner:draftDue:${project.id}`
  const [due, setDueState] = useState(() => {
    try {
      return sessionStorage.getItem(dueKey) ?? ''
    } catch {
      return ''
    }
  })
  const setDue = (v: string) => {
    setDueState(v)
    try {
      if (v) sessionStorage.setItem(dueKey, v)
      else sessionStorage.removeItem(dueKey)
    } catch {
      // 残せなくても、選ぶこと自体はできる
    }
  }
  const [period, setPeriod] = useState<Period>('day')
  /** 各行の「メモを開く」「名前を変える」（… のメニューから呼ぶ） */
  const openers: Record<string, { note: () => void; rename: () => void }> = {}

  // 期日目標: プロジェクトのやることのうち、下ろした先（コピー）でないもの。
  // 日付の無いものは上に自由な順で、日付のあるものはその下に遠い順（下へ行くほど今日に近い）、終えたものは一番下
  const { open: goals, done } = projectGoals(data, project.id)
  const mine = data.habits.filter((h) => h.projectId === project.id)
  // 終えたルーチン目標（卒業・お休み）は、一番下にたたんでおく
  const routines = mine
    .filter((h) => !h.endedAt)
    .sort((a, b) => PERIODS.indexOf(a.period) - PERIODS.indexOf(b.period) || a.order - b.order)
  const ended = endedHabits(mine)
  const empty = goals.length + done.length + mine.length === 0

  if (compact && empty && !open) {
    return (
      <button type="button" className="pl-subproject-add pl-own-add" onClick={() => setOpen(true)}>
        <Plus aria-hidden="true" /> 「{project.name}」に目標を足す
      </button>
    )
  }

  return (
    <>
      <div className="pl-block">
        <h3 className="pl-block-title">期日目標</h3>
        <ul className="pl-list">
          {/* 日付の無いものは、行をつかんで好きな位置へ（日付のあるものの間にも）。日付のあるものは、日付の遠い順のまま */}
          <SortableList
            ids={goals.map((g) => g.id)}
            strategy={verticalListSortingStrategy}
            onMove={(a, o) => apply(reorderGoals(data, goals.map((g) => g.id), a, o, new Date()))}
          >
            {goals.map((g) => (
              <GoalRow key={g.id} g={g} data={data} apply={apply} now={now} openers={openers} sortable={g.due ? 'drop' : 'drag'} />
            ))}
          </SortableList>
        </ul>
        {/* 足す欄も、上の行と同じ並び: [＋][期日][名前] */}
        <div className="pl-goal pl-goal-add">
          <span className="pl-goal-add-mark" aria-hidden="true">
            <Plus />
          </span>
          <DueChip due={due || undefined} now={now} done={false} label="足す期日目標の期日" onChange={setDue} />
          <AddInput
            placeholder="期日目標を足す"
            label={`${project.name}の期日目標を足す`}
            onAdd={(title) => {
              // 新しいものは、いちばん下の席に（日付のあるものは、日付の順の席へ）
              const task = newTask(data, { title, horizon: 'pool', priority: 'C', projectId: project.id, due: due || undefined }, now)
              apply({ tasks: [{ ...task, goalOrder: nextGoalOrder(data, project.id) }] })
              setDue('')
            }}
          />
        </div>
        {/* 終えた目標は、一番下にたたんでおく（新しく終えた順。開けば見られ、チェックを外せば上へ戻る） */}
        {done.length > 0 && (
          <details className="pl-ended">
            <summary className="pl-ended-summary">終えた目標（{done.length}）</summary>
            <ul className="pl-list">
              {done.map((g) => (
                <GoalRow key={g.id} g={g} data={data} apply={apply} now={now} openers={openers} />
              ))}
            </ul>
          </details>
        )}
      </div>

      <div className="pl-block">
        <h3 className="pl-block-title">ルーチン目標</h3>
        {/* 行をつかんで並べ替える（同じくり返しのものどうし。毎日は毎日の中で） */}
        <SortableList
          ids={routines.map((r) => r.id)}
          strategy={verticalListSortingStrategy}
          onMove={(a, o) => apply(reorderRoutine(data, a, o, new Date()))}
        >
          <ul className="pl-list">
            {routines.map((r) => (
              <RoutineRow key={r.id} r={r} data={data} apply={apply} now={now} />
            ))}
          </ul>
        </SortableList>
        <div className="pl-add-row">
          <AddInput
            placeholder="＋ ルーチン目標を足す"
            label={`${project.name}のルーチン目標を足す`}
            onAdd={(title) => apply({ habits: [newHabit(data, { title, period, projectId: project.id }, now)] })}
          />
          <select className="pl-select" value={period} onChange={(e) => setPeriod(e.target.value as Period)} aria-label="足すルーチン目標のくり返し">
            {PERIODS.map((p) => (
              <option key={p} value={p}>
                {PERIOD_NAME[p]}
              </option>
            ))}
          </select>
        </div>
        <EndedHabits habits={ended} data={data} store={{ apply }} now={now} label="これまでのルーチン目標" />
      </div>
    </>
  )
}

/** ルーチン目標 1 行（チェック・名前・くり返し・その日・…） */
function RoutineRow({ r, data, apply, now }: { r: Habit; data: PlannerData; apply: Apply; now: Date }) {
  const t = () => new Date().toISOString()
  const opener: { note?: () => void; rename?: () => void } = {}
  // 卒業・お休みにする／完全に消す（と、その小窓）
  const end = useHabitEnd(r, data, apply)
  const checked = inSamePeriod(r.period, r.checkedAt, now)
  const today = useContext(TodayContext)?.habits.has(r.id)
  // 行をつかんでドラッグで並べ替える（マウスは少し動かすと、指は長押しで）
  const row = useSortableRow(r.id)
  return (
    <li
      ref={row.ref}
      style={row.style}
      className={`pl-habit${checked ? ' pl-done' : ''}${today ? ' pl-today' : ''}${row.isDragging ? ' pl-dragging' : ''}`}
      {...row.handleProps}
    >
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={checked ? `「${r.title}」のチェックを外す` : `「${r.title}」をチェック`}
        className="pl-square"
        onClick={() => apply({ habits: [toggleHabit(r, now)] })}
      >
        {checked && <Check aria-hidden="true" />}
      </button>
      <NoteTitle
        title={r.title}
        note={r.note}
        wrap
        renameLabel="ルーチン目標の名前"
        menuOpener={(o) => Object.assign(opener, o)}
        onRename={(title) => apply({ habits: [{ ...r, title, updatedAt: t() }] })}
        onSaveNote={(note) => {
          const { note: _n, ...rest } = r
          apply({ habits: [{ ...rest, ...(note ? { note } : {}), updatedAt: t() }] })
        }}
      />
      <select
        className="pl-select"
        value={r.period}
        aria-label={`「${r.title}」のくり返し`}
        onChange={(e) => apply({ habits: [{ ...r, period: e.target.value as Period, updatedAt: t() }] })}
      >
        {PERIODS.map((p) => (
          <option key={p} value={p}>
            {PERIOD_NAME[p]}
          </option>
        ))}
      </select>
      {/* 毎週は曜日・毎月は日（第2水曜 など）・毎年は月と日を決められる。決めると、その日が近いときに時間軸の短い列にも出る */}
      {r.period !== 'day' && <WhenSelect className="pl-select pl-select-day" habit={r} onChange={(next) => apply({ habits: [next] })} />}
      <Menu
        label={`「${r.title}」の操作`}
        items={[
          { label: '名前を変える', onSelect: () => opener.rename?.() },
          { label: r.note ? 'メモを見る' : 'メモを書く', onSelect: () => opener.note?.() },
          end.items[0],
          'separator',
          end.items[1],
        ]}
      />
      {end.dialogs}
    </li>
  )
}

/** 期日目標 1 行（日付の無いものは、行をつかんでドラッグで並べ替えられる） */
function GoalRow({
  g,
  data,
  apply,
  now,
  openers,
  sortable,
}: {
  g: Task
  data: PlannerData
  apply: Apply
  now: Date
  openers: Record<string, { note: () => void; rename: () => void }>
  /** 'drag': つかんで動かせる（日付の無いもの）／'drop': 動かせないが、間に落とせる（日付のあるもの） */
  sortable?: 'drag' | 'drop'
}) {
  const t = () => new Date().toISOString()
  const row = useSortableRow(g.id, sortable === 'drag' ? false : sortable === 'drop' ? { draggable: true, droppable: false } : true)
  // 目標を細かく分ける（中身のプロジェクト）
  const [splitting, setSplitting] = useState(false)
  const inner = goalBreakdown(data, g)
  // 回数の目標（30/100 回 ＋1）のメニューと小窓
  const count = useCountMenu(g, data, apply)
  const today = useContext(TodayContext)?.tasks.has(g.id)
  const title = (
    <NoteTitle
      title={g.title}
      note={g.note}
      wrap
      renameLabel="期日目標の名前"
      menuOpener={(o) => (openers[g.id] = o)}
      onRename={(title) => apply({ tasks: [{ ...g, title, updatedAt: t() }] })}
      onSaveNote={(note) => {
        const { note: _n, ...rest } = g
        apply({ tasks: [{ ...rest, ...(note ? { note } : {}), updatedAt: t() }] })
      }}
    />
  )
  return (
            <li
              ref={sortable ? row.ref : undefined}
              style={sortable ? row.style : undefined}
              className={`pl-goal${g.doneAt ? ' pl-done' : ''}${sortable === 'drag' ? ' pl-goal-free' : ''}${row.isDragging ? ' pl-dragging' : ''}${today ? ' pl-today' : ''}`}
              {...(sortable === 'drag' ? row.handleProps : {})}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={!!g.doneAt}
                aria-label={g.doneAt ? `「${g.title}」を終えたのを取り消す` : `「${g.title}」を終える`}
                className="pl-circle"
                onClick={() => apply(toggleDone(data, g, now))}
              >
                {g.doneAt && <Check aria-hidden="true" />}
              </button>
              <DueChip
                due={g.due}
                now={now}
                done={!!g.doneAt}
                label={`「${g.title}」の期日`}
                onChange={(value) => {
                  const { due: _d, ...rest } = g
                  apply({ tasks: [value ? { ...rest, due: value, updatedAt: t() } : { ...rest, updatedAt: t() }] })
                }}
              />
              {/* 回数・中身があれば、名前の下に（名前の幅を狭めないように） */}
              {inner || g.count ? (
                <div className="pl-goal-main">
                  {title}
                  <div className="pl-goal-meta">
                    <CountControl task={g} data={data} apply={apply} />
                    <BreakdownChip goal={g} data={data} />
                  </div>
                </div>
              ) : (
                title
              )}
              <Menu
                label={`「${g.title}」の操作`}
                items={[
                  { label: '名前を変える', onSelect: () => openers[g.id]?.rename() },
                  { label: g.note ? 'メモを見る' : 'メモを書く', onSelect: () => openers[g.id]?.note() },
                  ...count.items,
                  ...(inner
                    ? [
                        { label: `中身「${inner.project.name}」へ移動`, onSelect: () => jumpToProject(inner.project.id) },
                        { label: '中身とのつなぎを外す', onSelect: () => apply(unlinkGoal(inner.project, new Date())) },
                      ]
                    : [{ label: '細かく分ける…', onSelect: () => setSplitting(true) }]),
                  'separator',
                  { label: '消す', danger: true, onSelect: () => apply(removeTask(data, g, now)) },
                ]}
              />
              {splitting && <SplitGoalDialog goal={g} data={data} apply={apply} onClose={() => setSplitting(false)} />}
              {count.dialog}
            </li>
  )
}

const COLOR_NAME: Record<string, string> = {
  teal: 'ティール',
  blue: 'ブルー',
  purple: 'パープル',
  pink: 'ピンク',
  orange: 'オレンジ',
  red: 'レッド',
  yellow: 'イエロー',
  green: 'グリーン',
}
