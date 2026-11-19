# parts

shiodome47 のアプリで使い回す、共通部品の置き場です。部品はそれぞれ npm の **`@shiodome47/…`** として公開します。アプリは、使う部品だけを `npm install` します。

| 部品 | 中身 |
|---|---|
| [`@shiodome47/planner`](packages/planner) | 時間軸とプロジェクト。土台（`/core`：データの形と決まりごと）と、画面（`/timeline`・`/projects`） |

カードを並べる棚と `<CardBoard>` は、別のパッケージ [linkshelf](https://github.com/shiodome47/linkshelf) にあります。

## 直す・確かめる

npm は 11 を使います（`npm -v` で確かめる。10 なら `npm install -g npm@11`）。版がちがうと `package-lock.json` が書き換わったり、入れられない道具があったりするためです（10 のままだと注意が出ます）。

```bash
npm ci
npm run typecheck
npm test
npm run build
```

部品は `packages/` の下に 1 つずつ置きます。上のコマンドは、すべての部品にまとめて効きます。

## 公開する

部品ごとに、その部品の `package.json` の `version` を上げてから、ここ（いちばん上）で公開します。公開の前に、型のチェック・テスト・ビルドが自動で走ります。

```bash
npm publish -w @shiodome47/planner
```

## License

MIT
