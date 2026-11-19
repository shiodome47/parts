import { describe, expect, it } from 'vitest'
import { clampZoom, coverScale, fitRect, zoomAt } from '../useZoom'

describe('宝地図の拡大', () => {
  it('指の下の点を動かさずに拡大する', () => {
    const z = zoomAt({ scale: 1, x: 0, y: 0 }, 2, 100, 50, 400, 300)
    expect(z).toEqual({ scale: 2, x: -100, y: -50 })
    // 拡大後も、(100, 50) の下には、もとの (100, 50) がある
    expect((100 - z.x) / z.scale).toBe(100)
  })

  it('1〜5 倍まで。すき間ができるほどは動かさない', () => {
    expect(clampZoom({ scale: 0.5, x: 10, y: 10 }, 400, 300)).toEqual({ scale: 1, x: 0, y: 0 })
    expect(clampZoom({ scale: 9, x: 0, y: 0 }, 400, 300).scale).toBe(5)
    expect(clampZoom({ scale: 2, x: -900, y: 50 }, 400, 300)).toEqual({ scale: 2, x: -400, y: 0 })
  })

  it('画像に寄る: その四角が枠いっぱい（少し余白）に、真ん中に見える', () => {
    // 400×300 の枠の、(100, 75) から 100×75 の画像 → 4 倍の手前（余白の分）で、真ん中へ
    const z = fitRect({ scale: 1, x: 0, y: 0 }, { left: 100, top: 75, width: 100, height: 75 }, 400, 300)
    expect(z.scale).toBeCloseTo(3.36, 2)
    // 画像の真ん中（150, 112.5）が、枠の真ん中（200, 150）に来る
    expect(150 * z.scale + z.x).toBeCloseTo(200)
    expect(112.5 * z.scale + z.y).toBeCloseTo(150)
  })

  it('画像に寄る: 小さすぎるものも 5 倍まで。枠の外へはみ出す位置にはしない', () => {
    const z = fitRect({ scale: 1, x: 0, y: 0 }, { left: 0, top: 0, width: 10, height: 10 }, 400, 300)
    expect(z.scale).toBe(5)
    expect(z.x).toBe(0)
    expect(z.y).toBe(0)
  })

  it('ボードが枠より小さいときは、枠の真ん中に置く。拡大して大きくなったら、すき間ができないところまで動かせる', () => {
    // 枠 1200×600、ボード 800×600（左右に 200 ずつ余白）
    expect(clampZoom({ scale: 1, x: 0, y: 0 }, 1200, 600, 800, 600)).toEqual({ scale: 1, x: 200, y: 0 })
    // 2 倍（1600×1200）なら、左右・上下とも枠より大きいので、すき間ができないところまで
    expect(clampZoom({ scale: 2, x: 50, y: -900 }, 1200, 600, 800, 600)).toEqual({ scale: 2, x: 0, y: -600 })
  })

  it('枠いっぱいの倍率: 横長の枠に 4:3 のボードなら、幅いっぱいになる倍率', () => {
    expect(coverScale(1200, 600, 800, 600)).toBeCloseTo(1.5)
    expect(coverScale(400, 700, 400, 300)).toBeCloseTo(7 / 3)
    expect(coverScale(800, 600, 800, 600)).toBe(1)
  })
})
