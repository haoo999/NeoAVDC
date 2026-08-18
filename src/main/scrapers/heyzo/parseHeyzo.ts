import type { ParsedName } from '../../number/parseNumber'
import type { ScrapedActor, ScrapedMetadata } from '../../../shared/types'

const HEYZO_HOST = 'https://www.heyzo.com'
const HEYZO_CONTENT_HOST = 'https://www.heyzo.com'

const JSON_LD_RE = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/i

// Heyzo 番号格式：HEYZO-1234 / heyzo_1234 / heyzo 1234
const HEYZO_ID_RE = /heyzo[_\- ]?0*(\d{1,8})/i

// 兜底字段提取（JSON-LD 缺失时使用）
const TITLE_RE = /<h1[^>]*>([\s\S]*?)<\/h1>/i
const ACTOR_LINK_RE = /<a[^>]+href=["']\/listpages\/actor_(\d+)_[^"']*["'][^>]*>\s*(?:<span>)?([\s\S]*?)(?:<\/span>)?<\/a>/gi
const TAG_LINK_RE = /<ul[^>]+class=["'][^"']*tag-keyword-list[^"']*["'][^>]*>([\s\S]*?)<\/ul>/i
const TAG_ITEM_RE = /<a[^>]*>([\s\S]*?)<\/a>/gi
const RELEASE_TD_RE = /公開日[\s\S]*?<td[^>]*>([\s\S]*?)<\/td>/i
const MEMO_RE = /<p[^>]+class=["']memo["'][^>]*>([\s\S]*?)<\/p>/i

export function buildHeyzoUrl(number: string): string {
  const id = extractHeyzoId(number)
  if (!id) return ''
  return `${HEYZO_HOST}/moviepages/${id}/index.html`
}

export function buildHeyzoCoverUrl(number: string): string {
  const id = extractHeyzoId(number)
  if (!id) return ''
  return `${HEYZO_CONTENT_HOST}/contents/3000/${id}/images/player_thumbnail.jpg`
}

export function buildHeyzoSampleUrls(number: string): string[] {
  const id = extractHeyzoId(number)
  if (!id) return []
  // capture1..capture11 共 11 张样张
  return Array.from({ length: 11 }, (_, i) =>
    `${HEYZO_CONTENT_HOST}/contents/3000/${id}/images/capture${i + 1}.jpg`
  )
}

export function extractHeyzoId(number: string): string {
  const m = number.match(HEYZO_ID_RE)
  if (m) return m[1]
  // 纯数字也接受（例如从文件名解析出的尾号）
  if (/^\d{3,8}$/.test(number)) return number
  return ''
}

// 将 Heyzo 时长（PT1H1M24S / PT25M / PT1H）解析为分钟
function parseIsoDuration(duration: string): number | null {
  if (!duration) return null
  const m = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/i)
  if (!m) return null
  const h = parseInt(m[1] ?? '0', 10)
  const min = parseInt(m[2] ?? '0', 10)
  return h * 60 + min
}

function cleanText(s: string): string {
  return s
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .trim()
}

function parseJsonLd(html: string): {
  title?: string
  cover?: string
  actorName?: string
  actorImage?: string
  description?: string
  duration?: string
  dateCreated?: string
} {
  const m = html.match(JSON_LD_RE)
  if (!m) return {}
  try {
    const json = JSON.parse(m[1]) as Record<string, unknown>
    const actor = json.actor as { name?: string; image?: string } | undefined
    return {
      title: typeof json.name === 'string' ? json.name : undefined,
      cover: typeof json.image === 'string' ? json.image : undefined,
      actorName: actor?.name,
      actorImage: actor?.image,
      description: typeof json.description === 'string' ? json.description : undefined,
      duration: typeof json.duration === 'string' ? json.duration : undefined,
      dateCreated: typeof json.dateCreated === 'string' ? json.dateCreated : undefined
    }
  } catch {
    return {}
  }
}

function normalizeProtocol(url: string): string {
  if (!url) return ''
  if (url.startsWith('//')) return `https:${url}`
  return url
}

export function parseHeyzoDetail(
  html: string,
  sourceUrl: string,
  number: string
): ScrapedMetadata | null {
  if (!html || html.length === 0) return null

  const jsonld = parseJsonLd(html)

  // 标题：优先 JSON-LD，兜底 <h1>
  let title = jsonld.title?.trim() ?? ''
  if (!title) {
    const tm = html.match(TITLE_RE)
    if (tm) title = cleanText(tm[1])
  }
  if (!title) return null

  // 封面：优先 og:image / JSON-LD，否则走确定性路径
  let cover = normalizeProtocol(jsonld.cover ?? '')
  if (!cover) {
    cover = buildHeyzoCoverUrl(number)
  }

  // 演员：JSON-LD 给出演员名，再从页面抓 actorId 生成头像
  const actors: ScrapedActor[] = []
  let actorMatches: RegExpExecArray | null
  ACTOR_LINK_RE.lastIndex = 0
  while ((actorMatches = ACTOR_LINK_RE.exec(html)) !== null) {
    const id = actorMatches[1]
    const name = cleanText(actorMatches[2])
    if (name && !actors.some((a) => a.name === name)) {
      actors.push({
        name,
        avatarUrl: `https://www.heyzo.com/contents/3000/actor/${id}.jpg`
      })
    }
  }
  if (actors.length === 0 && jsonld.actorName) {
    actors.push({ name: jsonld.actorName.trim() })
  }

  // 标签
  const genres: string[] = []
  const tagBlockMatch = html.match(TAG_LINK_RE)
  if (tagBlockMatch) {
    let item: RegExpExecArray | null
    TAG_ITEM_RE.lastIndex = 0
    while ((item = TAG_ITEM_RE.exec(tagBlockMatch[1])) !== null) {
      const t = cleanText(item[1])
      if (t && !genres.includes(t)) genres.push(t)
    }
  }

  // 发行日期：JSON-LD dateCreated，兜底表格「公開日」
  let releaseDate = jsonld.dateCreated?.trim() ?? ''
  if (!releaseDate) {
    const rm = html.match(RELEASE_TD_RE)
    if (rm) releaseDate = cleanText(rm[1]).replace(/\//g, '-')
  }
  if (releaseDate && !/^\d{4}-\d{2}-\d{2}$/.test(releaseDate)) {
    const dm = releaseDate.match(/(\d{4})[\/-](\d{1,2})[\/-](\d{1,2})/)
    if (dm) {
      releaseDate = `${dm[1]}-${dm[2].padStart(2, '0')}-${dm[3].padStart(2, '0')}`
    }
  }

  // 时长
  const runtimeMin = parseIsoDuration(jsonld.duration ?? '') ?? undefined

  // 简介
  let outline = jsonld.description?.trim()
  if (!outline) {
    const mm = html.match(MEMO_RE)
    if (mm) outline = cleanText(mm[1])
  }

  // 样张
  const sampleUrls = buildHeyzoSampleUrls(number)

  const id = extractHeyzoId(number)
  const normalizedNumber = id ? `HEYZO-${id}` : number

  return {
    sourceUrl,
    number: normalizedNumber,
    title,
    coverUrl: cover,
    sampleUrls,
    actors,
    genres,
    director: '',
    maker: 'HEYZO',
    publisher: 'HEYZO',
    series: '',
    outline,
    releaseDate: releaseDate || undefined,
    runtimeMin,
    isUncensored: true,
    posterNoCrop: true
  }
}

export function isHeyzoNumber(parsed: ParsedName | null, number: string): boolean {
  void parsed
  return HEYZO_ID_RE.test(number)
}
