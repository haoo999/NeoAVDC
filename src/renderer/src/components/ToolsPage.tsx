import { useEffect, useMemo, useState } from 'react'
import type {
  ActorAvatarPlatform,
  AvatarProgress,
  AvatarSummary,
  CropPreviewResult,
  ProbeChannelState,
  ProbeEvent,
  ProbeHit,
  ScanResult
} from '../../../shared/types'
import { useImageSource } from '../useImageSource'

type ToolKey = 'probe' | 'crop' | 'scan' | 'avatars'

interface ToolMeta {
  key: ToolKey
  title: string
  desc: string
  icon: React.ReactNode
}

const TOOLS: ToolMeta[] = [
  {
    key: 'probe',
    title: '番号速查',
    desc: '输入番号，多数据源依次查询标题、演员、日期、封面，不写盘。用于调试识别和站点可用性。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    )
  },
  {
    key: 'crop',
    title: '封面裁切预览',
    desc: '输入番号或 fanart URL，用真实 sharp 管线生成 right / center / full 三种 2:3 海报，可导出 JPEG。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 15l5-5 4 4 3-3 6 6" />
        <circle cx="9" cy="9" r="1.5" />
      </svg>
    )
  },
  {
    key: 'scan',
    title: '媒体库体检',
    desc: '递归扫描已整理目录，统计作品数、缺失海报/背景数量和缺头像的演员，只读不写。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M3 3v18h18" />
        <path d="M7 14l3-3 3 3 5-5" />
      </svg>
    )
  },
  {
    key: 'avatars',
    title: '演员头像回填',
    desc: '扫描已整理目录 NFO 中的演员，按数据源搜索头像；存储策略与 NFO 引用跟随全局「演员头像目标平台」设置，可选回写 NFO thumb。',
    icon: (
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round" strokeLinejoin="round">
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    )
  }
]

const CROP_LABELS: Record<string, string> = {
  right: '正面海报（右半边）',
  center: '居中裁切',
  full: '完整封面'
}

export default function ToolsPage() {
  const api = window.neoavdc
  const [active, setActive] = useState<ToolKey | null>(null)

  if (!api) {
    return (
      <div className="page">
        <div className="page-inner">未检测到 Electron 接口</div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <h2>工具</h2>
          <div className="subtitle">独立于批量任务的辅助功能，用于调试、预览与媒体库维护。</div>
        </div>
        {active ? (
          <ToolView tool={active} onBack={() => setActive(null)} />
        ) : (
          <div className="tools-grid">
            {TOOLS.map((t) => (
              <button key={t.key} type="button" className="tool-card tool-card-btn" onClick={() => setActive(t.key)}>
                <div className="ticon">{t.icon}</div>
                <h3>{t.title}</h3>
                <p>{t.desc}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ToolView({ tool, onBack }: { tool: ToolKey; onBack: () => void }) {
  const meta = TOOLS.find((t) => t.key === tool)!
  return (
    <div className="tool-view">
      <div className="tool-view-head">
        <button type="button" className="btn ghost tool-back" onClick={onBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          返回
        </button>
        <h3>{meta.title}</h3>
        <p className="tool-view-desc">{meta.desc}</p>
      </div>
      {tool === 'probe' && <ProbeTool />}
      {tool === 'crop' && <CropTool />}
      {tool === 'scan' && <ScanTool />}
      {tool === 'avatars' && <AvatarsTool />}
    </div>
  )
}

function ProbeTool() {
  const api = window.neoavdc!
  const [number, setNumber] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [started, setStarted] = useState(false)
  const [channels, setChannels] = useState<Record<string, ProbeChannelState>>({})
  const [hits, setHits] = useState<Record<string, ProbeHit>>({})

  const orderedSources = useMemo(() => {
    const tail = new Set(['Heyzo', 'FC2'])
    const all = Object.keys(channels)
    return [...all.filter((s) => !tail.has(s)), ...all.filter((s) => tail.has(s))]
  }, [channels])

  const run = async (): Promise<void> => {
    const value = number.trim()
    if (!value || busy) return
    setBusy(true)
    setError('')
    setStarted(true)
    setChannels({})
    setHits({})
    try {
      const result = await api.toolsProbe(value)
      const nextHits: Record<string, ProbeHit> = {}
      for (const h of result.hits) nextHits[h.source] = h
      setHits(nextHits)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    if (!started) return
    const off = api.onProbeEvent((ev: ProbeEvent) => {
      if (ev.type === 'start') {
        const initial: Record<string, ProbeChannelState> = {}
        for (const src of ev.sources) initial[src] = { source: src, status: 'pending' }
        setChannels(initial)
      } else if (ev.type === 'channel') {
        setChannels((prev) => ({ ...prev, [ev.state.source]: ev.state }))
        const hit = ev.hit
        if (hit) {
          setHits((prev) => ({ ...prev, [hit.source]: hit }))
        }
      }
    })
    return off
  }, [api, started])

  return (
    <div className="tool-body">
      <div className="tool-row">
        <input
          className="tool-input"
          type="text"
          value={number}
          placeholder="输入番号，如 SSIS-001"
          onChange={(e) => setNumber(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
          }}
        />
        <button type="button" className="btn primary" disabled={busy || !number.trim()} onClick={() => void run()}>
          {busy ? '查询中…' : '查询'}
        </button>
      </div>
      {error && <div className="tool-error">{error}</div>}
      {started && (
        <div className="probe-results">
          {orderedSources.map((src) => (
            <ProbeChannelCard
              key={src}
              state={channels[src]}
              hit={hits[src]}
            />
          ))}
        </div>
      )}
    </div>
  )
}

const PROBE_STATUS_LABEL: Record<ProbeChannelState['status'], string> = {
  pending: '等待中',
  querying: '查询中',
  hit: '命中',
  miss: '未找到',
  skip: '跳过',
  error: '出错'
}

function ProbeChannelCard({ state, hit }: { state?: ProbeChannelState; hit?: ProbeHit }) {
  const status = state?.status ?? 'pending'
  const isOk = status === 'hit' && hit?.ok
  const chipClass =
    status === 'hit' ? 'st-success'
    : status === 'querying' ? 'st-scraping'
    : status === 'pending' ? 'st-queued'
    : 'st-failed'
  return (
    <div className={`probe-hit ${isOk ? 'is-ok' : status === 'querying' || status === 'pending' ? 'is-pending' : 'is-fail'}`}>
      <div className="probe-hit-head">
        <span className="probe-source">{state?.source ?? '—'}</span>
        <span className={`chip ${chipClass}`}>{PROBE_STATUS_LABEL[status]}</span>
      </div>
      {isOk && hit ? (
        <ProbeHitBody hit={hit} />
      ) : status === 'error' && state?.error ? (
        <div className="probe-fail-msg">{state.error}</div>
      ) : status === 'querying' ? (
        <div className="probe-fail-msg probe-pending-msg">正在请求该渠道…</div>
      ) : status === 'pending' ? (
        <div className="probe-fail-msg probe-pending-msg">排队等待查询</div>
      ) : (
        <div className="probe-fail-msg">未返回数据</div>
      )}
    </div>
  )
}

function ProbeHitBody({ hit }: { hit: ProbeHit }) {
  const cover = useImageSource(hit.posterDataUrl || hit.coverUrl || '')
  return (
    <div className="probe-hit-body">
      <div className="probe-cover-wrap">
        {cover ? <img src={cover} alt={hit.title} /> : <div className="probe-cover-placeholder">封面加载中…</div>}
      </div>
      <dl className="detail-grid probe-meta">
        <dt>标题</dt>
        <dd>{hit.title}</dd>
        <dt>演员</dt>
        <dd>{hit.actors.length ? hit.actors.map((a) => a.name).join('、') : '—'}</dd>
        <dt>日期</dt>
        <dd>{hit.releaseDate || '—'}</dd>
        <dt>片长</dt>
        <dd>{hit.runtimeMin ? `${hit.runtimeMin} 分钟` : '—'}</dd>
        <dt>厂商</dt>
        <dd>{hit.maker || '—'}</dd>
        <dt>系列</dt>
        <dd>{hit.series || '—'}</dd>
        <dt>标签</dt>
        <dd>{hit.genres.length ? hit.genres.join('、') : '—'}</dd>
      </dl>
    </div>
  )
}

function CropTool() {
  const api = window.neoavdc!
  const [number, setNumber] = useState('')
  const [url, setUrl] = useState('')
  const [removeWatermark, setRemoveWatermark] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<CropPreviewResult | null>(null)
  const [exportMode, setExportMode] = useState<'right' | 'center' | 'full'>('right')
  const [exporting, setExporting] = useState(false)

  const canRun = number.trim() || url.trim()

  const run = async (): Promise<void> => {
    if (!canRun) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(
        await api.toolsCropPreview({
          number: number.trim() || undefined,
          fanartUrl: url.trim() || undefined,
          removeWatermark
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const exportOne = async (): Promise<void> => {
    if (!result) return
    const mode = exportMode
    const defaultName = `${(number.trim() || 'poster').replace(/[\\/:*?"<>|]/g, '_')}-${mode}.jpg`
    const target = await api.saveFile(defaultName, [{ name: 'JPEG', extensions: ['jpg'] }])
    if (!target) return
    setExporting(true)
    setError('')
    try {
      await api.toolsCropExport(
        {
          number: number.trim() || undefined,
          fanartUrl: url.trim() || undefined,
          removeWatermark,
          mode
        },
        target
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="tool-body">
      <div className="tool-form">
        <label className="tool-field">
          <span>番号</span>
          <input
            type="text"
            value={number}
            placeholder="如 SSIS-001（与 URL 二选一）"
            onChange={(e) => setNumber(e.target.value)}
          />
        </label>
        <label className="tool-field">
          <span>fanart URL</span>
          <input
            type="text"
            value={url}
            placeholder="可粘贴 DMM/JavBus 横版封面地址"
            onChange={(e) => setUrl(e.target.value)}
          />
        </label>
        <label className="tool-check">
          <input type="checkbox" checked={removeWatermark} onChange={(e) => setRemoveWatermark(e.target.checked)} />
          <span>启用去水印（与设置一致）</span>
        </label>
        <div className="tool-row">
          <button type="button" className="btn primary" disabled={busy || !canRun} onClick={() => void run()}>
            {busy ? '处理中…' : '生成预览'}
          </button>
        </div>
      </div>
      {error && <div className="tool-error">{error}</div>}
      {result && (
        <div className="crop-result">
          <div className="crop-result-head">
            <span>来源：{result.sourceLabel}</span>
            <span>
              原始尺寸 {result.width}×{result.height}
            </span>
          </div>
          <div className="crop-variants">
            {result.variants.map((v) => (
              <div key={v.mode} className={`crop-variant mode-${v.mode}`}>
                <img src={v.dataUrl} alt={CROP_LABELS[v.mode]} />
                <div className="crop-variant-meta">
                  <span>{CROP_LABELS[v.mode]}</span>
                  <span className="muted">
                    {v.width}×{v.height}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="tool-row crop-export-row">
            <select value={exportMode} onChange={(e) => setExportMode(e.target.value as typeof exportMode)}>
              <option value="right">{CROP_LABELS.right}</option>
              <option value="center">{CROP_LABELS.center}</option>
              <option value="full">{CROP_LABELS.full}</option>
            </select>
            <button type="button" className="btn clay" disabled={exporting} onClick={() => void exportOne()}>
              {exporting ? '导出中…' : '导出所选 JPEG'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function ScanTool() {
  const api = window.neoavdc!
  const [dir, setDir] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<ScanResult | null>(null)
  const [filter, setFilter] = useState<'all' | 'poster' | 'fanart' | 'avatar'>('all')

  const pick = async (): Promise<void> => {
    const folders = await api.selectFolder()
    if (folders[0]) setDir(folders[0])
  }

  const run = async (): Promise<void> => {
    if (!dir) return
    setBusy(true)
    setError('')
    setResult(null)
    try {
      setResult(await api.toolsScan(dir))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const filtered = useMemo(() => {
    if (!result) return []
    if (filter === 'poster') return result.works.filter((w) => !w.hasPoster)
    if (filter === 'fanart') return result.works.filter((w) => !w.hasFanart)
    if (filter === 'avatar') return result.works.filter((w) => w.missingAvatars.length > 0)
    return result.works
  }, [result, filter])

  return (
    <div className="tool-body">
      <div className="tool-row">
        <input className="tool-input tool-input-fill" type="text" value={dir} readOnly placeholder="选择已整理的媒体库根目录" />
        <button type="button" className="btn ghost" onClick={() => void pick()}>
          选择…
        </button>
        <button type="button" className="btn primary" disabled={busy || !dir} onClick={() => void run()}>
          {busy ? '扫描中…' : '开始扫描'}
        </button>
      </div>
      {error && <div className="tool-error">{error}</div>}
      {result && (
        <div className="scan-result">
          <div className="scan-stats">
            <Stat label="作品总数" value={result.totalWorks} />
            <Stat label="缺海报" value={result.missingPoster} tone={result.missingPoster > 0 ? 'warn' : 'ok'} />
            <Stat label="缺背景" value={result.missingFanart} tone={result.missingFanart > 0 ? 'warn' : 'ok'} />
            <Stat label="缺头像人次" value={result.missingAvatarActors} tone={result.missingAvatarActors > 0 ? 'warn' : 'ok'} />
          </div>
          <div className="scan-filters">
            {([
              ['all', '全部'],
              ['poster', '缺海报'],
              ['fanart', '缺背景'],
              ['avatar', '缺头像']
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`check-chip ${filter === key ? 'on' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="scan-list">
            {filtered.length === 0 && <div className="muted scan-empty">没有符合条件的作品。</div>}
            {filtered.map((w) => (
              <div key={w.nfoPath} className="scan-row">
                <div className="scan-row-main">
                  <span className="tr-number">{w.number}</span>
                  <span className="scan-title">{w.title}</span>
                </div>
                <div className="scan-row-tags">
                  {!w.hasPoster && <span className="chip st-failed">缺海报</span>}
                  {!w.hasFanart && <span className="chip st-failed">缺背景</span>}
                  {w.missingAvatars.length > 0 && (
                    <span className="chip st-queued">缺头像：{w.missingAvatars.slice(0, 3).join('、')}{w.missingAvatars.length > 3 ? ' …' : ''}</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'ok' | 'warn' }) {
  return (
    <div className={`scan-stat ${tone ?? ''}`}>
      <div className="scan-stat-value">{value}</div>
      <div className="scan-stat-label">{label}</div>
    </div>
  )
}

function AvatarsTool() {
  const api = window.neoavdc!
  const [dir, setDir] = useState('')
  const [updateNfo, setUpdateNfo] = useState(true)
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<AvatarProgress | null>(null)
  const [summary, setSummary] = useState<AvatarSummary | null>(null)
  const [error, setError] = useState('')
  const [platform, setPlatform] = useState<ActorAvatarPlatform>('Kodi')

  useEffect(() => {
    if (!api) return
    void api.getSettings().then((s) => setPlatform(s.actorAvatarPlatform))
  }, [api])

  useEffect(() => {
    if (!api) return
    const unsub = api.onToolsEvent((ev) => {
      if (ev.type === 'progress') setProgress(ev.progress)
      else if (ev.type === 'done') {
        setSummary(ev.summary)
        setRunning(false)
      } else if (ev.type === 'error') {
        setError(ev.message)
        setRunning(false)
      }
    })
    return unsub
  }, [api])

  const pick = async (): Promise<void> => {
    const folders = await api.selectFolder()
    if (folders[0]) setDir(folders[0])
  }

  const start = async (): Promise<void> => {
    if (!dir || running) return
    setRunning(true)
    setError('')
    setSummary(null)
    setProgress({ stage: 'scan', current: 0, total: 0, message: '准备中…' })
    try {
      await api.toolsAvatarsStart(dir, { updateNfo })
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setRunning(false)
    }
  }

  const cancel = (): void => {
    if (!running) return
    void api.toolsAvatarsCancel()
  }

  const percent = progress && progress.total > 0 ? Math.round((progress.current / progress.total) * 100) : 0
  const isLocal = platform !== 'Infuse'
  const platformHint = isLocal
    ? `当前全局设置：本地头像（.actors 子目录），代表平台 ${platform}。头像会下载到每个番号目录的 .actors/ 下，NFO 写入本地相对路径，Kodi / Emby / Jellyfin / Plex 互通。`
    : `当前全局设置：Infuse（DMM 远程地址）。不下载本地头像文件、不建 .actors 目录，NFO 写入 DMM 无防盗链远程 URL；DMM 覆盖不到的演员不显示头像。`

  return (
    <div className="tool-body">
      <div className="settings-note avatar-platform-hint">
        {platformHint}
        <span className="avatar-platform-hint-tail">如需切换，请到「设置 → 演员头像目标平台」修改。</span>
      </div>
      <div className="tool-row">
        <input className="tool-input tool-input-fill" type="text" value={dir} readOnly placeholder="选择已整理的媒体库根目录" />
        <button type="button" className="btn ghost" onClick={() => void pick()}>
          选择…
        </button>
      </div>
      <label className="tool-check">
        <input type="checkbox" checked={updateNfo} onChange={(e) => setUpdateNfo(e.target.checked)} />
        <span>同时回写 NFO 中的 actor thumb 引用（{isLocal ? '本地相对路径' : 'DMM 远程 URL'}）</span>
      </label>
      <div className="tool-row">
        <button type="button" className="btn clay" disabled={!dir || running} onClick={() => void start()}>
          {running ? '回填中…' : '开始回填头像'}
        </button>
        {running && (
          <button type="button" className="btn ghost" onClick={cancel}>
            取消
          </button>
        )}
      </div>
      {error && <div className="tool-error">{error}</div>}
      {(running || progress) && (
        <div className="avatar-progress">
          <div className="avatar-progress-bar">
            <div className="sb-bar" style={{ width: `${percent}%` }} />
          </div>
          <div className="avatar-progress-text">
            {progress?.message ?? '处理中…'}
            {progress && progress.total > 0 && `（${progress.current}/${progress.total}）`}
          </div>
        </div>
      )}
      {summary && (
        <div className="avatar-summary">
          <h4>回填完成</h4>
          <dl className="detail-grid">
            <dt>扫描作品</dt>
            <dd>{summary.scannedWorks}</dd>
            <dt>不重复演员</dt>
            <dd>{summary.uniqueActors}</dd>
            <dt>新下载</dt>
            <dd>{summary.downloaded}</dd>
            <dt>已复用</dt>
            <dd>{summary.reused}</dd>
            <dt>NFO 已更新</dt>
            <dd>{summary.nfoUpdated}</dd>
            <dt>失败</dt>
            <dd>{summary.failed.length === 0 ? '无' : summary.failed.join('、')}</dd>
          </dl>
        </div>
      )}
    </div>
  )
}
