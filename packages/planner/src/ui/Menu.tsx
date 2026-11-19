import { MoreHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

/** 置く場所を測るまでは見せない */
const HIDDEN: CSSProperties = { position: 'fixed', top: 0, left: 0, right: 'auto', visibility: 'hidden' }

export interface MenuItem {
  label: string
  onSelect: () => void
  danger?: boolean
  /** 押せない（今は使えない）とき */
  disabled?: boolean
}

/**
 * 「…」を押すと出る小さな選択肢の一覧（外側を押す・Esc・スクロールで閉じる）。
 * 一覧は列の外（ページのいちばん外側）に出し、下に入りきらなければ上に開く（列の端で見切れないように）
 */
export function Menu({ label, items, header }: { label: string; items: (MenuItem | 'separator')[]; header?: ReactNode }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState<CSSProperties>(HIDDEN)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false)
    }
    // 一覧の中のスクロールでは閉じない（長い一覧を動かせるように）
    const onScroll = (e: Event) => {
      if (listRef.current?.contains(e.target as Node)) return
      setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  // ボタンの位置に合わせて置く（右端をそろえる。下に入りきらなければ上へ。画面の外には出さない）
  useLayoutEffect(() => {
    if (!open) {
      setPos(HIDDEN)
      return
    }
    const button = ref.current?.getBoundingClientRect()
    const list = listRef.current
    if (!button || !list) return
    const margin = 8
    const vw = window.innerWidth
    const vh = window.innerHeight
    const h = list.offsetHeight
    const w = list.offsetWidth
    const below = vh - button.bottom - margin
    const above = button.top - margin
    const up = h > below && above > below
    const room = up ? above : below
    const height = Math.min(h, Math.max(160, room - 4))
    const left = Math.min(Math.max(margin, button.right - w), vw - w - margin)
    const top = up ? Math.max(margin, button.top - 4 - height) : button.bottom + 4
    setPos({
      position: 'fixed',
      top,
      left,
      right: 'auto',
      maxHeight: height,
      overflowY: h > height ? 'auto' : undefined,
    })
  }, [open])

  return (
    <div className="pl-menu" ref={ref}>
      <button
        type="button"
        className="pl-row-button"
        aria-label={label}
        title={label}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {open &&
        createPortal(
        // ページのいちばん外に出すので、見た目（.planner の中だけに効く）を同じにするため、外枠をまねる
        <div className={scopeOf(ref.current)?.className ?? 'planner'} data-theme={scopeOf(ref.current)?.dataset.theme}>
        <div className="pl-menu-list" role="menu" ref={listRef} style={pos}>
          {header}
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={`s${i}`} className="pl-menu-separator" role="separator" />
            ) : (
              <button
                key={item.label}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={item.danger ? 'pl-menu-item pl-menu-danger' : 'pl-menu-item'}
                onClick={() => {
                  setOpen(false)
                  item.onSelect()
                }}
              >
                {item.label}
              </button>
            ),
          )}
        </div>
        </div>,
          document.body,
        )}
    </div>
  )
}

/** いちばん近い外枠（.planner） */
function scopeOf(el: HTMLElement | null): HTMLElement | null {
  return el?.closest<HTMLElement>('.planner') ?? null
}
