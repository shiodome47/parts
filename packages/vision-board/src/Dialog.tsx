import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

const stop = (e: { stopPropagation: () => void }) => e.stopPropagation()

/** 画面の手前に出す小窓（Esc・外側を押すと閉じる） */
export function Dialog({
  open,
  onClose,
  title,
  children,
  dismissible = true,
  wide = false,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
  /** false のときは、Esc や外側では閉じない（選んでもらう必要があるとき） */
  dismissible?: boolean
  /** 画像などを大きく見せるとき */
  wide?: boolean
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal?.()
    if (!open && d.open) d.close?.()
  }, [open])

  return (
    <dialog
      ref={ref}
      className={wide ? 'vb-dialog vb-dialog-wide' : 'vb-dialog'}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault()
        if (dismissible) onClose()
      }}
      onClick={(e) => {
        e.stopPropagation()
        if (dismissible && e.target === e.currentTarget) onClose()
      }}
      // 小窓は、並べ替えられる行（メモつきの習慣など）の中に置かれることがある。
      // 小窓の中での押す・ドラッグ・キー操作が外の行に届くと、行をつかんで動かしてしまうので、ここで止める
      onPointerDown={stop}
      onMouseDown={stop}
      onTouchStart={stop}
      onKeyDown={stop}
      onDoubleClick={stop}
    >
      {open && (
        <div className="vb-dialog-body">
          <header className="vb-dialog-header">
            <h2>{title}</h2>
            {dismissible && (
              <button type="button" className="vb-icon-button" onClick={onClose} aria-label="閉じる">
                <X aria-hidden="true" />
              </button>
            )}
          </header>
          {children}
        </div>
      )}
    </dialog>
  )
}
