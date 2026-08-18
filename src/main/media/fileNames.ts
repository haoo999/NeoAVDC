import path from 'node:path'

const INVALID_CHARS_RE = /[\\/:*?"<>|\u0000-\u001f]/g

export function sanitizeFileName(name: string): string {
  return name.replace(INVALID_CHARS_RE, '').replace(/\s+/g, ' ').trim()
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
