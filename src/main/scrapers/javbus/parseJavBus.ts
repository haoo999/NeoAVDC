import type { ScrapedMetadata } from '../../../shared/types'

const TITLE_RE = /<div[^>]+class="container"[^>]*>\s*<h3[^>]*>([\s\S]*?)<\/h3>/i
const BIGIMAGE_HREF_RE = /<a[^>]+class="bigImage"[^>]+href="([^"]+)"/i
const BIGIMAGE_IMG_RE = /<a[^>]+class="bigImage"[^>]*>\s*<img[^>]+src="([^"]+)"/i
const INFO_BLOCK_RE = /<div[^>]+class="col-md-3 info"[^>]*>([\s\S]*?)<\/div>\s*<div/i
const SAMPLE_WRAP_RE = /<div[^>]+id="sample-waterfall"[^>]*>([\s\S]*?)(?:<div[^>]+id=|<\/body>)/i

const FIELD_LABELS: Record<string, RegExp> = {
  code: /識別碼:<\/span>\s*<span[^>]*>\s*([\s\S]*?)\s*<\/span>/i,
  releaseDate: /發行日期:<\/span>\s*([\s\S]*?)\s*<\/p>/i,
  duration: /長度:<\/span>\s*([\s\S]*?)\s*<\/p>/i,
  director: /導演:<\/span>\s*([\s\S]*?)\s*<\/p>/i,
  maker: /製作商:<\/span>\s*([\s\S]*?)\s*<\/p>/i,
  publisher: /發行商:<\/span>\s*([\s\S]*?)\s*<\/p>/i,
  series: /系列:<\/span>\s*([\s\S]*?)\s*<\/p>/i
}

const AVATAR_BLOCK_RE = /<div[^>]+id="avatar-waterfall"[^>]*>([\s\S]*?)<\/div>\s*<\/div>/i
const ACTOR_BOX_RE = /<a\b(?=[^>]*class="avatar-box")[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/gi
const ACTOR_NAME_RE = /<span[^>]*>([\s\S]*?)<\/span>/i
const ACTOR_IMG_RE = /<img[^>]+src="([^"]+)"/i
const MALE_ACTOR_HREF_RE = /\/male(?:\/|$|\?)/i

const GENRE_RE = /<span[^>]+class="genre"[^>]*>\s*<label[^>]*>(?:(?!<\/label>)[\s\S])*?<a[^>]*>([\s\S]*?)<\/a>\s*<\/label>\s*<\/span>/gi
const SAMPLE_A_RE = /<a\b(?=[^>]*class="sample-box")[^>]*href="([^"]+)"/gi
const A_HREF_RE = /<a[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>/i

const PLACEHOLDER_IMG = /nowprinting/i

export function decodeHtmlEntities(s: string): string {
  return s
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

export function stripTags(s: string): string {
  return decodeHtmlEntities(s.replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, '')).trim()
}

function extractAnchorText(s: string): string {
  const m = s.match(A_HREF_RE)
  return stripTags(m ? m[2] : s)
}

function absUrl(base: string, href: string): string {
  if (/^https?:\/\//i.test(href)) return href
  if (href.startsWith('//')) return new URL(base).protocol + href
  if (href.startsWith('/')) return new URL(base).origin + href
  return base.replace(/\/[^/]*$/, '/') + href
}

function parseDuration(raw: string): number | undefined {
  const m = raw.match(/(\d+)/)
  if (!m) return undefined
  return parseInt(m[1], 10)
}

function cleanReleaseDate(raw: string): string | undefined {
  const date = stripTags(raw).match(/(\d{4}-\d{2}-\d{2})/)
  if (!date || date[1] === '0000-00-00') return undefined
  return date[1]
}

export function isNotFound(html: string): boolean {
  const title = /<title>([\s\S]*?)<\/title>/i.exec(html)
  if (title && /404\s*page\s*not\s*found/i.test(title[1])) return true
  if (/404\s*page\s*not\s*found/i.test(html)) return true
  return false
}

export function parseJavBusDetail(
  html: string,
  baseUrl: string,
  sourceUrl: string,
  uncensoredHint = false
): ScrapedMetadata | null {
  if (isNotFound(html)) return null

  const titleMatch = html.match(TITLE_RE)
  if (!titleMatch) return null

  const infoMatch = html.match(INFO_BLOCK_RE)
  const info = infoMatch ? infoMatch[1] : html

  const title = stripTags(titleMatch[1])

  const field = (re: RegExp): string | undefined => {
    const m = info.match(re)
    if (!m) return undefined
    const text = extractAnchorText(m[1])
    return text.length > 0 ? text : undefined
  }

  const code = field(FIELD_LABELS.code)

  const coverAnchor = html.match(BIGIMAGE_HREF_RE)?.[1]
  const coverImg = html.match(BIGIMAGE_IMG_RE)?.[1]
  const coverHref = coverAnchor ?? coverImg

  const sampleWrap = html.match(SAMPLE_WRAP_RE)?.[1]
  const sampleUrls: string[] = []
  if (sampleWrap) {
    let m: RegExpExecArray | null
    SAMPLE_A_RE.lastIndex = 0
    while ((m = SAMPLE_A_RE.exec(sampleWrap)) !== null) {
      sampleUrls.push(absUrl(baseUrl, m[1]))
    }
  }

  const genres: string[] = []
  let gm: RegExpExecArray | null
  GENRE_RE.lastIndex = 0
  while ((gm = GENRE_RE.exec(info)) !== null) {
    const name = stripTags(gm[1])
    if (name) genres.push(name)
  }

  const avatarBlock = html.match(AVATAR_BLOCK_RE)?.[1] ?? html
  const actors: ScrapedMetadata['actors'] = []
  let am: RegExpExecArray | null
  ACTOR_BOX_RE.lastIndex = 0
  while ((am = ACTOR_BOX_RE.exec(avatarBlock)) !== null) {
    const href = am[1] ?? ''
    if (MALE_ACTOR_HREF_RE.test(href)) continue
    const block = am[2]
    const nameMatch = block.match(ACTOR_NAME_RE)
    if (!nameMatch) continue
    const name = stripTags(nameMatch[1])
    if (!name) continue
    const img = block.match(ACTOR_IMG_RE)?.[1]
    actors.push({
      name,
      ...(img && !PLACEHOLDER_IMG.test(img) ? { avatarUrl: absUrl(baseUrl, img) } : {})
    })
  }

  const genreText = genres.join(' ')
  const infoHasUncensoredPath =
    /href="[^"]*\/uncensored\//i.test(info) || /無碼|无码/i.test(genreText)
  const isUncensored = uncensoredHint || infoHasUncensoredPath

  const result: ScrapedMetadata = {
    number: code ?? '',
    title,
    sampleUrls,
    genres,
    actors,
    isUncensored,
    sourceUrl
  }

  if (coverHref) result.coverUrl = absUrl(baseUrl, coverHref)
  if (coverImg && coverImg !== coverAnchor) result.coverThumbUrl = absUrl(baseUrl, coverImg)
  const releaseDate = field(FIELD_LABELS.releaseDate)
  if (releaseDate) {
    const d = cleanReleaseDate(releaseDate)
    if (d) result.releaseDate = d
  }
  const durationRaw = field(FIELD_LABELS.duration)
  if (durationRaw) {
    const d = parseDuration(durationRaw)
    if (d !== undefined) result.runtimeMin = d
  }
  const director = field(FIELD_LABELS.director)
  if (director) result.director = director
  const maker = field(FIELD_LABELS.maker)
  if (maker) result.maker = maker
  const publisher = field(FIELD_LABELS.publisher)
  if (publisher) result.publisher = publisher
  const series = field(FIELD_LABELS.series)
  if (series) result.series = series

  return result
}

export function extractSearchDetailUrl(
  html: string,
  number: string,
  baseUrl: string
): string | null {
  const itemRe = /<a[^>]+class="movie-box"[^>]+href="([^"]+)"[\s\S]*?<\/a>/gi
  let m: RegExpExecArray | null
  const target = number.toUpperCase().replace(/[^A-Z0-9]/g, '')
  while ((m = itemRe.exec(html)) !== null) {
    const block = m[0]
    const href = m[1]
    const date = block.match(/(\d{4}-\d{2}-\d{2})/)?.[1] ?? ''
    const tail = href.split('?')[0].split('/').pop() ?? ''
    const candidates = [
      tail.toUpperCase().replace(/[^A-Z0-9]/g, ''),
      tail.toUpperCase().replace(/^\d{4}\d{2}\d{2}/, '').replace(/[^A-Z0-9]/g, '')
    ]
    if (date) {
      candidates.push(tail.replace(date, '').replace(/-/g, '').toUpperCase())
    }
    const idText = block.match(/<date[^>]*>([\s\S]*?)<\/date>/i)?.[1]
    if (idText) {
      candidates.push(stripTags(idText).toUpperCase().replace(/[^A-Z0-9]/g, ''))
    }
    if (candidates.includes(target)) {
      return absUrl(baseUrl, href)
    }
  }
  return null
}

export function buildJavBusUrl(number: string, uncensored: boolean): string {
  const base = uncensored ? 'https://www.javbus.com/uncensored' : 'https://www.javbus.com'
  return `${base}/${encodeURIComponent(number)}`
}

export function buildJavBusSearchUrl(number: string, uncensored: boolean): string {
  const base = uncensored ? 'https://www.javbus.com/uncensored' : 'https://www.javbus.com'
  return `${base}/search/${encodeURIComponent(number)}&type=1`
}
