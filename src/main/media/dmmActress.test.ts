import assert from 'node:assert/strict'
import test from 'node:test'
import { parseActressPage } from './dmmActress'

const SAMPLE = `
<ul>
<li><a href="https://www.dmm.co.jp/mono/dvd/-/list/=/article=actress/id=1006229/">
<img src="https://pics.dmm.co.jp/mono/actjpgs/medium/aoi_tukasa.jpg" alt="" width="100" height="100"><br>葵つかさ</a></li>
<li><a href="https://www.dmm.co.jp/mono/dvd/-/list/=/article=actress/id=200/">
<img src="https://pics.dmm.co.jp/mono/actjpgs/medium/aizawa_miyu.jpg" width="100" height="100"><br>愛沢みゆ</a></li>
</ul>
`

test('parseActressPage 从 DMM 列表页解析 名→大图URL', () => {
  const map = parseActressPage(SAMPLE)
  assert.equal(map.size, 2)
  assert.equal(
    map.get('葵つかさ'),
    'https://pics.dmm.co.jp/mono/actjpgs/aoi_tukasa.jpg'
  )
  assert.equal(
    map.get('愛沢みゆ'),
    'https://pics.dmm.co.jp/mono/actjpgs/aizawa_miyu.jpg'
  )
})

test('parseActressPage 忽略非演员条目', () => {
  const map = parseActressPage('<li><a href="/other/"><img src="/x.jpg"><br>无关</a></li>')
  assert.equal(map.size, 0)
})
