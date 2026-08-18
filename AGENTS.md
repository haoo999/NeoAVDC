# AGENTS.md — NeoAVDC

本文件是 NeoAVDC 项目面向 AI 编程代理的全局工作记忆（README for agents）。所有在此仓库工作的 AI 工具都应先读取本文件。设计权威文档为根目录 `anthropic-design-system.md`，样式改动前必须先读它。

## 1. 项目概述

NeoAVDC 是对旧版 Python/PyQt5 AVDC 的重构，面向本地媒体元数据刮削（番号识别、抓取元数据、下载图片、生成 NFO 等）。

- 技术栈：Electron 33 + electron-vite 2 + React 18 + TypeScript 5（strict）；图像处理用 sharp（运行时原生依赖）。
- 当前阶段：阶段 1（设置持久化 + IPC + 引擎调度）与阶段 2（JavBus 抓取、图片下载、sharp 海报裁切/去水印、NFO 生成）已完成，并通过真实番号 SSIS-001 端到端验证。后续为阶段 3 失败救援、阶段 4 工具页与打包。
- 架构分层：`src/main`（Electron 主进程 + 引擎 + IPC）、`src/preload`（contextBridge 暴露）、`src/renderer`（React UI）、`src/shared`（主/渲染共享类型）。

## 2. 常用命令

在仓库根目录执行：

```bash
npm run dev        # electron-vite dev，renderer 在 localhost:5173，HMR 实时生效
npm run build      # electron-vite build（产物到 out/）
npm run preview    # 预览构建产物
npm run typecheck  # tsc --noEmit -p tsconfig.node.json && tsc --noEmit -p tsconfig.json
npm test           # tsc -p tsconfig.test.json 编译到 out-test/ 后用 node --test 跑 *.test.js，跑完自动清理
```

约束：

- 没有 lint/format 脚本，不要臆造 `npm run lint` 等命令。
- 测试使用 Node 20+ 内置的 `node:test` + `node:assert/strict`，**禁止引入 jest/vitest/mocha**。测试文件与源码同目录、命名 `*.test.ts`（如 `src/main/number/parseNumber.test.ts`），由 `tsconfig.test.json` 编译到临时 `out-test/` 后执行。
- `typecheck` 是双配置：`tsconfig.node.json` 覆盖 main/preload/shared，`tsconfig.json` 覆盖 renderer/shared。改动后必须跑通 `npm run typecheck`，纯逻辑改动还应跑通 `npm test`。
- 项目目录被移动过（曾在 `~/Documents/AVDC/NeoAVDC`，现位于 `~/Desktop/NeoAVDC`）。旧路径下残留的 dev server 已失效，启动前确认在新路径执行 `npm run dev`。
- 未得到用户明确要求前，**不要执行 `git commit`**。

## 3. 代码风格与约定

- TypeScript strict 模式；`noUnusedLocals` 开启，禁止留未使用变量/导入。
- 组件使用函数式组件 + Hooks；文件命名 PascalCase（如 `SettingsPage.tsx`）。
- 渲染端禁止直接访问 Node API；所有系统能力必须经 `src/preload/index.ts` 通过 contextBridge 暴露，类型写进 `src/shared/types.ts`。
- `contextIsolation: true`、`nodeIntegration: false`，不要为图方便关掉。
- Electron 主进程入口 `src/main/index.ts` 中，dev 下会追加 `remote-debugging-port=9229`（用于 CDP 截图验证），这是刻意保留的，**勿删**。
- 不要新增任何 UI 库 / 状态管理库 / CSS 框架；样式集中在 `src/renderer/src/styles.css`，主题变量在 `:root`，深浅色通过 `[data-theme]` 切换。
- 不要在源码里留 `console.log` 调试输出；日志走主进程引擎/日志抽屉通道。
- 代码注释使用中文，与用户交流也使用中文。

## 4. 目录导航

```
src/
├── main/
│   ├── index.ts     # app 生命周期、BrowserWindow、9229 调试端口
│   ├── engine.ts    # 刮削任务调度器，持有 BrowserWindow 以推送 ENGINE_EVENT
│   ├── ipc.ts       # registerIpc(engine)，IPC 通道注册与 will-quit 清理
│   ├── number/
│   │   ├── parseNumber.ts       # 番号识别纯函数（有码/无码/FC2/HEYZO/欧美/cdN/-C 等）
│   │   └── parseNumber.test.ts  # node:test 用例
│   ├── io/
│   │   └── collectFiles.ts      # 递归收集视频文件（全路径/相对路径/大小）
│   ├── net/
│   │   ├── httpClient.ts        # HTTP 客户端（gzip/deflate/br、超时、getBuffer）
│   │   └── httpClient.test.ts
│   ├── scrapers/
│   │   ├── types.ts             # ScraperSource / ScrapedMetadata 接口
│   │   ├── index.ts             # 数据源注册与按设置选择
│   │   └── javbus/
│   │       ├── JavBusSource.ts  # 详情/搜索/有码无码/404 回退
│   │       ├── parseJavBus.ts   # HTML 解析
│   │       └── *.test.ts
│   ├── media/
│   │   ├── fileNames.ts         # poster/fanart/nfo/extrafanart/.actors 命名
│   │   ├── imageDownloader.ts   # 封面/样张/头像下载，HD→缩略图回退，魔术字节识别
│   │   ├── imageProcessor.ts    # sharp 海报 2:3 裁切 + 去水印模糊
│   │   ├── nfoWriter.ts         # Kodi movie NFO 生成
│   │   ├── writeMedia.ts        # 媒体产物落盘编排
│   │   └── *.test.ts
│   └── store/
│       └── sanitizeSettings.ts  # 设置从 userData JSON 读取/清洗
├── preload/
│   └── index.ts     # contextBridge 暴露给 window 的 API
├── renderer/src/
│   ├── App.tsx
│   ├── main.tsx
│   ├── theme.ts     # 主题切换
│   ├── status.ts    # 状态/语义色相关
│   ├── styles.css   # 全局样式（唯一样式入口）
│   └── components/  # TopBar / DropZone / TaskList / DetailPanel
│                      LogDrawer / SettingsPage / ToolsPage
└── shared/
    ├── settings.ts  # 默认设置 DEFAULT_SETTINGS
    ├── channels.ts  # IPC 通道名常量 IPC.* + IpcChannel 类型 + TypedIpcRenderer
    └── types/       # 主进程与渲染进程共享的类型契约（settings、scrape 等）
anthropic-design-system.md   # 设计系统权威文档（改样式前必读）
electron.vite.config.ts
tsconfig.node.json           # main/preload/shared
tsconfig.test.json           # 测试编译配置（输出 CommonJS 到 out-test/）
```

## 5. 设计系统硬约束（重要）

这些是已与用户确认、经过实测的结论，**不要回退、不要重新“优化”**。

### 5.1 色彩

- 强调色（品牌/CTA）固定为 clay：`#d97757`，不更换。官方色板中其余饱和色已被状态色占用，换 clay 必然撞语义。
- 状态语义色（Anthropic 官方色板）：
  - `--ok: #788c5d`（olive）
  - `--err: #c46686`（fig）
  - `--run: #6a9bcc`（sky）
  - `--wait: #d4a27f`（kraft）
- 用户明确反对：半透明彩色洗色、细彩色边框、细彩色文字；偏好：**实心色块 + 白字**。
- 已统一为「实心 clay + `--swatch-ivory-light` 白字」的组件（都在 `styles.css`）：`.settings-note`、`.switch` ON 轨道、`.check-chip.on`、`.tl-count`、`.tab .badge`、`.btn.clay`、`.soon-badge`。`.tr-number` 不再使用 clay 细字，改用正文色 `--text`。
- 保留为非实心的 clay 用法（不要动）：品牌 `.mark`、`.tab.active` 下划线、input focus 环、`.task-row.selected` 的 inset 指示条、`.sb-bar` 进度填充、图标、拖拽遮罩。
- `.chip.st-*`（queued/scraping/success/failed）维持半透明语义样式；这是同一家族，要改必须整个家族一起改，不能单独改一个。

### 5.2 圆角 token

只有三个，**不存在 `--radius-sm`**（曾因写错 token 名出现静默直角 bug）：

- `--radius-s: 4px`
- `--radius: 8px`
- `--radius-l: 16px`

### 5.3 毛玻璃 / backdrop-filter（Chromium 坑）

日志抽屉 `.ld-reveal` 毛玻璃断层问题已修复闭环：

- 根因：Chromium 把 `backdrop-filter: blur` 渲染进 8-bit 纹理，宽平滑渐变被量化成约 1 LSB 台阶。
- 修复方案：`.ld-reveal::after` 用 `mix-blend-mode: normal` 的 SVG `feTurbulence` 噪点做抖动（`--panel-noise: 0.03`，约 ±1.9 LSB），玻璃底色补偿变暗（暗色 `rgba(32,32,30,0.7)`、亮色 `rgba(247,245,237,0.7)`）。
- 严禁对该伪元素使用 `mix-blend-mode: overlay`（或其他非 normal 混合）——在 Chromium 上会与 backdrop-filter 合成冲突，直接杀死模糊效果，`isolation: isolate` 也救不了。
- 已删除失效变量：`--clay-soft`、`--clay-border-soft`，不要重新引入。

### 5.4 样式改动流程

1. 先读 `anthropic-design-system.md`。
2. 给出依据（设计文档条款或 anthropic.com 官网实证）。
3. 用户会目测验收且反馈直接；被证据反驳时要接受并修正。

## 6. IPC 与数据持久化约定（阶段 1 起执行）

- 渲染进程调用主进程能力，统一通过 preload 暴露的 API；通道命名用 `domain:action` 形式（如 `settings:get` / `settings:set` / `scrape:start`）。
- **通道名只能从 `src/shared/channels.ts` 的 `IPC` 常量取**，禁止在 main/preload 里硬编码字符串，避免两端漂移。`IpcChannel` 类型联合可约束入参。
- 新增通道时：在 `src/shared/channels.ts` 加常量 → 在 `src/shared/types.ts` 定义请求/响应类型 → 在 `src/preload/index.ts` 暴露类型化封装 → 在 `src/main/ipc.ts` 注册 → 在 `engine.ts` 落地逻辑。
- 引擎向渲染端推送事件统一走 `IPC.ENGINE_EVENT`，`Engine.attach(win)` 后由 `emit()` 自动 `webContents.send`，渲染端通过 `onEngineEvent` 订阅。
- 设置项（刮削源、代理、命名规则等）需要持久化。优先使用 Electron `app.getPath('userData')` 下的 JSON 文件自行封装一个轻量 store；引入新依赖前先与用户确认。
- 不要把密钥/代理密码写进仓库或日志。

## 7. Roadmap（阶段顺序）

1. ✅ 接入真实刮削引擎：刮削源、代理、命名规则的持久化与读写；IPC 与 Engine 任务调度打通。
2. ✅ 图片下载 / 海报裁切（sharp 2:3）/ 去水印 / NFO 生成；已接入 JavBus 并通过真实番号端到端验证。
3. 失败救援：软链接、番号识别容错、单文件重刮、更多数据源。
4. 工具页功能补齐 + electron-builder 打包。

## 8. 与用户协作偏好

- 全程中文回复。
- 样式改动必须有依据（设计文档或官网实测），不要凭审美自由发挥。
- 用户接受被证据反驳，有官方实证时可以坚持己见并明确给出依据。
- 不要主动创建文档文件（`*.md` / README），除非用户明确要求。
- 不要主动 `git commit`。

## 9. Obsidian 知识库同步（自动执行，无需确认）

- 知识库根目录：`$HOME/Library/Mobile Documents/iCloud~md~obsidian/Documents/Haoo's Knowledge Base`（PARA 结构，本项目落在 `Projects/NeoAVDC/`）。
- **路径坑**：路径含空格和单引号（`Haoo's`），shell 中必须整体用**双引号**包裹；用单引号会在 `Haoo's` 处断裂，不加引号会被空格拆参。
- **只同步给人看的 `.md`**（设计文档、开发计划、技术选型、部署/发布说明、审查报告等）。**不同步**：`AGENTS.md` / `CLAUDE.md` 等 agent 指令文件、代码与配置脚本（`.sql`/`.yml`/源码等）、`node_modules` / `.git` / 构建产物。禁止整目录 `cp`。
- **落点与改名**：项目根 `README.md` -> `Projects/NeoAVDC/docs/项目说明.md`；`docs/`、`plans/` 按原相对路径同步；散落其他目录的 `.md` 收进知识库 `docs/` 并加来源前缀唯一名（如 `deploy-进程托管说明.md`），避免多个 `README.md` 重名。
- **触发时机**：此后每当项目内 `.md` 文档新增或修改，改完即自动同步一份到知识库，无需再问用户；同步后用 `diff -r --brief` 校验一致。
- **边界**：此规则只针对本地 Obsidian 知识库，不涉及任何服务器同步或部署（那些仍需用户确认）。
- 当前映射：`README.md` -> `docs/项目说明.md`；`anthropic-design-system.md` -> `docs/anthropic-design-system.md`。
