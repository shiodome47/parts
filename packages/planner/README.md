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
- プロジェクトの終えた期日目標は、一番下の **「終えた目標（n）」** にたたみます（はじめは閉じている。新しく終えた順。開けば見られ、チェックを外せば上へ戻る）。細かいステップを足していっても、カードが終えたもので埋まりません
- 時間軸は、スマホの幅では列を横にすべらせ、上の帯から列を選べます。プロジェクトは、画面の幅に合わせて段組みになり、カードをドラッグで並べ替えられます（キーボードでも）

### 目標を細かく分ける（中身のプロジェクト）

大きな目標（「ALL IN ONE 完了」）の細かいステップは、別のプロジェクト（「ALL IN ONE 完遂」）に並べ、目標とつなげます。メインの目標は 1 行のまま、細かいステップは中身のほうに分かれます。

| 操作 | どうなるか |
|---|---|
| 期日目標の … →「細かく分ける…」→ **作る** | その目標の中身になるプロジェクトを作る（名前ははじめ目標と同じ）。置き場所は、入れ子が 1 段のままになるように、目標のプロジェクトと同じテーマの中（目標のプロジェクトのすぐ後ろ）。目標のプロジェクトがいちばん上のカードなら、その中 |
| 期日目標の … →「細かく分ける…」→ **つなぐ** | もう作ってあるプロジェクトを中身にする（同じテーマの中のものが先に並ぶ） |
| 目標の行の「中身 2/5 ›」 | 中身の期日目標のうち、終えた数／全部。押すと中身のプロジェクトへ移る（枠が少し光る）。全部できると緑 |
| 中身のプロジェクトの「↰「TOEICお受験」の目標「ALL IN ONE 完了」の中身」 | 押すと、目標のプロジェクトへ戻る |
| … →「中身とのつなぎを外す」（目標）／「目標の中身をやめる」（プロジェクト） | つなぎだけ外す。プロジェクトも目標も残る |

中身を全部終えても、目標は自動では終えません（自分でチェックする）。目標や、目標のプロジェクトを消したときは、中身のプロジェクトはつなぎだけ外れて残ります。

### 習慣を終える（卒業・お休み）・完全に消す

習慣（ルーチン目標）の … から選びます。

| 操作 | どうなるか |
|---|---|
| **卒業・お休みにする…** | 「卒業（身についた）」か「お休み（続かなかった・今はやめる）」を選び、ひとこと（理由など。なくてもよい）を添える。チェックの一覧からは外れ、習慣の一番下の **「これまでの習慣（n）」**（はじめは閉じている）に残る。チェックの記録は消えない。下ろした先の、まだ終えていないやることは消える |
| これまでの習慣の … →「また始める」 | チェックの一覧の一番下へ戻す。終えた日と別の日なら、休んでいた間を覚えておき、振り返りの数に入れない |
| これまでの習慣の … →「卒業・お休みを変える…」 | 終え方とひとことを直す（終えた日はそのまま） |
| **完全に消す** | 記録ごと消す（元に戻せない）。チェックの記録があるときは、確かめてから消す |

「これまでの習慣」の 1 行には、卒業（🎓）かお休み（🌙）の印・名前・期間（9/1〜11/22）・できた割合（毎日なら「できた日 82%」。毎週なら週で数える）・ひとことが出ます。時間軸では各列の習慣の一番下、プロジェクトではルーチン目標の一番下（「これまでのルーチン目標」）です。

### 色を合わせる

見た目は `.planner` の中だけに効き、色は変数で決まります。使う側の CSS で上書きすると、アプリの色に合わせられます。

```css
.planner {
  --pl-accent: #2563eb;   /* 決定のボタン・今日の列・ドラッグの線 */
  --pl-panel: #fff;       /* 列・カード */
  --pl-panel-2: #f3f4f6;  /* 入力欄・行にマウスを乗せたとき */
  --pl-border: #e5e7eb;
  --pl-text: #111827;
  --pl-muted: #6b7280;
  --pl-sticky-top: 56px;  /* 上に固定の見出しがあるページでは、その高さ */
}
```

ほかに `--pl-page-bg`・`--pl-accent-text`・`--pl-danger`・`--pl-warning`・`--pl-ok` があります。プロジェクトの色は `PROJECT_COLORS`（`teal`・`blue` など 8 色）。

## 土台（core）

### データの形

```ts
import type { PlannerData, Task, Habit, Project } from '@shiodome47/planner/core'

const data: PlannerData = { tasks: [], habits: [], projects: [] }
```

| 形 | 中身 |
|---|---|
| `Task` | やること。`horizon`（列）・`priority`（A〜D・P）・`due`（期日 YYYY-MM-DD）・`projectId` など |
| `Habit` | 習慣（くり返し）。`period`（毎日・毎週・毎月・毎年）と「その日」（`weekday`・`day`・`yearDay`）。終えたら `endedAt`・`endedAs`（`'graduated'` 卒業／`'paused'` お休み）・`endNote`（ひとこと）。また始めたら、休んでいた間を `breaks` に残す |
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
| 時間軸 | `buildColumns(data, now)` 列ごとの表示（やること・習慣・明日の欄・来週の欄）／`horizonForDue(due, now)` 期日から列／`effectiveHorizon(task, now)`／`emptyPriorityGaps(present)` 空の優先度を、並びのどこに出すか（ドラッグの落とし先） |
| やること | `newTask` `toggleDone` `placeDown`（今日やる、などで下ろす）`returnUp` `moveTo` `moveStep` `setPriority` `setDue` `removeTask` `reorderTasks` `postponeToTomorrow` `bringToToday` |
| 習慣 | `newHabit` `toggleHabit` `toggleHabitAll` `placeHabitDown` `habitToTask` `reorderHabits` |
| 習慣を終える | `endHabit(data, habit, 'graduated' \| 'paused', ひとこと, now)` 卒業・お休み（終えた習慣なら、終え方とひとことだけ変える）／`resumeHabit(data, habit, now)` また始める／`endedHabits(habits)` 終えた習慣を新しい順に。`buildColumns` の列は、終えた習慣を `habits` に入れず `ended` に入れる |
| くり返しの「その日」 | 毎月: `withDay(habit, 20 \| 'end' \| 'w2-3' \| 'wL-5')`／毎週・毎年: `withWhen(habit, 3 \| '12-06' \| '12')`／`whenLabel` `whenDate` `monthDayDate` |
| プロジェクト | `newProject` `topProjects` `childProjects` `moveProject` `removeProject` `reorderProjects` `projectGoals`（終えていないもの・終えたもの＝新しく終えた順）`reorderGoals` |
| 目標を細かく分ける | `splitGoal(data, goal, name, now)` 中身のプロジェクトを作る／`linkGoal(data, goal, project, now)` 今あるものをつなぐ／`unlinkGoal(project, now)`／`goalBreakdown(data, goal)` 中身と進み具合／`breakdownOf(data, project)` どの目標の中身か／`linkableProjects(data, goal)` つなげるもの |
| 振り返り | `doneOn(data, day, now)` その日に済ませたこと／`streak(habit, now)` 続いた日数／`toggleHabitOnDay` `finishOnDay`（過ぎた日に付け直す）／`habitActiveOn(habit, day)` その日に続けていたか（始める前・終えたあと・休んでいた間は数えない。「毎日 3/4」の分母に使う）／`habitRecord(habit, now)` 始めてから終えるまでの、できた数と期間の数 |
| 日付 | `dayKey` `weekKey` `weekStart` `addDays` `periodLabel` `dueLabel` `shortDueLabel` |
| 当てる | `applyChanges(data, changes)` ／ `mergeById(list, puts, deleteIds)` |

画面の言葉（`HORIZON_NAME`・`PRIORITY_NAME`・`PERIOD_NAME` など）は日本語です。

## English

Building blocks for a timeline (today / this week / months / this year / life) and projects, taken from the Magic Lamp app. Screens: `<Timeline data now onChange />` (`@shiodome47/planner/timeline`) and `<Projects data now onChange />` (`@shiodome47/planner/projects`); import `@shiodome47/planner/style.css`. Styles apply only inside `.planner`; override `--pl-*` variables to match your app. `@shiodome47/planner/core` holds the data model (`Task`, `Habit`, `Project`, `PlannerData`) and the rules — which column a dated task belongs to, the next date of a recurring habit ("2nd Sunday of each month", "every December 6"), placing, finishing and reordering, and review helpers. A goal can be broken down into its own project (`splitGoal` / `linkGoal`, stored as `Project.goalId`); the goal row shows the inner project's progress. Habits can be ended as "graduated" or "paused" (`endHabit` / `resumeHabit`); their check history is kept, they move to a collapsed "past habits" list, and `habitActiveOn` / `habitRecord` count only the days a habit was active. Functions never mutate data; they return `Changes`, which you save wherever you like and apply locally with `applyChanges`. Pass the current time (`now`) explicitly. UI labels are Japanese.

## License

MIT
