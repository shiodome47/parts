import { describe, expect, it } from 'vitest'
import { tiersLabel } from '../labels'
import {
  applyChanges,
  checkHabitFor,
  HABIT_HISTORY_LIMIT,
  newHabit,
  placeHabitDown,
  setHabitLevel,
  setHabitTiers,
  TIER_TEXT_LIMIT,
  toggleDone,
  toggleHabit,
  toggleHabitAll,
  toggleHabitOnDay,
} from '../logic'
import { addDays, dayKey } from '../period'
import { habitDoneOn, habitLevelOn } from '../review'
import type { Habit, PlannerData } from '../types'

// 2026-11-23 は月曜
const NOW = new Date(2026, 10, 23, 9, 0)
const TODAY = '2026-11-23'

function habit(period: 'day' | 'week' = 'day', tiers = true): Habit {
  const d: PlannerData = { tasks: [], habits: [], projects: [] }
  const h = newHabit(d, { title: '瞑想', period }, NOW)
  return tiers ? setHabitTiers(h, { low: '3分', mid: '10分', top: '30分' }, NOW) : h
}

describe('3 段階の中身', () => {
  it('前後の空白を取り、空のものは消す。長すぎるものは切る', () => {
    const h = setHabitTiers(habit('day', false), { low: ' 3分 ', mid: '  ', top: 'あ'.repeat(TIER_TEXT_LIMIT + 5) }, NOW)
    expect(h.tiers).toEqual({ low: '3分', top: 'あ'.repeat(TIER_TEXT_LIMIT) })
  })

  it('中身がどれも空でも、3 段階にできる（低・中・上だけで使う）', () => {
    expect(setHabitTiers(habit('day', false), {}, NOW).tiers).toEqual({})
  })

  it('やめると tiers は消えるが、それまでの段階の記録は残る', () => {
    let h = toggleHabit(habit(), NOW)
    h = setHabitLevel(h, NOW, 3, NOW)
    h = setHabitTiers(h, undefined, NOW)
    expect(h.tiers).toBeUndefined()
    expect(h.levels).toEqual({ [TODAY]: 3 })
    expect(habitLevelOn(h, NOW)).toBe(3)
  })

  it('1 行にまとめる（中身の無い段階は出さない）', () => {
    expect(tiersLabel({ low: '3分', mid: '10分', top: '30分' })).toBe('低 3分・中 10分・上 30分')
    expect(tiersLabel({ low: '3分', top: '30分' })).toBe('低 3分・上 30分')
    expect(tiersLabel({})).toBe('')
  })
})

describe('チェックすると「低」で付き、中・上へ上げられる', () => {
  it('3 段階の習慣は、チェックで「低」になる', () => {
    const h = toggleHabit(habit(), NOW)
    expect(h.levels).toEqual({ [TODAY]: 1 })
    expect(habitLevelOn(h, NOW)).toBe(1)
  })

  it('3 段階でない習慣には、段階の記録を付けない', () => {
    const h = toggleHabit(habit('day', false), NOW)
    expect(h.levels).toBeUndefined()
    expect(habitDoneOn(h, NOW)).toBe(true)
    expect(habitLevelOn(h, NOW)).toBeUndefined()
  })

  it('上げる・下げる。チェックが無いときは変えない', () => {
    const unchecked = habit()
    expect(setHabitLevel(unchecked, NOW, 3, NOW)).toBe(unchecked)
    let h = toggleHabit(unchecked, NOW)
    h = setHabitLevel(h, NOW, 3, NOW)
    expect(habitLevelOn(h, NOW)).toBe(3)
    h = setHabitLevel(h, NOW, 2, NOW)
    expect(habitLevelOn(h, NOW)).toBe(2)
    // 同じ段階なら、変えない（保存し直さない）
    expect(setHabitLevel(h, NOW, 2, NOW)).toBe(h)
  })

  it('外すと段階も消え、付け直すと「低」から', () => {
    let h = setHabitLevel(toggleHabit(habit(), NOW), NOW, 3, NOW)
    h = toggleHabit(h, NOW)
    expect(h.levels).toBeUndefined()
    expect(habitLevelOn(h, NOW)).toBeUndefined()
    h = toggleHabit(h, NOW)
    expect(habitLevelOn(h, NOW)).toBe(1)
  })

  it('3 段階にする前のチェックは、段階なし（ふつうに、できた）のまま', () => {
    let h = toggleHabit(habit('day', false), NOW)
    h = setHabitTiers(h, { low: '3分' }, NOW)
    expect(habitDoneOn(h, NOW)).toBe(true)
    expect(habitLevelOn(h, NOW)).toBeUndefined()
    // あとから上げることはできる
    expect(habitLevelOn(setHabitLevel(h, NOW, 3, NOW), NOW)).toBe(3)
  })
})

describe('振り返りから付け直す日', () => {
  const yesterday = addDays(NOW, -1)

  it('過ぎた日にできたことにすると「低」。その日の段階を上げられ、外すと消える', () => {
    let h = toggleHabitOnDay(habit(), yesterday, NOW)
    expect(habitLevelOn(h, yesterday)).toBe(1)
    h = setHabitLevel(h, yesterday, 3, NOW)
    expect(habitLevelOn(h, yesterday)).toBe(3)
    // 今日のチェックとは別
    h = toggleHabit(h, NOW)
    expect(h.levels).toEqual({ [dayKey(yesterday)]: 3, [TODAY]: 1 })
    h = toggleHabitOnDay(h, yesterday, NOW)
    expect(h.levels).toEqual({ [TODAY]: 1 })
  })
})

describe('毎週の習慣', () => {
  it('同じ週のほかの日から見ても、その週の段階。上げるのも、その週のチェックに付く', () => {
    let h = toggleHabit(habit('week'), NOW)
    const friday = addDays(NOW, 4)
    expect(habitLevelOn(h, friday)).toBe(1)
    h = setHabitLevel(h, friday, 3, friday)
    expect(h.levels).toEqual({ [TODAY]: 3 })
    // 次の週には持ち越さない
    expect(habitLevelOn(h, addDays(NOW, 7))).toBeUndefined()
  })
})

describe('時間軸から', () => {
  it('行のチェック（checkHabitFor）でも「低」', () => {
    const h = habit()
    const d = applyChanges({ tasks: [], habits: [h], projects: [] }, checkHabitFor({ tasks: [], habits: [h], projects: [] }, h, undefined, NOW))
    expect(d.habits[0].levels).toEqual({ [TODAY]: 1 })
  })

  it('今日に下ろした項目を終えても、習慣は「低」で付く', () => {
    const h = habit()
    let d: PlannerData = { tasks: [], habits: [h], projects: [] }
    d = applyChanges(d, placeHabitDown(d, h, 'today', NOW))
    d = applyChanges(d, toggleDone(d, d.tasks[0], NOW))
    expect(d.habits[0].levels).toEqual({ [TODAY]: 1 })
  })

  it('プロジェクトのチェック（toggleHabitAll）でも「低」', () => {
    const h = habit()
    const d = applyChanges({ tasks: [], habits: [h], projects: [] }, toggleHabitAll({ tasks: [], habits: [h], projects: [] }, h, NOW))
    expect(d.habits[0].levels).toEqual({ [TODAY]: 1 })
  })
})

describe('記録の上限', () => {
  it('古い日を記録から消すときは、その日の段階も消す', () => {
    const start = addDays(NOW, -HABIT_HISTORY_LIMIT)
    const history = Array.from({ length: HABIT_HISTORY_LIMIT }, (_, i) => dayKey(addDays(start, i)))
    const oldest = history[0]
    const h: Habit = { ...habit(), history, levels: { [oldest]: 3, [history[1]]: 2 } }
    const next = toggleHabit(h, NOW)
    expect(next.history).toHaveLength(HABIT_HISTORY_LIMIT)
    expect(next.history).not.toContain(oldest)
    expect(next.levels).toEqual({ [history[1]]: 2, [TODAY]: 1 })
  })
})
