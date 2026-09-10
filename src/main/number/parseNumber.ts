const VIDEO_EXTS = [
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts'
]

const SUBTITLE_EXTS = ['.srt', '.ass', '.sub', '.vtt', '.ssa']

// 全串级别剥离的噪声（发布组域名、分辨率、方括号日期前缀等）
// 发布组域名要整段剥掉：hhd800.com 这类会紧贴番号（hhd800.comcwp-119），
// 若只去掉 hhd800 会留下 .com 残渣被当成厂牌前缀，故域名规则须排在前面
const GLOBAL_STRIP_RE: ReadonlyArray<readonly [RegExp, string]> = [
  [/[a-z0-9-]+\.(?:com|net|org|cc|la|me|xyz|top|site|info)/gi, ''],
  [/22-sht\.me/gi, ''],
  [/hhd800/gi, ''],
  [/[-_ ]?1080p/gi, ' '],
  [/[-_ ]?720p/gi, ' '],
  [/[-_ ]?2160p/gi, ' '],
  [/[-_ ]?4k/gi, ' '],
  [/[-_ ]?full/gi, ' '],
  [/\[\d{4}-\d{1,2}-\d{1,2}\]\s*-\s*/g, '']
]

// token 边界：空白、下划线、@、各类括号；保留中划线与句点（番号 SSIS-001 与欧美日期 Series.YY.MM.DD 依赖它们）
const TOKEN_SEP_RE = /[\s_@\[\]【】（）()]+/

// 番号 token 尾部的质量/来源后缀，如 SSIS-001-UC、SSIS001FHD、SSIS-001.中文字幕
const TRAILING_NOISE_RE =
  /(?:[-_. ]?(?:uc|leak|uncensored?|uncensor|fhd|hd|vr|無修正|无修正|無碼|无码|流出|破解版?|中文字幕|字幕|中文|高画質|高画质))+$/i

const CD_PART_RE = /[-_ ]cd\s*(\d+)/i
// 字幕标记 -C：可能带扩展名，也可能是引擎传入的去扩展名文件名，故末尾两种都接受
const SUB_MARK_RE = /[-_ ](?:c|C)(?=\.[^.]+$|$)/

const WESTERN_RE = /([a-zA-Z]{2,})\.(\d{2})\.(\d{2})\.(\d{2})/
const FC2_RE = /fc2(?:[-_ ]?ppv)?[-_ ]?(\d{4,8})/i
const HEYZO_RE = /heyzo[-_ ]?(\d{3,6})/i
const TOKYOHOT_TOKEN_RE = /tokyo[-_ ]?hot/i
const TOKYOHOT_NUM_RE = /(?:n|k|cz|red[-_]?|se)(\d{3,5})/i
// 有分隔符有码：SSIS-001 / ABC-12
const CENSORED_SEP_RE = /(?:^|[^A-Za-z])([A-Za-z]{2,8})[-_](\d{2,6})(?![a-z])/
// 有分隔符有码（全串级，容忍番号与分隔符之间夹空格）：SSNI - 111 / FC2 系列前的编号
// 前缀允许 259LUXU / 300MIUM / 200GANA 这类「3 位数字 + 字母」厂牌
const CENSORED_SEP_LOOSE_RE =
  /(?:^|[^A-Za-z0-9])((?:\d{3})?[A-Za-z]{2,8})\s*[-_]\s*(\d{2,6})(?![A-Za-z0-9])/
// 无分隔符有码：SSIS001 / ssis001
const CENSORED_NOSEP_RE = /(?:^|[^A-Za-z])([A-Za-z]{2,8})(\d{2,6})(?![a-zA-Z])/
// 纯空格分隔、且前缀全大写：SSNI 111（大写约束用于排除 Vacation 2024 这类英文标题）
const CENSORED_SPACE_RE =
  /(?:^|[^A-Za-z0-9])((?:\d{3})?[A-Z]{2,8})\s+(\d{2,6})(?![A-Za-z0-9])/
// 无码纯数字：12345-678 / 010120-001
const UNCEN_NUMERIC_RE = /(?:^|[^0-9])(\d{5,7})[-_](\d{2,4})(?![0-9])/

// 误命中黑名单：这些「前缀」不是番号厂牌
const PREFIX_BLACKLIST = new Set([
  'README', 'IMDB', 'HTTP', 'HTTPS', 'WWW', 'FTP', 'FILE', 'FULL',
  'TRUE', 'FALSE', 'NONE', 'NULL', 'COPY', 'FINAL',
  'HD', 'FHD', 'UHD', 'BD', 'DVD', 'WEB', 'WEBRIP', 'BLURAY', 'REMUX',
  'HEVC', 'AVC', 'HDR', 'X264', 'X265', 'AAC', 'PART', 'VOL', 'DISC',
  'EP', 'EPISODE', 'SAMPLE', 'TRAILER', 'MOVIE', 'VIDEO', 'NFO', 'SRT', 'PPV'
])

export interface ParsedName {
  number: string
  isCensored: boolean
  isUncensored: boolean
  isFc2: boolean
  isWestern: boolean
  hasSubtitleMark: boolean
  part: number | null
}

function stripGlobalNoise(token: string): string {
  let s = token
  for (const [re, rep] of GLOBAL_STRIP_RE) {
    s = s.replace(re, rep)
  }
  return s.trim()
}

function cleanToken(raw: string): string {
  let s = raw
  // 去掉尾部质量/来源后缀，重复处理以应对 SSIS-001-UCFHD 这类叠加
  for (;;) {
    const next = s.replace(TRAILING_NOISE_RE, '')
    if (next === s) break
    s = next
  }
  return s.replace(/^[-_.]+|[-_.]+$/g, '')
}

// 番号数字段归一化：先去掉前导零（cwp00119 → 119），再补足 3 位（ABC-12 → ABC-012）
function padCensoredDigits(num: string): string {
  const trimmed = num.replace(/^0+(?=\d)/, '')
  return trimmed.length < 3 ? trimmed.padStart(3, '0') : trimmed
}

function tokenize(base: string): string[] {
  return base
    .split(TOKEN_SEP_RE)
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

function matchWestern(token: string): ParsedName | null {
  const m = token.match(WESTERN_RE)
  if (!m) return null
  const [, series, yy, mm, dd] = m
  // 基本合理性校验：月份 01-12、日期 01-31
  const month = parseInt(mm, 10)
  const day = parseInt(dd, 10)
  if (month < 1 || month > 12 || day < 1 || day > 31) return null
  return {
    number: `${series}.${yy}.${mm}.${dd}`.toLowerCase(),
    isCensored: false,
    isUncensored: false,
    isFc2: false,
    isWestern: true,
    hasSubtitleMark: false,
    part: null
  }
}

function matchFc2(token: string): ParsedName | null {
  const m = token.match(FC2_RE)
  if (!m) return null
  return {
    number: `FC2-PPV-${m[1]}`,
    isCensored: false,
    isUncensored: true,
    isFc2: true,
    isWestern: false,
    hasSubtitleMark: false,
    part: null
  }
}

function matchHeyzo(token: string): ParsedName | null {
  const m = token.match(HEYZO_RE)
  if (!m) return null
  return {
    number: `HEYZO-${m[1].padStart(4, '0')}`,
    isCensored: false,
    isUncensored: true,
    isFc2: false,
    isWestern: false,
    hasSubtitleMark: false,
    part: null
  }
}

function matchTokyoHot(token: string): ParsedName | null {
  if (!TOKYOHOT_TOKEN_RE.test(token)) return null
  const m = token.match(TOKYOHOT_NUM_RE)
  if (!m) return null
  return {
    number: `n${m[1]}`,
    isCensored: false,
    isUncensored: true,
    isFc2: false,
    isWestern: false,
    hasSubtitleMark: false,
    part: null
  }
}

function censoredResult(prefix: string, digits: string): ParsedName | null {
  if (PREFIX_BLACKLIST.has(prefix)) return null
  return {
    number: `${prefix}-${padCensoredDigits(digits)}`,
    isCensored: true,
    isUncensored: false,
    isFc2: false,
    isWestern: false,
    hasSubtitleMark: false,
    part: null
  }
}

function matchCensored(token: string): ParsedName | null {
  const upper = token.toUpperCase()
  let m = upper.match(CENSORED_SEP_RE)
  if (m) return censoredResult(m[1], m[2])
  m = upper.match(CENSORED_NOSEP_RE)
  if (m) return censoredResult(m[1], m[2])
  return null
}

// 全串级有码匹配：多词文件名被空白切散后无法按 token 命中，
// 这里直接在归一化后的完整串上匹配（容忍 SSIS - 001 / SSIS 001 / 259LUXU-1234）
function matchCensoredAnywhere(normalized: string): ParsedName | null {
  let m = normalized.match(CENSORED_SEP_LOOSE_RE)
  if (m) {
    const hit = censoredResult(m[1].toUpperCase(), m[2])
    if (hit) return hit
  }
  m = normalized.match(CENSORED_SPACE_RE)
  if (m) {
    const hit = censoredResult(m[1].toUpperCase(), m[2])
    if (hit) return hit
  }
  return null
}

// 全串级特征源匹配：FC2 / HEYZO / Tokyo-Hot 番号可能跨空白（HEYZO 1234、FC2 PPV 1234567）
function matchDistinctiveAnywhere(normalized: string): ParsedName | null {
  return (
    matchFc2(normalized) ||
    matchHeyzo(normalized) ||
    (TOKYOHOT_TOKEN_RE.test(normalized) ? matchTokyoHot(normalized) : null)
  )
}

function matchUncensoredNumeric(token: string): ParsedName | null {
  const m = token.match(UNCEN_NUMERIC_RE)
  if (!m) return null
  return {
    number: `${m[1]}-${m[2]}`,
    isCensored: false,
    isUncensored: true,
    isFc2: false,
    isWestern: false,
    hasSubtitleMark: false,
    part: null
  }
}

function withFlags(
  base: ParsedName,
  hasSubtitleMark: boolean,
  part: number | null
): ParsedName {
  return { ...base, hasSubtitleMark, part }
}

export function parseNumberFromFileName(rawFileName: string): ParsedName | null {
  const hasSubtitleMark = SUB_MARK_RE.test(rawFileName)

  const withoutExt = rawFileName.replace(/\.[^.]+$/, '')
  const partMatch = withoutExt.match(CD_PART_RE)
  const part = partMatch ? parseInt(partMatch[1], 10) : null

  // 番号体系中下划线与连字符等价，统一成连字符，避免 fc2_999999 被切成两段
  const normalized = stripGlobalNoise(
    withoutExt
      .replace(/[（）【】\[\]()]/g, ' ')
      .replace(/_/g, '-')
  )

  // 欧美日期格式优先判断（依赖句点，不能被 token 化破坏）
  for (const raw of tokenize(normalized)) {
    const western = matchWestern(raw)
    if (western) return withFlags(western, hasSubtitleMark, part)
  }

  // 第一优先：特征明显的源（FC2 / HEYZO / Tokyo-Hot），全串级匹配以兼容多词写法
  const distinctive = matchDistinctiveAnywhere(normalized)
  if (distinctive) return withFlags(distinctive, hasSubtitleMark, part)

  // 第二优先：有码字母数字番号。先全串级（兼容番号中夹空格），再退回按 token
  const censoredAnywhere = matchCensoredAnywhere(normalized)
  if (censoredAnywhere) return withFlags(censoredAnywhere, hasSubtitleMark, part)

  const tokens = tokenize(normalized).map(cleanToken).filter((t) => t.length > 0)

  for (const tok of tokens) {
    const hit = matchCensored(tok)
    if (hit) return withFlags(hit, hasSubtitleMark, part)
  }

  // 最后回退：无码纯数字番号
  for (const tok of tokens) {
    const hit = matchUncensoredNumeric(tok)
    if (hit) return withFlags(hit, hasSubtitleMark, part)
  }

  return null
}

export function isVideoFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return VIDEO_EXTS.some((ext) => lower.endsWith(ext))
}

export function isSubtitleFile(fileName: string): boolean {
  const lower = fileName.toLowerCase()
  return SUBTITLE_EXTS.some((ext) => lower.endsWith(ext))
}

export { VIDEO_EXTS, SUBTITLE_EXTS, CD_PART_RE }
