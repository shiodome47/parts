/// <reference types="vitest/config" />
import { defineConfig } from 'vite'

// 部品（ライブラリ）としてビルドする設定。入り口ごとに 1 つのファイルにする（dist/core.js …）
export default defineConfig({
  build: {
    lib: {
      entry: { core: 'src/core/index.ts' },
      formats: ['es'],
      fileName: (_format, name) => `${name}.js`,
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.{ts,tsx}'],
  },
})
