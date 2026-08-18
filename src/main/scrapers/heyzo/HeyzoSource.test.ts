import { test } from 'node:test'
import assert from 'node:assert/strict'
import { HeyzoSource } from './HeyzoSource'
import type { ScrapeContext } from '../types'
import type { HttpClient } from '../../net/httpClient'

function makeCtx(getText: (url: string, opts?: unknown) => Promise<{ text: string; status: number; finalUrl: string }>): ScrapeContext {
  return { http: { getText } as unknown as HttpClient }
}

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head>
<script type="application/ld+json">
{"@type":"Movie","name":"HEYZO Sample","image":"//www.heyzo.com/contents/3000/2800/images/player_thumbnail.jpg","actor":{"name":"女優A"},"duration":"PT25M","dateCreated":"2022-05-17"}
</script></head><body>
<h1>HEYZO Sample</h1>
<tr class="table-actor"><td>出演</td><td><a href="/listpages/actor_1234_1.html"><span>女優A</span></a></td></tr>
</body></html>`

const SOFT_404 = `<html><body><h1>お探しの作品は見つかりません</h1></body></html>`

test('HeyzoSource 对非 HEYZO 番号直接 not_found', async () => {
  const src = new HeyzoSource()
  const ctx = makeCtx(async () => {
    throw new Error('不应被调用')
  })
  const r = await src.scrape(ctx, 'SSIS-001', null)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'not_found')
})

test('HeyzoSource 成功抓取详情', async () => {
  const src = new HeyzoSource()
  let requestedUrl = ''
  const ctx = makeCtx(async (url) => {
    requestedUrl = url
    return { text: SAMPLE_HTML, status: 200, finalUrl: url }
  })
  const r = await src.scrape(ctx, 'HEYZO-2800', null)
  assert.equal(r.ok, true)
  assert.match(requestedUrl, /moviepages\/2800\/index\.html/)
  if (r.ok) {
    assert.equal(r.data.number, 'HEYZO-2800')
    assert.equal(r.data.title, 'HEYZO Sample')
    assert.equal(r.data.isUncensored, true)
    assert.equal(r.data.posterNoCrop, true)
    assert.equal(r.data.runtimeMin, 25)
  }
})

test('HeyzoSource 对 HTTP 404 返回 not_found', async () => {
  const src = new HeyzoSource()
  const ctx = makeCtx(async () => {
    const err = new Error('Not Found') as Error & { status: number }
    err.status = 404
    throw err
  })
  const r = await src.scrape(ctx, 'HEYZO-9999999', null)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'not_found')
})

test('HeyzoSource 对软 404 页面返回 not_found', async () => {
  const src = new HeyzoSource()
  const ctx = makeCtx(async (url) => ({
    text: SOFT_404,
    status: 200,
    finalUrl: url
  }))
  const r = await src.scrape(ctx, 'HEYZO-9999999', null)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'not_found')
})

test('HeyzoSource 对其它错误返回 error', async () => {
  const src = new HeyzoSource()
  const ctx = makeCtx(async () => {
    throw new Error('network boom')
  })
  const r = await src.scrape(ctx, 'HEYZO-2800', null)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'error')
    assert.match(r.message, /network boom/)
  }
})
