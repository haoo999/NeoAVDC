import { useState } from 'react'

const SITES = ['JavBus', 'JavDB', 'Jav321', 'AvBase', 'DMM', 'MGStage', 'XCity']
const CROP_MODES = ['居中裁切', '完整封面', '顶部对齐']

export default function SettingsPage() {
  const [enabledSites, setEnabledSites] = useState<string[]>(['JavBus', 'JavDB', 'Jav321'])
  const [proxy, setProxy] = useState('')
  const [naming, setNaming] = useState('番号')
  const [crop, setCrop] = useState(CROP_MODES[0])
  const [wm, setWm] = useState(true)
  const [coverWm, setCoverWm] = useState(true)
  const [subs, setSubs] = useState(true)
  const [genNfo, setGenNfo] = useState(true)
  const [actorAvatars, setActorAvatars] = useState(false)
  const [skipNfo, setSkipNfo] = useState(true)

  const toggleSite = (s: string) => {
    setEnabledSites((prev) => (prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s]))
  }

  return (
    <div className="page">
      <div className="page-inner">
        <div className="page-head">
          <h2>设置</h2>
          <div className="subtitle">阶段 1 接入后这些配置才会真正生效；现在只是界面预览。</div>
        </div>

        <div className="settings-note">
          当前为骨架阶段，所有开关均未连接真实引擎。阶段 1 会实现刮削源、代理与命名规则的持久化。
        </div>

        <div className="set-grid">
          <section className="set-section">
            <h3>刮削来源</h3>
            <div className="set-row">
              <div>
                <div className="label">启用站点</div>
                <span className="hint">按顺序尝试，失败自动换下一个</span>
              </div>
              <div className="set-control">
                <div className="checks">
                  {SITES.map((s) => (
                    <span
                      key={s}
                      className={`check-chip ${enabledSites.includes(s) ? 'on' : ''}`}
                      onClick={() => toggleSite(s)}
                    >
                      {s}
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
                  value={proxy}
                  onChange={(e) => setProxy(e.target.value)}
                  placeholder="http://127.0.0.1:7890"
                  disabled
                />
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">请求间隔（秒）</div>
                <span className="hint">避免被站点限流</span>
              </div>
              <div className="set-control">
                <input type="text" defaultValue="2" disabled style={{ width: 120 }} />
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
                <select value={naming} onChange={(e) => setNaming(e.target.value)} disabled>
                  <option>番号</option>
                  <option>番号 [标题]</option>
                  <option>番号 - 演员 - 标题</option>
                </select>
              </div>
            </div>
            <div className="set-row">
              <div>
                <div className="label">海报裁切模式</div>
                <span className="hint">fanart 转 poster 的裁切策略</span>
              </div>
              <div className="set-control fill">
                <select value={crop} onChange={(e) => setCrop(e.target.value)} disabled>
                  {CROP_MODES.map((c) => (
                    <option key={c}>{c}</option>
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
                  <input type="checkbox" checked={subs} onChange={(e) => setSubs(e.target.checked)} />
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
                  <input type="checkbox" checked={wm} onChange={(e) => setWm(e.target.checked)} />
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
                  <input type="checkbox" checked={coverWm} onChange={(e) => setCoverWm(e.target.checked)} />
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
                  <input type="checkbox" checked={genNfo} onChange={(e) => setGenNfo(e.target.checked)} />
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
                  <input type="checkbox" checked={actorAvatars} onChange={(e) => setActorAvatars(e.target.checked)} />
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
                  <input type="checkbox" checked={skipNfo} onChange={(e) => setSkipNfo(e.target.checked)} />
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
