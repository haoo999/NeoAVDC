import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { organizeVideo } from './organizeMedia'

const DATA = { title: 'SSIS-001 タイトル', actors: [{ name: '葵' }] }

function tmpVideo(file = 'SSIS-001.mp4'): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const p = path.join(dir, file)
  fs.writeFileSync(p, 'video')
  return p
}

test('organizeVideo 建立番号文件夹并移入视频', () => {
  const video = tmpVideo()
  const result = organizeVideo(video, 'SSIS-001', 'number', DATA)

  assert.equal(result.moved, true)
  assert.equal(path.basename(result.folderPath), 'SSIS-001')
  assert.equal(result.videoPath, path.join(result.folderPath, 'SSIS-001.mp4'))
  assert.ok(fs.existsSync(result.videoPath))
  assert.ok(!fs.existsSync(video))
})

test('organizeVideo 按 numberTitle 模式命名文件夹', () => {
  const video = tmpVideo()
  const result = organizeVideo(video, 'SSIS-001', 'numberTitle', DATA)
  assert.equal(path.basename(result.folderPath), 'SSIS-001 タイトル')
})

test('organizeVideo 已在收纳文件夹内时不套娃', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const folder = path.join(dir, 'SSIS-001')
  fs.mkdirSync(folder)
  const video = path.join(folder, 'SSIS-001.mp4')
  fs.writeFileSync(video, 'video')

  const result = organizeVideo(video, 'SSIS-001', 'numberTitle', DATA)
  assert.equal(result.moved, false)
  assert.equal(result.videoPath, video)
  assert.equal(result.folderPath, folder)
})

test('organizeVideo 目标已存在同名文件时抛错且不移动', () => {
  const video = tmpVideo()
  const folder = path.join(path.dirname(video), 'SSIS-001')
  fs.mkdirSync(folder)
  fs.writeFileSync(path.join(folder, 'SSIS-001.mp4'), 'existing')

  assert.throws(() => organizeVideo(video, 'SSIS-001', 'number', DATA), /同名文件/)
  assert.ok(fs.existsSync(video))
})

test('organizeVideo 跟随同名字幕（含语言后缀）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(dir, 'SSIS-001.mp4')
  const srt = path.join(dir, 'SSIS-001.srt')
  const zhSrt = path.join(dir, 'SSIS-001.zh.srt')
  const unrelated = path.join(dir, 'other.srt')
  fs.writeFileSync(video, 'video')
  fs.writeFileSync(srt, 'sub')
  fs.writeFileSync(zhSrt, 'sub-zh')
  fs.writeFileSync(unrelated, 'other')

  const result = organizeVideo(video, 'SSIS-001', 'number', DATA, { followSubtitles: true })

  assert.ok(fs.existsSync(path.join(result.folderPath, 'SSIS-001.mp4')))
  assert.ok(fs.existsSync(path.join(result.folderPath, 'SSIS-001.srt')))
  assert.ok(fs.existsSync(path.join(result.folderPath, 'SSIS-001.zh.srt')))
  assert.equal(result.movedSidecars.length, 2)
  // 不相关字幕留在原目录
  assert.ok(fs.existsSync(unrelated))
})

test('organizeVideo 关闭字幕跟随时不移动字幕', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(dir, 'SSIS-001.mp4')
  const srt = path.join(dir, 'SSIS-001.srt')
  fs.writeFileSync(video, 'video')
  fs.writeFileSync(srt, 'sub')

  const result = organizeVideo(video, 'SSIS-001', 'number', DATA)

  assert.ok(fs.existsSync(path.join(result.folderPath, 'SSIS-001.mp4')))
  assert.ok(!fs.existsSync(path.join(result.folderPath, 'SSIS-001.srt')))
  assert.ok(fs.existsSync(srt))
  assert.equal(result.movedSidecars.length, 0)
})
