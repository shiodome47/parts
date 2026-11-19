/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部品（ライブラリ）としてビルドする設定。見た目は dist/style.css に出す（使う側は @shiodome47/vision-board/style.css を読み込む）。
// react・lucide-react は、使う側の npm install で入るので、出力には含めない
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: 'src/index.ts',
      formats: ['es'],
      fileName: 'vision-board',
      cssFileName: 'style',
    },
    rollupOptions: {
      external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/, /^lucide-react(\/.*)?$/],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
