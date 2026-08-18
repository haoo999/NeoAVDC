import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildHeyzoCoverUrl,
  buildHeyzoSampleUrls,
  buildHeyzoUrl,
  extractHeyzoId,
  isHeyzoNumber,
  parseHeyzoDetail
} from './parseHeyzo'

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head>
<title>HEYZO-2800 sample title | HEYZO</title>
<script type="application/ld+json">
{
  "@context": "http://schema.org",
  "@type": "Movie",
  "name":"アナル開発希望！な熟女の願い叶えます！！",
  "image":"//www.heyzo.com/contents/3000/2800/images/player_thumbnail.jpg",
  "actor":{ "@type":"Person","name":"上原ゆあ","image":"//www.heyzo.com/contents/3000/2800/images/thumbnail.jpg" },
  "description":"若いころは可愛い雰囲気の女優さんです。",
  "duration":"PT1H1M24S",
  "dateCreated":"2022-05-17"
}
</script>
</head><body>
<h1>アナル開発希望！な熟女の願い叶えます！！</h1>
<table class="movieInfo">
  <tr class="table-release-day"><td>公開日</td><td>2022-05-17</td></tr>
  <tr class="table-actor"><td>出演</td><td>
    <a href="/listpages/actor_1234_1.html?sort=pop"><span>上原ゆあ</span></a>&nbsp;
  </td></tr>
  <tr class="table-tag-keyword-big">
    <td>タグキーワード</td>
    <td><ul class="tag-keyword-list">
      <li><a href="/search/%E3%82%A2%E3%83%8A%E3%83%AB/1.html">アナル</a></li>
      <li><a href="/search/%E4%B8%AD%E5%87%BA%E3%81%97/1.html">中出し</a></li>
    </ul></td>
  </tr>
</table>
<p class="memo">若いころは可愛い雰囲気の女優さんです。</p>
</body></html>`

const SOFT_404 = `<!DOCTYPE html><html><body>
<h1>お探しの作品は見つかりません</h1></body></html>`

test('extractHeyzoId 从各种写法中提取数字 ID', () => {
  assert.equal(extractHeyzoId('HEYZO-2800'), '2800')
  assert.equal(extractHeyzoId('heyzo_2800'), '2800')
  assert.equal(extractHeyzoId('heyzo 2800'), '2800')
  // parseNumber 会把 1-3 位编号补零到 4 位，URL 中必须去零
  assert.equal(extractHeyzoId('HEYZO-0001'), '1')
  assert.equal(extractHeyzoId('2800'), '2800')
  assert.equal(extractHeyzoId('SSIS-001'), '')
})

test('buildHeyzoUrl / buildHeyzoCoverUrl 生成确定性 URL', () => {
  assert.equal(
    buildHeyzoUrl('HEYZO-2800'),
    'https://www.heyzo.com/moviepages/2800/index.html'
  )
  assert.equal(
    buildHeyzoCoverUrl('HEYZO-2800'),
    'https://www.heyzo.com/contents/3000/2800/images/player_thumbnail.jpg'
  )
})

test('buildHeyzoSampleUrls 返回 capture1..capture11', () => {
  const urls = buildHeyzoSampleUrls('HEYZO-2800')
  assert.equal(urls.length, 11)
  assert.equal(
    urls[0],
    'https://www.heyzo.com/contents/3000/2800/images/capture1.jpg'
  )
  assert.equal(
    urls[10],
    'https://www.heyzo.com/contents/3000/2800/images/capture11.jpg'
  )
})

test('isHeyzoNumber 识别 HEYZO 番号', () => {
  assert.equal(isHeyzoNumber(null, 'HEYZO-2800'), true)
  assert.equal(isHeyzoNumber(null, 'heyzo_0001'), true)
  assert.equal(isHeyzoNumber(null, 'SSIS-001'), false)
})

test('parseHeyzoDetail 从完整 HTML 提取字段', () => {
  const url = 'https://www.heyzo.com/moviepages/2800/index.html'
  const data = parseHeyzoDetail(SAMPLE_HTML, url, 'HEYZO-2800')
  assert.ok(data)
  assert.equal(data!.number, 'HEYZO-2800')
  assert.equal(data!.title, 'アナル開発希望！な熟女の願い叶えます！！')
  assert.equal(
    data!.coverUrl,
    'https://www.heyzo.com/contents/3000/2800/images/player_thumbnail.jpg'
  )
  assert.equal(data!.maker, 'HEYZO')
  assert.equal(data!.publisher, 'HEYZO')
  assert.equal(data!.releaseDate, '2022-05-17')
  assert.equal(data!.runtimeMin, 61)
  assert.equal(data!.isUncensored, true)
  assert.equal(data!.posterNoCrop, true)
  assert.ok(data!.outline && data!.outline.length > 0)
  assert.deepEqual(data!.actors.map((a) => a.name), ['上原ゆあ'])
  assert.ok(data!.actors[0].avatarUrl?.includes('actor_1234') === false)
  assert.ok(data!.genres.includes('アナル'))
  assert.ok(data!.genres.includes('中出し'))
  assert.equal(data!.sampleUrls.length, 11)
  assert.equal(data!.sourceUrl, url)
})

test('parseHeyzoDetail 处理协议相对 URL', () => {
  const html = SAMPLE_HTML.replace(
    '"//www.heyzo.com/contents/3000/2800/images/player_thumbnail.jpg"',
    '"//www.heyzo.com/contents/3000/2800/images/player_thumbnail.jpg"'
  )
  const data = parseHeyzoDetail(
    html,
    'https://www.heyzo.com/moviepages/2800/index.html',
    'HEYZO-2800'
  )
  assert.ok(data!.coverUrl?.startsWith('https://'))
})

test('parseHeyzoDetail 对软 404 页面不做特判（由 Source 层拦截）', () => {
  // 软 404 检测在 HeyzoSource.isSoftNotFound 完成；parser 只负责尽力解析
  const data = parseHeyzoDetail(
    SOFT_404,
    'https://www.heyzo.com/moviepages/9999999/index.html',
    'HEYZO-9999999'
  )
  // 没有 JSON-LD name 时会兜底使用 <h1>，因此这里返回的是错误标题
  // Source 层应在调用 parser 之前用 isSoftNotFound 拦截
  assert.ok(data)
  assert.equal(data!.title, 'お探しの作品は見つかりません')
})

test('parseHeyzoDetail 对空字符串返回 null', () => {
  assert.equal(parseHeyzoDetail('', 'https://x', 'HEYZO-1'), null)
})
