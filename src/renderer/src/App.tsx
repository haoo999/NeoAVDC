import { useCallback, useEffect, useState } from 'react'
import type { CropMode, EngineEvent, Progress, Settings, Task } from '../../shared/types'
import { DEFAULT_SETTINGS } from '../../shared/settings'
import { applyTheme, getInitialTheme, toggleTheme, type Theme } from './theme'
import TopBar from './components/TopBar'
import DropZone from './components/DropZone'
import TaskList from './components/TaskList'
import DetailPanel from './components/DetailPanel'
import LogDrawer, { type TimelineEntry } from './components/LogDrawer'
import SettingsPage from './components/SettingsPage'
import ToolsPage from './components/ToolsPage'

export type Tab = 'tasks' | 'settings' | 'tools'

const MAX_ENTRIES = 400

export default function App() {
  const api = window.neoavdc
  const [tab, setTab] = useState<Tab>('tasks')
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())
  const [tasks, setTasks] = useState<Task[]>([])
  const [entries, setEntries] = useState<TimelineEntry[]>([])
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0, running: false })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(false)
  const [dragOver, setDragOver] = useState(false)
  const [cropMode, setCropMode] = useState<CropMode>(DEFAULT_SETTINGS.cropMode)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  // 读取裁切设置供详情面板预览使用；设置变更后重新拉取
  useEffect(() => {
    if (!api) return
    let cancelled = false
    void api.getSettings().then((s: Settings) => {
      if (!cancelled) setCropMode(s.cropMode)
    })
    return () => {
      cancelled = true
    }
  }, [api, tab])

  useEffect(() => {
    if (!api) return
    return api.onEngineEvent((ev: EngineEvent) => {
      if (ev.type === 'tasks') setTasks(ev.tasks)
      else if (ev.type === 'log') {
        setEntries((prev) => {
          const next: TimelineEntry[] = [
            ...prev,
            {
              kind: 'log',
              time: ev.line.time,
              level: ev.line.level,
              message: ev.line.message
            }
          ]
          return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
        })
      } else if (ev.type === 'progress') setProgress(ev.progress)
      else if (ev.type === 'activity-update') {
        setEntries((prev) => {
          const idx = prev.findIndex(
            (e) => e.kind === 'activity' && e.key === ev.line.key
          )
          if (idx >= 0) {
            const next = prev.slice()
            const old = next[idx]
            if (old && old.kind === 'activity') {
              next[idx] = {
                ...old,
                level: ev.line.level,
                message: ev.line.message
              }
            }
            return next
          }
          const next: TimelineEntry[] = [
            ...prev,
            {
              kind: 'activity',
              key: ev.line.key,
              startedAt: Date.now(),
              level: ev.line.level,
              message: ev.line.message
            }
          ]
          return next.length > MAX_ENTRIES ? next.slice(-MAX_ENTRIES) : next
        })
      } else if (ev.type === 'activity-commit') {
        setEntries((prev) => {
          const idx = prev.findIndex(
            (e) => e.kind === 'activity' && e.key === ev.key
          )
          if (idx < 0) return prev
          const next = prev.slice()
          next[idx] = {
            kind: 'log',
            time: ev.line.time,
            level: ev.line.level,
            message: ev.line.message
          }
          return next
        })
      }
    })
  }, [api])

  useEffect(() => {
    const hasFiles = (e: DragEvent): boolean => Array.from(e.dataTransfer?.types ?? []).includes('Files')
    const onDragOver = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragOver(true)
    }
    const onDragLeave = (e: DragEvent): void => {
      if (e.relatedTarget === null) setDragOver(false)
    }
    const onDrop = (e: DragEvent): void => {
      if (!hasFiles(e)) return
      e.preventDefault()
      setDragOver(false)
      const files = Array.from(e.dataTransfer?.files ?? [])
      if (!api || files.length === 0) return
      const paths = files.map((f) => api.getPathForFile(f)).filter((p) => p && p.length > 0)
      if (paths.length === 0) return
      void api.addPaths(paths)
      setTab('tasks')
    }
    window.addEventListener('dragover', onDragOver)
    window.addEventListener('dragleave', onDragLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragover', onDragOver)
      window.removeEventListener('dragleave', onDragLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [api])

  const selected = tasks.find((t) => t.id === selectedId) ?? null

  const pickFiles = useCallback(async () => {
    const paths = (await api?.selectFiles()) ?? []
    if (paths.length) void api?.addPaths(paths)
  }, [api])

  const pickFolder = useCallback(async () => {
    const paths = (await api?.selectFolder()) ?? []
    if (paths.length) void api?.addPaths(paths)
  }, [api])

  return (
    <div className="app" data-theme={theme}>
      <TopBar
        activeTab={tab}
        onChange={setTab}
        taskCount={tasks.length}
        running={progress.running}
        theme={theme}
        onToggleTheme={() => setTheme((t) => toggleTheme(t))}
      />
      <div className="app-body">
        {tab === 'tasks' && (
          <div className="tasks-layout">
            {tasks.length === 0 ? (
              <div className="tasks-main">
                <DropZone onPickFiles={pickFiles} onPickFolder={pickFolder} />
              </div>
            ) : (
              <TaskList
                tasks={tasks}
                selectedId={selectedId}
                running={progress.running}
                onSelect={setSelectedId}
                onStartAll={() => void api?.startAll()}
                onRetryFailed={() => void api?.retryFailed()}
                onClearFinished={() => void api?.clearFinished()}
                onRetry={(id) => void api?.retryTask(id)}
                onRemove={(id) => void api?.removeTask(id)}
              />
            )}
            {selected && (
              <DetailPanel
                task={selected}
                cropMode={cropMode}
                running={progress.running}
                onRetry={(id) => void api?.retryTask(id)}
                onRescrape={(id, number) => void api?.rescrapeTask(id, { number })}
                onClose={() => setSelectedId(null)}
              />
            )}
          </div>
        )}
        {tab === 'settings' && <SettingsPage />}
        {tab === 'tools' && <ToolsPage />}
      </div>
      <LogDrawer
        open={logOpen}
        entries={entries}
        progress={progress}
        onToggle={() => setLogOpen((v) => !v)}
        onClear={() => setEntries([])}
      />
      {dragOver && (
        <div className="drop-overlay">
          <div className="msg">松开以添加任务</div>
        </div>
      )}
      {!api && <div className="no-api">未检测到 Electron 接口（请在桌面 App 中运行）</div>}
    </div>
  )
}
