import fs from 'node:fs'
import path from 'node:path'
import type { FolderNamingMode, ScrapedMetadata } from '../../shared/types'
import { isSubtitleFile } from '../number/parseNumber'
import { buildFolderName, isInsideOrganizedFolder } from './fileNames'

export interface OrganizeOptions {
  followSubtitles?: boolean
  /**
   * 统一收纳根目录。提供时番号子文件夹建在此目录下；不提供则就地收纳（视频所在目录）。
   */
  targetRootDir?: string
}

export interface OrganizeResult {
  moved: boolean
  folderPath: string
  videoPath: string
  sidecarDir: string
  movedSidecars: string[]
}

function safeMoveOver(src: string, dest: string): void {
  if (fs.existsSync(dest)) {
    // 目标已存在，且与源不是同一文件 -> 拒绝覆盖，避免吞掉已有资源
    const srcReal = fs.realpathSync(src)
    const destReal = fs.realpathSync(dest)
    if (srcReal !== destReal) {
      throw new Error(`目标已存在同名文件：${dest}`)
    }
    return
  }
  try {
    fs.renameSync(src, dest)
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'EXDEV') {
      // 跨卷：回退拷贝后删除
      fs.copyFileSync(src, dest)
      fs.unlinkSync(src)
    } else {
      throw err
    }
  }
}

export function organizeVideo(
  filePath: string,
  number: string,
  folderNaming: FolderNamingMode,
  meta: Pick<ScrapedMetadata, 'title' | 'actors'>,
  options: OrganizeOptions = {}
): OrganizeResult {
  const followSubtitles = options.followSubtitles ?? false
  const originalDir = path.dirname(filePath)
  const targetRoot = options.targetRootDir
    ? path.resolve(options.targetRootDir)
    : originalDir

  const folderName = buildFolderName(folderNaming, number, meta)
  const folderPath = path.join(targetRoot, folderName)

  // 已在以该番号命名的收纳文件夹内时，不重复搬移、不再套娃，直接复用现有目录
  const alreadyOrganized =
    path.resolve(originalDir) === path.resolve(targetRoot) &&
    isInsideOrganizedFolder(filePath, number)
  const effectiveFolder = alreadyOrganized ? originalDir : folderPath

  if (!fs.existsSync(effectiveFolder)) {
    fs.mkdirSync(effectiveFolder, { recursive: true })
  }

  const sidecarDir = path.join(effectiveFolder, 'extrafanart')

  const ext = path.extname(filePath)
  const targetVideoPath = alreadyOrganized
    ? filePath
    : path.join(effectiveFolder, `${number}${ext}`)

  let moved = false
  if (path.resolve(filePath) !== path.resolve(targetVideoPath)) {
    if (!fs.existsSync(targetVideoPath)) {
      safeMoveOver(filePath, targetVideoPath)
      moved = true
    } else {
      throw new Error(`目标已存在同名文件：${targetVideoPath}`)
    }
  }

  // 字幕跟随：从「视频原所在目录」搬入收纳目录
  const movedSidecars: string[] = []
  if (followSubtitles && moved && !alreadyOrganized) {
    const candidates = fs
      .readdirSync(originalDir)
      .filter((f) => isSubtitleFile(f))
      .filter((f) => f.startsWith(path.basename(filePath, ext)))
    for (const f of candidates) {
      const src = path.join(originalDir, f)
      const dst = path.join(effectiveFolder, f)
      if (!fs.existsSync(dst)) {
        safeMoveOver(src, dst)
        movedSidecars.push(dst)
      }
    }
  }

  return {
    moved,
    folderPath: effectiveFolder,
    videoPath: targetVideoPath,
    sidecarDir,
    movedSidecars
  }
}
