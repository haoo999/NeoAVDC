# NeoAVDC

![](https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white)
![](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)
![](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)
![](https://img.shields.io/badge/license-MIT-green?style=flat-square)

**简体中文** · [English](./README.en.md)

本地运行的 AV 元数据刮削器：从文件名识别番号 → 抓取元数据与图片 → sharp 裁切海报 → 生成 [Kodi NFO](https://kodi.wiki/view/NFO_files/Movies) → 原地收纳为带海报的番号资料夹。图形界面，数据全部保存在本地，不上传任何内容。

> 本项目是对旧版 [moyy996/AVDC](https://github.com/moyy996/AVDC)（Python/PyQt5）的 Electron + React + TypeScript 重构，在此向原作者 [yoshiko2](https://github.com/yoshiko2/AV_Data_Capture) 与 [moyy996](https://github.com/moyy996/AVDC) 致谢。当前阶段：刮削 / 图片 / NFO / 多数据源 / 工具页已落地，软链接、番号识别容错等救援能力在 Roadmap 上继续推进。

## 目录

- [1. 简介](#1-简介)
- [2. 功能特性](#2-功能特性)
- [3. 常见番号命名规范（必看）](#3-常见番号命名规范必看)
- [4. 如何使用](#4-如何使用)
  - [4.1 下载](#41-下载)
  - [4.2 简明教程](#42-简明教程)
  - [4.3 源码运行](#43-源码运行)
  - [4.4 配置说明](#44-配置说明)
- [5. 工具](#5-工具)
- [6. 异常处理](#6-异常处理)
- [7. FAQ](#7-faq)
- [8. 声明](#8-声明)
- [9. 写在后面](#9-写在后面)

## 1. 简介

**NeoAVDC** 是一款本地运行的日本影片元数据抓取（刮削）工具，配合 Kodi、Emby、Jellyfin、Plex、Infuse 等本地影片管理软件使用，负责分类整理与元数据、封面、演员头像的写入。

- 支持批量刮削与单文件重刮，可处理多碟（`-cd1/-cd2`）、带中文字幕（`-C`）的作品；
- 多数据源按番号类型自动路由，HEYZO/FC2 等专用源对不匹配番号零网络开销跳过；
- 海报由横版包装盒封面用 sharp 裁切为 2:3 竖海报，预览与落盘一致；
- 刮削成功后将视频与同名字幕原地收纳进番号子文件夹，也支持统一收纳根目录与跨卷回退。

## 2. 功能特性

- **番号识别**：有码、无码、FC2、HEYZO、欧美（系列.年.月.日）、`cdN` 多碟、`-C` 中文字幕、多位数字、`_`/空格分隔等变体；不区分大小写。
- **多数据源自动路由**：
  - **JavBus / JavDB / Jav321**：常规有码番号，可在设置中开关并排序，按顺序依次尝试。
  - **HEYZO / FC2**：专用源按番号类型自动启用、固定排在最前，对不匹配番号零网络开销直接跳过，不占用设置开关。
  - **DMM**：仅作高清封面 CDN 兜底，不是元数据源。
- **图片下载**：封面、样张、女优头像；DMM 高清封面 → 缩略图自动回退；按魔术字节识别真实图片类型，不信任 URL 后缀。
- **海报裁切**：横版包装盒封面 → 2:3 竖海报，支持 `right`（默认）/`center`/`full` 三种模式。`right` 基于真实封面几何（实测 DMM/JavBus 封面书脊折痕约在全宽 52.5%），先取右半正面再居中取 2:3，保留靠近书脊的一小段正面；裁切规则对落盘海报、番号速查、裁切预览全局一致。
- **去水印**：对海报右上角常见半透明 logo 做模糊遮挡（可开关）。
- **NFO**：Kodi movie 格式，含标题、番组、演员（仅保留女优）、发行日期、时长、简介等；可配置跳过已存在的 NFO。
- **演员头像**：
  - 演员列表按性别过滤，仅保留女优（JavDB 按 ♀/♂、Jav321/JavBus 按 `/star/` vs `/male/` 路径区分）。
  - 头像按演员名落盘、跨作品复用，已存在则跳过下载。
  - 目标平台可选：Kodi/Emby/Jellyfin/Plex 使用 `.actors/` 子目录 + NFO 本地相对路径；Infuse 不读本地头像，NFO 写 DMM 无防盗链远程 URL。
- **收纳**：刮削后将视频及同名字幕（`srt/ass/sub`）等附属文件原地移动到番号子文件夹；支持统一收纳根目录（视频移入指定根目录下番号子文件夹）与跨卷移动回退。
- **详情面板**：展示任务状态与元数据；支持就地手动修正番号（番号旁编辑按钮），以新番号重新刮削并记录手动标记；支持单任务重新刮削。
- **图片代理**：主进程统一代理远程图片，按 CDN 自适应 Referer 绕过防盗链（aventertainments 带外站 Referer 会 403 则不发、DMM 带 `dmm.co.jp`、其余回退来源页），本地 `file://` 直接读盘回传 data URL。
- **时间线日志**：下载各阶段原位刷新、结束提交为日志、底栏常驻活动位。
- **设置持久化**：刮削源、代理、请求间隔、命名/收纳/裁切模式、图片与 NFO 开关等保存在 Electron `userData` 下的 JSON。
- **主题**：深色 / 浅色，遵循内部设计系统（Anthropic 色板：clay 强调色，olive/fig/sky/kraft 状态色）。

## 3. 常见番号命名规范（必看）

**刮削前尽量让文件名接近规范番号，识别率最高。不区分大小写。**

### 3.1 标准有码

- JavDB / JavBus / Jav321：`SSIS-001`
- DMM：`ssni00111`

### 3.2 无码

- JavDB / JavBus：`111111-111`、`111111_111`、`HEYZO-1111`、`n1111`
- Jav321：`HEYZO-1111`

### 3.3 素人 / FC2

- FC2：`FC2-111111`、`FC2-PPV-111111`
- 素人：`259LUXU-1111`、`LUXU-1111`

### 3.4 欧美

- JavDB / JavBus：`series.11.11.11`（系列.年.月.日）

### 3.5 中文字幕作品

可命名为 `ssni-001-c.mp4`、`ssni-001-C.mp4`、`abp-001-CD1-C.mp4`。字幕后缀必须紧邻扩展名，即 `-C.mp4`。

### 3.6 多碟作品

按集数后缀命名为 `ssni-001-cd1.mp4`、`ssni-001-CD2.mp4`。**分集在前、字幕在后**（`abp-001-CD1-C.mp4`）。不支持 `-A/-B/-1/-2`，容易与字幕后缀 `-C` 混淆。

### 3.7 外挂字幕

字幕文件名必须与影片文件名一致（仅扩展名不同），才会随视频一起移动到番号子文件夹。目前支持 `srt`、`ass`、`sub`。

### 3.8 文件名建议

越接近纯番号识别率越高；多余的前缀、发布组、画质标签等可能干扰识别，可在刮削前用批量重命名工具清理。

## 4. 如何使用

### 4.1 下载

**Release v0.0.2**：

- **macOS**（universal，Intel + Apple Silicon）：[NeoAVDC-0.0.2-universal.dmg](https://github.com/haoo999/NeoAVDC/releases/download/v0.0.2/NeoAVDC-0.0.2-universal.dmg)
- **Windows**（x64，NSIS 安装包）：[NeoAVDC-0.0.2-x64.exe](https://github.com/haoo999/NeoAVDC/releases/download/v0.0.2/NeoAVDC-0.0.2-x64.exe)
- **Linux**（x64，AppImage）：[NeoAVDC-0.0.2-x64.AppImage](https://github.com/haoo999/NeoAVDC/releases/download/v0.0.2/NeoAVDC-0.0.2-x64.AppImage)

全部版本见 [Releases](../../releases) 页面。也支持从源码运行（参见 [4.3 源码运行](#43-源码运行)）。

> 本版本未做代码签名（macOS 无 Developer ID、Windows 无 EV 证书）。
> - **macOS**：首次打开如遇「无法验证开发者」，在「系统设置 → 隐私与安全性」中点击「仍要打开」，或对解压后的 app 执行 `xattr -dr com.apple.quarantine /Applications/NeoAVDC.app`。
> - **Windows**：SmartScreen 可能提示「Windows 已保护你的电脑」，点击「更多信息 → 仍要运行」。
> - **Linux**：下载后给 AppImage 加可执行权限 `chmod +x NeoAVDC-0.0.2-x64.AppImage` 后直接运行。

### 4.2 简明教程

1. 启动 NeoAVDC，在「设置」页配置视频目录、刮削源、代理（可选）等项。
2. 在主界面把视频文件或其父目录拖入窗口，或通过选择按钮添加。
3. 点击开始，在时间线查看每个任务的刮削、下载、裁切、收纳进度；失败项可在详情面板就地修正番号后重刮。
4. 刮削成功后，视频及同名字幕会被原地收纳为番号子文件夹，内含 `poster.jpg`、`fanart.jpg`、`extrafanart/`、`.actors/`、`<番号>.nfo` 等产物。
5. 将收纳后的目录导入 Kodi / Emby / Jellyfin / Plex / Infuse 即可。

### 4.3 源码运行

环境要求：Node.js 20+，npm。

```bash
npm install        # sharp 是原生依赖，postinstall 会自动跑 electron-builder install-app-deps
npm run dev        # 开发模式：渲染端 localhost:5173，主进程带 9229 调试端口
npm run build      # 构建到 out/
npm run typecheck  # 双配置 TS 类型检查（main/preload/shared + renderer）
npm test           # tsc 编译到 out-test/ 后用 node:test 跑 *.test.js，跑完自动清理
npm run dist:mac     # 打包 macOS universal dmg 到 release/
npm run dist:win     # 打包 Windows x64 NSIS exe 到 release/（跨平台用 wine）
npm run dist:linux   # 打包 Linux x64 AppImage 到 release/
```

测试仅使用 Node 内置 `node:test` + `node:assert/strict`，未引入 Jest/Vitest/Mocha。

### 4.4 配置说明

- **刮削源**：JavBus / JavDB / Jav321 可开关并排序；HEYZO / FC2 按番号类型自动路由、始终启用。
- **代理**：HTTP/HTTPS 代理 URL，留空直连；访问 DMM 建议使用日本节点。
- **请求间隔**：每次请求后的礼貌延迟（秒），避免被源站限流。
- **命名规则**：`number` / `numberTitle` / `numberActorTitle`。
- **收纳模式**：原地收纳为番号子文件夹，或统一移入指定收纳根目录（`centralLibraryDir`）。
- **裁切模式**：`right`（默认，正面封面）/ `center` / `full`。
- **去水印**：海报右上角 logo 模糊遮挡开关。
- **下载样张 / 生成 NFO / 跳过已存在 NFO / 下载演员头像**。
- **演员头像目标平台**：Kodi/Emby/Jellyfin/Plex（本地 `.actors/`）或 Infuse（远程 DMM URL）。

## 5. 工具

- **番号速查**：输入番号后并行查询所有数据源，实时显示每个渠道的命中/未命中/错误状态与封面预览（封面跟随全局裁切模式）。
- **海报裁切**：按番号抓取封面，并排预览 `right` / `center` / `full` 三种裁切，可单独导出。
- **封面扫描**：扫描资料夹中缺失封面的视频。
- **演员头像回填**：为已有作品批量回填女优头像。

> 旧版 AVDC 的「单文件刮削」在新版由主界面详情面板的就地修正番号 + 单任务重刮覆盖；「Emby 批量上传头像」未迁移，新版统一使用 `.actors/` 本地头像 + NFO 相对路径，由媒体库自身扫描导入。

## 6. 异常处理

- **番号识别失败 / 异常**：检查文件名是否符合[第 3 节](#3-常见番号命名规范必看)规范，或在详情面板手动修正番号后重新刮削。
- **网络错误 / 403 / 超时**：检查代理设置；DMM 需使用日本节点；图片代理已按 CDN 自适应 Referer，若仍失败可在设置里切换刮削源。
- **JavDB 被限流**：调低请求频率或暂时改用 JavBus / Jav321。
- **海报裁切不满意**：在设置或工具页切换 `right` / `center` / `full`，用「海报裁切」工具并排预览后导出。
- **跨卷收纳失败**：收纳逻辑会自动回退为同卷移动并在时间线日志提示，检查源盘与目标盘空间/权限。
- **Plex 不显示封面**：需安装 NFO 导入插件 [XBMCnfoMoviesImporter](https://github.com/gboudreau/XBMCnfoMoviesImporter.bundle)。

## 7. FAQ

**Q：这软件能下片吗？**
A：不提供任何影片下载地址，仅供本地已有的影片做分类与元数据整理。

**Q：软件收费吗？**
A：永久免费、开源（MIT）。

**Q：数据会上传吗？**
A：所有数据保存在本地。除了向你在设置中启用的刮削源与图片 CDN 发起必要的请求外，不向任何第三方上传内容。

**Q：支持哪些平台？**
A：官方提供 macOS universal 安装包；源码可在 Windows / Linux 上运行（未官方测试与打包）。

**Q：与旧版 AVDC 的区别？**
A：基于 Electron + React + TypeScript 重写，新增多数据源按番号类型自动路由、sharp 海报裁切与真实书脊几何、主进程图片代理（Referer 自适应）、Infuse 远程头像、原地/统一收纳根目录、时间线活动行日志、就地修正番号重刮等。

**Q：支持软链接模式吗？**
A：尚未实现，在 Roadmap 中。

## 8. 声明

当你查阅、下载或使用本项目源代码或二进制程序，即代表你接受以下条款。

**中文**
- 本软件仅供技术交流、学术交流与个人本地媒体库整理使用。
- 请勿在热门社交平台上宣传此项目。
- 本软件不提供任何影片下载线索。
- 用户在使用前请了解并遵守当地法律法规；如使用过程中存在违反当地法律法规的行为，请勿使用。
- 用户在当地产生的一切违法行为由用户自行承担，与本项目作者无关。
- 严禁将本软件用于商业用途。
- 本项目是对 [moyy996/AVDC](https://github.com/moyy996/AVDC)（源自 [yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture)）的重构，在此向原作者致谢；原项目保留其各自许可与权利。
- 若你不同意上述条款任意一条，请勿使用本软件。

**English**
- This software is provided for technical exchange, academic research, and personal local media library organization only.
- Please do not promote this project on popular social platforms.
- This software does not provide any clues for downloading videos.
- Before using this software, please understand and comply with your local laws and regulations. Do not use it if any violation may occur.
- Users are solely responsible for any illegal acts arising from their use; the author bears no liability.
- Commercial use of this software is strictly prohibited.
- This project is a rewrite of [moyy996/AVDC](https://github.com/moyy996/AVDC) (originating from [yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture)). Credits go to the original authors, whose projects retain their respective licenses and rights.
- If you do not agree to any of the above terms, please do not use this software.

**日本語**
- 本ソフトウェアは技術交流、学術研究、および個人のローカルメディアライブラリ整理のみを目的としています。
- 人気のソーシャルプラットフォームで本プロジェクトを宣伝しないでください。
- 本ソフトウェアは動画ダウンロードの手がかりを一切提供しません。
- ご利用前に現地の法令を理解し遵守してください。法令に違反する可能性がある場合は使用しないでください。
- 利用により生じた違法行為については利用者自身が責任を負い、作者は一切責任を負いません。
- 本ソフトウェアの商業利用を固く禁じます。
- 本プロジェクトは [moyy996/AVDC](https://github.com/moyy996/AVDC)（[yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture) 由来）のリライトです。原作者に感謝すると共に、原プロジェクトは各々のライセンスと権利を保持します。
- 上記事項に同意いただけない場合は、本ソフトウェアを使用しないでください。

## 9. 写在后面

把自己收藏的影片整齐地刮削成带海报、女优头像与 NFO 的番号资料夹，再导入媒体库浏览——希望它能帮你省下一点重复劳动。

## Roadmap

- 软链接模式（PT 党：刮削不移动原文件）
- 番号识别容错、单文件重刮增强
- 代码签名与自动更新（当前 macOS / Windows / Linux 均为未签名包）
