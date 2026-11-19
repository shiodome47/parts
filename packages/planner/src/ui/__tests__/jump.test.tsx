import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { JumpBar } from '../JumpBar'

afterEach(cleanup)

describe('JumpBar（スマホで上に出す、横にすべらせて選ぶチップ）', () => {
  const items = [
    { id: 'today', label: '今日' },
    { id: 'week', label: '今週' },
    { id: 'p1', label: 'そろばん', color: 'teal' },
  ]

  it('チップを並べ、押すとその id で知らせる。今見ているものに印を付ける', () => {
    const onJump = vi.fn()
    render(<JumpBar label="列へ移動" items={items} active="week" onJump={onJump} />)
    const nav = screen.getByRole('navigation', { name: '列へ移動' })
    const chips = within(nav).getAllByRole('button')
    expect(chips.map((c) => c.textContent)).toEqual(['今日', '今週', 'そろばん'])
    expect(chips[1].getAttribute('aria-current')).toBe('true')
    expect(chips[0].getAttribute('aria-current')).toBeNull()
    fireEvent.click(chips[2])
    expect(onJump).toHaveBeenCalledWith('p1')
  })

  it('1 つしかなければ出さない', () => {
    render(<JumpBar label="プロジェクトへ移動" items={[items[0]]} onJump={() => {}} />)
    expect(screen.queryByRole('navigation')).toBeNull()
  })
})
