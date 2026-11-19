import { useMemo } from 'react'
import type { Changes, PlannerData } from '../core'
import { PlannerRoot, type PlannerViewProps } from '../ui/Root'
import { ProjectsPage } from './ProjectsPage'

export interface ProjectsProps extends PlannerViewProps {
  /** やること・習慣・プロジェクト（アプリが足した項目があってもよい） */
  data: PlannerData
  /** 今（日付の判断に使う） */
  now: Date
  /** 変更を受け取って保存する */
  onChange: (changes: Changes) => unknown
}

/** プロジェクトの画面 */
export function Projects({ data, now, onChange, ...view }: ProjectsProps) {
  const store = useMemo(() => ({ apply: onChange }), [onChange])
  return (
    <PlannerRoot {...view}>
      <ProjectsPage data={data} store={store} now={now} />
    </PlannerRoot>
  )
}
