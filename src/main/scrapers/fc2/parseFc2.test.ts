import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  buildFc2ArticleUrl,
  buildFc2TagApiUrl,
  extractFc2Id,
  isFc2NotFound,
  isFc2Number,
  parseFc2Detail,
  parseFc2TagJson
} from './parseFc2'

const SAMPLE_HTML = `<!DOCTYPE html>
<html><head>
<title>FC2-PPV-4806136 sample title | FC2コンテンツ</title>
<meta property="og:title" content="FC2-PPV-4806136 独占販売！高画質ノーカット" />
<meta property="og:image" content="https://storage500.contents.fc2.com/file/300/4806136/top.jpg?1761" />
<meta property="og:description" content="素人個人撮影のハメ撮り作品です。" />
<meta property="og:url" content="https://adult.contents.fc2.com/article/4806136/" />
<link href="//contents-thumbnail2.fc2.com/w1280/storage500.contents.fc2.com/file/300/4806136/top.jpg" />
<link href="//contents-thumbnail2.fc2.com/w1280/storage500.contents.fc2.com/file/300/4806136/sample1.jpg" />
<link href="//contents-thumbnail2.fc2.com/w1280/storage500.contents.fc2.com/file/300/4806136/sample2.jpg" />
</head><body>
<span data-tag="ハメ撮り"></span>
<span data-tag="素人"></span>
<span>販売日 : 2025/11/29</span>
<a href="https://adult.contents.fc2.com/users/seller_xyz/">裏垢太郎</a>
</body></html>`

const TAG_JSON = JSON.stringify({
  tags: [
    { tag: 'ハメ撮り', jp: 'yes' },
    { tag: '素人' },
    { tag: '個人撮影' }
  ]
})

const NOT_FOUND_HTML = `<html><body>
<h1>お探しのコンテンツは見つかりません</h1></body></html>`

test('extractFc2Id 从不同写法提取数字 ID', () => {
  assert.equal(extractFc2Id('FC2-PPV-4806136'), '4806136')
  assert.equal(extractFc2Id('FC2PPV-4806136'), '4806136')
  assert.equal(extractFc2Id('FC2_4806136'), '4806136')
  assert.equal(extractFc2Id('fc2-ppv-1234567'), '1234567')
  assert.equal(extractFc2Id('4806136'), '4806136')
  assert.equal(extractFc2Id('SSIS-001'), '')
})

test('buildFc2ArticleUrl / buildFc2TagApiUrl 正确拼接', () => {
  assert.equal(buildFc2ArticleUrl('4806136'), 'https://adult.contents.fc2.com/article/4806136/')
  assert.equal(
    buildFc2TagApiUrl('4806136'),
    'https://adult.contents.fc2.com/api/v4/article/4806136/tag?'
  )
})

test('isFc2Number 识别 FC2 番号（含 parseNumber 给出的 isFc2）', () => {
  assert.equal(isFc2Number({ isFc2: true } as never, 'XXX'), true)
  assert.equal(isFc2Number(null, 'FC2-PPV-1234'), true)
  assert.equal(isFc2Number(null, 'SSIS-001'), false)
})

test('parseFc2TagJson 解析标签列表', () => {
  assert.deepEqual(parseFc2TagJson(TAG_JSON), ['ハメ撮り', '素人', '個人撮影'])
  assert.deepEqual(parseFc2TagJson('not json'), [])
  assert.deepEqual(parseFc2TagJson('{"tags":[]}'), [])
})

test('parseFc2Detail 从完整 HTML 提取字段（含 tagJson 合并）', () => {
  const url = buildFc2ArticleUrl('4806136')
  const data = parseFc2Detail(SAMPLE_HTML, url, 'FC2-PPV-4806136', TAG_JSON)
  assert.ok(data)
  assert.equal(data!.number, 'FC2-PPV-4806136')
  assert.equal(data!.title, '独占販売！高画質ノーカット')
  assert.equal(
    data!.coverUrl,
    'https://storage500.contents.fc2.com/file/300/4806136/top.jpg?1761'
  )
  assert.equal(data!.releaseDate, '2025-11-29')
  assert.equal(data!.director, '裏垢太郎')
  assert.ok(data!.maker?.includes('FC2-PPV'))
  assert.equal(data!.publisher, '裏垢太郎')
  assert.equal(data!.isUncensored, true)
  assert.equal(data!.posterNoCrop, true)
  assert.equal(data!.outline, '素人個人撮影のハメ撮り作品です。')
  // 标签来自 API 与 data-tag 合并去重
  assert.ok(data!.genres.includes('個人撮影'))
  assert.ok(data!.genres.includes('ハメ撮り'))
  assert.ok(data!.genres.includes('素人'))
  // 样张：top.jpg 是封面，应被排除；sample1/2 被收集
  assert.equal(data!.sampleUrls.length, 2)
  assert.ok(data!.sampleUrls[0].includes('sample'))
})

test('parseFc2Detail 无 tagJson 时从 data-tag 兜底', () => {
  const data = parseFc2Detail(
    SAMPLE_HTML,
    buildFc2ArticleUrl('4806136'),
    'FC2-PPV-4806136'
  )
  assert.ok(data)
  assert.ok(data!.genres.includes('ハメ撮り'))
  assert.ok(data!.genres.includes('素人'))
})

test('parseFc2Detail 属性顺序颠倒仍可提取 meta', () => {
  const html = `<meta content="https://storage500.example/x.jpg" property="og:image" />
<meta content="タイトル" property="og:title" />`
  const data = parseFc2Detail(
    html,
    'https://adult.contents.fc2.com/article/123/',
    'FC2-PPV-123'
  )
  assert.ok(data)
  assert.equal(data!.coverUrl, 'https://storage500.example/x.jpg')
  assert.equal(data!.title, 'タイトル')
})

test('parseFc2Detail 无封面返回 null', () => {
  const html = `<html><head><title>x</title></head></html>`
  assert.equal(
    parseFc2Detail(html, 'https://x', 'FC2-PPV-123'),
    null
  )
})

test('parseFc2Detail 对空字符串返回 null', () => {
  assert.equal(parseFc2Detail('', 'https://x', 'FC2-PPV-1'), null)
})

test('isFc2NotFound 识别软 404', () => {
  assert.equal(isFc2NotFound(NOT_FOUND_HTML), true)
  assert.equal(isFc2NotFound(SAMPLE_HTML), false)
})
