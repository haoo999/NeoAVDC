import fs from 'node:fs'
import path from 'node:path'
import type { CropMode, ScrapedMetadata } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'
import type { ParsedName } from '../number/parseNumber'
import {
  actorThumbPath,
  buildMediaPaths,
  extraThumbPath,
  fanartPath,
  inferExtension,
  posterPath
} from './fileNames'
import { processPoster, removeWatermark } from './imageProcessor'
import { DMM_REFERER, dmmCoverUrls, dmmSampleGroups } from './dmmCdn'

export type DownloadStage = 'cover' | 'sample' | 'actor'

export interface DownloadProgress {
  stage: DownloadStage
  index: number
  total: number
  label?: string
  // 该阶段是否已结束（true 时 engine 可立即把活动行提交为最终日志）
  done?: boolean
  // 该阶段实际成功下载的数量（done:true 时有效）
  count?: number
}

export type ProgressCallback = (progress: DownloadProgress) => void

export interface ImageDownloadOptions {
  downloadHdCover: boolean
  downloadActorAvatars: boolean
  downloadSamples: boolean
  cropMode: CropMode
  removeWatermark: boolean
  // 用于拼 DMM CDN 回退 URL；手动改番号时 parsed 为 null，仍可由 number 兜底
  number: string
  parsed: ParsedName | null
  // DMM 是否作为勾选数据源启用（决定是否用其 CDN 兜底图片）
  dmmEnabled: boolean
  onProgress?: ProgressCallback
}

export interface ImageDownloadResult {
  poster: string | null
  fanart: string | null
  samples: string[]
  actors: string[]
}

export type BinaryGetter = (
  url: string,
  referer: string
) => Promise<{ buffer: Buffer; ext: string }>

function writeFileSafe(targetPath: string, buffer: Buffer): void {
  fs.mkdirSync(path.dirname(targetPath), { recursive: true })
  const tmp = `${targetPath}.download`
  fs.writeFileSync(tmp, buffer)
  fs.renameSync(tmp, targetPath)
}

export function fileExists(targetPath: string): boolean {
  try {
    return fs.statSync(targetPath).isFile()
  } catch {
    return false
  }
}

const ACTOR_AVATAR_EXTS = ['.jpg', '.jpeg', '.png', '.webp', '.gif']

function findExistingActorAvatar(actorsDir: string, actorName: string): string | null {
  // 头像扩展名在下载前未知（由响应魔术字节判定），
  // 因此按演员名依次探测常见扩展名，命中任意一个即视为已下载，直接复用。
  const safe = path.basename(actorThumbPath(actorsDir, actorName, ''))
  try {
    for (const file of fs.readdirSync(actorsDir)) {
      const parsed = path.parse(file)
      if (
        parsed.name === safe &&
        ACTOR_AVATAR_EXTS.includes(parsed.ext.toLowerCase()) &&
        fs.statSync(path.join(actorsDir, file)).isFile()
      ) {
        return path.join(actorsDir, file)
      }
    }
  } catch {
    // actors 目录尚不存在，等同于没有已存头像
  }
  return null
}

export function detectMime(buffer: Buffer): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return 'image/jpeg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47 &&
    buffer[4] === 0x0d &&
    buffer[5] === 0x0a &&
    buffer[6] === 0x1a &&
    buffer[7] === 0x0a
  ) {
    return 'image/png'
  }
  if (buffer.length >= 6 && buffer.slice(0, 6).toString('ascii') === 'GIF87a') return 'image/gif'
  if (buffer.length >= 6 && buffer.slice(0, 6).toString('ascii') === 'GIF89a') return 'image/gif'
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer[8] === 0x57 &&
    buffer[9] === 0x45 &&
    buffer[10] === 0x42 &&
    buffer[11] === 0x50
  ) {
    return 'image/webp'
  }
  return 'application/octet-stream'
}

export function chooseExtension(buffer: Buffer, fallback = '.jpg'): string {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return '.jpg'
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return '.png'
  }
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 &&
    buffer[1] === 0x49 &&
    buffer[2] === 0x46 &&
    buffer[3] === 0x46 &&
    buffer.toString('ascii', 8, 12) === 'WEBP'
  ) {
    return '.webp'
  }
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF87a') {
    return '.gif'
  }
  if (buffer.length >= 6 && buffer.toString('ascii', 0, 6) === 'GIF89a') {
    return '.gif'
  }
  return fallback
}

async function downloadBuffer(
  getBinary: BinaryGetter,
  url: string,
  referer: string
): Promise<{ buffer: Buffer; ext: string } | null> {
  try {
    return await getBinary(url, referer)
  } catch {
    return null
  }
}

async function downloadCover(
  getBinary: BinaryGetter,
  data: ScrapedMetadata,
  referer: string,
  preferHd: boolean,
  dmmFallback: string[]
): Promise<{ buffer: Buffer; ext: string } | null> {
  const primary = preferHd ? data.coverUrl : data.coverThumbUrl ?? data.coverUrl
  const fallback = preferHd ? data.coverThumbUrl : undefined
  const first = primary ? await downloadBuffer(getBinary, primary, referer) : null
  if (first) return first
  if (fallback && fallback !== primary) {
    const second = await downloadBuffer(getBinary, fallback, referer)
    if (second) return second
  }
  // 元数据源封面失败时，回退到 DMM 图片 CDN（仅在 DMM 被勾选时）
  for (const url of dmmFallback) {
    const hit = await downloadBuffer(getBinary, url, DMM_REFERER)
    if (hit) return hit
  }
  return null
}

export async function downloadImages(
  getBinary: BinaryGetter,
  videoFilePath: string,
  data: ScrapedMetadata,
  options: ImageDownloadOptions
): Promise<ImageDownloadResult> {
  const paths = buildMediaPaths(videoFilePath)
  const referer = new URL(data.sourceUrl).origin + '/'
  const result: ImageDownloadResult = { poster: null, fanart: null, samples: [], actors: [] }
  const report = (progress: DownloadProgress): void => options.onProgress?.(progress)

  // DMM CDN 只在被勾选时作为图片兜底；它只对有码字母数字番号有意义
  const useDmm = options.dmmEnabled
  const dmmCoverFallback = useDmm ? dmmCoverUrls(options.number, options.parsed) : []
  const dmmSamples = useDmm ? dmmSampleGroups(options.number, options.parsed) : []

  report({ stage: 'cover', index: 1, total: 2 })
  const cover = await downloadCover(
    getBinary,
    data,
    referer,
    options.downloadHdCover,
    dmmCoverFallback
  )
  if (cover) {
    const ext = chooseExtension(cover.buffer, inferExtension(data.coverUrl ?? ''))
    const poster = posterPath(paths.dir, paths.baseName, ext)
    const fanart = fanartPath(paths.dir, paths.baseName, ext)

    report({ stage: 'cover', index: 2, total: 2 })
    // Heyzo / FC2 / 欧美片的 fanart 不是 DMM 式光盘外包扫描件，本身就是横版成品封面，
    // 强制使用 'full'（不裁切）；其他有码源沿用用户设置的 cropMode。
    // 注意：'full' 仅跳过裁切，EXIF 旋转与去水印仍会执行。
    const crop = data.posterNoCrop ? 'full' : options.cropMode
    const processed = await processPoster({
      buffer: cover.buffer,
      crop,
      removeWatermark: options.removeWatermark
    })
    writeFileSafe(poster, processed.buffer)
    writeFileSafe(fanart, cover.buffer)
    result.poster = poster
    result.fanart = fanart
  }
  report({
    stage: 'cover',
    index: 2,
    total: 2,
    done: true,
    count: result.poster ? 1 : 0
  })

  if (options.downloadSamples) {
    if (data.sampleUrls.length > 0) {
      for (let i = 0; i < data.sampleUrls.length; i++) {
        const url = data.sampleUrls[i]
        report({ stage: 'sample', index: i + 1, total: data.sampleUrls.length })
        const sample = await downloadBuffer(getBinary, url, referer)
        if (!sample) continue
        const buffer = options.removeWatermark
          ? await removeWatermark(sample.buffer)
          : sample.buffer
        const ext = chooseExtension(buffer, inferExtension(url))
        const target = extraThumbPath(paths.extraThumbsDir, i, ext)
        writeFileSafe(target, buffer)
        result.samples.push(target)
      }
      report({
        stage: 'sample',
        index: data.sampleUrls.length,
        total: data.sampleUrls.length,
        done: true,
        count: result.samples.length
      })
    } else if (dmmSamples.length > 0) {
      // 元数据源未提供样张时，用 DMM CDN 兜底：按 cid 候选顺序探测，
      // 命中一个 cid 后顺序拉取，首张 404 即停止该 cid（样张编号从 1 连续）。
      let idx = 0
      for (const group of dmmSamples) {
        let any = false
        for (const url of group) {
          idx += 1
          report({ stage: 'sample', index: idx, total: dmmSamples.length * group.length })
          const sample = await downloadBuffer(getBinary, url, DMM_REFERER)
          if (!sample) {
            if (any) break
            continue
          }
          any = true
          const buffer = options.removeWatermark
            ? await removeWatermark(sample.buffer)
            : sample.buffer
          const ext = chooseExtension(buffer, inferExtension(url))
          const target = extraThumbPath(paths.extraThumbsDir, result.samples.length, ext)
          writeFileSafe(target, buffer)
          result.samples.push(target)
        }
        if (any) break
      }
      report({
        stage: 'sample',
        index: idx,
        total: idx,
        done: true,
        count: result.samples.length
      })
    } else {
      report({ stage: 'sample', index: 0, total: 0, done: true, count: 0 })
    }
  }

  if (options.downloadActorAvatars) {
    let idx = 0
    const total = data.actors.filter((a) => a.avatarUrl).length
    for (const actor of data.actors) {
      if (!actor.avatarUrl) continue
      idx += 1
      // 已存在同名头像（任意常见扩展名）则直接复用，避免重复下载覆盖
      const existing = findExistingActorAvatar(paths.actorsDir, actor.name)
      if (existing) {
        report({ stage: 'actor', index: idx, total, label: actor.name })
        result.actors.push(existing)
        continue
      }
      report({ stage: 'actor', index: idx, total, label: actor.name })
      const img = await downloadBuffer(getBinary, actor.avatarUrl, referer)
      if (!img) continue
      const ext = chooseExtension(img.buffer, inferExtension(actor.avatarUrl))
      const target = actorThumbPath(paths.actorsDir, actor.name, ext)
      writeFileSafe(target, img.buffer)
      result.actors.push(target)
    }
    report({
      stage: 'actor',
      index: total,
      total,
      done: true,
      count: result.actors.length
    })
  }

  return result
}

export function createBinaryGetter(http: Pick<HttpClient, 'getBuffer'>): BinaryGetter {
  return async (url: string, referer: string) => {
    const res = await http.getBuffer(url, {
      headers: { referer, accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8' }
    })
    return { buffer: res.buffer, ext: inferExtension(url) }
  }
}
