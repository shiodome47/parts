import { MoreHorizontal } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from 'react'
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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  /** 閉じて、… のボタンにフォーカスを戻す（キーボードで使ったとき、続けて操作できるように） */
  const closeToButton = () => {
    setOpen(false)
    buttonRef.current?.focus()
  }
  const [pos, setPos] = useState<CSSProperties>(HIDDEN)
  useEffect(() => {
    if (!open) return
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node
      if (ref.current?.contains(t) || listRef.current?.contains(t)) return
      setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeToButton()
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

  // 開いたら、最初の選択肢にフォーカス（キーボードでも、上下の矢印で選べるように）
  useEffect(() => {
    if (!open) return
    const id = requestAnimationFrame(() => menuItems()[0]?.focus())
    return () => cancelAnimationFrame(id)
  }, [open])

  const menuItems = () => [...(listRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]:not(:disabled)') ?? [])]
  /** 上下の矢印・Home・End で選択肢を移る。Tab で閉じる */
  const onListKey = (e: ReactKeyboardEvent) => {
    const list = menuItems()
    const i = list.indexOf(document.activeElement as HTMLButtonElement)
    const go = (n: number) => {
      e.preventDefault()
      list[(n + list.length) % list.length]?.focus()
    }
    if (e.key === 'ArrowDown') go(i + 1)
    else if (e.key === 'ArrowUp') go(i < 0 ? list.length - 1 : i - 1)
    else if (e.key === 'Home') go(0)
    else if (e.key === 'End') go(list.length - 1)
    else if (e.key === 'Tab') {
      e.preventDefault()
      closeToButton()
    }
  }

  return (
    <div className="pl-menu" ref={ref}>
      <button
        ref={buttonRef}
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
        <div className="pl-menu-list" role="menu" aria-label={label} ref={listRef} style={pos} onKeyDown={onListKey}>
          {header}
          {items.map((item, i) =>
            item === 'separator' ? (
              <div key={`s${i}`} className="pl-menu-separator" role="separator" />
            ) : (
              <button
                key={`${i}:${item.label}`}
                type="button"
                role="menuitem"
                disabled={item.disabled}
                className={item.danger ? 'pl-menu-item pl-menu-danger' : 'pl-menu-item'}
                onClick={() => {
                  // 先にフォーカスを … に戻す（選んだあとに開く小窓が、フォーカスを受け取れるように）
                  closeToButton()
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
