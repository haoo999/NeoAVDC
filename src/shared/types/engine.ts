import type { LogLevel, LogLine } from './log'
import type { Task } from './task'

// 活动进度行：同一 key 的行会在日志面板原位更新，不逐行追加
export interface ActivityLine {
  key: string
  message: string
  level: LogLevel
}

export type EngineEvent =
  | { type: 'tasks'; tasks: Task[] }
  | { type: 'log'; line: LogLine }
  | { type: 'activity-update'; line: ActivityLine }
  | { type: 'activity-commit'; key: string; line: LogLine }
  | { type: 'progress'; progress: import('./log').Progress }
