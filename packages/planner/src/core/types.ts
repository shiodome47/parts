/**
 * 時間軸とプロジェクトのデータの形（@shiodome47/planner の土台）。
 * 日付は端末の時刻で数える（YYYY-MM-DD など）。日時は ISO 8601 の文字列。
 */

/** 時間軸の列。pool はプロジェクトの置き場（まだ列に置いていない） */
export type Horizon = 'today' | 'week' | 'month' | 'year' | 'life' | 'pool'

/** 列に並べる順の時間軸（pool を除く） */
export const HORIZONS = ['today', 'week', 'month', 'year', 'life'] as const
export type BoardHorizon = (typeof HORIZONS)[number]

/** 重要度・優先度。A 重要・緊急／B 重要／C 通常／D 低／P Private */
export type Priority = 'A' | 'B' | 'C' | 'D' | 'P'
export const PRIORITIES: Priority[] = ['A', 'B', 'C', 'D', 'P']

/** 習慣のくり返し（列の期間と同じ） */
export type Period = 'day' | 'week' | 'month' | 'year'

/** やること（期日目標もこれ） */
export interface Task {
  id: string
  title: string
  horizon: Horizon
  priority: Priority
  /** 同じ列・同じ優先度の中での順番（小さいほど上） */
  order: number
  /**
   * 下ろした先の項目のとき、元の項目の id。
   * 元は列に残したまま、少し薄く表示する。
   */
  parentId?: string
  /**
   * 下ろした先の項目が、どの期間のためのものか（today なら日付、week なら週）。
   * その期間が過ぎて終わっていなければ、消えた扱い（元の項目は薄い表示から戻る）。
   * 今日の列では、明日の日付なら「明日」の欄に出る。
   */
  placedFor?: string
  /** 期日（YYYY-MM-DD）。期日目標に付ける */
  due?: string
  /** どのプロジェクトのものか */
  projectId?: string
  /** プロジェクトの画面での並び（日付の無い期日目標をドラッグで並べたとき。時間軸の並びとは別） */
  goalOrder?: number
  /**
   * 習慣から下ろした項目のとき、元の習慣の id（parentId と同じ扱い。
   * 下ろした先で終えたら、習慣の今の期間のチェックが付く）
   */
  habitId?: string
  /** 終えた日時 */
  doneAt?: string
  /** メモ（名前を押すと開く） */
  note?: string
  /** 回数の目標（例: リーディング 100 回）。回数がめざす数に届くと、終えたことになる */
  count?: TaskCount
  createdAt: string
  updatedAt: string
}

/** 回数の目標（Task.count） */
export interface TaskCount {
  /** めざす回数（1 以上） */
  target: number
  /** 今の回数 */
  done: number
  /** 日ごとに足した回数（YYYY-MM-DD → その日に足した数）。振り返りに使う */
  log?: Record<string, number>
}

/** 習慣（ルーチン目標もこれ） */
export interface Habit {
  id: string
  title: string
  period: Period
  order: number
  /** チェックした日時。今の期間（今日・今週…）のものなら済み */
  checkedAt?: string
  /** チェックした日（YYYY-MM-DD）の記録。振り返りに使う（古いものから消し、最大 800 日分） */
  history?: string[]
  /** メモ（名前を押すと開く。アファメーションの文章・朝ルーチンの手順など） */
  note?: string
  /**
   * 毎月の習慣の「その日」。1〜31（日にち）、'end'（月末）、'w2-3'（第 2 水曜。曜日は 0 日曜〜6 土曜）、
   * 'wL-5'（最終金曜）。決めておくと、その日がある週は今週の列に、
   * その日（過ぎてチェックしていなければその後も）は今日の列にも、自動で出る
   */
  day?: MonthDay
  /** 毎週の習慣の曜日（0 日曜〜6 土曜）。決めておくと、その曜日から（その週にまだなら）今日の列にも出る */
  weekday?: number
  /**
   * 毎年の習慣の日付 'MM-DD'（例 '12-06'）か、月 'MM'（例 '12'）。
   * 日付: その日がある週は今週の列に、その日からは今日の列にも出る。どちらも、その月は数か月の列にも出る
   */
  yearDay?: string
  projectId?: string
  /**
   * 終えた日時（卒業・お休み）。あれば時間軸・プロジェクトのチェックの一覧には出さず、
   * 一番下の「これまでの習慣」に出す。チェックの記録（history）は消さない
   */
  endedAt?: string
  /** どう終えたか（endedAt と一緒に付ける） */
  endedAs?: HabitEnd
  /** 終えたときのひとこと（理由・気づいたこと） */
  endNote?: string
  /** 前に終えて、また始めたときの記録（古い順）。休んでいた間は、振り返りの数に入れない */
  breaks?: HabitBreak[]
  createdAt: string
  updatedAt: string
}

/** 習慣の終え方。graduated 卒業（身についた）／paused お休み（続かなかった・今はやめる） */
export type HabitEnd = 'graduated' | 'paused'

/** 習慣を終えて、また始めるまでの間 */
export interface HabitBreak {
  endedAt: string
  endedAs: HabitEnd
  endNote?: string
  /** また始めた日時 */
  resumedAt: string
}

/** 毎月の「その日」（Habit.day） */
export type MonthDay = number | 'end' | `w${1 | 2 | 3 | 4 | 5 | 'L'}-${0 | 1 | 2 | 3 | 4 | 5 | 6}`

/**
 * プロジェクト（期日目標とルーチン目標の 2 本柱）。
 * 「英語」「自治会」のような続けていくテーマもこれ。テーマの中に、プロジェクトを入れられる（1 段だけ）
 */
export interface Project {
  id: string
  name: string
  color: string
  order: number
  /** 入っているテーマ（プロジェクト）の id。無ければ、いちばん上のカード */
  parentId?: string
  /** プロジェクトの画面で置いた列（0 から。ドラッグで決める。無ければ、いちばん短い列へ自動で詰める） */
  column?: number
  /**
   * このプロジェクトが「中身」になっている期日目標の id（目標を細かく分けたもの）。
   * 目標の行に中身の進み具合が出て、このプロジェクトには、どの目標の中身かが出る
   */
  goalId?: string
  createdAt: string
  updatedAt: string
}

/**
 * 時間軸とプロジェクトが共有するデータ。
 * アプリは、これに自分の項目（日記など）を足した形で持ってよい（関数は足した項目を変えずに残す）
 */
export interface PlannerData {
  tasks: Task[]
  habits: Habit[]
  projects: Project[]
}
