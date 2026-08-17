import type { Theme } from '../theme'

interface TopBarProps {
  activeTab: 'tasks' | 'settings' | 'tools'
  onChange: (t: 'tasks' | 'settings' | 'tools') => void
  running: boolean
  taskCount: number
  theme: Theme
  onToggleTheme: () => void
}

const TABS: { key: TopBarProps['activeTab']; label: string }[] = [
  { key: 'tasks', label: '任务' },
  { key: 'settings', label: '设置' },
  { key: 'tools', label: '工具' }
]

export default function TopBar({ activeTab, onChange, running, taskCount, theme, onToggleTheme }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="brand">
        <span className="mark">◆</span>
        <span>NEO · AVDC</span>
        <span className="ver">v0.1</span>
      </div>
      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.key}
            className={`tab ${activeTab === t.key ? 'active' : ''}`}
            onClick={() => onChange(t.key)}
          >
            {t.label}
            {t.key === 'tasks' && taskCount > 0 && <span className="badge">{taskCount}</span>}
          </button>
        ))}
      </nav>
      <div className="topbar-right">
        {running && (
          <div className="run-ind">
            <span className="dot st-scraping" /> 运行中
          </div>
        )}
        <button
          className="icon-btn theme-btn"
          onClick={onToggleTheme}
          title={theme === 'dark' ? '切换到浅色模式' : '切换到深色模式'}
          aria-label="切换主题"
        >
          {theme === 'dark' ? (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="4" />
              <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
            </svg>
          ) : (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
            </svg>
          )}
        </button>
      </div>
    </header>
  )
}
