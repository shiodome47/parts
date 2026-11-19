/** この端末だけに覚えておく小さな値（使えない環境・private モードでも止まらない） */
export const safeLocalStore = {
  get(key: string): string | null {
    try {
      return localStorage.getItem(key)
    } catch {
      return null
    }
  },
  set(key: string, value: string): void {
    try {
      localStorage.setItem(key, value)
    } catch {
      // 覚えられなくても、画面はそのまま使える
    }
  },
  remove(key: string): void {
    try {
      localStorage.removeItem(key)
    } catch {
      // 同上
    }
  },
}
