/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 部品（ライブラリ）としてビルドする設定。入り口ごとに 1 つのファイルにする（dist/core.js・timeline.js・projects.js）。
// 見た目は dist/style.css に出す（使う側は @shiodome47/planner/style.css を読み込む）。
// react・linkshelf などは、使う側の npm install で入るので、出力には含めない
export default defineConfig({
  plugins: [react()],
  build: {
    lib: {
      entry: { core: 'src/core/index.ts', timeline: 'src/timeline/index.ts', projects: 'src/projects/index.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
      cssFileName: 'style',
    },
    rollupOptions: {
      output: { chunkFileNames: 'chunks/[name]-[hash].js' },
      external: [/^react(\/.*)?$/, /^react-dom(\/.*)?$/, /^@dnd-kit\/.*/, /^lucide-react(\/.*)?$/, /^linkshelf(\/.*)?$/],
    },
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
