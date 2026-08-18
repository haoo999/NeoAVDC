# NeoAVDC

> 基于 Electron + React + TypeScript 的 AVDC 重构版，面向本地影片元数据刮削与媒体库整理。

[![Status](https://img.shields.io/badge/status-stage%202%20done-blue.svg?style=flat-square)](#)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey.svg?style=flat-square)](#)
[![Electron](https://img.shields.io/badge/Electron-33-47848F.svg?style=flat-square&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61DAFB.svg?style=flat-square&logo=react)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6.svg?style=flat-square&logo=typescript)](https://www.typescriptlang.org/)

---

## 目录

- [1. 简介](#1-简介)
- [2. 当前状态](#2-当前状态)
- [3. 技术栈](#3-技术栈)
- [4. 快速开始](#4-快速开始)
- [5. 目录结构](#5-目录结构)
- [6. 可用脚本](#6-可用脚本)
- [7. Roadmap](#7-roadmap)
- [8. 设计系统](#8-设计系统)
- [9. 致谢](#9-致谢)
- [10. 申明](#10-申明)

---

## 1. 简介

**NeoAVDC** 是对旧版 Python / PyQt5 桌面应用 [AVDC](https://github.com/moyy996/AVDC) 的现代化重写。目标是延续 AVDC 在本地影片元数据抓取、分类整理、NFO 生成等方面的能力，并提供一套更干净、更易维护、跨平台体验更一致的桌面端实现。

应用最终将配合 Emby / Kodi / Plex 等本地媒体库软件使用：扫描本地视频目录 → 识别番号 → 从多个数据源抓取元数据与封面 → 按命名规则重命名并输出 → 写入 NFO，供媒体库直接识别。

> 本项目**不提供任何影片下载地址或资源线索**，仅用于本地已有文件的整理与元数据补全。

## 2. 当前状态

项目已完成 **阶段 2 — 核心刮削能力**，可在 `npm run dev` 下对真实番号执行端到端刮削：

- 主界面、任务列表、详情面板、日志抽屉、设置页、工具页的视觉结构已搭建完成，明暗主题与毛玻璃抽屉已多轮打磨。
- 设置项（刮削源、代理、命名规则、海报裁切、样张/头像下载、NFO 等）已通过 `userData` 下的 JSON 持久化，IPC 通道全链路打通。
- 已接入 JavBus 数据源：番号识别 → 详情/搜索解析（有码/无码路径回退、404 回退搜索）→ 元数据与封面抓取。
- 媒体产物已落地：海报（sharp 裁切为 2:3 竖版）、fanart、样张剧照（extrafanart）、演员头像（.actors）与 Kodi/Emby/Jellyfin 兼容的 `.nfo`。
- HTTP 客户端支持 gzip/deflate/br 解压、超时与二进制缓冲；图片下载含魔术字节识别、HD 封面失败回退缩略图、原子写入。

也就是说：当前仓库已能对真实视频文件完成「识别 → 抓取 → 下载图片 → 生成 NFO」的完整流程。后续为失败救援、工具页补齐与打包，进度见 [Roadmap](#7-roadmap)。

## 3. 技术栈

| 分层 | 选型 |
| --- | --- |
| 壳 | Electron 33 |
| 构建 | electron-vite 2 + Vite 5 |
| UI | React 18 + TypeScript 5（strict） |
| 样式 | 原生 CSS（CSS 变量主题，无 UI/CSS 框架） |
| 进程通信 | contextBridge + 类型化 IPC（`src/shared/channels.ts`） |
| 图像处理 | sharp（海报裁切、去水印模糊、JPEG 重编码） |
| 包管理 | npm |

刻意保持依赖精简：没有引入 Redux/Zustand、Tailwind、Ant Design 等，UI 全部由组件 + `styles.css` 构建。

## 4. 快速开始

### 4.1 环境要求

- Node.js 18+（建议 20 LTS）
- npm 10+
- macOS / Windows / Linux 均可开发；打包产物以当前宿主平台为准

### 4.2 安装与运行

```bash
# 1. 克隆仓库
git clone <your-fork-url> NeoAVDC
cd NeoAVDC

# 2. 安装依赖
npm install

# 3. 启动开发环境
npm run dev
```

`npm run dev` 会并行启动：

- Electron 主进程（带热重载）
- Renderer 开发服务器：<http://localhost:5173>（HMR 实时生效）

开发模式下主进程会显式开启 `remote-debugging-port=9229`，可通过 Chrome DevTools Protocol 连接，用于自动化截图 / 调试。

### 4.3 类型检查与测试

```bash
npm run typecheck   # 全量类型检查（主/preload 与 renderer 两个 tsconfig）
npm test            # 用 node:test 跑 *.test.ts（零额外依赖，需要 Node 20+）
```

`typecheck` 会分别对主进程/preload（`tsconfig.node.json`）与渲染进程（`tsconfig.json`）执行 `tsc --noEmit`；`npm test` 先用 `tsconfig.test.json` 把测试文件编译到临时 `out-test/`（CommonJS），再用 Node 内置的 `node --test` 执行，跑完自动清理。提交或交付前请确保两者均通过。

## 5. 目录结构

```
NeoAVDC/
├── src/
│   ├── main/                # Electron 主进程
│   │   ├── index.ts         # app 生命周期 & BrowserWindow（含 9229 调试端口）
│   │   ├── engine.ts        # 刮削任务调度器，持有窗口引用并推送事件
│   │   ├── ipc.ts           # IPC 通道注册 & will-quit 清理
│   │   ├── number/
│   │   │   ├── parseNumber.ts       # 番号识别纯函数（有码/无码/FC2/HEYZO 等）
│   │   │   └── parseNumber.test.ts
│   │   ├── io/
│   │   │   └── collectFiles.ts      # 递归收集视频文件
│   │   ├── net/
│   │   │   ├── httpClient.ts        # HTTP 客户端（gzip/br、超时、缓冲）
│   │   │   └── httpClient.test.ts
│   │   ├── scrapers/
│   │   │   ├── types.ts             # ScraperSource / ScrapedMetadata 接口
│   │   │   ├── index.ts             # 数据源注册与选择
│   │   │   └── javbus/
│   │   │       ├── JavBusSource.ts  # 详情/搜索/回退逻辑
│   │   │       ├── parseJavBus.ts   # HTML 解析
│   │   │       └── *.test.ts
│   │   ├── media/
│   │   │   ├── fileNames.ts         # poster/fanart/nfo/actors 命名
│   │   │   ├── imageDownloader.ts   # 封面/样张/头像下载与回退
│   │   │   ├── imageProcessor.ts    # sharp 海报裁切 / 去水印
│   │   │   ├── nfoWriter.ts         # Kodi movie NFO 生成
│   │   │   ├── writeMedia.ts        # 媒体产物落盘编排
│   │   │   └── *.test.ts
│   │   └── store/
│   │       └── sanitizeSettings.ts  # 设置持久化清洗
│   ├── preload/
│   │   └── index.ts         # contextBridge 暴露给渲染端的 API
│   ├── renderer/
│   │   ├── index.html
│   │   └── src/
│   │       ├── App.tsx
│   │       ├── main.tsx
│   │       ├── theme.ts     # 主题切换
│   │       ├── status.ts    # 状态语义映射
│   │       ├── styles.css   # 全局样式（唯一样式入口）
│   │       └── components/  # TopBar / DropZone / TaskList /
│   │                        # DetailPanel / LogDrawer /
│   │                        # SettingsPage / ToolsPage
│   └── shared/
│       ├── settings.ts      # 默认设置
│       ├── channels.ts      # IPC 通道名常量与类型
│       └── types/           # 主/渲共享类型（settings、scrape 等）
├── anthropic-design-system.md   # 设计系统权威文档
├── electron.vite.config.ts
├── tsconfig.json
├── tsconfig.node.json
└── tsconfig.test.json          # 测试编译配置（CommonJS → out-test/）
```

## 6. 可用脚本

| 命令 | 说明 |
| --- | --- |
| `npm run dev` | 以开发模式启动 Electron（主进程 + renderer HMR） |
| `npm run build` | 构建生产产物到 `out/`（main / preload / renderer） |
| `npm run preview` | 使用 electron-vite 预览构建产物 |
| `npm run typecheck` | 双 tsconfig 全量类型检查 |
| `npm test` | 基于内置 `node:test` 跑单元测试（零额外依赖，Node 20+） |

> 仓库没有配置 lint / format 脚本，请勿假定存在 `npm run lint` 等命令。测试使用 Node 内置 runner，不依赖 jest / vitest / mocha。

## 7. Roadmap

按以下顺序推进，每个阶段完成后才进入下一阶段：

1. ✅ **阶段 1 — 引擎接入与持久化**
   - 刮削源选择、代理、命名规则等设置项的持久化（`userData` JSON store）
   - IPC 通道打通：`settings:get/set`、`scrape:start` 等
   - 主进程 `Engine` 从占位演进为真实任务调度器
2. ✅ **阶段 2 — 核心刮削能力**
   - 番号识别、JavBus 数据源抓取（有码/无码/搜索回退）
   - 图片下载：海报（HD→缩略图回退）、fanart、样张剧照、演员头像
   - sharp 海报裁切为 2:3 竖版、去水印模糊、JPEG 重编码
   - Kodi/Emby/Jellyfin 兼容的 NFO 文件生成
   - 已通过真实番号端到端验证
3. **阶段 3 — 失败救援**
   - 软链接模式
   - 番号识别容错、单文件重刮削
4. **阶段 4 — 工具页与打包**
   - 工具页功能（视频整理、封面裁剪等）
   - 基于 electron-builder 的安装包产出（macOS / Windows）

## 8. 设计系统

UI 风格参照 Anthropic 官网视觉语言，落地细节记录在根目录 [`anthropic-design-system.md`](./anthropic-design-system.md) 中。核心约定：

- 强调色固定为 clay `#d97757`，仅用于 CTA / 品牌 / 高优先级指示，不参与状态语义。
- 状态色采用官方语义色板：olive（成功）/ fig（错误）/ sky（运行中）/ kraft（等待）。
- 圆角 token 仅 `--radius-s (4px)` / `--radius (8px)` / `--radius-l (16px)`。
- 深浅色主题通过 `[data-theme]` 切换，所有颜色走 CSS 变量。

改动任何样式前请先阅读 `anthropic-design-system.md`，并遵循其中的硬约束。

## 9. 致谢

- 原版 AVDC（Python / PyQt5 GUI 版）：[moyy996/AVDC](https://github.com/moyy996/AVDC)
- AVDC 的命令行前身：[yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture)

感谢原作者与社区在元数据刮削领域的探索与积累。NeoAVDC 在功能形态上向它们致敬，但代码与 UI 全部重新实现。

## 10. 申明

查阅、下载或运行本项目源代码 / 二进制，即视为你理解并接受：

- 本软件仅供技术交流与学术学习使用。
- 本软件**不提供任何影片下载地址或资源线索**，仅用于本地已有文件的整理。
- 请勿在热门社交平台宣传本项目。
- 请在使用前确认你所在地区的法律法规；因使用本软件产生的任何法律责任由使用者自行承担。
- 严禁将本软件用于商业用途或任何违反当地法律的目的。
- 原命令行项目作者 yoshiko2 保留对原版项目的最终解释权；NeoAVDC 作为独立重写项目，问题与反馈请提交到本仓库 Issue。
