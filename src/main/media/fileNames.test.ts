import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import os from 'node:os'
import {
  actorThumbPath,
  buildMediaPaths,
  extraThumbPath,
  inferExtension,
  posterPath,
  fanartPath,
  sanitizeFileName
} from './fileNames'

test('sanitizeFileName 移除非法字符并压缩空白', () => {
  assert.equal(sanitizeFileName('a/b:c*d?e"f<g>h|i'), 'abcdefghi')
  assert.equal(sanitizeFileName('  hello   world  '), 'hello world')
})

test('inferExtension 忽略查询串并识别常见图片格式', () => {
  assert.equal(inferExtension('https://x/cover.jpg'), '.jpg')
  assert.equal(inferExtension('https://x/cover.jpeg'), '.jpg')
  assert.equal(inferExtension('https://x/p.png?v=1'), '.png')
  assert.equal(inferExtension('https://x/p.webp'), '.webp')
  assert.equal(inferExtension('https://x/noext'), '.jpg')
})

test('buildMediaPaths 基于视频路径生成媒体路径', () => {
  const p = buildMediaPaths('/movies/abc/SSIS-001.mp4')
  assert.equal(p.dir, '/movies/abc')
  assert.equal(p.baseName, 'SSIS-001')
  assert.equal(p.nfoPath, path.join('/movies/abc', 'SSIS-001.nfo'))
  assert.equal(p.extraThumbsDir, path.join('/movies/abc', 'SSIS-001-extrafanart'))
  assert.equal(p.actorsDir, path.join('/movies/abc', '.actors'))
})

test('posterPath / fanartPath 使用传入扩展名', () => {
  assert.equal(posterPath('/d', 'AB', '.png'), path.join('/d', 'AB-poster.png'))
  assert.equal(fanartPath('/d', 'AB', '.webp'), path.join('/d', 'AB-fanart.webp'))
})

test('actorThumbPath / extraThumbPath 命名规范', () => {
  const actorsDir = path.join(os.tmpdir(), 'actors')
  assert.equal(actorThumbPath(actorsDir, '葵 つかさ'), path.join(actorsDir, '葵 つかさ.jpg'))
  assert.equal(extraThumbPath(path.join(os.tmpdir(), 'ext'), 0, '.jpg'), path.join(os.tmpdir(), 'ext', 'thumb001.jpg'))
  assert.equal(extraThumbPath(path.join(os.tmpdir(), 'ext'), 9, '.png'), path.join(os.tmpdir(), 'ext', 'thumb010.png'))
})
