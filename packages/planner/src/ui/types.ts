import type { Changes } from '../core'

/** 画面が変更を渡す先（保存はアプリが行う） */
export interface PlannerStore {
  apply: (changes: Changes) => unknown
}
