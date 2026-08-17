import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  isSubtitleFile,
  isVideoFile,
  parseNumberFromFileName
} from './parseNumber'

describe('parseNumberFromFileName', () => {
  it('识别标准有码番号并补足 3 位', () => {
    const r = parseNumberFromFileName('SSNI-111.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-111')
    assert.equal(r.isCensored, true)
    assert.equal(r.isUncensored, false)
    assert.equal(r.isFc2, false)
    assert.equal(r.isWestern, false)
    assert.equal(r.hasSubtitleMark, false)
    assert.equal(r.part, null)
  })

  it('短数字番号补足三位零', () => {
    const r = parseNumberFromFileName('ABC-12.mp4')
    assert.ok(r)
    assert.equal(r.number, 'ABC-012')
    assert.equal(r.isCensored, true)
  })

  it('超过两位的数字番号保持原样', () => {
    const r = parseNumberFromFileName('MIDE-900.mp4')
    assert.ok(r)
    assert.equal(r.number, 'MIDE-900')
  })

  it('识别 FC2-PPV', () => {
    const r = parseNumberFromFileName('FC2-PPV-1234567.mp4')
    assert.ok(r)
    assert.equal(r.number, 'FC2-PPV-1234567')
    assert.equal(r.isFc2, true)
    assert.equal(r.isUncensored, true)
  })

  it('识别裸 FC2 编号', () => {
    const r = parseNumberFromFileName('fc2_999999.mp4')
    assert.ok(r)
    assert.equal(r.number, 'FC2-PPV-999999')
    assert.equal(r.isFc2, true)
  })

  it('识别 HEYZO 并补足 4 位', () => {
    const r = parseNumberFromFileName('heyzo_1234.mp4')
    assert.ok(r)
    assert.equal(r.number, 'HEYZO-1234')
    assert.equal(r.isUncensored, true)
  })

  it('HEYZO 短编号补零', () => {
    const r = parseNumberFromFileName('heyzo-456.mp4')
    assert.ok(r)
    assert.equal(r.number, 'HEYZO-0456')
  })

  it('识别 Tokyo Hot n#### 系列', () => {
    const r = parseNumberFromFileName('Tokyo-Hot-n1234.mp4')
    assert.ok(r)
    assert.equal(r.number, 'n1234')
    assert.equal(r.isUncensored, true)
  })

  it('识别欧美日期格式 series.YY.MM.DD', () => {
    const r = parseNumberFromFileName('EvilAngel.22.06.15.mp4')
    assert.ok(r)
    assert.equal(r.number, 'evilangel.22.06.15')
    assert.equal(r.isWestern, true)
  })

  it('识别无码纯数字番号 12345-123', () => {
    const r = parseNumberFromFileName('12345-678.mp4')
    assert.ok(r)
    assert.equal(r.number, '12345-678')
    assert.equal(r.isUncensored, true)
  })

  it('识别多段 cd1/cd2', () => {
    const r = parseNumberFromFileName('SSNI-999-cd2.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-999')
    assert.equal(r.part, 2)
  })

  it('识别中文字幕标记 -C', () => {
    const r = parseNumberFromFileName('SSNI-999-C.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-999')
    assert.equal(r.hasSubtitleMark, true)
  })

  it('识别字幕标记同时多段', () => {
    const r = parseNumberFromFileName('SSNI-999-cd1-C.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-999')
    assert.equal(r.part, 1)
    assert.equal(r.hasSubtitleMark, true)
  })

  it('去除发布组前缀 22-sht.me 与 hhd800', () => {
    const r = parseNumberFromFileName('22-sht.me@SSNI-111_1080p.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-111')
  })

  it('去除分辨率标记 1080p / 4k', () => {
    const r = parseNumberFromFileName('MIDE-900-4k.mp4')
    assert.ok(r)
    assert.equal(r.number, 'MIDE-900')
  })

  it('去除方括号日期前缀', () => {
    const r = parseNumberFromFileName('[2024-01-15] - SSNI-111.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-111')
  })

  it('处理下划线分隔符', () => {
    const r = parseNumberFromFileName('SSNI_111_1080p.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-111')
  })

  it('处理中文括号与全角符号', () => {
    const r = parseNumberFromFileName('【SSNI-111】.mp4')
    assert.ok(r)
    assert.equal(r.number, 'SSNI-111')
  })

  it('无法识别时返回 null', () => {
    const r = parseNumberFromFileName('家庭录像.mp4')
    assert.equal(r, null)
  })

  it('纯噪声字符串返回 null', () => {
    const r = parseNumberFromFileName('readme.txt')
    assert.equal(r, null)
  })
})

describe('isVideoFile / isSubtitleFile', () => {
  it('识别常见视频扩展名', () => {
    assert.equal(isVideoFile('a.mp4'), true)
    assert.equal(isVideoFile('a.MKV'), true)
    assert.equal(isVideoFile('a.txt'), false)
  })

  it('识别字幕扩展名', () => {
    assert.equal(isSubtitleFile('a.srt'), true)
    assert.equal(isSubtitleFile('a.ASS'), true)
    assert.equal(isSubtitleFile('a.mp4'), false)
  })
})
