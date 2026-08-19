import path from 'node:path'
import type {
  ActorAvatarPlatform,
  FolderNamingMode,
  ScrapedMetadata
} from '../../shared/types'

const INVALID_CHARS_RE = /[\\/:*?"<>|\u0000-\u001f]/g

export function sanitizeFileName(name: string): string {
  return name.replace(INVALID_CHARS_RE, '').replace(/\s+/g, ' ').trim()
}

// 标题可能以番号开头（如 "SSIS-001 xxx"），收纳文件夹名不再重复番号
function stripNumberPrefix(title: string, number: string): string {
  const trimmed = title.trim()
  const prefix = `${number} `
  if (trimmed.toUpperCase().startsWith(prefix.toUpperCase())) {
    return trimmed.slice(prefix.length).trim()
  }
  return trimmed
}

export function buildFolderName(
  mode: FolderNamingMode,
  number: string,
  data: Pick<ScrapedMetadata, 'title' | 'actors'>
): string {
  const parts = [number]
  if (mode === 'numberActorTitle' && data.actors.length > 0) {
    const actorNames = data.actors.map((a) => a.name).join('、')
    parts.push(sanitizeFileName(actorNames))
  }
  if (mode === 'numberTitle' || mode === 'numberActorTitle') {
    const rest = stripNumberPrefix(data.title, number)
    if (rest) parts.push(sanitizeFileName(rest))
  }
  return sanitizeFileName(parts.join(' '))
}

// 判断视频是否已位于一个以该番号命名的收纳文件夹内（避免重复套娃建子目录）
export function isInsideOrganizedFolder(videoFilePath: string, number: string): boolean {
  const parent = path.basename(path.dirname(videoFilePath))
  if (!parent) return false
  return parent === number || parent.toUpperCase().startsWith(`${number.toUpperCase()} `)
}

export function inferExtension(url: string, fallback = '.jpg'): string {
  let pathname = url
  const q = pathname.indexOf('?')
  if (q >= 0) pathname = pathname.slice(0, q)
  const h = pathname.indexOf('#')
  if (h >= 0) pathname = pathname.slice(0, h)
  const ext = path.extname(pathname).toLowerCase()
  if (ext === '.jpeg') return '.jpg'
  if (ext === '.jpg' || ext === '.png' || ext === '.webp' || ext === '.gif') return ext
  return fallback
}

// 基于视频文件路径推导出同目录下所有产物路径。
// 收纳前视频可能位于下载/监视目录，收纳后会被 move 到番号子目录；
// 图片/NFO 写入时视频已在目标位置，因此这里直接按视频所在目录推导。
//
// 关于 Infuse 兼容（基于实测）：
//   - 保留 Kodi/Infuse 标准的 extrafanart/ 子目录是安全的，Infuse 仍会把
//     "只有一个视频 + 一个 extrafanart/ 子目录"的文件夹折叠成电影项。
//   - 但是 .actors/ 子目录（隐藏、以点开头）会让 Infuse 把目录识别成
//     "蓝色普通文件夹"，必须点进去才看得到视频，故不再创建；演员头像
//     以 actor-{name}.ext 平铺在视频同级。
export interface MediaPaths {
  dir: string
  baseName: string
  nfoPath: string
  posterPath: string
  fanartPath: string
  extraThumbsDir: string
  actorThumbsDir: string
}

export function buildMediaPaths(videoFilePath: string): MediaPaths {
  const dir = path.dirname(videoFilePath)
  const ext = path.extname(videoFilePath)
  const baseName = path.basename(videoFilePath, ext)
  return {
    dir,
    baseName,
    nfoPath: path.join(dir, `${baseName}.nfo`),
    posterPath: path.join(dir, `${baseName}-poster.jpg`),
    fanartPath: path.join(dir, `${baseName}-fanart.jpg`),
    extraThumbsDir: path.join(dir, 'extrafanart'),
    actorThumbsDir: path.join(dir, '.actors')
  }
}

// 演员头像是否使用 .actors/ 子目录（Kodi/Emby/Jellyfin/Plex 约定）。
// Infuse 不读本地头像且 .actors/ 会破坏其电影项识别，故不使用。
export function usesActorsDir(platform: ActorAvatarPlatform): boolean {
  return platform !== 'Infuse'
}

// 演员头像落盘绝对路径。
// - .actors/ 平台：.actors/{纯演员名}{ext}（Kodi 约定，文件名与 NFO 中相对路径一致）
// - Infuse：理论上不下载本地文件；若强制下载，平铺 actor-{name}{ext} 以免创建隐藏目录
export function actorThumbPath(
  dir: string,
  actorName: string,
  ext: string,
  platform: ActorAvatarPlatform
): string {
  const safe = sanitizeFileName(actorName)
  if (usesActorsDir(platform)) {
    return path.join(dir, '.actors', `${safe}${ext}`)
  }
  return path.join(dir, `actor-${safe}${ext}`)
}

// NFO <actor><thumb> 的取值：
// - .actors/ 平台：写本地相对路径（Kodi/Emby/Jellyfin/Plex 据此读 .actors/）
// - Infuse：写远程 URL（仅 DMM 无防盗链地址能被 Infuse 直接加载）
export function actorThumbRef(
  actorName: string,
  ext: string,
  platform: ActorAvatarPlatform,
  remoteUrl?: string
): string | undefined {
  if (usesActorsDir(platform)) {
    return path.posix.join('.actors', `${sanitizeFileName(actorName)}${ext}`)
  }
  return remoteUrl
}

export function posterPath(dir: string, baseName: string, ext: string): string {
  return path.join(dir, `${baseName}-poster${ext}`)
}

export function fanartPath(dir: string, baseName: string, ext: string): string {
  return path.join(dir, `${baseName}-fanart${ext}`)
}

// 样张：Kodi/Infuse 标准命名 fanart1.jpg、fanart2.jpg ...，统一放进
// extrafanart/ 子目录。该子目录本身不影响 Infuse 识别。
export function extraThumbPath(extraThumbsDir: string, index: number, ext: string): string {
  return path.join(extraThumbsDir, `fanart${index + 1}${ext}`)
}

// 通过文件名判断是否为本工具产生的平铺演员头像 sidecar（Infuse 兼容模式），
// 供收纳流程在"原地收纳"时跟随视频移动使用。
export function isFlattenedActorFile(fileName: string): boolean {
  return fileName.startsWith('actor-') && /\.(jpg|jpeg|png|webp)$/i.test(fileName)
}
