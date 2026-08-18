import type { ParsedName } from '../../number/parseNumber'
import type { ScrapedActor, ScrapedMetadata } from '../../../shared/types'

const FC2_HOST = 'https://adult.contents.fc2.com'

// FC2 番号格式：FC2-PPV-1234567 / FC2PPV-1234567 / fc2_1234567 / fc2-1234567
const FC2_ID_RE = /fc2(?:[-_]?ppv)?[-_]?(\d{4,10})/i

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

function getMetaContent(html: string, key: string): string {
  // 同时匹配 property="og:xxx" 和 name="xxx"，属性顺序不固定
  const re = new RegExp(
    `<meta[^>]+(?:property|name)=["']${key}["'][^>]*content=["']([^"']*)["']`,
    'i'
  )
  const m = html.match(re)
  if (m) return decodeHtml(m[1])
  const re2 = new RegExp(
    `<meta[^>]+content=["']([^"']*)["'][^>]*(?:property|name)=["']${key}["']`,
    'i'
  )
  const m2 = html.match(re2)
  return m2 ? decodeHtml(m2[1]) : ''
}

function decodeHtml(s: string): string {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
}

export function buildFc2ArticleUrl(id: string): string {
  return `${FC2_HOST}/article/${id}/`
}

export function buildFc2TagApiUrl(id: string): string {
  return `${FC2_HOST}/api/v4/article/${id}/tag?`
}

export function extractFc2Id(number: string): string {
  const m = number.match(FC2_ID_RE)
  if (m) return m[1]
  if (/^\d{4,10}$/.test(number)) return number
  return ''
}

export function isFc2Number(parsed: ParsedName | null, number: string): boolean {
  if (parsed?.isFc2) return true
  return FC2_ID_RE.test(number)
}

// 抽取页面内 data-tag="xxx"（FC2 在多处用 data-tag 输出标签）
function extractDataTags(html: string): string[] {
  const tags: string[] = []
  const re = /data-tag=["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    const t = cleanText(m[1])
    if (t && !tags.includes(t)) tags.push(t)
  }
  return tags
}

// 从 tags API JSON 响应中提取标签
export function parseFc2TagJson(jsonText: string): string[] {
  try {
    const obj = JSON.parse(jsonText) as { tags?: Array<{ tag?: string }> }
    if (!Array.isArray(obj.tags)) return []
    const tags: string[] = []
    for (const t of obj.tags) {
      const name = typeof t?.tag === 'string' ? t.tag.trim() : ''
      if (name && !tags.includes(name)) tags.push(name)
    }
    return tags
  } catch {
    return []
  }
}

// 抽取販売日（YYYY/MM/DD）
function extractReleaseDate(html: string): string | undefined {
  const m = html.match(/販売日\s*[:：]?\s*(\d{4})\/(\d{1,2})\/(\d{1,2})/)
  if (!m) return undefined
  return `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`
}

// 抽取販売者（卖家）显示名：寻找 /users/<id>/ 链接后的锚文本
function extractSeller(html: string): { name?: string; id?: string } {
  const re =
    /<a[^>]+href=["'](?:https?:\/\/adult\.contents\.fc2\.com)?\/users\/([^"']+)\/["'][^>]*>([\s\S]*?)<\/a>/i
  const m = html.match(re)
  if (!m) return {}
  const id = m[1]
  const name = cleanText(m[2])
  return { id, name: name || undefined }
}

// 从页面 HTML 抓取高分辨率样张（优先选择 w1280 缩略图对应的原图 storage 直链）
function extractSampleImages(html: string, coverUrl: string): string[] {
  const coverKey = normalizeImageKey(coverUrl)
  // 收集所有 storage 直链
  const storageRe =
    /https?:\/\/storage\d+\.contents\.fc2\.com\/file\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp)/gi
  const found = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = storageRe.exec(html)) !== null) {
    const u = m[0]
    if (normalizeImageKey(u) !== coverKey) found.add(u)
  }
  // 兜底：w1280 缩略图反推原图
  const thumbRe =
    /\/\/contents-thumbnail2\.fc2\.com\/w1280\/(storage\d+\.contents\.fc2\.com\/file\/[^\s"'<>]+?\.(?:jpg|jpeg|png|webp))/gi
  while ((m = thumbRe.exec(html)) !== null) {
    const u = `https://${m[1]}`
    if (normalizeImageKey(u) !== coverKey) found.add(u)
  }
  return Array.from(found).slice(0, 12)
}

// 去掉图片 URL 的 query/hash 与协议，用于判断「这张图是不是封面」
function normalizeImageKey(u: string): string {
  return u.replace(/^https?:\/\//, '').replace(/[?#].*$/, '')
}

export function parseFc2Detail(
  html: string,
  sourceUrl: string,
  number: string,
  tagJson?: string
): ScrapedMetadata | null {
  if (!html || html.length === 0) return null

  const ogTitle = getMetaContent(html, 'og:title')
  const ogImage = getMetaContent(html, 'og:image')
  const ogDesc = getMetaContent(html, 'og:description')
  const docTitle = (html.match(/<title>([\s\S]*?)<\/title>/i)?.[1] ?? '').trim()

  // 标题：og:title 一般以 "<number> <title>" 开头；去掉番号前缀
  let title = ogTitle || docTitle
  if (!title) return null
  title = title.replace(/\s*\|\s*FC2.*$/i, '').trim()
  const id = extractFc2Id(number)
  const normalizedNumber = id ? `FC2-PPV-${id}` : number
  const prefixRe = new RegExp(`^FC2[-_ ]?PPV[-_ ]?${id}\\s*`, 'i')
  title = title.replace(prefixRe, '').trim() || title

  if (!ogImage) {
    // 没有封面图则视为无效页面
    return null
  }

  const seller = extractSeller(html)
  const releaseDate = extractReleaseDate(html)
  const tagsFromHtml = extractDataTags(html)
  const tagsFromApi = tagJson ? parseFc2TagJson(tagJson) : []
  const genres = mergeUnique(tagsFromApi, tagsFromHtml)

  const actors: ScrapedActor[] = []
  if (seller.name) {
    // FC2 的「販売者」是出品人（素人卖家），不是女优，但 Kodi 没有更合适的字段；
    // 写入 director 更准确，actors 保持为空以免污染演员库
  }

  const sampleUrls = extractSampleImages(html, ogImage)

  return {
    sourceUrl,
    number: normalizedNumber,
    title,
    coverUrl: ogImage,
    sampleUrls,
    actors,
    genres,
    director: seller.name,
    maker: seller.name ? `FC2-PPV（${seller.name}）` : 'FC2-PPV',
    publisher: seller.name ?? 'FC2-PPV',
    series: '',
    outline: ogDesc || undefined,
    releaseDate,
    isUncensored: true,
    posterNoCrop: true
  }
}

function mergeUnique(a: string[], b: string[]): string[] {
  const out: string[] = []
  for (const v of [...a, ...b]) {
    if (v && !out.includes(v)) out.push(v)
  }
  return out
}

// FC2 对已删除/未上架的文章会返回带特定文案的软 404
export function isFc2NotFound(html: string): boolean {
  const head = html.slice(0, 8000)
  return (
    /お探しの[\s\S]{0,8}(?:商品|コンテンツ|ページ)[\s\S]{0,8}は見つかりません|商品が見つかりません|404\s*Not\s*Found|ページが存在しません/i.test(
      head
    )
  )
}
