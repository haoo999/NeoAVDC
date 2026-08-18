import { test } from 'node:test'
import assert from 'node:assert/strict'
import { Fc2Source } from './Fc2Source'
import type { ScrapeContext } from '../types'
import type { HttpClient } from '../../net/httpClient'

interface CallRecord {
  url: string
}

function makeCtx(
  handler: (url: string) => Promise<{ text: string; status: number; finalUrl: string }>
): { ctx: ScrapeContext; calls: CallRecord[] } {
  const calls: CallRecord[] = []
  return {
    ctx: {
      http: {
        async getText(url: string) {
          calls.push({ url })
          return handler(url)
        }
      } as unknown as HttpClient
    },
    calls
  }
}

const SAMPLE_HTML = `<html><head>
<meta property="og:title" content="FC2-PPV-4806136 sample" />
<meta property="og:image" content="https://storage500.contents.fc2.com/file/300/4806136/top.jpg" />
</head><body><span>販売日 : 2025/11/29</span></body></html>`

const TAG_JSON = '{"tags":[{"tag":"ハメ撮り"}]}'

const NOT_FOUND = `<html><body>お探しのコンテンツは見つかりません</body></html>`

test('Fc2Source 非 FC2 番号直接 not_found', async () => {
  const src = new Fc2Source()
  const { ctx } = makeCtx(async () => {
    throw new Error('不应被调用')
  })
  const r = await src.scrape(ctx, 'SSIS-001', null)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'not_found')
})

test('Fc2Source 成功抓取详情并附带标签 API 数据', async () => {
  const src = new Fc2Source()
  const { ctx, calls } = makeCtx(async (url) => {
    if (url.includes('/api/v4/article/')) {
      return { text: TAG_JSON, status: 200, finalUrl: url }
    }
    return { text: SAMPLE_HTML, status: 200, finalUrl: url }
  })
  const r = await src.scrape(ctx, 'FC2-PPV-4806136', { isFc2: true } as never)
  assert.equal(r.ok, true)
  if (r.ok) {
    assert.equal(r.data.number, 'FC2-PPV-4806136')
    assert.equal(r.data.title, 'sample')
    assert.equal(r.data.releaseDate, '2025-11-29')
    assert.equal(r.data.isUncensored, true)
    assert.equal(r.data.posterNoCrop, true)
    assert.ok(r.data.genres.includes('ハメ撮り'))
  }
  assert.ok(calls.some((c) => c.url.includes('/article/4806136/')))
  assert.ok(calls.some((c) => c.url.includes('/api/v4/article/4806136/tag')))
})

test('Fc2Source 标签 API 失败不阻断主流程', async () => {
  const src = new Fc2Source()
  const { ctx } = makeCtx(async (url) => {
    if (url.includes('/api/v4/article/')) {
      const err = new Error('tag api down') as Error & { status: number }
      err.status = 500
      throw err
    }
    return { text: SAMPLE_HTML, status: 200, finalUrl: url }
  })
  const r = await src.scrape(ctx, 'FC2-PPV-4806136', { isFc2: true } as never)
  assert.equal(r.ok, true)
})

test('Fc2Source HTTP 404 返回 not_found', async () => {
  const src = new Fc2Source()
  const { ctx } = makeCtx(async () => {
    const err = new Error('Not Found') as Error & { status: number }
    err.status = 404
    throw err
  })
  const r = await src.scrape(ctx, 'FC2-PPV-9999999', { isFc2: true } as never)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'not_found')
})

test('Fc2Source 软 404 页面返回 not_found', async () => {
  const src = new Fc2Source()
  const { ctx } = makeCtx(async (url) => ({
    text: NOT_FOUND,
    status: 200,
    finalUrl: url
  }))
  const r = await src.scrape(ctx, 'FC2-PPV-9999999', { isFc2: true } as never)
  assert.equal(r.ok, false)
  if (!r.ok) assert.equal(r.reason, 'not_found')
})

test('Fc2Source 其它网络错误返回 error', async () => {
  const src = new Fc2Source()
  const { ctx } = makeCtx(async () => {
    throw new Error('econnreset')
  })
  const r = await src.scrape(ctx, 'FC2-PPV-4806136', { isFc2: true } as never)
  assert.equal(r.ok, false)
  if (!r.ok) {
    assert.equal(r.reason, 'error')
    assert.match(r.message, /econnreset/)
  }
})
