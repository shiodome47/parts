import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { applyChanges, newHabit, newProject, newTask, toggleHabit, type Changes, type PlannerData } from '../../core'
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

describe('<Projects>', () => {
  it('プロジェクトのカードに、期日目標を並べる', () => {
    render(<Projects data={sample()} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: '自治会' })
    expect(within(card).getByText('防災訓練の下見')).toBeTruthy()
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
