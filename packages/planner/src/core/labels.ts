import type { BoardHorizon, HabitLevel, HabitTiers, Horizon, Period, Priority } from './types'
import type { PlaceTarget } from './logic'

export const HORIZON_NAME: Record<BoardHorizon, string> = {
  today: '今日',
  week: '今週',
  month: '数か月',
  year: '今年',
  life: '一生',
}

/** 列の英語の呼び名（見出しの小さな文字） */
export const HORIZON_SUB: Record<BoardHorizon, string> = {
  today: 'Action',
  week: 'Week',
  month: 'Month',
  year: 'Year',
  life: '⭐',
}

export const HORIZON_OPTION: Record<Horizon, string> = { ...HORIZON_NAME, pool: '未定（置き場）' }

/** 下ろすボタンの言葉 */
export const PLACE_LABEL: Record<PlaceTarget, string> = {
  today: '今日やる',
  tomorrow: '明日やる',
  nextweek: '来週やる',
  week: '今週やる',
  month: '数か月以内にやる',
  year: '今年やる',
  life: '一生のうちに',
}

/** 薄い表示のときの印（→今日 など） */
export const PLACED_MARK: Record<PlaceTarget, string> = {
  today: '今日',
  tomorrow: '明日',
  nextweek: '来週',
  week: '今週',
  month: '数か月',
  year: '今年',
  life: '一生',
}

export const PRIORITY_NAME: Record<Priority, string> = {
  A: '重要・緊急',
  B: '重要',
  C: '通常',
  D: '低',
  P: 'Private',
}

export const PERIOD_NAME: Record<Period, string> = {
  day: '毎日',
  week: '毎週',
  month: '毎月',
  year: '毎年',
}

/** 3 段階の名前 */
export const LEVEL_NAME: Record<HabitLevel, string> = { 1: '低', 2: '中', 3: '上' }

/** 3 段階の、中身（HabitTiers）の項目 */
export const LEVEL_TIER: Record<HabitLevel, keyof HabitTiers> = { 1: 'low', 2: 'mid', 3: 'top' }

/** 3 段階の中身を 1 行に（「低 3分・中 10分・上 30分」。中身の無い段階は出さない） */
export function tiersLabel(tiers: HabitTiers): string {
  return ([1, 2, 3] as const)
    .filter((l) => tiers[LEVEL_TIER[l]])
    .map((l) => `${LEVEL_NAME[l]} ${tiers[LEVEL_TIER[l]]}`)
    .join('・')
}
