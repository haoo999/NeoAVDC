import type { CropMode } from '../../shared/types'

export const POSTER_ASPECT = 2 / 3

export interface ProcessInput {
  buffer: Buffer
  crop: CropMode
  removeWatermark: boolean
}

export interface ProcessResult {
  buffer: Buffer
  width: number
  height: number
}

export function targetPosterHeight(srcWidth: number): number {
  return Math.round(srcWidth / POSTER_ASPECT)
}

export function targetPosterWidth(srcHeight: number): number {
  return Math.round(srcHeight * POSTER_ASPECT)
}

export function needsCrop(srcWidth: number, srcHeight: number): boolean {
  if (srcHeight > targetPosterHeight(srcWidth) + 1) return true
  if (srcWidth > targetPosterWidth(srcHeight) + 1) return true
  return false
}

/**
 * 计算竖向上的裁切偏移。
 * 竖向封面按 2:3 裁掉上下多余部分：
 * - center/right：垂直居中（right 是横版语义，竖向回退居中）
 * - full：不裁切
 */
export function cropTop(crop: CropMode, srcHeight: number, targetHeight: number): number {
  if (crop === 'full') return 0
  return Math.max(0, Math.round((srcHeight - targetHeight) / 2))
}

/**
 * 计算水平方向的裁切偏移。
 * 横版全封面（背面|书脊|正面）转竖海报时：
 * - right：取右半边（正面封面）
 * - center：水平居中
 * - full：不裁切
 */
export function cropLeft(crop: CropMode, srcWidth: number, targetWidth: number): number {
  if (crop === 'right') return Math.max(0, srcWidth - targetWidth)
  if (crop === 'full') return 0
  return Math.max(0, Math.round((srcWidth - targetWidth) / 2))
}

export function watermarkRegion(
  width: number,
  height: number
): { left: number; top: number; width: number; height: number } {
  const w = Math.max(1, Math.round(width * 0.28))
  const h = Math.max(1, Math.round(height * 0.08))
  return { left: 0, top: 0, width: w, height: h }
}

async function blurWatermarkRegion(buffer: Buffer): Promise<Buffer> {
  const sharp = (await import('sharp')).default
  const img = sharp(buffer)
  const meta = await img.metadata()
  const width = meta.width ?? 0
  const height = meta.height ?? 0
  if (width === 0 || height === 0) return buffer
  const region = watermarkRegion(width, height)
  const blurred = await sharp(buffer).extract(region).blur(12).toBuffer()
  return sharp(buffer)
    .composite([{ input: blurred, left: region.left, top: region.top }])
    .toBuffer()
}

export async function processPoster(input: ProcessInput): Promise<ProcessResult> {
  const sharp = (await import('sharp')).default
  let pipeline = sharp(input.buffer).rotate()
  const meta = await pipeline.metadata()
  const srcWidth = meta.width ?? 0
  const srcHeight = meta.height ?? 0

  let working = input.buffer
  if (input.crop !== 'full') {
    const tooTall = srcHeight > targetPosterHeight(srcWidth) + 1
    const tooWide = srcWidth > targetPosterWidth(srcHeight) + 1
    if (tooTall) {
      const targetH = targetPosterHeight(srcWidth)
      const top = cropTop(input.crop, srcHeight, targetH)
      working = await sharp(working)
        .extract({ left: 0, top, width: srcWidth, height: targetH })
        .toBuffer()
    } else if (tooWide) {
      const targetW = targetPosterWidth(srcHeight)
      const left = cropLeft(input.crop, srcWidth, targetW)
      working = await sharp(working)
        .extract({ left, top: 0, width: targetW, height: srcHeight })
        .toBuffer()
    }
  }

  if (input.removeWatermark) {
    working = await blurWatermarkRegion(working)
  }

  const out = await sharp(working)
    .jpeg({ quality: 90, mozjpeg: true })
    .toBuffer({ resolveWithObject: true })
  return { buffer: out.data, width: out.info.width, height: out.info.height }
}

export async function removeWatermark(buffer: Buffer): Promise<Buffer> {
  return blurWatermarkRegion(buffer)
}
