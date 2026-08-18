import type { ScrapedActor, ScrapedMetadata } from '../../../shared/types'

// 标题：真实站点 h3 无 class，形如：
//   <h3>SSIS-001 新人NO.1STYLE 三上悠亜 ... <small>ssis-001 葵つかさ 乙白さやか</small></h3>
// <small> 里是番号+演员列表，不是标题本身，提取时要剔除。
const TITLE_RE = /<h[1-3](?:\s[^>]*)?>([\s\S]*?)<\/h[1-3]>/i
const SMALL_RE = /<small\b[^>]*>[\s\S]*?<\/small>/i

// 详情页首张响应式图片即封面（class 属性顺序可能变化）
const RESPONSIVE_IMG_RE = /<img\b[^>]*class="[^"]*\bimg-responsive\b[^"]*"[^>]*>/i
const IMG_SRC_RE = /src="([^"]+)"/i

// 旧版 wp-post-image 兼容
const POST_IMAGE_RE = /<img\b[^>]*class="[^"]*\bwp-post-image\b[^"]*"[^>]*>/i

// 元数据信息行：<b>ラベル</b>: 値<br>
// 注意 <b 后必须是 > 或空白，避免把 <body> / <blockquote> 误判为 <b>
// 值取到下一个 <b> / <br> / 块级闭合 / 下一段标题为止
const INFO_ROW_RE =
  /<b(?:\s[^>]*)?>([\s\S]*?)<\/b>\s*[:：]?\s*([\s\S]*?)(?=<b(?:\s|>)|<br\s*\/?>|<\/(?:div|p|li|ul|ol|section|article|table)\b|<h\d|$)/gi

// gallery 样张（部分页面有）
const GALLERY_RE = /<div[^>]+class="[^"]*\bgallery\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i
const GALLERY_HREF_RE = /<a\b[^>]*href="([^"]+\.(?:jpe?g|png|webp))[^"]*"/gi

// 演员：<a href="/star/xxx">名字</a>（真实站点演员以链接形式给出）
const STAR_LINK_RE = /<a\b[^>]*href="\/star\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi

// 番号兜底：从标题/URL 里抓 XX-NNN 或 XXNNN
const NUMBER_FALLBACK_RE = /([A-Za-z]{2,8}-?\d{2,8})/

// 日文/中文标签映射
const FIELD_LABELS: Record<string, string[]> = {
  number: ['品番', '番號', '番号', 'AVID', 'avID', 'ID'],
  releaseDate: ['配信開始日', '発売日', '發行日期', '发行日期', '配信日', 'リリース日', '日期', '上架日期'],
  runtimeMin: ['収録時間', '長度', '长度', '時長', '时长', '片長', '片长', '時間'],
  director: ['監督', '導演', '导演'],
  maker: ['メーカー', '製作商', '制作商', '廠商', '厂商', '片商', 'スタジオ'],
  publisher: ['レーベル', '發行商', '发行商'],
  series: ['シリーズ', '系列']
}

function stripTags(html: string): string {
  return html.replace(/<[^>]+>/g, ' ')
}

function cleanText(html: string): string {
  return stripTags(html)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

function parseFields(html: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let m: RegExpExecArray | null
  INFO_ROW_RE.lastIndex = 0
  while ((m = INFO_ROW_RE.exec(html)) !== null) {
    const label = cleanText(m[1]).replace(/[:：]\s*$/, '').trim()
    const value = cleanText(m[2])
    if (label) fields[label] = value
  }
  return fields
}

function pick(fields: Record<string, string>, keys: string[]): string {
  for (const k of keys) {
    const v = fields[k]
    if (v && v.trim()) return v.trim()
  }
  return ''
}

function extractRuntime(value: string): number | undefined {
  if (!value) return undefined
  const m = value.match(/(\d+)/)
  if (!m) return undefined
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function normalizeUrl(url: string, base: string): string {
  if (!url) return ''
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  try {
    return new URL(url, base.endsWith('/') ? base : base + '/').toString()
  } catch {
    return base.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '')
  }
}

function extractFirstResponsiveImage(html: string): string {
  const m = RESPONSIVE_IMG_RE.exec(html) ?? POST_IMAGE_RE.exec(html)
  if (!m) return ''
  const src = IMG_SRC_RE.exec(m[0])
  return src ? src[1] : ''
}

function extractStarLinks(html: string): ScrapedActor[] {
  const actors: ScrapedActor[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  STAR_LINK_RE.lastIndex = 0
  while ((m = STAR_LINK_RE.exec(html)) !== null) {
    const name = cleanText(m[1])
    if (name && !seen.has(name)) {
      seen.add(name)
      actors.push({ name })
    }
  }
  return actors
}

function extractGenres(fields: Record<string, string>, html: string): string[] {
  // Jav321 标签通常以 <a href="/genre/xxx">单标签</a> 形式出现
  const genres: string[] = []
  const seen = new Set<string>()
  const genreLinkRe = /<a\b[^>]*href="\/genre\/[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = genreLinkRe.exec(html)) !== null) {
    const name = cleanText(m[1])
    if (name && !seen.has(name)) {
      seen.add(name)
      genres.push(name)
    }
  }
  if (genres.length) return genres
  // 兜底：从字段文本拆分
  const raw = pick(fields, ['タグ', '標籤', '标签', '類別', '类别', 'TAG', 'Tag', 'tag'])
  if (!raw) return []
  return raw
    .split(/[、,，\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractTitle(html: string): string {
  const m = TITLE_RE.exec(html)
  if (!m) return ''
  // 剔除 <small>番号+演员名</small>
  const inner = m[1].replace(SMALL_RE, ' ')
  return cleanText(inner)
}

export function parseJav321Detail(
  html: string,
  baseUrl: string,
  sourceUrl: string
): ScrapedMetadata | null {
  const title = extractTitle(html)

  const fields = parseFields(html)
  const rawNumber = pick(fields, FIELD_LABELS.number)
  let number = (rawNumber || '').replace(/\s*-\s*/g, '-').trim().toUpperCase()
  if (!number && title) {
    const fb = NUMBER_FALLBACK_RE.exec(title)
    if (fb) number = fb[1].replace(/\s*-\s*/g, '-').toUpperCase()
  }

  if (!title && !number) return null

  const coverSrc = extractFirstResponsiveImage(html)
  const coverUrl = coverSrc ? normalizeUrl(coverSrc, baseUrl) : ''

  const sampleUrls: string[] = []
  const galleryMatch = GALLERY_RE.exec(html)
  if (galleryMatch) {
    let m: RegExpExecArray | null
    GALLERY_HREF_RE.lastIndex = 0
    while ((m = GALLERY_HREF_RE.exec(galleryMatch[1])) !== null) {
      sampleUrls.push(normalizeUrl(m[1], baseUrl))
    }
  }

  // 演员优先从 /star/ 链接提取；兜底用字段文本拆分
  let actors = extractStarLinks(html)
  if (actors.length === 0) {
    const raw = pick(fields, ['出演者', '出演', '主演', '演員', '演员', '明星'])
    if (raw) {
      actors = raw
        .split(/[、,，\s]+/)
        .map((s) => s.trim())
        .filter((s) => s && s !== 'N/A' && s !== '-')
        .map((name) => ({ name }))
    }
  }

  const genres = extractGenres(fields, html)

  return {
    sourceUrl,
    number,
    title: title || number,
    coverUrl,
    coverThumbUrl: undefined,
    sampleUrls,
    actors,
    genres,
    director: pick(fields, FIELD_LABELS.director) || undefined,
    maker: pick(fields, FIELD_LABELS.maker) || undefined,
    publisher: pick(fields, FIELD_LABELS.publisher) || undefined,
    series: pick(fields, FIELD_LABELS.series) || undefined,
    releaseDate: pick(fields, FIELD_LABELS.releaseDate) || undefined,
    runtimeMin: extractRuntime(pick(fields, FIELD_LABELS.runtimeMin)),
    isUncensored: /無碼|无码|uncensored|無修正/i.test(html)
  }
}

export function extractJav321SearchDetailUrl(
  html: string,
  base: string,
  _number: string
): string | null {
  // 搜索结果项（若有）
  const linkRe = /<a\b[^>]*href="(https?:\/\/www\.jav321\.com\/video\/[^"]+)"/gi
  let m: RegExpExecArray | null
  while ((m = linkRe.exec(html)) !== null) {
    return normalizeUrl(m[1], base)
  }
  return null
}

export function buildJav321DirectUrl(number: string): string {
  return `https://www.jav321.com/video/${encodeURIComponent(number)}`
}

export function buildJav321SearchUrl(number: string): string {
  // Jav321 搜索实际是 POST /search 表单（字段 sn），此 URL 仅用于直连兜底
  return `https://www.jav321.com/search/${encodeURIComponent(number)}`
}
