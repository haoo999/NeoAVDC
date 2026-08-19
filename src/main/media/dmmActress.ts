// DMM 旧版「AV女優一覧」页（mono/dvd）仍是服务端渲染，按假名行分页，
// 页内每个 <li> 形如：
//   <a href=".../list/=/article=actress/id=123/">
//     <img src="https://pics.dmm.co.jp/mono/actjpgs/medium/{roman}.jpg"><br>{日文名}
//   </a>
// pics.dmm.co.jp 无防盗链（不带 Referer 也返回 200），适合写进 NFO 供 Infuse 直接加载。
const ACTRESS_PAGE = 'https://www.dmm.co.jp/mono/dvd/-/actress/=/keyword='
const DMM_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36'

const ITEM_RE =
  /<a[^>]*href="[^"]*?\/list\/=\/article=actress\/id=\d+\/"[^>]*>\s*<img[^>]*src="(https:\/\/pics\.dmm\.co\.jp\/mono\/actjpgs\/medium\/[^"]+)"[^>]*>\s*<br>\s*([^<]+?)\s*<\/a>/g

// 平假名→DMM 假名行索引（五十音首字）。浊音/半浊音归到清音行（DMM 列表同页）。
const HIRAGANA_ROW: Record<string, string> = {
  あ: 'a', い: 'a', う: 'a', え: 'a', お: 'a',
  か: 'ka', き: 'ka', く: 'ka', け: 'ka', こ: 'ka',
  が: 'ka', ぎ: 'ka', ぐ: 'ka', げ: 'ka', ご: 'ka',
  さ: 'sa', し: 'sa', す: 'sa', せ: 'sa', そ: 'sa',
  ざ: 'sa', じ: 'sa', ず: 'sa', ぜ: 'sa', ぞ: 'sa',
  た: 'ta', ち: 'ta', つ: 'ta', て: 'ta', と: 'ta',
  だ: 'ta', ぢ: 'ta', づ: 'ta', で: 'ta', ど: 'ta',
  な: 'na', に: 'na', ぬ: 'na', ね: 'na', の: 'na',
  は: 'ha', ひ: 'ha', ふ: 'ha', へ: 'ha', ほ: 'ha',
  ば: 'ha', び: 'ha', ぶ: 'ha', べ: 'ha', ぼ: 'ha',
  ぱ: 'ha', ぴ: 'ha', ぷ: 'ha', ぺ: 'ha', ぽ: 'ha',
  ま: 'ma', み: 'ma', む: 'ma', め: 'ma', も: 'ma',
  や: 'ya', ゆ: 'ya', よ: 'ya',
  ら: 'ra', り: 'ra', る: 'ra', れ: 'ra', ろ: 'ra',
  わ: 'wa', を: 'wa', ん: 'wa'
}

export interface DmmPageFetcher {
  getText(
    url: string,
    options?: {
      headers?: Record<string, string>
      cookies?: Record<string, string>
      followRedirect?: boolean
      timeoutMs?: number
    }
  ): Promise<{ text: string }>
}

// 取演员名的首字作为假名行键；日文汉字/片假名/拉丁名都尽量映射，映射不到返回 null。
function syllabaryKey(name: string): string | null {
  const trimmed = name.trim()
  if (!trimmed) return null
  const ch = trimmed[0]
  if (HIRAGANA_ROW[ch]) return HIRAGANA_ROW[ch]
  // 片假名 → 平假名（U+30A1..U+30F6 段）
  const code = ch.codePointAt(0) ?? 0
  if (code >= 0x30a1 && code <= 0x30f6) {
    const hira = String.fromCodePoint(code - 0x60)
    if (HIRAGANA_ROW[hira]) return HIRAGANA_ROW[hira]
  }
  // 拉丁字母首字（A-Z / a-z）直接用作行键，DMM 对 a/ka 等均接受
  if (/^[A-Za-z]$/.test(ch)) return ch.toLowerCase()
  return null
}

// 从 DMM 女优一覧页解析出 { 日文名: 大图 URL }。大图由 medium URL 去掉 /medium/ 得到。
export function parseActressPage(html: string): Map<string, string> {
  const out = new Map<string, string>()
  let m: RegExpExecArray | null
  ITEM_RE.lastIndex = 0
  while ((m = ITEM_RE.exec(html)) !== null) {
    const mediumUrl = m[1]
    const jpName = m[2]
    if (!mediumUrl || !jpName) continue
    const large = mediumUrl.replace('/mono/actjpgs/medium/', '/mono/actjpgs/')
    out.set(jpName, large)
  }
  return out
}

// 按演员日文名查 DMM 无防盗链头像大图 URL。
// - 只在 Infuse 目标平台需要远程 URL 时调用
// - 查不到（汉字首字无法定位假名行、页内无同名条目、网络失败）返回 undefined，调用方据此跳过该演员
export async function findDmmActressAvatar(
  http: DmmPageFetcher,
  actorName: string
): Promise<string | undefined> {
  const key = syllabaryKey(actorName)
  if (!key) return undefined
  let text: string
  try {
    const res = await http.getText(`${ACTRESS_PAGE}${encodeURIComponent(key)}/`, {
      headers: { 'User-Agent': DMM_UA },
      cookies: { age_check_done: '1' },
      followRedirect: true
    })
    text = res.text
  } catch {
    return undefined
  }
  const map = parseActressPage(text)
  // 精确匹配；DMM 列表名可能带空格差异，做一次去空白兜底
  if (map.has(actorName)) return map.get(actorName)
  const normTarget = actorName.replace(/\s+/g, '')
  for (const [name, url] of map) {
    if (name.replace(/\s+/g, '') === normTarget) return url
  }
  return undefined
}
