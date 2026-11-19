import { useEffect, useState } from 'react'

/**
 * 画像を読む方法（合言葉の要る置き場など）。
 * Blob を返すと、部品が表示用の URL（blob:）を作る。文字列を返すと、その URL をそのまま使う
 */
export type LoadImage = (url: string) => Promise<Blob | string>

/** 同じ画像を何度も読まないように、開いている間は覚えておく（読み方ごとに） */
const caches = new WeakMap<LoadImage, Map<string, Promise<string>>>()

function loadUrl(url: string, loadImage: LoadImage): Promise<string> {
  let cache = caches.get(loadImage)
  if (!cache) {
    cache = new Map()
    caches.set(loadImage, cache)
  }
  let p = cache.get(url)
  if (!p) {
    const c = cache
    p = loadImage(url).then((r) => (typeof r === 'string' ? r : URL.createObjectURL(r)))
    p.catch(() => c.delete(url))
    cache.set(url, p)
  }
  return p
}

/** 画像を 1 つ見せる（読めないときは「!」） */
export function BoardImage({ url, loadImage, className, alt = '' }: { url: string; loadImage?: LoadImage; className?: string; alt?: string }) {
  const [src, setSrc] = useState(loadImage ? '' : url)
  const [error, setError] = useState('')
  useEffect(() => {
    if (!loadImage) {
      setSrc(url)
      setError('')
      return
    }
    let alive = true
    setSrc('')
    setError('')
    loadUrl(url, loadImage)
      .then((u) => alive && setSrc(u))
      .catch((e) => alive && setError(e instanceof Error ? e.message : '読めませんでした'))
    return () => {
      alive = false
    }
  }, [url, loadImage])
  if (error)
    return (
      <span className={`vb-image-missing ${className ?? ''}`} role="img" aria-label={error} title={error}>
        !
      </span>
    )
  if (!src) return <span className={`vb-image-loading ${className ?? ''}`} aria-hidden="true" />
  return <img src={src} alt={alt} className={className} draggable={false} />
}
