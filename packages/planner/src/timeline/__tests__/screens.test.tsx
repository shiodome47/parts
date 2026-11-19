import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyChanges, newHabit, newProject, newTask, type Changes, type PlannerData } from '../../core'
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
