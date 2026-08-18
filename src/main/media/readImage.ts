import { promises as fs } from 'node:fs'
import { fileURLToPath } from 'node:url'
import type { HttpClient } from '../net/httpClient'
import { detectMime } from './imageDownloader'

/**
 * 把图片（本地 file:// 路径或远程 http(s) URL）读成 data URL。
 * - 本地：直接读文件，绕过 renderer 在 dev 下无法跨域加载 file:// 的限制。
 * - 远程：用主进程的 HttpClient 抓取，自动带上来源站点的 Referer，绕过防盗链。
 */
export async function readImageAsDataUrl(
  http: Pick<HttpClient, 'getBuffer'>,
  source: string
): Promise<string> {
  const buffer = await readImageBuffer(http, source)
  return `data:${detectMime(buffer)};base64,${buffer.toString('base64')}`
}

async function readImageBuffer(
  http: Pick<HttpClient, 'getBuffer'>,
  source: string
): Promise<Buffer> {
  if (source.startsWith('file:')) {
    return fs.readFile(fileURLToPath(source))
  }
  const res = await http.getBuffer(source)
  return res.buffer
}
