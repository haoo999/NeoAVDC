import http from 'node:http'
import https from 'node:https'
import { StringDecoder } from 'node:string_decoder'
import { URL } from 'node:url'
import zlib from 'node:zlib'

export const DEFAULT_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export const RETRYABLE_STATUSES = new Set([408, 429, 500, 502, 503, 504])

export interface HttpResponse {
  status: number
  headers: Record<string, string>
  body: Buffer
}

export interface HttpRequestOptions {
  method?: 'GET' | 'POST'
  headers?: Record<string, string>
  cookies?: Record<string, string>
  timeoutMs?: number
  responseEncoding?: BufferEncoding
}

export interface HttpClientConfig {
  proxyUrl?: string
  userAgent?: string
  timeoutMs?: number
  retries?: number
  intervalMs?: number
  transport?: Transport
  sleep?: (ms: number) => Promise<void>
  now?: () => number
}

export type Transport = (
  url: string,
  options: TransportOptions
) => Promise<HttpResponse>

export interface TransportOptions {
  method: string
  headers: Record<string, string>
  timeoutMs: number
  proxyUrl: string
}

export class HttpError extends Error {
  readonly url: string
  readonly status: number | null
  readonly cause: unknown

  constructor(url: string, status: number | null, message: string, cause?: unknown) {
    super(message)
    this.name = 'HttpError'
    this.url = url
    this.status = status
    this.cause = cause
  }
}

export function parseProxyUrl(proxyUrl: string): URL | null {
  const trimmed = proxyUrl.trim()
  if (!trimmed) return null
  const url = new URL(trimmed)
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new HttpError(trimmed, null, `不支持的代理协议：${url.protocol}`)
  }
  return url
}

export function isRetryableError(err: unknown): boolean {
  if (err instanceof HttpError && err.status !== null) {
    return RETRYABLE_STATUSES.has(err.status)
  }
  return true
}

export function backoffDelay(attempt: number, baseMs: number): number {
  const exp = Math.min(attempt, 5)
  const jitter = Math.random() * baseMs
  return Math.floor(baseMs * 2 ** exp + jitter)
}

export function mergeHeaders(
  base: Record<string, string>,
  extra?: Record<string, string>
): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(base)) out[k.toLowerCase()] = v
  if (extra) {
    for (const [k, v] of Object.entries(extra)) out[k.toLowerCase()] = v
  }
  return out
}

function cookieHeader(cookies?: Record<string, string>): string | undefined {
  if (!cookies) return undefined
  const parts = Object.entries(cookies).map(([k, v]) => `${k}=${v}`)
  return parts.length > 0 ? parts.join('; ') : undefined
}

function decodeBody(buffer: Buffer, headers: Record<string, string>): Buffer {
  const encoding = (headers['content-encoding'] || '').toLowerCase()
  if (encoding.includes('gzip')) return zlib.gunzipSync(buffer)
  if (encoding.includes('deflate')) return zlib.inflateSync(buffer)
  if (encoding.includes('br')) return zlib.brotliDecompressSync(buffer)
  return buffer
}

export function normalizeCharset(charset: string): BufferEncoding {
  const c = charset.toLowerCase().replace(/[^a-z0-9]/g, '')
  if (c === 'iso88591' || c === 'latin1' || c === 'latin') return 'latin1'
  if (c === 'utf8' || c === 'utf-8') return 'utf8'
  if (c === 'ascii') return 'ascii'
  if (c === 'utf16le') return 'utf16le'
  return 'utf8'
}

export function bodyToText(body: Buffer, headers: Record<string, string>): string {
  const decoded = decodeBody(body, headers)
  const contentType = headers['content-type'] || ''
  const charset = /charset=([^;]+)/i.exec(contentType)?.[1]?.trim().toLowerCase()
  if (charset) {
    try {
      return decoded.toString(normalizeCharset(charset))
    } catch {
      // 回退到 meta 探测
    }
  }
  const head = decoded.subarray(0, 1024).toString('latin1')
  const meta = /<meta[^>]+charset=["']?([\w-]+)/i.exec(head)
  if (meta) {
    try {
      return decoded.toString(normalizeCharset(meta[1]))
    } catch {
      // 继续回退
    }
  }
  const decoder = new StringDecoder('utf8')
  return decoder.end(decoded)
}

export function nodeTransport(
  url: string,
  options: TransportOptions
): Promise<HttpResponse> {
  return new Promise((resolve, reject) => {
    const target = new URL(url)
    const isHttps = target.protocol === 'https:'
    const proxy = options.proxyUrl ? parseProxyUrl(options.proxyUrl) : null

    const headers: Record<string, string> = { ...options.headers }
    if (proxy && isHttps) {
      headers['host'] = target.host
    }

    const reqOptions: http.RequestOptions = {
      method: options.method,
      headers
    }

    let req: http.ClientRequest

    const onError = (err: Error): void => {
      reject(new HttpError(url, null, err.message, err))
    }

    if (proxy && isHttps) {
      const connectReq = http.request({
        host: proxy.hostname,
        port: proxy.port || 80,
        method: 'CONNECT',
        path: `${target.hostname}:${target.port || 443}`,
        headers: proxy.username
          ? {
              'proxy-authorization':
                'Basic ' +
                Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')
            }
          : undefined,
        timeout: options.timeoutMs
      })

      connectReq.on('connect', (res, sock) => {
        if (res.statusCode !== 200) {
          sock.destroy()
          reject(new HttpError(url, res.statusCode ?? null, `代理 CONNECT 失败：${res.statusCode}`))
          return
        }
        req = https.request(
          {
            ...reqOptions,
            hostname: target.hostname,
            port: target.port || 443,
            path: target.pathname + target.search,
            createConnection: () => sock
          },
          (res) => collectResponse(res, resolve, reject, url)
        )
        req.on('error', onError)
        req.setTimeout(options.timeoutMs, () => {
          req.destroy(new Error('请求超时'))
        })
        req.end()
      })
      connectReq.on('error', onError)
      connectReq.setTimeout(options.timeoutMs, () => {
        connectReq.destroy(new Error('代理连接超时'))
      })
      connectReq.end()
      return
    }

    if (proxy && !isHttps) {
      reqOptions.hostname = proxy.hostname
      reqOptions.port = proxy.port || 80
      reqOptions.path = target.href
      if (proxy.username) {
        headers['proxy-authorization'] =
          'Basic ' + Buffer.from(`${proxy.username}:${proxy.password}`).toString('base64')
      }
    } else {
      reqOptions.hostname = target.hostname
      reqOptions.port = target.port || (isHttps ? 443 : 80)
      reqOptions.path = target.pathname + target.search
    }

    const lib = isHttps ? https : http
    req = lib.request(reqOptions, (res) => collectResponse(res, resolve, reject, url))
    req.on('error', onError)
    req.setTimeout(options.timeoutMs, () => {
      req.destroy(new Error('请求超时'))
    })
    req.end()
  })
}

function collectResponse(
  res: http.IncomingMessage,
  resolve: (r: HttpResponse) => void,
  reject: (e: unknown) => void,
  url: string
): void {
  const chunks: Buffer[] = []
  res.on('data', (chunk: Buffer) => chunks.push(chunk))
  res.on('end', () => {
    const rawHeaders: Record<string, string> = {}
    for (let i = 0; i < res.rawHeaders.length; i += 2) {
      rawHeaders[res.rawHeaders[i].toLowerCase()] = res.rawHeaders[i + 1]
    }
    const body = Buffer.concat(chunks)
    if ((res.statusCode ?? 0) >= 400) {
      reject(new HttpError(url, res.statusCode ?? null, `HTTP ${res.statusCode}`))
      return
    }
    resolve({
      status: res.statusCode ?? 0,
      headers: rawHeaders,
      body
    })
  })
  res.on('error', (err) => {
    reject(new HttpError(url, res.statusCode ?? null, err.message, err))
  })
}

const defaultSleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms))

export class HttpClient {
  private readonly proxyUrl: string
  private readonly userAgent: string
  private readonly timeoutMs: number
  private readonly retries: number
  private readonly intervalMs: number
  private readonly transport: Transport
  private readonly sleep: (ms: number) => Promise<void>
  private readonly now: () => number
  private nextRequestAt = 0

  constructor(config: HttpClientConfig = {}) {
    this.proxyUrl = config.proxyUrl ?? ''
    this.userAgent = config.userAgent ?? DEFAULT_USER_AGENT
    this.timeoutMs = config.timeoutMs ?? 10000
    this.retries = Math.max(0, config.retries ?? 2)
    this.intervalMs = Math.max(0, config.intervalMs ?? 0)
    this.transport = config.transport ?? nodeTransport
    this.sleep = config.sleep ?? defaultSleep
    this.now = config.now ?? Date.now
  }

  async get(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<HttpResponse> {
    return this.request('GET', url, options)
  }

  async getText(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<{ status: number; headers: Record<string, string>; text: string }> {
    const res = await this.get(url, options)
    return { status: res.status, headers: res.headers, text: bodyToText(res.body, res.headers) }
  }

  async getBuffer(
    url: string,
    options: HttpRequestOptions = {}
  ): Promise<{ status: number; headers: Record<string, string>; buffer: Buffer }> {
    const res = await this.get(url, options)
    return {
      status: res.status,
      headers: res.headers,
      buffer: decodeBody(res.body, res.headers)
    }
  }

  private async request(
    method: 'GET' | 'POST',
    url: string,
    options: HttpRequestOptions
  ): Promise<HttpResponse> {
    const target = new URL(url)
    const origin = `${target.protocol}//${target.host}`
    const baseHeaders: Record<string, string> = {
      'user-agent': this.userAgent,
      accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8',
      'accept-encoding': 'gzip, deflate, br',
      referer: origin + '/',
      'upgrade-insecure-requests': '1',
      connection: 'keep-alive'
    }
    const cookie = cookieHeader(options.cookies)
    if (cookie) baseHeaders['cookie'] = cookie

    const headers = mergeHeaders(baseHeaders, options.headers)
    const timeoutMs = options.timeoutMs ?? this.timeoutMs

    let lastError: unknown = null
    for (let attempt = 0; attempt <= this.retries; attempt++) {
      await this.observeInterval()
      try {
        return await this.transport(url, {
          method,
          headers,
          timeoutMs,
          proxyUrl: this.proxyUrl
        })
      } catch (err) {
        lastError = err
        if (attempt >= this.retries || !isRetryableError(err)) {
          break
        }
        if (err instanceof HttpError && err.status === 429) {
          await this.sleep(this.intervalMs || 2000)
        } else {
          await this.sleep(backoffDelay(attempt, 500))
        }
      }
    }
    if (lastError instanceof HttpError) throw lastError
    throw new HttpError(url, null, '请求失败', lastError)
  }

  private async observeInterval(): Promise<void> {
    if (this.intervalMs <= 0) return
    const now = this.now()
    const wait = this.nextRequestAt - now
    if (wait > 0) await this.sleep(wait)
    this.nextRequestAt = this.now() + this.intervalMs
  }
}
