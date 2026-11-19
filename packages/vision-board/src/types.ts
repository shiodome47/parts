/** 宝地図（ビジョンボード）のデータの形 */

/** 宝地図（ビジョンボード）に貼るもの。位置・大きさはボードに対する割合（どの画面でも同じ見た目になる） */
export interface VisionItem {
  id: string
  kind: 'image' | 'text'
  /** 画像の URL（kind === 'image'） */
  url?: string
  /** 言葉（kind === 'text'） */
  text?: string
  /** 左上の位置（ボードの幅・高さに対する割合 0〜1） */
  x: number
  y: number
  /** 画像の幅（ボードの幅に対する割合） */
  w: number
  /** 言葉の文字の大きさ（ボードの幅に対する割合） */
  size?: number
  /** 傾き（度） */
  rotate: number
  /** 重なりの順（大きいほど手前） */
  z: number
  /** 言葉の色 */
  color?: string
}

/**
 * 宝地図の、覚えた見え方。拡大の倍率と位置（ボードの幅・高さに対する割合）なので、
 * 画面の大きさが変わっても同じところが見える
 */
export interface VisionView {
  id: string
  name: string
  /** 倍率（1 = 全体） */
  scale: number
  /**
   * ずらした量（ボードの幅・高さに対する割合。左上に寄せると 0、右下へずらすと負）。
   * はじめの版の形（ボードと見える枠が同じ大きさだったとき）。今は cx・cy を使い、これは古い版のために残す
   */
  x: number
  y: number
  /** 見える枠の真ん中に来る、ボードの上の点（ボードの幅・高さに対する割合 0〜1） */
  cx?: number
  cy?: number
}

/** 宝地図（ビジョンボード）。今は 1 枚（id は 'main'） */
export interface VisionBoard {
  id: string
  /** ボードの形 */
  aspect: 'landscape' | 'portrait' | 'square'
  /** 背景 */
  background?: 'paper' | 'night' | 'cork'
  items: VisionItem[]
  /** 覚えた見え方（拡大と位置。名前を付けて、押すとその見え方になる） */
  views?: VisionView[]
  createdAt: string
  updatedAt: string
}
