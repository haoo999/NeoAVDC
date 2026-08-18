import type { LogLine, Progress } from './log'
import type { Task } from './task'

export type EngineEvent =
  | { type: 'tasks'; tasks: Task[] }
  | { type: 'log'; line: LogLine }
  | { type: 'progress'; progress: Progress }
