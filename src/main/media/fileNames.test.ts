import assert from 'node:assert/strict'
import test from 'node:test'
import path from 'node:path'
import {
  actorThumbPath,
  actorThumbRef,
  buildFolderName,
  buildMediaPaths,
  extraThumbPath,
  inferExtension,
  isFlattenedActorFile,
  isInsideOrganizedFolder,
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
  assert.equal(p.posterPath, path.join('/movies/abc', 'SSIS-001-poster.jpg'))
  assert.equal(p.fanartPath, path.join('/movies/abc', 'SSIS-001-fanart.jpg'))
  // 样张走标准 Kodi/Infuse 子目录 extrafanart/
  assert.equal(p.extraThumbsDir, path.join('/movies/abc', 'extrafanart'))
})

test('posterPath / fanartPath 使用传入扩展名', () => {
  assert.equal(posterPath('/d', 'AB', '.png'), path.join('/d', 'AB-poster.png'))
  assert.equal(fanartPath('/d', 'AB', '.webp'), path.join('/d', 'AB-fanart.webp'))
})

test('actorThumbPath 按平台区分存储：Kodi 用 .actors/ 子目录，Infuse 平铺', () => {
  const dir = '/movies/abc'
  assert.equal(
    actorThumbPath(dir, '葵 つかさ', '.jpg', 'Kodi'),
    path.join(dir, '.actors', '葵 つかさ.jpg')
  )
  assert.equal(
    actorThumbPath(dir, '葵 つかさ', '.jpg', 'Infuse'),
    path.join(dir, 'actor-葵 つかさ.jpg')
  )
  // Emby/Jellyfin/Plex 与 Kodi 同属 .actors/ 家族
  assert.equal(
    actorThumbPath(dir, '葵 つかさ', '.png', 'Jellyfin'),
    path.join(dir, '.actors', '葵 つかさ.png')
  )
})

test('actorThumbRef 按平台返回本地相对路径或远程 URL', () => {
  assert.equal(actorThumbRef('葵', '.jpg', 'Kodi'), path.posix.join('.actors', '葵.jpg'))
  assert.equal(actorThumbRef('葵', '.jpg', 'Infuse', 'https://x/aoi.jpg'), 'https://x/aoi.jpg')
  // Infuse 未查到远程 URL 时返回 undefined，NFO 不写 thumb
  assert.equal(actorThumbRef('葵', '.jpg', 'Infuse'), undefined)
})

test('extraThumbPath 使用 Kodi/Infuse 标准 fanartNN 命名并落到 extrafanart 目录', () => {
  const dir = path.join('/movies/abc', 'extrafanart')
  assert.equal(extraThumbPath(dir, 0, '.jpg'), path.join(dir, 'fanart1.jpg'))
  assert.equal(extraThumbPath(dir, 9, '.png'), path.join(dir, 'fanart10.png'))
})

test('isFlattenedActorFile 识别平铺演员头像', () => {
  assert.equal(isFlattenedActorFile('actor-葵 つかさ.jpg'), true)
  assert.equal(isFlattenedActorFile('actor-X.png'), true)
  assert.equal(isFlattenedActorFile('SSIS-001-poster.jpg'), false)
  assert.equal(isFlattenedActorFile('fanart1.jpg'), false)
})

test('buildFolderName 按命名模式生成文件夹名', () => {
  const data = { title: 'SSIS-001 タイトル', actors: [{ name: '葵' }, { name: '乙白' }] }
  assert.equal(buildFolderName('number', 'SSIS-001', data), 'SSIS-001')
  assert.equal(buildFolderName('numberTitle', 'SSIS-001', data), 'SSIS-001 タイトル')
  assert.equal(
    buildFolderName('numberActorTitle', 'SSIS-001', data),
    'SSIS-001 葵、乙白 タイトル'
  )
})

test('buildFolderName 标题不含番号前缀时也能正常拼接', () => {
  const data = { title: 'タイトル', actors: [] }
  assert.equal(buildFolderName('numberTitle', 'SSIS-001', data), 'SSIS-001 タイトル')
})

test('buildFolderName 清洗非法路径字符', () => {
  const data = { title: 'a/b:c', actors: [] }
  assert.equal(buildFolderName('numberTitle', 'SSIS-001', data), 'SSIS-001 abc')
})

test('isInsideOrganizedFolder 识别已收纳状态', () => {
  assert.equal(isInsideOrganizedFolder('/dl/SSIS-001/SSIS-001.mp4', 'SSIS-001'), true)
  assert.equal(isInsideOrganizedFolder('/dl/SSIS-001 タイトル/SSIS-001.mp4', 'SSIS-001'), true)
  assert.equal(isInsideOrganizedFolder('/dl/SSIS-001.mp4', 'SSIS-001'), false)
  assert.equal(isInsideOrganizedFolder('/dl/SSIS-999/SSIS-001.mp4', 'SSIS-001'), false)
})
