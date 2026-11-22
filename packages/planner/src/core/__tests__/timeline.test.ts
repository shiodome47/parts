import { describe, expect, it } from 'vitest'
import {
  applyChanges,
  buildColumns,
  emptyPriorityGaps,
  childProjects,
  nextGoalOrder,
  projectGoals,
  reorderGoals,
  moveProject,
  removeProject,
  topProjects,
  habitToTask,
  horizonForDue,
  monthlyDueDate,
  moveStep,
  placeHabitDown,
  quickTarget,
  setDue,
  toggleHabitAll,
  newHabit,
  newTask,
  newProject,
  numbered,
  placeDown,
  reorderHabits,
  reorderProjects,
  reorderTasks,
  placeTargets,
  returnUp,
  toggleDone,
  toggleHabit,
} from '../logic'
import { dayLabel, dueLabel, monthDayDate, periodLabel, shortDueLabel, weekKey } from '../period'
import type { BoardHorizon, PlannerData, MonthDay, Priority } from '../types'
import { whenLabel } from '../when'

// 2026-11-17（火）9:00
const TUE = new Date(2026, 10, 17, 9, 0)
const WED = new Date(2026, 10, 18, 9, 0)
const NEXT_MON = new Date(2026, 10, 23, 9, 0)

const empty = (): PlannerData => ({ tasks: [], habits: [], projects: [] })

function add(data: PlannerData, title: string, horizon: BoardHorizon, priority: Priority, now = TUE, tomorrow = false): PlannerData {
  return applyChanges(data, { tasks: [newTask(data, { title, horizon, priority, tomorrow }, now)] })
}
const col = (data: PlannerData, h: BoardHorizon, now = TUE) => buildColumns(data, now).find((c) => c.horizon === h)!
const titles = (data: PlannerData, h: BoardHorizon, now = TUE) => col(data, h, now).tasks.map((v) => `${v.label} ${v.task.title}`)
const find = (data: PlannerData, title: string, horizon?: string) =>
  data.tasks.find((t) => t.title === title && (!horizon || t.horizon === horizon))!

describe('番号', () => {
  it('優先度ごとに 1 から（A1, A2, B1 …）。どの列でも同じ', () => {
    let d = empty()
    d = add(d, '散髪', 'week', 'B')
    d = add(d, '月初処理', 'week', 'A')
    d = add(d, '段ボール処理', 'week', 'A')
    d = add(d, '爪切り', 'week', 'P')
    expect(titles(d, 'week')).toEqual(['A1 月初処理', 'A2 段ボール処理', 'B1 散髪', 'P1 爪切り'])
    expect(numbered([]).length).toBe(0)
  })

  it('上へ・下へで、同じ優先度の中の順番を入れ替える', () => {
    let d = empty()
    d = add(d, '一', 'today', 'A')
    d = add(d, '二', 'today', 'A')
    d = applyChanges(d, moveStep(d, find(d, '二'), -1, TUE))
    expect(titles(d, 'today')).toEqual(['A1 二', 'A2 一'])
  })
})

describe('空の優先度へドラッグで移す場所', () => {
  it('並んでいる優先度の間に、空の優先度を割り当てる', () => {
    // B・C だけ → B の上に A、C の下に D・P
    expect(emptyPriorityGaps(['B', 'C'])).toEqual({ before: { B: ['A'] }, after: ['D', 'P'] })
    // A・C → A と C の間に B（C の上）
    expect(emptyPriorityGaps(['A', 'C'])).toEqual({ before: { C: ['B'] }, after: ['D', 'P'] })
    // 全部ある → 空の場所は無い
    expect(emptyPriorityGaps(['A', 'B', 'C', 'D', 'P'])).toEqual({ before: {}, after: [] })
    // 何も無い → 出さない（ドラッグする行が無い）
    expect(emptyPriorityGaps([])).toEqual({ before: {}, after: [] })
  })
})

describe('下ろす', () => {
  it('今週の項目を「今日やる」: 今週には薄く残り、今日に出る', () => {
    let d = add(empty(), '散髪', 'week', 'B')
    d = applyChanges(d, placeDown(d, find(d, '散髪'), 'today', TUE))
    const week = col(d, 'week').tasks[0]
    expect(week).toMatchObject({ faded: true, placedTo: 'today' })
    const today = col(d, 'today').tasks[0]
    expect(today).toMatchObject({ label: 'B1', from: 'week' })
  })

  it('下ろした先で終えたら、元も終える。取り消すと元も戻る', () => {
    let d = add(empty(), '散髪', 'month', 'B')
    d = applyChanges(d, placeDown(d, find(d, '散髪'), 'week', TUE))
    d = applyChanges(d, placeDown(d, find(d, '散髪', 'week'), 'today', TUE))
    d = applyChanges(d, toggleDone(d, find(d, '散髪', 'today'), TUE))
    expect(d.tasks.every((t) => t.doneAt)).toBe(true)
    d = applyChanges(d, toggleDone(d, find(d, '散髪', 'today'), TUE))
    expect(d.tasks.every((t) => !t.doneAt)).toBe(true)
  })

  it('その日のうちに終えなければ、日付が変わると今日から消え、元の薄い表示も戻る', () => {
    let d = add(empty(), '散髪', 'week', 'B')
    d = applyChanges(d, placeDown(d, find(d, '散髪'), 'today', TUE))
    expect(col(d, 'today', WED).tasks).toEqual([])
    expect(col(d, 'week', WED).tasks[0]).toMatchObject({ faded: false, placedTo: undefined })
  })

  it('「明日やる」は明日の欄に出て、日付が変わると今日の項目になる', () => {
    let d = add(empty(), '散髪', 'week', 'B')
    d = applyChanges(d, placeDown(d, find(d, '散髪'), 'tomorrow', TUE))
    expect(col(d, 'today').tasks).toEqual([])
    expect(col(d, 'today').tomorrow.map((v) => v.task.title)).toEqual(['散髪'])
    expect(col(d, 'week').tasks[0].placedTo).toBe('tomorrow')
    expect(col(d, 'today', WED).tasks.map((v) => v.task.title)).toEqual(['散髪'])
  })

  it('もう一度下ろすと、前に下ろしたものを動かす（2 つにしない）', () => {
    let d = add(empty(), '散髪', 'week', 'B')
    d = applyChanges(d, placeDown(d, find(d, '散髪'), 'tomorrow', TUE))
    d = applyChanges(d, placeDown(d, find(d, '散髪', 'week'), 'today', TUE))
    expect(d.tasks.filter((t) => t.horizon === 'today')).toHaveLength(1)
    expect(col(d, 'today').tasks).toHaveLength(1)
  })

  it('↩ で戻すと、下ろした先から消える', () => {
    let d = add(empty(), '散髪', 'week', 'B')
    d = applyChanges(d, placeDown(d, find(d, '散髪'), 'today', TUE))
    d = applyChanges(d, returnUp(d, find(d, '散髪', 'today'), TUE))
    expect(col(d, 'today').tasks).toEqual([])
    expect(col(d, 'week').tasks[0].faded).toBe(false)
  })

  it('今週に下ろしたものは、週が変わると消える', () => {
    let d = add(empty(), 'KES 更新', 'month', 'A')
    d = applyChanges(d, placeDown(d, find(d, 'KES 更新'), 'week', TUE))
    expect(col(d, 'week').tasks).toHaveLength(1)
    expect(col(d, 'week', NEXT_MON).tasks).toHaveLength(0)
  })

  it('下ろせる先は、自分より短い期間の列と明日', () => {
    expect(placeTargets('today')).toEqual([])
    expect(placeTargets('week')).toEqual(['today', 'tomorrow'])
    expect(placeTargets('month')).toEqual(['today', 'tomorrow', 'week', 'nextweek'])
  })
})

describe('今日の列に直接足したもの', () => {
  it('終えなければ翌日も残る（戻す先が無いので）', () => {
    const d = add(empty(), '月初処理', 'today', 'A')
    expect(col(d, 'today', WED).tasks.map((v) => v.task.title)).toEqual(['月初処理'])
  })

  it('終えたものは、その日のあいだだけ取り消し線で残る', () => {
    let d = add(empty(), '月初処理', 'today', 'A')
    d = applyChanges(d, toggleDone(d, find(d, '月初処理'), TUE))
    expect(col(d, 'today').tasks[0].done).toBe(true)
    expect(col(d, 'today', WED).tasks).toEqual([])
    // データには残る（振り返り用）
    expect(d.tasks).toHaveLength(1)
  })
})

describe('習慣', () => {
  it('列の期間ごとにチェックが外れる（今日は毎日、今週は週ごと）', () => {
    let d = empty()
    d = applyChanges(d, { habits: [newHabit(d, { title: '瞑想', period: 'day' }, TUE)] })
    d = applyChanges(d, { habits: [newHabit(d, { title: '掃除', period: 'week' }, TUE)] })
    d = applyChanges(d, { habits: d.habits.map((h) => toggleHabit(h, TUE)) })
    expect(col(d, 'today').habits[0].checked).toBe(true)
    expect(col(d, 'today', WED).habits[0].checked).toBe(false)
    expect(col(d, 'week', WED).habits[0].checked).toBe(true)
    expect(col(d, 'week', NEXT_MON).habits[0].checked).toBe(false)
  })
})

describe('プロジェクトの期日目標（期日から自動で列に出る）', () => {
  const goal = (d: PlannerData, title: string, due?: string) =>
    applyChanges(d, { tasks: [newTask(d, { title, horizon: 'pool', priority: 'C', projectId: 'p1', due }, TUE)] })
  const where = (d: PlannerData, title: string, now = TUE) =>
    buildColumns(d, now).find((c) => c.tasks.some((v) => v.task.title === title))?.horizon ?? null

  it('期日までの近さで、今日・今週・数か月・今年・一生に分かれる', () => {
    let d = empty()
    d = goal(d, '過ぎた', '2026-11-10')
    d = goal(d, '今日まで', '2026-11-17')
    d = goal(d, '日曜まで', '2026-11-22')
    d = goal(d, '来週', '2026-11-25')
    d = goal(d, 'TOEIC', '2027-01-24')
    d = goal(d, '半年後', '2027-05-17')
    d = goal(d, '2 年後', '2028-11-17')
    expect(where(d, '過ぎた')).toBe('today')
    expect(where(d, '今日まで')).toBe('today')
    expect(where(d, '日曜まで')).toBe('week')
    expect(where(d, '来週')).toBeNull() // 来週の期日は、今週の列の「来週」の欄
    expect(col(d, 'week').nextWeek.map((v) => v.task.title)).toEqual(['来週'])
    expect(where(d, 'TOEIC')).toBe('month')
    expect(where(d, '半年後')).toBe('year')
    expect(where(d, '2 年後')).toBe('life')
    expect(horizonForDue('2026-11-23', TUE)).toBe('week')
    expect(horizonForDue('2026-11-30', TUE)).toBe('month')
  })

  it('日がたつと、列も近い方へ移っていく', () => {
    const d = goal(empty(), 'TOEIC', '2027-01-24')
    expect(where(d, 'TOEIC', TUE)).toBe('month')
    expect(where(d, 'TOEIC', new Date(2027, 0, 19, 9))).toBe('week')
    expect(where(d, 'TOEIC', new Date(2027, 0, 24, 9))).toBe('today')
  })

  it('期日が無ければ、時間軸には出ない（プロジェクトの中だけ）', () => {
    const d = goal(empty(), 'いつか')
    expect(where(d, 'いつか')).toBeNull()
  })

  it('期日目標から「今日やる」で下ろすと、元は自動の列に薄く残る', () => {
    let d = goal(empty(), 'TOEIC', '2027-01-24')
    d = applyChanges(d, placeDown(d, find(d, 'TOEIC'), 'today', TUE))
    expect(col(d, 'month').tasks[0]).toMatchObject({ faded: true, placedTo: 'today' })
    expect(col(d, 'today').tasks[0]).toMatchObject({ from: 'month' })
  })
})

describe('日付', () => {
  it('週は月曜はじまり', () => {
    expect(weekKey(TUE)).toBe('2026-11-16')
    expect(weekKey(new Date(2026, 10, 22, 23, 0))).toBe('2026-11-16') // 日曜
    expect(weekKey(NEXT_MON)).toBe('2026-11-23')
    expect(periodLabel('today', TUE)).toBe('11/17（火）')
    expect(periodLabel('week', TUE)).toBe('11/16〜11/22')
    expect(dueLabel('2026-12-04', TUE)).toBe('12/4')
    expect(dueLabel('2027-01-24', TUE)).toBe('27/1/24')
  })
})

describe('ドラッグでの並べ替え', () => {
  const ids = (d: PlannerData, h: BoardHorizon) => col(d, h).tasks.map((v) => v.task.id)

  it('同じ優先度の中で動かす', () => {
    let d = empty()
    d = add(d, '一', 'today', 'A')
    d = add(d, '二', 'today', 'A')
    d = add(d, '三', 'today', 'A')
    d = applyChanges(d, reorderTasks(d, ids(d, 'today'), find(d, '三').id, find(d, '一').id, TUE))
    expect(titles(d, 'today')).toEqual(['A1 三', 'A2 一', 'A3 二'])
  })

  it('別の優先度のまとまりへ落とすと、その優先度になる', () => {
    let d = empty()
    d = add(d, '月初処理', 'today', 'A')
    d = add(d, '散髪', 'today', 'B')
    d = add(d, '書き出し', 'today', 'B')
    // 散髪 を A の 月初処理 の位置へ
    d = applyChanges(d, reorderTasks(d, ids(d, 'today'), find(d, '散髪').id, find(d, '月初処理').id, TUE))
    expect(titles(d, 'today')).toEqual(['A1 散髪', 'A2 月初処理', 'B1 書き出し'])
    // 月初処理 を B の 書き出し の位置へ（下へ動かす）
    d = applyChanges(d, reorderTasks(d, ids(d, 'today'), find(d, '月初処理').id, find(d, '書き出し').id, TUE))
    expect(titles(d, 'today')).toEqual(['A1 散髪', 'B1 書き出し', 'B2 月初処理'])
  })

  it('習慣・プロジェクトも並べ替えられる（プロジェクトは左ほど優先）', () => {
    let d = empty()
    for (const title of ['瞑想', '早寝', '片付け']) d = applyChanges(d, { habits: [newHabit(d, { title, period: 'day' }, TUE)] })
    const hid = (t: string) => d.habits.find((h) => h.title === t)!.id
    d = applyChanges(d, reorderHabits(d, ['瞑想', '早寝', '片付け'].map(hid), hid('片付け'), hid('瞑想'), TUE))
    expect(col(d, 'today').habits.map((v) => v.habit.title)).toEqual(['片付け', '瞑想', '早寝'])

    for (const name of ['英語', 'そろばん', '自治会']) d = applyChanges(d, { projects: [newProject(d, { name, color: 'teal' }, TUE)] })
    const pid = (n: string) => d.projects.find((p) => p.name === n)!.id
    d = applyChanges(d, reorderProjects(d, pid('自治会'), pid('英語'), TUE))
    expect([...d.projects].sort((a, b) => a.order - b.order).map((p) => p.name)).toEqual(['自治会', '英語', 'そろばん'])
  })
})

describe('メモ', () => {
  it('下ろすとき、メモも一緒に下ろす', () => {
    let d = add(empty(), '朝ルーチン', 'week', 'B')
    d = applyChanges(d, { tasks: [{ ...find(d, '朝ルーチン'), note: '1. 水を飲む\n2. 瞑想' }] })
    d = applyChanges(d, placeDown(d, find(d, '朝ルーチン'), 'today', TUE))
    expect(find(d, '朝ルーチン', 'today').note).toBe('1. 水を飲む\n2. 瞑想')
  })
})

describe('習慣を下ろす（A）', () => {
  const monthly = (d: PlannerData, title: string, day?: number | 'end') => {
    const h = newHabit(d, { title, period: 'month' }, TUE)
    return applyChanges(d, { habits: [day ? { ...h, day } : h] })
  }
  const habit = (d: PlannerData, title: string) => d.habits.find((h) => h.title === title)!

  it('毎月の習慣を「今週やる」→ 今週のやること（C）に出て、習慣は薄く「→今週」', () => {
    let d = monthly(empty(), '散髪')
    d = applyChanges(d, placeHabitDown(d, habit(d, '散髪'), 'week', TUE))
    expect(titles(d, 'week')).toEqual(['C1 散髪'])
    expect(col(d, 'month').habits[0]).toMatchObject({ faded: true, placedTo: 'week' })
    expect(col(d, 'week').tasks[0]).toMatchObject({ from: 'month' })
  })

  it('下ろした先で終えると、習慣の今月の分にチェックが付く（取り消すと外れる）', () => {
    let d = monthly(empty(), '鉄子 980 支払い')
    d = applyChanges(d, placeHabitDown(d, habit(d, '鉄子 980 支払い'), 'today', TUE))
    d = applyChanges(d, toggleDone(d, find(d, '鉄子 980 支払い', 'today'), TUE))
    expect(col(d, 'month').habits[0].checked).toBe(true)
    d = applyChanges(d, toggleDone(d, find(d, '鉄子 980 支払い', 'today'), TUE))
    expect(col(d, 'month').habits[0].checked).toBe(false)
  })

  it('習慣の方でチェックすると、下ろした先も終わる', () => {
    let d = monthly(empty(), '散髪')
    d = applyChanges(d, placeHabitDown(d, habit(d, '散髪'), 'today', TUE))
    d = applyChanges(d, toggleHabitAll(d, habit(d, '散髪'), TUE))
    expect(find(d, '散髪', 'today').doneAt).toBeTruthy()
  })

  it('その日のうちに終えなければ、今日から消えて習慣の薄い表示も戻る', () => {
    let d = monthly(empty(), '散髪')
    d = applyChanges(d, placeHabitDown(d, habit(d, '散髪'), 'today', TUE))
    expect(col(d, 'today', WED).tasks).toEqual([])
    expect(col(d, 'month', WED).habits[0].faded).toBe(false)
  })

  it('「やることに移す」で、同じ期間の列のやること（C）になる', () => {
    let d = monthly(empty(), '段ボール処理')
    d = applyChanges(d, habitToTask(d, habit(d, '段ボール処理'), TUE))
    expect(d.habits).toEqual([])
    expect(titles(d, 'month')).toEqual(['C1 段ボール処理'])
  })
})

describe('毎月の「その日」（B）', () => {
  const withDay = (title: string, day: MonthDay) => {
    const h = newHabit(empty(), { title, period: 'month' }, TUE)
    return applyChanges(empty(), { habits: [{ ...h, day }] })
  }
  const names = (d: PlannerData, h: BoardHorizon, now = TUE) => col(d, h, now).habits.filter((v) => v.auto).map((v) => v.habit.title)

  it('その日がある週は今週の列に、その日（と過ぎてまだの日）は今日の列にも出る', () => {
    const d = withDay('定例会議', 20) // 11/20（金）は今週
    expect(names(d, 'week')).toEqual(['定例会議'])
    expect(names(d, 'today')).toEqual([]) // 11/17 はまだ
    expect(names(d, 'today', new Date(2026, 10, 20, 9))).toEqual(['定例会議'])
    expect(names(d, 'today', new Date(2026, 10, 23, 9))).toEqual(['定例会議']) // 過ぎてもまだなら出す
    expect(names(d, 'week', new Date(2026, 10, 23, 9))).toEqual([]) // 次の週の列には出さない
  })

  it('今月チェックしたら、今日・今週の列からは消える', () => {
    let d = withDay('定例会議', 20)
    d = applyChanges(d, toggleHabitAll(d, d.habits[0], TUE))
    expect(names(d, 'week')).toEqual([])
  })

  it('月末は、その月の最後の日（31 日が無い月は月末に寄せる）', () => {
    const h = withDay('鉄子 980 支払い', 'end').habits[0]
    expect(monthlyDueDate(h, new Date(2026, 10, 5))!.getDate()).toBe(30)
    const h31 = withDay('支払い', 31).habits[0]
    expect(monthlyDueDate(h31, new Date(2027, 1, 5))!.getDate()).toBe(28)
    // 11/30（月）は次の週なので、今週の列には出ない
    expect(names(withDay('鉄子 980 支払い', 'end'), 'week')).toEqual([])
    expect(names(withDay('鉄子 980 支払い', 'end'), 'week', new Date(2026, 10, 30, 9))).toEqual(['鉄子 980 支払い'])
  })
})

describe('毎月の「第何週の何曜日」', () => {
  // 2026 年 11 月は 1 日が日曜
  const NOV = new Date(2026, 10, 5)
  const date = (day: MonthDay, m = NOV) => monthDayDate(day, m)!.getDate()

  it('第 1〜第 4・最終の曜日', () => {
    expect(date('w1-0')).toBe(1) // 第 1 日曜
    expect(date('w1-1')).toBe(2) // 第 1 月曜
    expect(date('w3-3')).toBe(18) // 第 3 水曜
    expect(date('wL-5')).toBe(27) // 最終金曜
    expect(date('wL-1')).toBe(30) // 最終月曜
  })

  it('第 5 の曜日が無い月は、最終の曜日に寄せる', () => {
    expect(date('w5-1')).toBe(30) // 11 月の月曜は 5 回ある
    expect(date('w5-3')).toBe(25) // 水曜は 4 回なので最終に
  })

  it('印は「第2水」「最終金」', () => {
    expect(dayLabel('w2-3')).toBe('第2水')
    expect(dayLabel('wL-5')).toBe('最終金')
    expect(dayLabel(20)).toBe('20日')
    expect(dayLabel('end')).toBe('月末')
  })

  it('その日がある週は今週の列に、その日からは今日の列にも出る', () => {
    const h = newHabit(empty(), { title: '役員会', period: 'month' }, TUE)
    const d = applyChanges(empty(), { habits: [{ ...h, day: 'w3-3' as MonthDay }] }) // 11/18（水）
    const autos = (h2: BoardHorizon, now: Date) => col(d, h2, now).habits.filter((v) => v.auto).map((v) => v.habit.title)
    expect(autos('week', TUE)).toEqual(['役員会'])
    expect(autos('today', TUE)).toEqual([])
    expect(autos('today', WED)).toEqual(['役員会'])
  })
})

describe('来週の欄', () => {
  it('来週やることは今週の列の「来週」に出て、週が変わると今週の項目になる', () => {
    let d = applyChanges(empty(), { tasks: [newTask(empty(), { title: '歯医者（火）', horizon: 'week', priority: 'B', nextWeek: true }, TUE)] })
    expect(col(d, 'week').tasks).toEqual([])
    expect(col(d, 'week').nextWeek.map((v) => v.task.title)).toEqual(['歯医者（火）'])
    expect(col(d, 'week', NEXT_MON).tasks.map((v) => v.task.title)).toEqual(['歯医者（火）'])
    expect(col(d, 'week', NEXT_MON).nextWeek).toEqual([])
    // 数か月から「来週やる」で下ろすこともできる
    d = add(d, 'KES 更新', 'month', 'A')
    d = applyChanges(d, placeDown(d, find(d, 'KES 更新'), 'nextweek', TUE))
    expect(col(d, 'week').nextWeek.map((v) => v.task.title)).toContain('KES 更新')
    expect(col(d, 'month').tasks[0]).toMatchObject({ faded: true, placedTo: 'nextweek' })
  })

  it('すぐ下ろすボタンは 1 つ短い列へ（今週 → 今日、数か月 → 今週、今年 → 数か月）', () => {
    expect(quickTarget('week')).toBe('today')
    expect(quickTarget('month')).toBe('week')
    expect(quickTarget('year')).toBe('month')
    expect(quickTarget('today')).toBeUndefined()
  })
})

describe('やることの日付', () => {
  const dated = (title: string, due: string, horizon: BoardHorizon = 'week') => {
    const d = add(empty(), title, horizon, 'B')
    return applyChanges(d, setDue(find(d, title), due))
  }
  const where = (d: PlannerData, title: string, now = TUE) => {
    for (const c of buildColumns(d, now)) {
      if (c.tasks.some((v) => v.task.title === title)) return c.horizon
      if (c.tomorrow.some((v) => v.task.title === title)) return '明日'
      if (c.nextWeek.some((v) => v.task.title === title)) return '来週'
    }
    return null
  }

  it('日付に合わせて、来週 → 今週 → 明日 → 今日 と自動で移る', () => {
    const d = dated('万代 14 時〜', '2026-11-24') // 来週の火曜
    expect(where(d, '万代 14 時〜', TUE)).toBe('来週')
    expect(where(d, '万代 14 時〜', NEXT_MON)).toBe('明日')
    expect(where(d, '万代 14 時〜', new Date(2026, 10, 24, 9))).toBe('today')
    // 過ぎてもまだなら今日に残る
    expect(where(d, '万代 14 時〜', new Date(2026, 10, 26, 9))).toBe('today')
    expect(where(dated('歯医者', '2026-11-20'), '歯医者', TUE)).toBe('week')
  })

  it('日付を外すと、もとの列に戻る', () => {
    let d = dated('万代 14 時〜', '2026-11-24', 'month')
    d = applyChanges(d, setDue(find(d, '万代 14 時〜'), ''))
    expect(where(d, '万代 14 時〜')).toBe('month')
  })
})

describe('テーマの中のプロジェクト', () => {
  const setup = () => {
    let d = empty()
    const theme = newProject(d, { name: '自治会', color: 'orange' }, TUE)
    d = applyChanges(d, { projects: [theme] })
    const other = newProject(d, { name: '英語', color: 'blue' }, TUE)
    d = applyChanges(d, { projects: [other] })
    const event = newProject(d, { name: '防災イベントの開催', color: 'orange', parentId: theme.id }, TUE)
    d = applyChanges(d, { projects: [event] })
    // テーマ直下のやること（日付つき）と、中のプロジェクトのやること
    d = applyChanges(d, { tasks: [newTask(d, { title: '役員会の資料', horizon: 'pool', priority: 'C', projectId: theme.id, due: '2026-11-20' }, TUE)] })
    d = applyChanges(d, { tasks: [newTask(d, { title: 'チラシを配る', horizon: 'pool', priority: 'C', projectId: event.id, due: '2026-11-17' }, TUE)] })
    d = applyChanges(d, { habits: [{ ...newHabit(d, { title: '役員会', period: 'month', projectId: theme.id }, TUE), day: 'w3-3' as MonthDay }] })
    return { d, theme, other, event }
  }

  it('いちばん上に並ぶのはテーマ・プロジェクトだけ。中のものは childProjects で', () => {
    const { d, theme, event } = setup()
    expect(topProjects(d).map((p) => p.name)).toEqual(['自治会', '英語'])
    expect(childProjects(d, theme.id).map((p) => p.id)).toEqual([event.id])
  })

  it('どこに足したやることも、日付があれば時間軸に出る（中のプロジェクトのものも）', () => {
    const { d } = setup()
    expect(col(d, 'today').tasks.map((v) => v.task.title)).toContain('チラシを配る')
    expect(col(d, 'week').tasks.map((v) => v.task.title)).toContain('役員会の資料')
    expect(col(d, 'week').habits.filter((v) => v.auto).map((v) => v.habit.title)).toEqual(['役員会'])
    const flyer = col(d, 'today').tasks.find((v) => v.task.title === 'チラシを配る')!
    expect(flyer.project?.name).toBe('防災イベントの開催')
  })

  it('テーマを消すと、中のプロジェクトと、そのやること・習慣も消える', () => {
    const { d, theme } = setup()
    const after = applyChanges(d, removeProject(d, theme))
    expect(after.projects.map((p) => p.name)).toEqual(['英語'])
    expect(after.tasks).toEqual([])
    expect(after.habits).toEqual([])
  })

  it('テーマに入れる・出す。中にプロジェクトがあるもの（テーマ）は、ほかのテーマに入れない', () => {
    const { d, theme, other, event } = setup()
    const moved = applyChanges(d, moveProject(d, other, theme.id, TUE))
    expect(childProjects(moved, theme.id).map((p) => p.name)).toEqual(['防災イベントの開催', '英語'])
    expect(moveProject(d, theme, other.id, TUE)).toEqual({})
    const out = applyChanges(d, moveProject(d, event, undefined, TUE))
    expect(topProjects(out).map((p) => p.name)).toEqual(['自治会', '英語', '防災イベントの開催'])
    expect(out.projects.find((p) => p.id === event.id)!.parentId).toBeUndefined()
  })

  it('並べ替えは、同じところ（いちばん上・同じテーマの中）に並ぶものの中だけ', () => {
    const { d, theme, other } = setup()
    const c = reorderProjects(d, other.id, theme.id, TUE)
    const after = applyChanges(d, c)
    expect(topProjects(after).map((p) => p.name)).toEqual(['英語', '自治会'])
    expect((c.projects ?? []).every((p) => !p.parentId)).toBe(true)
  })
})

describe('プロジェクトの期日目標の並び', () => {
  const setup = () => {
    let d = empty()
    const p = newProject(d, { name: 'TOEIC', color: 'blue' }, TUE)
    d = applyChanges(d, { projects: [p] })
    for (const [title, due] of [['単語', undefined], ['パート5', '2026-12-08'], ['文法', undefined], ['受験', '2027-01-24'], ['音読', undefined]] as const) {
      d = applyChanges(d, { tasks: [newTask(d, { title, horizon: 'pool', priority: 'C', projectId: p.id, due }, TUE)] })
    }
    return { d, p }
  }

  const titlesOf = (d: PlannerData, id: string) => projectGoals(d, id).open.map((x) => x.title)

  it('席の無い前のデータは、日付の無いものが上（足した順）、日付のあるものが遠い順、終えたものは下', () => {
    const { d, p } = setup()
    expect(titlesOf(d, p.id)).toEqual(['単語', '文法', '音読', '受験', 'パート5'])
    const done = applyChanges(d, toggleDone(d, projectGoals(d, p.id).open[0], TUE))
    expect(projectGoals(done, p.id).done.map((x) => x.title)).toEqual(['単語'])
  })

  it('日付の無いものは、日付のあるものの間にも置ける（時間軸の並びは変えない）', () => {
    const { d, p } = setup()
    const ids = projectGoals(d, p.id).open.map((x) => x.id)
    // 「音読」を「受験」と「パート5」の間へ
    const c = reorderGoals(d, ids, ids[2], ids[4], TUE)
    const after = applyChanges(d, c)
    expect(titlesOf(after, p.id)).toEqual(['単語', '文法', '受験', 'パート5', '音読'])
    expect(c.tasks!.every((t) => t.order === d.tasks.find((x) => x.id === t.id)!.order)).toBe(true)
    // 間へ: 「単語」を「受験」の下（受験とパート5の間）へ
    const ids2 = projectGoals(after, p.id).open.map((x) => x.id)
    const mid = applyChanges(after, reorderGoals(after, ids2, ids2[0], ids2[2], TUE))
    expect(titlesOf(mid, p.id)).toEqual(['文法', '受験', '単語', 'パート5', '音読'])
  })

  it('日付のあるものは、席を動かしても日付の遠い順のまま。日付を変えると、日付の席の中で並び直す', () => {
    const { d, p } = setup()
    const ids = projectGoals(d, p.id).open.map((x) => x.id)
    let after = applyChanges(d, reorderGoals(d, ids, ids[2], ids[4], TUE)) // 単語 文法 受験 パート5 音読
    after = applyChanges(after, reorderGoals(after, projectGoals(after, p.id).open.map((x) => x.id), ids[1], ids[3], TUE)) // 文法を受験とパート5の間へ
    expect(titlesOf(after, p.id)).toEqual(['単語', '受験', '文法', 'パート5', '音読'])
    // パート5 の日付を受験より先にすると、日付の席どうしで入れ替わる（文法は同じ席のまま）
    const p5 = after.tasks.find((x) => x.title === 'パート5')!
    after = applyChanges(after, { tasks: [{ ...p5, due: '2027-03-01' }] })
    expect(titlesOf(after, p.id)).toEqual(['単語', 'パート5', '文法', '受験', '音読'])
  })

  it('新しく足すものは、いちばん下の席', () => {
    const { d, p } = setup()
    const ids = projectGoals(d, p.id).open.map((x) => x.id)
    const after = applyChanges(d, reorderGoals(d, ids, ids[0], ids[1], TUE))
    const task = newTask(after, { title: '模試', horizon: 'pool', priority: 'C', projectId: p.id }, TUE)
    const more = applyChanges(after, { tasks: [{ ...task, goalOrder: nextGoalOrder(after, p.id) }] })
    expect(titlesOf(more, p.id).at(-1)).toBe('模試')
  })

  it('日付は短く（1 年近く先のものだけ年を付ける）', () => {
    expect(shortDueLabel('2026-12-08', TUE)).toBe('12/8')
    expect(shortDueLabel('2027-01-24', TUE)).toBe('1/24')
    expect(shortDueLabel('2027-12-24', TUE)).toBe('27/12/24')
  })
})

describe('毎週の曜日・毎年の日付や月', () => {
  // 2026-11-17（火）。週は 11/16（月）〜11/22（日）
  const habit = (title: string, period: 'week' | 'year', extra: object) => {
    const h = newHabit(empty(), { title, period }, TUE)
    return applyChanges(empty(), { habits: [{ ...h, ...extra }] })
  }
  const autos = (d: PlannerData, h: BoardHorizon, now = TUE) => col(d, h, now).habits.filter((v) => v.auto).map((v) => v.habit.title)

  it('毎週・曜日: その曜日から（その週にまだなら）今日の列にも出る', () => {
    const d = habit('買出し', 'week', { weekday: 5 }) // 金曜 11/20
    expect(autos(d, 'today')).toEqual([])
    expect(autos(d, 'today', new Date(2026, 10, 20, 9))).toEqual(['買出し'])
    expect(autos(d, 'today', new Date(2026, 10, 22, 9))).toEqual(['買出し']) // 日曜まで出たまま
    expect(autos(d, 'today', new Date(2026, 10, 23, 9))).toEqual([]) // 次の週の月曜は、まだ
    const done = applyChanges(d, { habits: [toggleHabit(d.habits[0], new Date(2026, 10, 20, 9))] })
    expect(autos(done, 'today', new Date(2026, 10, 21, 9))).toEqual([])
  })

  it('毎年・日付: その日がある週は今週の列に、その日からは今日の列に、その月は数か月の列にも', () => {
    const d = habit('母誕生日', 'year', { yearDay: '11-20' })
    expect(autos(d, 'week')).toEqual(['母誕生日'])
    expect(autos(d, 'today')).toEqual([])
    expect(autos(d, 'today', new Date(2026, 10, 20, 9))).toEqual(['母誕生日'])
    expect(autos(d, 'month')).toEqual(['母誕生日'])
    expect(autos(d, 'month', new Date(2026, 11, 1, 9))).toEqual([])
  })

  it('毎年・月だけ: その月のあいだ、数か月の列に出る（今日・今週には出さない）', () => {
    const d = habit('車検', 'year', { yearDay: '11' })
    expect(autos(d, 'month')).toEqual(['車検'])
    expect(autos(d, 'week')).toEqual([])
    expect(autos(d, 'today')).toEqual([])
    expect(autos(d, 'month', new Date(2026, 9, 5))).toEqual([])
  })

  it('印は「金曜」「11/20」「11月」', () => {
    expect(whenLabel(habit('a', 'week', { weekday: 5 }).habits[0])).toBe('金曜')
    expect(whenLabel(habit('a', 'year', { yearDay: '11-20' }).habits[0])).toBe('11/20')
    expect(whenLabel(habit('a', 'year', { yearDay: '11' }).habits[0])).toBe('11月')
  })
})
