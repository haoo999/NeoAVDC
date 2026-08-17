const VIDEO_EXTS = [
  '.mp4', '.mkv', '.avi', '.mov', '.wmv', '.flv', '.webm', '.m4v', '.ts', '.m2ts'
]

const SUBTITLE_EXTS = ['.srt', '.ass', '.sub', '.vtt', '.ssa']

const TOKEN_STRIP_RE: ReadonlyArray<readonly [RegExp, string]> = [
  [/22-sht\.me/gi, ''],
  [/hhd800/gi, ''],
  [/[-_ ]?1080p/gi, ''],
  [/[-_ ]?720p/gi, ''],
  [/[-_ ]?2160p/gi, ''],
  [/[-_ ]?4k/gi, ''],
  [/[-_ ]?full/gi, ''],
  [/\[\d{4}-\d{1,2}-\d{1,2}\]\s*-\s*/g, '']
]

const CENSORED_RE = /([A-Za-z]{2,10})[-_](\d{2,6})/
const FC2_RE = /fc2(?:[-_]?ppv)?[-_]?(\d{4,8})/i
const HEYZO_RE = /heyzo[-_ ]?(\d{3,6})/i
const TOKYOHOT_RE = /(?:n|k|cz|red[-_]?|se)(\d{3,5})/i
const UNCEN_NUMERIC_RE = /(\d{5,7})[-_](\d{2,4})/
const WESTERN_RE = /([a-zA-Z]+)\.(\d{2})\.(\d{2})\.(\d{2})/
const CD_PART_RE = /[-_ ]cd\s*(\d+)/i
const SUB_MARK_RE = /[-_ ](?:c|C)(?=\.[^.]+$)/

export interface ParsedName {
  number: string
  isCensored: boolean
  isUncensored: boolean
  isFc2: boolean
  isWestern: boolean
  hasSubtitleMark: boolean
  part: number | null
}

function stripNoise(token: string): string {
  let s = token
  for (const [re, rep] of TOKEN_STRIP_RE) {
    s = s.replace(re, rep)
  }
  s = s.replace(/[\s_]+/g, '-')
  s = s.replace(/-+/g, '-')
  return s.replace(/^-+|-+$/g, '')
}

export function parseNumberFromFileName(rawFileName: string): ParsedName | null {
  const hasSubtitleMark = SUB_MARK_RE.test(rawFileName)

  const withoutExt = rawFileName.replace(/\.[^.]+$/, '')
  const base = withoutExt
    .replace(/[（）【】\[\]()]/g, ' ')
    .trim()

  const partMatch = base.match(CD_PART_RE)
  const part = partMatch ? parseInt(partMatch[1], 10) : null

  const cleaned = stripNoise(base)

  const western = cleaned.match(WESTERN_RE)
  if (western) {
    const [, series, yy, mm, dd] = western
    return {
      number: `${series}.${yy}.${mm}.${dd}`.toLowerCase(),
      isCensored: false,
      isUncensored: false,
      isFc2: false,
      isWestern: true,
      hasSubtitleMark,
      part
    }
  }

  const fc2 = cleaned.match(FC2_RE)
  if (fc2) {
    return {
      number: `FC2-PPV-${fc2[1]}`,
      isCensored: false,
      isUncensored: true,
      isFc2: true,
      isWestern: false,
      hasSubtitleMark,
      part
    }
  }

  const heyzo = cleaned.match(HEYZO_RE)
  if (heyzo) {
    return {
      number: `HEYZO-${heyzo[1].padStart(4, '0')}`,
      isCensored: false,
      isUncensored: true,
      isFc2: false,
      isWestern: false,
      hasSubtitleMark,
      part
    }
  }

  if (/tokyo[-_ ]?hot/i.test(cleaned)) {
    const th = cleaned.match(TOKYOHOT_RE)
    if (th) {
      return {
        number: `n${th[1]}`,
        isCensored: false,
        isUncensored: true,
        isFc2: false,
        isWestern: false,
        hasSubtitleMark,
        part
      }
    }
  }

  const censored = cleaned.match(CENSORED_RE)
  if (censored) {
    const [, prefix, num] = censored
    const padded = /^\d{1,2}$/.test(num) ? num.padStart(3, '0') : num
    return {
      number: `${prefix.toUpperCase()}-${padded}`,
      isCensored: true,
      isUncensored: false,
      isFc2: false,
      isWestern: false,
      hasSubtitleMark,
      part
    }
  }

  const numeric = cleaned.match(UNCEN_NUMERIC_RE)
  if (numeric) {
    return {
      number: `${numeric[1]}-${numeric[2]}`,
      isCensored: false,
      isUncensored: true,
      isFc2: false,
      isWestern: false,
      hasSubtitleMark,
      part
    }
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
