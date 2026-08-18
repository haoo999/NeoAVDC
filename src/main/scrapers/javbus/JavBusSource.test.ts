import { test } from 'node:test'
import assert from 'node:assert/strict'
import { JavBusSource } from './JavBusSource'
import { HttpError } from '../../net/httpClient'
import type { ScrapeContext } from '../types'

const DETAIL_HTML = `<html><head><title>ABC-123</title></head><body>
<div class="container"><h3>ABC-123 作品</h3></div>
<div class="row"><div class="col-md-3 info">
<p><span class="header">識別碼:</span> <span>ABC-123</span></p>
<p><span class="header">發行日期:</span> 2024-01-02</p>
</div><div></div></div>
</body></html>`

const SEARCH_HTML = `<html><body>
<div id="waterfall">
<a class="movie-box" href="https://www.javbus.com/ABC-123"><date>ABC-123</date></a>
</div></body></html>`

interface Call {
  url: string
  cookies?: Record<string, string>
}

function fakeCtx(
  routes: Record<string, { status?: number; text?: string; err?: unknown }>
): { ctx: ScrapeContext; calls: Call[] } {
  const calls: Call[] = []
  return {
    calls,
    ctx: {
      http: {
        async getText(url, options) {
          calls.push({ url, cookies: options?.cookies })
          const r = routes[url]
          if (!r) throw new HttpError(url, 404, 'HTTP 404')
          if (r.err) throw r.err
          return { status: r.status ?? 200, headers: {}, text: r.text ?? '' }
        }
      }
    }
  }
}

test('JavBusSource 直连命中时不触发搜索', async () => {
  const src = new JavBusSource()
  const { ctx, calls } = fakeCtx({
    'https://www.javbus.com/ABC-123': { text: DETAIL_HTML }
  })
  const out = await src.scrape(ctx, 'ABC-123', null)
  assert.equal(out.ok, true)
  if (out.ok) {
    assert.equal(out.data.number, 'ABC-123')
    assert.equal(out.data.title, 'ABC-123 作品')
  }
  assert.equal(calls.length, 1)
})

test('JavBusSource 直连 404 时回退搜索并携带 existmag cookie', async () => {
  const src = new JavBusSource()
  const searchHtml = SEARCH_HTML.replace(
    'href="https://www.javbus.com/ABC-123"',
    'href="https://www.javbus.com/ABC-123?from=search"'
  )
  const { ctx, calls } = fakeCtx({
    'https://www.javbus.com/ABC-123': { err: new HttpError('x', 404, 'HTTP 404') },
    'https://www.javbus.com/search/ABC-123&type=1': { text: searchHtml },
    'https://www.javbus.com/ABC-123?from=search': { text: DETAIL_HTML }
  })
  const out = await src.scrape(ctx, 'ABC-123', null)
  assert.equal(out.ok, true)
  assert.equal(calls[1].url, 'https://www.javbus.com/search/ABC-123&type=1')
  assert.deepEqual(calls[1].cookies, { existmag: 'all' })
  assert.equal(calls.length, 3)
})

test('JavBusSource 搜索结果为空返回 not_found', async () => {
  const src = new JavBusSource()
  const { ctx } = fakeCtx({
    'https://www.javbus.com/ABC-123': { err: new HttpError('x', 404, 'HTTP 404') },
    'https://www.javbus.com/search/ABC-123&type=1': { text: '<html></html>' }
  })
  const out = await src.scrape(ctx, 'ABC-123', null)
  assert.equal(out.ok, false)
  if (!out.ok) assert.equal(out.reason, 'not_found')
})

test('JavBusSource 无码番号根路径命中时不再请求 /uncensored/', async () => {
  const src = new JavBusSource()
  const { ctx, calls } = fakeCtx({
    'https://www.javbus.com/HEYZO-0123': {
      text: DETAIL_HTML.replace(/ABC-123/g, 'HEYZO-0123')
    }
  })
  const out = await src.scrape(ctx, 'HEYZO-0123', { isUncensored: true } as never)
  assert.equal(out.ok, true)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].url, 'https://www.javbus.com/HEYZO-0123')
})

test('JavBusSource 无码番号根路径 404 后回退 /uncensored/ 前缀', async () => {
  const src = new JavBusSource()
  const { ctx, calls } = fakeCtx({
    'https://www.javbus.com/1234-567': { err: new HttpError('x', 404, 'HTTP 404') },
    'https://www.javbus.com/uncensored/1234-567': {
      text: DETAIL_HTML.replace(/ABC-123/g, '1234-567')
    }
  })
  const out = await src.scrape(ctx, '1234-567', { isUncensored: true } as never)
  assert.equal(out.ok, true)
  assert.equal(calls[0].url, 'https://www.javbus.com/1234-567')
  assert.equal(calls[1].url, 'https://www.javbus.com/uncensored/1234-567')
  assert.equal(calls.length, 2)
})

test('JavBusSource 非 404 网络错误返回 error', async () => {
  const src = new JavBusSource()
  const { ctx } = fakeCtx({
    'https://www.javbus.com/ABC-123': { err: new HttpError('x', 500, 'HTTP 500') }
  })
  const out = await src.scrape(ctx, 'ABC-123', null)
  assert.equal(out.ok, false)
  if (!out.ok) {
    assert.equal(out.reason, 'error')
    assert.match(out.message, /500/)
  }
})
