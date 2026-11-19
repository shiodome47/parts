import type { VisionBoard, VisionItem, VisionView } from './types'

/**
 * 宝地図（ビジョンボード）の計算。位置・大きさはボードに対する割合で持つので、
 * PC で並べたものが、スマホでもそのまま縮んで同じ見た目になる。
 */

export const BOARD_ID = 'main'

/** ボードの縦横比（幅 / 高さ） */
export const ASPECT_RATIO: Record<Exclude<VisionBoard['aspect'], 'scroll'>, number> = {
  landscape: 4 / 3,
  portrait: 3 / 4,
  square: 1,
}

/** 下へ伸びるボードの高さ（幅に対する割合）の、いちばん短い・長い */
export const MIN_LENGTH = 0.5
export const MAX_LENGTH = 30
/** 下へ伸びるボードの高さ（まだ決めていなければ、横長と同じ） */
export function boardLength(board: VisionBoard): number {
  if (board.aspect !== 'scroll') return 1 / ASPECT_RATIO[board.aspect]
  return Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, board.length ?? 1 / ASPECT_RATIO.landscape))
}
/** ボードの幅 ÷ 高さ */
export function boardRatio(board: VisionBoard): number {
  return 1 / boardLength(board)
}

/** 空の新しいボード（横長・紙） */
export function emptyBoard(now: Date = new Date(), id: string = BOARD_ID): VisionBoard {
  const t = now.toISOString()
  return { id, aspect: 'landscape', background: 'paper', items: [], createdAt: t, updatedAt: t }
}

/** アプリのデータ（boards: ボードの一覧 を持つもの。ほかの項目があってもよい）から、そのボード（まだ無ければ、空の新しいもの） */
export function getBoard(data: object, now: Date = new Date(), id: string = BOARD_ID): VisionBoard {
  const boards = (data as { boards?: VisionBoard[] }).boards ?? []
  return boards.find((b) => b.id === id) ?? emptyBoard(now, id)
}

const touch = (board: VisionBoard, items: VisionItem[], now: Date): VisionBoard => ({ ...board, items, updatedAt: now.toISOString() })

/** 画面の外へ行きすぎないように（少しはみ出すのはよい） */
export function clampPos(v: number): number {
  return Math.min(0.97, Math.max(-0.3, v))
}

/** 新しく貼る。少しずつずらして、いちばん手前に置く */
export function addItem(board: VisionBoard, input: Pick<VisionItem, 'kind'> & Partial<VisionItem>, now: Date): VisionBoard {
  const n = board.items.length
  const z = n === 0 ? 1 : Math.max(...board.items.map((i) => i.z)) + 1
  const item: VisionItem = {
    id: crypto.randomUUID(),
    x: 0.08 + (n % 6) * 0.06,
    y: 0.08 + (n % 6) * 0.06,
    w: input.kind === 'image' ? 0.26 : 0.4,
    rotate: 0,
    ...(input.kind === 'text' ? { size: 0.05, color: 'ink' } : {}),
    ...input,
    z,
  }
  return touch(board, [...board.items, item], now)
}

export function updateItem(board: VisionBoard, id: string, patch: Partial<VisionItem>, now: Date): VisionBoard {
  return touch(
    board,
    board.items.map((i) =>
      i.id === id
        ? {
            ...i,
            ...patch,
            ...(patch.x !== undefined ? { x: clampPos(patch.x) } : {}),
            ...(patch.y !== undefined ? { y: clampPos(patch.y) } : {}),
            ...(patch.w !== undefined ? { w: Math.min(1.2, Math.max(0.05, patch.w)) } : {}),
            ...(patch.size !== undefined ? { size: Math.min(0.2, Math.max(0.015, patch.size)) } : {}),
          }
        : i,
    ),
    now,
  )
}

export function removeItem(board: VisionBoard, id: string, now: Date): VisionBoard {
  return touch(
    board,
    board.items.filter((i) => i.id !== id),
    now,
  )
}

/** いちばん手前へ・いちばん奥へ */
export function moveLayer(board: VisionBoard, id: string, to: 'front' | 'back', now: Date): VisionBoard {
  const zs = board.items.map((i) => i.z)
  const z = to === 'front' ? Math.max(...zs) + 1 : Math.min(...zs) - 1
  return updateItem(board, id, { z }, now)
}

/** 重なりの順（奥から） */
export function byLayer(items: VisionItem[]): VisionItem[] {
  return [...items].sort((a, b) => a.z - b.z)
}

// ─── 覚えた見え方 ───

/**
 * 今の見え方（倍率と、ずらした量 px）を、名前を付けて覚える。
 * frameW・frameH は見える枠、boardW・boardH は倍率 1 のときのボードの大きさ（枠の真ん中に置いてある）
 */
export function addView(
  board: VisionBoard,
  name: string,
  zoom: { scale: number; x: number; y: number },
  frameW: number,
  frameH: number,
  boardW = frameW,
  boardH = frameH,
  now = new Date(),
): VisionBoard {
  // 枠の真ん中に見えている、ボードの上の点
  const cx = boardW ? (frameW / 2 - zoom.x) / zoom.scale / boardW : 0.5
  const cy = boardH ? (frameH / 2 - zoom.y) / zoom.scale / boardH : 0.5
  const view: VisionView = {
    id: crypto.randomUUID(),
    name: name.trim() || '見え方',
    scale: zoom.scale,
    // 古い版（ボードと枠が同じ大きさ）でも、同じところが見えるように
    x: 0.5 - cx * zoom.scale,
    y: 0.5 - cy * zoom.scale,
    cx,
    cy,
  }
  return { ...board, views: [...(board.views ?? []), view], updatedAt: now.toISOString() }
}

/** 覚えた見え方を消す */
export function removeView(board: VisionBoard, id: string, now: Date): VisionBoard {
  return { ...board, views: (board.views ?? []).filter((v) => v.id !== id), updatedAt: now.toISOString() }
}

/** 覚えた見え方を、今の枠とボードの大きさでの、倍率・ずらした量（px）にする */
export function viewToZoom(view: VisionView, frameW: number, frameH: number, boardW = frameW, boardH = frameH): { scale: number; x: number; y: number } {
  // はじめの版で覚えたもの（x・y だけ）は、真ん中の点に直す
  const cx = view.cx ?? (0.5 - view.x) / view.scale
  const cy = view.cy ?? (0.5 - view.y) / view.scale
  return { scale: view.scale, x: frameW / 2 - cx * boardW * view.scale, y: frameH / 2 - cy * boardH * view.scale }
}

// ─── 下へ伸びるボード ───

/**
 * ボードの形を変える。下へ伸びるボードにするときは、今の並びのまま（高さを今の形に合わせる）
 */
export function setAspect(board: VisionBoard, aspect: VisionBoard['aspect'], now: Date): VisionBoard {
  if (aspect === board.aspect) return board
  const next: VisionBoard = { ...board, aspect, updatedAt: now.toISOString() }
  if (aspect === 'scroll') next.length = boardLength(board)
  return next
}

/**
 * 下へ伸びるボードの高さを変える（幅に対する割合）。
 * 位置は高さに対する割合なので、貼ったもの・覚えた見え方の上下の位置を直して、見た目の場所は動かさない
 */
export function setLength(board: VisionBoard, length: number, now: Date): VisionBoard {
  const old = boardLength(board)
  const len = Math.min(MAX_LENGTH, Math.max(MIN_LENGTH, length))
  if (board.aspect !== 'scroll' || Math.abs(len - old) < 1e-9) return board
  const f = old / len
  return {
    ...board,
    length: len,
    items: board.items.map((i) => ({ ...i, y: i.y * f })),
    ...(board.views
      ? {
          views: board.views.map((v) => {
            const cx = v.cx ?? (0.5 - v.x) / v.scale
            const cy = (v.cy ?? (0.5 - v.y) / v.scale) * f
            return { ...v, cx, cy, x: 0.5 - cx * v.scale, y: 0.5 - cy * v.scale }
          }),
        }
      : {}),
    updatedAt: now.toISOString(),
  }
}

/** 貼ったもののいちばん下（幅に対する割合。画像は高さがわからないので、幅と同じくらいと見る） */
export function contentBottom(board: VisionBoard): number {
  const len = boardLength(board)
  return Math.max(0, ...board.items.map((i) => i.y * len + (i.kind === 'image' ? i.w : (i.size ?? 0.05) * 2.5)))
}

/** 下へ広げる（step は幅に対する割合） */
export function growBoard(board: VisionBoard, step: number, now: Date): VisionBoard {
  return setLength(board, boardLength(board) + step, now)
}

/** 下を詰める（貼ったものは切らない。step は幅に対する割合）。もう詰められなければ、そのまま返す */
export function shrinkBoard(board: VisionBoard, step: number, now: Date): VisionBoard {
  const min = Math.max(MIN_LENGTH, contentBottom(board) + 0.05)
  return setLength(board, Math.max(min, boardLength(board) - step), now)
}
