import type { MonthDay } from '../core'
import { dayLabel } from '../core'

const WEEKS = [1, 2, 3, 4, 'L'] as const
// 月曜はじまりで並べる（値は 0 日曜〜6 土曜）
const WEEKDAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

/**
 * 毎月の「その日」を選ぶ。日にち（1〜31日・月末）か、第何週の何曜日（第1〜第4・最終）。
 * value が undefined なら「決めない」
 */
export function DaySelect({
  value,
  label,
  onChange,
  onBlur,
  autoFocus,
  className = 'pl-select pl-select-quiet',
}: {
  value: MonthDay | undefined
  label: string
  onChange: (day: MonthDay | undefined) => void
  onBlur?: () => void
  autoFocus?: boolean
  className?: string
}) {
  return (
    <select
      className={className}
      autoFocus={autoFocus}
      aria-label={label}
      value={value === undefined ? '' : String(value)}
      onBlur={onBlur}
      onChange={(e) => onChange(parseDayValue(e.target.value))}
    >
      <option value="">決めない</option>
      <optgroup label="曜日（第何週）">
        {WEEKS.map((w) =>
          WEEKDAY_ORDER.map((d) => {
            const v = `w${w}-${d}` as MonthDay
            return (
              <option key={v} value={v}>
                {dayLabel(v)}曜
              </option>
            )
          }),
        )}
      </optgroup>
      <optgroup label="日にち">
        {Array.from({ length: 31 }, (_, i) => (
          <option key={i + 1} value={String(i + 1)}>
            {i + 1}日
          </option>
        ))}
        <option value="end">月末</option>
      </optgroup>
    </select>
  )
}

/** 選んだ値を MonthDay に（空なら undefined） */
export function parseDayValue(v: string): MonthDay | undefined {
  if (v === '') return undefined
  if (v === 'end') return 'end'
  if (/^w[1-5L]-[0-6]$/.test(v)) return v as MonthDay
  const n = Number(v)
  return Number.isInteger(n) && n >= 1 && n <= 31 ? n : undefined
}
