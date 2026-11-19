import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'

/**
 * 拡大・移動の状態（中身を translate(x, y) scale(scale) で動かす。原点は枠の左上）。
 * 中身（幅 cw・高さ ch）は、枠（幅 w・高さ h）より小さくてもよい（そのときは、枠の真ん中に置く）
 */
export interface Zoom {
  scale: number
  x: number
  y: number
}

export const MIN_SCALE = 1
export const MAX_SCALE = 5
const ONE: Zoom = { scale: 1, x: 0, y: 0 }

/** 1 つの向きの位置: 中身が枠より小さければ真ん中、大きければ、すき間ができないところまで */
function clampAxis(pos: number, frame: number, content: number): number {
  if (content <= frame) return (frame - content) / 2
  return Math.min(0, Math.max(frame - content, pos))
}

/** 倍率を 1〜5 に。枠（w×h）の中で、中身（cw×ch。省けば枠と同じ）が、すき間を作らないように（小さいときは真ん中に） */
export function clampZoom(z: Zoom, w: number, h: number, cw = w, ch = h): Zoom {
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, z.scale))
  return { scale, x: clampAxis(z.x, w, cw * scale), y: clampAxis(z.y, h, ch * scale) }
}

/** 枠の中の点（px, py）を動かさずに、倍率を next にする */
export function zoomAt(z: Zoom, next: number, px: number, py: number, w: number, h: number, cw = w, ch = h): Zoom {
  const cx = (px - z.x) / z.scale
  const cy = (py - z.y) / z.scale
  return clampZoom({ scale: next, x: px - cx * next, y: py - cy * next }, w, h, cw, ch)
}

/** 中身が枠いっぱい（すき間なし）になる倍率。横長の画面に 4:3 の中身なら、幅いっぱいになる */
export function coverScale(w: number, h: number, cw: number, ch: number): number {
  if (!cw || !ch) return 1
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.max(w / cw, h / ch)))
}

/**
 * 枠の中のある四角（今の見え方での位置 px。枠の左上が 0）が、枠いっぱい（少し余白）に見えるようにする。
 * 小さいものほど大きく寄る（上限は MAX_SCALE）
 */
export function fitRect(
  z: Zoom,
  rect: { left: number; top: number; width: number; height: number },
  w: number,
  h: number,
  margin = 0.08,
  contentW = w,
  contentH = h,
): Zoom {
  // 拡大前の座標に戻す
  const cx = (rect.left - z.x) / z.scale
  const cy = (rect.top - z.y) / z.scale
  const cw = rect.width / z.scale
  const ch = rect.height / z.scale
  if (cw <= 0 || ch <= 0) return z
  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, Math.min((w * (1 - margin * 2)) / cw, (h * (1 - margin * 2)) / ch)))
  // 四角の真ん中を、枠の真ん中に
  return clampZoom({ scale, x: w / 2 - (cx + cw / 2) * scale, y: h / 2 - (cy + ch / 2) * scale }, w, h, contentW, contentH)
}

export interface ZoomOptions {
  /**
   * 2 回たたいた（ダブルクリックした）ところに、寄せたいもの（画像など）があれば、その四角（画面での位置）を返す。
   * 返せば、そのものが枠いっぱいに見えるように寄る（もう拡大していれば、元に戻す）
   */
  focusRect?: (target: EventTarget | null) => DOMRect | null
  /** 2 回たたいた（ダブルクリックした）とき（1 回目の「押した」を取り消すのに使う） */
  onDouble?: () => void
  /** 枠（w×h）の中の、中身の大きさ（倍率 1 のとき）。省けば枠と同じ */
  contentSize?: (w: number, h: number) => { w: number; h: number }
  /**
   * true のとき、ふつうのホイール（トラックパッドの 2 本指）で、はみ出した中身を上下左右に動かす
   * （端まで来たら、ページのスクロールに渡す）。下へ伸びるボードで使う
   */
  wheelPan?: () => boolean
}

/**
 * 枠の中を、指で広げて（ピンチ）拡大・広げた中を 1 本指で動かす・2 回たたいて拡大／元に戻す。
 * PC では、トラックパッドのピンチ・Ctrl＋ホイールで拡大、拡大中はドラッグで動かす。
 * canPan(target) が false のところ（編集中の貼ったものの上など）では、1 本指で動かさない
 */
export function useZoom(boxRef: RefObject<HTMLElement | null>, canPan: (target: EventTarget | null) => boolean, options: ZoomOptions = {}) {
  const [zoom, setZoomState] = useState<Zoom>(ONE)
  const zoomRef = useRef<Zoom>(ONE)
  /** 指で動かした直後の「押した」は、押したことにしない */
  const movedRef = useRef(false)
  const canPanRef = useRef(canPan)
  canPanRef.current = canPan
  const optionsRef = useRef(options)
  optionsRef.current = options

  /** 枠の幅・高さと、中身の幅・高さ（倍率 1 のとき） */
  const dims = useCallback((): [number, number, number, number] => {
    const box = boxRef.current
    const w = box?.clientWidth ?? 0
    const h = box?.clientHeight ?? 0
    const c = optionsRef.current.contentSize?.(w, h) ?? { w, h }
    return [w, h, c.w, c.h]
  }, [boxRef])

  const setZoom = useCallback(
    (z: Zoom) => {
      const box = boxRef.current
      const next = box ? clampZoom(z, ...dims()) : z
      zoomRef.current = next
      setZoomState(next)
    },
    [boxRef, dims],
  )

  /** 枠の真ん中を中心に、倍率を factor 倍に */
  const zoomBy = useCallback(
    (factor: number) => {
      const box = boxRef.current
      if (!box) return
      const z = zoomRef.current
      setZoom(zoomAt(z, z.scale * factor, box.clientWidth / 2, box.clientHeight / 2, ...dims()))
    },
    [boxRef, setZoom, dims],
  )
  /** 倍率 1 に戻す（枠の真ん中を中心に。中身が枠より大きいとき＝下へ伸びるボードは、今見ているあたりのまま） */
  const reset = useCallback(() => {
    const box = boxRef.current
    if (!box) return setZoom(ONE)
    setZoom(zoomAt(zoomRef.current, 1, box.clientWidth / 2, box.clientHeight / 2, ...dims()))
  }, [boxRef, setZoom, dims])
  /** 中身が枠からはみ出している（動かして見られる） */
  const overflows = useCallback(() => {
    const [w, h, cw, ch] = dims()
    const s = zoomRef.current.scale
    return cw * s > w + 1 || ch * s > h + 1
  }, [dims])

  useEffect(() => {
    const box = boxRef.current
    if (!box) return
    const local = (clientX: number, clientY: number) => {
      const r = box.getBoundingClientRect()
      return { x: clientX - r.left, y: clientY - r.top }
    }

    /** 2 回たたいたときの、次の見え方: 拡大していれば元に戻す。寄せたいものの上なら、それに寄る。ほかは 2.5 倍 */
    const doubleTarget = (target: EventTarget | null, px: number, py: number): Zoom => {
      optionsRef.current.onDouble?.()
      const z = zoomRef.current
      if (z.scale > 1) return zoomAt(z, 1, px, py, ...dims())
      const r = optionsRef.current.focusRect?.(target)
      if (r) {
        const b = box.getBoundingClientRect()
        const [w, h, cw, ch] = dims()
        return fitRect(z, { left: r.left - b.left, top: r.top - b.top, width: r.width, height: r.height }, w, h, 0.08, cw, ch)
      }
      return zoomAt(z, 2.5, px, py, ...dims())
    }

    // ─── 指（タッチ） ───
    let pinch: { d0: number; s0: number; cx: number; cy: number } | null = null
    let pan: { x0: number; y0: number; z0: Zoom } | null = null
    let lastTap = 0
    const dist = (t: TouchList) => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY)
    const mid = (t: TouchList) => local((t[0].clientX + t[1].clientX) / 2, (t[0].clientY + t[1].clientY) / 2)

    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 2) {
        const m = mid(e.touches)
        const z = zoomRef.current
        // ピンチの中心にある中身の位置（拡大前の座標）
        pinch = { d0: dist(e.touches), s0: z.scale, cx: (m.x - z.x) / z.scale, cy: (m.y - z.y) / z.scale }
        pan = null
        movedRef.current = true
        e.preventDefault()
        return
      }
      if (e.touches.length === 1) {
        const t = e.touches[0]
        // 2 回たたく: 拡大していなければ 2.5 倍、していれば元に戻す
        const now = Date.now()
        if (now - lastTap < 300 && canPanRef.current(e.target)) {
          const p = local(t.clientX, t.clientY)
          setZoom(doubleTarget(e.target, p.x, p.y))
          lastTap = 0
          e.preventDefault()
          return
        }
        lastTap = now
        movedRef.current = false
        if (overflows() && canPanRef.current(e.target)) pan = { x0: t.clientX, y0: t.clientY, z0: zoomRef.current }
      }
    }
    const onTouchMove = (e: TouchEvent) => {
      if (pinch && e.touches.length === 2) {
        e.preventDefault()
        const m = mid(e.touches)
        const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, (pinch.s0 * dist(e.touches)) / pinch.d0))
        setZoom({ scale, x: m.x - pinch.cx * scale, y: m.y - pinch.cy * scale })
        return
      }
      if (pan && e.touches.length === 1) {
        e.preventDefault()
        const t = e.touches[0]
        const dx = t.clientX - pan.x0
        const dy = t.clientY - pan.y0
        if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true
        setZoom({ ...pan.z0, x: pan.z0.x + dx, y: pan.z0.y + dy })
      }
    }
    const onTouchEnd = (e: TouchEvent) => {
      if (e.touches.length < 2) pinch = null
      if (e.touches.length === 0) pan = null
    }

    // ─── PC: トラックパッドのピンチ・Ctrl＋ホイール ───
    const onWheel = (e: WheelEvent) => {
      if (!e.ctrlKey) {
        if (!optionsRef.current.wheelPan?.() || !overflows()) return
        const z = zoomRef.current
        const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? box.clientHeight : 1
        const next = clampZoom({ ...z, x: z.x - e.deltaX * unit, y: z.y - e.deltaY * unit }, ...dims())
        // 端まで来ていたら、ページのスクロールに任せる
        if (Math.abs(next.x - z.x) < 0.5 && Math.abs(next.y - z.y) < 0.5) return
        e.preventDefault()
        setZoom(next)
        return
      }
      e.preventDefault()
      const p = local(e.clientX, e.clientY)
      const z = zoomRef.current
      setZoom(zoomAt(z, z.scale * Math.exp(-e.deltaY / 200), p.x, p.y, ...dims()))
    }

    // ─── PC: 拡大中はマウスでドラッグして動かす・ダブルクリックで拡大／元に戻す ───
    let mouse: { x0: number; y0: number; z0: Zoom } | null = null
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 || !overflows() || !canPanRef.current(e.target)) return
      mouse = { x0: e.clientX, y0: e.clientY, z0: zoomRef.current }
      movedRef.current = false
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!mouse) return
      const dx = e.clientX - mouse.x0
      const dy = e.clientY - mouse.y0
      if (Math.abs(dx) + Math.abs(dy) > 4) movedRef.current = true
      setZoom({ ...mouse.z0, x: mouse.z0.x + dx, y: mouse.z0.y + dy })
    }
    const onMouseUp = () => {
      mouse = null
    }
    const onDblClick = (e: MouseEvent) => {
      if (!canPanRef.current(e.target)) return
      const p = local(e.clientX, e.clientY)
      setZoom(doubleTarget(e.target, p.x, p.y))
    }

    box.addEventListener('touchstart', onTouchStart, { passive: false })
    box.addEventListener('touchmove', onTouchMove, { passive: false })
    box.addEventListener('touchend', onTouchEnd)
    box.addEventListener('touchcancel', onTouchEnd)
    box.addEventListener('wheel', onWheel, { passive: false })
    box.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup', onMouseUp)
    box.addEventListener('dblclick', onDblClick)
    return () => {
      box.removeEventListener('touchstart', onTouchStart)
      box.removeEventListener('touchmove', onTouchMove)
      box.removeEventListener('touchend', onTouchEnd)
      box.removeEventListener('touchcancel', onTouchEnd)
      box.removeEventListener('wheel', onWheel)
      box.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup', onMouseUp)
      box.removeEventListener('dblclick', onDblClick)
    }
  }, [boxRef, setZoom, dims, overflows])

  // 枠の大きさが変わったら（画面の向きなど）、はみ出しを直す
  useEffect(() => {
    const box = boxRef.current
    if (!box || typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(() => setZoom(zoomRef.current))
    ro.observe(box)
    return () => ro.disconnect()
  }, [boxRef, setZoom])

  return { zoom, zoomBy, reset, setZoom, dims, moved: () => movedRef.current }
}
