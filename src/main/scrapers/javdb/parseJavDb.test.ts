import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJavDbSearchUrl,
  buildJavDbUrl,
  extractJavDbSearchDetailUrl,
  parseJavDbDetail
} from './parseJavDb'

// 结构对齐 javdb.com 真实详情页：nav.movie-panel-info、strong.current-title、
// img src 在 class 前、演员 panel-block 含 ♀/♂ 性别符号
const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><title>SSIS-001 - JavDB</title></head><body>
<h2 class="title">
  <strong>SSIS-001</strong>
  <strong class="current-title">某個超棒的作品</strong>
</h2>
<a class="column-video-cover" href="https://c0.jdbstatic.com/covers/large/ssis001.jpg">
  <img src="https://c0.jdbstatic.com/covers/zy/ZY5eq.jpg" class="video-cover" loading="lazy"/>
</a>
<nav class="panel movie-panel-info">
  <div class="panel-block"><strong>番號:</strong> SSIS-001</div>
  <div class="panel-block"><strong>時間:</strong> 2024-03-15</div>
  <div class="panel-block"><strong>時長:</strong> 120 分鐘</div>
  <div class="panel-block"><strong>導演:</strong> 某導演</div>
  <div class="panel-block"><strong>片商:</strong> S1 NO.1 STYLE</div>
  <div class="panel-block"><strong>發行:</strong> 某發行</div>
  <div class="panel-block"><strong>系列:</strong> 某系列</div>
  <div class="panel-block"><strong>類別:</strong>
    <a href="/tags/1">角色扮演</a>
    <a href="/tags/2">劇情</a>
  </div>
  <div class="panel-block"><strong>演員:</strong>
    <a href="/actors/1">女優A ♀</a>
    <a href="/actors/2">男優B ♂</a>
  </div>
</nav>
<div class="preview-images">
  <a href="https://c0.jdbstatic.com/samples/zy/ZY5eq_l_0.jpg"><img src="https://c0.jdbstatic.com/samples/zy/ZY5eq_l_0.jpg"/></a>
  <a href="https://c0.jdbstatic.com/samples/zy/ZY5eq_l_1.jpg"><img src="https://c0.jdbstatic.com/samples/zy/ZY5eq_l_1.jpg"/></a>
</div>
</body></html>`

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html><head><title>页面不存在 - JavDB</title></head>
<body><div>你所浏览的页面不存在</div></body></html>`

const SEARCH_HTML = `<!DOCTYPE html>
<html><body>
<a class="box" href="/v/abc123"><div class="uid"><strong>SSIS-001</strong></div></a>
<a class="box" href="/v/xyz999"><div class="uid"><strong>SSIS-999</strong></div></a>
</body></html>`

const BASE = 'https://javdb.com/'

test('parseJavDbDetail 提取完整字段', () => {
  const data = parseJavDbDetail(SAMPLE_HTML, BASE, BASE + 'v/abc')
  assert.ok(data)
  assert.equal(data!.number, 'SSIS-001')
  assert.match(data!.title, /某個超棒的作品/)
  assert.equal(
    data!.coverUrl,
    'https://c0.jdbstatic.com/covers/zy/ZY5eq.jpg'
  )
  assert.equal(data!.releaseDate, '2024-03-15')
  assert.equal(data!.runtimeMin, 120)
  assert.equal(data!.director, '某導演')
  assert.equal(data!.maker, 'S1 NO.1 STYLE')
  assert.equal(data!.publisher, '某發行')
  assert.equal(data!.series, '某系列')
  assert.deepEqual(data!.genres, ['角色扮演', '劇情'])
  // 男演员 ♂ 应被过滤，只保留女演员
  assert.equal(data!.actors.length, 1)
  assert.equal(data!.actors[0].name, '女優A')
  assert.equal(data!.sampleUrls.length, 2)
  assert.equal(data!.sourceUrl, BASE + 'v/abc')
})

test('parseJavDbDetail 404 返回 null', () => {
  assert.equal(parseJavDbDetail(NOT_FOUND_HTML, BASE, BASE + 'v/xyz'), null)
})

test('parseJavDbDetail 缺字段不报错', () => {
  const html = `<html><body><h2 class="title"><strong class="current-title">只有标题</strong></h2></body></html>`
  const data = parseJavDbDetail(html, BASE, BASE + 'v/x')
  assert.ok(data)
  assert.equal(data!.number, '')
  assert.equal(data!.actors.length, 0)
})

test('extractJavDbSearchDetailUrl 返回首个 /v/ 链接', () => {
  assert.equal(
    extractJavDbSearchDetailUrl(SEARCH_HTML, BASE, 'SSIS-001'),
    'https://javdb.com/v/abc123'
  )
  assert.equal(
    extractJavDbSearchDetailUrl('<html><a class="box" href="/other">x</a></html>', BASE, 'X'),
    null
  )
})

test('buildJavDbUrl 与搜索地址编码番号', () => {
  assert.equal(buildJavDbUrl('SSIS-001'), 'https://javdb.com/v/SSIS-001')
  assert.match(buildJavDbSearchUrl('SSIS 001'), /q=SSIS%20001/)
})
