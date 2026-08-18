import fs from 'node:fs'
import path from 'node:path'
import type { FolderNamingMode, ScrapedMetadata } from '../../shared/types'
import { buildFolderName, isInsideOrganizedFolder } from './fileNames'

const SUBTITLE_EXTS = new Set(['.srt', '.ass', '.ssa', '.vtt', '.sub', '.sup', '.lrc'])

export interface OrganizeResult {
  videoPath: string
  folderPath: string
  moved: boolean
  movedSidecars: string[]
}

interface OrganizeOptions {
  followSubtitles?: boolean
}

// 原地收纳：在视频所在目录下建立以番号命名的子文件夹，并把视频（及同名外挂字幕）移入。
// 已位于收纳文件夹内时直接返回原路径（不套娃）；目标已存在同名视频时抛错以避免覆盖。
export function organizeVideo(
  videoFilePath: string,
  number: string,
  mode: FolderNamingMode,
  data: Pick<ScrapedMetadata, 'title' | 'actors'>,
  options: OrganizeOptions = {}
): OrganizeResult {
  if (isInsideOrganizedFolder(videoFilePath, number)) {
    return {
      videoPath: videoFilePath,
      folderPath: path.dirname(videoFilePath),
      moved: false,
      movedSidecars: []
    }
  }

  const parentDir = path.dirname(videoFilePath)
  const folderName = buildFolderName(mode, number, data)
  const folderPath = path.join(parentDir, folderName)
  fs.mkdirSync(folderPath, { recursive: true })

  const fileName = path.basename(videoFilePath)
  const destPath = path.join(folderPath, fileName)

  if (fs.existsSync(destPath)) {
    throw new Error(`收纳目标已存在同名文件：${destPath}`)
  }

  moveFile(videoFilePath, destPath)

  const movedSidecars: string[] = []
  if (options.followSubtitles) {
    const baseName = path.basename(videoFilePath, path.extname(videoFilePath))
    for (const sidecar of findSidecars(parentDir, baseName)) {
      const sidecarDest = path.join(folderPath, path.basename(sidecar))
      if (!fs.existsSync(sidecarDest)) {
        moveFile(sidecar, sidecarDest)
        movedSidecars.push(sidecarDest)
      }
    }
  }

  return { videoPath: destPath, folderPath, moved: true, movedSidecars }
}

function findSidecars(dir: string, baseName: string): string[] {
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return []
  }
  const result: string[] = []
  for (const ent of entries) {
    if (!ent.isFile()) continue
    const ext = path.extname(ent.name).toLowerCase()
    if (!SUBTITLE_EXTS.has(ext)) continue
    const sidecarBase = path.basename(ent.name, ext)
    // 匹配 foo.srt 与 foo.zh.srt 这类语言后缀
    if (sidecarBase === baseName || sidecarBase.startsWith(`${baseName}.`)) {
      result.push(path.join(dir, ent.name))
    }
  }
  return result
}

function moveFile(src: string, dest: string): void {
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    // EXDEV：跨设备/跨卷不能 rename，退化为复制后删除原文件
    if (isCrossDevice(err)) {
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    } else {
      throw err
    }
  }
}

function isCrossDevice(err: unknown): boolean {
  return typeof err === 'object' && err !== null && 'code' in err && err.code === 'EXDEV'
}
