import assert from 'node:assert/strict'
import test from 'node:test'
import { buildNfoXml } from './nfoWriter'
import type { ScrapedMetadata } from '../../shared/types'

const BASE: ScrapedMetadata = {
  number: 'SSIS-001',
  title: '新人NO.1STYLE 葵つかさ',
  coverUrl: 'https://www.javbus.com/pics/cover.jpg',
  sampleUrls: [],
  releaseDate: '2023-01-15',
  runtimeMin: 120,
  director: '山田太郎',
  maker: 'S1 NO.1 STYLE',
  publisher: 'エスワン ナンバーワンスタイル',
  series: 'SSIS 专属系列',
  genres: ['单体作品', '偶像'],
  actors: [
    { name: '葵つかさ', avatarUrl: 'https://www.javbus.com/actress/aoi.jpg' },
    { name: '鷲尾めい' }
  ],
  isUncensored: false,
  sourceUrl: 'https://www.javbus.com/SSIS-001'
}

test('buildNfoXml 输出 Kodi movie 结构与核心字段', () => {
  const xml = buildNfoXml(BASE)
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'))
  assert.ok(xml.includes('<movie>'))
  assert.ok(xml.includes('<title>新人NO.1STYLE 葵つかさ</title>'))
  assert.ok(xml.includes('<customnumber>SSIS-001</customnumber>'))
  assert.ok(xml.includes('<year>2023</year>'))
  assert.ok(xml.includes('<premiered>2023-01-15</premiered>'))
  assert.ok(xml.includes('<runtime>120</runtime>'))
  assert.ok(xml.includes('<studio>S1 NO.1 STYLE</studio>'))
  assert.ok(xml.includes('<publisher>エスワン ナンバーワンスタイル</publisher>'))
  assert.ok(xml.includes('<director>山田太郎</director>'))
  assert.ok(xml.includes('<set>\n    <name>SSIS 专属系列</name>\n  </set>'))
  assert.ok(xml.includes('<genre>单体作品</genre>'))
  assert.ok(xml.includes('<genre>偶像</genre>'))
  assert.ok(xml.includes('<tag>有码</tag>'))
  assert.ok(xml.includes('<name>葵つかさ</name>'))
  assert.ok(xml.includes('<name>鷲尾めい</name>'))
  assert.ok(xml.includes('<website>https://www.javbus.com/SSIS-001</website>'))
  assert.ok(xml.includes('<cover>https://www.javbus.com/pics/cover.jpg</cover>'))
})

test('buildNfoXml 无码番号 mpaa 与标签正确', () => {
  const xml = buildNfoXml({ ...BASE, isUncensored: true })
  assert.ok(xml.includes('<mpaa>R18+</mpaa>'))
  assert.ok(xml.includes('<tag>无码</tag>'))
})

test('buildNfoXml 对 XML 特殊字符做转义', () => {
  const xml = buildNfoXml({
    ...BASE,
    title: 'A & B <C> "D" \'E\'',
    genres: ['A&B']
  })
  assert.ok(xml.includes('<title>A &amp; B &lt;C&gt; &quot;D&quot; &apos;E&apos;</title>'))
  assert.ok(xml.includes('<genre>A&amp;B</genre>'))
})

test('buildNfoXml 缺失可选字段时不输出空元素', () => {
  const xml = buildNfoXml({
    ...BASE,
    releaseDate: undefined,
    runtimeMin: 0,
    series: undefined,
    director: undefined,
    maker: undefined,
    publisher: undefined,
    coverUrl: undefined
  })
  assert.ok(!xml.includes('<year>'))
  assert.ok(!xml.includes('<premiered>'))
  assert.ok(!xml.includes('<runtime>'))
  assert.ok(!xml.includes('<set>'))
  assert.ok(!xml.includes('<director>'))
  assert.ok(!xml.includes('<studio>'))
  assert.ok(!xml.includes('<publisher>'))
  assert.ok(!xml.includes('<art>'))
  assert.ok(!xml.includes('<cover>'))
})

test('buildNfoXml 演员头像按 actorThumbs 映射写入（Infuse 远程 URL / Kodi 本地路径）', () => {
  const xml = buildNfoXml(BASE, {
    actorThumbs: new Map([
      ['葵つかさ', 'https://pics.dmm.co.jp/mono/actjpgs/aoi_tukasa.jpg']
    ])
  })
  assert.ok(
    xml.includes('<thumb>https://pics.dmm.co.jp/mono/actjpgs/aoi_tukasa.jpg</thumb>')
  )
  // 未命中映射的演员不输出 thumb
  assert.ok(!/<name>鷲尾めい<\/name>[\s\S]*?<thumb>/.test(xml))
})

test('buildNfoXml 可覆盖本地封面/海报文件名', () => {
  const xml = buildNfoXml(BASE, { posterFile: 'SSIS-001-poster.jpg', fanartFile: 'SSIS-001-fanart.jpg' })
  assert.ok(xml.includes('<poster>SSIS-001-poster.jpg</poster>'))
  assert.ok(xml.includes('<fanart>SSIS-001-fanart.jpg</fanart>'))
  assert.ok(xml.includes('<cover>SSIS-001-poster.jpg</cover>'))
})
