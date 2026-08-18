import path from 'node:path'
import type { FolderNamingMode, ScrapedMetadata } from '../../shared/types'

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

export interface MediaPaths {
  dir: string
  baseName: string
  nfoPath: string
  extraThumbsDir: string
  actorsDir: string
}

export function buildMediaPaths(videoFilePath: string): MediaPaths {
  const dir = path.dirname(videoFilePath)
  const baseName = path.basename(videoFilePath, path.extname(videoFilePath))
  return {
    dir,
    baseName,
    nfoPath: path.join(dir, `${baseName}.nfo`),
    extraThumbsDir: path.join(dir, `${baseName}-extrafanart`),
    actorsDir: path.join(dir, '.actors')
  }
}

export function posterPath(dir: string, baseName: string, ext: string): string {
  return path.join(dir, `${baseName}-poster${ext}`)
}

export function fanartPath(dir: string, baseName: string, ext: string): string {
  return path.join(dir, `${baseName}-fanart${ext}`)
}

export function actorThumbPath(actorsDir: string, actorName: string, ext = '.jpg'): string {
  const safe = sanitizeFileName(actorName) || 'actor'
  return path.join(actorsDir, `${safe}${ext}`)
}

export function extraThumbPath(extraThumbsDir: string, index: number, ext: string): string {
  const padded = String(index + 1).padStart(3, '0')
  return path.join(extraThumbsDir, `thumb${padded}${ext}`)
}
