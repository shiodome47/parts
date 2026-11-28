import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { applyChanges, cancelTask, newProject, newTask, type Changes, type PlannerData } from '../../core'
import { Timeline } from '../index'
import { Projects } from '../../projects'

afterEach(cleanup)

const NOW = new Date(2026, 10, 28, 9, 0)

function sample({ canceled = false } = {}): PlannerData {
  let d: PlannerData = { tasks: [], habits: [], projects: [] }
  const p = newProject(d, { name: '自治会', color: 'teal' }, NOW)
  d = applyChanges(d, { projects: [p] })
  d = applyChanges(d, { tasks: [newTask(d, { title: '総会の資料', horizon: 'today', priority: 'A' }, NOW)] })
  d = applyChanges(d, { tasks: [newTask(d, { title: '防災訓練の下見', horizon: 'pool', priority: 'B', projectId: p.id }, NOW)] })
  if (canceled) for (const t of d.tasks) d = applyChanges(d, cancelTask(d, t, NOW))
  return d
}

describe('やめる（時間軸）', () => {
  it('… →「やめる（やらないことにする）」で、やめたことにする', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={sample()} now={NOW} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '「総会の資料」の操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'やめる（やらないことにする）' }))
    const t = onChange.mock.calls[0][0].tasks![0]
    expect(t.canceled).toBe(true)
    expect(t.doneAt).toBeTruthy()
  })

  it('やめたものは ✕ で、取り消し線（pl-canceled）。✕ を押すと取り消す', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={sample({ canceled: true })} now={NOW} onChange={onChange} />)
    const mark = screen.getByRole('checkbox', { name: '「総会の資料」をやめたのを取り消す' })
    expect(mark.closest('li')!.classList.contains('pl-canceled')).toBe(true)
    fireEvent.click(mark)
    const t = onChange.mock.calls[0][0].tasks![0]
    expect(t.canceled).toBeUndefined()
    expect(t.doneAt).toBeUndefined()
  })

  it('やめたもの・終えたものの … には「やめる」を出さない', () => {
    render(<Timeline data={sample({ canceled: true })} now={NOW} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '「総会の資料」の操作' }))
    expect(screen.queryByRole('menuitem', { name: 'やめる（やらないことにする）' })).toBeNull()
  })
})

describe('やめる（プロジェクトの期日目標）', () => {
  it('… から、やめられる', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Projects data={sample()} now={NOW} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '「防災訓練の下見」の操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: 'やめる（やらないことにする）' }))
    expect(onChange.mock.calls[0][0].tasks![0].canceled).toBe(true)
  })

  it('やめた目標は「終えた目標」にたたまれ、✕ で出る', () => {
    render(<Projects data={sample({ canceled: true })} now={NOW} onChange={() => {}} />)
    const card = screen.getByRole('region', { name: '自治会' })
    const mark = within(card).getByRole('checkbox', { name: '「防災訓練の下見」をやめたのを取り消す', hidden: true })
    expect(mark.closest('li')!.classList.contains('pl-canceled')).toBe(true)
  })
})
