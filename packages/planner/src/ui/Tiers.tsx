import { useEffect, useState, type ReactNode } from 'react'
import { habitLevelOn, LEVEL_NAME, LEVEL_TIER, setHabitLevel, setHabitTiers, TIER_TEXT_LIMIT, tiersLabel } from '../core'
import { HABIT_LEVELS, type Habit, type HabitLevel, type HabitTiers } from '../core'
import type { MenuItem } from './Menu'
import type { PlannerStore } from './types'
import { Dialog } from './Dialog'

type Apply = (c: Parameters<PlannerStore['apply']>[0]) => void

/**
 * 習慣の 3 段階（低・中・上）。付けたい習慣にだけ付ける。
 * - … から「3 段階にする…」「3 段階を変える…」
 * - まだのときは、行の名前の下に「低 3分・中 10分・上 30分」
 * - チェックすると「低」で付き、名前の下の「中」「上」を押すと上げられる（チェックの色も変わる）
 */

/** 段階に合わせて、行に付ける名前（チェックの色を変える）。段階の記録が無ければ空 */
export function levelClass(habit: Habit, checked: boolean, day: Date): string {
  const level = checked ? habitLevelOn(habit, day) : undefined
  return level ? ` pl-lv-${level}` : ''
}

/** 行の名前の下に出す、3 段階の中身（まだ）か、どこまでできたかを選ぶ印（済み） */
export function TierLine({ habit, checked, day, apply }: { habit: Habit; checked: boolean; day: Date; apply: Apply }) {
  if (!habit.tiers) return null
  const tiers = habit.tiers
  if (!checked) {
    const label = tiersLabel(tiers)
    return label ? <span className="pl-tier-text">{label}</span> : null
  }
  const level = habitLevelOn(habit, day)
  const text = level ? tiers[LEVEL_TIER[level]] : undefined
  return (
    <span className="pl-tier-meta">
      <span className="pl-tier-pick" role="radiogroup" aria-label={`「${habit.title}」はどこまでできたか`}>
        {HABIT_LEVELS.map((l) => {
          const detail = tiers[LEVEL_TIER[l]]
          return (
            <button
              key={l}
              type="button"
              role="radio"
              aria-checked={level === l}
              className={`pl-tier-button pl-tier-button-${l}`}
              title={detail ? `${LEVEL_NAME[l]} ${detail}` : LEVEL_NAME[l]}
              onClick={() => apply({ habits: [setHabitLevel(habit, day, l, new Date())] })}
            >
              {LEVEL_NAME[l]}
            </button>
          )
        })}
      </span>
      {text && <span className="pl-tier-text">{text}</span>}
    </span>
  )
}

/** … に足す「3 段階にする…」と、その小窓 */
export function useTiersMenu(habit: Habit, apply: Apply): { item: MenuItem; dialog: ReactNode } {
  const [editing, setEditing] = useState(false)
  const item: MenuItem = { label: habit.tiers ? '3 段階を変える…' : '3 段階にする…', onSelect: () => setEditing(true) }
  const dialog = editing ? (
    <TiersDialog
      habit={habit}
      onClose={() => setEditing(false)}
      onSave={(tiers) => {
        setEditing(false)
        apply({ habits: [setHabitTiers(habit, tiers, new Date())] })
      }}
    />
  ) : null
  return { item, dialog }
}

const FIELDS: { key: keyof HabitTiers; level: HabitLevel; example: string }[] = [
  { key: 'low', level: 1, example: '例: 3分' },
  { key: 'mid', level: 2, example: '例: 10分' },
  { key: 'top', level: 3, example: '例: 30分' },
]

/** 3 段階の中身を書く小窓。3 段階をやめることもできる（それまでの記録は残る） */
export function TiersDialog({ habit, onClose, onSave }: { habit: Habit; onClose: () => void; onSave: (tiers: HabitTiers | undefined) => void }) {
  const [values, setValues] = useState<HabitTiers>(habit.tiers ?? {})
  useEffect(() => setValues(habit.tiers ?? {}), [habit.id, habit.tiers])
  const editing = !!habit.tiers
  return (
    <Dialog open onClose={onClose} title={editing ? `「${habit.title}」の 3 段階を変える` : `「${habit.title}」を 3 段階にする`}>
      <form
        className="pl-stack"
        onSubmit={(e) => {
          e.preventDefault()
          onSave(values)
        }}
      >
        <p className="pl-note">
          チェックを押すと「低」で付きます。中・上までやれた日は、名前の下の「中」「上」を押して上げます。振り返りでは、上は濃い紫、低は薄い緑で出ます。
        </p>
        <div className="pl-tier-fields">
          {FIELDS.map(({ key, level, example }, i) => (
            <label key={key} className={`pl-tier-field pl-tier-field-${level}`}>
              <span className="pl-tier-field-name">{LEVEL_NAME[level]}</span>
              <input
                className="pl-input"
                value={values[key] ?? ''}
                maxLength={TIER_TEXT_LIMIT}
                placeholder={example}
                autoFocus={i === 0}
                onChange={(e) => setValues((v) => ({ ...v, [key]: e.target.value }))}
              />
            </label>
          ))}
        </div>
        <p className="pl-note">どれも空でも使えます（低・中・上だけを選ぶ）。</p>
        <div className="pl-row pl-row-end">
          {editing && (
            <button type="button" className="pl-button pl-button-danger pl-count-stop" onClick={() => onSave(undefined)}>
              3 段階をやめる
            </button>
          )}
          <button type="button" className="pl-button" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="pl-button pl-button-primary">
            決める
          </button>
        </div>
      </form>
    </Dialog>
  )
}
