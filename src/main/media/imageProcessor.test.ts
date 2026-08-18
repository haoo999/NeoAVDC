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

test('cropTop 区分 top / center / full', () => {
  assert.equal(cropTop('top', 600, 450), 0)
  assert.equal(cropTop('full', 600, 450), 0)
  assert.equal(cropTop('center', 600, 450), 75)
})

test('横版全封面：needsCrop / targetPosterWidth / cropLeft', () => {
  // 800x538（JavBus 全封面）：2:3 目标宽 = 538*2/3 ≈ 359，需裁宽
  assert.equal(targetPosterWidth(538), Math.round(538 * POSTER_ASPECT))
  assert.equal(needsCrop(800, 538), true)
  // center 居中：(800-359)/2 = 221（四舍五入 221）
  assert.equal(cropLeft('center', 800, 359), 221)
  // top 取右侧正面：800-359 = 441
  assert.equal(cropLeft('top', 800, 359), 441)
  assert.equal(cropLeft('full', 800, 359), 0)
})

test('processPoster 把横版全封面 center 裁成 2:3 竖海报', async () => {
  const src = await makeImage(800, 538)
  const out = await processPoster({ buffer: src, crop: 'center', removeWatermark: false })
  assert.equal(out.height, 538)
  assert.equal(out.width, targetPosterWidth(538))
  assert.ok(Math.abs(out.height / out.width - 1.5) < 0.02)
})

test('processPoster 横版 top 模式取右侧正面', async () => {
  const src = await makeImage(800, 538)
  const out = await processPoster({ buffer: src, crop: 'top', removeWatermark: false })
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
