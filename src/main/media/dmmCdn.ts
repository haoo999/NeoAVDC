import type { ParsedName } from '../number/parseNumber'
import type { SiteId } from '../../shared/types/settings'

// DMM 图片 CDN 工具。仅作为有码作品的图片回退/补充，不参与元数据抓取。
// 有码封面：https://pics.dmm.co.jp/digital/video/{cid}/{cid}pl.jpg
// 有码样张：https://pics.dmm.co.jp/digital/video/{cid}/{cid}jp-{i}.jpg
// cid = 小写厂牌前缀 + 补零后的数字（历史 5 位，近年新片有 6 位，旧片偶见 4 位）。
// 无码 / FC2 / HEYZO / 欧美日期番号在 DMM 上没有统一 cid，直接跳过。

export const DMM_SITE_ID: SiteId = 'DMM'
export const DMM_REFERER = 'https://www.dmm.co.jp/'
export const DMM_SAMPLE_MAX = 10

function parseCensoredParts(
  number: string,
  parsed: ParsedName | null
): { prefix: string; digits: string } | null {
  if (parsed && !parsed.isCensored) return null
  if (!parsed && !/^[A-Za-z]{2,8}-\d{2,6}$/.test(number)) return null
  const m = number.match(/^([A-Za-z]{2,8})-(\d{2,6})$/)
  if (!m) return null
  return { prefix: m[1].toLowerCase(), digits: m[2] }
}

function buildCandidates(prefix: string, digits: string): string[] {
  const numeric = parseInt(digits, 10)
  if (!Number.isFinite(numeric) || numeric <= 0) return []
  const lengths = [5, 6, 4]
  const out: string[] = []
  const seen = new Set<string>()
  for (const len of lengths) {
    if (digits.length > len) continue
    const cid = `${prefix}${String(numeric).padStart(len, '0')}`
    if (!seen.has(cid)) {
      seen.add(cid)
      out.push(cid)
    }
  }
  return out
}

export function dmmCandidates(number: string, parsed: ParsedName | null): string[] {
  const parts = parseCensoredParts(number, parsed)
  if (!parts) return []
  return buildCandidates(parts.prefix, parts.digits)
}

export function dmmCoverUrls(number: string, parsed: ParsedName | null): string[] {
  return dmmCandidates(number, parsed).map(
    (cid) => `https://pics.dmm.co.jp/digital/video/${cid}/${cid}pl.jpg`
  )
}

// 按 cid 分组返回样张 URL 列表：命中某个 cid 的第一张后顺序拉取，
// 一旦该 cid 连续 404 即可停止，无需把 5/6/4 位 padding 的样张全探测一遍。
export function dmmSampleGroups(number: string, parsed: ParsedName | null): string[][] {
  return dmmCandidates(number, parsed).map((cid) => {
    const urls: string[] = []
    for (let i = 1; i <= DMM_SAMPLE_MAX; i++) {
      urls.push(`https://pics.dmm.co.jp/digital/video/${cid}/${cid}jp-${i}.jpg`)
    }
    return urls
  })
}
