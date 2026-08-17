import { useCallback, useEffect, useState } from 'react'
import type { EngineEvent, LogLine, Progress, Task } from '../../shared/types'
import { applyTheme, getInitialTheme, toggleTheme, type Theme } from './theme'
import TopBar from './components/TopBar'
import DropZone from './components/DropZone'
import TaskList from './components/TaskList'
import DetailPanel from './components/DetailPanel'
import LogDrawer from './components/LogDrawer'
import SettingsPage from './components/SettingsPage'
import ToolsPage from './components/ToolsPage'

export type Tab = 'tasks' | 'settings' | 'tools'

export default function App() {
  const api = window.neoavdc
  const [tab, setTab] = useState<Tab>('tasks')
  const [theme, setTheme] = useState<Theme>(() => getInitialTheme())
  const [tasks, setTasks] = useState<Task[]>([])
  const [logs, setLogs] = useState<LogLine[]>([])
  const [progress, setProgress] = useState<Progress>({ done: 0, total: 0, running: false })
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [logOpen, setLogOpen] = useState(true)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  useEffect(() => {
    if (!api) return
    return api.onEngineEvent((ev: EngineEvent) => {
      if (ev.type === 'tasks') setTasks(ev.tasks)
      else if (ev.type === 'log')
        setLogs((prev) => (prev.length > 400 ? [...prev.slice(-400), ev.line] : [...prev, ev.line]))
      else setProgress(ev.progress)
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
                running={progress.running}
                onRetry={(id) => void api?.retryTask(id)}
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
        logs={logs}
        progress={progress}
        onToggle={() => setLogOpen((v) => !v)}
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
