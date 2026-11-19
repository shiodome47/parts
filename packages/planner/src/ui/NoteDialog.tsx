import { FileText } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Dialog } from './Dialog'
import { InlineInput } from './Rows'

/** メモの長さの上限（文字） */
export const NOTE_LIMIT = 20000

/**
 * 習慣・やることのメモ（棚の「テキストを書く」と同じように、名前を押すと開く）。
 * メモがあれば読む画面、無ければはじめから書く画面。
 */
export function NoteDialog({
  open,
  title,
  note,
  onSave,
  onClose,
}: {
  open: boolean
  title: string
  note: string
  onSave: (note: string) => void
  onClose: () => void
}) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState('')
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!open) return
    setValue(note)
    setEditing(!note)
  }, [open, note])

  useEffect(() => {
    if (open && editing) requestAnimationFrame(() => ref.current?.focus())
  }, [open, editing])

  const save = () => {
    onSave(value.trim() ? value.replace(/\s+$/, '') : '')
    setEditing(false)
    if (!value.trim()) onClose()
  }

  return (
    <Dialog open={open} onClose={onClose} title={title}>
      {editing ? (
        <form
          className="pl-stack"
          onSubmit={(e) => {
            e.preventDefault()
            save()
          }}
        >
          <textarea
            ref={ref}
            className="pl-input pl-note-input"
            value={value}
            maxLength={NOTE_LIMIT}
            rows={10}
            placeholder="メモ（やり方・読む文章・手順など）"
            aria-label={`「${title}」のメモ`}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              // ⌘Enter・Ctrl+Enter で保存
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault()
                save()
              }
            }}
          />
          <div className="pl-row pl-row-end">
            <span className="pl-note pl-note-hint">⌘Enter で保存</span>
            <button
              type="button"
              className="pl-button"
              onClick={() => {
                if (note) {
                  setValue(note)
                  setEditing(false)
                } else onClose()
              }}
            >
              やめる
            </button>
            <button type="submit" className="pl-button pl-button-primary">
              保存
            </button>
          </div>
        </form>
      ) : (
        <div className="pl-stack">
          <div className="pl-note-view">{note}</div>
          <div className="pl-row pl-row-end">
            <button type="button" className="pl-button" onClick={() => setEditing(true)}>
              書き換える
            </button>
            <button type="button" className="pl-button pl-button-primary" onClick={onClose}>
              閉じる
            </button>
          </div>
        </div>
      )}
    </Dialog>
  )
}

/**
 * 名前の「押す」と「ダブルクリック」を分ける。
 * 押すとメモを開き、ダブルクリックは名前の書き換え（1 回目の押下は少し待ってから開く）。
 */
export function useClickOrDouble(onClick: () => void, onDouble: () => void) {
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  useEffect(() => () => clearTimeout(timer.current), [])
  return {
    onClick: () => {
      clearTimeout(timer.current)
      timer.current = setTimeout(onClick, 250)
    },
    onDoubleClick: () => {
      clearTimeout(timer.current)
      window.getSelection?.()?.removeAllRanges()
      onDouble()
    },
  }
}

/**
 * 名前（押すとメモ・ダブルクリックで書き換え）とメモの小窓をひとまとめにしたもの。
 * wrap のときは名前を折り返して全文を出す（プロジェクトの画面など、行数より読めることが大事なところ）。
 */
export function NoteTitle({
  title,
  note,
  wrap = false,
  renameLabel,
  onRename,
  onSaveNote,
  menuOpener,
}: {
  title: string
  note?: string
  wrap?: boolean
  renameLabel: string
  onRename: (title: string) => void
  onSaveNote: (note: string) => void
  /** … のメニューから「メモ」「名前を変える」を開くための窓口を受け取る */
  menuOpener?: (open: { note: () => void; rename: () => void }) => void
}) {
  const [renaming, setRenaming] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const clicks = useClickOrDouble(() => setNoteOpen(true), () => setRenaming(true))
  menuOpener?.({ note: () => setNoteOpen(true), rename: () => setRenaming(true) })
  return (
    <>
      {renaming ? (
        <InlineInput
          initial={title}
          label={renameLabel}
          onDone={(next) => {
            setRenaming(false)
            if (next && next !== title) onRename(next)
          }}
        />
      ) : (
        <button
          type="button"
          className={`pl-task-title pl-title-button${wrap ? ' pl-title-wrap' : ''}`}
          title={note ? `${title}（押すとメモ）` : title}
          {...clicks}
        >
          <span className="pl-title-text">{title}</span>
          {note && <FileText className="pl-note-mark" aria-label="メモあり" />}
        </button>
      )}
      <NoteDialog open={noteOpen} title={title} note={note ?? ''} onClose={() => setNoteOpen(false)} onSave={onSaveNote} />
    </>
  )
}
