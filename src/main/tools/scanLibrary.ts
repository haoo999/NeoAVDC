import fs from 'node:fs'
import path from 'node:path'
import type { ActorAvatarPlatform, ScanResult, ScanWork } from '../../shared/types'

const IMAGE_EXTS = ['.jpg', '.jpeg', '.png', '.webp']

function findMediaFile(dir: string, baseName: string, suffix: string): boolean {
  for (const ext of IMAGE_EXTS) {
    const candidate = path.join(dir, `${baseName}${suffix}${ext}`)
    try {
      if (fs.statSync(candidate).isFile()) return true
    } catch {
      // 继续尝试下一个扩展名
    }
  }
  return false
}

// 按目标平台探测演员头像：
// - Kodi/Emby/Jellyfin/Plex：.actors/{纯演员名}.ext
// - Infuse：视频同级平铺 actor-{name}.ext
function findActorAvatar(workDir: string, actorName: string, platform: ActorAvatarPlatform): boolean {
  const sanitized = actorName.replace(/[\\/:*?"<>|]/g, '').replace(/\s+/g, ' ').trim()
  const local = platform !== 'Infuse'
  const stem = local ? sanitized : `actor-${sanitized}`
  if (!stem) return true
  const probeDir = local ? path.join(workDir, '.actors') : workDir
  try {
    for (const file of fs.readdirSync(probeDir)) {
      const parsed = path.parse(file)
      if (parsed.name === stem && IMAGE_EXTS.includes(parsed.ext.toLowerCase())) {
        try {
          if (fs.statSync(path.join(probeDir, file)).isFile()) return true
        } catch {
          // 命中但 stat 失败，视作存在以避免重复下载
          return true
        }
      }
    }
  } catch {
    // 目录读不到，视作无
  }
  return false
}

function extractTag(xml: string, tag: string): string {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'i')
  const m = re.exec(xml)
  if (!m) return ''
  return m[1]
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .trim()
}

function extractAllTags(xml: string, tag: string): string[] {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'gi')
  const out: string[] = []
  let m: RegExpExecArray | null
  while ((m = re.exec(xml)) !== null) {
    const text = m[1]
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&apos;/g, "'")
      .trim()
    if (text) out.push(text)
  }
  return out
}

interface ParsedNfo {
  number: string
  title: string
  actors: string[]
}

function parseNfo(xml: string, nfoPath: string): ParsedNfo {
  const customNumber = extractTag(xml, 'customnumber')
  const number = customNumber || path.basename(nfoPath, '.nfo')
  const title = extractTag(xml, 'title') || extractTag(xml, 'originaltitle') || number
  const actors = extractAllTags(xml, 'actor').map((block) => extractTag(block, 'name')).filter(Boolean)
  return { number, title, actors: Array.from(new Set(actors)) }
}

export function scanLibrary(rootDir: string, platform: ActorAvatarPlatform = 'Kodi'): ScanResult {
  const works: ScanWork[] = []
  let missingPoster = 0
  let missingFanart = 0
  let missingAvatarActors = 0

  function walk(dir: string): void {
    let entries: fs.Dirent[]
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const ent of entries) {
      if (ent.name.startsWith('.') && ent.name !== '.actors') continue
      const full = path.join(dir, ent.name)
      if (ent.isDirectory()) {
        walk(full)
      } else if (ent.isFile() && ent.name.toLowerCase().endsWith('.nfo')) {
        let xml: string
        try {
          xml = fs.readFileSync(full, 'utf8')
        } catch {
          continue
        }
        if (!/<movie[\s>]/i.test(xml)) continue
        const parsed = parseNfo(xml, full)
        const workDir = path.dirname(full)
        const baseName = path.basename(full, '.nfo')
        const hasPoster = findMediaFile(workDir, baseName, '-poster')
        const hasFanart = findMediaFile(workDir, baseName, '-fanart')
        const missingAvatars = parsed.actors.filter((a) => !findActorAvatar(workDir, a, platform))
        if (!hasPoster) missingPoster += 1
        if (!hasFanart) missingFanart += 1
        missingAvatarActors += missingAvatars.length
        works.push({
          nfoPath: full,
          dir: workDir,
          number: parsed.number,
          title: parsed.title,
          actors: parsed.actors,
          hasPoster,
          hasFanart,
          missingAvatars
        })
      }
    }
  }

  walk(rootDir)

  return {
    rootDir,
    totalWorks: works.length,
    missingPoster,
    missingFanart,
    missingAvatarActors,
    works
  }
}
