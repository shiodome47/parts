import type { ReactNode } from 'react'
import { DisplayContext } from './display'

export interface PlannerViewProps {
  /** 説明の文字を減らした「すっきり表示」 */
  simple?: boolean
  /** 明るさ。渡さなければ端末の設定に合わせる */
  theme?: 'light' | 'dark' | 'system'
  className?: string
}

/** 画面の外枠（見た目は .planner の中だけに効く） */
export function PlannerRoot({ simple = false, theme = 'system', className, children }: PlannerViewProps & { children: ReactNode }) {
  return (
    <DisplayContext.Provider value={{ simple }}>
      <div className={['planner', simple ? 'pl-simple' : '', className ?? ''].filter(Boolean).join(' ')} data-theme={theme}>
        {children}
      </div>
    </DisplayContext.Provider>
  )
}
