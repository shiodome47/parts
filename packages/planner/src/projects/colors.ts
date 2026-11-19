/** プロジェクトの色（.pl-color-○○ の名前） */
export const PROJECT_COLORS = ['teal', 'blue', 'purple', 'pink', 'orange', 'red', 'yellow', 'green'] as const
export type ProjectColor = (typeof PROJECT_COLORS)[number]
