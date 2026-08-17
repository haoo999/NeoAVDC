interface Tool {
  title: string
  desc: string
  icon: React.ReactNode
}

const TOOLS: Tool[] = [
  {
    title: '单文件刮削',
    desc: '选一个视频，逐步查看番号识别、站点匹配、元数据与封面，适合调试和失败救援。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  },
  {
    title: '批量下载演员头像',
    desc: '扫描已整理目录中的 NFO，按演员名批量补齐头像，供 Emby/Jellyfin 使用。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  },
  {
    title: '封面裁切预览',
    desc: '在 fanart 上框选 poster 区域，实时预览效果，支持居中/顶部/手动三种模式。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 15l5-5 4 4 3-3 6 6" />
        <circle cx="9" cy="9" r="1.5" />
      </svg>
    )
  }
]

export default function ToolsPage() {
  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <h2>工具</h2>
          <div className="subtitle">独立于批量任务的辅助功能，在二期逐步开放。</div>
        </div>
        <div className="tools-grid">
          {TOOLS.map(t => (
            <div key={t.title} className="tool-card">
              <span className="soon-badge">二期</span>
              <div className="ticon">{t.icon}</div>
              <h3>{t.title}</h3>
              <p>{t.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
