import { addDays, dayKey, daysUntil, HORIZON_HABIT_PERIOD, HORIZON_PERIOD, inSamePeriod, monthDayDate, periodHorizon, periodKey, weekStart } from './period'
import { autoDue, whenDate } from './when'
import { HORIZONS, PRIORITIES, type BoardHorizon, type Habit, type HabitBreak, type HabitEnd, type Horizon, type MonthDay, type Period, type PlannerData, type Priority, type Project, type Task } from './types'

/**
 * 時間軸ボードの決まりごと（画面に依存しない計算）。
 *
 * - 番号は列ごと・優先度ごとに 1 から（A1, A2, B1 …）
 * - 「今日やる」などで下ろすと、元は列に残したまま薄く表示する。下ろした先で終えたら、元も終える
 * - 下ろした先の期間（今日・今週）が過ぎて終わっていなければ、下ろした先からは消え、元の薄い表示も戻る
 * - 今日の列の「明日」の欄は、日付が変わると今日の項目になる
 * - 終えた項目は、その列の今の期間のあいだは取り消し線で残し、期間が変わると見えなくなる（データには残る）
 *
 * 日付が変わっても、保存してあるデータは書き換えない（表示のときに判断する）。
 * 2 台で同時に「日付が変わったので書き換える」ことが起きず、同期で競合しないようにするため。
 */

/** 下ろす先。tomorrow は今日の列の「明日」の欄 */
/** tomorrow は今日の列の「明日」の欄、nextweek は今週の列の「来週」の欄 */
export type PlaceTarget = BoardHorizon | 'tomorrow' | 'nextweek'

const RANK: Record<BoardHorizon, number> = { today: 0, week: 1, month: 2, year: 3, life: 4 }

/** 下ろした先が、どの期間のためのものかを表す値 */
export function placedForKey(target: PlaceTarget, now: Date): string | undefined {
  if (target === 'today') return dayKey(now)
  if (target === 'tomorrow') return dayKey(addDays(now, 1))
  if (target === 'nextweek') return periodKey('week', addDays(now, 7))
  if (target === 'week') return periodKey('week', now)
  if (target === 'month') return periodKey('month', now)
  return undefined
}

/** その列の今の期間を表す値（placedFor と比べる） */
function currentKey(h: Horizon, now: Date): string | undefined {
  if (h === 'today') return dayKey(now)
  if (h === 'week') return periodKey('week', now)
  if (h === 'month') return periodKey('month', now)
  return undefined
}

/** 下ろした先の項目の期間が過ぎたか */
export function isExpired(task: Task, now: Date): boolean {
  if (!(task.parentId || task.habitId) || !task.placedFor) return false
  const key = currentKey(task.horizon, now)
  return key !== undefined && task.placedFor < key
}

/** 今日の列で、「明日」の欄に出すものか */
/** 今週の列で、「来週」の欄に出すものか（来週のために置いたもの・期日が来週の期日目標） */
export function isForNextWeek(task: Task, now: Date): boolean {
  if (followsDue(task)) return goalDueNextWeek(task.due!, now)
  if (isProjectGoal(task)) return false
  return task.horizon === 'week' && !!task.placedFor && task.placedFor > periodKey('week', now)
}

/** 期日が来週（次の月曜〜日曜）か */
export function goalDueNextWeek(due: string, now: Date): boolean {
  const start = addDays(weekStart(now), 7)
  return due >= dayKey(start) && due <= dayKey(addDays(start, 6))
}

export function isForTomorrow(task: Task, now: Date): boolean {
  if (followsDue(task)) return daysUntil(task.due!, now) === 1
  return task.horizon === 'today' && !!task.placedFor && task.placedFor > dayKey(now)
}

/**
 * 日付（due）に合わせて列を自動で決める項目か。
 * 日付のある、やること・期日目標（下ろした先のコピーや、習慣から下ろしたものは除く）
 */
export function followsDue(task: Task): boolean {
  return !!task.due && !task.parentId && !task.habitId
}

/** プロジェクトの期日目標か（下ろした先のコピーではないもの） */
export function isProjectGoal(task: Task): boolean {
  return !!task.projectId && !task.parentId
}

/**
 * 期日から、時間軸のどの列に出すかを決める。
 * 今日まで（過ぎたものも）・明日 → 今日（明日は「明日」の欄）／今週の日曜まで → 今週／来週 → 今週の列の「来週」の欄／
 * 3 か月以内 → 数か月／1 年以内 → 今年／それより先 → 一生
 */
export function horizonForDue(due: string, now: Date): BoardHorizon {
  const days = daysUntil(due, now)
  if (days === null) return 'life'
  // 今日まで（過ぎたものも）と明日（今日の列の「明日」の欄）→ 今日
  if (days <= 1) return 'today'
  // 今週の日曜まで → 今週。来週の日曜まで → 今週の列の「来週」の欄
  if (due <= dayKey(addDays(weekStart(now), 13))) return 'week'
  if (days <= 92) return 'month'
  if (days <= 366) return 'year'
  return 'life'
}

/**
 * その項目が今いる列。
 * プロジェクトの期日目標は、期日から自動で決める（期日が無ければ、プロジェクトの中だけ＝pool）。
 * それ以外は、保存してある列。
 */
export function effectiveHorizon(task: Task, now: Date): Horizon {
  if (followsDue(task)) return horizonForDue(task.due!, now)
  // 期日の無い期日目標は、プロジェクトの中だけ
  if (isProjectGoal(task)) return 'pool'
  return task.horizon
}

/** 終えた項目を、まだ列に見せておくか（その列の今の期間に終えたものだけ） */
function doneStillVisible(task: Task, now: Date): boolean {
  if (!task.doneAt) return true
  const h = effectiveHorizon(task, now)
  if (h === 'pool') return true
  return inSamePeriod(HORIZON_PERIOD[h], task.doneAt, now)
}

/** 列に見せるか */
export function isVisible(task: Task, now: Date): boolean {
  if (isExpired(task, now)) return false
  return doneStillVisible(task, now)
}

/** その項目から下ろして、今も生きている項目（無ければ undefined） */
export function activeChild(task: Task, tasks: Task[], now: Date): Task | undefined {
  return tasks.find((t) => t.parentId === task.id && !isExpired(t, now))
}

/** 下ろせる先（自分の列より短い期間の列と、明日） */
export function placeTargets(h: Horizon): PlaceTarget[] {
  if (h === 'pool') return [...HORIZONS]
  if (h === 'today') return []
  const rank = RANK[h]
  const lower = HORIZONS.filter((x) => RANK[x] < rank)
  // 今日の次に「明日」を入れる
  return lower.flatMap((x): PlaceTarget[] => (x === 'today' ? ['today', 'tomorrow'] : x === 'week' ? ['week', 'nextweek'] : [x]))
}

/** すぐ下ろすボタンの先（1 つ短い列。今週 → 今日、数か月 → 今週、今年 → 数か月） */
export function quickTarget(h: Horizon): PlaceTarget | undefined {
  return placeTargets(h).filter((t) => t !== 'tomorrow' && t !== 'nextweek').at(-1)
}

/**
 * ドラッグで移せる、空の優先度の場所（項目が 1 つも無い優先度にも、ドラッグで移せるように）。
 * present は、項目のある優先度（A → P の順）。空の優先度を、並びの間に割り当てる。
 * before[p]: p のまとまりのすぐ上に出すもの／after: 最後のまとまりの下に出すもの。
 * 例: present が B・C なら、before.B = [A]、after = [D, P]
 */
export function emptyPriorityGaps(present: Priority[]): { before: Partial<Record<Priority, Priority[]>>; after: Priority[] } {
  const has = new Set(present)
  const before: Partial<Record<Priority, Priority[]>> = {}
  let waiting: Priority[] = []
  for (const p of PRIORITIES) {
    if (!has.has(p)) {
      waiting.push(p)
      continue
    }
    if (waiting.length) before[p] = waiting
    waiting = []
  }
  return { before, after: has.size ? waiting : [] }
}

/** 優先度ごと・順番どおりに並べ、番号（A1 など）を付ける */
export function numbered(tasks: Task[]): { task: Task; label: string }[] {
  const out: { task: Task; label: string }[] = []
  for (const p of PRIORITIES) {
    tasks
      .filter((t) => t.priority === p)
      .sort(byOrder)
      .forEach((task, i) => out.push({ task, label: `${p}${i + 1}` }))
  }
  return out
}

function byOrder(a: { order: number; createdAt: string }, b: { order: number; createdAt: string }): number {
  return a.order - b.order || a.createdAt.localeCompare(b.createdAt)
}

// ─── 画面に出す形 ────────────────────────────────────────────

export interface TaskView {
  task: Task
  /** いま出している列（期日目標は期日から自動で決まる） */
  horizon: Horizon
  /** 番号（A1 など） */
  label: string
  done: boolean
  /** 下ろした先が生きているので、薄く表示する */
  faded: boolean
  /** 下ろした先（薄い表示のときに「→今日」などと出す） */
  placedTo?: PlaceTarget
  /** 下ろしてきた元（「←今週」などと出す） */
  from?: Horizon
  project?: Project
}

export interface HabitView {
  habit: Habit
  checked: boolean
  project?: Project
  /** 下ろした先が生きているので、薄く表示する */
  faded: boolean
  /** 下ろした先（「→今日」など） */
  placedTo?: PlaceTarget
  /** 毎月の「その日」が近いので、この列にも自動で出しているもの（並べ替えはしない） */
  auto: boolean
  /** この列での「その日」（auto のとき、または day を決めた毎月の習慣） */
  dueDay?: Date
}

export interface ColumnView {
  horizon: BoardHorizon
  habitPeriod?: Period
  habits: HabitView[]
  tasks: TaskView[]
  /** 今日の列だけ：明日の欄 */
  tomorrow: TaskView[]
  /** 今週の列だけ：来週の欄 */
  nextWeek: TaskView[]
  /** この列の期間の、終えた習慣（卒業・お休み。新しく終えた順）。一番下の「これまでの習慣」に出す */
  ended: Habit[]
}

export function buildColumns(data: PlannerData, now: Date): ColumnView[] {
  const projects = new Map(data.projects.map((p) => [p.id, p]))
  const byId = new Map(data.tasks.map((t) => [t.id, t]))
  const habitsById = new Map(data.habits.map((x) => [x.id, x]))
  const habitHorizon = (id: string): Horizon | undefined => {
    const habit = habitsById.get(id)
    return habit ? periodHorizon(habit.period) : undefined
  }

  const view = (task: Task, label: string): TaskView => {
    const child = activeChild(task, data.tasks, now)
    const parent = task.parentId ? byId.get(task.parentId) : undefined
    return {
      task,
      horizon: effectiveHorizon(task, now),
      label,
      done: !!task.doneAt,
      faded: !!child && !task.doneAt,
      placedTo: child ? (isForTomorrow(child, now) ? 'tomorrow' : isForNextWeek(child, now) ? 'nextweek' : (child.horizon as BoardHorizon)) : undefined,
      from: parent ? effectiveHorizon(parent, now) : task.habitId ? habitHorizon(task.habitId) : undefined,
      project: task.projectId ? projects.get(task.projectId) : undefined,
    }
  }

  return HORIZONS.map((h) => {
    const visible = data.tasks.filter((t) => effectiveHorizon(t, now) === h && isVisible(t, now))
    const main = h === 'today' ? visible.filter((t) => !isForTomorrow(t, now)) : h === 'week' ? visible.filter((t) => !isForNextWeek(t, now)) : visible
    const tomorrow = h === 'today' ? visible.filter((t) => isForTomorrow(t, now)) : []
    const nextWeek = h === 'week' ? visible.filter((t) => isForNextWeek(t, now)) : []
    const habitPeriod = HORIZON_HABIT_PERIOD[h]
    const habitView = (habit: Habit, auto: boolean, dueDay?: Date): HabitView => {
      const checked = inSamePeriod(habit.period, habit.checkedAt, now)
      const child = activeHabitChild(habit, data.tasks, now)
      return {
        habit,
        checked,
        project: habit.projectId ? projects.get(habit.projectId) : undefined,
        faded: !!child && !checked && !auto,
        placedTo: child && !auto ? (isForTomorrow(child, now) ? 'tomorrow' : isForNextWeek(child, now) ? 'nextweek' : (child.horizon as BoardHorizon)) : undefined,
        auto,
        dueDay: dueDay ?? whenDate(habit, now),
      }
    }
    // 終えた習慣（卒業・お休み）は、チェックの一覧には出さない
    const live = data.habits.filter((x) => !x.endedAt)
    const own = habitPeriod ? live.filter((x) => x.period === habitPeriod).sort(byOrder).map((x) => habitView(x, false)) : []
    // 毎月の習慣で「その日」が近いもの（今日の列: その日を過ぎてまだのもの／今週の列: その日が今週のもの）
    const autos: HabitView[] = []
    for (const habit of live.filter((x) => x.period !== habitPeriod).sort(byOrder)) {
      const due = autoDue(habit, h, now)
      if (due) autos.push(habitView(habit, true, due))
    }
    const habits = [...own, ...autos]
    return {
      horizon: h,
      habitPeriod,
      habits,
      tasks: numbered(main).map(({ task, label }) => view(task, label)),
      tomorrow: numbered(tomorrow).map(({ task, label }) => view(task, label)),
      nextWeek: numbered(nextWeek).map(({ task, label }) => view(task, label)),
      ended: habitPeriod ? endedHabits(data.habits.filter((x) => x.period === habitPeriod)) : [],
    }
  })
}

// ─── 変更（保存するものを返す。画面の外で保存する） ─────────────────

/**
 * 変更（保存するもの）。関数は、データを直接は変えずに、これを返す。
 * アプリは、これを保存先に書き、applyChanges で手元のデータにも当てる
 */
export interface Changes {
  tasks?: Task[]
  habits?: Habit[]
  projects?: Project[]
  deleteTaskIds?: string[]
  deleteHabitIds?: string[]
  deleteProjectIds?: string[]
}

const iso = (now: Date) => now.toISOString()

/** 同じ列・同じ優先度の末尾の順番 */
function nextOrder(tasks: Task[], horizon: Horizon, priority: Priority): number {
  const same = tasks.filter((t) => t.horizon === horizon && t.priority === priority)
  return same.length === 0 ? 0 : Math.max(...same.map((t) => t.order)) + 1
}

export function newTask(
  data: PlannerData,
  input: { title: string; horizon: Horizon; priority: Priority; tomorrow?: boolean; nextWeek?: boolean; projectId?: string; due?: string },
  now: Date,
): Task {
  const t = iso(now)
  return {
    id: crypto.randomUUID(),
    title: input.title,
    horizon: input.horizon,
    priority: input.priority,
    order: nextOrder(data.tasks, input.horizon, input.priority),
    ...(input.tomorrow ? { placedFor: placedForKey('tomorrow', now) } : {}),
    ...(input.nextWeek ? { placedFor: placedForKey('nextweek', now) } : {}),
    ...(input.projectId ? { projectId: input.projectId } : {}),
    ...(input.due ? { due: input.due } : {}),
    createdAt: t,
    updatedAt: t,
  }
}

/**
 * 下ろす（「今日やる」「明日やる」「今週やる」など）。
 * 元は残したまま、下ろした先に同じ名前・同じ優先度の項目を作る。
 * すでに下ろしてあって、まだ終えていなければ、そちらを動かす（2 つにはしない）。
 */
export function placeDown(data: PlannerData, task: Task, target: PlaceTarget, now: Date): Changes {
  const t = iso(now)
  const horizon: BoardHorizon = target === 'tomorrow' ? 'today' : target === 'nextweek' ? 'week' : target
  const existing = activeChild(task, data.tasks, now)
  const deleteTaskIds = existing && !existing.doneAt ? descendantsOf(data.tasks, existing.id, now).concat(existing.id) : []
  const child: Task = {
    id: crypto.randomUUID(),
    title: task.title,
    horizon,
    priority: task.priority,
    order: nextOrder(data.tasks, horizon, task.priority),
    parentId: task.id,
    ...(placedForKey(target, now) ? { placedFor: placedForKey(target, now) } : {}),
    ...(task.projectId ? { projectId: task.projectId } : {}),
    ...(task.due ? { due: task.due } : {}),
    ...(task.note ? { note: task.note } : {}),
    createdAt: t,
    updatedAt: t,
  }
  return { tasks: [child], deleteTaskIds }
}

/** 下ろした先から戻す（↩）。下ろした先の項目を消すと、元の薄い表示が戻る */
export function returnUp(data: PlannerData, task: Task, now: Date): Changes {
  return { deleteTaskIds: [task.id, ...descendantsOf(data.tasks, task.id, now)] }
}

/** 列を移す（プロジェクトの置き場から列に置く、など）。下ろした先の項目は、そのまま */
export function moveTo(data: PlannerData, task: Task, horizon: Horizon, now: Date): Changes {
  if (task.horizon === horizon) return {}
  const { placedFor: _p, ...rest } = task
  return { tasks: [{ ...rest, horizon, order: nextOrder(data.tasks, horizon, task.priority), updatedAt: iso(now) }] }
}

/** 生きている子孫（下ろした先、さらにその先） */
function descendantsOf(tasks: Task[], id: string, now: Date): string[] {
  const out: string[] = []
  for (const t of tasks) {
    if (t.parentId === id && !isExpired(t, now)) out.push(t.id, ...descendantsOf(tasks, t.id, now))
  }
  return out
}

/**
 * 終える・終えたのを取り消す。
 * 下ろした先で終えたら、元（さらにその元）も終える。元で終えたら、生きている下ろした先も終える。
 */
export function toggleDone(data: PlannerData, task: Task, now: Date): Changes {
  const byId = new Map(data.tasks.map((t) => [t.id, t]))
  const ids = new Set<string>([task.id, ...descendantsOf(data.tasks, task.id, now)])
  for (let p = task.parentId ? byId.get(task.parentId) : undefined; p; p = p.parentId ? byId.get(p.parentId) : undefined) {
    ids.add(p.id)
  }
  const t = iso(now)
  const finishing = !task.doneAt
  const tasks = [...ids]
    .map((id) => byId.get(id))
    .filter((x): x is Task => !!x)
    .map((x) => {
      const { doneAt: _d, ...rest } = x
      return finishing ? { ...rest, doneAt: x.doneAt ?? t, updatedAt: t } : { ...rest, updatedAt: t }
    })
  // 習慣から下ろしたものなら、習慣の今の期間のチェックも合わせる
  const habit = task.habitId ? data.habits.find((x) => x.id === task.habitId) : undefined
  if (habit && inSamePeriod(habit.period, habit.checkedAt, now) !== finishing) {
    return { tasks, habits: [toggleHabit(habit, now)] }
  }
  return { tasks }
}

/** 同じ列・同じ優先度の中で、1 つ上・下と入れ替える */
export function moveStep(data: PlannerData, task: Task, step: -1 | 1, now: Date): Changes {
  const same = data.tasks
    .filter((t) => t.horizon === task.horizon && t.priority === task.priority && isVisible(t, now) && isForTomorrow(t, now) === isForTomorrow(task, now))
    .sort(byOrder)
  const i = same.findIndex((t) => t.id === task.id)
  const j = i + step
  if (i < 0 || j < 0 || j >= same.length) return {}
  const t = iso(now)
  // 入れ替えてから 0, 1, 2 … と振り直す（同じ order が並んでいても動くように）。変わったものだけ保存する
  const swapped = [...same]
  ;[swapped[i], swapped[j]] = [swapped[j], swapped[i]]
  const before = new Map(same.map((x) => [x.id, x.order]))
  return {
    tasks: swapped.map((x, k) => ({ ...x, order: k, updatedAt: t })).filter((x) => before.get(x.id) !== x.order),
  }
}

/** 優先度を変える（新しい優先度の末尾へ） */
export function setPriority(data: PlannerData, task: Task, priority: Priority, now: Date): Changes {
  if (task.priority === priority) return {}
  return { tasks: [{ ...task, priority, order: nextOrder(data.tasks, task.horizon, priority), updatedAt: iso(now) }] }
}

/** 消す（下ろした先も一緒に消す） */
export function removeTask(data: PlannerData, task: Task, now: Date): Changes {
  return { deleteTaskIds: [task.id, ...descendantsOf(data.tasks, task.id, now)] }
}

// ─── 習慣 ───────────────────────────────────────────────────

export function newHabit(data: PlannerData, input: { title: string; period: Period; projectId?: string }, now: Date): Habit {
  const same = data.habits.filter((h) => h.period === input.period)
  const t = iso(now)
  return {
    id: crypto.randomUUID(),
    title: input.title,
    period: input.period,
    order: same.length === 0 ? 0 : Math.max(...same.map((h) => h.order)) + 1,
    ...(input.projectId ? { projectId: input.projectId } : {}),
    createdAt: t,
    updatedAt: t,
  }
}

/** 習慣のチェックを付ける・外す（今の期間の分） */
export function toggleHabit(habit: Habit, now: Date): Habit {
  const { checkedAt: _c, ...rest } = habit
  const t = iso(now)
  const history = habit.history ?? []
  if (inSamePeriod(habit.period, habit.checkedAt, now)) {
    // 外す: チェックした日の記録も消す
    const day = dayKey(new Date(habit.checkedAt!))
    return { ...rest, history: history.filter((d) => d !== day), updatedAt: t }
  }
  const today = dayKey(now)
  const next = history.includes(today) ? history : [...history, today].sort().slice(-HABIT_HISTORY_LIMIT)
  return { ...rest, checkedAt: t, history: next, updatedAt: t }
}

/** 習慣の記録を残す日数の上限 */
export const HABIT_HISTORY_LIMIT = 800

// ─── 習慣を終える（卒業・お休み）・また始める ─────────────────────

/** 終えた習慣（卒業・お休み）だけを、新しく終えた順に */
export function endedHabits(habits: Habit[]): Habit[] {
  return habits.filter((h) => h.endedAt).sort((a, b) => b.endedAt!.localeCompare(a.endedAt!))
}

/**
 * 習慣を終える（卒業・お休み）。チェックの記録は残し、時間軸・プロジェクトのチェックの一覧からは外す
 * （一番下の「これまでの習慣」に出る）。下ろした先で、まだ終えていないやることは消す。
 * もう終えている習慣なら、終えた日はそのままで、終え方とひとことだけを変える
 */
export function endHabit(data: PlannerData, habit: Habit, as: HabitEnd, endNote: string, now: Date): Changes {
  const t = iso(now)
  const { endNote: _n, ...rest } = habit
  const note = endNote.trim()
  const next: Habit = { ...rest, endedAt: habit.endedAt ?? t, endedAs: as, ...(note ? { endNote: note } : {}), updatedAt: t }
  const open = habit.endedAt ? [] : data.tasks.filter((x) => x.habitId === habit.id && !x.doneAt && !isExpired(x, now))
  return { habits: [next], ...(open.length ? { deleteTaskIds: open.map((x) => x.id) } : {}) }
}

/**
 * 終えた習慣を、また始める（同じ期間の習慣の一番下へ）。
 * 終えた日と同じ日なら、終えたのを取り消すだけ。別の日なら、休んでいた間（breaks）を残す
 * （振り返りで、休んでいた日を「できなかった日」に数えないため）
 */
export function resumeHabit(data: PlannerData, habit: Habit, now: Date): Changes {
  if (!habit.endedAt) return {}
  const t = iso(now)
  const { endedAt, endedAs, endNote, breaks: _b, ...rest } = habit
  const sameDay = dayKey(new Date(endedAt)) === dayKey(now)
  const gap: HabitBreak = { endedAt, endedAs: endedAs ?? 'paused', ...(endNote ? { endNote } : {}), resumedAt: t }
  const breaks = sameDay ? (habit.breaks ?? []) : [...(habit.breaks ?? []), gap]
  const same = data.habits.filter((h) => h.period === habit.period && !h.endedAt && h.id !== habit.id)
  const order = same.length === 0 ? 0 : Math.max(...same.map((h) => h.order)) + 1
  return { habits: [{ ...rest, ...(breaks.length ? { breaks } : {}), order, updatedAt: t }] }
}

// ─── プロジェクト ─────────────────────────────────────────────

export function newProject(data: PlannerData, input: { name: string; color: string; parentId?: string }, now: Date): Project {
  const t = iso(now)
  const siblings = data.projects.filter((p) => p.parentId === input.parentId)
  return {
    id: crypto.randomUUID(),
    name: input.name,
    color: input.color,
    order: siblings.length === 0 ? 0 : Math.max(...siblings.map((p) => p.order)) + 1,
    ...(input.parentId ? { parentId: input.parentId } : {}),
    createdAt: t,
    updatedAt: t,
  }
}

/** テーマの中のプロジェクト（順番どおり） */
export function childProjects(data: PlannerData, parentId: string): Project[] {
  return data.projects.filter((p) => p.parentId === parentId).sort((a, b) => a.order - b.order)
}

/** いちばん上に並べるカード（テーマ・プロジェクト）。入っているテーマが見つからないものも上に出す */
export function topProjects(data: PlannerData): Project[] {
  const ids = new Set(data.projects.map((p) => p.id))
  return data.projects.filter((p) => !p.parentId || !ids.has(p.parentId)).sort((a, b) => a.order - b.order)
}

/** プロジェクトを消す（期日目標・ルーチン目標も一緒に。列に置いたものも消す。テーマなら中のプロジェクトも） */
export function removeProject(data: PlannerData, project: Project): Changes {
  const ids = new Set([project.id, ...childProjects(data, project.id).map((p) => p.id)])
  return {
    deleteProjectIds: [...ids],
    deleteTaskIds: data.tasks.filter((t) => t.projectId && ids.has(t.projectId)).map((t) => t.id),
    deleteHabitIds: data.habits.filter((h) => h.projectId && ids.has(h.projectId)).map((h) => h.id),
  }
}

/**
 * プロジェクトをテーマの中へ入れる（parentId）・テーマから出す（undefined）。
 * 中にプロジェクトがあるもの（テーマ）は、ほかのテーマには入れない（1 段だけ）
 */
export function moveProject(data: PlannerData, project: Project, parentId: string | undefined, now: Date): Changes {
  if (parentId === project.parentId || parentId === project.id) return {}
  if (parentId && childProjects(data, project.id).length > 0) return {}
  const siblings = data.projects.filter((p) => p.parentId === parentId && p.id !== project.id)
  const { parentId: _p, ...rest } = project
  return {
    projects: [
      {
        ...rest,
        ...(parentId ? { parentId } : {}),
        order: siblings.length === 0 ? 0 : Math.max(...siblings.map((p) => p.order)) + 1,
        updatedAt: iso(now),
      },
    ],
  }
}

/** id で、足す・置き換える・消す（並びは今のまま。新しいものは後ろへ） */
export function mergeById<T extends { id: string }>(list: T[], puts: T[] = [], dels: string[] = []): T[] {
  const gone = new Set(dels)
  const byId = new Map(puts.map((x) => [x.id, x]))
  const kept = list.filter((x) => !gone.has(x.id)).map((x) => byId.get(x.id) ?? x)
  const added = puts.filter((x) => !list.some((y) => y.id === x.id) && !gone.has(x.id))
  return [...kept, ...added]
}

/**
 * 保存せずに、変更を手元のデータに当てる（画面をすぐ変えるため・テスト用）。
 * データにアプリが足した項目（日記など）は、そのまま残す
 */
export function applyChanges<D extends PlannerData>(data: D, c: Changes): D {
  return {
    ...data,
    tasks: mergeById(data.tasks, c.tasks, c.deleteTaskIds),
    habits: mergeById(data.habits, c.habits, c.deleteHabitIds),
    projects: mergeById(data.projects, c.projects, c.deleteProjectIds),
  }
}

// ─── ドラッグでの並べ替え ──────────────────────────────────────

/** 並びの中で、from の位置のものを to の位置へ動かした新しい並び */
function moveInList<T>(list: T[], from: number, to: number): T[] {
  const next = [...list]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * やることをドラッグで並べ替える。
 * ids は、いま画面に並んでいる順（優先度 A → P、各優先度の中は順番どおり）。
 * 落とした先の項目と同じ優先度になる（B のまとまりへ落とせば B に変わる）。
 * 変わったものだけを返す。
 */
export function reorderTasks(data: PlannerData, ids: string[], activeId: string, overId: string, now: Date): Changes {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return {}
  const byId = new Map(data.tasks.map((t) => [t.id, t]))
  const over = byId.get(overId)
  const active = byId.get(activeId)
  if (!over || !active) return {}
  const priority = over.priority
  const moved = moveInList(ids, from, to)
    .map((id) => byId.get(id))
    .filter((t): t is Task => !!t)
    .map((t) => (t.id === activeId ? { ...t, priority } : t))
  const t = iso(now)
  const changed: Task[] = []
  for (const p of PRIORITIES) {
    moved
      .filter((x) => x.priority === p)
      .forEach((x, order) => {
        const before = byId.get(x.id)!
        if (before.order !== order || before.priority !== x.priority) changed.push({ ...x, order, updatedAt: t })
      })
  }
  return { tasks: changed }
}

/** 習慣をドラッグで並べ替える（ids は、いま並んでいる順） */
export function reorderHabits(data: PlannerData, ids: string[], activeId: string, overId: string, now: Date): Changes {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return {}
  const byId = new Map(data.habits.map((h) => [h.id, h]))
  const t = iso(now)
  const habits = moveInList(ids, from, to)
    .map((id, order) => ({ habit: byId.get(id), order }))
    .filter((x): x is { habit: Habit; order: number } => !!x.habit && x.habit.order !== x.order)
    .map(({ habit, order }) => ({ ...habit, order, updatedAt: t }))
  return { habits }
}

/** プロジェクトをドラッグで並べ替える（左ほど優先が高い） */
export function reorderProjects(data: PlannerData, activeId: string, overId: string, now: Date): Changes {
  // 同じところ（いちばん上・同じテーマの中）に並ぶものの中で並べ替える
  const active = data.projects.find((p) => p.id === activeId)
  const ids = [...data.projects]
    .filter((p) => p.parentId === active?.parentId)
    .sort((a, b) => a.order - b.order)
    .map((p) => p.id)
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return {}
  const byId = new Map(data.projects.map((p) => [p.id, p]))
  const t = iso(now)
  const projects = moveInList(ids, from, to)
    .map((id, order) => ({ project: byId.get(id)!, order }))
    .filter(({ project, order }) => project.order !== order)
    .map(({ project, order }) => ({ ...project, order, updatedAt: t }))
  return { projects }
}

// ─── 習慣を下ろす・毎月の「その日」 ─────────────────────────────

/** その習慣から下ろして、今も生きている項目（無ければ undefined） */
export function activeHabitChild(habit: Habit, tasks: Task[], now: Date): Task | undefined {
  return tasks.find((t) => t.habitId === habit.id && !isExpired(t, now))
}

/** 習慣の下ろせる先（習慣の列より短い期間の列と、明日） */
export function habitPlaceTargets(habit: Habit): PlaceTarget[] {
  return placeTargets(periodHorizon(habit.period))
}

/**
 * 習慣を下ろす（今週やる・今日やる など）。習慣はそのまま残し、下ろした先に同じ名前のやること（C）を作る。
 * 下ろした先で終えたら、習慣の今の期間のチェックが付く。前に下ろして終えていないものは動かす
 */
export function placeHabitDown(data: PlannerData, habit: Habit, target: PlaceTarget, now: Date): Changes {
  const t = iso(now)
  const horizon: BoardHorizon = target === 'tomorrow' ? 'today' : target === 'nextweek' ? 'week' : target
  const existing = activeHabitChild(habit, data.tasks, now)
  const child: Task = {
    id: crypto.randomUUID(),
    title: habit.title,
    horizon,
    priority: 'C',
    order: nextOrder(data.tasks, horizon, 'C'),
    habitId: habit.id,
    ...(placedForKey(target, now) ? { placedFor: placedForKey(target, now) } : {}),
    ...(habit.projectId ? { projectId: habit.projectId } : {}),
    ...(habit.note ? { note: habit.note } : {}),
    createdAt: t,
    updatedAt: t,
  }
  return { tasks: [child], deleteTaskIds: existing && !existing.doneAt ? [existing.id] : [] }
}

/** 習慣のチェックを付ける・外す。下ろした先があれば、その「終えた」も合わせる */
export function toggleHabitAll(data: PlannerData, habit: Habit, now: Date): Changes {
  const next = toggleHabit(habit, now)
  const checking = inSamePeriod(next.period, next.checkedAt, now)
  const child = activeHabitChild(habit, data.tasks, now)
  if (!child || !!child.doneAt === checking) return { habits: [next] }
  const t = iso(now)
  const { doneAt: _d, ...rest } = child
  return { habits: [next], tasks: [checking ? { ...rest, doneAt: t, updatedAt: t } : { ...rest, updatedAt: t }] }
}

/** 習慣を「やること」にする（1 回やれば終わるもの）。同じ期間の列の C に入れ、習慣は消す */
export function habitToTask(data: PlannerData, habit: Habit, now: Date): Changes {
  const task = newTask(data, { title: habit.title, horizon: periodHorizon(habit.period), priority: 'C', projectId: habit.projectId }, now)
  return { tasks: [habit.note ? { ...task, note: habit.note } : task], deleteHabitIds: [habit.id] }
}

/** 毎月の習慣の、その月の「その日」（日が無い月は月末に寄せる） */
export function monthlyDueDate(habit: Habit, month: Date): Date | undefined {
  if (!habit.day) return undefined
  return monthDayDate(habit.day, month)
}

/** やることの日付を決める・外す（空なら外す）。日付があれば、日付に合わせて列が自動で決まる */
export function setDue(task: Task, due: string): Changes {
  const { due: _d, ...rest } = task
  const t = new Date().toISOString()
  return { tasks: [due ? { ...rest, due, updatedAt: t } : { ...rest, updatedAt: t }] }
}

/** 毎月の習慣の「その日」を決める・外す（undefined なら外す） */
export function withDay(habit: Habit, day: MonthDay | undefined): Habit {
  const { day: _d, ...rest } = habit
  return { ...rest, ...(day !== undefined ? { day } : {}), updatedAt: new Date().toISOString() }
}

// ─── 振り返りから付け直す・明日にまわす ─────────────────────────

/**
 * 習慣を、その日（過ぎた日も）にできた・できなかったことにする（振り返りから付け直す）。
 * 今の期間の日なら、今のチェック（checkedAt）も合わせる
 */
export function toggleHabitOnDay(habit: Habit, day: Date, now: Date): Habit {
  const key = dayKey(day)
  const history = habit.history ?? []
  const t = iso(now)
  const current = periodKey(habit.period, day) === periodKey(habit.period, now)
  if (history.includes(key)) {
    const { checkedAt: _c, ...rest } = habit
    const next = history.filter((d) => d !== key)
    const keepCheck = habit.checkedAt && dayKey(new Date(habit.checkedAt)) !== key
    return { ...(keepCheck ? habit : rest), history: next, updatedAt: t }
  }
  const next = [...history, key].sort().slice(-HABIT_HISTORY_LIMIT)
  const at = key === dayKey(now) ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12)
  const check = current && !inSamePeriod(habit.period, habit.checkedAt, now)
  return { ...habit, ...(check ? { checkedAt: iso(at) } : {}), history: next, updatedAt: t }
}

/** やることを、その日に終えたことにする（振り返りから付け直す。今日なら今の時刻、過ぎた日ならその日の正午） */
export function finishOnDay(data: PlannerData, task: Task, day: Date, now: Date): Changes {
  const at = dayKey(day) === dayKey(now) ? now : new Date(day.getFullYear(), day.getMonth(), day.getDate(), 12)
  return toggleDone(data, task, at)
}

/**
 * 今日の列のやることを、明日にまわす（明日の欄へ）。
 * 日付のあるものは日付を明日に、それ以外は「明日の分」にする
 */
export function postponeToTomorrow(task: Task, now: Date): Changes {
  const t = iso(now)
  const tomorrow = dayKey(addDays(now, 1))
  if (followsDue(task)) return { tasks: [{ ...task, due: tomorrow, updatedAt: t }] }
  return { tasks: [{ ...task, horizon: task.parentId || task.habitId ? task.horizon : 'today', placedFor: tomorrow, updatedAt: t }] }
}

/** 明日の欄のやることを、今日にもどす */
export function bringToToday(task: Task, now: Date): Changes {
  const t = iso(now)
  if (followsDue(task)) return { tasks: [{ ...task, due: dayKey(now), updatedAt: t }] }
  if (task.parentId || task.habitId) return { tasks: [{ ...task, placedFor: dayKey(now), updatedAt: t }] }
  const { placedFor: _p, ...rest } = task
  return { tasks: [{ ...rest, horizon: 'today', updatedAt: t }] }
}

// ─── プロジェクトの期日目標の並び ─────────────────────────────

/**
 * プロジェクトの期日目標を並べる（open: 終えていないもの、done: 終えたもの。新しく終えた順。画面では一番下の「終えた目標」にたたむ）。
 * 並びは「席」で考える: どの目標も席（goalOrder）を持ち、
 * - 日付の無いものは、ドラッグで置いた席にそのまま座る（日付のあるものの間にも置ける）
 * - 日付のあるものが座る席には、いつも日付の遠い順に入れ直す（日付のルールは崩れない）
 * 席がまだ無いものは、日付の無いものは上、日付のあるものは下（前の版と同じ並び）
 */
export function projectGoals(data: PlannerData, projectId: string): { open: Task[]; done: Task[] } {
  const goals = data.tasks.filter((x) => isProjectGoal(x) && x.projectId === projectId)
  const open = goals.filter((g) => !g.doneAt)
  const seat = (g: Task) => g.goalOrder ?? (g.due ? Number.MAX_SAFE_INTEGER : Number.MIN_SAFE_INTEGER)
  const seats = [...open].sort((a, b) => seat(a) - seat(b) || a.createdAt.localeCompare(b.createdAt))
  const byDate = open.filter((g) => g.due).sort((a, b) => b.due!.localeCompare(a.due!) || a.createdAt.localeCompare(b.createdAt))
  let next = 0
  const ordered = seats.map((g) => (g.due ? byDate[next++] : g))
  const done = goals.filter((g) => g.doneAt).sort((a, b) => b.doneAt!.localeCompare(a.doneAt!) || a.createdAt.localeCompare(b.createdAt))
  return { open: ordered, done }
}

/** 新しく足す期日目標の席（いちばん下） */
export function nextGoalOrder(data: PlannerData, projectId: string): number {
  const orders = data.tasks.filter((t) => t.projectId === projectId && t.goalOrder !== undefined).map((t) => t.goalOrder!)
  const count = data.tasks.filter((t) => isProjectGoal(t) && t.projectId === projectId).length
  return Math.max(count, ...orders.map((o) => o + 1))
}

/** 日付の無い期日目標を、ドラッグで好きな席へ動かす（ids は今の並び。日付のあるものも含めて席を振り直す） */
export function reorderGoals(data: PlannerData, ids: string[], activeId: string, overId: string, now: Date): Changes {
  const from = ids.indexOf(activeId)
  const to = ids.indexOf(overId)
  if (from < 0 || to < 0 || from === to) return {}
  const byId = new Map(data.tasks.map((t) => [t.id, t]))
  const t = iso(now)
  const tasks = moveInList(ids, from, to)
    .map((id, goalOrder) => ({ task: byId.get(id), goalOrder }))
    .filter((x): x is { task: Task; goalOrder: number } => !!x.task && x.task.goalOrder !== x.goalOrder)
    .map(({ task, goalOrder }) => ({ ...task, goalOrder, updatedAt: t }))
  return { tasks }
}
