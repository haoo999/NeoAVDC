import { useState } from 'react'
import { useImageSource } from '../useImageSource'
import type { CropMode, Task } from '../../../shared/types'
import { STATUS_META, fmtTime } from '../status'

interface DetailPanelProps {
  task: Task
  cropMode: CropMode
  onClose: () => void
  onRetry: (id: string) => void
  onRescrape: (id: string, number: string) => void
  running: boolean
}

// 远程横版封面在竖版海报框里的对齐方式，跟随裁切设置：
// right 取右半边（正面封面），center 居中，full 完整显示（letterbox）。
function coverObjectPosition(crop: CropMode): string {
  if (crop === 'right') return 'right center'
  if (crop === 'full') return 'center center'
  return 'center center'
}

export default function DetailPanel({ task, cropMode, onClose, onRetry, onRescrape, running }: DetailPanelProps) {
  const m = task.metadata
  const posterSrc = useImageSource(task.posterUrl)
  const coverSrc = useImageSource(task.coverUrl)
  // Heyzo / FC2 / 欧美片的 fanart 不做裁切（与落盘一致）；其余源沿用用户 cropMode
  const effectiveCrop: CropMode = m?.posterNoCrop ? 'full' : cropMode
  // 本地海报已是成品，优先用；远程封面在框内按 effectiveCrop 对齐
  const showingLocalPoster = Boolean(posterSrc)
  const imgSrc = posterSrc ?? coverSrc
  const imgStyle = showingLocalPoster
    ? undefined
    : {
        objectFit: effectiveCrop === 'full' ? ('contain' as const) : ('cover' as const),
        objectPosition: coverObjectPosition(effectiveCrop)
      }
  // 手动改番号：内联输入框
  const [editingNumber, setEditingNumber] = useState(false)
  const [draftNumber, setDraftNumber] = useState('')
  const busy =
    running ||
    task.status === 'scraping' ||
    task.status === 'downloading' ||
    task.status === 'queued'
  const startEditNumber = () => {
    setDraftNumber(task.number ?? '')
    setEditingNumber(true)
  }
  const cancelEditNumber = () => {
    setEditingNumber(false)
    setDraftNumber('')
  }
  const submitEditNumber = () => {
    const next = draftNumber.trim()
    if (!next || next === task.number) {
      cancelEditNumber()
      return
    }
    setEditingNumber(false)
    onRescrape(task.id, next)
  }
  return (
    <aside className="detail">
      <div className="detail-head">
        <span className={`dot st-${task.status}`} />
        <span className={`chip st-${task.status}`}>{STATUS_META[task.status].label}</span>
        <button className="icon-btn detail-close" onClick={onClose} title="关闭">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      <div className="detail-poster">
        {imgSrc ? (
          <img
            className="detail-poster-img"
            src={imgSrc}
            alt={task.title ?? task.number ?? 'poster'}
            loading="lazy"
            style={imgStyle}
          />
        ) : (
          <span>{task.number ?? '—'}</span>
        )}
      </div>

      <div className="detail-title">{task.title ?? '等待刮削…'}</div>

      <dl className="detail-grid">
        <dt>番号</dt>
        <dd className="mono">
          {editingNumber ? (
            <span className="number-edit">
              <input
                autoFocus
                className="number-edit-input"
                value={draftNumber}
                disabled={busy}
                onChange={e => setDraftNumber(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') submitEditNumber()
                  else if (e.key === 'Escape') cancelEditNumber()
                }}
                placeholder="输入番号，如 SSIS-001"
              />
              <button
                className="btn clay number-edit-ok"
                disabled={busy || !draftNumber.trim()}
                onClick={submitEditNumber}
              >
                确定
              </button>
              <button className="btn ghost number-edit-cancel" disabled={busy} onClick={cancelEditNumber}>
                取消
              </button>
            </span>
          ) : (
            <span className="number-value">
              <span className="number-value-text">{task.number ?? '—'}</span>
              {task.numberFromManual && <span className="manual-badge" title="已由用户手动指定番号">手动</span>}
              <button
                className="icon-btn number-edit-trigger"
                disabled={busy}
                onClick={startEditNumber}
                title="手动修正番号后重新刮削"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
              </button>
            </span>
          )}
        </dd>
        <dt>站点</dt>
        <dd className="mono">{task.website ?? '—'}</dd>
        {m && (
          <>
            <dt>演员</dt>
            <dd>{m.actors.length ? m.actors.join('、') : '—'}</dd>
            <dt>发行日</dt>
            <dd className="mono">{m.releaseDate || '—'}</dd>
            <dt>时长</dt>
            <dd className="mono">{m.runtimeMin ? `${m.runtimeMin} 分钟` : '—'}</dd>
            <dt>发行商</dt>
            <dd>{m.publisher || '—'}</dd>
            {m.series && (
              <>
                <dt>系列</dt>
                <dd>{m.series}</dd>
              </>
            )}
            <dt>标签</dt>
            <dd>
              {m.tags.length ? (
                <div className="tag-chips">
                  {m.tags.map(g => <span key={g} className="tchip">{g}</span>)}
                </div>
              ) : '—'}
            </dd>
          </>
        )}
        <dt>添加于</dt>
        <dd className="mono">{fmtTime(task.addedAt)}</dd>
      </dl>

      {task.status === 'failed' && (
        <div className="detail-error">错误：{task.error}</div>
      )}

      <div className="detail-actions">
        <button
          className="btn ghost"
          disabled={busy || task.status === 'skipped'}
          onClick={() => onRetry(task.id)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          重新刮削
        </button>
      </div>

      {task.outputDir && (
        <div className="detail-path">输出：{task.outputDir}</div>
      )}
    </aside>
  )
}
