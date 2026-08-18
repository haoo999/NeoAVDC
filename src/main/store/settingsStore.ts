import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import type { Settings } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import { mergeSettings, sanitizeSettings } from './sanitizeSettings'

const SETTINGS_FILE = 'settings.json'

export class SettingsStore {
  private cached: Settings
  private readonly filePath: string

  constructor() {
    this.filePath = path.join(app.getPath('userData'), SETTINGS_FILE)
    this.cached = this.load()
  }

  getAll(): Settings {
    return { ...this.cached }
  }

  update(patch: unknown): Settings {
    this.cached = mergeSettings(patch, this.cached)
    this.persist()
    return this.getAll()
  }

  private load(): Settings {
    try {
      const raw = fs.readFileSync(this.filePath, 'utf8')
      return sanitizeSettings(JSON.parse(raw) as unknown)
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
        this.quarantine(err)
      }
      return { ...DEFAULT_SETTINGS }
    }
  }

  private persist(): void {
    const dir = path.dirname(this.filePath)
    fs.mkdirSync(dir, { recursive: true })
    const tmp = `${this.filePath}.tmp`
    fs.writeFileSync(tmp, JSON.stringify(this.cached, null, 2), 'utf8')
    fs.renameSync(tmp, this.filePath)
  }

  private quarantine(err: unknown): void {
    try {
      const stamp = new Date().toISOString().replace(/[:.]/g, '-')
      fs.renameSync(this.filePath, `${this.filePath}.${stamp}.bak`)
    } catch {
      // 原文件既读不动也挪不走时，保留默认值继续运行
    }
    void err
  }
}
