import assert from 'node:assert/strict'
import test from 'node:test'
import sharp from 'sharp'
import {
  POSTER_ASPECT,
  cropLeft,
  cropTop,
  needsCrop,
  processPoster,
  removeWatermark,
  targetPosterHeight,
  targetPosterWidth,
  watermarkRegion
} from './imageProcessor'

async function makeImage(width: number, height: number): Promise<Buffer> {
  return sharp({
    create: { width, height, channels: 3, background: { r: 64, g: 128, b: 192 } }
  })
    .jpeg()
    .toBuffer()
}

test('裁切几何：目标高度与是否需要裁切', () => {
  assert.equal(targetPosterHeight(300), Math.round(300 / POSTER_ASPECT))
  assert.equal(needsCrop(300, 460), true)
  assert.equal(needsCrop(300, 450), false)
})

test('cropTop 区分 full / 居中', () => {
  assert.equal(cropTop('full', 600, 450), 0)
  assert.equal(cropTop('center', 600, 450), 75)
  // right 是横版语义，竖向回退居中
  assert.equal(cropTop('right', 600, 450), 75)
})

test('横版全封面：needsCrop / targetPosterWidth / cropLeft', () => {
  // 800x538（JavBus 全封面）：2:3 目标宽 = 538*2/3 ≈ 359，需裁宽
  assert.equal(targetPosterWidth(538), Math.round(538 * POSTER_ASPECT))
  assert.equal(needsCrop(800, 538), true)
  // center 居中：(800-359)/2 ≈ 221
  assert.equal(cropLeft('center', 800, 359), 221)
  assert.equal(cropLeft('full', 800, 359), 0)
})

test('cropLeft right 模式取右半正面并居中，保留靠近书脊的正面', () => {
  // 800x538：右半从 x=400 开始，正面宽 400；目标 359 比正面窄，
  // 在正面内居中：400 + (400-359)/2 = 421（旧逻辑紧贴右边缘取 x=441，
  // 会切掉书脊旁约 20px 正面）
  const left = cropLeft('right', 800, 359)
  assert.equal(left, 421)
  // 裁切框必须落在正面内（左边界 >= 右半起点 400），且不越过右边缘
  assert.ok(left >= 400, `left ${left} 应不早于右半起点 400`)
  assert.ok(left + 359 <= 800)
})

test('cropLeft right 模式正面比 2:3 窄时右对齐回退', () => {
  // 构造一个正面（右半）比目标还窄的极端横版图：宽 500，目标宽 359，
  // 右半宽 250 < 359，应右对齐取 500-359=141
  assert.equal(cropLeft('right', 500, 359), 141)
})

test('processPoster 把横版全封面 right 裁成 2:3 竖海报', async () => {
  const src = await makeImage(800, 538)
  const out = await processPoster({ buffer: src, crop: 'right', removeWatermark: false })
  assert.equal(out.height, 538)
  assert.equal(out.width, targetPosterWidth(538))
  assert.ok(Math.abs(out.height / out.width - 1.5) < 0.02)
})

test('processPoster 横版 center 模式居中裁切', async () => {
  const src = await makeImage(800, 538)
  const out = await processPoster({ buffer: src, crop: 'center', removeWatermark: false })
  assert.equal(out.width, targetPosterWidth(538))
  assert.equal(out.height, 538)
})

test('watermarkRegion 位于左上角并按比例计算', () => {
  const r = watermarkRegion(1000, 500)
  assert.equal(r.left, 0)
  assert.equal(r.top, 0)
  assert.equal(r.width, Math.round(1000 * 0.28))
  assert.equal(r.height, Math.round(500 * 0.08))
})

test('processPoster center 模式把竖向封面裁成 2:3 海报', async () => {
  const src = await makeImage(300, 600)
  const out = await processPoster({ buffer: src, crop: 'center', removeWatermark: false })
  assert.equal(out.width, 300)
  assert.equal(out.height, 450)
  assert.ok(out.buffer.length > 0)
})

test('processPoster full 模式保留原图尺寸', async () => {
  const src = await makeImage(300, 600)
  const out = await processPoster({ buffer: src, crop: 'full', removeWatermark: false })
  assert.equal(out.width, 300)
  assert.equal(out.height, 600)
})

test('processPoster 去水印不改变尺寸并产出图像', async () => {
  const src = await makeImage(300, 450)
  const out = await processPoster({ buffer: src, crop: 'full', removeWatermark: true })
  assert.equal(out.width, 300)
  assert.equal(out.height, 450)
  const meta = await sharp(out.buffer).metadata()
  assert.equal(meta.format, 'jpeg')
})

test('removeWatermark 返回可解码图像', async () => {
  const src = await makeImage(400, 225)
  const out = await removeWatermark(src)
  const meta = await sharp(out).metadata()
  assert.equal(meta.width, 400)
  assert.equal(meta.height, 225)
})
