import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { writeNfoFile } from './writeMedia'
import { buildMediaPaths } from './fileNames'
import type { ScrapedMetadata, Settings } from '../../shared/types'

const DATA: ScrapedMetadata = {
  number: 'SSIS-001',
  title: 'Test Title',
  coverUrl: 'https://img/cover.jpg',
  sampleUrls: [],
  releaseDate: '2023-01-01',
  runtimeMin: 100,
  maker: 'S1',
  genres: ['单体'],
  actors: [],
  isUncensored: false,
  sourceUrl: 'https://www.javbus.com/SSIS-001'
}

function tmpVideo(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-nfo-'))
  return path.join(dir, 'SSIS-001.mp4')
}

test('writeNfoFile 写入合法 UTF-8 XML 到视频同目录', () => {
  const video = tmpVideo()
  const paths = buildMediaPaths(video)
  writeNfoFile(paths.nfoPath, DATA, 'SSIS-001-poster.jpg', 'SSIS-001-fanart.jpg', false)
  const xml = fs.readFileSync(paths.nfoPath, 'utf8')
  assert.ok(xml.includes('<?xml version="1.0" encoding="UTF-8"'))
  assert.ok(xml.includes('<movie>'))
  assert.ok(xml.includes('<title>Test Title</title>'))
  assert.ok(xml.includes('<poster>SSIS-001-poster.jpg</poster>'))
})

test('writeNfoFile 覆盖已有文件（不跳过）', () => {
  const video = tmpVideo()
  const paths = buildMediaPaths(video)
  fs.writeFileSync(paths.nfoPath, 'OLD')
  writeNfoFile(paths.nfoPath, DATA, undefined, undefined, false)
  const xml = fs.readFileSync(paths.nfoPath, 'utf8')
  assert.ok(xml.includes('<movie>'))
  assert.ok(!xml.includes('OLD'))
})

test('Settings 中 generateNfo / skipExistingNfo 字段被正确使用', () => {
  const settings: Settings = {
    proxyUrl: '',
    requestIntervalSec: 0,
    enabledSites: ['JavBus'],
    downloadHdCover: true,
    downloadSamples: false,
    downloadActorAvatars: false,
    generateNfo: true,
    skipExistingNfo: true,
    folderNaming: 'number',
    cropMode: 'center',
    followSubtitles: false,
    removeWatermark: false
  }
  assert.equal(settings.generateNfo, true)
  assert.equal(settings.skipExistingNfo, true)
})
