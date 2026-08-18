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
