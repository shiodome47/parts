import { createContext, useContext } from 'react'

/**
 * 表示の好み。
 * simple: 慣れたら要らない説明の文字（見出し・優先度の名前・「←今週」などの印）を消す
 */
export interface Display {
  simple: boolean
}

export const DisplayContext = createContext<Display>({ simple: false })

export const useDisplay = () => useContext(DisplayContext)
