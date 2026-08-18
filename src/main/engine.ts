import fs from 'node:fs'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import type {
  EngineEvent,
  LogLevel,
  Progress,
  ScrapedMetadata,
  Task,
  TaskMetadata
} from '../shared/types'
import { parseNumberFromFileName, type ParsedName } from './number/parseNumber'
import type { SettingsStore } from './store/settingsStore'
import { createHttpClient, createSources } from './scrapers'
import type { ScrapeContext, ScrapeSource } from './scrapers'
import { writeMediaAssets } from './media/writeMedia'
import type { HttpClient } from './net/httpClient'

const VIDEO_EXTS = [
  '.mp4',
  '.mkv',
  '.avi',
  '.wmv',
  '.mov',
  '.m4v',
  '.flv',
  '.webm',
  '.ts',
  '.m2ts'
] as const

export class Engine {
  private win: BrowserWindow | null = null
  private readonly settingsStore: SettingsStore
  private readonly tasks: Task[] = []
  private running = false

  constructor(settingsStore: SettingsStore) {
    this.settingsStore = settingsStore
  }

  attach(win: BrowserWindow): void {
    this.win = win
  }

  getTasks(): Task[] {
    return this.snapshot()
  }

  addPaths(paths: string[]): number {
    let added = 0
    for (const p of paths) {
      added += this.addPath(p)
    }
    this.emitTasks()
    return added
  }

  private addPath(target: string): number {
    let stat: fs.Stats
    try {
      stat = fs.statSync(target)
    } catch {
      return 0
    }

    if (stat.isDirectory()) {
      return this.addDirectory(target)
    }

    if (stat.isFile() && this.isVideo(target)) {
      this.upsertFile(target, stat.size)
      return 1
    }
    return 0
  }

  private addDirectory(dir: string): number {
    let count = 0
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return 0
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.')) continue
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        count += this.addDirectory(full)
      } else if (ent.isFile() && this.isVideo(ent.name)) {
        try {
          const st = fs.statSync(full)
          this.upsertFile(full, st.size)
          count += 1
        } catch {
          // 无权限或文件被删除时跳过
        }
      }
    }
    return count
  }

  private upsertFile(filePath: string, size: number): void {
    if (this.tasks.some((t) => t.filePath === filePath)) return
    this.tasks.push({
      id: this.makeId(),
      filePath,
      fileName: path.basename(filePath, path.extname(filePath)),
      sizeMB: Math.round((size / 1024 / 1024) * 10) / 10,
      status: 'queued',
      number: null,
      title: null,
      website: null,
      error: null,
      outputDir: null,
      metadata: null,
      addedAt: Date.now()
    })
  }

  private isVideo(name: string): boolean {
    return VIDEO_EXTS.includes(path.extname(name).toLowerCase() as (typeof VIDEO_EXTS)[number])
  }

  async startAll(): Promise<void> {
    if (this.running) return
    this.running = true
    this.emitProgress()
    try {
      const settings = this.settingsStore.getAll()
      const http = createHttpClient({
        proxyUrl: settings.proxyUrl,
        requestIntervalSec: settings.requestIntervalSec
      })
      const sources = createSources(settings.enabledSites)
      const ctx: ScrapeContext = { http }

      for (const task of this.tasks) {
        if (task.status === 'success' || task.status === 'scraping') continue
        await this.processTask(task, sources, ctx, http, settings)
      }
    } finally {
      this.running = false
      this.emitProgress()
    }
  }

  async retryTask(id: string): Promise<void> {
    const task = this.tasks.find((t) => t.id === id)
    if (!task || this.running) return
    task.status = 'queued'
    task.error = null
    this.emitTasks()
    await this.startAll()
  }

  async retryFailed(): Promise<void> {
    for (const t of this.tasks) {
      if (t.status === 'failed') {
        t.status = 'queued'
        t.error = null
      }
    }
    this.emitTasks()
    await this.startAll()
  }

  removeTask(id: string): void {
    const idx = this.tasks.findIndex((t) => t.id === id)
    if (idx >= 0) {
      this.tasks.splice(idx, 1)
      this.emitTasks()
      this.emitProgress()
    }
  }

  clearFinished(): void {
    for (let i = this.tasks.length - 1; i >= 0; i--) {
      const s = this.tasks[i].status
      if (s === 'success' || s === 'failed' || s === 'skipped') {
        this.tasks.splice(i, 1)
      }
    }
    this.emitTasks()
    this.emitProgress()
  }

  private async processTask(
    task: Task,
    sources: ScrapeSource[],
    ctx: ScrapeContext,
    http: HttpClient,
    settings: ReturnType<SettingsStore['getAll']>
  ): Promise<void> {
    task.status = 'scraping'
    task.error = null
    this.emitTasks()
    this.emitProgress()
    this.log('info', `开始识别：${task.fileName}`)

    const parsed = parseNumberFromFileName(task.fileName)
    const number = parsed?.number ?? task.fileName
    task.number = number
    this.emitTasks()

    if (sources.length === 0) {
      this.markFailed(task, '未启用任何刮削源')
      return
    }

    const metadata = await this.scrapeNumber(sources, ctx, number, parsed)
    if (!metadata) {
      this.markFailed(task, '未找到元数据')
      return
    }

    task.title = metadata.title
    task.website = sources[0].id
    task.metadata = this.toTaskMetadata(metadata)
    task.outputDir = path.dirname(task.filePath)
    task.status = 'success'
    task.error = null
    this.emitTasks()
    this.emitProgress()
    this.log('success', `刮削完成：${number} ${metadata.title}`)

    try {
      const summary = await writeMediaAssets(http, task.filePath, metadata, settings)
      if (summary.skippedNfo) {
        this.log('info', `[${number}] ${summary.notes.join('；')}`)
      } else {
        const bits: string[] = []
        if (summary.nfoPath) bits.push(`NFO`)
        if (summary.posterPath) bits.push(`海报`)
        if (summary.sampleCount > 0) bits.push(`样张×${summary.sampleCount}`)
        if (summary.actorCount > 0) bits.push(`演员头像×${summary.actorCount}`)
        if (bits.length > 0) this.log('success', `[${number}] 已写入：${bits.join('、')}`)
        for (const note of summary.notes) this.log('warn', `[${number}] ${note}`)
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.log('error', `[${number}] 媒体写入失败：${msg}`)
    }
  }

  private async scrapeNumber(
    sources: ScrapeSource[],
    ctx: ScrapeContext,
    number: string,
    parsed: ParsedName | null
  ): Promise<ScrapedMetadata | null> {
    for (const source of sources) {
      this.log('info', `[${source.id}] 查询 ${number}`)
      try {
        const outcome = await source.scrape(ctx, number, parsed)
        if (outcome.ok) return outcome.data
        if (outcome.reason === 'not_found') {
          this.log('warn', `[${source.id}] 未找到 ${number}`)
        } else {
          this.log('error', `[${source.id}] ${outcome.message}`)
        }
      } catch (err) {
        this.log('error', `[${source.id}] ${err instanceof Error ? err.message : String(err)}`)
      }
    }
    return null
  }

  private toTaskMetadata(data: ScrapedMetadata): TaskMetadata {
    return {
      title: data.title,
      actors: data.actors.map((a) => a.name),
      releaseDate: data.releaseDate ?? '',
      runtimeMin: data.runtimeMin ?? 0,
      publisher: data.publisher ?? '',
      series: data.series ?? '',
      tags: [...data.genres]
    }
  }

  private markFailed(task: Task, message: string): void {
    task.status = 'failed'
    task.error = message
    this.emitTasks()
    this.emitProgress()
    this.log('error', `[${task.number ?? task.fileName}] ${message}`)
  }

  private makeId(): string {
    return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  }

  private countByStatus(): { done: number; total: number } {
    const total = this.tasks.length
    const done = this.tasks.filter((t) => t.status === 'success' || t.status === 'failed').length
    return { done, total }
  }

  private snapshot(): Task[] {
    return this.tasks.map((t) => ({ ...t, metadata: t.metadata ? { ...t.metadata } : null }))
  }

  private emitTasks(): void {
    this.emit({ type: 'tasks', tasks: this.snapshot() })
  }

  private emitProgress(): void {
    const { done, total } = this.countByStatus()
    const progress: Progress = { done, total, running: this.running }
    this.emit({ type: 'progress', progress })
  }

  private log(level: LogLevel, message: string): void {
    this.emit({ type: 'log', line: { time: Date.now(), level, message } })
  }

  private emit(event: EngineEvent): void {
    this.win?.webContents.send('engine:event', event)
  }
}
