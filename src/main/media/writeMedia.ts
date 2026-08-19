import fs from 'node:fs'
import path from 'node:path'
import type { ScrapedMetadata, Settings } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'
import type { ParsedName } from '../number/parseNumber'
import { DMM_SITE_ID } from './dmmCdn'
import { buildMediaPaths } from './fileNames'
import {
  createBinaryGetter,
  downloadImages,
  fileExists,
  type ProgressCallback
} from './imageDownloader'
import { buildNfoXml } from './nfoWriter'

export interface MediaWriteSummary {
  nfoPath: string | null
  posterPath: string | null
  fanartPath: string | null
  sampleCount: number
  actorCount: number
  skippedNfo: boolean
  notes: string[]
}

export function writeNfoFile(
  nfoPath: string,
  data: ScrapedMetadata,
  posterFile: string | undefined,
  fanartFile: string | undefined,
  actorThumbs?: Map<string, string>
): void {
  const xml = buildNfoXml(data, {
    posterFile,
    fanartFile,
    actorThumbs
  })
  fs.mkdirSync(path.dirname(nfoPath), { recursive: true })
  const tmp = `${nfoPath}.writing`
  fs.writeFileSync(tmp, xml, 'utf8')
  fs.renameSync(tmp, nfoPath)
}

function baseNameOf(p: string | null): string | undefined {
  if (!p) return undefined
  return path.basename(p)
}

const MEDIA_EXTS = ['.jpg', '.jpeg', '.png', '.webp'] as const

// 在 dir 下查找 baseName + suffix + 图片扩展名 的已有文件，返回第一个命中的绝对路径。
// 海报/样张在不同运行中可能因封面格式不同而扩展名有别，不能硬编码 .jpg。
function findExistingMedia(dir: string, baseName: string, suffix: string): string | null {
  for (const ext of MEDIA_EXTS) {
    const candidate = path.join(dir, `${baseName}${suffix}${ext}`)
    if (fileExists(candidate)) return candidate
  }
  return null
}

export async function writeMediaAssets(
  http: Pick<HttpClient, 'getBuffer' | 'getText'>,
  videoFilePath: string,
  data: ScrapedMetadata,
  parsed: ParsedName | null,
  settings: Settings,
  onProgress?: ProgressCallback
): Promise<MediaWriteSummary> {
  const paths = buildMediaPaths(videoFilePath)

  const nfoExists = fileExists(paths.nfoPath)
  if (nfoExists && settings.skipExistingNfo) {
    // NFO 已存在则跳过下载/写入，但仍需把磁盘上已有的海报路径返回给引擎，
    // 否则任务详情的预览会丢失 posterUrl，回退到远程横版封面被 CSS 居中裁切。
    const existingPoster = findExistingMedia(paths.dir, paths.baseName, '-poster')
    const existingFanart = findExistingMedia(paths.dir, paths.baseName, '-fanart')
    return {
      nfoPath: paths.nfoPath,
      posterPath: existingPoster,
      fanartPath: existingFanart,
      sampleCount: 0,
      actorCount: 0,
      skippedNfo: true,
      notes: ['已存在 NFO 且启用跳过，媒体文件未更新']
    }
  }

  const images = await downloadImages(
    createBinaryGetter(http),
    videoFilePath,
    data,
    {
      downloadHdCover: settings.downloadHdCover,
      downloadActorAvatars: settings.downloadActorAvatars,
      actorAvatarPlatform: settings.actorAvatarPlatform,
      downloadSamples: settings.downloadSamples,
      cropMode: settings.cropMode,
      removeWatermark: settings.removeWatermark,
      number: data.number,
      parsed,
      dmmEnabled: settings.enabledSites.includes(DMM_SITE_ID),
      onProgress
    },
    // Infuse 平台需要用 DMM 查远程头像 URL（getText 抓女优列表页）
    settings.actorAvatarPlatform === 'Infuse' ? http : undefined
  )

  let nfoPath: string | null = null
  if (settings.generateNfo) {
    writeNfoFile(
      paths.nfoPath,
      data,
      baseNameOf(images.poster),
      baseNameOf(images.fanart),
      images.actorThumbs
    )
    nfoPath = paths.nfoPath
  }

  return {
    nfoPath,
    posterPath: images.poster,
    fanartPath: images.fanart,
    sampleCount: images.samples.length,
    actorCount: images.actorThumbs.size,
    skippedNfo: false,
    notes: []
  }
}
