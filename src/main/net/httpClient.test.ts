import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  HttpError,
  HttpClient,
  backoffDelay,
  bodyToText,
  isRetryableError,
  mergeHeaders
} from './httpClient'

function okResponse(status = 200, body = 'ok') {
  return {
    status,
    headers: {},
    body: Buffer.from(body, 'utf8')
  }
}

function fakeTransport(impl: (url: string, attempt: number) => Promise<unknown>) {
  let calls = 0
  const fn = (url: string): Promise<unknown> => {
    calls += 1
    return impl(url, calls)
  }
  return { fn, get calls(): number { return calls } }
}

function immediateSleep(): (ms: number) => Promise<void> {
  return async () => {}
}

describe('mergeHeaders', () => {
  it('统一小写键并让额外头覆盖基础头', () => {
    const merged = mergeHeaders(
      { 'User-Agent': 'a', Accept: 'text/html' },
      { 'user-agent': 'b', 'X-Test': '1' }
    )
    assert.equal(merged['user-agent'], 'b')
    assert.equal(merged['accept'], 'text/html')
    assert.equal(merged['x-test'], '1')
  })
})

describe('isRetryableError', () => {
  it('网络错误可重试', () => {
    assert.equal(isRetryableError(new Error('boom')), true)
    assert.equal(isRetryableError(new HttpError('u', null, 'e')), true)
  })

  it('4xx 不可重试，除 408/429', () => {
    assert.equal(isRetryableError(new HttpError('u', 404, 'nf')), false)
    assert.equal(isRetryableError(new HttpError('u', 403, 'fb')), false)
    assert.equal(isRetryableError(new HttpError('u', 429, 'rl')), true)
    assert.equal(isRetryableError(new HttpError('u', 408, 'to')), true)
  })

  it('5xx 可重试', () => {
    assert.equal(isRetryableError(new HttpError('u', 500, 'e')), true)
    assert.equal(isRetryableError(new HttpError('u', 503, 'e')), true)
  })
})

describe('backoffDelay', () => {
  it('随尝试次数指数增长且含抖动', () => {
    const d0 = backoffDelay(0, 100)
    const d3 = backoffDelay(3, 100)
    assert.ok(d0 < d3, `${d0} < ${d3}`)
    assert.ok(d3 <= 100 * 2 ** 3 + 100)
  })
})

describe('bodyToText', () => {
  it('优先使用 content-type charset', () => {
    const payload = Buffer.from([0x63, 0x61, 0x66, 0xe9])
    const text = bodyToText(payload, {
      'content-type': 'text/html; charset=ISO-8859-1'
    })
    assert.equal(text, 'café')
  })

  it('无 charset 时按 meta charset 探测', () => {
    const html =
      '<html><head><meta charset="euc-jp"></head><body>テスト</body></html>'
    const text = bodyToText(Buffer.from(html, 'utf8'), { 'content-type': 'text/html' })
    assert.ok(text.includes('テスト'))
  })
})

describe('HttpClient 请求', () => {
  it('成功时只调用一次 transport', async () => {
    const t = fakeTransport(async () => okResponse(200, 'hi'))
    const client = new HttpClient({
      retries: 3,
      transport: t.fn as never,
      sleep: immediateSleep()
    })
    const res = await client.get('https://example.com')
    assert.equal(res.status, 200)
    assert.equal(t.calls, 1)
  })

  it('网络错误按 retries 次数重试后抛出', async () => {
    const t = fakeTransport(async () => {
      throw new Error('connection reset')
    })
    const client = new HttpClient({
      retries: 2,
      transport: t.fn as never,
      sleep: immediateSleep()
    })
    await assert.rejects(() => client.get('https://example.com'), /请求失败/)
    assert.equal(t.calls, 3)
  })

  it('503 触发重试直到成功', async () => {
    let attempt = 0
    const t = fakeTransport(async () => {
      attempt += 1
      if (attempt < 3) throw new HttpError('u', 503, 'busy')
      return okResponse(200, 'recovered')
    })
    const client = new HttpClient({
      retries: 3,
      transport: t.fn as never,
      sleep: immediateSleep()
    })
    const res = await client.getText('https://example.com')
    assert.equal(res.text, 'recovered')
    assert.equal(t.calls, 3)
  })

  it('404 不重试直接抛出', async () => {
    const t = fakeTransport(async () => {
      throw new HttpError('u', 404, 'not found')
    })
    const client = new HttpClient({
      retries: 3,
      transport: t.fn as never,
      sleep: immediateSleep()
    })
    await assert.rejects(
      () => client.get('https://example.com'),
      (err: unknown) => err instanceof HttpError && err.status === 404
    )
    assert.equal(t.calls, 1)
  })

  it('携带 cookie 并透传自定义头', async () => {
    let received: Record<string, string> = {}
    const transport = (async (
      _url: string,
      opts: { headers: Record<string, string> }
    ) => {
      received = opts.headers
      return okResponse()
    }) as never
    const client = new HttpClient({
      transport,
      sleep: immediateSleep()
    })
    await client.get('https://example.com', {
      cookies: { sid: 'abc', theme: 'dark' },
      headers: { referer: 'https://x.test' }
    })
    assert.equal(received['cookie'], 'sid=abc; theme=dark')
    assert.equal(received['referer'], 'https://x.test')
    assert.ok(received['user-agent'])
  })
})

describe('HttpClient 限流间隔', () => {
  it('连续请求按 intervalMs 间隔发起', async () => {
    const sleeps: number[] = []
    let clock = 1000
    const t = fakeTransport(async () => okResponse())
    const client = new HttpClient({
      intervalMs: 200,
      transport: t.fn as never,
      now: () => clock,
      sleep: async (ms) => {
        sleeps.push(ms)
        clock += ms
      }
    })
    await client.get('https://example.com/a')
    assert.deepEqual(sleeps, [])
    await client.get('https://example.com/b')
    assert.equal(t.calls, 2)
    assert.ok(sleeps.some((ms) => ms > 0), '第二次请求前应等待间隔')
  })
})
