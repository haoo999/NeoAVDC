import { useEffect, useRef } from 'react'
import type { LogLevel, Progress } from '../../../shared/types'
import { fmtTime } from '../status'

export type TimelineEntry =
  | { kind: 'log'; time: number; level: LogLevel; message: string }
  | { kind: 'activity'; key: string; startedAt: number; level: LogLevel; message: string }

interface LogDrawerProps {
  open: boolean
  onToggle: () => void
  entries: TimelineEntry[]
  progress: Progress
  onClear: () => void
}

export default function LogDrawer({
  open,
  onToggle,
  entries,
  progress,
  onClear
}: LogDrawerProps) {
  const bodyRef = useRef<HTMLDivElement>(null)
  const sig = entries.map((e) => `${e.kind}:${e.message}`).join('|')

  useEffect(() => {
    if (open && bodyRef.current) {
      bodyRef.current.scrollTop = bodyRef.current.scrollHeight
    }
  }, [sig, open])

  const pct = progress.total > 0 ? Math.round((progress.done / progress.total) * 100) : 0
  // 底栏活动信息位：只显示当前正在进行的活动
  const currentActivity = (() => {
    for (let i = entries.length - 1; i >= 0; i--) {
      const e = entries[i]
      if (e.kind === 'activity') return e
    }
    return null
  })()

  return (
    <div className={`logdrawer ${open ? 'open' : ''}`}>
      <div className="ld-reveal">
        <div className="ld-head">
          <span>运行日志</span>
          <button className="ld-clear" type="button" onClick={onClear}>
            清空
          </button>
        </div>
        <div className="ld-body" ref={bodyRef}>
          {entries.length === 0 && <div className="ll">等待启动…</div>}
          {entries.map((e, i) =>
            e.kind === 'log' ? (
              <div
                key={`log:${e.time}-${i}`}
                className={`ll ${e.level ? 'll-' + e.level : ''}`}
              >
                <span className="t">{fmtTime(e.time)}</span>
                <span>{e.message}</span>
              </div>
            ) : (
              <div
                key={`act:${e.key}`}
                className={`ll ll-${e.level} ll-activity`}
              >
                <span className="t">{fmtTime(e.startedAt)}</span>
                <span className="ll-act-dot" />
                <span>{e.message}</span>
              </div>
            )
          )}
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
          <span className="sb-count">{entries.length}</span>
        </button>
        <div className="sb-item sb-last">
          {currentActivity ? (
            <>
              <span className="sb-dot run" />
              <span className="sb-last-text">{currentActivity.message}</span>
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
