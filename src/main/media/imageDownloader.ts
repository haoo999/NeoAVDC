import fs from 'node:fs'
import path from 'node:path'
import type { CropMode, ScrapedMetadata } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'
import {
  actorThumbPath,
  buildMediaPaths,
  extraThumbPath,
  fanartPath,
  inferExtension,
  posterPath
} from './fileNames'
import { processPoster, removeWatermark } from './imageProcessor'

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
  preferHd: boolean
): Promise<{ buffer: Buffer; ext: string } | null> {
  const primary = preferHd ? data.coverUrl : data.coverThumbUrl ?? data.coverUrl
  const fallback = preferHd ? data.coverThumbUrl : undefined
  const first = primary ? await downloadBuffer(getBinary, primary, referer) : null
  if (first) return first
  if (fallback && fallback !== primary) {
    return await downloadBuffer(getBinary, fallback, referer)
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

  report({ stage: 'cover', index: 1, total: 2 })
  const cover = await downloadCover(getBinary, data, referer, options.downloadHdCover)
  if (cover) {
    const ext = chooseExtension(cover.buffer, inferExtension(data.coverUrl ?? ''))
    const poster = posterPath(paths.dir, paths.baseName, ext)
    const fanart = fanartPath(paths.dir, paths.baseName, ext)

    report({ stage: 'cover', index: 2, total: 2 })
    const processed = await processPoster({
      buffer: cover.buffer,
      crop: options.cropMode,
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
    for (let i = 0; i < data.sampleUrls.length; i++) {
      const url = data.sampleUrls[i]
      report({ stage: 'sample', index: i + 1, total: data.sampleUrls.length })
      const sample = await downloadBuffer(getBinary, url, referer)
      if (!sample) continue
      const buffer = options.removeWatermark ? await removeWatermark(sample.buffer) : sample.buffer
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
  }

  if (options.downloadActorAvatars) {
    let idx = 0
    const total = data.actors.filter((a) => a.avatarUrl).length
    for (const actor of data.actors) {
      if (!actor.avatarUrl) continue
      idx += 1
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
