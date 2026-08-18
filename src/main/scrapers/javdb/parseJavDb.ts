import type { ScrapedActor, ScrapedMetadata } from '../../../shared/types'

// 标题：<h2 class="title is-4"><strong>番号</strong><strong class="current-title">中文译名</strong>
//   <span class="origin-title" style="display:none">日文原标题</span></h2>
// current-title 是机翻中文，origin-title 是日文原名（默认隐藏）。优先日文原名。
const ORIGIN_TITLE_RE = /<span[^>]+class="[^"]*\borigin-title\b[^"]*"[^>]*>([\s\S]*?)<\/span>/i
const CURRENT_TITLE_RE = /<strong[^>]+class="[^"]*current-title[^"]*"[^>]*>([\s\S]*?)<\/strong>/i
const H2_TITLE_RE = /<h2[^>]+class="[^"]*\btitle\b[^"]*"[^>]*>([\s\S]*?)<\/h2>/i

// 封面：<img src="..." class="video-cover" /> 或 class 在 src 前
// 用两段式提取，避免属性顺序依赖
const COVER_IMAGE_RE = /<img\b[^>]*class="[^"]*\bvideo-cover\b[^"]*"[^>]*>/i
const IMG_SRC_RE = /src="([^"]+)"/i

// panel 容器是 <nav class="panel movie-panel-info">（不是 div）
const PANEL_RE = /<nav[^>]+class="[^"]*\bmovie-panel-info\b[^"]*"[^>]*>([\s\S]*?)<\/nav>/i

// 预览样张容器
const PREVIEW_WRAP_RE = /<div[^>]+class="[^"]*\bpreview-images\b[^"]*"[^>]*>([\s\S]*?)<\/div>/i
const PREVIEW_HREF_RE = /<a\b[^>]*href="([^"]+\.(?:jpe?g|png|webp))[^"]*"/gi

// panel-block 字段行
const PANEL_BLOCK_RE = /<div[^>]+class="[^"]*\bpanel-block\b[^"]*"[^>]*>([\s\S]*?)<\/div>/gi
const FIELD_LABEL_RE = /<strong[^>]*>([\s\S]*?)<\/strong>/i

// 演员从 panel-block 文本中按性别符号提取（♀ 女 / ♂ 男）
const ACTOR_GENDER_RE = /([^\s♀♂][^♀♂]*?)\s*([♀♂])/g

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

function normalizeUrl(url: string, base: string): string {
  if (/^https?:\/\//i.test(url)) return url
  if (url.startsWith('//')) return `https:${url}`
  // 用 URL 构造器保证 base 末尾斜杠被正确处理（base 无尾斜杠时也不会粘连 host 与 path）
  try {
    return new URL(url, base.endsWith('/') ? base : base + '/').toString()
  } catch {
    return base.replace(/\/+$/, '') + '/' + url.replace(/^\/+/, '')
  }
}

function extractFields(panelHtml: string): Record<string, string> {
  const fields: Record<string, string> = {}
  let m: RegExpExecArray | null
  PANEL_BLOCK_RE.lastIndex = 0
  while ((m = PANEL_BLOCK_RE.exec(panelHtml)) !== null) {
    const block = m[1]
    const labelMatch = FIELD_LABEL_RE.exec(block)
    if (!labelMatch) continue
    const label = cleanText(labelMatch[1]).replace(/[:：]\s*$/, '')
    if (!label) continue
    // 取 </strong> 之后的内容
    const afterStrong = block.split(/<\/strong>/i)[1] ?? ''
    fields[label] = cleanText(afterStrong)
  }
  return fields
}

function pick(fields: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = fields[k]
    if (v && v.trim()) return v.trim()
  }
  return ''
}

function extractActorsFromPanel(panelHtml: string): ScrapedActor[] {
  // 找到「演員」panel-block，按性别符号拆分
  PANEL_BLOCK_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = PANEL_BLOCK_RE.exec(panelHtml)) !== null) {
    const block = m[1]
    const labelMatch = FIELD_LABEL_RE.exec(block)
    if (!labelMatch) continue
    const label = cleanText(labelMatch[1]).replace(/[:：]\s*$/, '')
    if (label !== '演員' && label !== '演员') continue
    const afterStrong = block.split(/<\/strong>/i)[1] ?? ''
    const text = cleanText(afterStrong)
    const actors: ScrapedActor[] = []
    let am: RegExpExecArray | null
    ACTOR_GENDER_RE.lastIndex = 0
    while ((am = ACTOR_GENDER_RE.exec(text)) !== null) {
      const name = am[1].trim()
      const gender = am[2]
      if (gender === '♀' && name) actors.push({ name })
    }
    return actors
  }
  return []
}

function extractGenres(fields: Record<string, string>): string[] {
  const raw = pick(fields, '類別', '类别', '標籤', '标签')
  if (!raw) return []
  return raw
    .split(/[,\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}

function extractRuntimeMinutes(value: string): number | undefined {
  if (!value) return undefined
  const m = value.match(/(\d+)/)
  if (!m) return undefined
  const n = parseInt(m[1], 10)
  return Number.isFinite(n) && n > 0 ? n : undefined
}

function extractTitle(html: string): string {
  const origin = ORIGIN_TITLE_RE.exec(html)
  if (origin) {
    const t = cleanText(origin[1])
    if (t) return t
  }
  const cur = CURRENT_TITLE_RE.exec(html)
  if (cur) {
    const t = cleanText(cur[1])
    if (t) return t
  }
  const h2 = H2_TITLE_RE.exec(html)
  if (h2) {
    // 去掉番号 strong，取剩余文本
    const inner = h2[1].replace(CURRENT_TITLE_RE, ' ').replace(/<strong[^>]*>[\s\S]*?<\/strong>/i, ' ')
    const t = cleanText(inner)
    if (t) return t
  }
  return ''
}

export function parseJavDbDetail(
  html: string,
  baseUrl: string,
  sourceUrl: string
): ScrapedMetadata | null {
  const panelMatch = PANEL_RE.exec(html)
  const panelHtml = panelMatch ? panelMatch[1] : html
  const fields = extractFields(panelHtml)

  const rawNumber = pick(fields, '番號', '番号')
  // 番号内部可能有空格（如 "SSIS -001"），去除连字符两侧空白
  const number = rawNumber.replace(/\s*-\s*/g, '-').trim()
  const rawTitle = extractTitle(html)
  if (!rawTitle && !number) return null

  // 封面：在 column-video-cover 容器内找 video-cover 图
  let coverUrl = ''
  const coverImgMatch = COVER_IMAGE_RE.exec(html)
  if (coverImgMatch) {
    const src = IMG_SRC_RE.exec(coverImgMatch[0])
    if (src) coverUrl = normalizeUrl(src[1], 'https://javdb.com/')
  }

  // 样张
  const sampleUrls: string[] = []
  const previewMatch = PREVIEW_WRAP_RE.exec(html)
  if (previewMatch) {
    let sm: RegExpExecArray | null
    PREVIEW_HREF_RE.lastIndex = 0
    while ((sm = PREVIEW_HREF_RE.exec(previewMatch[1])) !== null) {
      sampleUrls.push(normalizeUrl(sm[1], 'https://javdb.com/'))
    }
  }

  const actors = extractActorsFromPanel(panelHtml)
  const genres = extractGenres(fields)
  const isUncensored = /無碼|无码|uncensored/i.test(html)
  const director = pick(fields, '導演', '导演')
  const maker = pick(fields, '片商', '廠商', '厂商')
  const publisher = pick(fields, '發行', '发行')
  const series = pick(fields, '系列')
  const releaseDate = pick(fields, '日期', '時間', '时间')
  const runtimeMin = extractRuntimeMinutes(pick(fields, '時長', '时长'))
  const title = rawTitle || number

  return {
    sourceUrl,
    number,
    title,
    coverUrl,
    coverThumbUrl: undefined,
    sampleUrls,
    actors,
    genres,
    director: director || undefined,
    maker: maker || undefined,
    publisher: publisher || undefined,
    series: series || undefined,
    releaseDate: releaseDate || undefined,
    runtimeMin,
    isUncensored
  }
}

export function extractJavDbSearchDetailUrl(
  html: string,
  base: string,
  number: string
): string | null {
  // 搜索结果项：<a href="/v/xxxx" class="box" ...>...<strong>SSIS-001</strong>...</a>
  // 必须按 <strong> 番号精确匹配，否则 SSIS-001 会命中 PSIS-001 / SHIS-001 等
  const target = normalizeNumber(number)
  const itemRe = /<a\b[^>]*href="(\/v\/[^"?#]+)"[^>]*class="[^"]*\bbox\b[^"]*"[^>]*>([\s\S]*?)<\/a>/gi
  let m: RegExpExecArray | null
  while ((m = itemRe.exec(html)) !== null) {
    const href = m[1]
    const body = m[2]
    const strongM = body.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
    const candidate = strongM ? normalizeNumber(strongM[1]) : ''
    if (candidate === target) return normalizeUrl(href, base)
  }
  // 兜底：属性顺序反过来（class 在前 href 在后）
  const itemRe2 = /<a\b[^>]*class="[^"]*\bbox\b[^"]*"[^>]*href="(\/v\/[^"?#]+)"[^>]*>([\s\S]*?)<\/a>/gi
  while ((m = itemRe2.exec(html)) !== null) {
    const href = m[1]
    const body = m[2]
    const strongM = body.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
    const candidate = strongM ? normalizeNumber(strongM[1]) : ''
    if (candidate === target) return normalizeUrl(href, base)
  }
  return null
}

// 番号归一化用于搜索结果精确匹配：
// - 去标签/空白/连字符
// - FC2-PPV-xxxx 与 FC2-xxxx 视为同一番号（JavDB 显示为 FC2-xxxx）
function normalizeNumber(s: string): string {
  const bare = s
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/[\s-]+/g, '')
    .toUpperCase()
  return bare.replace(/^FC2PPV/, 'FC2')
}

export function buildJavDbUrl(number: string): string {
  return `https://javdb.com/v/${encodeURIComponent(number)}`
}

export function buildJavDbSearchUrl(number: string): string {
  return `https://javdb.com/search?q=${encodeURIComponent(number)}&f=all`
}

// 从搜索结果项提取最小元数据（番号/标题/封面/日期），
// 用于详情页被登录墙拦截（302→/login）时的兜底——至少能拿到 fanart 封面。
export function parseJavDbSearchItem(
  html: string,
  base: string,
  number: string
): ScrapedMetadata | null {
  const target = normalizeNumber(number)
  // 按 <div class="item"> 切块：从一个 item 到下一个 item（或 movie-list 结束）
  const itemStartRe = /<div\b[^>]*class="[^"]*\bitem\b[^"]*"[^>]*>/gi
  const starts: number[] = []
  let sm: RegExpExecArray | null
  while ((sm = itemStartRe.exec(html)) !== null) {
    starts.push(sm.index + sm[0].length)
  }
  for (let i = 0; i < starts.length; i++) {
    const blockStart = starts[i]
    const blockEnd = i + 1 < starts.length ? starts[i + 1] : html.length
    const block = html.slice(blockStart, blockEnd)

    const strongM = block.match(/<strong[^>]*>([\s\S]*?)<\/strong>/i)
    const candidate = strongM ? normalizeNumber(strongM[1]) : ''
    if (candidate !== target) continue

    // 详情链接（a.box 的 href）
    const hrefM = block.match(/<a\b[^>]*href="(\/v\/[^"?#]+)"/i)
    const sourceUrl = hrefM ? normalizeUrl(hrefM[1], base) : ''

    // 封面图
    const imgM = block.match(/<img\b[^>]*src="([^"]+)"/i)
    const coverUrl = imgM ? normalizeUrl(imgM[1], base) : ''

    // 标题：video-title div 里 <strong>番号</strong> 后面的文本
    const titleDivM = block.match(/<div[^>]*class="[^"]*video-title[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    let title = ''
    if (titleDivM) {
      title = cleanText(titleDivM[1].replace(/<strong[^>]*>[\s\S]*?<\/strong>/i, ''))
    }
    if (!title) title = number

    // 日期
    const metaM = block.match(/<div[^>]*class="[^"]*meta[^"]*"[^>]*>([\s\S]*?)<\/div>/i)
    const releaseDate = metaM ? cleanText(metaM[1]) : undefined

    return {
      sourceUrl,
      number,
      title,
      coverUrl,
      coverThumbUrl: undefined,
      sampleUrls: [],
      actors: [],
      genres: [],
      releaseDate: releaseDate || undefined,
      isUncensored: /FC2|HEYZO|無碼|无码|uncensored/i.test(number + ' ' + title)
    }
  }
  return null
}
