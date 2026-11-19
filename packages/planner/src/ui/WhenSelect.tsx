import type { Habit } from '../core'
import { withDay } from '../core'
import { parseYearDay, withWhen } from '../core'
import { DaySelect } from './DaySelect'

// 月曜はじまりで並べる（値は 0 日曜〜6 土曜）
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0]
const WEEKDAYS = ['日', '月', '火', '水', '木', '金', '土']
const pad = (n: number) => String(n).padStart(2, '0')

/**
 * 習慣の「その日」を選ぶ。くり返しに合わせて、毎週は曜日・毎月は日（第何週の何曜日も）・毎年は月と日。
 * 決めると、その日が近いときに、時間軸の短い期間の列にも自動で出る
 */
export function WhenSelect({
  habit,
  onChange,
  onBlur,
  autoFocus,
  className = 'pl-select pl-select-quiet',
}: {
  habit: Habit
  onChange: (next: Habit) => void
  onBlur?: () => void
  autoFocus?: boolean
  className?: string
}) {
  if (habit.period === 'month') {
    return (
      <DaySelect
        className={className}
        autoFocus={autoFocus}
        label={`「${habit.title}」の毎月の日`}
        value={habit.day}
        onBlur={onBlur}
        onChange={(day) => onChange(withDay(habit, day))}
      />
    )
  }
  if (habit.period === 'week') {
    return (
      <select
        className={className}
        autoFocus={autoFocus}
        aria-label={`「${habit.title}」の毎週の曜日`}
        value={habit.weekday === undefined ? '' : String(habit.weekday)}
        onBlur={onBlur}
        onChange={(e) => onChange(withWhen(habit, e.target.value === '' ? undefined : Number(e.target.value)))}
      >
        <option value="">曜日を決めない</option>
        {WEEKDAY_ORDER.map((d) => (
          <option key={d} value={d}>
            {WEEKDAYS[d]}曜
          </option>
        ))}
      </select>
    )
  }
  if (habit.period === 'year') {
    const y = parseYearDay(habit.yearDay)
    const set = (month: number | undefined, day: number | undefined) =>
      onChange(withWhen(habit, month ? (day ? `${pad(month)}-${pad(day)}` : pad(month)) : undefined))
    return (
      <span className="pl-when-year" onBlur={onBlur}>
        <select
          className={className}
          autoFocus={autoFocus}
          aria-label={`「${habit.title}」の毎年の月`}
          value={y ? String(y.month) : ''}
          onChange={(e) => set(e.target.value ? Number(e.target.value) : undefined, y?.day)}
        >
          <option value="">月を決めない</option>
          {Array.from({ length: 12 }, (_, i) => (
            <option key={i + 1} value={i + 1}>
              {i + 1}月
            </option>
          ))}
        </select>
        {y && (
          <select
            className={className}
            aria-label={`「${habit.title}」の毎年の日`}
            value={y.day ? String(y.day) : ''}
            onChange={(e) => set(y.month, e.target.value ? Number(e.target.value) : undefined)}
          >
            <option value="">月だけ</option>
            {Array.from({ length: new Date(2024, y.month, 0).getDate() }, (_, i) => (
              <option key={i + 1} value={i + 1}>
                {i + 1}日
              </option>
            ))}
          </select>
        )}
      </span>
    )
  }
  return null
}
