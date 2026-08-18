import { useEffect, useState } from 'react'
import {
  SITE_IDS,
  CROP_MODES,
  FOLDER_NAMING_MODES,
  ORGANIZE_MODES,
  type CropMode,
  type FolderNamingMode,
  type OrganizeMode,
  type Settings
} from '../../../shared/types/settings'

const FOLDER_NAMING_LABELS: Record<FolderNamingMode, string> = {
  number: '番号',
  numberTitle: '番号 [标题]',
  numberActorTitle: '番号 - 演员 - 标题'
}

const CROP_LABELS: Record<CropMode, string> = {
  right: '正面海报（右半边）',
  center: '居中裁切',
  full: '完整封面'
}

const ORGANIZE_LABELS: Record<OrganizeMode, string> = {
  inPlace: '就地收纳（视频所在目录）',
  central: '统一收纳到指定目录'
}

const SITE_SUFFIX: Partial<Record<(typeof SITE_IDS)[number], string>> = {
  DMM: '图片 CDN'
}

export default function SettingsPage() {
  const api = window.neoavdc
  const [settings, setSettings] = useState<Settings | null>(null)

  useEffect(() => {
    if (!api) return
    let cancelled = false
    void api.getSettings().then((s) => {
      if (!cancelled) setSettings(s)
    })
    return () => {
      cancelled = true
    }
  }, [api])

  if (!api) {
    return (
      <div className="page">
        <div className="page-inner">未检测到 Electron 接口</div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="page">
        <div className="page-inner">加载设置中…</div>
      </div>
    )
  }

  const commit = (patch: Partial<Settings>): void => {
    setSettings((prev) => (prev ? { ...prev, ...patch } : prev))
    void api.setSettings(patch).then((next) => setSettings(next))
  }

  const toggleSite = (site: (typeof SITE_IDS)[number]): void => {
    const current = settings.enabledSites
    const next = current.includes(site)
      ? current.filter((s) => s !== site)
      : [...current, site]
    commit({ enabledSites: next })
  }

  const commitText = (key: 'proxyUrl' | 'centralLibraryDir', value: string): void => {
    setSettings((prev) => (prev ? { ...prev, [key]: value } : prev))
  }

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <h2>设置</h2>
          <div className="subtitle">配置会持久化到本地，刮削引擎接入后立即生效。</div>
        </div>

        <div className="settings-note">
          抓取顺序：按勾选顺序回退，前一个站 404 / 无结果时自动尝试下一个。配置持久化到本地，立即生效。
        </div>

        <div className="set-grid">
          <section className="set-section">
            <h3>刮削来源</h3>
            <div className="set-row">
              <div>
                <div className="label">启用站点</div>
                <span className="hint">
                  元数据按顺序回退；DMM 仅作图片 CDN，在其他源取不到封面/样张时兜底
                </span>
              </div>
              <div className="set-control">
                <div className="checks">
                  {SITE_IDS.map((s) => (
                    <span
                      key={s}
                      className={`check-chip ${settings.enabledSites.includes(s) ? 'on' : ''}`}
                      onClick={() => toggleSite(s)}
                      title={SITE_SUFFIX[s] ? `${s} ${SITE_SUFFIX[s]}` : undefined}
                    >
                      {s}
                      {SITE_SUFFIX[s] ? <span className="chip-suffix">{SITE_SUFFIX[s]}</span> : null}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">网络代理</div>
                <span className="hint">http://127.0.0.1:7890，留空直连</span>
              </div>
              <div className="set-control fill">
                <input
                  type="text"
                  value={settings.proxyUrl}
                  onChange={(e) => commitText('proxyUrl', e.target.value)}
                  onBlur={() => commit({ proxyUrl: settings.proxyUrl })}
                  placeholder="http://127.0.0.1:7890"
                />
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">请求间隔（秒）</div>
                <span className="hint">避免被站点限流</span>
              </div>
              <div className="set-control">
                <input
                  type="number"
                  min={0}
                  max={3600}
                  value={settings.requestIntervalSec}
                  onChange={(e) =>
                    commit({ requestIntervalSec: Math.max(0, Number(e.target.value) || 0) })
                  }
                />
              </div>
            </div>
          </section>

          <section className="set-section">
            <h3>命名与整理</h3>
            <div className="set-row">
              <div>
                <div className="label">文件夹命名</div>
                <span className="hint">视频所在资料夹的名称格式</span>
              </div>
              <div className="set-control fill">
                <select
                  value={settings.folderNaming}
                  onChange={(e) =>
                    commit({ folderNaming: e.target.value as FolderNamingMode })
                  }
                >
                  {FOLDER_NAMING_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {FOLDER_NAMING_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">收纳方式</div>
                <span className="hint">刮削成功后视频与产物的存放位置</span>
              </div>
              <div className="set-control fill">
                <select
                  value={settings.organizeMode}
                  onChange={(e) =>
                    commit({ organizeMode: e.target.value as OrganizeMode })
                  }
                >
                  {ORGANIZE_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {ORGANIZE_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {settings.organizeMode === 'central' && (
              <div className="set-row">
                <div>
                  <div className="label">统一收纳目录</div>
                  <span className="hint">每个番号在该目录下建独立子文件夹；留空时任务会失败</span>
                </div>
                <div className="set-control fill">
                  <div className="path-input-row">
                    <input
                      type="text"
                      value={settings.centralLibraryDir}
                      onChange={(e) =>
                        commitText('centralLibraryDir', e.target.value)
                      }
                      onBlur={() =>
                        commit({ centralLibraryDir: settings.centralLibraryDir })
                      }
                      placeholder="选择或粘贴统一资料库根目录"
                    />
                    <button
                      className="btn"
                      onClick={async () => {
                        const picked = await api.selectFolder()
                        if (picked && picked.length > 0) {
                          commit({ centralLibraryDir: picked[0] })
                        }
                      }}
                    >
                      选择…
                    </button>
                  </div>
                </div>
              </div>
            )}
            <div className="set-row">
              <div>
                <div className="label">海报裁切模式</div>
                <span className="hint">fanart 转 poster 的裁切策略</span>
              </div>
              <div className="set-control fill">
                <select
                  value={settings.cropMode}
                  onChange={(e) => commit({ cropMode: e.target.value as CropMode })}
                >
                  {CROP_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {CROP_LABELS[mode]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">同名字幕自动跟随</div>
                <span className="hint">将 .srt/.ass/.vtt 一起移入资料夹并改名</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.followSubtitles}
                    onChange={(e) => commit({ followSubtitles: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
          </section>

          <section className="set-section">
            <h3>图片处理</h3>
            <div className="set-row">
              <div>
                <div className="label">去除水印</div>
                <span className="hint">阶段 2 通过图像处理自动打码/裁切</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.removeWatermark}
                    onChange={(e) => commit({ removeWatermark: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">下载高清封面</div>
                <span className="hint">优先下载大图，失败回退缩略图</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.downloadHdCover}
                    onChange={(e) => commit({ downloadHdCover: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">下载样张剧照</div>
                <span className="hint">写入 -extrafanart 目录，Kodi 可浏览</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.downloadSamples}
                    onChange={(e) => commit({ downloadSamples: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
          </section>

          <section className="set-section">
            <h3>NFO 与媒体库</h3>
            <div className="set-row">
              <div>
                <div className="label">生成 NFO</div>
                <span className="hint">Kodi / Emby / Jellyfin 可识别</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.generateNfo}
                    onChange={(e) => commit({ generateNfo: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">下载演员头像</div>
                <span className="hint">写入 actor thumb，Emby 可用</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.downloadActorAvatars}
                    onChange={(e) => commit({ downloadActorAvatars: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">已存在 .nfo 时跳过</div>
                <span className="hint">避免重复整理已处理过的视频</span>
              </div>
              <div className="set-control switch-row">
                <label className="switch">
                  <input
                    type="checkbox"
                    checked={settings.skipExistingNfo}
                    onChange={(e) => commit({ skipExistingNfo: e.target.checked })}
                  />
                  <span className="track" />
                </label>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
