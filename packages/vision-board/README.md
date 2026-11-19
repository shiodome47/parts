# @shiodome47/vision-board

宝地図（ビジョンボード）の部品です。画像と言葉を自由に貼り、指で広げて拡大し、見たいところを「見え方」として覚えて切り替えられます。[まほうのランプ](https://lamp.shiodome47.com) の宝地図を、ほかのアプリでも使えるように取り出しました。

- **貼る**: 画像（ボタン・貼り付け・ファイルを落とす）と言葉。動かす・大きさ・傾き・重なり・はがす（「編集」のとき）
- **見る**: ピンチ・トラックパッド・Ctrl＋ホイールで拡大、拡大中は指・ドラッグで動かす。2 回たたくと、その画像に寄る
- **見え方を覚える**: 今の拡大と位置に名前を付けて覚え、押すとその見え方に。最後に選んだ見え方から始まる
- **全画面**・**枠いっぱい**（宝地図を画面にすき間なく広げる）
- **道具の行**は 3 段階（文字つき・アイコンだけ・たたむ）
- **下へ伸びるボード**: ボードの形を「下へ伸びる」にすると、幅は枠いっぱいのまま、下へいくらでも広げられる（「編集」の「下に広げる」「下を詰める」「下の空きをなくす」）。ホイール・トラックパッドの 2 本指・指・ドラッグで、上下に動かして見る。貼るものは、今見ているあたりに出る
- 位置は割合で持つので、PC で並べたものが、スマホでもそのまま縮んで同じ見た目

```bash
npm install @shiodome47/vision-board
```

React 18・19 で使えます。

## 使い方

```tsx
import { VisionBoard, emptyBoard, type VisionBoardData } from '@shiodome47/vision-board'
import '@shiodome47/vision-board/style.css'

function MyBoard() {
  const [board, setBoard] = useState<VisionBoardData>(() => load() ?? emptyBoard())
  return (
    <VisionBoard
      board={board}
      onChange={(next) => {
        setBoard(next)
        save(next) // 保存先は自由（IndexedDB・サーバー・同期）
      }}
      uploadImage={async (file) => (await upload(file)).url} // 画像の置き場（無ければ「画像を貼る」は出ない）
    />
  )
}
```

ボード（貼ったもの・形・背景・覚えた見え方）は 1 つのまとまり（`VisionBoardData`）です。変わるたびに `onChange` に新しいボードが届くので、それを保存します。

### 設定（props）

| 設定 | 中身 |
|---|---|
| `board` / `onChange` | ボードと、変わったとき（必須）。まだ無ければ `emptyBoard()` |
| `uploadImage` | 画像を受け取って置き、その URL を返す。置けないとき（合言葉が無いなど）は、わけを書いた `Error` を投げる（そのまま画面に出る）。渡さなければ「画像を貼る」は出ない |
| `loadImage` | 画像を読む方法を差し替える（合言葉の要る置き場など）。`Blob` を返すと部品が表示用の URL を作る。文字列ならその URL を使う。渡さなければ URL をそのまま表示 |
| `storagePrefix` | この端末に覚えておく名前の頭（最後に選んだ見え方・枠いっぱい・道具の見せ方）。既定は `visionBoard:`。1 つのサイトに 2 つ置くときは別の名前に |
| `theme` | `light` / `dark` / `system`（既定。端末の設定に合わせる） |
| `className` | 外枠に足すクラス |

### 色を合わせる

見た目は `.vision-board` の中だけに効き、色は変数で決まります。

```css
.vision-board {
  --vb-accent: #2563eb;   /* 選んでいるもの・枠 */
  --vb-panel: #fff;       /* 道具・小窓 */
  --vb-panel-2: #f3f4f6;
  --vb-border: #e5e7eb;
  --vb-text: #111827;
  --vb-muted: #6b7280;
  --vb-page-bg: #f9fafb;  /* 全画面の背景・宝地図のまわり */
}
```

ほかに `--vb-accent-text`・`--vb-danger`・`--vb-warning`・`--vb-ok` があります。宝地図の背景（紙・コルク・夜空）は、ボードごとに「編集」で選びます。

### 計算だけ使う

画面の外でボードを作る・直すときの関数です。どれもボードを直接は書き換えず、新しいボードを返します。

| 関数 | すること |
|---|---|
| `emptyBoard(now?, id?)` / `getBoard(data, now?, id?)` | 空のボード／アプリのデータ（`boards` を持つもの）からボードを取り出す |
| `addItem` `updateItem` `removeItem` `moveLayer` `byLayer` | 貼る・直す・はがす・重なりを変える・重なりの順に並べる |
| `addView` `removeView` `viewToZoom` | 見え方を覚える・消す・今の画面での倍率と位置にする |
| `setAspect` `setLength` `growBoard` `shrinkBoard` `trimBoard` `boardLength` `boardRatio` `contentBottom` | ボードの形を変える（下へ伸びるにしても並びはそのまま）・下へ伸びるボードの高さを変える・広げる・詰める・空きを一度になくす（貼ったものは切らない）・今の高さ・幅÷高さ・貼ったもののいちばん下 |
| `clampZoom` `zoomAt` `fitRect` `coverScale` | 拡大の計算（枠からはみ出さない・指の位置で拡大・ある四角に寄る・枠いっぱいの倍率） |

## English

A vision board (moodboard) React component: pin images and words, pinch/trackpad/Ctrl+wheel zoom, double-tap to focus an item, save named views, full screen, "fill the frame", a three-level toolbar, and a "grows downward" board shape you scroll through (wheel, two-finger trackpad, touch or drag). Pass `board` and `onChange` (you store the board anywhere), `uploadImage(file) => url` to enable image pinning, and optionally `loadImage(url) => Blob | url` for protected images. Import `@shiodome47/vision-board/style.css`; styles apply only inside `.vision-board` and colors come from `--vb-*` variables. UI labels are Japanese.

## License

MIT
