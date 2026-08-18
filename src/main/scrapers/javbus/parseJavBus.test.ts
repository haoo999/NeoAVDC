import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJavBusSearchUrl,
  buildJavBusUrl,
  decodeHtmlEntities,
  extractSearchDetailUrl,
  isNotFound,
  parseJavBusDetail,
  stripTags
} from './parseJavBus'

const SAMPLE_HTML = `<!DOCTYPE html>
<html>
<head><title>ABC-123 - JavBus</title></head>
<body>
<div class="container">
  <h3>ABC-123 某個超棒的作品標題</h3>
  <div class="row">
    <div class="col-md-9 screencap">
      <a class="bigImage" href="https://www.javbus.com/images/cover/abc123b.jpg">
        <img src="https://www.javbus.com/images/cover/abc123.jpg" title="cover"/>
      </a>
    </div>
    <div class="col-md-3 info">
      <p><span class="header">識別碼:</span> <span style="color:#CC0000;">ABC-123</span></p>
      <p><span class="header">發行日期:</span> 2024-03-15</p>
      <p><span class="header">長度:</span> 120 分鐘</p>
      <p><span class="header">導演:</span> <a href="https://www.javbus.com/director/1">某導演</a></p>
      <p><span class="header">製作商:</span> <a href="https://www.javbus.com/studio/1">某製作商</a></p>
      <p><span class="header">發行商:</span> <a href="https://www.javbus.com/label/1">某發行商</a></p>
      <p><span class="header">系列:</span> <a href="https://www.javbus.com/series/1">某系列</a></p>
      <p>
        <span class="genre"><label><a href="https://www.javbus.com/genre/1">角色扮演</a></label></span>
        <span class="genre"><label><a href="https://www.javbus.com/genre/2">劇情</a></label></span>
      </p>
    </div>
  </div>
</div>
<div id="sample-waterfall" class="sample-box">
  <a class="sample-box" href="https://www.javbus.com/images/sample/1.jpg"><img src="https://www.javbus.com/images/sample/1s.jpg"/></a>
  <a class="sample-box" href="https://www.javbus.com/images/sample/2.jpg"><img src="https://www.javbus.com/images/sample/2s.jpg"/></a>
</div>
<div id="avatar-waterfall">
  <a class="avatar-box" href="https://www.javbus.com/star/1">
    <div class="photo-frame"><img src="https://www.javbus.com/images/actress/1.jpg" title="女優A"/></div>
    <span>女優A</span>
  </a>
  <a class="avatar-box" href="https://www.javbus.com/star/2">
    <div class="photo-frame"><img src="https://www.javbus.com/images/actress/nowprinting.gif" title=""/></div>
    <span>女優B</span>
  </a>
  <a class="avatar-box" href="https://www.javbus.com/male/9">
    <div class="photo-frame"><img src="https://www.javbus.com/images/actor/9.jpg" title="男優X"/></div>
    <span>男優X</span>
  </a>
</div>
</body>
</html>`

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html><head><title>404 Page Not Found! - JavBus</title></head>
<body><h1>404 Page Not Found!</h1></body></html>`

const SEARCH_HTML = `<!DOCTYPE html>
<html><body>
<div id="waterfall">
  <a class="movie-box" href="https://www.javbus.com/ABC-123">
    <div class="photo-info"><span>2024-03-15</span><date>ABC-123</date></div>
  </a>
  <a class="movie-box" href="https://www.javbus.com/ABC-124">
    <div class="photo-info"><span>2024-04-01</span><date>ABC-124</date></div>
  </a>
</div>
</body></html>`

test('decodeHtmlEntities 解码常见实体', () => {
  assert.equal(decodeHtmlEntities('a&amp;b&nbsp;&lt;&gt;'), 'a&b <>')
})

test('stripTags 去除标签并裁剪空白', () => {
  assert.equal(stripTags('<a href="#">  文本<br/>  </a>'), '文本')
})

test('isNotFound 识别 404 页面', () => {
  assert.equal(isNotFound(NOT_FOUND_HTML), true)
  assert.equal(isNotFound(SAMPLE_HTML), false)
})

test('buildJavBusUrl 有码/无码路径', () => {
  assert.equal(buildJavBusUrl('ABC-123', false), 'https://www.javbus.com/ABC-123')
  assert.equal(buildJavBusUrl('1234-123', true), 'https://www.javbus.com/uncensored/1234-123')
})

test('buildJavBusSearchUrl 搜索路径带 type=1', () => {
  assert.equal(
    buildJavBusSearchUrl('ABC-123', false),
    'https://www.javbus.com/search/ABC-123&type=1'
  )
})

test('parseJavBusDetail 完整提取字段', () => {
  const data = parseJavBusDetail(SAMPLE_HTML, 'https://www.javbus.com', 'https://www.javbus.com/ABC-123')
  assert.ok(data)
  assert.equal(data!.number, 'ABC-123')
  assert.equal(data!.title, 'ABC-123 某個超棒的作品標題')
  assert.equal(data!.coverUrl, 'https://www.javbus.com/images/cover/abc123b.jpg')
  assert.equal(data!.releaseDate, '2024-03-15')
  assert.equal(data!.runtimeMin, 120)
  assert.equal(data!.director, '某導演')
  assert.equal(data!.maker, '某製作商')
  assert.equal(data!.publisher, '某發行商')
  assert.equal(data!.series, '某系列')
  assert.deepEqual(data!.genres, ['角色扮演', '劇情'])
  assert.equal(data!.actors.length, 2)
  assert.equal(data!.actors[0].name, '女優A')
  assert.equal(data!.actors[0].avatarUrl, 'https://www.javbus.com/images/actress/1.jpg')
  assert.equal(data!.actors[1].name, '女優B')
  assert.equal(data!.actors[1].avatarUrl, undefined)
  assert.ok(
    !data!.actors.some(a => a.name === '男優X'),
    '男优应被剔除，只保留女优'
  )
  assert.equal(data!.sampleUrls.length, 2)
  assert.equal(data!.sourceUrl, 'https://www.javbus.com/ABC-123')
  assert.equal(data!.isUncensored, false)
})

test('parseJavBusDetail 404 返回 null', () => {
  assert.equal(parseJavBusDetail(NOT_FOUND_HTML, 'https://www.javbus.com', 'x'), null)
})

test('parseJavBusDetail 缺失字段不报错', () => {
  const minimal = `<html><body><div class="container"><h3>TTT-001 只有標題</h3></div>
    <div class="row"><div class="col-md-3 info"></div><div></div></div></body></html>`
  const data = parseJavBusDetail(minimal, 'https://www.javbus.com', 'u')
  assert.ok(data)
  assert.equal(data!.title, 'TTT-001 只有標題')
  assert.equal(data!.number, '')
  assert.equal(data!.releaseDate, undefined)
  assert.equal(data!.runtimeMin, undefined)
  assert.deepEqual(data!.genres, [])
  assert.deepEqual(data!.actors, [])
})

test('extractSearchDetailUrl 按番号精确匹配', () => {
  const url = extractSearchDetailUrl(SEARCH_HTML, 'ABC-123', 'https://www.javbus.com')
  assert.equal(url, 'https://www.javbus.com/ABC-123')
})

test('extractSearchDetailUrl 匹配不到返回 null', () => {
  const url = extractSearchDetailUrl(SEARCH_HTML, 'ZZZ-999', 'https://www.javbus.com')
  assert.equal(url, null)
})

test('parseJavBusDetail 忽略 0000-00-00 占位日期', () => {
  const html = `<html><body><div class="container"><h3>X-1</h3></div>
    <div class="row"><div class="col-md-3 info">
    <p><span class="header">發行日期:</span> 0000-00-00</p>
    </div><div></div></div></body></html>`
  const data = parseJavBusDetail(html, 'https://www.javbus.com', 'u')
  assert.ok(data)
  assert.equal(data!.releaseDate, undefined)
})
