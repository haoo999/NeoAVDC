# NeoAVDC

[![Electron 33](https://img.shields.io/badge/Electron-33-47848F?style=flat-square&logo=electron&logoColor=white)](https://www.electronjs.org/)
[![React 18](https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react&logoColor=black)](https://react.dev/)
[![TypeScript 5](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![platform macOS | Windows | Linux](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)](#4-download)
[![license MIT](https://img.shields.io/badge/license-MIT-green?style=flat-square)](./LICENSE)

[简体中文](./README.md) · **English**

A local AV metadata scraper: recognize the movie code from a filename → fetch metadata and images → crop the poster with sharp → generate a [Kodi NFO](https://kodi.wiki/view/NFO_files/Movies) → organize everything into a numbered folder with artwork. A graphical app that keeps **all data on your own machine** — nothing is uploaded.

> NeoAVDC is an Electron + React + TypeScript rewrite of the legacy [moyy996/AVDC](https://github.com/moyy996/AVDC) (Python/PyQt5), which itself traces back to [yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture). Credit goes to the original authors. Current status: scraping / images / NFO / multiple sources / tools are shipped; symlink mode and code-recognition tolerance remain on the roadmap.

## Table of Contents

- [Features](#features)
- [Filename conventions](#filename-conventions)
- [Download](#download)
- [Quick start](#quick-start)
- [Run from source](#run-from-source)
- [Configuration](#configuration)
- [Tools](#tools)
- [Troubleshooting](#troubleshooting)
- [FAQ](#faq)
- [Migrating from legacy AVDC](#migrating-from-legacy-avdc)
- [Disclaimer](#disclaimer)
- [Roadmap](#roadmap)

## Features

- **Code recognition**: censored, uncensored, FC2, HEYZO, Western (`series.yyyy.mm.dd`), `cdN` multi-disc, `-C` Chinese-subtitle variants, multi-digit codes, `_`/space separators; case-insensitive.
- **Automatic multi-source routing**:
  - **JavBus / JavDB / Jav321** for standard censored codes — togglable and orderable in settings, tried in sequence.
  - **HEYZO / FC2** specialized sources auto-enable by code type, always first, and skip non-matching codes with zero network cost (no setting toggle needed).
  - **DMM** is used only as a high-res cover CDN fallback, not as a metadata source.
- **Image download**: covers, samples, and actress avatars; DMM high-res cover → thumbnail auto-fallback; true image type detected by magic bytes, never trusting the URL suffix.
- **Poster cropping**: the horizontal retail cover is cropped to a 2:3 vertical poster, with `right` (default) / `center` / `full` modes. `right` uses real cover geometry — the spine crease measured on DMM/JavBus covers sits at ~52.5% of full width, so it takes the right (front) half first and then centers a 2:3 crop, preserving a sliver of the front near the spine. The rule is identical for saved posters, the code-lookup tool, and the crop preview.
- **Watermark removal**: a blur mask over the common semi-transparent logo in the poster's top-right corner (toggle).
- **NFO**: Kodi movie format with title, series, actresses (female only), release date, runtime, synopsis, etc.; can skip existing NFOs.
- **Actress avatars**:
  - Cast lists are filtered by gender, keeping female actresses only (JavDB by ♀/♂, Jav321/JavBus by `/star/` vs `/male/` paths).
  - Avatars are stored by actress name and reused across titles; already-downloaded files are skipped.
  - Target platform selectable: Kodi/Emby/Jellyfin/Plex use a local `.actors/` folder with relative NFO paths; Infuse doesn't read local avatars, so the NFO gets a hotlink-safe remote DMM URL.
- **Organizing**: after a successful scrape, the video and same-name subtitles (`srt/ass/sub`) are moved into a numbered subfolder in place; also supports a central library root and cross-volume fallback.
- **Detail panel**: shows task status and metadata; supports editing the code in place (the edit button next to the code) to re-scrape with the corrected code and flag it as manually set; supports re-scraping a single task.
- **Image proxy**: the main process proxies all remote images and adapts the `Referer` per CDN to bypass hotlink protection (aventertainments returns 403 with an external Referer, so none is sent; DMM gets `dmm.co.jp`; others fall back to the source page); local `file://` images are read from disk and returned as data URLs.
- **Timeline log**: in-place refreshing at each download stage, committed as a log entry on completion, with a persistent activity slot in the bottom bar.
- **Persistent settings**: scraping sources, proxy, request interval, naming/organizing/crop modes, image and NFO switches are saved as JSON under Electron `userData`.
- **Theme**: dark / light, following an internal design system (Anthropic palette: clay accent, olive/fig/sky/kraft status colors).

## Filename conventions

The closer the filename is to a clean code, the higher the recognition rate. Case-insensitive.

- **Censored**: `SSIS-001` (JavDB/JavBus/Jav321); DMM-style `ssni00111`.
- **Uncensored**: `111111-111`, `111111_111`, `HEYZO-1111`, `n1111`.
- **Amateur / FC2**: `FC2-111111`, `FC2-PPV-111111`; `259LUXU-1111`, `LUXU-1111`.
- **Western**: `series.11.11.11` (series.yyyy.mm.dd).
- **Chinese-subtitled releases**: `ssni-001-c.mp4`, `ssni-001-C.mp4`, `abp-001-CD1-C.mp4` — the suffix must sit right before the extension, i.e. `-C.mp4`.
- **Multi-disc**: `ssni-001-cd1.mp4`, `ssni-001-CD2.mp4`. Disc first, subtitle second (`abp-001-CD1-C.mp4`). `-A/-B/-1/-2` are not supported to avoid clashing with the `-C` subtitle suffix.
- **External subtitles**: the subtitle filename must match the video filename (extension aside) to be moved together. `srt`, `ass`, `sub` supported.
- Strip extra prefixes, release-group tags, and quality labels before scraping; a bulk-rename tool helps.

## Download

**Release v0.0.2**:

- **macOS** (universal, Intel + Apple Silicon): [NeoAVDC-0.0.2-universal.dmg](https://github.com/haoo999/NeoAVDC/releases/download/v0.0.2/NeoAVDC-0.0.2-universal.dmg)
- **Windows** (x64, NSIS installer): [NeoAVDC-0.0.2-x64.exe](https://github.com/haoo999/NeoAVDC/releases/download/v0.0.2/NeoAVDC-0.0.2-x64.exe)
- **Linux** (x64, AppImage): [NeoAVDC-0.0.2-x64.AppImage](https://github.com/haoo999/NeoAVDC/releases/download/v0.0.2/NeoAVDC-0.0.2-x64.AppImage)

See all versions on the [Releases](https://github.com/haoo999/NeoAVDC/releases) page. Running from source is also supported (see [Run from source](#run-from-source)).

> The binaries are not code-signed (no Apple Developer ID, no Windows EV certificate).
> - **macOS**: on first launch, if you see "cannot verify developer", go to **System Settings → Privacy & Security** and click "Open Anyway", or run `xattr -dr com.apple.quarantine /Applications/NeoAVDC.app`.
> - **Windows**: SmartScreen may show "Windows protected your PC" — click "More info → Run anyway".
> - **Linux**: `chmod +x NeoAVDC-0.0.2-x64.AppImage` then run it.

## Quick start

1. Launch NeoAVDC and configure your video directory, scraping sources, and proxy (optional) in **Settings**.
2. Drag video files or their parent folder into the window, or add them via the picker.
3. Click start and watch each task's scrape / download / crop / organize progress in the timeline. Failed items can be fixed in the detail panel by editing the code and re-scraping.
4. On success, the video and matching subtitles are organized into a numbered folder containing `poster.jpg`, `fanart.jpg`, `extrafanart/`, `.actors/`, `<code>.nfo`, etc.
5. Import the organized folders into Kodi / Emby / Jellyfin / Plex / Infuse.

## Run from source

Requires Node.js 20+ and npm.

```bash
npm install        # sharp is a native dependency; postinstall runs electron-builder install-app-deps
npm run dev        # dev mode: renderer on localhost:5173, main process with debug port 9229
npm run build      # build into out/
npm run typecheck  # dual-config TS typecheck (main/preload/shared + renderer)
npm test           # compiles to out-test/ with tsc, runs *.test.js via node:test, then cleans up
npm run dist:mac     # package macOS universal dmg into release/
npm run dist:win     # package Windows x64 NSIS exe into release/ (cross-build via wine)
npm run dist:linux   # package Linux x64 AppImage into release/
```

Tests use only Node's built-in `node:test` + `node:assert/strict`; no Jest/Vitest/Mocha.

## Configuration

- **Scraping sources**: JavBus / JavDB / Jav321 can be toggled and ordered; HEYZO / FC2 are auto-routed by code type and always enabled.
- **Proxy**: HTTP/HTTPS proxy URL; leave empty for direct connection. A Japan exit node is recommended for DMM.
- **Request interval**: a polite delay (seconds) after each request to avoid rate limiting.
- **Naming rule**: `number` / `numberTitle` / `numberActorTitle`.
- **Organize mode**: in-place into a numbered subfolder, or move into a central library root (`centralLibraryDir`).
- **Crop mode**: `right` (default, front cover) / `center` / `full`.
- **Watermark removal**: toggle the top-right logo blur mask.
- **Download samples / generate NFO / skip existing NFO / download actress avatars**.
- **Actress avatar target platform**: Kodi/Emby/Jellyfin/Plex (local `.actors/`) or Infuse (remote DMM URL).

## Tools

- **Code lookup**: enter a code to query all sources in parallel; shows hit/miss/error per source plus a cover preview (the cover follows the global crop mode).
- **Poster crop**: fetches the cover for a code and previews `right` / `center` / `full` side by side; each can be exported individually.
- **Cover scan**: scans the library for videos missing a cover.
- **Actress avatar backfill**: batch-fills female actress avatars for existing titles.

> Legacy AVDC's "single-file scrape" is covered in the new version by in-place code editing plus single-task re-scrape in the detail panel. The legacy "Emby bulk avatar upload" is not migrated — the new version uses local `.actors/` avatars with relative NFO paths, letting the media server scan and import them itself.

## Troubleshooting

- **Code recognition fails**: check whether the filename follows the [filename conventions](#filename-conventions), or manually fix the code in the detail panel and re-scrape.
- **Network errors / 403 / timeout**: check the proxy; DMM needs a Japan exit node. The image proxy already adapts the `Referer` per CDN — if it still fails, switch sources in settings.
- **JavDB rate limiting**: lower the request frequency or temporarily use JavBus / Jav321.
- **Unhappy with the poster crop**: switch between `right` / `center` / `full` in settings or the tools page, preview side by side with the poster-crop tool, then export.
- **Cross-volume organize fails**: the logic automatically falls back to same-volume move and logs it in the timeline; check space and permissions on source and target volumes.
- **Plex doesn't show covers**: install the NFO importer plugin [XBMCnfoMoviesImporter](https://github.com/gboudreau/XBMCnfoMoviesImporter.bundle).

## FAQ

**Can it download videos?**
No. It only organizes and writes metadata for videos you already have locally; it provides no download sources.

**Is it paid?**
Free forever, open source under MIT.

**Is my data uploaded?**
All data stays local. Apart from necessary requests to the scraping sources and image CDNs you enable, nothing is uploaded to any third party.

**Which platforms are supported?**
Official builds for macOS (universal), Windows (x64), and Linux (x64, AppImage).

**How is it different from legacy AVDC?**
It's a full rewrite on Electron + React + TypeScript, adding multi-source routing by code type, sharp poster cropping with real spine geometry, a main-process image proxy with adaptive `Referer`, Infuse remote avatars, in-place/central library organizing, an activity timeline, and in-place code correction with re-scrape. See [Migrating from legacy AVDC](#migrating-from-legacy-avdc).

**Is symlink mode supported?**
Not yet — it's on the roadmap (for PT users who don't want the original files moved).

## Migrating from legacy AVDC

If you currently use [moyy996/AVDC](https://github.com/moyy996/AVDC) or [yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture), here's what changes.

- **Your existing library stays as-is.** The output layout follows the same Kodi ecosystem conventions — `poster.jpg`, `fanart.jpg`, `extrafanart/`, `.actors/`, `<code>.nfo` inside a numbered folder — so you don't have to re-scrape from scratch. You can point NeoAVDC at the same library and scrape incrementally.
- **Filename rules are compatible.** The same censored/uncensored/FC2/HEYZO/multi-disc/`-C` patterns are recognized, so your existing filenames keep working.
- **Native macOS / Windows / Linux.** No PyQt5 dependency hell on macOS — there's a signed-by-shape (but not code-signed) universal DMG, a Windows NSIS installer, and a Linux AppImage.
- **Richer sources, routed automatically.** JavBus / JavDB / Jav321 are toggle/ordered; HEYZO / FC2 auto-activate only for matching codes, so they add zero overhead for ordinary censored titles.
- **Better posters out of the box.** Sharp crops the horizontal cover using the measured spine position instead of a naive center cut that often slices into the spine.
- **Female-only cast & reusable avatars.** Gender is filtered at parse time; avatars are stored once per actress and reused across titles.
- **Infuse support.** The NFO can write hotlink-safe remote DMM avatar URLs instead of local `.actors/` paths.
- **In-place code correction.** When a file is misrecognized, edit the code next to the title and re-scrape that one task, with a manual flag recorded.

Legacy-only features not yet migrated:
- Symlink/non-moving scrape mode (roadmap).
- Some legacy one-off utilities; most are superseded by the detail-panel re-scrape and the tools page.

If something you relied on is missing, open an issue with the `migration` label and describe your workflow.

## Disclaimer

By reading, downloading, or using this source code or binaries, you accept the following terms.

- This software is provided for technical exchange, academic research, and personal local media library organization only.
- Please do not promote this project on popular social platforms.
- This software provides no clues for downloading videos.
- Before using, understand and comply with your local laws and regulations. Do not use it if any violation may occur.
- Users are solely responsible for any illegal acts arising from their use; the author bears no liability.
- Commercial use is strictly prohibited.
- This project is a rewrite of [moyy996/AVDC](https://github.com/moyy996/AVDC) (originating from [yoshiko2/AV_Data_Capture](https://github.com/yoshiko2/AV_Data_Capture)). Credits go to the original authors, whose projects retain their respective licenses and rights.
- If you disagree with any of the above, do not use this software.

## Roadmap

- Symlink mode (for PT users: scrape without moving the original files)
- Code-recognition tolerance and enhanced single-file re-scrape
- Code signing and auto-update (all current macOS / Windows / Linux builds are unsigned)
