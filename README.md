# NeoAVDC

本地运行的 AV 元数据刮削器：从文件名识别番号、抓取元数据、下载图片、裁切海报、生成 [Kodi NFO](https://kodi.wiki/view/NFO_files/Movies) 并把视频原地整理成带海报的资料夹。图形界面，数据全部保存在本地，不上传任何内容。

> 重构自旧的 Python/PyQt5 版 AVDC。当前阶段：刮削 / 图片 / NFO / 多数据源 / 工具页已落地，软链接、番号识别容错等救援能力在 Roadmap 上继续推进。

## 功能

- 番号识别：有码、无码、FC2、HEYZO、欧美（CDN/光盘编号）、`cdN` 多碟、`-C` 中文字幕、多位数字、`_`/空格分隔等变体。
- 多数据源按番号类型自动路由：
  - **JavBus / JavDB / Jav321**：常规有码番号，按设置启用与顺序依次尝试。
  - **HEYZO / FC2**：专用源，对不匹配番号零网络开销直接跳过；始终启用、固定排在最前，不占用设置页开关。
  - **DMM**：仅作图片 CDN 兜底（高清封面回退），不是元数据源。
- 图片：封面、样张、女优头像。DMM 高清封面 → 缩略图自动回退；按魔术字节识别真实类型，不信任 URL 后缀。
- 海报裁切：横版包装盒封面 → 2:3 竖海报，支持 `right`（默认）/`center`/`full` 三种模式。
  - `right` 基于真实封面几何（实测 DMM/JavBus 800×538 封面书脊折痕约在全宽 52.5%，正面宽高比 ≈0.71，略宽于 2:3）：先取右半正面，再在其中居中取 2:3，保留靠近书脊的一小段正面，避免旧逻辑从右边缘硬切导致的正面缺失。裁切规则对落盘海报、番号速查、裁切预览全局一致。
- 去水印：对海报右上角常见的半透明 logo 做模糊遮挡（可开关）。
- NFO：Kodi movie 格式，含标题、番组、演员（仅保留女优）、发行日期、时长、简介等；可配置跳过已存在的 NFO。
- 演员头像：
  - 演员列表按性别过滤，仅保留女优（JavDB 按 ♀/♂、Jav321/JavBus 按 `/star/` vs `/male/` 路径区分）。
  - 头像按演员名落盘、跨作品复用，已存在则跳过下载。
  - 支持目标平台选择：`Kodi/Emby/Jellyfin/Plex` 使用 `.actors/` 子目录 + NFO 本地相对路径；`Infuse` 不读本地头像，NFO 写 DMM 无防盗链远程 URL。
- 收纳：刮削后把视频及同名字幕等附属文件原地移动到番号子文件夹；支持统一收纳根目录（`centralLibraryDir`，视频移入指定根目录下番号子文件夹）、跨卷移动回退。
- 详情面板：展示任务状态与元数据，支持就地手动修正番号（番号旁编辑按钮），以新番号重新刮削并记录手动标记；支持单任务重新刮削。
- 工具页：
  - **番号速查**：输入番号后并行查询各数据源，实时显示每个渠道的命中/未命中/错误状态与封面预览（封面跟随全局裁切模式）。
  - **海报裁切**：按番号抓取封面，并排预览 right/center/full 三种裁切，可单独导出。
  - **封面扫描**：扫描资料夹中缺失封面的视频。
  - **演员头像回填**：为已有作品批量回填女优头像。
- 主进程图片代理：远程图片按 CDN 自适应 Referer 绕过防盗链（如 aventertainments 带外站 Referer 会 403 则不发、DMM 带 dmm.co.jp、其余回退来源页），本地 `file://` 直接读盘回传 data URL。
- 统一时间线活动行日志：下载各阶段原位刷新、结束提交为日志、底栏常驻活动位。
- 持久化设置：刮削源、代理、请求间隔、命名/收纳/裁切模式、图片与 NFO 开关等，保存在 Electron `userData` 下的 JSON。
- 深色 / 浅色主题，遵循内部设计系统（Anthropic 色板：强调色 clay，状态色 olive/fig/sky/kraft）。

## 技术栈

- Electron 33、electron-vite 2、React 18、TypeScript 5（strict）
- 图像处理：[sharp](https://sharp.pkg.io)（原生依赖，裁切/去水印）
- 测试：Node 20+ 内置 `node:test`（无 Jest/Vitest）
- 无 UI 库、无 CSS 框架、无状态管理库；样式集中在 `src/renderer/src/styles.css`

## 目录结构

```
src/
├── main/                      # Electron 主进程
│   ├── index.ts               # 生命周期、窗口
│   ├── engine.ts              # 刮削任务调度
│   ├── ipc.ts                 # IPC 通道
│   ├── number/                # 番号识别（纯函数 + 测试）
│   ├── io/                    # 文件扫描
│   ├── net/                   # HTTP 客户端（gzip/br、代理）
│   ├── scrapers/              # 刮削源
│   │   ├── types.ts           # ScraperSource / ScrapedMetadata 接口
│   │   ├── index.ts           # 数据源注册与按设置/番号类型选择
│   │   ├── javbus/
│   │   ├── javdb/
│   │   ├── jav321/
│   │   ├── heyzo/
│   │   └── fc2/
│   ├── media/                 # 图片下载 / sharp 裁切 / NFO / 收纳
│   │   ├── dmmCdn.ts          # DMM 封面/头像推导与 URL 升级
│   │   ├── dmmActress.ts      # DMM 女优列表页抓取（Infuse 远程头像）
│   │   ├── imageDownloader.ts # 封面/样张/头像下载、Referer 自适应
│   │   ├── imageProcessor.ts  # sharp 2:3 裁切 + 去水印
│   │   ├── organizeMedia.ts   # 刮削后原地收纳
│   │   ├── writeMedia.ts      # 媒体产物落盘编排
│   │   ├── nfoWriter.ts       # Kodi NFO
│   │   ├── readImage.ts       # 主进程图片代理
│   │   └── fileNames.ts       # 海报/NFO/头像命名
│   ├── tools/                 # 工具页逻辑（速查/裁切/扫描/头像回填）
│   └── store/                 # userData 设置读写与清洗
├── preload/index.ts           # contextBridge 暴露给渲染进程
├── renderer/src/              # React UI
│   ├── components/            # TopBar / DropZone / TaskList / DetailPanel
│   │                          # LogDrawer / SettingsPage / ToolsPage
│   ├── styles.css
│   ├── theme.ts
│   └── useImageSource.ts      # 经 IPC 加载图片为 data URL
└── shared/                    # 主/渲染共享类型与通道常量
    ├── channels.ts            # IPC 通道名
    ├── settings.ts
    └── types/
```

## 开发

```bash
npm install
npm run dev      # electron-vite dev，渲染端 localhost:5173，主进程带 9229 调试端口
npm run build    # 构建到 out/
npm test         # 用 tsc 编译测试到 out-test/ 后跑 node:test，跑完清理
```

TypeScript 为双配置类型检查：

```bash
npm run typecheck
```

约束：

- 渲染进程不直接访问 Node API，系统能力统一经 `preload` 通过 contextBridge 暴露；`contextIsolation: true`、`nodeIntegration: false`。
- 通道名只从 `shared/channels.ts` 的 `IPC` 常量取。
- 测试只用 `node:test` + `node:assert/strict`，测试文件与源码同目录、命名 `*.test.ts`。

## 设置项

- **刮削源**：JavBus / JavDB / Jav321 可开关并排序；HEYZO / FC2 按番号类型自动路由、始终启用。
- **代理**：HTTP/HTTPS 代理 URL（留空直连）。
- **请求间隔**：每次请求后的礼貌延迟（秒）。
- **命名规则**：`number` / `numberTitle` / `numberActorTitle`。
- **收纳模式**：原地收纳为番号子文件夹，或统一移入指定收纳根目录。
- **裁切模式**：`right`（默认，正面封面）/ `center` / `full`。
- **去水印**：海报右上角 logo 模糊遮挡开关。
- **下载样张 / 生成 NFO / 跳过已存在 NFO / 下载演员头像**。
- **演员头像目标平台**：Kodi/Emby/Jellyfin/Plex（本地 `.actors/`）或 Infuse（远程 URL）。

## Roadmap

- 软链接模式
- 番号识别容错、单文件重刮
- electron-builder 打包发布
