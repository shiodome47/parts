# @shiodome47/planner

時間軸（今日・今週・数か月・今年・一生）とプロジェクトの部品です。[まほうのランプ](https://lamp.shiodome47.com) の仕組みを、ほかのアプリでも使えるように取り出しました。

| 入り口 | 中身 | 状態 |
|---|---|---|
| `@shiodome47/planner/core` | **土台**。データの形と決まりごと（画面なし。計算だけ） | ✅ 使えます |
| `@shiodome47/planner/timeline` | **時間軸の画面** `<Timeline>`（React） | ✅ 使えます |
| `@shiodome47/planner/projects` | **プロジェクトの画面** `<Projects>`（React。並べ替えは [linkshelf](https://www.npmjs.com/package/linkshelf) の `<CardBoard>`） | ✅ 使えます |
| `@shiodome47/planner/style.css` | 画面の見た目（`.planner` の中だけに効く） | ✅ |

時間軸とプロジェクトは、同じ「やること」の一覧を見ています。期日を入れたやることは、プロジェクトのカードにも、時間軸の列にも出ます。つなぐのは画面ではなく、この土台（`core`）です。

```bash
npm install @shiodome47/planner
```

## 画面（timeline・projects）

データ（`PlannerData`）と「今」を渡し、変更を `onChange` で受け取って保存するだけで、時間軸とプロジェクトの画面になります。2 つの画面は同じデータを見るので、プロジェクトに期日つきの目標を足すと、時間軸の列にも出ます。

```tsx
import { Timeline } from '@shiodome47/planner/timeline'
import { Projects } from '@shiodome47/planner/projects'
import { applyChanges, type Changes, type PlannerData } from '@shiodome47/planner/core'
import '@shiodome47/planner/style.css'

function App() {
  const [data, setData] = useState<PlannerData>(load())
  const onChange = useCallback((c: Changes) => {
    setData((d) => applyChanges(d, c))
    save(c) // 保存先は自由（IndexedDB・サーバー・同期）
  }, [])
  const now = useNow() // 1 分ごとなどに新しくする

  return tab === 'timeline' ? <Timeline data={data} now={now} onChange={onChange} /> : <Projects data={data} now={now} onChange={onChange} />
}
```

| 設定 | 中身 |
|---|---|
| `data` / `now` / `onChange` | データ・今・変更を受け取る関数（必須） |
| `simple` | すっきり表示（慣れたら要らない説明の文字を消す） |
| `theme` | `light` / `dark` / `system`（既定。端末の設定に合わせる） |
| `className` | 外枠に足すクラス |

- 画面の中で使う React の部品・ドラッグ（@dnd-kit）・アイコン（lucide-react）・linkshelf は、`npm install` で一緒に入ります。React（18・19）は使う側のもの
- 列を広げた状態や、書きかけの文字は、見る人のブラウザに覚えます（名前は `planner:…`）
- 時間軸のやることは、ドラッグで並べ替えられます。別の優先度のまとまりへ落とすと、その優先度になります。項目が 1 つも無い優先度（C しか無いときの D・P など）は、**ドラッグしている間だけ、その場所に細い帯**（「D 低へ」）が出て、そこへ落とすと移せます。帯は行の上に重ねて出すので、行は動きません
- プロジェクトのルーチン目標も、行をつかんでドラッグで並べ替えられます（同じくり返しのものどうし。並びは時間軸の習慣と共有）
- キーボード: 行を持ち上げる（スペース・Enter → 矢印 → スペース）のは、行そのものにフォーカスがあるときだけ。行の中のボタン・名前を書き換える欄でのスペース・Enter は、そのボタン・欄に効きます。… のメニューは、開くと最初の選択肢にフォーカスし、矢印・Home・End で移り、Esc・Tab で閉じて … に戻ります
- プロジェクトの終えた期日目標は、一番下の **「終えた目標（n）」** にたたみます（はじめは閉じている。新しく終えた順。開けば見られ、チェックを外せば上へ戻る）。細かいステップを足していっても、カードが終えたもので埋まりません
- **やめる（やらないことにする）**: やること・期日目標の … →「やめる（やらないことにする）」。✓ ではなく灰色の ✕ と取り消し線になり、終えたものと同じく、その期間が過ぎたら列から消える（プロジェクトでは「終えた・やめた目標」にたたむ）。✕ を押すと取り消せる。下ろした先でやめると、元もやめたことになる（終えるときと同じ）。習慣から下ろしたものをやめても、習慣のチェックは付かず、習慣の行は薄くならない（もう一度下ろせる）。振り返りでは「やったこと」に入れず、目標の中身の進み具合（2/5）にも数えない
- 時間軸は、スマホの幅では列を横にすべらせ、上の帯から列を選べます。プロジェクトは、画面の幅に合わせて段組みになり、カードをドラッグで並べ替えられます（キーボードでも）

### 今日の見え方（プロジェクトの習慣をまとめる・「今日」を目立たせる）

- **時間軸**: 同じ列に、同じプロジェクトの習慣が 2 つ以上あると、1 行にまとめてたたむ（「▸ ● ヨガ　あと 7」「▸ ● ヨガ・筋トレ　あと 4」）。数はチェックの残りで、全部済むと「✓ 済み」。押すとその場で開き、チェックもできる（開いた・閉じたは端末ごとに覚える。名前は `planner:openHabitGroups`）。1 つだけのプロジェクトの習慣や、毎月の「その日」で出ているものは、今までどおり 1 行ずつ。まとまりは、プロジェクトの画面の並び順（テーマの中のものはテーマのすぐ後ろ）
- **時間軸で、習慣をプロジェクトへ移す**: 習慣の行を、まとまりの見出し（▸ ● 習慣）へドラッグして落とすと、そのプロジェクトの習慣になる（閉じていても入れられ、落とすと開く。重ねている間、見出しが光る）。開いたまとまりの中の行へ落とすと、その位置に入る。まとまりの中から外の行へ落とすと、プロジェクトから外れる。まとまりの外どうし・同じまとまりの中どうしは、今までどおり並べ替えだけ。今日などに下ろしたまだのやることのプロジェクトも、そろう
- **プロジェクト**: 画面の上の「**今日**」を押すと、時間軸の今日の列に出ているもの（ルーチン目標・期日目標。今日に下ろしたものは元に数える）に色の帯が付き、ほかは薄くなる。カードの見出しに「今日 あと 4」（テーマは中のプロジェクトの分も足す）、ボタンに全部の残り。今日のものが無いカードは薄く。カードの並びは変えない。オン・オフは端末ごとに覚える（`planner:projectsToday`）

### 回数の目標（30/100 回 ＋1）

「リーディング 10 回・20 回・30 回…」のように回数で刻むステップは、1 つの「回数の目標」にまとめられます。

| 操作 | どうなるか |
|---|---|
| やること・期日目標の … →「回数の目標にする…」 | めざす回数と今の回数を決める。行の名前の下に「20/100 回 ＋1」（うしろの色の帯が進み具合） |
| ＋1 | 1 回足す。足した日の記録が残る（振り返りで、その日に足した回数を出せる。`countsOn`） |
| … →「1 回へらす」「回数を変える…」 | 押しまちがいを直す・めざす数を変える。「回数を変える…」の小窓から、回数の目標をやめることもできる |
| めざす回数に届く | 終えたことになる（下ろした先・元も一緒に）。チェックを外せば、回数はそのままで、また足せる |

時間軸で下ろした先（今日の列など）では、元の回数を出し、足すのも元に足します。

### 目標を細かく分ける（中身のプロジェクト）

大きな目標（「ALL IN ONE 完了」）の細かいステップは、別のプロジェクト（「ALL IN ONE 完遂」）に並べ、目標とつなげます。メインの目標は 1 行のまま、細かいステップは中身のほうに分かれます。

| 操作 | どうなるか |
|---|---|
| 期日目標の … →「細かく分ける…」→ **作る** | その目標の中身になるプロジェクトを作る（名前ははじめ目標と同じ）。置き場所は、入れ子が 1 段のままになるように、目標のプロジェクトと同じテーマの中（目標のプロジェクトのすぐ後ろ）。目標のプロジェクトがいちばん上のカードなら、その中 |
| 期日目標の … →「細かく分ける…」→ **つなぐ** | もう作ってあるプロジェクトを中身にする（同じテーマの中のものが先に並ぶ） |
| 目標の行の「中身 2/5 ›」 | 中身の期日目標のうち、終えた数／全部。押すと中身のプロジェクトへ移る（枠が少し光る）。全部できると緑 |
| 中身のプロジェクトの「↰「TOEICお受験」の目標「ALL IN ONE 完了」の中身」 | 押すと、目標のプロジェクトへ戻る |
| … →「中身とのつなぎを外す」（目標）／「目標の中身をやめる」（プロジェクト） | つなぎだけ外す。プロジェクトも目標も残る |

中身を全部終えても、目標は自動では終えません（自分でチェックする）。目標や、目標のプロジェクトを消したときは、中身のプロジェクトはつなぎだけ外れて残ります（ただし、中身のプロジェクトが、消すテーマ・プロジェクトの中にあるときは一緒に消えます。消す前の確かめに名前が出ます）。

### 習慣を終える（卒業・お休み）・完全に消す

習慣（ルーチン目標）の … から選びます。

| 操作 | どうなるか |
|---|---|
| **卒業・お休みにする…** | 「卒業（身についた）」か「お休み（続かなかった・今はやめる）」を選び、ひとこと（理由など。なくてもよい）を添える。チェックの一覧からは外れ、習慣の一番下の **「これまでの習慣（n）」**（はじめは閉じている）に残る。チェックの記録は消えない。下ろした先の、まだ終えていないやることは消える |
| これまでの習慣の … →「また始める」 | チェックの一覧の一番下へ戻す。終えた日と別の日なら、休んでいた間を覚えておき、振り返りの数に入れない |
| これまでの習慣の … →「卒業・お休みを変える…」 | 終え方とひとことを直す（終えた日はそのまま） |
| **完全に消す** | 記録ごと消す（元に戻せない）。チェックの記録があるときは、確かめてから消す |

「これまでの習慣」の 1 行には、卒業（🎓）かお休み（🌙）の印・名前・期間（9/1〜11/22）・できた割合（毎日なら「できた日 82%」。毎週なら週で数える）・ひとことが出ます。時間軸では各列の習慣の一番下、プロジェクトではルーチン目標の一番下（「これまでのルーチン目標」）です。

### 習慣の 3 段階（低・中・上）

「瞑想 30 分」のように高い目標だと、できない日は 0 になってやめてしまいがちです。気になる習慣にだけ、低・中・上の 3 段階を付けられます（例: 瞑想 低 3 分・中 10 分・上 30 分）。低でもやれば「できた」に数え、頑張った日は色で分かります。

| 操作 | どうなるか |
|---|---|
| 習慣・ルーチン目標の … →「3 段階にする…」 | 低・中・上の中身を書く（どれも空でもよい）。まだの日は、名前の下に「低 3分・中 10分・上 30分」 |
| チェック | 「低」で付く（時間軸・プロジェクト・下ろした先のどこで付けても）。名前の下に「低 中 上」が出る |
| 「中」「上」を押す | その日（毎週・毎月はその期間）の段階を上げる。チェックの色が変わる（低は薄い緑・中はいつもの緑・上は濃紫） |
| … →「3 段階を変える…」→「3 段階をやめる」 | 3 段階をやめる。それまでの段階の記録は残る |

段階を付けていない習慣は、見た目も操作も今までどおりです。チェックを外すと、その日の段階も消えます。振り返り（`habitDoneOn`・`streak`・`habitRecord`）は、今までどおり低以上を「できた」と数えます。段階は `habitLevelOn(habit, day)` で読めます（アプリの振り返りで色を分けるのに使う）。

### 色を合わせる

見た目は `.planner` の中だけに効き、色は変数で決まります。使う側の CSS で上書きすると、アプリの色に合わせられます。

```css
.planner {
  --pl-accent: #2563eb;   /* 決定のボタン・今日の列・ドラッグの線 */
  --pl-panel: #fff;       /* 列・カード・チェックの丸と四角の中 */
  --pl-panel-2: #f3f4f6;  /* 入力欄・行にマウスを乗せたとき */
  --pl-border: #e5e7eb;
  --pl-text: #111827;
  --pl-muted: #6b7280;
  --pl-sticky-top: 56px;  /* 上に固定の見出しがあるページでは、その高さ */
}
```

ほかに `--pl-page-bg`・`--pl-accent-text`・`--pl-danger`・`--pl-warning`・`--pl-ok` があります。プロジェクトの色は `PROJECT_COLORS`（`teal`・`blue` など 8 色）。

習慣の 3 段階の色は `--pl-tier-top`（上。濃紫 `#4a2a6e`、暗い画面では `#a07cd0`）・`--pl-tier-top-text`（濃紫の上の ✓ と文字の色）・`--pl-tier-low`（低。`--pl-accent` を薄くした緑）です。中は `--pl-accent` です。

チェックの丸・四角の枠は、`--pl-muted` と `--pl-border` を混ぜた色です（区切り線より濃い）。中は `--pl-panel` で塗るので、中のプロジェクトの灰色（`--pl-panel-2`）や「今日」の色の帯の上でも見えます。

## 土台（core）

### データの形

```ts
import type { PlannerData, Task, Habit, Project } from '@shiodome47/planner/core'

const data: PlannerData = { tasks: [], habits: [], projects: [] }
```

| 形 | 中身 |
|---|---|
| `Task` | やること。`horizon`（列）・`priority`（A〜D・P）・`due`（期日 YYYY-MM-DD）・`projectId` など。回数の目標は `count`（`target` めざす数・`done` 今の数・`log` 日ごとに足した数）。やめたものは `canceled: true`（`doneAt` にやめた日時） |
| `Habit` | 習慣（くり返し）。記録（`history`）が上限で古い日を消したら、残っている一番古い日を `historyFrom` に。`period`（毎日・毎週・毎月・毎年）と「その日」（`weekday`・`day`・`yearDay`）。終えたら `endedAt`・`endedAs`（`'graduated'` 卒業／`'paused'` お休み）・`endNote`（ひとこと）。また始めたら、休んでいた間を `breaks` に残す。3 段階は `tiers`（`low`・`mid`・`top` の中身）と `levels`（チェックした日ごとの段階 1 低・2 中・3 上。無い日は段階を付ける前のチェック） |
| `Project` | プロジェクト・テーマ。テーマの中にプロジェクトを入れられる（1 段だけ）。`goalId` は、そのプロジェクトが「中身」になっている期日目標 |

アプリは、`PlannerData` に自分の項目（日記など）を足した形で持って構いません。土台の関数は、足した項目を変えずに残します。

### 変更は「返す」だけ。保存はアプリが行う

関数はデータを直接は書き換えず、**変更（`Changes`）を返します**。アプリはそれを保存先に書き、`applyChanges` で手元のデータにも当てます。保存先（IndexedDB・サーバー・同期）は自由に選べます。

```ts
import { applyChanges, buildColumns, newTask, newHabit, withDay, toggleDone, HORIZON_NAME } from '@shiodome47/planner/core'

const now = new Date()

// 期日つきのやること → 期日から、出す列が自動で決まる（2 日後なら「今週」）
data = applyChanges(data, { tasks: [newTask(data, { title: '総会の資料をつくる', horizon: 'pool', priority: 'B', due: '2026-11-21' }, now)] })

// くり返し: 毎月 第 2 日曜 → その日がある週は「今週」、その日は「今日」の列にも自動で出る
data = applyChanges(data, { habits: [withDay(newHabit(data, { title: '役員会', period: 'month' }, now), 'w2-0')] })

// 列ごとに並べる（番号 A1・B1 … も付く）
for (const col of buildColumns(data, now)) {
  console.log(HORIZON_NAME[col.horizon], col.tasks.map((v) => `${v.label} ${v.task.title}`))
}

// 終える
data = applyChanges(data, toggleDone(data, data.tasks[0], now))
```

「今」（`now`）は、関数に渡します。テストしやすく、2 台の端末で結果がずれないようにするためです。日付が変わっても保存してあるデータは書き換えず、表示するときに判断します（同期で競合しないように）。

### おもな関数

| 分類 | 関数 |
|---|---|
| 時間軸 | `buildColumns(data, now)` 列ごとの表示（やること・習慣・明日の欄・来週の欄）／`todayMarks(data, now)` 今日のもの（習慣・やることと、済んだか）／`horizonForDue(due, now)` 期日から列／`effectiveHorizon(task, now)`／`emptyPriorityGaps(present)` 空の優先度を、並びのどこに出すか（ドラッグの落とし先） |
| やること | `newTask` `toggleDone` `placeDown`（今日やる、などで下ろす）`returnUp` `moveTo` `moveStep` `setPriority` `setDue` `removeTask` `reorderTasks` `postponeToTomorrow` `bringToToday` `cancelTask`（やめる。取り消しは `toggleDone`） |
| 習慣 | `newHabit` `toggleHabit` `toggleHabitAll` `checkHabitFor`（時間軸の行のチェック。週・月の変わり目の「その日」は、その日の期間に付ける）`placeHabitDown` `habitToTask` `removeHabit`（下ろした先のまだのものも消す）`reorderHabits` `reorderRoutine`（プロジェクトのルーチン目標の並べ替え）`moveHabitToProject`（ほかのプロジェクトへ移す・外す。下ろした先のまだのやることもそろえる） |
| 習慣を終える | `endHabit(data, habit, 'graduated' \| 'paused', ひとこと, now)` 卒業・お休み（終えた習慣なら、終え方とひとことだけ変える）／`resumeHabit(data, habit, now)` また始める／`endedHabits(habits)` 終えた習慣を新しい順に。`buildColumns` の列は、終えた習慣を `habits` に入れず `ended` に入れる |
| くり返しの「その日」 | 毎月: `withDay(habit, 20 \| 'end' \| 'w2-3' \| 'wL-5')`／毎週・毎年: `withWhen(habit, 3 \| '12-06' \| '12')`／`whenLabel` `whenDate` `monthDayDate` |
| プロジェクト | `newProject` `topProjects` `childProjects` `moveProject` `removeProject` `reorderProjects` `projectGoals`（終えていないもの・終えたもの＝新しく終えた順）`reorderGoals` |
| 習慣の 3 段階 | `setHabitTiers(habit, { low, mid, top } \| undefined, now)` 3 段階にする・中身を変える・やめる／`setHabitLevel(habit, day, 1 \| 2 \| 3, now)` その日（その期間）の段階を決める／`habitLevelOn(habit, day)` その日の段階（記録が無ければ undefined）／`tiersLabel(tiers)` 「低 3分・中 10分・上 30分」／`LEVEL_NAME` 低・中・上。チェック（`toggleHabit` など）で「低」が付き、外すと消える |
| 回数の目標 | `setCount(data, task, { target, done } \| undefined, now)` 回数の目標にする・直す・やめる／`addCount(data, task, 1, now)` 足す（-1 でへらす）／`countedTask(data, task)` 数える項目（下ろした先なら元）／`countsOn(data, day)` その日に足した回数 |
| 目標を細かく分ける | `splitGoal(data, goal, name, now)` 中身のプロジェクトを作る／`linkGoal(data, goal, project, now)` 今あるものをつなぐ／`unlinkGoal(project, now)`／`goalBreakdown(data, goal)` 中身と進み具合／`breakdownOf(data, project)` どの目標の中身か／`linkableProjects(data, goal)` つなげるもの |
| 振り返り | `doneOn(data, day, now)` その日に済ませたこと（やめたものは入れない）／`canceledOn(data, day, now)` その日にやめたこと／`streak(habit, now)` 続いた日数／`toggleHabitOnDay` `finishOnDay`（過ぎた日に付け直す）／`habitActiveOn(habit, day)` その日に続けていたか（始める前・終えたあと・休んでいた間は数えない。「毎日 3/4」の分母に使う）／`habitRecord(habit, now)` 始めてから終えるまでの、できた数と期間の数 |
| 日付 | `dayKey` `weekKey` `weekStart` `addDays` `periodLabel` `dueLabel` `shortDueLabel` |
| 当てる | `applyChanges(data, changes)` ／ `mergeById(list, puts, deleteIds)` |

画面の言葉（`HORIZON_NAME`・`PRIORITY_NAME`・`PERIOD_NAME` など）は日本語です。

## English

Building blocks for a timeline (today / this week / months / this year / life) and projects, taken from the Magic Lamp app. Screens: `<Timeline data now onChange />` (`@shiodome47/planner/timeline`) and `<Projects data now onChange />` (`@shiodome47/planner/projects`); import `@shiodome47/planner/style.css`. Styles apply only inside `.planner`; override `--pl-*` variables to match your app. `@shiodome47/planner/core` holds the data model (`Task`, `Habit`, `Project`, `PlannerData`) and the rules — which column a dated task belongs to, the next date of a recurring habit ("2nd Sunday of each month", "every December 6"), placing, finishing and reordering, and review helpers. On the timeline, a project's habits (2+ in a column) collapse into one row ("▸ Yoga — 7 left"); the projects screen has a "Today" toggle that highlights what is in today's column (`todayMarks`). Tasks can be counted goals (`count`: target / done / per-day log; `setCount` / `addCount`), shown as "20/100 回 ＋1". A goal can be broken down into its own project (`splitGoal` / `linkGoal`, stored as `Project.goalId`); the goal row shows the inner project's progress. Habits can be ended as "graduated" or "paused" (`endHabit` / `resumeHabit`); their check history is kept, they move to a collapsed "past habits" list, and `habitActiveOn` / `habitRecord` count only the days a habit was active. A habit can have three tiers — low / mid / top (`tiers`, `setHabitTiers`): checking it records "low", and the row shows 低・中・上 to raise that day's level (`setHabitLevel`, read with `habitLevelOn`); the checkbox turns pale green for low and deep purple for top. Functions never mutate data; they return `Changes`, which you save wherever you like and apply locally with `applyChanges`. Pass the current time (`now`) explicitly. UI labels are Japanese.

## License

MIT
