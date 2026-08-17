import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { collectFiles } from './io/collectFiles'
import { isVideoFile, parseNumberFromFileName, VIDEO_EXTS } from './number/parseNumber'
import { IPC } from '../shared/channels'
import type { EngineEvent, LogLevel, LogLine, Progress, Task } from '../shared/types'

export type EngineListener = (ev: EngineEvent) => void

export class Engine {
  private tasks: Task[] = []
  private listeners = new Set<EngineListener>()
  private running = false
  private win: BrowserWindow | null = null

  attach(win: BrowserWindow): void {
    this.win = win
    win.on('closed', () => {
      if (this.win === win) this.win = null
    })
  }

  on(fn: EngineListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }

  private emit(ev: EngineEvent): void {
    for (const fn of this.listeners) fn(ev)
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send(IPC.ENGINE_EVENT, ev)
    }
  }

  private log(level: LogLevel, message: string): void {
    const line: LogLine = { time: Date.now(), level, message }
    this.emit({ type: 'log', line })
  }

  private snapshot(): void {
    this.emit({ type: 'tasks', tasks: [...this.tasks] })
    const progress: Progress = {
      done: this.tasks.filter((t) => t.status === 'success' || t.status === 'failed').length,
      total: this.tasks.length,
      running: this.running
    }
    this.emit({ type: 'progress', progress })
  }

  private update(id: string, patch: Partial<Task>): void {
    const idx = this.tasks.findIndex((t) => t.id === id)
    if (idx === -1) return
    this.tasks[idx] = { ...this.tasks[idx], ...patch }
    this.snapshot()
  }

  addPaths(paths: string[]): number {
    let added = 0
    for (const p of paths) {
      try {
        const stat = fs.statSync(p)
        if (stat.isDirectory()) {
          const files = collectFiles(p, VIDEO_EXTS)
          for (const f of files) {
            if (this.tasks.some((t) => t.filePath === f.fullPath)) continue
            const parsed = parseNumberFromFileName(f.relativePath)
            this.tasks.push({
              id: randomUUID(),
              filePath: f.fullPath,
              fileName: f.relativePath,
              sizeMB: f.sizeMB,
              status: 'queued',
              number: parsed?.number ?? null,
              title: null,
              website: null,
              error: null,
              outputDir: null,
              metadata: null,
              addedAt: Date.now()
            })
            added++
          }
        } else if (stat.isFile() && isVideoFile(p)) {
          if (this.tasks.some((t) => t.filePath === p)) continue
          const parsed = parseNumberFromFileName(path.basename(p))
          this.tasks.push({
            id: randomUUID(),
            filePath: p,
            fileName: path.basename(p),
            sizeMB: Math.round((stat.size / 1024 / 1024) * 10) / 10,
            status: 'queued',
            number: parsed?.number ?? null,
            title: null,
            website: null,
            error: null,
            outputDir: null,
            metadata: null,
            addedAt: Date.now()
          })
          added++
        }
      } catch (err) {
        this.log('error', `无法访问路径：${p}（${(err as Error).message}）`)
      }
    }
    if (added > 0) {
      this.log('info', `已添加 ${added} 个视频文件到任务队列`)
    }
    this.snapshot()
    return added
  }

  async startAll(): Promise<void> {
    if (this.running) return
    this.running = true
    this.log('info', '开始执行刮削任务…')
    this.snapshot()

    const queue = this.tasks.filter((t) => t.status === 'queued' || t.status === 'failed')
    for (const task of queue) {
      this.update(task.id, { status: 'scraping' })
      this.log('info', `正在处理：${task.fileName}`)
      await new Promise((r) => setTimeout(r, 400 + Math.random() * 500))
      if (task.number) {
        this.update(task.id, {
          status: 'success',
          title: `示例元数据 - ${task.number}`,
          website: '示例源',
          metadata: {
            title: `示例元数据 - ${task.number}`,
            actors: ['示例演员'],
            releaseDate: '2024-01-01',
            runtimeMin: 120,
            publisher: '示例片商',
            series: '示例系列',
            tags: ['示例标签']
          }
        })
        this.log('success', `刮削成功：${task.number}`)
      } else {
        this.update(task.id, { status: 'failed', error: '无法从文件名识别番号' })
        this.log('error', `刮削失败：${task.fileName}（无法识别番号）`)
      }
    }

    this.running = false
    this.log('info', '全部任务执行完毕')
    this.snapshot()
  }

  retryTask(id: string): Promise<void> {
    const t = this.tasks.find((x) => x.id === id)
    if (!t) return Promise.resolve()
    this.update(id, { status: 'queued', error: null })
    return this.startAll()
  }

  retryFailed(): Promise<void> {
    for (const t of this.tasks) {
      if (t.status === 'failed') this.update(t.id, { status: 'queued', error: null })
    }
    return this.startAll()
  }

  removeTask(id: string): void {
    this.tasks = this.tasks.filter((t) => t.id !== id)
    this.snapshot()
  }

  clearFinished(): void {
    this.tasks = this.tasks.filter((t) => t.status !== 'success' && t.status !== 'failed')
    this.snapshot()
  }
}
