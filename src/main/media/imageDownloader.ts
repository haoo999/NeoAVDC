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

export interface ImageDownloadOptions {
  downloadHdCover: boolean
  downloadActorAvatars: boolean
  downloadSamples: boolean
  cropMode: CropMode
  removeWatermark: boolean
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

  const cover = await downloadCover(getBinary, data, referer, options.downloadHdCover)
  if (cover) {
    const ext = chooseExtension(cover.buffer, inferExtension(data.coverUrl ?? ''))
    const poster = posterPath(paths.dir, paths.baseName, ext)
    const fanart = fanartPath(paths.dir, paths.baseName, ext)

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

  if (options.downloadSamples) {
    for (let i = 0; i < data.sampleUrls.length; i++) {
      const url = data.sampleUrls[i]
      const sample = await downloadBuffer(getBinary, url, referer)
      if (!sample) continue
      const buffer = options.removeWatermark ? await removeWatermark(sample.buffer) : sample.buffer
      const ext = chooseExtension(buffer, inferExtension(url))
      const target = extraThumbPath(paths.extraThumbsDir, i, ext)
      writeFileSafe(target, buffer)
      result.samples.push(target)
    }
  }

  if (options.downloadActorAvatars) {
    for (const actor of data.actors) {
      if (!actor.avatarUrl) continue
      const img = await downloadBuffer(getBinary, actor.avatarUrl, referer)
      if (!img) continue
      const ext = chooseExtension(img.buffer, inferExtension(actor.avatarUrl))
      const target = actorThumbPath(paths.actorsDir, actor.name, ext)
      writeFileSafe(target, img.buffer)
      result.actors.push(target)
    }
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
