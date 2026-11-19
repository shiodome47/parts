import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { VisionBoard, addItem, emptyBoard, type VisionBoardData } from '../index'

afterEach(cleanup)

// テストの仮のブラウザ（jsdom）には小窓（<dialog>）を開く仕組みが無いので、補う
HTMLDialogElement.prototype.showModal ??= function (this: HTMLDialogElement) {
  this.setAttribute('open', '')
}
HTMLDialogElement.prototype.close ??= function (this: HTMLDialogElement) {
  this.removeAttribute('open')
}

const NOW = new Date(2026, 10, 19, 9, 0)

describe('<VisionBoard>', () => {
  it('外枠は .vision-board。貼った言葉が出る', () => {
    const board = addItem(emptyBoard(NOW), { kind: 'text', text: '天は自ら助くる者を助く' }, NOW)
    const { container } = render(<VisionBoard board={board} onChange={() => {}} />)
    expect(container.firstElementChild?.classList.contains('vision-board')).toBe(true)
    expect(screen.getByText('天は自ら助くる者を助く')).toBeTruthy()
  })

  it('画像を置く関数（uploadImage）が無ければ、「画像を貼る」は出ない', () => {
    render(<VisionBoard board={emptyBoard(NOW)} onChange={() => {}} />)
    expect(screen.queryByRole('button', { name: '画像を貼る' })).toBeNull()
    render(<VisionBoard board={emptyBoard(NOW)} onChange={() => {}} uploadImage={async () => 'https://x/a.png'} />)
    expect(screen.getByRole('button', { name: '画像を貼る' })).toBeTruthy()
  })

  it('言葉を貼ると、新しいボードを onChange に渡す（保存はアプリ）', () => {
    const onChange = vi.fn<(b: VisionBoardData) => void>()
    render(<VisionBoard board={emptyBoard(NOW)} onChange={onChange} />)
    fireEvent.click(screen.getByRole('button', { name: '言葉を貼る' }))
    fireEvent.change(screen.getByRole('textbox', { name: '貼る言葉' }), { target: { value: '感謝' } })
    fireEvent.click(screen.getByRole('button', { name: '貼る' }))
    expect(onChange).toHaveBeenCalled()
    expect(onChange.mock.calls[0][0].items.map((i) => i.text)).toEqual(['感謝'])
  })

  it('画像は loadImage で読み方を差し替えられる（Blob を返せば表示用の URL を作る）', async () => {
    const board = addItem(emptyBoard(NOW), { kind: 'image', url: 'https://x/secret.png' }, NOW)
    const loadImage = vi.fn(async () => 'blob:shown')
    const { container } = render(<VisionBoard board={board} onChange={() => {}} loadImage={loadImage} />)
    await new Promise((r) => setTimeout(r, 0))
    expect(loadImage).toHaveBeenCalledWith('https://x/secret.png')
    expect(container.querySelector('img')?.getAttribute('src')).toBe('blob:shown')
  })
})
