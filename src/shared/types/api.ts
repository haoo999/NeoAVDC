import type { EngineEvent } from './engine'
import type { Settings } from './settings'

export interface RescrapeOptions {
  number?: string
}

export interface NeoApi {
  addPaths(paths: string[]): Promise<number>
  startAll(): Promise<void>
  retryTask(id: string): Promise<void>
  retryFailed(): Promise<void>
  rescrapeTask(id: string, options?: RescrapeOptions): Promise<void>
  removeTask(id: string): Promise<void>
  clearFinished(): Promise<void>
  selectFiles(): Promise<string[]>
  selectFolder(): Promise<string[]>
  getPathForFile(file: File): string
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  readImage(source: string): Promise<string>
  onEngineEvent(cb: (ev: EngineEvent) => void): () => void
}
