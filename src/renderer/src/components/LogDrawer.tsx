import { useEffect, useRef } from 'react'
import type { LogLine, Progress } from '../../../shared/types'
import { fmtTime } from '../status'

interface LogDrawerProps {
  open: boolean
  onToggle: () => void
  logs: LogLine[]
  progress: Progress
}

export default function LogDrawer({ open, onToggle, logs, progress }: LogDrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [logs, open])

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  const lastLog = logs.length > 0 ? logs[logs.length - 1] : null
  const hasError = logs.some((l) => l.level === 'error')

  return (
    <div className={`logdrawer ${open ? 'open' : ''}`}>
      <div className="ld-reveal">
        <div className="ld-body" ref={bodyRef}>
          {logs.length === 0 && <div className="ll">等待启动…</div>}
          {logs.map((l, i) => (
            <div key={`${l.time}-${i}`} className={`ll ${l.level ? 'll-' + l.level : ''}`}>
              <span className="t">{fmtTime(l.time)}</span>
              <span>{l.message}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="statusbar">
        <button className="sb-item sb-toggle" onClick={onToggle}>
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}
          >
            <polyline points="18 15 12 9 6 15" />
          </svg>
          <span>LOG</span>
          <span className="sb-count">{logs.length}</span>
        </button>
        <div className="sb-item sb-last">
          {lastLog ? (
            <>
              {hasError && <span className="sb-dot err" />}
              <span className="sb-last-text">{lastLog.message}</span>
            </>
          ) : (
            <span className="sb-idle">就绪</span>
          )}
        </div>
        <div className="sb-right">
          {progress.total > 0 && (
            <>
              <div className="sb-bar"><i style={{ width: `${pct}%` }} /></div>
              <span className="sb-item mono">{progress.done}/{progress.total} · {pct}%</span>
            </>
          )}
          {progress.running && (
            <span className="sb-item">
              <span className="sb-dot run" /> 运行中
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
