# @shiodome47/planner

時間軸（今日・今週・数か月・今年・一生）とプロジェクトの部品です。[まほうのランプ](https://lamp.shiodome47.com) の仕組みを、ほかのアプリでも使えるように取り出しました。

| 入り口 | 中身 | 状態 |
|---|---|---|
| `@shiodome47/planner/core` | **土台**。データの形と決まりごと（画面なし。計算だけ） | ✅ 使えます |
| `@shiodome47/planner/timeline` | 時間軸の画面 | これから |
| `@shiodome47/planner/projects` | プロジェクトの画面（並べ替えは [linkshelf](https://www.npmjs.com/package/linkshelf) の `<CardBoard>`） | これから |

時間軸とプロジェクトは、同じ「やること」の一覧を見ています。期日を入れたやることは、プロジェクトのカードにも、時間軸の列にも出ます。つなぐのは画面ではなく、この土台（`core`）です。

```bash
npm install @shiodome47/planner
```

## 土台（core）

### データの形

```ts
import type { PlannerData, Task, Habit, Project } from '@shiodome47/planner/core'

const data: PlannerData = { tasks: [], habits: [], projects: [] }
```

| 形 | 中身 |
|---|---|
| `Task` | やること。`horizon`（列）・`priority`（A〜D・P）・`due`（期日 YYYY-MM-DD）・`projectId` など |
| `Habit` | 習慣（くり返し）。`period`（毎日・毎週・毎月・毎年）と「その日」（`weekday`・`day`・`yearDay`） |
| `Project` | プロジェクト・テーマ。テーマの中にプロジェクトを入れられる（1 段だけ） |

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
| 時間軸 | `buildColumns(data, now)` 列ごとの表示（やること・習慣・明日の欄・来週の欄）／`horizonForDue(due, now)` 期日から列／`effectiveHorizon(task, now)` |
| やること | `newTask` `toggleDone` `placeDown`（今日やる、などで下ろす）`returnUp` `moveTo` `moveStep` `setPriority` `setDue` `removeTask` `reorderTasks` `postponeToTomorrow` `bringToToday` |
| 習慣 | `newHabit` `toggleHabit` `toggleHabitAll` `placeHabitDown` `habitToTask` `reorderHabits` |
| くり返しの「その日」 | 毎月: `withDay(habit, 20 \| 'end' \| 'w2-3' \| 'wL-5')`／毎週・毎年: `withWhen(habit, 3 \| '12-06' \| '12')`／`whenLabel` `whenDate` `monthDayDate` |
| プロジェクト | `newProject` `topProjects` `childProjects` `moveProject` `removeProject` `reorderProjects` `projectGoals` `reorderGoals` |
| 振り返り | `doneOn(data, day, now)` その日に済ませたこと／`streak(habit, now)` 続いた日数／`toggleHabitOnDay` `finishOnDay`（過ぎた日に付け直す） |
| 日付 | `dayKey` `weekKey` `weekStart` `addDays` `periodLabel` `dueLabel` `shortDueLabel` |
| 当てる | `applyChanges(data, changes)` ／ `mergeById(list, puts, deleteIds)` |

画面の言葉（`HORIZON_NAME`・`PRIORITY_NAME`・`PERIOD_NAME` など）は日本語です。

## English

Building blocks for a timeline (today / this week / months / this year / life) and projects, taken from the Magic Lamp app. `@shiodome47/planner/core` is available now: the data model (`Task`, `Habit`, `Project`, `PlannerData`) and the rules — which column a dated task belongs to, the next date of a recurring habit ("2nd Sunday of each month", "every December 6"), placing, finishing and reordering, and review helpers. Functions never mutate data; they return `Changes`, which you save wherever you like and apply locally with `applyChanges`. Pass the current time (`now`) explicitly. UI labels are Japanese. Timeline and project screens will follow as `/timeline` and `/projects`.

## License

MIT
