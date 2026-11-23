import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { applyChanges, dayKey, newHabit, newProject, setHabitLevel, setHabitTiers, toggleHabit, type Changes, type PlannerData } from '../../core'
import { Timeline } from '../index'
import { Projects } from '../../projects'

afterEach(cleanup)

const NOW = new Date(2026, 10, 23, 9, 0)
const TODAY = dayKey(NOW)

beforeAll(() => {
  // jsdom には小窓を開く showModal が無いので、開いた印（open）を付けるだけのものを用意する
  const proto = HTMLDialogElement.prototype
  if (!proto.showModal) proto.showModal = function (this: HTMLDialogElement) { this.setAttribute('open', '') }
  if (!proto.close) proto.close = function (this: HTMLDialogElement) { this.removeAttribute('open') }
})

/** ヨガのプロジェクトに、毎日の「瞑想」。tiers で 3 段階、checked でチェック、level で段階 */
function yoga({ tiers = false, checked = false, level }: { tiers?: boolean; checked?: boolean; level?: 2 | 3 } = {}): PlannerData {
  let d: PlannerData = { tasks: [], habits: [], projects: [] }
  const p = newProject(d, { name: 'ヨガ', color: 'yellow' }, NOW)
  d = applyChanges(d, { projects: [p] })
  let h = newHabit(d, { title: '瞑想', period: 'day', projectId: p.id }, NOW)
  if (tiers) h = setHabitTiers(h, { low: '3分', mid: '10分', top: '30分' }, NOW)
  if (checked) h = toggleHabit(h, NOW)
  if (level) h = setHabitLevel(h, NOW, level, NOW)
  return applyChanges(d, { habits: [h] })
}

const habitRow = () => screen.getByRole('checkbox', { name: /「瞑想」/ }).closest('li')!

describe('3 段階にする（時間軸）', () => {
  it('… →「3 段階にする…」で、低・中・上の中身を書く', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={yoga()} now={NOW} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '「瞑想」の操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '3 段階にする…' }))
    const dialog = screen.getByRole('dialog')
    const [low, mid, top] = within(dialog).getAllByRole('textbox')
    fireEvent.change(low, { target: { value: '3分' } })
    fireEvent.change(mid, { target: { value: '10分' } })
    fireEvent.change(top, { target: { value: '30分' } })
    fireEvent.click(within(dialog).getByRole('button', { name: '決める' }))
    expect(onChange.mock.calls[0][0].habits![0].tiers).toEqual({ low: '3分', mid: '10分', top: '30分' })
  })

  it('まだのときは、名前の下に中身を出す', () => {
    render(<Timeline data={yoga({ tiers: true })} now={NOW} onChange={() => {}} />)
    expect(within(habitRow()).getByText('低 3分・中 10分・上 30分')).toBeTruthy()
  })

  it('チェックしたら「低」。チェックは薄い緑（pl-lv-1）。「上」を押すと上げる', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={yoga({ tiers: true, checked: true })} now={NOW} onChange={onChange} />)
    expect(habitRow().classList.contains('pl-lv-1')).toBe(true)
    const pick = screen.getByRole('radiogroup', { name: '「瞑想」はどこまでできたか' })
    expect(within(pick).getByRole('radio', { name: '低' }).getAttribute('aria-checked')).toBe('true')
    fireEvent.click(within(pick).getByRole('radio', { name: '上' }))
    expect(onChange.mock.calls[0][0].habits![0].levels).toEqual({ [TODAY]: 3 })
  })

  it('上までのときは、チェックが濃紫（pl-lv-3）で、上の中身が出る', () => {
    render(<Timeline data={yoga({ tiers: true, checked: true, level: 3 })} now={NOW} onChange={() => {}} />)
    expect(habitRow().classList.contains('pl-lv-3')).toBe(true)
    expect(within(habitRow()).getByText('30分')).toBeTruthy()
  })

  it('3 段階でない習慣は、今のまま（段階の印も色も出さない）', () => {
    render(<Timeline data={yoga({ checked: true })} now={NOW} onChange={() => {}} />)
    expect(within(habitRow()).queryByRole('radiogroup')).toBeNull()
    expect(habitRow().className).not.toMatch(/pl-lv-/)
  })

  it('「3 段階をやめる」で tiers を消す', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Timeline data={yoga({ tiers: true })} now={NOW} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '「瞑想」の操作' }))
    fireEvent.click(screen.getByRole('menuitem', { name: '3 段階を変える…' }))
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: '3 段階をやめる' }))
    expect(onChange.mock.calls[0][0].habits![0].tiers).toBeUndefined()
  })
})

describe('3 段階（プロジェクトのルーチン目標）', () => {
  it('チェックで「低」、印から上げられる。チェックの色も変わる', () => {
    const onChange = vi.fn<(c: Changes) => void>()
    render(<Projects data={yoga({ tiers: true, checked: true, level: 2 })} now={NOW} onChange={onChange} />)
    const card = screen.getByRole('region', { name: 'ヨガ' })
    const pick = within(card).getByRole('radiogroup', { name: '「瞑想」はどこまでできたか' })
    expect(within(pick).getByRole('radio', { name: '中' }).getAttribute('aria-checked')).toBe('true')
    expect(habitRow().className).toMatch(/pl-lv-2/)
    fireEvent.click(within(pick).getByRole('radio', { name: '低' }))
    expect(onChange.mock.calls[0][0].habits![0].levels).toEqual({ [TODAY]: 1 })
  })

  it('… に「3 段階にする…」がある', () => {
    render(<Projects data={yoga()} now={NOW} onChange={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: '「瞑想」の操作' }))
    expect(screen.getByRole('menuitem', { name: '3 段階にする…' })).toBeTruthy()
  })
})
