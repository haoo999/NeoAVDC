import type { Task } from '../../../shared/types'
import { STATUS_META, fmtTime } from '../status'

interface DetailPanelProps {
  task: Task
  onClose: () => void
  onRetry: (id: string) => void
  running: boolean
}

export default function DetailPanel({ task, onClose, onRetry, running }: DetailPanelProps) {
  const m = task.metadata
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
        {task.number ?? '—'}
      </div>

      <div className="detail-title">{task.title ?? '等待刮削…'}</div>

      <dl className="detail-grid">
        <dt>番号</dt>
        <dd className="mono">{task.number ?? '—'}</dd>
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
          disabled={running || task.status === 'scraping' || task.status === 'queued' || task.status === 'skipped'}
          onClick={() => onRetry(task.id)}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="23 4 23 10 17 10" />
            <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
          </svg>
          重新刮削
        </button>
        <button className="btn ghost" disabled title="阶段 3 实现">换网站重刮</button>
        <button className="btn ghost" disabled title="阶段 3 实现">手动改番号</button>
      </div>

      {task.outputDir && (
        <div className="detail-path">输出：{task.outputDir}</div>
      )}
    </aside>
  )
}
