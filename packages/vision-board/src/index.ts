/**
 * @shiodome47/vision-board — 宝地図（ビジョンボード）の部品。
 * 画像と言葉を自由に貼り、ピンチ・ホイールで拡大、見え方を覚えて切り替えられる。
 * 見た目は '@shiodome47/vision-board/style.css' を読み込む。
 */
import './style.css'

export { VisionBoardView as VisionBoard, type VisionBoardProps } from './VisionBoard'
export type { LoadImage } from './BoardImage'
export type { VisionBoard as VisionBoardData, VisionItem, VisionView } from './types'
export {
  ASPECT_RATIO,
  MIN_LENGTH,
  MAX_LENGTH,
  boardLength,
  boardRatio,
  setAspect,
  setLength,
  growBoard,
  shrinkBoard,
  trimBoard,
  contentBottom,
  BOARD_ID,
  emptyBoard,
  getBoard,
  addItem,
  updateItem,
  removeItem,
  moveLayer,
  byLayer,
  clampPos,
  addView,
  removeView,
  viewToZoom,
} from './board'
export { clampZoom, zoomAt, fitRect, coverScale, MIN_SCALE, MAX_SCALE, type Zoom } from './useZoom'
