import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { downloadImages, chooseExtension } from './imageDownloader'
import type { BinaryGetter } from './imageDownloader'
import { inferExtension } from './fileNames'
import type { ScrapedMetadata } from '../../shared/types'

const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff, 0xe0])
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

function tmpVideo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-media-'))
  return path.join(dir, 'SSIS-001.mp4')
}

async function makeJpeg(width = 200, height = 300): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp({
    create: { width, height, channels: 3, background: { r: 64, g: 128, b: 192 } }
  })
    .jpeg()
    .toBuffer()
}

async function makePng(width = 100, height = 100): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  return sharp({
    create: { width, height, channels: 3, background: { r: 16, g: 16, b: 16 } }
  })
    .png()
    .toBuffer()
}

function fakeGetter(responses: Record<string, Buffer>): BinaryGetter {
  return async (url: string) => {
    const buf = responses[url]
    if (!buf) throw new Error('not found ' + url)
    return { buffer: buf, ext: inferExtension(url) }
  }
}

function data(coverUrl = 'https://img/cover.jpg'): ScrapedMetadata {
  return {
    number: 'SSIS-001',
    title: 'Test',
    coverUrl,
    sampleUrls: ['https://img/s1.jpg', 'https://img/s2.png'],
    actors: [{ name: '葵', avatarUrl: 'https://img/a.png' }],
    genres: [],
    isUncensored: false,
    sourceUrl: 'https://www.javbus.com/SSIS-001'
  }
}

const baseOpts = {
  downloadHdCover: true,
  downloadActorAvatars: true,
  downloadSamples: true,
  cropMode: 'full' as const,
  removeWatermark: false
}

test('chooseExtension 按 magic bytes 识别格式', () => {
  assert.equal(chooseExtension(JPEG_MAGIC), '.jpg')
  assert.equal(chooseExtension(PNG_MAGIC), '.png')
  assert.equal(chooseExtension(Buffer.from([0, 0, 0])), '.jpg')
})

test('downloadImages 写入封面、fanart、样张、演员头像', async () => {
  const video = tmpVideo()
  const bin = fakeGetter({
    'https://img/cover.jpg': await makeJpeg(200, 300),
    'https://img/s1.jpg': await makeJpeg(400, 225),
    'https://img/s2.png': await makePng(200, 150),
    'https://img/a.png': await makePng(120, 120)
  })
  const result = await downloadImages(bin, video, data(), baseOpts)
  assert.ok(result.poster && fs.existsSync(result.poster))
  assert.ok(result.fanart && fs.existsSync(result.fanart))
  assert.equal(result.samples.length, 2)
  assert.equal(result.actors.length, 1)
  assert.ok(result.poster!.endsWith('-poster.jpg'))
  assert.ok(result.fanart!.endsWith('-fanart.jpg'))
  assert.ok(result.samples[1].endsWith('.png'))
  assert.ok(result.actors[0].endsWith('.png'))
})

test('downloadImages 关闭选项时不下载样张与演员头像', async () => {
  const video = tmpVideo()
  const bin = fakeGetter({ 'https://img/cover.jpg': await makeJpeg() })
  const result = await downloadImages(bin, video, data(), {
    ...baseOpts,
    downloadActorAvatars: false,
    downloadSamples: false
  })
  assert.ok(result.poster)
  assert.equal(result.samples.length, 0)
  assert.equal(result.actors.length, 0)
})

test('downloadImages 单个图片下载失败不影响其余图片', async () => {
  const video = tmpVideo()
  const bin = fakeGetter({
    'https://img/cover.jpg': await makeJpeg(),
    'https://img/s1.jpg': await makeJpeg()
  })
  const result = await downloadImages(bin, video, data(), baseOpts)
  assert.ok(result.poster)
  assert.equal(result.samples.length, 1)
  assert.equal(result.actors.length, 0)
})

test('downloadImages 高清封面失败回退缩略图', async () => {
  const video = tmpVideo()
  const thumb = await makeJpeg(100, 150)
  const d = data('https://img/cover_large.jpg')
  d.coverThumbUrl = 'https://img/cover_thumb.jpg'
  const bin = fakeGetter({ 'https://img/cover_thumb.jpg': thumb })
  const result = await downloadImages(bin, video, d, { ...baseOpts, downloadHdCover: true })
  assert.ok(result.poster)
  assert.ok(fs.existsSync(result.poster!))
})
