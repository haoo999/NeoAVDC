import type { Task } from '../../../shared/types'
import { STATUS_META, fmtSize } from '../status'

interface TaskListProps {
  tasks: Task[]
  selectedId: string | null
  running: boolean
  onSelect: (id: string) => void
  onStartAll: () => void
  onRetryFailed: () => void
  onClearFinished: () => void
  onRetry: (id: string) => void
  onRemove: (id: string) => void
}

export default function TaskList(props: TaskListProps) {
  const { tasks, selectedId, running, onSelect, onStartAll, onRetryFailed, onClearFinished, onRetry, onRemove } = props
  const ok = tasks.filter(t => t.status === 'success').length
  const fail = tasks.filter(t => t.status === 'failed').length
  const skip = tasks.filter(t => t.status === 'skipped').length
  const pend = tasks.filter(t => t.status === 'pending' || t.status === 'queued').length

  return (
    <div className="tasks-main">
      <div className="tl-head">
        <div className="tl-title">任务列表</div>
        <span className="tl-count">{tasks.length}</span>
        <div className="tl-stats">
          {ok > 0 && <span style={{ color: 'var(--ok)' }}>✓ {ok}</span>}
          {ok > 0 && (fail > 0 || skip > 0 || pend > 0) && <span> · </span>}
          {fail > 0 && <span style={{ color: 'var(--err)' }}>✗ {fail}</span>}
          {fail > 0 && (skip > 0 || pend > 0) && <span> · </span>}
          {skip > 0 && <span style={{ color: 'var(--text-muted)' }}>⏭ {skip}</span>}
          {skip > 0 && pend > 0 && <span> · </span>}
          {pend > 0 && <span style={{ color: 'var(--wait)' }}>⏳ {pend}</span>}
        </div>
        <div className="tl-actions">
          <button className="btn clay" onClick={onStartAll} disabled={running}>开始全部</button>
          <button className="btn ghost" onClick={onRetryFailed} disabled={running || fail === 0}>重试失败</button>
          <button className="btn ghost" onClick={onClearFinished}>清空已完成</button>
        </div>
      </div>

      <ul className="tl-list">
        {tasks.map((t, i) => (
          <li
            key={t.id}
            className={`task-row ${selectedId === t.id ? 'selected' : ''}`}
            style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
            onClick={() => onSelect(t.id)}
          >
            <span className={`dot st-${t.status}`} />
            <div className="tr-main">
              <div className="tr-line1">
                <span className={`tr-number ${t.number ? '' : 'none'}`}>{t.number ?? '番号未识别'}</span>
                {t.website && <span className="tr-site">{t.website}</span>}
                <span className={`chip st-${t.status}`}>{STATUS_META[t.status].label}</span>
              </div>
              <div className="tr-title">{t.title ?? t.fileName}</div>
              <div className="tr-meta">
                {t.filePath}
                {t.sizeMB ? ` · ${fmtSize(t.sizeMB)}` : ''}
                {t.status === 'failed' && t.error ? ` · ${t.error}` : ''}
              </div>
            </div>
            <div className="tr-right">
              {t.status === 'failed' && (
                <button
                  className="icon-btn tr-close"
                  title="重试"
                  onClick={e => { e.stopPropagation(); onRetry(t.id) }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="23 4 23 10 17 10" />
                    <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" />
                  </svg>
                </button>
              )}
              <button
                className="icon-btn tr-close"
                title="移除"
                onClick={e => { e.stopPropagation(); onRemove(t.id) }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}
