import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildJav321SearchUrl,
  buildJav321DirectUrl,
  extractJav321SearchDetailUrl,
  parseJav321Detail
} from './parseJav321'

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head><title>SSIS-001 - Jav321</title></head><body>
<h3 class="post-title entry-title">SSIS-001 某個標題</h3>
<img class="img-responsive attachment-post-thumbnail" src="http://pics.dmm.co.jp/digital/video/ssis00001/ssis00001ps.jpg"/>
<div class="row">
<p><b>番號:</b> SSIS-001</p>
<p><b>發行日期:</b> 2024-03-15</p>
<p><b>長度:</b> 120 分鐘</p>
<p><b>導演:</b> 某導演</p>
<p><b>製作商:</b> S1 NO.1 STYLE</p>
<p><b>發行商:</b> 某發行</p>
<p><b>系列:</b> 某系列</p>
<p><b>標籤:</b> 角色扮演, 劇情, 巨乳</p>
<p><b>演員:</b> <a href="/star/xxx">女優A</a> <a href="/star/yyy">女優B</a></p>
</div>
<div class="gallery">
  <a href="https://www.jav321.com/images/1.jpg">img</a>
  <a href="https://www.jav321.com/images/2.jpg">img</a>
</div>
</body></html>`

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html><head><title>404 Not Found</title></head><body>404 Not Found</body></html>`

const SEARCH_HTML = `<!DOCTYPE html>
<html><body>
<a href="https://www.jav321.com/video/ssis00001">SSIS-001</a>
<a href="https://www.jav321.com/video/ssis99999">SSIS-999</a>
</body></html>`

const BASE = 'https://www.jav321.com/'

test('parseJav321Detail 提取完整字段', () => {
  const data = parseJav321Detail(SAMPLE_HTML, BASE, BASE + 'video/ssis00001')
  assert.ok(data)
  assert.equal(data!.number, 'SSIS-001')
  assert.match(data!.title, /某個標題/)
  assert.equal(
    data!.coverUrl,
    'http://pics.dmm.co.jp/digital/video/ssis00001/ssis00001ps.jpg'
  )
  assert.equal(data!.releaseDate, '2024-03-15')
  assert.equal(data!.runtimeMin, 120)
  assert.equal(data!.director, '某導演')
  assert.equal(data!.maker, 'S1 NO.1 STYLE')
  assert.equal(data!.publisher, '某發行')
  assert.equal(data!.series, '某系列')
  assert.deepEqual(data!.genres, ['角色扮演', '劇情', '巨乳'])
  assert.equal(data!.actors.length, 2)
  assert.equal(data!.actors[0].name, '女優A')
  assert.equal(data!.sampleUrls.length, 2)
  assert.equal(data!.sourceUrl, BASE + 'video/ssis00001')
})

test('parseJav321Detail 404 返回 null', () => {
  assert.equal(
    parseJav321Detail(NOT_FOUND_HTML, BASE, BASE + 'video/notfound'),
    null
  )
})

test('parseJav321Detail 缺字段不报错', () => {
  const html = `<html><body><h3 class="post-title">只有标题</h3></body></html>`
  const data = parseJav321Detail(html, BASE, BASE + 'video/x')
  assert.ok(data)
  assert.equal(data!.number, '')
  assert.equal(data!.actors.length, 0)
  assert.equal(data!.sampleUrls.length, 0)
})

test('extractJav321SearchDetailUrl 返回首个视频链接', () => {
  assert.equal(
    extractJav321SearchDetailUrl(SEARCH_HTML, BASE, 'SSIS-001'),
    'https://www.jav321.com/video/ssis00001'
  )
  assert.equal(
    extractJav321SearchDetailUrl('<html>no links</html>', BASE, 'MISSING'),
    null
  )
})

test('buildJav321DirectUrl 与搜索地址', () => {
  assert.equal(
    buildJav321DirectUrl('SSIS-001'),
    'https://www.jav321.com/video/SSIS-001'
  )
  assert.match(buildJav321SearchUrl('SSIS-001'), /search\/SSIS-001/)
})
