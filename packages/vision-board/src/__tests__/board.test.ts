import { describe, expect, it } from 'vitest'
import { MAX_LENGTH, addItem, addView, boardLength, boardRatio, byLayer, contentBottom, emptyBoard, getBoard, growBoard, moveLayer, removeItem, removeView, setAspect, setLength, shrinkBoard, trimBoard, updateItem, viewToZoom } from '../board'
import type { VisionBoard } from '../types'

const NOW = new Date(2026, 10, 18, 9, 0)
const empty = (): { boards?: VisionBoard[] } => ({})

describe('宝地図', () => {
  it('まだ無ければ、空の横長のボード', () => {
    const b = getBoard(empty(), NOW)
    expect(b).toMatchObject({ id: 'main', aspect: 'landscape', items: [] })
  })

  it('貼ると、少しずつずらして、いちばん手前に置く', () => {
    let b = getBoard(empty(), NOW)
    b = addItem(b, { kind: 'image', url: 'https://x/images/a.webp' }, NOW)
    b = addItem(b, { kind: 'text', text: '天は自ら助くる者を助く' }, NOW)
    const [img, words] = b.items
    expect(img).toMatchObject({ kind: 'image', w: 0.26, z: 1 })
    expect(words).toMatchObject({ kind: 'text', z: 2, size: 0.05 })
    expect(words.x).toBeGreaterThan(img.x)
  })

  it('動かす・大きさ（行きすぎない）・重なり・はがす', () => {
    let b = getBoard(empty(), NOW)
    b = addItem(b, { kind: 'image', url: 'a' }, NOW)
    b = addItem(b, { kind: 'image', url: 'b' }, NOW)
    const [a, bb] = b.items
    b = updateItem(b, a.id, { x: 5, y: -5, w: 0.001 }, NOW)
    expect(b.items[0]).toMatchObject({ x: 0.97, y: -0.3, w: 0.05 })
    b = moveLayer(b, a.id, 'front', NOW)
    expect(byLayer(b.items).map((i) => i.id)).toEqual([bb.id, a.id])
    b = moveLayer(b, a.id, 'back', NOW)
    expect(byLayer(b.items).map((i) => i.id)).toEqual([a.id, bb.id])
    b = removeItem(b, a.id, NOW)
    expect(b.items.map((i) => i.id)).toEqual([bb.id])
  })

  it('保存すると、次からはそのボード', () => {
    const b = addItem(getBoard(empty(), NOW), { kind: 'text', text: '感謝' }, NOW)
    const d = { boards: [b] }
    expect(getBoard(d, NOW).items.map((i) => i.text)).toEqual(['感謝'])
  })
})

describe('宝地図の見え方を覚える', () => {
  it('枠の真ん中に見えているボードの上の点と倍率で覚える（画面の大きさが変わっても、同じところが真ん中に見える）', () => {
    // 枠 1200×600 の真ん中に、800×600 のボード（左に 200 の余白）。2 倍にして、ボードの右下 1/4 あたりを真ん中に
    const zoom = { scale: 2, x: 600 - 600 * 2, y: 300 - 450 * 2 }
    let b = getBoard(empty(), NOW)
    b = addView(b, ' TOEIC ', zoom, 1200, 600, 800, 600, NOW)
    const v = b.views![0]
    expect(v.name).toBe('TOEIC')
    expect(v.cx).toBeCloseTo(0.75)
    expect(v.cy).toBeCloseTo(0.75)
    // スマホ（枠 400×700、ボード 400×300）でも、ボードの (0.75, 0.75) が枠の真ん中に来る
    const z = viewToZoom(v, 400, 700, 400, 300)
    expect(z.scale).toBe(2)
    expect(0.75 * 400 * 2 + z.x).toBeCloseTo(200)
    expect(0.75 * 300 * 2 + z.y).toBeCloseTo(350)
  })

  it('はじめの版で覚えた見え方（x・y だけ）も、同じところが見える', () => {
    // はじめの版: ボードと枠が同じ 800×600。2 倍で x = -0.5（= -400px）, y = -0.25（= -150px）→ 真ん中は (0.5, 0.375)
    const old = { id: 'a', name: '古い', scale: 2, x: -0.5, y: -0.25 }
    const z = viewToZoom(old, 800, 600)
    expect(z).toEqual({ scale: 2, x: -400, y: -150 })
    // 枠が広くなっても（1200×600、ボード 800×600）、同じ点が真ん中に
    const wide = viewToZoom(old, 1200, 600, 800, 600)
    expect(0.5 * 800 * 2 + wide.x).toBeCloseTo(600)
    expect(0.375 * 600 * 2 + wide.y).toBeCloseTo(300)
  })

  it('新しい形で覚えても、古い版のための x・y も入れておく（古い版でも同じところ）', () => {
    const b = addView(getBoard(empty(), NOW), 'x', { scale: 2, x: -400, y: -150 }, 800, 600, 800, 600, NOW)
    expect(b.views![0].x).toBeCloseTo(-0.5)
    expect(b.views![0].y).toBeCloseTo(-0.25)
  })

  it('名前が空なら「見え方」。消せる', () => {
    let b = addView(getBoard(empty(), NOW), '  ', { scale: 3, x: 0, y: 0 }, 800, 600, 800, 600, NOW)
    expect(b.views![0].name).toBe('見え方')
    b = removeView(b, b.views![0].id, NOW)
    expect(b.views).toEqual([])
  })

  it('見え方はボードと一緒に保存・同期される', () => {
    const b = addView(getBoard(empty(), NOW), '神様', { scale: 2, x: 0, y: 0 }, 800, 600, 800, 600, NOW)
    const d = { boards: [b] }
    expect(getBoard(d, NOW).views?.map((v) => v.name)).toEqual(['神様'])
  })
})

describe('下へ伸びるボード', () => {
  const T = new Date(2026, 10, 19, 9, 0)
  const withItems = () => {
    let b = emptyBoard(T)
    b = addItem(b, { kind: 'image', url: 'https://x/a.webp', x: 0.1, y: 0.2, w: 0.3 }, T)
    b = addView(b, '上', { scale: 2, x: -100, y: -50 }, 800, 600, 800, 600, T)
    return b
  }

  it('下へ伸びるボードにしても、見た目は今のまま（高さは今の形と同じ）', () => {
    const b = setAspect(withItems(), 'scroll', T)
    expect(b.aspect).toBe('scroll')
    expect(boardLength(b)).toBeCloseTo(0.75)
    expect(b.items[0].y).toBeCloseTo(0.2)
    expect(boardRatio(b)).toBeCloseTo(4 / 3)
  })

  it('高さを変えても、貼ったもの・覚えた見え方の場所（幅に対する位置）は動かない', () => {
    const b = setAspect(withItems(), 'scroll', T)
    const v0 = b.views![0]
    const g = growBoard(b, 0.75, T)
    expect(boardLength(g)).toBeCloseTo(1.5)
    // 上から幅の 0.15 のところ（0.2 × 0.75）のまま
    expect(g.items[0].y * boardLength(g)).toBeCloseTo(0.2 * 0.75)
    expect(g.views![0].cy! * boardLength(g)).toBeCloseTo(v0.cy! * 0.75)
    expect(g.views![0].cx).toBeCloseTo(v0.cx!)
  })

  it('下を詰めても、貼ったものは切らない。ほかの形では高さは変えない', () => {
    const b = growBoard(setAspect(withItems(), 'scroll', T), 3, T)
    const s = shrinkBoard(b, 10, T)
    // 画像の下（0.15 + 0.3）より少し下まで
    expect(boardLength(s)).toBeCloseTo(0.2 * 0.75 + 0.3 + 0.05)
    expect(contentBottom(s)).toBeLessThan(boardLength(s))
    // 一度になくす: 少しずつ詰めたときと同じところまで
    expect(boardLength(trimBoard(b, T))).toBeCloseTo(boardLength(s))
    expect(setLength(withItems(), 3, T).length).toBeUndefined()
    expect(boardLength(setLength(b, 999, T))).toBe(MAX_LENGTH)
  })
})
