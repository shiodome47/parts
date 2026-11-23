import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { applyChanges, newHabit, newProject, newTask, placeDown, setCount, toggleHabit, type Changes, type PlannerData } from '../../core'
import { Timeline } from '../index'
import { Projects } from '../../projects'

afterEach(cleanup)

const NOW = new Date(2026, 10, 19, 9, 0)

function sample(): PlannerData {
  let d: PlannerData = { tasks: [], habits: [], projects: [] }
  const p = newProject(d, { name: '自治会', color: 'teal' }, NOW)
  d = applyChanges(d, { projects: [p] })
  d = applyChanges(d, { tasks: [newTask(d, { title: '総会の資料', horizon: 'today', priority: 'A' }, NOW)] })
  d = applyChanges(d, { tasks: [newTask(d, { title: '防災訓練の下見', horizon: 'pool', priority: 'B', projectId: p.id, due: '2026-11-21' }, NOW)] })
  d = applyChanges(d, { habits: [newHabit(d, { title: '朝の散歩', period: 'day' }, NOW)] })
  return d
}

describe('<Timeline>', () => {
  it('列（今日・今週…）に、やること・習慣を並べる。外枠は .planner', () => {
    const { container } = render(<Timeline data={sample()} now={NOW} onChange={() => {}} />)
    expect(container.firstElementChild?.classList.contains('planner')).toBe(true)
    expect(screen.getByText('総会の資料')).toBeTruthy()
    expect(screen.getByText('朝の散歩')).toBeTruthy()
    // 期日つきの目標は、期日から列が決まる（2 日後 → 今週）
    expect(screen.getByText('防災訓練の下見')).toBeTruthy()
  })

  it('足すと、変更（Changes）を onChange に渡す（保存はアプリ）', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={sample()} now={NOW} onChange={onChange} />)
    const input = screen.getAllByRole('textbox')[0]
    fireEvent.change(input, { target: { value: '回覧板をまわす' } })
    fireEvent.submit(input.closest('form')!)
    expect(onChange).toHaveBeenCalled()
    const c = onChange.mock.calls[0][0]
    expect([...(c.tasks ?? []), ...(c.habits ?? [])].map((x) => x.title)).toContain('回覧板をまわす')
  })

  it('すっきり表示（simple）は、外枠に pl-simple を付ける', () => {
    const { container } = render(<Timeline data={sample()} now={NOW} onChange={() => {}} simple />)
    expect(container.firstElementChild?.classList.contains('pl-simple')).toBe(true)
  })
})

describe('空の優先度へドラッグで移す', () => {
  it('ドラッグしている間だけ、空の優先度（A・C・D・P）の落とし先を出す', async () => {
    // 今日の列は「総会の資料」（A）だけ。キーボードでつかむ（スペース）と、B〜P の帯が出る
    let d: PlannerData = { tasks: [], habits: [], projects: [] }
    d = applyChanges(d, { tasks: [newTask(d, { title: '回覧板', horizon: 'today', priority: 'B' }, NOW)] })
    render(<Timeline data={d} now={NOW} onChange={() => {}} />)
    expect(screen.queryByTestId('priority-drop-A')).toBeNull()
    const row = screen.getByText('回覧板').closest('li')!
    row.focus()
    fireEvent.keyDown(row, { code: 'Space', key: ' ' })
    for (const p of ['A', 'C', 'D', 'P']) expect(screen.getByTestId(`priority-drop-${p}`)).toBeTruthy()
    expect(screen.queryByTestId('priority-drop-B')).toBeNull()
    // やめる（Esc）と消える（キーボードの合図は、つかんだ少しあとから受け付ける）
    await act(() => new Promise((r) => setTimeout(r, 0)))
    fireEvent.keyDown(document, { code: 'Escape', key: 'Escape' })
    expect(screen.queryByTestId('priority-drop-A')).toBeNull()
  })
})

describe('<Projects>', () => {
  it('プロジェクトのカードに、期日目標を並べる', () => {
    render(<Projects data={sample()} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: '自治会' })
    expect(within(card).getByText('防災訓練の下見')).toBeTruthy()
  })

  it('終えた目標は、一番下の「終えた目標（n）」にたたむ（はじめは閉じている）', () => {
    let d = sample()
    const p = d.projects[0]
    d = applyChanges(d, { tasks: [{ ...newTask(d, { title: 'リーディング10回', horizon: 'pool', priority: 'C', projectId: p.id }, NOW), doneAt: NOW.toISOString() }] })
    d = applyChanges(d, { tasks: [{ ...newTask(d, { title: 'リーディング20回', horizon: 'pool', priority: 'C', projectId: p.id }, NOW), doneAt: NOW.toISOString() }] })
    render(<Projects data={d} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: '自治会' })
    const summary = within(card).getByText('終えた目標（2）')
    const fold = summary.closest('details')!
    expect(fold.open).toBe(false)
    expect(within(fold).getByText('リーディング10回')).toBeTruthy()
    // 終えていない目標は、たたまずに上に出る
    expect(within(card).getByText('防災訓練の下見').closest('details')).toBeNull()
  })
})

describe('習慣を終える（卒業・お休み）・完全に消す', () => {
  // jsdom には小窓を開く showModal が無いので、開いた印（open）を付けるだけのものを用意する
  beforeAll(() => {
    const proto = HTMLDialogElement.prototype
    if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
    if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
  })

  /** 習慣の … を開いて、選ぶ */
  const pick = (title: string, item: string) => {
    fireEvent.click(screen.getAllByRole('button', { name: `「${title}」の操作` })[0])
    fireEvent.click(screen.getByRole('menuitem', { name: item }))
  }

  it('… →「卒業・お休みにする」で、終え方を選び、ひとことを添えて終える', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={sample()} now={NOW} onChange={onChange} />)
    pick('朝の散歩', '卒業・お休みにする…')
    const submit = screen.getByRole('button', { name: '選んでください' }) as HTMLButtonElement
    expect(submit.disabled).toBe(true)
    fireEvent.click(screen.getByRole('radio', { name: /卒業/ }))
    fireEvent.change(screen.getByRole('textbox', { name: 'ひとこと' }), { target: { value: '身についた' } })
    fireEvent.click(screen.getByRole('button', { name: '卒業する' }))
    const habit = onChange.mock.calls[0][0].habits![0]
    expect(habit).toMatchObject({ title: '朝の散歩', endedAs: 'graduated', endNote: '身についた' })
    expect(habit.endedAt).toBeTruthy()
  })

  it('終えた習慣は、チェックの一覧に出さず、一番下の「これまでの習慣」にたたんで出す', () => {
    const d = sample()
    const ended = { ...d.habits[0], endedAt: NOW.toISOString(), endedAs: 'paused' as const, endNote: '雨が続いた' }
    render(<Timeline data={{ ...d, habits: [ended] }} now={NOW} onChange={() => {}} />)
    expect(screen.queryByRole('checkbox', { name: '「朝の散歩」をチェック' })).toBeNull()
    expect(screen.getByText('これまでの習慣（1）')).toBeTruthy()
    expect(screen.getByText('「雨が続いた」')).toBeTruthy()
    expect(screen.getByRole('img', { name: 'お休み' })).toBeTruthy()
  })

  it('「また始める」で、チェックの一覧にもどす', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    const d = sample()
    const ended = { ...d.habits[0], endedAt: NOW.toISOString(), endedAs: 'paused' as const }
    render(<Timeline data={{ ...d, habits: [ended] }} now={NOW} onChange={onChange} />)
    pick('朝の散歩', 'また始める')
    expect(onChange.mock.calls[0][0].habits![0].endedAt).toBeUndefined()
  })

  it('完全に消す: 記録があれば確かめてから消す。記録が無ければ、すぐ消す', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    const d = sample()
    const checked = toggleHabit(d.habits[0], NOW)
    const { unmount } = render(<Timeline data={{ ...d, habits: [checked] }} now={NOW} onChange={onChange} />)
    pick('朝の散歩', '完全に消す')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText(/チェックの記録（1 日分）も消え/)).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '完全に消す' }))
    expect(onChange.mock.calls[0][0].deleteHabitIds).toEqual([checked.id])
    unmount()

    const onChange2 = vi.fn<(c: Changes) => void>()
    render(<Timeline data={d} now={NOW} onChange={onChange2} />)
    pick('朝の散歩', '完全に消す')
    expect(onChange2.mock.calls[0][0].deleteHabitIds).toEqual([d.habits[0].id])
  })

  it('プロジェクトでは、ルーチン目標の一番下に「これまでのルーチン目標」', () => {
    const d = sample()
    const p = d.projects[0]
    const live = newHabit(d, { title: '見回り', period: 'week', projectId: p.id }, NOW)
    const ended = { ...newHabit(d, { title: '朝の清掃', period: 'week', projectId: p.id }, NOW), endedAt: NOW.toISOString(), endedAs: 'graduated' as const }
    render(<Projects data={{ ...d, habits: [live, ended] }} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: '自治会' })
    expect(within(card).getByRole('checkbox', { name: '「見回り」をチェック' })).toBeTruthy()
    expect(within(card).queryByRole('checkbox', { name: '「朝の清掃」をチェック' })).toBeNull()
    expect(within(card).getByText('これまでのルーチン目標（1）')).toBeTruthy()
  })
})

describe('目標を細かく分ける（中身のプロジェクト）', () => {
  beforeAll(() => {
    const proto = HTMLDialogElement.prototype
    if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
    if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
  })

  /** テーマ「英語」の中に「TOEICお受験」（目標: ALL IN ONE 完了）と「ALL IN ONE 完遂」（ステップ 3 つ、1 つ終えた） */
  function english(link: boolean): PlannerData {
    let d: PlannerData = { tasks: [], habits: [], projects: [] }
    const eng = newProject(d, { name: '英語', color: 'blue' }, NOW)
    d = applyChanges(d, { projects: [eng] })
    const toeic = newProject(d, { name: 'TOEICお受験', color: 'blue', parentId: eng.id }, NOW)
    d = applyChanges(d, { projects: [toeic] })
    const goal = newTask(d, { title: 'ALL IN ONE 完了', horizon: 'pool', priority: 'C', projectId: toeic.id }, NOW)
    d = applyChanges(d, { tasks: [goal] })
    const aio = { ...newProject(d, { name: 'ALL IN ONE 完遂', color: 'blue', parentId: eng.id }, NOW), ...(link ? { goalId: goal.id } : {}) }
    d = applyChanges(d, { projects: [aio] })
    for (const title of ['リーディング10回', 'リーディング20回', 'リーディング30回']) {
      d = applyChanges(d, { tasks: [newTask(d, { title, horizon: 'pool', priority: 'C', projectId: aio.id }, NOW)] })
    }
    d = applyChanges(d, { tasks: [{ ...d.tasks.find((t) => t.title === 'リーディング10回')!, doneAt: NOW.toISOString() }] })
    return d
  }
  const pick = (name: string, item: string) => {
    fireEvent.click(screen.getByRole('button', { name: `「${name}」の操作` }))
    fireEvent.click(screen.getByRole('menuitem', { name: item }))
  }

  it('つないだ目標の行に中身の進み具合、中身のプロジェクトに、どの目標の中身か', () => {
    render(<Projects data={english(true)} now={NOW} onChange={() => {}} />)
    expect(screen.getByRole('button', { name: '中身「ALL IN ONE 完遂」1/3。押すと移動' })).toBeTruthy()
    expect(screen.getByText('「TOEICお受験」の目標「ALL IN ONE 完了」の中身')).toBeTruthy()
  })

  it('… →「細かく分ける…」→「作る」で、中身のプロジェクトを新しく作る', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    const d = english(false)
    render(<Projects data={d} now={NOW} onChange={onChange} />)
    pick('ALL IN ONE 完了', '細かく分ける…')
    fireEvent.change(screen.getByRole('textbox', { name: '中身のプロジェクトの名前' }), { target: { value: 'ALL IN ONE を進める' } })
    fireEvent.click(screen.getByRole('button', { name: '作る' }))
    const made = onChange.mock.calls[0][0].projects!.find((p) => p.name === 'ALL IN ONE を進める')!
    expect(made.goalId).toBe(d.tasks.find((t) => t.title === 'ALL IN ONE 完了')!.id)
  })

  it('… →「細かく分ける…」で、今あるプロジェクトをつなぐこともできる', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    const d = english(false)
    render(<Projects data={d} now={NOW} onChange={onChange} />)
    pick('ALL IN ONE 完了', '細かく分ける…')
    const aio = d.projects.find((p) => p.name === 'ALL IN ONE 完遂')!
    fireEvent.change(screen.getByRole('combobox', { name: '中身にするプロジェクト' }), { target: { value: aio.id } })
    fireEvent.click(screen.getByRole('button', { name: 'つなぐ' }))
    expect(onChange.mock.calls[0][0].projects).toEqual([expect.objectContaining({ id: aio.id, goalId: d.tasks[0].id })])
  })

  it('… →「中身とのつなぎを外す」', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Projects data={english(true)} now={NOW} onChange={onChange} />)
    pick('ALL IN ONE 完了', '中身とのつなぎを外す')
    expect(onChange.mock.calls[0][0].projects![0]).toMatchObject({ name: 'ALL IN ONE 完遂' })
    expect(onChange.mock.calls[0][0].projects![0].goalId).toBeUndefined()
  })
})

describe('回数の目標（30/100 回 ＋1）', () => {
  beforeAll(() => {
    const proto = HTMLDialogElement.prototype
    if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
    if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
  })

  /** 今週の列に「リーディング」。target を渡すと回数の目標に */
  function reading(target?: number, done = 0): PlannerData {
    let d: PlannerData = { tasks: [], habits: [], projects: [] }
    d = applyChanges(d, { tasks: [newTask(d, { title: 'リーディング', horizon: 'week', priority: 'B' }, NOW)] })
    if (target) d = applyChanges(d, setCount(d, d.tasks[0], { target, done }, NOW))
    return d
  }

  it('… →「回数の目標にする…」で、めざす回数と今の回数を決める', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={reading()} now={NOW} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '「リーディング」の操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '回数の目標にする…' }))
    const [target, done] = screen.getAllByRole('spinbutton')
    fireEvent.change(target, { target: { value: '100' } })
    fireEvent.change(done, { target: { value: '20' } })
    fireEvent.click(screen.getByRole('button', { name: '決める' }))
    expect(onChange.mock.calls[0][0].tasks![0].count).toEqual({ target: 100, done: 20 })
  })

  it('行に「20/100 回」と ＋1。押すと 1 回足す', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={reading(100, 20)} now={NOW} onChange={onChange} />)
    expect(screen.getByText('20/100 回')).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: '「リーディング」を 1 回足す（今 20/100 回）' }))
    expect(onChange.mock.calls[0][0].tasks![0].count?.done).toBe(21)
  })

  it('下ろした先（今日の列）でも、元の回数を出して足せる', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    let d = reading(100, 20)
    d = applyChanges(d, placeDown(d, d.tasks[0], 'today', NOW))
    render(<Timeline data={d} now={NOW} onChange={onChange} />)
    const plus = screen.getAllByRole('button', { name: '「リーディング」を 1 回足す（今 20/100 回）' })
    expect(plus.length).toBeGreaterThan(0)
    fireEvent.click(plus[plus.length - 1])
    const changed = onChange.mock.calls[0][0].tasks!
    expect(changed.find((t) => t.id === d.tasks[0].id)?.count?.done).toBe(21)
  })

  it('プロジェクトの期日目標にも、名前の下に回数と ＋1', () => {
    let d = sample()
    const p = d.projects[0]
    d = applyChanges(d, { tasks: [newTask(d, { title: '151-200 リーディング', horizon: 'pool', priority: 'C', projectId: p.id }, NOW)] })
    const goal = d.tasks.find((t) => t.title === '151-200 リーディング')!
    d = applyChanges(d, setCount(d, goal, { target: 100, done: 30 }, NOW))
    render(<Projects data={d} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: '自治会' })
    expect(within(card).getByText('30/100 回')).toBeTruthy()
    expect(within(card).getByRole('button', { name: '「151-200 リーディング」を 1 回足す（今 30/100 回）' })).toBeTruthy()
  })
})

describe('今日の見え方（習慣をまとめる・プロジェクトで今日を目立たせる）', () => {
  afterEach(() => localStorage.clear())

  /** ヨガに毎日の習慣 2 つ（1 つ済み）、期日が今日の目標 1 つ。自治会には今日のものが無い */
  function yoga(): PlannerData {
    let d = sample()
    const p = newProject(d, { name: 'ヨガ', color: 'yellow' }, NOW)
    d = applyChanges(d, { projects: [p] })
    d = applyChanges(d, { habits: [newHabit(d, { title: '瞑想30分', period: 'day', projectId: p.id }, NOW)] })
    d = applyChanges(d, { habits: [newHabit(d, { title: 'トラータカ1分', period: 'day', projectId: p.id }, NOW)] })
    d = applyChanges(d, { habits: [toggleHabit(d.habits.find((h) => h.title === 'トラータカ1分')!, NOW)] })
    d = applyChanges(d, { tasks: [newTask(d, { title: 'ヨガ教室の予約', horizon: 'pool', priority: 'C', projectId: p.id, due: '2026-11-19' }, NOW)] })
    return d
  }

  it('時間軸: 同じプロジェクトの習慣は「ヨガ あと 1」の 1 行。押すと開く', () => {
    render(<Timeline data={yoga()} now={NOW} onChange={() => {}} />)
    const toggle = screen.getByRole('button', { name: '「ヨガ」の習慣 2 個（あと 1）' })
    expect(toggle.getAttribute('aria-expanded')).toBe('false')
    expect(screen.queryByText('瞑想30分')).toBeNull()
    // プロジェクトの無い習慣は、今までどおり
    expect(screen.getByText('朝の散歩')).toBeTruthy()
    fireEvent.click(toggle)
    expect(toggle.getAttribute('aria-expanded')).toBe('true')
    expect(screen.getByRole('checkbox', { name: '「瞑想30分」をチェック' })).toBeTruthy()
  })

  it('プロジェクト: 「今日」を押すと、今日のものに色の帯、カードに「今日 あと 2」', () => {
    render(<Projects data={yoga()} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: 'ヨガ' })
    expect(within(card).queryByText(/今日 あと/)).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /今日/ }))
    expect(within(card).getByText('今日 あと 2')).toBeTruthy()
    expect(within(card).getByText('瞑想30分').closest('li')!.classList.contains('pl-today')).toBe(true)
    expect(within(card).getByText('ヨガ教室の予約').closest('li')!.classList.contains('pl-today')).toBe(true)
    // 今日のものが無いカード（自治会の目標は今週）は、薄く
    expect(screen.getByRole('region', { name: '自治会' }).classList.contains('pl-today-none')).toBe(true)
  })
})
