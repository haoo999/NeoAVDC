export type TaskStatus = 'pending' | 'queued' | 'scraping' | 'success' | 'failed' | 'skipped'

export interface TaskMetadata {
  title: string
  actors: string[]
  releaseDate: string
  runtimeMin: number
  publisher: string
  series: string
  tags: string[]
}

export interface Task {
  id: string
  filePath: string
  fileName: string
  sizeMB: number
  status: TaskStatus
  number: string | null
  title: string | null
  website: string | null
  error: string | null
  outputDir: string | null
  metadata: TaskMetadata | null
  addedAt: number
}

export type LogLevel = 'info' | 'warn' | 'error' | 'success'

export interface LogLine {
  time: number
  level: LogLevel
  message: string
}

export interface Progress {
  done: number
  total: number
  running: boolean
}

export type EngineEvent =
  | { type: 'tasks'; tasks: Task[] }
  | { type: 'log'; line: LogLine }
  | { type: 'progress'; progress: Progress }

export interface NeoApi {
  addPaths(paths: string[]): Promise<number>
  startAll(): Promise<void>
  retryTask(id: string): Promise<void>
  retryFailed(): Promise<void>
  removeTask(id: string): Promise<void>
  clearFinished(): Promise<void>
  selectFiles(): Promise<string[]>
  selectFolder(): Promise<string[]>
  getPathForFile(file: File): string
  onEngineEvent(cb: (ev: EngineEvent) => void): () => void
}
