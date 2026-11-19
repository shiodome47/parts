/**
 * スマホで画面の上に出す、横にすべらせて選ぶチップの列（棚の「カテゴリへ移動」と同じもの）。
 * 押すと、その列・カードへ移動する。active を渡すと、今見ているものを目立たせる。
 * 広い画面では CSS で隠す（どの幅から出すかは className で決める）。
 */
export function JumpBar({
  label,
  items,
  active,
  onJump,
  className,
}: {
  label: string
  items: { id: string; label: string; color?: string }[]
  active?: string | null
  onJump: (id: string) => void
  className?: string
}) {
  if (items.length < 2) return null
  return (
    <nav className={`pl-jump ${className ?? ''}`} aria-label={label}>
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <button
              type="button"
              className="pl-jump-chip"
              aria-current={active === it.id ? 'true' : undefined}
              onClick={() => onJump(it.id)}
            >
              {it.color && <span className={`pl-dot pl-color-${it.color}`} aria-hidden="true" />}
              <span className="pl-jump-label">{it.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  )
}

/** 見つけた要素へ、なめらかに移動する（横にめくる列なら横へ、縦に並ぶカードなら縦へ） */
export function scrollToElement(el: Element | null | undefined, inline = false) {
  el?.scrollIntoView?.(inline ? { behavior: 'smooth', inline: 'start', block: 'nearest' } : { behavior: 'smooth', block: 'start' })
}
