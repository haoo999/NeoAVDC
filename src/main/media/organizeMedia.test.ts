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

test('organizeVideo 统一收纳时视频移入指定根目录下的番号文件夹', () => {
  const incoming = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const library = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(incoming, 'MIDE-333.mp4')
  fs.writeFileSync(video, 'video')

  const result = organizeVideo(
    video,
    'MIDE-333',
    'number',
    { title: 'Central Title', actors: [] },
    { targetRootDir: library }
  )

  assert.equal(result.moved, true)
  assert.equal(result.folderPath, path.join(library, 'MIDE-333'))
  assert.equal(result.videoPath, path.join(library, 'MIDE-333', 'MIDE-333.mp4'))
  assert.ok(fs.existsSync(result.videoPath))
  assert.ok(!fs.existsSync(video))
})

test('organizeVideo 统一收纳时同名字幕跟随移入', () => {
  const incoming = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const library = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(incoming, 'MIDE-444.mp4')
  const srt = path.join(incoming, 'MIDE-444.srt')
  fs.writeFileSync(video, 'video')
  fs.writeFileSync(srt, 'sub')

  const result = organizeVideo(
    video,
    'MIDE-444',
    'number',
    { title: 'T', actors: [] },
    { targetRootDir: library, followSubtitles: true }
  )

  assert.ok(fs.existsSync(path.join(result.folderPath, 'MIDE-444.mp4')))
  assert.ok(fs.existsSync(path.join(result.folderPath, 'MIDE-444.srt')))
  assert.ok(!fs.existsSync(srt))
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

test('organizeVideo 跟随 NFO/海报/fanart 改名，extrafanart 目录整体搬入，历史平铺演员头像跟随', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(dir, 'random_name.mp4')
  const nfo = path.join(dir, 'random_name.nfo')
  const poster = path.join(dir, 'random_name-poster.jpg')
  const fanart = path.join(dir, 'random_name-fanart.jpg')
  const actor = path.join(dir, 'actor-葵 つかさ.jpg')
  const extraDir = path.join(dir, 'extrafanart')
  fs.mkdirSync(extraDir)
  const sample1 = path.join(extraDir, 'fanart1.jpg')
  const sample2 = path.join(extraDir, 'fanart2.jpg')
  for (const f of [video, nfo, poster, fanart, actor, sample1, sample2]) {
    fs.writeFileSync(f, 'x')
  }

  const result = organizeVideo(video, 'SSIS-001', 'number', DATA)

  const entries = fs.readdirSync(result.folderPath).sort()
  assert.deepEqual(entries, [
    'SSIS-001-fanart.jpg',
    'SSIS-001-poster.jpg',
    'SSIS-001.mp4',
    'SSIS-001.nfo',
    'actor-葵 つかさ.jpg',
    'extrafanart'
  ])
  // extrafanart 是 Kodi/Infuse 标准样张目录，允许存在；其内容原样搬入
  const movedExtra = fs
    .readdirSync(path.join(result.folderPath, 'extrafanart'))
    .sort()
  assert.deepEqual(movedExtra, ['fanart1.jpg', 'fanart2.jpg'])
  assert.ok(!fs.existsSync(nfo))
  assert.ok(!fs.existsSync(poster))
  assert.ok(!fs.existsSync(extraDir))
})

test('organizeVideo 搬运 .actors 目录内容（Kodi/Emby/Jellyfin/Plex 平台头像）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(dir, 'random_name.mp4')
  const actorsSrc = path.join(dir, '.actors')
  fs.mkdirSync(actorsSrc)
  const actor1 = path.join(actorsSrc, '葵.jpg')
  const actor2 = path.join(actorsSrc, '乙白.png')
  for (const f of [video, actor1, actor2]) fs.writeFileSync(f, 'x')

  const result = organizeVideo(video, 'SSIS-001', 'number', DATA)

  const actorsDst = path.join(result.folderPath, '.actors')
  assert.ok(fs.existsSync(actorsDst))
  assert.deepEqual(fs.readdirSync(actorsDst).sort(), ['乙白.png', '葵.jpg'])
  // 源目录已被清空删除
  assert.ok(!fs.existsSync(actorsSrc))
})

test('organizeVideo 不主动创建 .actors 隐藏子目录（无头像时保持干净）', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'avdc-org-'))
  const video = path.join(dir, 'SSIS-001.mp4')
  fs.writeFileSync(video, 'v')

  const result = organizeVideo(video, 'SSIS-001', 'number', DATA)
  assert.ok(!fs.existsSync(path.join(result.folderPath, '.actors')))
  assert.ok(!('sidecarDir' in result))
})
