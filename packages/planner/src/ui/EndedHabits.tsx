import { GraduationCap, Moon } from 'lucide-react'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { dayKey, dueLabel } from '../core'
import { endHabit, habitRecord, removeHabit, resumeHabit } from '../core'
import type { Habit, HabitEnd, Period, PlannerData } from '../core'
import type { PlannerStore } from './types'
import { Dialog } from './Dialog'
import { Menu, type MenuItem } from './Menu'
import { NoteTitle } from './NoteDialog'
import { ProjectDot, projectLabel } from './Rows'

type Apply = (c: Parameters<PlannerStore['apply']>[0]) => void

/** ひとことの長さの上限（文字） */
export const END_NOTE_LIMIT = 200

const CHOICES: { value: HabitEnd; name: string; sub: string; Icon: typeof GraduationCap }[] = [
  { value: 'graduated', name: '卒業', sub: '身についた', Icon: GraduationCap },
  { value: 'paused', name: 'お休み', sub: '続かなかった・今はやめる', Icon: Moon },
]

/** 「できた日 82%」の「日」と、「50 日のうち 41 日」の数え方 */
const UNIT: Record<Period, { name: string; count: string }> = {
  day: { name: '日', count: '日' },
  week: { name: '週', count: '週' },
  month: { name: '月', count: 'か月' },
  year: { name: '年', count: '年' },
}

/**
 * 習慣の … に足す「卒業・お休みにする」「完全に消す」と、その小窓。
 * 完全に消すのは、チェックの記録があるときだけ確かめる（記録が無ければ、すぐ消す）
 */
export function useHabitEnd(habit: Habit, data: PlannerData, apply: Apply): { items: MenuItem[]; dialogs: ReactNode } {
  const [ending, setEnding] = useState(false)
  const [removing, setRemoving] = useState(false)
  const remove = () => (habit.history?.length ? setRemoving(true) : apply(removeHabit(data, habit, new Date())))
  const items: MenuItem[] = [
    { label: habit.endedAt ? '卒業・お休みを変える…' : '卒業・お休みにする…', onSelect: () => setEnding(true) },
    { label: '完全に消す', danger: true, onSelect: remove },
  ]
  const dialogs = (
    <>
      <EndHabitDialog
        open={ending}
        habit={habit}
        onClose={() => setEnding(false)}
        onEnd={(as, note) => {
          setEnding(false)
          apply(endHabit(data, habit, as, note, new Date()))
        }}
      />
      <RemoveHabitDialog
        open={removing}
        habit={habit}
        onClose={() => setRemoving(false)}
        onRemove={() => {
          setRemoving(false)
          apply(removeHabit(data, habit, new Date()))
        }}
      />
    </>
  )
  return { items, dialogs }
}

/** 習慣を終える（卒業・お休みを選び、ひとことを添える）。もう終えた習慣なら、終え方とひとことを変える */
export function EndHabitDialog({
  open,
  habit,
  onClose,
  onEnd,
}: {
  open: boolean
  habit: Habit
  onClose: () => void
  onEnd: (as: HabitEnd, note: string) => void
}) {
  const [as, setAs] = useState<HabitEnd | undefined>(undefined)
  const [note, setNote] = useState('')
  const editing = !!habit.endedAt
  useEffect(() => {
    if (!open) return
    // 新しく終えるときは、どちらも選ばずに始める（自分で選んでもらう）
    setAs(habit.endedAs)
    setNote(habit.endNote ?? '')
  }, [open, habit.endedAs, habit.endNote])
  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (as) onEnd(as, note)
  }
  return (
    <Dialog open={open} onClose={onClose} title={editing ? `「${habit.title}」の終え方を変える` : `「${habit.title}」を終える`}>
      <form className="pl-stack" onSubmit={submit}>
        {!editing && <p className="pl-note">チェックの記録は消えません。習慣の一番下の「これまでの習慣」に残り、また始めることもできます。</p>}
        <div className="pl-end-choices" role="radiogroup" aria-label="終え方">
          {CHOICES.map(({ value, name, sub, Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={as === value}
              className={`pl-end-choice pl-end-${value}${as === value ? ' pl-end-choice-on' : ''}`}
              onClick={() => setAs(value)}
            >
              <Icon aria-hidden="true" />
              <span className="pl-end-choice-name">{name}</span>
              <span className="pl-end-choice-sub">{sub}</span>
            </button>
          ))}
        </div>
        <input
          className="pl-input"
          value={note}
          maxLength={END_NOTE_LIMIT}
          placeholder="ひとこと（なくてもよい）例: 朝が忙しかった"
          aria-label="ひとこと"
          onChange={(e) => setNote(e.target.value)}
        />
        <div className="pl-row pl-row-end">
          <button type="button" className="pl-button" onClick={onClose}>
            やめる
          </button>
          <button type="submit" className="pl-button pl-button-primary" disabled={!as}>
            {editing ? '変える' : as === 'paused' ? 'お休みにする' : as === 'graduated' ? '卒業する' : '選んでください'}
          </button>
        </div>
      </form>
    </Dialog>
  )
}

/** 習慣を完全に消す前に確かめる（チェックの記録も消え、元に戻せない） */
export function RemoveHabitDialog({ open, habit, onClose, onRemove }: { open: boolean; habit: Habit; onClose: () => void; onRemove: () => void }) {
  const count = habit.history?.length ?? 0
  return (
    <Dialog open={open} onClose={onClose} title={`「${habit.title}」を完全に消す`}>
      <div className="pl-stack">
        <p className="pl-text">
          チェックの記録（{count} 日分）も消え、元に戻せません。記録を残したいときは「卒業・お休みにする」を使ってください。
        </p>
        <div className="pl-row pl-row-end">
          <button type="button" className="pl-button" onClick={onClose}>
            やめる
          </button>
          <button type="button" className="pl-button pl-button-danger" onClick={onRemove}>
            完全に消す
          </button>
        </div>
      </div>
    </Dialog>
  )
}

/**
 * 終えた習慣（卒業・お休み）の一覧。はじめは閉じておき、開くと期間・できた割合・ひとことが見える。
 * 時間軸では習慣の一番下、プロジェクトではルーチン目標の一番下に置く
 */
export function EndedHabits({
  habits,
  data,
  store,
  now,
  label = 'これまでの習慣',
}: {
  habits: Habit[]
  data: PlannerData
  store: PlannerStore
  now: Date
  label?: string
}) {
  if (habits.length === 0) return null
  const apply: Apply = (c) => void store.apply(c)
  return (
    <details className="pl-ended">
      <summary className="pl-ended-summary">
        {label}（{habits.length}）
      </summary>
      <ul className="pl-list">
        {habits.map((h) => (
          <EndedHabitRow key={h.id} habit={h} data={data} apply={apply} now={now} />
        ))}
      </ul>
    </details>
  )
}

function EndedHabitRow({ habit, data, apply, now }: { habit: Habit; data: PlannerData; apply: Apply; now: Date }) {
  const { items, dialogs } = useHabitEnd(habit, data, apply)
  const opener: { note?: () => void; rename?: () => void } = {}
  const graduated = habit.endedAs === 'graduated'
  const Icon = graduated ? GraduationCap : Moon
  const project = habit.projectId ? data.projects.find((p) => p.id === habit.projectId) : undefined
  const record = habitRecord(habit, now)
  const unit = UNIT[habit.period]
  const range = `${dueLabel(dayKey(record.start), now)}〜${record.end ? dueLabel(dayKey(record.end), now) : ''}`
  const t = () => new Date().toISOString()
  return (
    <li className={`pl-ended-habit pl-ended-${graduated ? 'graduated' : 'paused'}`}>
      <span className="pl-ended-mark" role="img" aria-label={graduated ? '卒業' : 'お休み'} title={graduated ? '卒業（身についた）' : 'お休み（続かなかった・今はやめる）'}>
        <Icon aria-hidden="true" />
      </span>
      <div className="pl-ended-body">
        <div className="pl-ended-line">
          {project && <ProjectDot name={projectLabel(data, project)} color={project.color} />}
          <NoteTitle
            title={habit.title}
            note={habit.note}
            wrap
            renameLabel="習慣の名前"
            menuOpener={(o) => Object.assign(opener, o)}
            onRename={(title) => apply({ habits: [{ ...habit, title, updatedAt: t() }] })}
            onSaveNote={(note) => {
              const { note: _n, ...rest } = habit
              apply({ habits: [{ ...rest, ...(note ? { note } : {}), updatedAt: t() }] })
            }}
          />
        </div>
        <div className="pl-ended-meta">
          <span>{range}</span>
          {record.total > 0 && (
            <span title={`${record.total} ${unit.count}のうち ${record.done} ${unit.count}`}>
              できた{unit.name} {Math.round((record.done / record.total) * 100)}%
            </span>
          )}
        </div>
        {habit.endNote && <p className="pl-ended-note">「{habit.endNote}」</p>}
      </div>
      <Menu
        label={`「${habit.title}」の操作`}
        items={[
          { label: 'また始める', onSelect: () => apply(resumeHabit(data, habit, new Date())) },
          items[0],
          { label: '名前を変える', onSelect: () => opener.rename?.() },
          { label: habit.note ? 'メモを見る' : 'メモを書く', onSelect: () => opener.note?.() },
          'separator',
          items[1],
        ]}
      />
      {dialogs}
    </li>
  )
}
