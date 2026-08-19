import type { EngineEvent } from './engine'
import type { Settings } from './settings'
import type {
  AvatarProgress,
  AvatarSummary,
  CropExportOptions,
  CropInput,
  CropPreviewResult,
  ProbeEvent,
  ProbeResult,
  ScanResult
} from './tools'

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
  saveFile(defaultName: string, filters?: { name: string; extensions: string[] }[]): Promise<string>
  getPathForFile(file: File): string
  getSettings(): Promise<Settings>
  setSettings(patch: Partial<Settings>): Promise<Settings>
  readImage(source: string): Promise<string>
  onEngineEvent(cb: (ev: EngineEvent) => void): () => void

  toolsProbe(number: string): Promise<ProbeResult>
  onProbeEvent(cb: (ev: ProbeEvent) => void): () => void
  toolsCropPreview(input: CropInput): Promise<CropPreviewResult>
  toolsCropExport(options: CropExportOptions, targetPath: string): Promise<{ path: string; bytes: number }>
  toolsScan(rootDir: string): Promise<ScanResult>
  toolsAvatarsStart(rootDir: string, options: { updateNfo: boolean }): Promise<void>
  toolsAvatarsCancel(): Promise<void>
  onToolsEvent(cb: (ev: { type: 'progress'; progress: AvatarProgress } | { type: 'done'; summary: AvatarSummary } | { type: 'error'; message: string }) => void): () => void
}
