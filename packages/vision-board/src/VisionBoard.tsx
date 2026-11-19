import { ArrowDownToLine, ArrowUpToLine, FoldVertical, BookmarkPlus, BringToFront, Check, ChevronsDown, ChevronsLeft, ChevronsUp, Menu, ImagePlus, Maximize2, Minimize2, Minus, MoveHorizontal, Pencil, Plus, RotateCcw, RotateCw, SendToBack, Shrink, Trash2, Type, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import type { VisionBoard, VisionItem } from './types'
import { addItem, addView, boardLength, boardRatio, byLayer, growBoard, moveLayer, removeItem, removeView, setAspect, shrinkBoard, trimBoard, updateItem, viewToZoom } from './board'
import { safeLocalStore } from './storage'
import { Dialog } from './Dialog'
import { BoardImage, type LoadImage } from './BoardImage'
import { coverScale, useZoom } from './useZoom'

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const TEXT_COLORS: Record<string, string> = { ink: '言葉の色: 黒', gold: '金', red: '赤', white: '白' }

type Drag = { id: string; mode: 'move' | 'resize'; startX: number; startY: number; orig: VisionItem }

/** この端末で最後に選んだ見え方（次に開くと、その見え方から始まる） */
/**
 * 道具の行の見せ方（この端末で覚える）。
 * full: 文字つき／icons: アイコンだけ（1 行）／folded: たたむ（宝地図の左上の ≡ から出す）
 */
type BarLevel = 'full' | 'icons' | 'folded'
const NEXT_LEVEL: Record<BarLevel, { to: BarLevel; label: string }> = {
  full: { to: 'icons', label: '道具を小さく（アイコンだけ）' },
  icons: { to: 'folded', label: '道具をたたむ（左上の ≡ から出す）' },
  folded: { to: 'full', label: '道具を広げる（文字つき）' },
}
function savedBarLevel(key: string): BarLevel {
  const s = safeLocalStore.get(key)
  if (s === 'full' || s === 'icons' || s === 'folded') return s
  // はじめては、スマホはアイコンだけ、PC は文字つき
  return typeof window !== 'undefined' && window.matchMedia?.('(max-width: 640px)').matches ? 'icons' : 'full'
}


/** 枠（w×h）の中に、縦横比 ratio のボードを収めたときの大きさ */
function fitBoard(w: number, h: number, ratio: number): { w: number; h: number } {
  if (!w || !h) return { w, h }
  const bw = Math.min(w, h * ratio)
  return { w: bw, h: bw / ratio }
}
/** ボードの下に空ける高さ */
const BOTTOM_GAP = 16

/**
 * 宝地図（ビジョンボード）。画像と言葉を自由に貼る。
 * 「編集」のときだけ動かせる（ドラッグで移動、右下のつまみで大きさ、上の道具で傾き・重なり・消す）。
 * 「見る」のときは、画像を押すと大きく見られる。位置は割合で持つので、スマホでも同じ並びで縮んで見える。
 */
export interface VisionBoardProps {
  /** ボード（貼ったもの・形・背景・覚えた見え方）。まだ無ければ emptyBoard() */
  board: VisionBoard
  /** ボードが変わったとき（保存はアプリが行う） */
  onChange: (board: VisionBoard) => unknown
  /**
   * 画像を受け取って置き、その URL を返す。渡すと「画像を貼る」が出る（貼り付け・落とすでも受け取る）。
   * 置けないとき（合言葉が無いなど）は、わけを書いた Error を投げる（そのまま画面に出る）
   */
  uploadImage?: (file: File) => Promise<string>
  /**
   * 画像を読む方法を差し替える（合言葉の要る置き場など）。Blob を返すと部品が表示用の URL を作る。
   * 文字列を返すと、その URL をそのまま使う。渡さなければ、URL をそのまま表示する
   */
  loadImage?: LoadImage
  /**
   * この端末に覚えておく名前の頭（最後に選んだ見え方・枠いっぱい・道具の見せ方）。
   * 1 つのサイトに宝地図を 2 つ置くときは、別の名前にする。既定は 'visionBoard:'
   */
  storagePrefix?: string
  /** 明るさ。light / dark / system（既定。端末の設定に合わせる） */
  theme?: 'light' | 'dark' | 'system'
  className?: string
}

/**
 * 宝地図（ビジョンボード）の部品。
 * 見た目は '@shiodome47/vision-board/style.css' を読み込む（.vision-board の中だけに効く）
 */
export function VisionBoardView({ board: saved, onChange, uploadImage, loadImage, storagePrefix = 'visionBoard:', theme = 'system', className }: VisionBoardProps) {
  const VIEW_KEY = `${storagePrefix}View`
  const FIT_KEY = `${storagePrefix}FitHeight`
  const BAR_KEY = `${storagePrefix}Bar`
  // 画像を貼り終えたときに、いちばん新しいボードに足す（貼っているあいだに変わってもよいように）
  const latest = useRef(saved)
  latest.current = saved
  // ドラッグ中は手元だけで動かし、離したときに保存する
  const [draft, setDraft] = useState<VisionBoard | null>(null)
  const board = draft ?? saved
  const [editing, setEditing] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const [viewing, setViewing] = useState<VisionItem | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [writing, setWriting] = useState<{ id: string | null; text: string } | null>(null)
  const boxRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLDivElement>(null)
  // 指で広げて拡大（編集中は、貼ったものの上では動かさない＝そのものを動かす）
  // 1 回たたいたら画像を大きく見る。ただし 2 回たたいたら（画像に寄る）、見るのはやめる
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cancelOpen = () => {
    if (openTimer.current) clearTimeout(openTimer.current)
    openTimer.current = null
  }
  const ratioRef = useRef(1)
  const scrollRef = useRef(false)
  const { zoom, zoomBy, reset, setZoom, dims, moved } = useZoom(boxRef, (target) => !editing || !(target instanceof Element && target.closest('.vb-vision-item')), {
    // 見るとき、画像・言葉を 2 回たたくと、それが画面いっぱいに見えるように寄る
    focusRect: (target) => (!editing && target instanceof Element ? (target.closest('.vb-vision-item')?.getBoundingClientRect() ?? null) : null),
    onDouble: cancelOpen,
    // 下へ伸びるボードは、ふつうのホイール（トラックパッドの 2 本指）で上下に動かす
    wheelPan: () => scrollRef.current,
    // 見える枠は使える場所いっぱい。ボードはその中に収めて真ん中に置く（拡大すると、左右・上下の余白まで広がる）
    // 下へ伸びるボードは、幅いっぱい（枠より高い分は、ホイール・指・ドラッグで下へ動かして見る）
    contentSize: (w, h) => (scrollRef.current ? { w, h: w / ratioRef.current } : fitBoard(w, h, ratioRef.current)),
  })
  // 全画面（見出しや道具を隠して、宝地図だけを大きく）
  const rootRef = useRef<HTMLDivElement>(null)
  const [full, setFull] = useState(false)
  // 「枠いっぱい」: ボードを、見える枠にすき間なく広げる（横長の画面なら幅いっぱい、縦長なら高さいっぱい。はみ出したところは指・ドラッグで動かして見る）
  const [fill, setFillState] = useState(() => safeLocalStore.get(FIT_KEY) === '1')
  const setFill = (v: boolean) => {
    setFillState(v)
    if (v) safeLocalStore.set(FIT_KEY, '1')
    else safeLocalStore.remove(FIT_KEY)
  }
  const stageRef = useRef<HTMLDivElement>(null)
  // 覚えた見え方（最後に選んだものを、この端末で覚える）
  const [activeView, setActiveViewState] = useState(() => safeLocalStore.get(VIEW_KEY) ?? '')
  const setActiveView = (id: string) => {
    setActiveViewState(id)
    if (id) safeLocalStore.set(VIEW_KEY, id)
    else safeLocalStore.remove(VIEW_KEY)
  }
  const [naming, setNaming] = useState<string | null>(null)
  // 道具の行（文字つき → アイコンだけ → たたむ）
  const [barLevel, setBarLevelState] = useState<BarLevel>(() => savedBarLevel(BAR_KEY))
  const setBarLevel = (l: BarLevel) => {
    setBarLevelState(l)
    safeLocalStore.set(BAR_KEY, l)
    setBarOpen(false)
  }
  // たたんでいるときに、≡ で道具を出しているか
  const [barOpen, setBarOpen] = useState(false)
  const startViewApplied = useRef(false)
  // 見える枠の大きさ（ボードの大きさ・言葉の文字の大きさを決める）
  const [frame, setFrame] = useState({ w: 0, h: 0 })
  const drag = useRef<Drag | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const save = (next: VisionBoard) => {
    setDraft(null)
    void onChange(next)
  }

  useEffect(() => {
    const el = boxRef.current
    if (!el) return
    const set = () => setFrame((f) => (f.w === el.clientWidth && f.h === el.clientHeight ? f : { w: el.clientWidth, h: el.clientHeight }))
    set()
    if (typeof ResizeObserver === 'undefined') return
    const ro = new ResizeObserver(set)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const ratio = boardRatio(board)
  ratioRef.current = ratio
  const scroll = board.aspect === 'scroll'
  scrollRef.current = scroll
  const content = scroll ? { w: frame.w, h: frame.w / ratio } : fitBoard(frame.w, frame.h, ratio)
  const width = content.w
  // ボードより上にあるもの（見出し・道具・見え方の帯）の高さを測って、残りの高さいっぱいに使う
  const [reserve, setReserve] = useState(190)
  useLayoutEffect(() => {
    const measure = () => {
      const stage = stageRef.current
      if (!stage) return
      const top = Math.round(stage.getBoundingClientRect().top + (full ? 0 : window.scrollY)) + BOTTOM_GAP
      setReserve((cur) => (Math.abs(cur - top) > 1 ? top : cur))
    }
    measure()
    // 全画面の出入りは、終わるまで少しかかる（終わってから測り直す）
    const later = () => requestAnimationFrame(measure)
    window.addEventListener('resize', measure)
    document.addEventListener('fullscreenchange', later)
    return () => {
      window.removeEventListener('resize', measure)
      document.removeEventListener('fullscreenchange', later)
    }
  })

  // 下へ伸びるボードが枠より高い（下へ動かして見る）
  const overflowY = scroll && content.h > frame.h + 1
  // ボードの高さが変わったら（下に広げる・詰める）、はみ出しを直す
  useEffect(() => {
    setZoom(zoom)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content.h])

  // 枠いっぱいにするときの倍率（ボードの形と画面の形が同じなら 1 = 出さない）
  const cover = coverScale(frame.w, frame.h, content.w, content.h)
  const canFill = cover > 1.02
  // 最後に「枠いっぱい」にしたときの倍率（枠の大きさが変わったら、合わせ直すため）
  const filledAt = useRef<number | null>(null)
  const fillFrame = () => {
    const [w, h] = dims()
    // 真ん中を中心に、枠いっぱいへ
    filledAt.current = cover
    setZoom({ scale: cover, x: w / 2 - (content.w * cover) / 2, y: h / 2 - (content.h * cover) / 2 })
  }
  // 枠いっぱいで見ているあいだに枠の大きさが変わったら（読み込み直した直後・画面の向き）、合わせ直す
  useEffect(() => {
    if (!fill || activeView || filledAt.current === null) return
    if (Math.abs(zoom.scale - filledAt.current) > 0.01) {
      // 自分で拡大・縮小したら、もう合わせない
      filledAt.current = null
      return
    }
    if (Math.abs(cover - filledAt.current) > 0.005) fillFrame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, frame.h, cover])

  // はじめに開いたとき、最後に選んだ見え方（無ければ「枠いっぱい」にしていたらそれ）から始める
  useEffect(() => {
    if (startViewApplied.current || frame.w === 0) return
    startViewApplied.current = true
    const v = (board.views ?? []).find((x) => x.id === activeView)
    if (v) setZoom(viewToZoom(v, ...dims()))
    else if (fill && canFill) fillFrame()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frame.w, board.views])

  // 全画面: 使えるブラウザ（PC・Android）では、ブラウザの帯も隠す。Esc で戻る
  const enterFull = () => {
    setEditing(false)
    setSelected(null)
    setFull(true)
    const el = rootRef.current
    if (el?.requestFullscreen && !document.fullscreenElement) el.requestFullscreen().catch(() => {})
  }
  const exitFull = () => {
    setFull(false)
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {})
  }
  useEffect(() => {
    if (!full) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !document.querySelector('dialog[open]')) exitFull()
    }
    const onChange = () => !document.fullscreenElement && setFull(false)
    document.addEventListener('keydown', onKey)
    document.addEventListener('fullscreenchange', onChange)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('fullscreenchange', onChange)
    }
  }, [full])

  const showView = (id: string) => {
    const v = (board.views ?? []).find((x) => x.id === id)
    if (v) setZoom(viewToZoom(v, ...dims()))
    else reset()
    setActiveView(v ? v.id : '')
    setFill(false)
  }

  /**
   * 新しく貼るものの位置。下へ伸びるボードでは、今見ているあたりに置く（ほかは、いつもの左上から少しずつずらす）
   */
  const placeNew = (b: VisionBoard): Partial<VisionItem> => {
    const [, h, , ch] = dims()
    if (b.aspect !== 'scroll' || !ch) return {}
    // 枠の中に見えているところ（ボードの高さに対する割合）
    const all = ch * zoom.scale
    const top = Math.min(0.95, Math.max(0, -zoom.y / all))
    const seen = Math.min(1 - top, h / all)
    const n = b.items.length % 6
    return { y: top + seen * (0.08 + n * 0.06) }
  }

  const addImages = async (files: File[]) => {
    const list = files.filter((f) => IMAGE_TYPES.includes(f.type))
    if (list.length === 0) return
    if (!uploadImage) return
    setBusy(true)
    setError('')
    try {
      let next = latest.current
      for (const f of list) {
        const url = await uploadImage(f)
        next = addItem(next, { kind: 'image', url: new URL(url, location.href).toString(), ...placeNew(next) }, new Date())
      }
      save(next)
      setEditing(true)
      setSelected(next.items[next.items.length - 1]?.id ?? null)
    } catch (e) {
      setError(`画像を貼れませんでした（${e instanceof Error ? e.message : String(e)}）`)
    } finally {
      setBusy(false)
    }
  }

  // この画面では、どこで貼り付けても画像を受け取る（入力欄の中は除く）
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target?.closest('input, textarea, [contenteditable="true"]')) return
      const files = Array.from(e.clipboardData?.files ?? []).filter((f) => IMAGE_TYPES.includes(f.type))
      if (files.length === 0) return
      e.preventDefault()
      void addImages(files)
    }
    document.addEventListener('paste', onPaste)
    return () => document.removeEventListener('paste', onPaste)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uploadImage])

  // ─── ドラッグ（移動・大きさ） ───
  const startDrag = (e: ReactPointerEvent, item: VisionItem, mode: Drag['mode']) => {
    if (!editing) return
    e.preventDefault()
    e.stopPropagation()
    setSelected(item.id)
    ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
    drag.current = { id: item.id, mode, startX: e.clientX, startY: e.clientY, orig: item }
  }
  const onMove = (e: ReactPointerEvent) => {
    const d = drag.current
    const canvas = canvasRef.current
    if (!d || !canvas) return
    // 拡大しているときも、指の動きどおりに動くように（拡大後の大きさで割る）
    const rect = canvas.getBoundingClientRect()
    const dx = (e.clientX - d.startX) / rect.width
    const dy = (e.clientY - d.startY) / rect.height
    const patch: Partial<VisionItem> =
      d.mode === 'move'
        ? { x: d.orig.x + dx, y: d.orig.y + dy }
        : d.orig.kind === 'image'
          ? { w: d.orig.w + dx }
          : { size: (d.orig.size ?? 0.05) * (1 + dx / Math.max(0.1, d.orig.w)) }
    setDraft(updateItem(draft ?? saved, d.id, patch, new Date()))
  }
  const endDrag = () => {
    if (!drag.current) return
    drag.current = null
    if (draft) save(draft)
  }

  // 下を詰められるか（貼ったものの少し下・いちばん短い高さ まで来ていたら、もう詰められない）
  const canTrim = scroll && boardLength(trimBoard(board, new Date())) < boardLength(board) - 0.01
  /** 下に広げる・詰める量（幅に対する割合）。見える枠の高さの 3/4 くらいずつ */
  const growStep = () => {
    const w = frame.w || 1
    return Math.max(0.25, Math.min(2, ((frame.h || w) * 0.75) / w))
  }

  const sel = board.items.find((i) => i.id === selected) ?? null
  const apply = (next: VisionBoard) => save(next)

  const views = board.views ?? []
  // 編集するときは道具が要るので、たたんでいてもアイコンだけで出す
  const level: BarLevel = editing && barLevel === 'folded' ? 'icons' : barLevel
  const iconOnly = level !== 'full'
  const viewsBar = (
    <div className="vb-vision-views" role="toolbar" aria-label="見え方">
      {full && (
        <button type="button" className="vb-button" onClick={exitFull} title="全画面を終える（Esc）">
          <Minimize2 aria-hidden="true" /> 戻る
        </button>
      )}
      <button type="button" className="vb-vision-view" aria-pressed={!activeView && zoom.scale <= 1} onClick={() => showView('')}>
        全体
      </button>
      {views.map((v) => (
        <span key={v.id} className="vb-vision-view-wrap">
          <button type="button" className="vb-vision-view" aria-pressed={activeView === v.id} onClick={() => showView(v.id)}>
            {v.name}
          </button>
          {editing && (
            <button
              type="button"
              className="vb-vision-view-remove"
              aria-label={`見え方「${v.name}」を消す`}
              title="この見え方を消す"
              onClick={() => {
                apply(removeView(board, v.id, new Date()))
                if (activeView === v.id) setActiveView('')
              }}
            >
              <X aria-hidden="true" />
            </button>
          )}
        </span>
      ))}
      <button
        type="button"
        className="vb-vision-view vb-vision-view-add"
        disabled={zoom.scale <= 1 && !(overflowY && zoom.y < -1)}
        title={zoom.scale <= 1 && !(overflowY && zoom.y < -1) ? '拡大して見たいところを出してから、覚えられます' : '今の拡大と位置を、名前を付けて覚える'}
        aria-label="この見え方を覚える"
        onClick={() => setNaming('')}
      >
        <BookmarkPlus aria-hidden="true" />
        {!iconOnly && ' この見え方を覚える'}
      </button>
      {canFill && (
        <button
          type="button"
          className="vb-vision-view"
          aria-pressed={fill && Math.abs(zoom.scale - cover) < 0.01}
          aria-label="枠いっぱい"
          title="宝地図を、見える枠にすき間なく広げる（はみ出したところは、指・ドラッグで動かして見る）"
          onClick={() => {
            if (fill && Math.abs(zoom.scale - cover) < 0.01) {
              setFill(false)
              reset()
            } else {
              setFill(true)
              setActiveView('')
              fillFrame()
            }
          }}
        >
          <MoveHorizontal aria-hidden="true" />
          {!iconOnly && ' 枠いっぱい'}
        </button>
      )}
    </div>
  )

  const tools = (
    <>
        <button
          type="button"
          className={`vb-button${editing ? ' vb-button-primary' : ''}`}
          aria-pressed={editing}
          aria-label={editing ? '完了' : '編集'}
          title={editing ? '編集を終える' : '動かす・大きさ・傾き・はがす'}
          onClick={() => {
            setEditing((v) => !v)
            setSelected(null)
            // たたんでいるときに ≡ から編集を始めたら、浮いた道具はしまう（編集中は道具の行が出る）
            setBarOpen(false)
          }}
        >
          {editing ? <Check aria-hidden="true" /> : <Pencil aria-hidden="true" />}
          {!iconOnly && (editing ? '完了' : '編集')}
        </button>
        <button type="button" className="vb-button" onClick={enterFull} aria-label="全画面" title="宝地図だけを、画面いっぱいに">
          <Maximize2 aria-hidden="true" />
          {!iconOnly && '全画面'}
        </button>
        {uploadImage && (
          <button type="button" className="vb-button" disabled={busy} onClick={() => fileInput.current?.click()} aria-label="画像を貼る" title="画像を貼る">
            <ImagePlus aria-hidden="true" />
            {!iconOnly && (busy ? '貼っています…' : '画像を貼る')}
          </button>
        )}
        <button type="button" className="vb-button" onClick={() => setWriting({ id: null, text: '' })} aria-label="言葉を貼る" title="言葉を貼る">
          <Type aria-hidden="true" />
          {!iconOnly && '言葉を貼る'}
        </button>
        <input
          ref={fileInput}
          type="file"
          accept={IMAGE_TYPES.join(',')}
          multiple
          hidden
          onChange={(e) => {
            void addImages(Array.from(e.target.files ?? []))
            e.target.value = ''
          }}
        />
        {editing && (
          <>
            <select
              className="vb-select"
              aria-label="ボードの形"
              value={board.aspect}
              onChange={(e) => {
                apply(setAspect(board, e.target.value as VisionBoard['aspect'], new Date()))
                reset()
              }}
            >
              <option value="landscape">横長</option>
              <option value="portrait">縦長</option>
              <option value="square">正方形</option>
              <option value="scroll">下へ伸びる</option>
            </select>
            <select
              className="vb-select"
              aria-label="ボードの背景"
              value={board.background ?? 'paper'}
              onChange={(e) => apply({ ...board, background: e.target.value as VisionBoard['background'], updatedAt: new Date().toISOString() })}
            >
              <option value="paper">背景: 紙</option>
              <option value="cork">背景: コルク</option>
              <option value="night">背景: 夜空</option>
            </select>
          </>
        )}
        {error && (
          <span role="alert" className="vb-diary-error">
            {error}
          </span>
        )}
    </>
  )
  // 道具の行の見せ方を、次の段階へ（文字つき → アイコンだけ → たたむ → 文字つき）
  const levelButton = (
    <button
      type="button"
      className="vb-icon-button vb-vision-level"
      aria-label={NEXT_LEVEL[barLevel].label}
      title={NEXT_LEVEL[barLevel].label}
      onClick={() => setBarLevel(NEXT_LEVEL[barLevel].to)}
    >
      {barLevel === 'full' ? <ChevronsLeft aria-hidden="true" /> : barLevel === 'icons' ? <ChevronsUp aria-hidden="true" /> : <ChevronsDown aria-hidden="true" />}
    </button>
  )

  return (
    <div className={['vision-board', className ?? ''].filter(Boolean).join(' ')} data-theme={theme}>
    <div ref={rootRef} className={`vb-vision${full ? ' vb-vision-full' : ''}`}>
      {!full && level !== 'folded' && (
        <div className={`vb-vision-bar${iconOnly ? ' vb-vision-bar-icons' : ''}${editing ? ' vb-vision-bar-editing' : ''}`} role="toolbar" aria-label="宝地図の道具">
          {tools}
          {/* 広い画面では、道具と同じ行に（ボードを大きくするため） */}
          {viewsBar}
          {levelButton}
        </div>
      )}
      {full && viewsBar}

      {/* 選んだものの道具（編集のとき） */}
      {editing && sel && (
        <div className="vb-vision-bar vb-vision-selbar" role="toolbar" aria-label="選んだものの道具">
          <button type="button" className="vb-icon-button" aria-label="左に傾ける" title="左に傾ける" onClick={() => apply(updateItem(board, sel.id, { rotate: sel.rotate - 5 }, new Date()))}>
            <RotateCcw aria-hidden="true" />
          </button>
          <button type="button" className="vb-icon-button" aria-label="右に傾ける" title="右に傾ける" onClick={() => apply(updateItem(board, sel.id, { rotate: sel.rotate + 5 }, new Date()))}>
            <RotateCw aria-hidden="true" />
          </button>
          <button type="button" className="vb-icon-button" aria-label="いちばん手前へ" title="いちばん手前へ" onClick={() => apply(moveLayer(board, sel.id, 'front', new Date()))}>
            <BringToFront aria-hidden="true" />
          </button>
          <button type="button" className="vb-icon-button" aria-label="いちばん奥へ" title="いちばん奥へ" onClick={() => apply(moveLayer(board, sel.id, 'back', new Date()))}>
            <SendToBack aria-hidden="true" />
          </button>
          {sel.kind === 'text' && (
            <>
              <button type="button" className="vb-button" onClick={() => setWriting({ id: sel.id, text: sel.text ?? '' })}>
                言葉を直す
              </button>
              <select
                className="vb-select"
                aria-label="言葉の色"
                value={sel.color ?? 'ink'}
                onChange={(e) => apply(updateItem(board, sel.id, { color: e.target.value }, new Date()))}
              >
                {Object.entries(TEXT_COLORS).map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </>
          )}
          <button
            type="button"
            className="vb-icon-button vb-vision-delete"
            aria-label="はがす"
            title="はがす"
            onClick={() => {
              apply(removeItem(board, sel.id, new Date()))
              setSelected(null)
            }}
          >
            <Trash2 aria-hidden="true" />
          </button>
        </div>
      )}

      <div ref={stageRef} className="vb-vision-stage">
      {/* たたんでいるとき: 宝地図の左上の ≡ から、道具を出す */}
      {!full && level === 'folded' && (
        <>
          <button
            type="button"
            className="vb-vision-fab"
            aria-label={barOpen ? '道具をしまう' : '道具を出す'}
            title={barOpen ? '道具をしまう' : '道具を出す'}
            aria-expanded={barOpen}
            onClick={() => setBarOpen((v) => !v)}
          >
            {barOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
          </button>
          {barOpen && (
            <div className="vb-vision-bar vb-vision-bar-icons vb-vision-float" role="toolbar" aria-label="宝地図の道具">
              {tools}
              {viewsBar}
              {levelButton}
            </div>
          )}
        </>
      )}
      <div
        ref={boxRef}
        className={`vb-vision-board${editing ? ' vb-vision-editing' : ''}${zoom.scale > 1 || overflowY ? ' vb-vision-zoomed' : ''}`}
        style={{
          // 見える枠は、使える場所いっぱい（見出しと道具の分をのぞいた高さ）。ボードはこの中に収めて真ん中に置く
          height: `max(240px, calc(100dvh - ${reserve}px))`,
        }}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onPointerCancel={endDrag}
        onPointerDown={() => {
          if (editing) setSelected(null)
          setBarOpen(false)
        }}
        onDragOver={(e) => {
          if (Array.from(e.dataTransfer?.types ?? []).includes('Files')) e.preventDefault()
        }}
        onDrop={(e) => {
          const files = Array.from(e.dataTransfer?.files ?? [])
          if (files.length === 0) return
          e.preventDefault()
          void addImages(files)
        }}
      >
        <div
          ref={canvasRef}
          className={`vb-vision-canvas vb-vision-${board.background ?? 'paper'}`}
          style={{ width: content.w, height: content.h, transform: `translate(${zoom.x}px, ${zoom.y}px) scale(${zoom.scale})` }}
        >
        {board.items.length === 0 && (
          <p className="vb-vision-empty">
            「画像を貼る」か、画像を貼り付け・ここに落として、宝地図を作りましょう。
            <br />
            「言葉を貼る」で、戒めや目標の言葉も貼れます。
          </p>
        )}
        {byLayer(board.items).map((item) => (
          <div
            key={item.id}
            className={`vb-vision-item vb-vision-${item.kind}${selected === item.id ? ' vb-vision-selected' : ''}`}
            style={{
              left: `${item.x * 100}%`,
              top: `${item.y * 100}%`,
              ...(item.kind === 'image' ? { width: `${item.w * 100}%` } : { fontSize: `${(item.size ?? 0.05) * width}px` }),
              transform: item.rotate ? `rotate(${item.rotate}deg)` : undefined,
              zIndex: 1,
            }}
            onPointerDown={(e) => (editing ? startDrag(e, item, 'move') : undefined)}
            onClick={() => {
              if (editing || moved() || item.kind !== 'image') return
              // 2 回たたいたとき（寄る）と区別するため、少し待ってから大きく見る
              cancelOpen()
              openTimer.current = setTimeout(() => {
                openTimer.current = null
                setViewing(item)
              }, 300)
            }}
            role={editing ? 'button' : item.kind === 'image' ? 'button' : undefined}
            tabIndex={item.kind === 'image' || editing ? 0 : undefined}
            aria-label={item.kind === 'image' ? (editing ? '画像（ドラッグで動かす）' : '画像を大きく見る') : (item.text ?? '')}
            onKeyDown={(e) => {
              if (!editing && item.kind === 'image' && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault()
                setViewing(item)
              }
              if (editing && selected === item.id) {
                const step = e.shiftKey ? 0.05 : 0.01
                const moves: Record<string, Partial<VisionItem>> = {
                  ArrowLeft: { x: item.x - step },
                  ArrowRight: { x: item.x + step },
                  ArrowUp: { y: item.y - step },
                  ArrowDown: { y: item.y + step },
                }
                if (moves[e.key]) {
                  e.preventDefault()
                  apply(updateItem(board, item.id, moves[e.key], new Date()))
                }
              }
            }}
            onFocus={() => editing && setSelected(item.id)}
          >
            {item.kind === 'image' && item.url ? (
              <BoardImage url={item.url} loadImage={loadImage} className="vb-vision-img" />
            ) : (
              <span className={`vb-vision-words vb-words-${item.color ?? 'ink'}`}>{item.text}</span>
            )}
            {editing && selected === item.id && (
              <span
                className="vb-vision-handle"
                role="presentation"
                title="ドラッグで大きさを変える"
                onPointerDown={(e) => startDrag(e, item, 'resize')}
              />
            )}
          </div>
        ))}
        </div>
        {/* 下へ伸びるボード: 今どのあたりを見ているか（右のふち） */}
        {overflowY && (
          <div className="vb-vision-scrollbar" aria-hidden="true">
            <div
              style={{
                top: `${(Math.max(0, -zoom.y) / (content.h * zoom.scale)) * 100}%`,
                height: `${Math.min(1, frame.h / (content.h * zoom.scale)) * 100}%`,
              }}
            />
          </div>
        )}
        {/* 拡大・縮小（指で広げる・2 回たたく・PC はトラックパッドのピンチや Ctrl＋ホイールでも） */}
        <div className="vb-vision-zoom" onPointerDown={(e) => e.stopPropagation()}>
          <button type="button" className="vb-icon-button" aria-label="拡大" title="拡大" onClick={() => zoomBy(1.5)}>
            <Plus aria-hidden="true" />
          </button>
          <button type="button" className="vb-icon-button" aria-label="縮小" title="縮小" disabled={zoom.scale <= 1} onClick={() => zoomBy(1 / 1.5)}>
            <Minus aria-hidden="true" />
          </button>
          {zoom.scale > 1 && (
            <button type="button" className="vb-icon-button" aria-label="元の大きさに戻す" title="元の大きさに戻す" onClick={reset}>
              <Shrink aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
      </div>
      {editing && scroll && (
        <div className="vb-row vb-vision-length">
          <button type="button" className="vb-button" onClick={() => apply(growBoard(board, growStep(), new Date()))} title="宝地図の下に、空きを足す">
            <ArrowDownToLine aria-hidden="true" /> 下に広げる
          </button>
          <button
            type="button"
            className="vb-button"
            disabled={!canTrim}
            onClick={() => apply(shrinkBoard(board, growStep(), new Date()))}
            title="宝地図の下の空きを詰める（貼ったものは切らない）"
          >
            <ArrowUpToLine aria-hidden="true" /> 下を詰める
          </button>
          <button
            type="button"
            className="vb-button"
            disabled={!canTrim}
            onClick={() => apply(trimBoard(board, new Date()))}
            title="宝地図の下の空きを、一度になくす（いちばん下に貼ったものの、少し下まで。貼ったものは切らない）"
          >
            <FoldVertical aria-hidden="true" /> 下の空きをなくす
          </button>
        </div>
      )}
      {editing && <p className="vb-note vb-vision-hint">ドラッグで動かす・右下の丸で大きさ・上の道具で傾き・重なり・はがす。指で広げると拡大できます。終わったら「完了」。</p>}

      <Dialog open={viewing !== null} onClose={() => setViewing(null)} title="宝地図" wide>
        {viewing?.url && <BoardImage url={viewing.url} loadImage={loadImage} className="vb-viewer-img" />}
      </Dialog>

      <Dialog open={naming !== null} onClose={() => setNaming(null)} title="この見え方を覚える">
        {naming !== null && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const [w, h, cw, ch] = dims()
              if (!w) return setNaming(null)
              const next = addView(board, naming, zoom, w, h, cw, ch, new Date())
              apply(next)
              setActiveView(next.views![next.views!.length - 1].id)
              setNaming(null)
            }}
          >
            <p className="vb-note">今の拡大と位置を覚えます。上の帯の名前を押すと、いつでもこの見え方になります（次に開いたときも、最後に選んだ見え方から始まります）。</p>
            <input
              className="vb-input"
              autoFocus
              aria-label="見え方の名前"
              placeholder="例: TOEIC・神様"
              value={naming}
              onChange={(e) => setNaming(e.target.value)}
            />
            <div className="vb-row vb-row-end" style={{ marginTop: 8 }}>
              <button type="button" className="vb-button" onClick={() => setNaming(null)}>
                やめる
              </button>
              <button type="submit" className="vb-button vb-button-primary">
                覚える
              </button>
            </div>
          </form>
        )}
      </Dialog>

      <Dialog open={writing !== null} onClose={() => setWriting(null)} title={writing?.id ? '言葉を直す' : '言葉を貼る'}>
        {writing && (
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const text = writing.text.trim()
              if (!text) return setWriting(null)
              const next = writing.id ? updateItem(board, writing.id, { text }, new Date()) : addItem(board, { kind: 'text', text, ...placeNew(board) }, new Date())
              apply(next)
              setWriting(null)
              setEditing(true)
              setSelected(writing.id ?? next.items[next.items.length - 1].id)
            }}
          >
            <textarea
              className="vb-diary-text"
              autoFocus
              rows={3}
              aria-label="貼る言葉"
              placeholder="例: 天は自ら助くる者を助く"
              value={writing.text}
              onChange={(e) => setWriting({ ...writing, text: e.target.value })}
            />
            <div className="vb-row vb-row-end" style={{ marginTop: 8 }}>
              <button type="button" className="vb-button" onClick={() => setWriting(null)}>
                やめる
              </button>
              <button type="submit" className="vb-button vb-button-primary">
                {writing.id ? '直す' : '貼る'}
              </button>
            </div>
          </form>
        )}
      </Dialog>
    </div>
    </div>
  )
}
