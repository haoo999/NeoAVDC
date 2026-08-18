import fs from 'node:fs'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import type {
  ActivityLine,
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
import { organizeVideo } from './media/organizeMedia'
import { readImageAsDataUrl } from './media/readImage'
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
  private readonly imageCache = new Map<string, string>()
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
      coverUrl: null,
      posterUrl: null,
      numberFromManual: false,
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
        if (
          task.status === 'success' ||
          task.status === 'scraping' ||
          task.status === 'downloading'
        )
          continue
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

  async rescrapeTask(id: string, options: { number?: string } = {}): Promise<void> {
    if (this.running) return
    const task = this.tasks.find((t) => t.id === id)
    if (!task) return

    const manual = typeof options.number === 'string' ? options.number.trim() : ''
    if (manual) {
      task.number = manual
      task.numberFromManual = true
      this.log('info', `[${manual}] 用户指定番号重刮`)
    }
    task.status = 'queued'
    task.error = null
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

  // 供渲染端读取海报/封面：本地 file:// 直接读，远程用带 Referer 的 http 客户端抓取，
  // 统一转成 data URL，绕过防盗链和 dev 下 file:// 跨域限制。结果做进程内缓存。
  async readImage(source: string): Promise<string> {
    if (typeof source !== 'string' || source.length === 0) {
      throw new Error('图片地址为空')
    }
    const cached = this.imageCache.get(source)
    if (cached) return cached

    const settings = this.settingsStore.getAll()
    const http = createHttpClient({
      proxyUrl: settings.proxyUrl,
      requestIntervalSec: 0
    })
    const dataUrl = await readImageAsDataUrl(http, source)
    this.imageCache.set(source, dataUrl)
    return dataUrl
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

    // 用户手动指定过番号则不再从文件名重新解析，避免覆盖纠正结果
    const parsed = task.numberFromManual && task.number
      ? null
      : parseNumberFromFileName(task.fileName)
    const number = parsed?.number ?? task.number ?? task.fileName
    if (task.numberFromManual) {
      this.log('info', `使用手动番号：${number}`)
    }
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
    task.coverUrl = metadata.coverUrl || null
    task.status = 'scraping'
    task.error = null
    this.emitTasks()
    this.emitProgress()
    this.log('success', `元数据命中：${number} ${metadata.title}`)

    // 统一收纳模式下必须先配置目标根目录，否则前面的抓取都白做
    if (settings.organizeMode === 'central' && !settings.centralLibraryDir.trim()) {
      task.status = 'failed'
      task.error = '未配置统一收纳目录'
      this.log('error', `[${number}] ${task.error}`)
      return
    }

    // 刮削成功后按设置收纳成番号子文件夹，再在新位置写入媒体产物
    let videoPath = task.filePath
    this.log('info', `[${number}] 收纳文件…`)
    try {
      const organized = organizeVideo(task.filePath, number, settings.folderNaming, metadata, {
        followSubtitles: settings.followSubtitles,
        targetRootDir:
          settings.organizeMode === 'central' ? settings.centralLibraryDir : undefined
      })
      if (organized.moved) {
        videoPath = organized.videoPath
        task.filePath = organized.videoPath
        const sidecarNote =
          organized.movedSidecars.length > 0 ? `（含字幕×${organized.movedSidecars.length}）` : ''
        this.log(
          'info',
          `[${number}] 已收纳到 ${path.basename(organized.folderPath)}/${sidecarNote}`
        )
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.log('warn', `[${number}] 收纳失败，回退原地写入：${msg}`)
    }
    task.outputDir = path.dirname(videoPath)

    // 进入媒体产物下载阶段，状态切到「下载中」并实时上报正在处理的项目
    task.status = 'downloading'
    this.emitTasks()
    this.emitProgress()

    // 各下载阶段的活动行 key，进度原位刷新、阶段结束统一提交
    const stageKeys = {
      cover: `${task.id}:cover`,
      sample: `${task.id}:sample`,
      actor: `${task.id}:actor`
    }

    try {
      const summary = await writeMediaAssets(
        http,
        videoPath,
        metadata,
        parsed,
        settings,
        (p) => {
          const prefix = `[${number}]`
          if (p.done) {
            // 阶段结束：立即把活动行原位替换为最终结果
            const ok = (p.count ?? 0) > 0
            if (p.stage === 'cover') {
              this.commitActivity(
                stageKeys.cover,
                ok ? 'success' : 'warn',
                ok ? `${prefix} 封面下载完成` : `${prefix} 封面下载失败`
              )
            } else if (p.stage === 'sample') {
              this.commitActivity(
                stageKeys.sample,
                ok ? 'success' : 'warn',
                ok ? `${prefix} 样张下载完成（${p.count} 张）` : `${prefix} 样张下载失败`
              )
            } else if (p.stage === 'actor') {
              this.commitActivity(
                stageKeys.actor,
                ok ? 'success' : 'warn',
                ok
                  ? `${prefix} 演员头像下载完成（${p.count} 个）`
                  : `${prefix} 演员头像下载失败`
              )
            }
            return
          }
          if (p.stage === 'cover') {
            const msg = p.index === 1 ? `${prefix} 下载封面…` : `${prefix} 处理海报…`
            this.activity(stageKeys.cover, 'info', msg)
          } else if (p.stage === 'sample') {
            this.activity(
              stageKeys.sample,
              'info',
              `${prefix} 下载样张 ${p.index}/${p.total}…`
            )
          } else if (p.stage === 'actor') {
            const who = p.label ? ` ${p.label}` : ''
            this.activity(
              stageKeys.actor,
              'info',
              `${prefix} 下载演员头像 ${p.index}/${p.total}${who}…`
            )
          }
        }
      )

      if (summary.skippedNfo) {
        this.log('info', `[${number}] ${summary.notes.join('；')}`)
      } else {
        if (summary.nfoPath) this.log('success', `[${number}] NFO 已写入`)
        for (const note of summary.notes) this.log('warn', `[${number}] ${note}`)
      }

      // 媒体产物全部落盘后才标记成功
      task.status = 'success'
      task.error = null
      if (summary.posterPath) {
        task.posterUrl = this.pathToFileUrl(summary.posterPath)
      }
      this.emitTasks()
      this.emitProgress()
      this.log('success', `[${number}] 完成`)
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      task.status = 'failed'
      task.error = `媒体写入失败：${msg}`
      this.emitTasks()
      this.emitProgress()
      this.commitActivity(stageKeys.cover, 'error', `[${number}] 下载中断`)
      this.commitActivity(stageKeys.sample, 'error', `[${number}] 下载中断`)
      this.commitActivity(stageKeys.actor, 'error', `[${number}] 下载中断`)
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
      tags: [...data.genres],
      posterNoCrop: data.posterNoCrop === true
    }
  }

  private pathToFileUrl(p: string): string {
    let resolved = path.resolve(p)
    if (process.platform === 'win32') {
      resolved = resolved.replace(/\\/g, '/')
      if (!resolved.startsWith('/')) resolved = `/${resolved}`
    }
    return `file://${encodeURI(resolved)}`
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
    const done = this.tasks.filter(
      (t) => t.status === 'success' || t.status === 'failed' || t.status === 'skipped'
    ).length
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

  // 更新活动进度行（同一 key 原位刷新，不逐行追加）
  private activity(key: string, level: LogLevel, message: string): void {
    const line: ActivityLine = { key, level, message }
    this.emit({ type: 'activity-update', line })
  }

  // 把活动行提交为一条最终日志并从活动区移除
  private commitActivity(key: string, level: LogLevel, message: string): void {
    this.emit({ type: 'activity-commit', key, line: { time: Date.now(), level, message } })
  }

  private emit(event: EngineEvent): void {
    this.win?.webContents.send('engine:event', event)
  }
}
