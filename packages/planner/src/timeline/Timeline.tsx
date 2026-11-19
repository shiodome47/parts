import { useMemo } from 'react'
import type { Changes, PlannerData } from '../core'
import { PlannerRoot, type PlannerViewProps } from '../ui/Root'
import { Board } from './Board'

export interface TimelineProps extends PlannerViewProps {
  /** やること・習慣・プロジェクト（アプリが足した項目があってもよい） */
  data: PlannerData
  /** 今（日付の判断に使う。1 分ごとなどに新しくする） */
  now: Date
  /** 変更を受け取って保存する（画面は data が変わると変わる） */
  onChange: (changes: Changes) => unknown
}

/** 時間軸の画面 */
export function Timeline({ data, now, onChange, ...view }: TimelineProps) {
  const store = useMemo(() => ({ apply: onChange }), [onChange])
  return (
    <PlannerRoot {...view}>
      <Board data={data} store={store} now={now} />
    </PlannerRoot>
  )
}
