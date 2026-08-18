import type { TaskStatus } from '../../shared/types'

export const STATUS_META: Record<TaskStatus, { label: string; cls: string }> = {
  pending: { label: '待处理', cls: 'st-pending' },
  queued: { label: '排队中', cls: 'st-queued' },
  scraping: { label: '刮削中', cls: 'st-scraping' },
  downloading: { label: '下载中', cls: 'st-downloading' },
  success: { label: '成功', cls: 'st-success' },
  failed: { label: '失败', cls: 'st-failed' },
  skipped: { label: '已跳过', cls: 'st-skipped' }
}

export function fmtTime(t: number): string {
  return new Date(t).toLocaleTimeString('zh-CN', { hour12: false })
}

export function fmtSize(mb: number): string {
  if (mb >= 1024) return `${(mb / 1024).toFixed(2)} GB`
  return `${mb.toFixed(0)} MB`
}
