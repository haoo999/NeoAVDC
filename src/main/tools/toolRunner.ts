import fs from 'node:fs'
import path from 'node:path'
import type { BrowserWindow } from 'electron'
import { EventEmitter } from 'node:events'
import { fileURLToPath } from 'node:url'
import type {
  ActorAvatarPlatform,
  AvatarProgress,
  AvatarSummary,
  CropExportOptions,
  CropInput,
  CropMode,
  CropPreviewResult,
  CropVariant,
  ProbeChannelState,
  ProbeEvent,
  ProbeHit,
  ProbeResult,
  ScanResult
} from '../../shared/types'
import { IPC } from '../../shared/channels'
import { parseNumberFromFileName } from '../number/parseNumber'
import { createHttpClient, createSources } from '../scrapers'
import type { ScrapeContext, ScrapeSource } from '../scrapers'
import type { SettingsStore } from '../store/settingsStore'
import { processPoster } from '../media/imageProcessor'
import { dmmCoverUrls } from '../media/dmmCdn'
import { createBinaryGetter } from '../media/imageDownloader'
import { scanLibrary } from './scanLibrary'
import { actorThumbPath, actorThumbRef, sanitizeFileName, usesActorsDir } from '../media/fileNames'
import { findDmmActressAvatar } from '../media/dmmActress'

const CROP_MODES: CropMode[] = ['right', 'center', 'full']
const PREVIEW_MAX_WIDTH = 480
const PROBE_POSTER_MAX_WIDTH = 480

type ToolsEvent =
  | { type: 'progress'; progress: AvatarProgress }
  | { type: 'done'; summary: AvatarSummary }
  | { type: 'error'; message: string }

export type { CropInput, CropExportOptions }

export class ToolRunner {
  private win: BrowserWindow | null = null
  private readonly settingsStore: SettingsStore
  private readonly probeBus = new EventEmitter()
  private avatarCancel = false

  constructor(settingsStore: SettingsStore) {
    this.settingsStore = settingsStore
  }

  attach(win: BrowserWindow): void {
    this.win = win
    this.probeBus.on('event', (ev: ProbeEvent) => {
      this.win?.webContents.send(IPC.TOOLS_PROBE_EVENT, ev)
    })
  }

  private emitProbe(ev: ProbeEvent): void {
    this.probeBus.emit('event', ev)
  }

  async probe(numberRaw: string): Promise<ProbeResult> {
    const number = numberRaw.trim()
    if (!number) throw new Error('番号不能为空')
    const parsed = parseNumberFromFileName(number)
    const settings = this.settingsStore.getAll()
    const http = createHttpClient({
      proxyUrl: settings.proxyUrl,
      requestIntervalSec: settings.requestIntervalSec
    })
    const sources = this.sortProbeSources(createSources(settings.enabledSites))
    const ctx: ScrapeContext = { http }

    this.emitProbe({
      type: 'start',
      number,
      sources: sources.map((s) => s.id)
    })

    const hits: ProbeHit[] = []
    for (const source of sources) {
      this.emitProbe({
        type: 'channel',
        state: { source: source.id, status: 'querying' }
      })
      const hit = await this.probeSource(source, ctx, number, parsed, settings.cropMode)
      hits.push(hit)
      let state: ProbeChannelState
      if (hit.ok) {
        state = { source: source.id, status: 'hit' }
        this.emitProbe({ type: 'channel', state, hit })
      } else if (hit.message === '未找到') {
        state = { source: source.id, status: 'miss' }
        this.emitProbe({ type: 'channel', state })
      } else {
        state = { source: source.id, status: 'error', error: hit.message }
        this.emitProbe({ type: 'channel', state })
      }
    }

    const result = { number, hits }
    this.emitProbe({ type: 'done', result })
    return result
  }

  private sortProbeSources(sources: ScrapeSource[]): ScrapeSource[] {
    const tail = new Set(['Heyzo', 'FC2'])
    const head = sources.filter((s) => !tail.has(s.id))
    const end = sources.filter((s) => tail.has(s.id))
    return [...head, ...end]
  }

  private async probeSource(
    source: ScrapeSource,
    ctx: ScrapeContext,
    number: string,
    parsed: ReturnType<typeof parseNumberFromFileName>,
    cropMode: CropMode
  ): Promise<ProbeHit> {
    try {
      const outcome = await source.scrape(ctx, number, parsed)
      if (outcome.ok) {
        const d = outcome.data
        const posterDataUrl = await this.renderProbePoster(ctx, d.coverUrl, d.sourceUrl, cropMode, d.posterNoCrop)
        return {
          source: source.id,
          ok: true,
          title: d.title,
          coverUrl: d.coverUrl ?? '',
          posterDataUrl,
          actors: d.actors.map((a) => ({ name: a.name, avatarUrl: a.avatarUrl })),
          releaseDate: d.releaseDate ?? '',
          runtimeMin: d.runtimeMin ?? 0,
          maker: d.maker ?? '',
          series: d.series ?? '',
          genres: [...d.genres],
          sourceUrl: d.sourceUrl
        }
      }
      return {
        source: source.id,
        ok: false,
        title: '',
        coverUrl: '',
        actors: [],
        releaseDate: '',
        runtimeMin: 0,
        maker: '',
        series: '',
        genres: [],
        sourceUrl: '',
        message: outcome.reason === 'not_found' ? '未找到' : outcome.message
      }
    } catch (err) {
      return {
        source: source.id,
        ok: false,
        title: '',
        coverUrl: '',
        actors: [],
        releaseDate: '',
        runtimeMin: 0,
        maker: '',
        series: '',
        genres: [],
        sourceUrl: '',
        message: err instanceof Error ? err.message : String(err)
      }
    }
  }

  private async renderProbePoster(
    ctx: ScrapeContext,
    coverUrl: string | undefined,
    sourceUrl: string,
    cropMode: CropMode,
    noCrop?: boolean
  ): Promise<string | undefined> {
    if (!coverUrl) return undefined
    try {
      // 来源页 referer 作为兜底；createBinaryGetter 内部会按图片 CDN 自适应
      const sourceReferer = sourceUrl ? new URL(sourceUrl).origin + '/' : ''
      const getBinary = createBinaryGetter(ctx.http)
      const { buffer } = await getBinary(coverUrl, sourceReferer)
      const processed = await processPoster({
        buffer,
        crop: noCrop ? 'full' : cropMode,
        removeWatermark: false,
        maxWidth: PROBE_POSTER_MAX_WIDTH
      })
      return `data:${processed.contentType};base64,${processed.buffer.toString('base64')}`
    } catch {
      return undefined
    }
  }

  async cropPreview(input: CropInput): Promise<CropPreviewResult> {
    const { buffer, sourceLabel } = await this.loadFanart(input)
    const variants = await this.renderCropVariants(buffer, input.removeWatermark)
    const first = variants[0]
    return {
      sourceLabel,
      width: first?.width ?? 0,
      height: first?.height ?? 0,
      variants
    }
  }

  async cropExport(options: CropExportOptions, targetPath: string): Promise<{ path: string; bytes: number }> {
    const { buffer } = await this.loadFanart(options)
    const processed = await processPoster({
      buffer,
      crop: options.mode,
      removeWatermark: options.removeWatermark
    })
    fs.mkdirSync(path.dirname(targetPath), { recursive: true })
    fs.writeFileSync(targetPath, processed.buffer)
    return { path: targetPath, bytes: processed.buffer.length }
  }

  private async loadFanart(input: CropInput): Promise<{ buffer: Buffer; sourceLabel: string }> {
    const settings = this.settingsStore.getAll()
    const http = createHttpClient({ proxyUrl: settings.proxyUrl, requestIntervalSec: 0 })
    if (input.fanartPath) {
      const p = input.fanartPath.startsWith('file:')
        ? fileURLToPath(input.fanartPath)
        : input.fanartPath
      const buffer = await fs.promises.readFile(p)
      return { buffer, sourceLabel: path.basename(p) }
    }
    if (input.fanartUrl) {
      const res = await http.getBuffer(input.fanartUrl)
      return { buffer: res.buffer, sourceLabel: input.fanartUrl }
    }
    if (input.number) {
      const number = input.number.trim()
      const parsed = parseNumberFromFileName(number)
      const sources = createSources(settings.enabledSites)
      const ctx: ScrapeContext = { http }
      for (const source of sources) {
        try {
          const outcome = await source.scrape(ctx, number, parsed)
          if (outcome.ok && outcome.data.coverUrl) {
            const sourceReferer = new URL(outcome.data.sourceUrl).origin + '/'
            const getBinary = createBinaryGetter(http)
            const { buffer } = await getBinary(outcome.data.coverUrl, sourceReferer)
            return { buffer, sourceLabel: `${source.id} · ${number}` }
          }
        } catch {
          // 继续尝试下一个数据源
        }
      }
      // 元数据源都失败时，尝试 DMM CDN 直链
      for (const url of dmmCoverUrls(number, parsed)) {
        try {
          const res = await http.getBuffer(url, { headers: { referer: 'https://www.dmm.co.jp/' } })
          return { buffer: res.buffer, sourceLabel: `DMM · ${number}` }
        } catch {
          // 继续尝试下一个候选
        }
      }
      throw new Error(`未能获取番号 ${number} 的封面`)
    }
    throw new Error('请提供番号或封面地址')
  }

  private async renderCropVariants(buffer: Buffer, removeWatermark: boolean): Promise<CropVariant[]> {
    const variants: CropVariant[] = []
    for (const mode of CROP_MODES) {
      const processed = await processPoster({
        buffer,
        crop: mode,
        removeWatermark,
        maxWidth: PREVIEW_MAX_WIDTH
      })
      variants.push({
        mode,
        dataUrl: `data:${processed.contentType};base64,${processed.buffer.toString('base64')}`,
        width: processed.width,
        height: processed.height
      })
    }
    return variants
  }

  scan(rootDir: string): ScanResult {
    return scanLibrary(rootDir)
  }

  async backfillAvatars(rootDir: string, options: { updateNfo: boolean }): Promise<void> {
    this.avatarCancel = false
    const settings = this.settingsStore.getAll()
    const platform = settings.actorAvatarPlatform
    const local = usesActorsDir(platform)

    this.emit({
      type: 'progress',
      progress: { stage: 'scan', current: 0, total: 0, message: '扫描目录…' }
    })

    let scan: ScanResult
    try {
      scan = scanLibrary(rootDir, platform)
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err)
      this.emit({ type: 'error', message })
      return
    }

    const actorWorks = new Map<string, string[]>()
    for (const work of scan.works) {
      for (const actor of work.missingAvatars) {
        const list = actorWorks.get(actor)
        if (list) list.push(work.dir)
        else actorWorks.set(actor, [work.dir])
      }
    }

    const uniqueActors = Array.from(actorWorks.keys())
    const summary: AvatarSummary = {
      scannedWorks: scan.totalWorks,
      uniqueActors: uniqueActors.length,
      downloaded: 0,
      reused: 0,
      failed: [],
      nfoUpdated: 0
    }

    if (uniqueActors.length === 0) {
      this.emit({ type: 'done', summary })
      return
    }

    const http = createHttpClient({
      proxyUrl: settings.proxyUrl,
      requestIntervalSec: settings.requestIntervalSec
    })
    const getBinary = createBinaryGetter(http)

    // 演员名 → NFO <thumb> 引用（本地为 .actors/ 相对路径，Infuse 为 DMM 远程 URL）
    const thumbByActor = new Map<string, string>()

    let done = 0
    for (const actor of uniqueActors) {
      if (this.avatarCancel) {
        this.emit({ type: 'error', message: '已取消' })
        return
      }
      done += 1
      this.emit({
        type: 'progress',
        progress: {
          stage: 'lookup',
          current: done,
          total: uniqueActors.length,
          actor,
          message: `查询演员 ${actor}…`
        }
      })

      if (local) {
        // 本地平台：从通用源拿到防盗链头像 URL，带 Referer 下载到 .actors/
        const avatarUrl = await this.findActorAvatar(http, actor)
        if (!avatarUrl) {
          summary.failed.push(actor)
          continue
        }

        if (this.avatarCancel) {
          this.emit({ type: 'error', message: '已取消' })
          return
        }
        this.emit({
          type: 'progress',
          progress: {
            stage: 'download',
            current: done,
            total: uniqueActors.length,
            actor,
            message: `下载头像 ${actor}…`
          }
        })

        const dirs = actorWorks.get(actor) ?? []
        let savedAny = false
        for (const dir of dirs) {
          const existing = this.findExisting(dir, actor, platform)
          if (existing) {
            summary.reused += 1
            const ext = path.extname(existing) || '.jpg'
            const ref = actorThumbRef(actor, ext, platform)
            if (ref) thumbByActor.set(actor, ref)
            savedAny = true
            continue
          }
          try {
            const img = await getBinary(avatarUrl, '')
            const ext = this.chooseExt(img.buffer, avatarUrl)
            if (usesActorsDir(platform)) {
              fs.mkdirSync(path.join(dir, '.actors'), { recursive: true })
            }
            const target = actorThumbPath(dir, actor, ext, platform)
            const tmp = `${target}.download`
            fs.writeFileSync(tmp, img.buffer)
            fs.renameSync(tmp, target)
            summary.downloaded += 1
            const ref = actorThumbRef(actor, ext, platform)
            if (ref) thumbByActor.set(actor, ref)
            savedAny = true
          } catch {
            // 单个作品目录写入失败时继续下一个
          }
        }
        if (!savedAny) summary.failed.push(actor)
      } else {
        // Infuse：查 DMM 无防盗链远程 URL，不下载本地文件
        const remote = await findDmmActressAvatar(http, actor)
        if (remote) {
          thumbByActor.set(actor, remote)
        } else {
          summary.failed.push(actor)
        }
      }
    }

    if (options.updateNfo) {
      await this.rewriteNfoThumbs(scan, summary, thumbByActor)
    }

    this.emit({ type: 'done', summary })
  }

  cancelAvatars(): void {
    this.avatarCancel = true
  }

  private async findActorAvatar(
    http: ReturnType<typeof createHttpClient>,
    actor: string
  ): Promise<string | null> {
    // 用任一启用的通用源搜索演员头像：抓取搜索页 HTML，按已知演员路径模式提取头像。
    // 这里不复用 ScrapeSource 接口（它以番号为输入），直接在各源的搜索页上做轻量解析。
    const settings = this.settingsStore.getAll()
    const candidates: { url: string; referer: string; parse: (html: string) => string | null }[] = []
    if (settings.enabledSites.includes('JavBus')) {
      const query = encodeURIComponent(actor)
      candidates.push({
        url: `https://www.javbus.com/search/${query}`,
        referer: 'https://www.javbus.com/',
        parse: (html) => this.parseAvatarFromSearch(html, /\/star\/\w+/i)
      })
    }
    if (settings.enabledSites.includes('JavDB')) {
      candidates.push({
        url: `https://javdb.com/search?q=${encodeURIComponent(actor)}`,
        referer: 'https://javdb.com/',
        parse: (html) => this.parseJavDbActorAvatar(html, actor)
      })
    }

    for (const c of candidates) {
      try {
        const res = await http.getText(c.url, { headers: { referer: c.referer } })
        const avatar = c.parse(res.text)
        if (avatar) return avatar
      } catch {
        // 当前源失败，继续下一个
      }
    }
    return null
  }

  private parseAvatarFromSearch(html: string, starPathRe: RegExp): string | null {
    // 选中与 /star/xxx 链接同一张演员卡内的头像：
    // 匹配 <a href=".../star/xxx" ...><img src="...">
    const cardRe = /<a[^>]+href="([^"]*(?:\/star\/[^"]+))"[^>]*>[\s\S]*?<img[^>]+src="([^"]+)"/i
    const m = cardRe.exec(html)
    if (m) {
      const href = m[1] ?? ''
      const src = m[2] ?? ''
      if (starPathRe.test(href) && src) return this.normalizeImgUrl(src)
    }
    // 退化：直接找第一张 star 链接附近的 avatar box
    const boxRe = /<a[^>]+href="[^"]*\/star\/[^"]+"[^>]*>[\s\S]{0,800}?<img[^>]+src="([^"]+)"/i
    const m2 = boxRe.exec(html)
    if (m2 && m2[1]) return this.normalizeImgUrl(m2[1])
    return null
  }

  private parseJavDbActorAvatar(html: string, actor: string): string | null {
    // JavDB 搜索结果里演员卡包含 <img loading="lazy" src="..."> 与演员名文本，
    // 按名字定位到对应卡片，再提取其上方最近的 img src。
    const safeName = sanitizeFileName(actor).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const cardRe = new RegExp(
      `<div[^>]*class="[^"]*item[^"]*"[\\s\\S]{0,1200}?<img[^>]+src="([^"]+)"[\\s\\S]{0,400}?${safeName}`,
      'i'
    )
    const m = cardRe.exec(html)
    if (m && m[1]) return this.normalizeImgUrl(m[1])
    // 退化：任意包含 /actors/ 的缩略图
    const imgRe = /<img[^>]+src="(https?:\/\/[^"]*\/actors\/[^"]+)"/i
    const m2 = imgRe.exec(html)
    if (m2 && m2[1]) return m2[1]
    return null
  }

  private normalizeImgUrl(src: string): string {
    if (src.startsWith('//')) return `https:${src}`
    if (src.startsWith('/')) return ''
    return src
  }

  private chooseExt(buffer: Buffer, url: string): string {
    if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
      return '.jpg'
    }
    if (buffer.length >= 8 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
      return '.png'
    }
    if (buffer.length >= 12 && buffer.toString('ascii', 8, 12) === 'WEBP') {
      return '.webp'
    }
    const q = url.indexOf('?')
    const p = q >= 0 ? url.slice(0, q) : url
    const ext = path.extname(p).toLowerCase()
    if (ext === '.jpeg') return '.jpg'
    if (ext === '.jpg' || ext === '.png' || ext === '.webp' || ext === '.gif') return ext
    return '.jpg'
  }

  private findExisting(
    workDir: string,
    actorName: string,
    platform: ActorAvatarPlatform
  ): string | null {
    const local = platform !== 'Infuse'
    const safe = local ? sanitizeFileName(actorName) : `actor-${sanitizeFileName(actorName)}`
    const probeDir = local ? path.join(workDir, '.actors') : workDir
    try {
      for (const file of fs.readdirSync(probeDir)) {
        const parsed = path.parse(file)
        if (parsed.name === safe) {
          const full = path.join(probeDir, file)
          try {
            if (fs.statSync(full).isFile()) return full
          } catch {
            return full
          }
        }
      }
    } catch {
      // 目录不存在
    }
    return null
  }

  private async rewriteNfoThumbs(
    scan: ScanResult,
    summary: AvatarSummary,
    avatarUrlByActor: Map<string, string>
  ): Promise<void> {
    this.emit({
      type: 'progress',
      progress: { stage: 'writeNfo', current: 0, total: scan.works.length, message: '回写 NFO 头像地址…' }
    })
    let idx = 0
    for (const work of scan.works) {
      idx += 1
      if (this.avatarCancel) return
      try {
        const xml = fs.readFileSync(work.nfoPath, 'utf8')
        const updated = this.injectNfoActorThumbs(xml, avatarUrlByActor)
        if (updated !== xml) {
          const tmp = `${work.nfoPath}.writing`
          fs.writeFileSync(tmp, updated, 'utf8')
          fs.renameSync(tmp, work.nfoPath)
          summary.nfoUpdated += 1
        }
      } catch {
        // 单个 NFO 写入失败时继续
      }
      this.emit({
        type: 'progress',
        progress: {
          stage: 'writeNfo',
          current: idx,
          total: scan.works.length,
          work: path.basename(work.dir)
        }
      })
    }
  }

  private injectNfoActorThumbs(xml: string, avatarUrlByActor: Map<string, string>): string {
    let changed = false
    const updated = xml.replace(/<actor>[\s\S]*?<\/actor>/gi, (block) => {
      const nameM = /<name>([\s\S]*?)<\/name>/i.exec(block)
      if (!nameM) return block
      const rawName = nameM[1]
        .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .trim()
      if (!rawName) return block
      const thumb = avatarUrlByActor.get(rawName)
      if (!thumb) return block
      if (/<thumb>[\s\S]*?<\/thumb>/i.test(block)) {
        const newBlock = block.replace(
          /<thumb>[\s\S]*?<\/thumb>/i,
          `<thumb>${thumb}</thumb>`
        )
        if (newBlock !== block) changed = true
        return newBlock
      }
      changed = true
      return block.replace(/<\/actor>/i, `  <thumb>${thumb}</thumb>\n  </actor>`)
    })
    return changed ? updated : xml
  }

  private emit(ev: ToolsEvent): void {
    if (ev.type === 'progress') {
      this.win?.webContents.send(IPC.TOOLS_EVENT, { type: 'progress', progress: ev.progress })
    } else if (ev.type === 'done') {
      this.win?.webContents.send(IPC.TOOLS_EVENT, { type: 'done', summary: ev.summary })
    } else {
      this.win?.webContents.send(IPC.TOOLS_EVENT, { type: 'error', message: ev.message })
    }
  }
}
