import fs from 'node:fs'
import path from 'node:path'
import type { ScrapedMetadata, Settings } from '../../shared/types'
import type { HttpClient } from '../net/httpClient'
import { buildMediaPaths } from './fileNames'
import { createBinaryGetter, downloadImages, fileExists } from './imageDownloader'
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
  downloadActorAvatars: boolean
): void {
  const xml = buildNfoXml(data, {
    includeLocalActorThumbs: downloadActorAvatars,
    posterFile,
    fanartFile
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

export async function writeMediaAssets(
  http: Pick<HttpClient, 'getBuffer'>,
  videoFilePath: string,
  data: ScrapedMetadata,
  settings: Settings
): Promise<MediaWriteSummary> {
  const paths = buildMediaPaths(videoFilePath)

  const nfoExists = fileExists(paths.nfoPath)
  if (nfoExists && settings.skipExistingNfo) {
    return {
      nfoPath: paths.nfoPath,
      posterPath: null,
      fanartPath: null,
      sampleCount: 0,
      actorCount: 0,
      skippedNfo: true,
      notes: ['已存在 NFO 且启用跳过，媒体文件未更新']
    }
  }

  const images = await downloadImages(createBinaryGetter(http), videoFilePath, data, {
    downloadHdCover: settings.downloadHdCover,
    downloadActorAvatars: settings.downloadActorAvatars,
    downloadSamples: settings.downloadSamples,
    cropMode: settings.cropMode,
    removeWatermark: settings.removeWatermark
  })

  let nfoPath: string | null = null
  if (settings.generateNfo) {
    writeNfoFile(
      paths.nfoPath,
      data,
      baseNameOf(images.poster),
      baseNameOf(images.fanart),
      settings.downloadActorAvatars
    )
    nfoPath = paths.nfoPath
  }

  return {
    nfoPath,
    posterPath: images.poster,
    fanartPath: images.fanart,
    sampleCount: images.samples.length,
    actorCount: images.actors.length,
    skippedNfo: false,
    notes: []
  }
}
