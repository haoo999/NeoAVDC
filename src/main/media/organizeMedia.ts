import fs from 'node:fs'
import path from 'node:path'
import type { FolderNamingMode, ScrapedMetadata } from '../../shared/types'
import { isSubtitleFile } from '../number/parseNumber'
import {
  buildFolderName,
  isFlattenedActorFile,
  isInsideOrganizedFolder
} from './fileNames'

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

function moveDirContents(srcDir: string, destDir: string, movedSidecars: string[]): void {
  if (!fs.existsSync(srcDir)) return
  fs.mkdirSync(destDir, { recursive: true })
  for (const f of fs.readdirSync(srcDir)) {
    const s = path.join(srcDir, f)
    const d = path.join(destDir, f)
    let stat: fs.Stats
    try {
      stat = fs.statSync(s)
    } catch {
      continue
    }
    if (stat.isFile()) {
      if (!fs.existsSync(d)) {
        safeMoveOver(s, d)
        movedSidecars.push(d)
      }
    }
  }
  // 删除已搬空的源目录（非空则保留，避免误删）
  try {
    fs.rmdirSync(srcDir)
  } catch {
    // 非空或无权限，保留
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
  const originalBase = path.basename(filePath, path.extname(filePath))
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

  const ext = path.extname(filePath)
  const targetVideoPath = alreadyOrganized
    ? filePath
    : path.join(effectiveFolder, `${number}${ext}`)
  const targetBase = `${number}`

  let moved = false
  if (path.resolve(filePath) !== path.resolve(targetVideoPath)) {
    if (!fs.existsSync(targetVideoPath)) {
      safeMoveOver(filePath, targetVideoPath)
      moved = true
    } else {
      throw new Error(`目标已存在同名文件：${targetVideoPath}`)
    }
  }

  const movedSidecars: string[] = []

  if (moved && !alreadyOrganized) {
    // 字幕跟随：从「视频原所在目录」搬入收纳目录
    if (followSubtitles) {
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

    // NFO / 海报 / fanart / 单张 thumb：视频被改名成番号，这些 sidecar 同步改名
    const all = fs.readdirSync(originalDir)
    for (const f of all) {
      const src = path.join(originalDir, f)
      let stat: fs.Stats
      try {
        stat = fs.statSync(src)
      } catch {
        continue
      }
      if (!stat.isFile()) continue
      if (isSubtitleFile(f) && f.startsWith(path.basename(filePath, ext))) continue

      const parsed = path.parse(f)
      const lowerExt = parsed.ext.toLowerCase()
      const isImage = ['.jpg', '.jpeg', '.png', '.webp'].includes(lowerExt)
      const isNfo = lowerExt === '.nfo'

      let dstName: string | null = null
      if (parsed.name === originalBase && (isNfo || isImage)) {
        dstName = `${targetBase}${parsed.ext}`
      } else if (
        (parsed.name === `${originalBase}-poster` ||
          parsed.name === `${originalBase}-fanart` ||
          parsed.name === `${originalBase}-thumb`) &&
        isImage
      ) {
        dstName = f.replace(originalBase, targetBase)
      } else if (isFlattenedActorFile(f)) {
        // 演员头像平铺（actor-{name}.ext），文件名不变、位置跟着视频走
        dstName = f
      }

      if (!dstName) continue
      const dst = path.join(effectiveFolder, dstName)
      if (!fs.existsSync(dst) && path.resolve(src) !== path.resolve(dst)) {
        safeMoveOver(src, dst)
        movedSidecars.push(dst)
      }
    }

    // extrafanart 目录：原样搬入目标目录（标准 Kodi/Infuse 命名，不影响识别）
    const extraSrc = path.join(originalDir, 'extrafanart')
    const extraDst = path.join(effectiveFolder, 'extrafanart')
    if (fs.existsSync(extraSrc)) {
      moveDirContents(extraSrc, extraDst, movedSidecars)
    }
    // 兼容历史命名 {base}-extrafanart
    const legacyExtraSrc = path.join(originalDir, `${originalBase}-extrafanart`)
    if (fs.existsSync(legacyExtraSrc)) {
      moveDirContents(legacyExtraSrc, extraDst, movedSidecars)
    }

    // .actors 目录：Kodi/Emby/Jellyfin/Plex 的演员头像，原样搬入目标目录
    const actorsSrc = path.join(originalDir, '.actors')
    const actorsDst = path.join(effectiveFolder, '.actors')
    if (fs.existsSync(actorsSrc)) {
      moveDirContents(actorsSrc, actorsDst, movedSidecars)
    }
  }

  return {
    moved,
    folderPath: effectiveFolder,
    videoPath: targetVideoPath,
    movedSidecars
  }
}
