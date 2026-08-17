# Anthropic 设计语言规范（Agent 可执行版 v2）

> **数据来源**：anthropic.com 生产环境样式表 `ant-brand.shared.css`（2026-07-24 构建）逐规则解析 + 首页 DOM 抽样 + 官方 `anthropics/skills/brand-guidelines`。
> **用法**：整份喂给 coding agent，附加指令：「严格按此规范生成，不要自由发挥。」
>
> **v2 相对 v1 的更正**：
> 1. 「标题一律无衬线」是**错的**。衬线标题是系统内的正式register，见 §2.3。
> 2. 「彩色区块文字用 ivory」是**错的**。olive 等彩色底上文字是 `#141413` 深色，见 §3.4。

---

## 0. 一句话定义

**温暖的信纸底色 + 1px 发丝线 + 极大留白 + 「无衬线/衬线」双声道排版。**

看起来不像 SaaS 官网，像一本排版讲究的学术期刊。若出现纯白 `#fff` 底、box-shadow 卡片、渐变按钮、大圆角胶囊卡片 —— 已经错了。

---

## 1. 灵魂规则（冲突时按序号裁决）

1. **底色是暖白 `#faf9f5`，不是纯白。** 深色底是暖黑 `#141413`，不是纯黑。
2. **零阴影、零渐变。** 层次只由「1px 发丝边框」+「相邻背景色微差」构成。`box-shadow` 全站禁用。
3. **正文默认衬线体。** `body` 的默认 `font-family` 就是 Anthropic Serif —— 这是与其他科技公司最大的差异。
4. **标题默认无衬线粗体，但可切换为衬线 —— 这是有明确语义的选择，不是随意的。** 见 §2.3，这是本规范最容易做错的一节。
5. **圆角克制。** 默认 `8px`，卡片最多 `16px`。只有 chip / tag 用全圆角。
6. **留白极大。** 桌面端 section 上下 `10rem`（160px）是**默认值**，不是特例。
7. **配色由 section 级主题驱动**，组件永不硬编码颜色。见 §3.2。
8. **颜色节制。** 彩色的正确用法是「整块 section 背景」，而非给小按钮小图标上色。
9. **左对齐编辑式排版。** Hero 标题默认左对齐。正文测量宽度 ≤ `56.25rem`。
10. **语气克制。** 句子式标题，无全大写标语，无感叹号，无营销黑话。

---

## 2. 字体系统

### 2.1 字族与降级链

```css
--font-sans:  "Anthropic Sans",  "Styrene B", "Poppins", "Inter", Arial, sans-serif;
--font-serif: "Anthropic Serif", "Tiempos Text", "Source Serif 4", "Lora", Georgia, serif;
--font-mono:  "Anthropic Mono",  "JetBrains Mono", ui-monospace, "SF Mono", monospace;
```

Anthropic Sans/Serif/Mono 是定制商用字体（源自 Styrene + Tiempos），不可直接使用。
- 官方 skill 指定免费替代：**标题 Poppins，正文 Lora**。
- 形态更接近原版：标题 `Inter`，正文 `Source Serif 4`。

### 2.2 四条排版轨道（基础层）

| 轨道 | 字族 | 字重 | 行高 | 用途 |
|---|---|---|---|---|
| **Display** | sans | **700**（次级 600 / 500） | 1.1 | h1–h4、数字指标 |
| **Paragraph** | **serif** | 400 | 1.4（长文 1.5） | 正文、导语、引言 |
| **Detail** | sans | 400 / 500 | 1.4 | 按钮、标签、表格、caption、eyebrow |
| **Mono** | mono | 400 / 500 | 1.4 | 代码、版本号、日期戳 |

### 2.3 ⚠️ 衬线标题规则（v1 错误更正 · 本节最重要）

生产 CSS 中存在一个独立的**字族切换修饰符** `.u-font-display-serif`，与字号解耦。它把任意 display 级标题换成 Anthropic Serif。这就是你在页面上看到「有些主标题是衬线、有些不是」的原因 —— **这是刻意的双声道，不是不一致。**

#### 两种标题声调

| | **Sans Display（默认声调）** | **Serif Display（编辑声调）** |
|---|---|---|
| 字族 | Anthropic Sans | Anthropic Serif |
| **字重** | **700 bold** | **400 regular**（偶用 600） |
| 光学裁切 | trim-top `.34em` / bottom `.4em` | trim-top **`.48em`** / bottom **`.3em`** |
| 语气 | 产品化、信息化、导航性 | 人文、宣言、思辨 |
| 用在哪 | 功能区标题、卡片标题、列表标题、产品名、数据 | 品牌宣言、大 CTA、引言、观点陈述 |

**关键点：切到衬线时字重必须降到 400。** 衬线 + 700 是最典型的错误，会立刻显得廉价。衬线标题靠「字号巨大 + 字重轻」取得优雅，而不是靠加粗。

#### 生产环境中确认的衬线用例

| 元素 | 实际参数 |
|---|---|
| `.big-cta_title`（页尾大宣言，如 "Anthropic is built on hard questions."） | serif / **weight 400** / `font-size: 8vw`（桌面）· `10vw`（移动）/ `max-width: 10ch` |
| `.u-display-m` + serif 修饰（32px 区块标题） | serif / 400 |
| `.nav_links_link.is-desktop`（**桌面导航链接**） | serif / detail 字号 / 透明下划线，hover 显色 |
| `.quote_mark`（引号装饰） | serif |

> 注意第三条：**桌面主导航是衬线的**，不是无衬线。这个细节几乎没人注意到，但做对了很加分。

#### 给 Agent 的判定规则

```
默认 → Sans Display 700
以下情况 → Serif Display 400：
  ① 页尾/整屏级品牌宣言 CTA（字号 ≥ 6vw，配 max-width: 10-14ch 强制折行）
  ② 表达价值观、使命、观点的陈述句标题
  ③ 引言 / pull quote
  ④ 桌面主导航链接
一个页面里 serif display 出现 ≤ 2 处。它是重音，不是常态。
```

### 2.4 字号阶梯（桌面原值）

```
display-xxxl  6rem    (96px)      paragraph-l   1.5rem   (24px)  hero 导语
display-xxl   4.5rem  (72px)      paragraph-m   1.25rem  (20px)  长文正文
display-xl    4rem    (64px)      paragraph-s   1.125rem (18px)  默认正文
display-l     3rem    (48px)  h1  paragraph-xs  1rem     (16px)
display-m     2rem    (32px)  h2
display-s     1.5rem  (24px)  h3  detail-xl 1.25 / l 1.125 / m 1
display-xs    1.25rem (20px)  h4  detail-s .875 / xs .75  (rem)

monospace     1.125rem (18px)
```

超大宣言标题不用 rem，用 **vw**（`8vw` 桌面 / `10vw` 移动）实现真正的流体缩放。

### 2.5 排版细节

```css
h1,h2,h3 { text-wrap: balance; }  /* 标题断行均衡 */
p        { text-wrap: pretty;  }  /* 正文防孤字 */
```

- 字距：大标题 `0em`；按钮等小号 sans `-0.005em`；另有 `-0.02em` 用于超大字号。
- 行高档位只有 6 档：`1 / 1.05 / 1.1 / 1.3 / 1.4 / 1.5`。
- 光学裁切（trim）：用负 margin 抵消字体行盒空隙，使标题与相邻元素的间距等于设计值。sans `.34em/.4em`，serif `.48em/.3em`。非必需，但做了更「像」。

---

## 3. 色彩系统

### 3.1 完整 swatch（生产原值，27 个，无遗漏）

```css
/* ── 中性：Slate（暖黑） ───────────────────── */
--swatch-slate-dark:     #141413;              /* 主文字 / 深色底 */
--swatch-slate-medium:   #3d3d3a;              /* 深色底上的卡片 */
--swatch-slate-light:    #5e5d59;              /* 深色底 hover */
--swatch-slate-faded-10: rgba(20,20,19,.10);   /* 浅色主题发丝边框 */
--swatch-slate-faded-20: rgba(20,20,19,.20);   /* 浅色主题边框 hover */

/* ── 中性：Ivory（暖白） ───────────────────── */
--swatch-ivory-light:    #faf9f5;              /* 页面主背景 */
--swatch-ivory-medium:   #f0eee6;              /* 次级背景 / 隔断区块 */
--swatch-ivory-dark:     #e8e6dc;              /* 次级背景 hover */
--swatch-ivory-faded-10: rgba(250,249,245,.10);/* 深色主题发丝边框 */
--swatch-ivory-faded-20: rgba(250,249,245,.20);/* 深色主题边框 hover */

/* ── 中性：Cloud（灰） ─────────────────────── */
--swatch-cloud-light:    #d1cfc5;
--swatch-cloud-medium:   #b0aea5;              /* 次要文字（明暗通用） */
--swatch-cloud-dark:     #87867f;

--swatch-white:          #ffffff;              /* 仅作浅色主题卡片，绝不做页面底色 */
--swatch-transparent:    transparent;

/* ── 品牌橙 ────────────────────────────────── */
--swatch-clay:           #d97757;              /* 品牌橙，第一强调色 */
--swatch-accent:         #c6613f;              /* 深橙，hover / 导航按钮 */

/* ── 扩展背景色板（9 色，用于整块 section 底色） ── */
--swatch-olive:          #788c5d;   /* 橄榄绿，最常用的彩色区块 */
--swatch-sky:            #6a9bcc;   /* 天蓝 */
--swatch-kraft:          #d4a27f;   /* 牛皮纸 */
--swatch-manilla:        #ebdbbc;   /* 马尼拉纸 */
--swatch-oat:            #e3dacc;   /* 燕麦 */
--swatch-cactus:         #bcd1ca;   /* 仙人掌绿 */
--swatch-coral:          #ebcece;   /* 珊瑚粉 */
--swatch-fig:            #c46686;   /* 无花果 */
--swatch-heather:        #cbcadb;   /* 石楠紫 */
```

**使用频次实测**（背景色出现次数）：`clay 9 · ivory-medium 9 · slate-dark 9 · olive 8 · ivory-dark 7` —— 说明主力是中性色 + clay + olive，其余 7 色是低频点缀。

**官方 skill 精简映射**（做图表 / 多色系列时按此顺序取色）：
`#d97757` 橙 → `#6a9bcc` 蓝 → `#788c5d` 绿 → `#d4a27f` → `#c46686`

### 3.2 语义 token 层（22 个，组件只允许读这一层）

这是整个系统的核心机制。Section 挂主题 class，组件读语义变量，于是同一个按钮组件在浅色区和深色区自动反色。

```
背景     --bg, --bg-secondary, --bg-secondary-hover
文本     --text, --text-muted
边框     --border, --border-hover
卡片     --card, --card-faded, --card-faded-hover
链接     --link, --link-hover, --link-active
主按钮   --btn-primary-{bg, bg-hover, border, border-hover, text, text-hover}
次按钮   --btn-secondary-{bg, bg-hover, border, border-hover, text, text-hover}
三级按钮 --btn-tertiary-{bg, bg-hover, border, border-hover, text, text-hover}
```

### 3.3 四套主题的完整映射表

生产环境恰好有 **4 套**主题：`light` / `dark` / `color-light` / `color-dark`。

| 语义 token | **light**（默认） | **dark** | **color-light** | **color-dark** |
|---|---|---|---|---|
| `--bg` | `ivory-light` #faf9f5 | `slate-dark` #141413 | `ivory-light` | **`olive` #788c5d** |
| `--bg-secondary` | `ivory-medium` #f0eee6 | `slate-medium` #3d3d3a | `slate-faded-10` | `slate-faded-10` |
| `--bg-secondary-hover` | `ivory-dark` #e8e6dc | `slate-light` #5e5d59 | `slate-faded-20` | `slate-faded-20` |
| `--text` | `slate-dark` | `ivory-light` | `slate-dark` | **`slate-dark`** ⚠️ |
| `--text-muted` | `cloud-medium` #b0aea5 | `cloud-medium` #b0aea5 | `slate-faded-10` | `slate-faded-10` |
| `--border` | `slate-faded-10` | **`ivory-faded-10`** | `slate-faded-10` | `slate-faded-10` |
| `--border-hover` | `slate-faded-20` | **`ivory-faded-20`** | `slate-faded-20` | `slate-faded-20` |
| `--card` | `white` #ffffff | `slate-medium` #3d3d3a | `white` | `ivory-light` |
| `--card-faded` | `slate-faded-10` | `ivory-faded-10` | `slate-faded-10` | `slate-faded-10` |
| `--card-faded-hover` | `slate-faded-20` | `ivory-faded-20` | `slate-faded-20` | `slate-faded-20` |
| `--link` | `slate-dark` | `ivory-light` ※ | `slate-dark` | `ivory-medium` |
| `--link-hover` | `slate-light` | `ivory-medium` | `slate-light` | `ivory-faded-10` |
| `--btn-primary-bg` | `slate-dark` | **`ivory-light`** | `slate-dark` | `slate-dark` |
| `--btn-primary-bg-hover` | `slate-medium` | `ivory-medium` | `slate-medium` | `slate-medium` |
| `--btn-primary-text` | `ivory-light` | **`slate-dark`** | `ivory-light` | `ivory-light` |
| `--btn-secondary-bg` | transparent | transparent | transparent | transparent |
| `--btn-secondary-border` | `slate-dark` | `ivory-light` | `slate-dark` | `slate-dark` |
| `--btn-secondary-text` | `slate-dark` | `ivory-light` | `slate-dark` | `slate-dark` |
| `--btn-secondary-bg-hover` | `slate-dark` | `ivory-light` | `slate-dark` | `slate-dark` |
| `--btn-secondary-text-hover` | `ivory-light` | `slate-dark` | `ivory-light` | `ivory-light` |
| `--btn-tertiary-bg` | transparent | transparent | transparent | transparent |
| `--btn-tertiary-border` | = `--border` | = `--border` | = `--border` | = `--border` |
| `--btn-tertiary-text-hover` | = `--text` | = `--text` | = `--text` | = `--text` |

※ 生产 CSS 里 dark 主题的 `link--text` 实际写的是 `slate-dark`（在暗背景上不可读，几乎确定是 Webflow 编辑器留下的配置遗留）。**表中已修正为 `ivory-light`，请用修正值。**

### 3.4 ⚠️ 深色模式的三条反直觉规则（v1 错误更正）

**规则 A —— 彩色区块的文字是深色，不是白色。**
`color-dark` 主题（olive 绿底）的 `--text` 是 `#141413`。Anthropic 的彩色底都是中低饱和的柔和色，配深色文字。**不要在 olive/cactus/manilla 上放白字。**

**规则 B —— 深色模式的边框换色系，不是换透明度。**
浅色主题边框 = `rgba(20,20,19,.1)`（黑 10%）；深色主题边框 = `rgba(250,249,245,.1)`（**暖白 10%**）。用 `rgba(255,255,255,.1)` 会偏冷，破坏整体暖调。

**规则 C —— 深色模式下主按钮完全反转。**
浅色区：深色实心按钮 + 暖白字。深色区：**暖白实心按钮 + 深色字**。品牌橙按钮（`clay` 底）在两种主题下都保持橙色不变，仅用于 Claude 产品的单个主 CTA。

**其他深色模式要点：**
- 深色区卡片用 `slate-medium #3d3d3a`（比背景亮一档），**不是**加边框的透明块；也可用 `card-faded` = 暖白 10% 叠加。
- `--text-muted` 在明暗两种主题下**都是** `cloud-medium #b0aea5` —— 这是一个双向可读的中间灰，不需要为深色模式另设。
- 深色区块背景是 `#141413` 而非 `#000`。纯黑会让暖调整体崩掉。

### 3.5 深色模式的触发方式（重要架构决策）

**生产环境的 CSS 里没有任何 `prefers-color-scheme` 查询。** Anthropic 的「深色模式」不是跟随系统的主题切换，而是**编辑决定的分区配色** —— 设计师给每个 section 指定 light 或 dark，用明暗节奏推动叙事。

给 Agent 的指令：

- **做营销页 / 落地页 / 官网** → 照抄这套做法：不做 OS 跟随，用 section 主题制造节奏。
  推荐节奏：`light → light(bg-secondary) → light → dark 或 color-dark → light → dark footer`
- **做应用 / 后台 / 文档** → 需要 OS 跟随时，按下面方式扩展（这是我的推荐扩展，非官方原样）：

```css
:root { color-scheme: light; }
@media (prefers-color-scheme: dark) {
  :root:not([data-theme="light"]) { /* 套用 §3.3 dark 列的全部映射 */ }
}
[data-theme="dark"]  { /* dark 列 */ }
[data-theme="light"] { /* light 列 */ }
```
注意：即使做 OS 跟随，section 级主题也必须能局部覆盖 —— 主题变量定义在 class 上而非仅 `:root`，天然支持嵌套覆盖。

---

## 4. 间距、栅格与其他 token

```css
/* 间距阶梯 space-1 → space-12 */
.25 .5 .75 1 1.5 2 2.5 3 4 5 6 10  (rem)

/* 语义 gap */
--gap-xs:.5rem;  --gap-s:1rem;  --gap-m:1.5rem;  --gap-l:3rem;  --gap-xl:4rem;

/* Section 垂直内边距 */
--section-xs:2rem;  --section-s:4rem;  --section-m:6rem;
--section-main:10rem;      /* ← 默认 */
--section-l:14rem;  --section-page-top:12rem;

/* 容器与栅格 */
--container-main:89.5rem;   /* 1432px */
--container-small:56.25rem; /* 900px，长文/表单 */
--site-margin:64px;  --columns:12;  --gutter:2rem;

/* 圆角 */
--radius-s:.25rem;  --radius:.5rem;  --radius-l:1rem;  --radius-round:100vw;

/* 描边（全站唯一线宽） */
--border-width:1px;   /* 原值 .0625rem */

/* 焦点态 */
--focus-width:.125rem;         /* 2px */
--focus-offset-outer:.25rem;   /* 外部元素 */
--focus-offset-inner:-.125rem; /* 内嵌元素，负偏移 */
```

移动端：`--site-margin → 1.5rem`，`--section-main → 4rem`。

---

## 5. 组件配方

### 5.1 按钮（三级，`0.5rem` 圆角，1px 描边，`min-height: 2.25rem`）

```css
.btn {
  display:inline-flex; align-items:center; justify-content:center;
  gap:var(--gap-xs);
  min-height:2.25rem; padding:.5rem 1rem;
  border:1px solid transparent; border-radius:var(--radius);
  font-family:var(--font-sans); font-size:1rem; line-height:1; font-weight:500;
  letter-spacing:-.005em; text-align:center;
  transition:border-color .2s, color .2s, background-color .2s;
  outline-offset:var(--focus-offset-outer);
}
.btn--primary{ background:var(--btn-primary-bg); border-color:var(--btn-primary-bg); color:var(--btn-primary-text); }
.btn--primary:hover{ background:var(--btn-primary-bg-hover); border-color:var(--btn-primary-bg-hover); }

/* Secondary：描边 → hover 填充为反色 */
.btn--secondary{ background:transparent; border-color:var(--btn-secondary-border); color:var(--btn-secondary-text); }
.btn--secondary:hover{ background:var(--btn-secondary-bg-hover); color:var(--btn-secondary-text-hover); }

/* Tertiary：极淡描边 → hover 描边加深 */
.btn--tertiary{ background:transparent; border-color:var(--border); color:var(--text); }
.btn--tertiary:hover{ border-color:var(--text); }

/* Claude 品牌按钮：唯一允许的彩色 CTA，明暗主题下都是 clay */
.btn--claude{ background:var(--swatch-clay); border-color:var(--swatch-clay); color:var(--swatch-slate-dark); }
.btn--claude:hover{ background:var(--swatch-accent); border-color:var(--swatch-accent); }
```

**禁止**：胶囊形主按钮、渐变填充、按钮阴影。

### 5.2 卡片

- `background: var(--card)`；`border: 1px solid var(--border)`；`border-radius: .75–1rem`；**无阴影**；内边距 `1.5–2rem`。
- hover：只改 `border-color → var(--border-hover)` 或 `background → var(--bg-secondary-hover)`。**不位移、不放大**。
- Faded 变体：`background: var(--card-faded)`（同色系 10%），无边框，hover 到 `--card-faded-hover`（20%）。深色区块内首选。

### 5.3 Chip / Tag

`padding:.125rem 1rem; border-radius:100vw; border:1px solid var(--border); font:400 .875rem var(--font-sans);`
全站唯一允许全圆角的元素。

### 5.4 链接

```css
/* 正文链接：常态即带下划线，颜色继承 */
a { color:inherit; text-decoration:underline; text-underline-offset:.2em;
    text-decoration-thickness:1px; text-decoration-color:var(--border);
    transition:text-decoration-color .2s, color .2s; }
a:hover { text-decoration-color:currentColor; }

/* 导航链接（桌面）：衬线体 + 透明下划线，hover 显色 */
.nav-link { font-family:var(--font-serif); text-decoration:underline;
            text-decoration-color:transparent; text-underline-offset:.2em; }
.nav-link:hover { text-decoration-color:var(--text); }
```

### 5.5 导航栏

- 紧凑高度，背景与所在 section 同主题，滚动后加 1px 底边框。
- 左 wordmark（含 `\` 斜杠符号），中间衬线体菜单，右侧一个 primary/nav 按钮（`accent #c6613f` 底，hover 转 `clay`）。
- 可选顶部通告条：`olive` 底 + 深色文字。
- 不用重毛玻璃投影；最多 `backdrop-filter: blur(8px)`。

### 5.6 Hero

```
[eyebrow: detail-s sans, 或一个 chip]
[h1: display-xl/xxl, sans 700, 左对齐, text-wrap:balance, ≤2 行]
[导语: paragraph-l serif, max-width 40ch]
[按钮组: primary + secondary, gap 1rem]
```
上方留白 `--section-page-top`（12rem）。不要背景大图压字，不要居中三段式。
（首页实测：`h1.u-display-xl` + `p.u-paragraph-l.u-max-width-40ch`，且 h1 内嵌行内链接。）

### 5.7 页尾大宣言 CTA（衬线声调的标志性组件）

```css
.big-cta__title{
  font-family:var(--font-serif);
  font-weight:400;              /* 关键：不是 700 */
  font-size:8vw;                /* 移动端 10vw */
  line-height:1.1;
  max-width:10ch;               /* 强制折成 2–3 行 */
}
```
容器常配深色主题（`slate-dark`）或 `olive`，随滚动切换背景色。

### 5.8 图表 / 数据可视化

- 系列取色：`#d97757` → `#6a9bcc` → `#788c5d` → `#d4a27f` → `#c46686`
- 网格线 `var(--border)`；轴标签 `var(--text-muted)` + `.875rem` sans
- 无图例边框、无阴影、无 3D、无渐变填充

---

## 6. 动效

```css
--ease: cubic-bezier(.165,.84,.44,1);   /* 全站唯一缓动曲线 */
--duration: .2s;                         /* 全站唯一过渡时长 */
```

- 允许过渡的属性只有：`color / background-color / border-color / text-decoration-color / opacity`。
- 入场动画：`opacity` + `translateY(12px)`，`.6s`，`--ease`，交错 60–80ms。
- **禁止**：弹跳、hover 缩放、视差、旋转、光标跟随。气质是「安静」。
- 生产 CSS 未内置 `prefers-reduced-motion`，但**你必须补上**：

```css
@media (prefers-reduced-motion: reduce){
  *{ animation:none!important; transition-duration:.01ms!important; }
}
```

---

## 7. 图像与插画

- 风格：抽象几何、丝网印刷 / riso 质感、手绘线条、拼贴纸感；取色自扩展色板（kraft / manilla / cactus / heather / oat）。
- **不用**：写实商务图库照、3D 玻璃拟态、霓虹赛博、AI 大脑 / 神经网络俗套图。
- 图片圆角同卡片（`.5–1rem`），不加边框不加阴影。
- 品牌符号是**反斜杠 `\`**，可作分隔符或装饰 motif 少量使用。

---

## 8. 可直接复制的完整基础样式表

```css
:root{
  /* ── swatch ── */
  --swatch-slate-dark:#141413; --swatch-slate-medium:#3d3d3a; --swatch-slate-light:#5e5d59;
  --swatch-slate-faded-10:rgba(20,20,19,.1); --swatch-slate-faded-20:rgba(20,20,19,.2);
  --swatch-ivory-light:#faf9f5; --swatch-ivory-medium:#f0eee6; --swatch-ivory-dark:#e8e6dc;
  --swatch-ivory-faded-10:rgba(250,249,245,.1); --swatch-ivory-faded-20:rgba(250,249,245,.2);
  --swatch-cloud-light:#d1cfc5; --swatch-cloud-medium:#b0aea5; --swatch-cloud-dark:#87867f;
  --swatch-white:#fff;
  --swatch-clay:#d97757; --swatch-accent:#c6613f;
  --swatch-olive:#788c5d; --swatch-sky:#6a9bcc; --swatch-kraft:#d4a27f;
  --swatch-manilla:#ebdbbc; --swatch-oat:#e3dacc; --swatch-cactus:#bcd1ca;
  --swatch-coral:#ebcece; --swatch-fig:#c46686; --swatch-heather:#cbcadb;

  /* ── 字体 ── */
  --font-sans:"Poppins","Inter",Arial,sans-serif;
  --font-serif:"Source Serif 4","Lora",Georgia,serif;
  --font-mono:"JetBrains Mono",ui-monospace,monospace;

  /* ── 尺寸 ── */
  --radius-s:.25rem; --radius:.5rem; --radius-l:1rem;
  --border-width:1px;
  --container-main:89.5rem; --container-small:56.25rem; --site-margin:64px;
  --section-main:10rem; --section-m:6rem; --section-s:4rem; --section-page-top:12rem;
  --gap-xs:.5rem; --gap-s:1rem; --gap-m:1.5rem; --gap-l:3rem; --gap-xl:4rem;
  --focus-width:.125rem; --focus-offset-outer:.25rem; --focus-offset-inner:-.125rem;
  --ease:cubic-bezier(.165,.84,.44,1); --duration:.2s;
  color-scheme:light;
}

/* ══ 四套主题 ══ */
.theme-light,:root{
  --bg:var(--swatch-ivory-light); --bg-secondary:var(--swatch-ivory-medium);
  --bg-secondary-hover:var(--swatch-ivory-dark);
  --text:var(--swatch-slate-dark); --text-muted:var(--swatch-cloud-medium);
  --border:var(--swatch-slate-faded-10); --border-hover:var(--swatch-slate-faded-20);
  --card:var(--swatch-white); --card-faded:var(--swatch-slate-faded-10);
  --card-faded-hover:var(--swatch-slate-faded-20);
  --link:var(--swatch-slate-dark); --link-hover:var(--swatch-slate-light);
  --btn-primary-bg:var(--swatch-slate-dark); --btn-primary-bg-hover:var(--swatch-slate-medium);
  --btn-primary-text:var(--swatch-ivory-light);
  --btn-secondary-border:var(--swatch-slate-dark); --btn-secondary-text:var(--swatch-slate-dark);
  --btn-secondary-bg-hover:var(--swatch-slate-dark); --btn-secondary-text-hover:var(--swatch-ivory-light);
}
.theme-dark{
  --bg:var(--swatch-slate-dark); --bg-secondary:var(--swatch-slate-medium);
  --bg-secondary-hover:var(--swatch-slate-light);
  --text:var(--swatch-ivory-light); --text-muted:var(--swatch-cloud-medium);
  --border:var(--swatch-ivory-faded-10); --border-hover:var(--swatch-ivory-faded-20);
  --card:var(--swatch-slate-medium); --card-faded:var(--swatch-ivory-faded-10);
  --card-faded-hover:var(--swatch-ivory-faded-20);
  --link:var(--swatch-ivory-light); --link-hover:var(--swatch-ivory-medium);
  --btn-primary-bg:var(--swatch-ivory-light); --btn-primary-bg-hover:var(--swatch-ivory-medium);
  --btn-primary-text:var(--swatch-slate-dark);
  --btn-secondary-border:var(--swatch-ivory-light); --btn-secondary-text:var(--swatch-ivory-light);
  --btn-secondary-bg-hover:var(--swatch-ivory-light); --btn-secondary-text-hover:var(--swatch-slate-dark);
  color-scheme:dark;
}
.theme-color-light{
  --bg:var(--swatch-ivory-light); --bg-secondary:var(--swatch-slate-faded-10);
  --bg-secondary-hover:var(--swatch-slate-faded-20);
  --text:var(--swatch-slate-dark); --text-muted:var(--swatch-slate-faded-10);
  --border:var(--swatch-slate-faded-10); --border-hover:var(--swatch-slate-faded-20);
  --card:var(--swatch-white); --card-faded:var(--swatch-slate-faded-10);
  --link:var(--swatch-slate-dark); --link-hover:var(--swatch-slate-light);
  --btn-primary-bg:var(--swatch-slate-dark); --btn-primary-text:var(--swatch-ivory-light);
  --btn-secondary-border:var(--swatch-slate-dark); --btn-secondary-text:var(--swatch-slate-dark);
  --btn-secondary-bg-hover:var(--swatch-slate-dark); --btn-secondary-text-hover:var(--swatch-ivory-light);
}
/* 彩色底：文字仍为深色！底色可替换为任一扩展色板 */
.theme-color-dark{
  --bg:var(--swatch-olive); --bg-secondary:var(--swatch-slate-faded-10);
  --bg-secondary-hover:var(--swatch-slate-faded-20);
  --text:var(--swatch-slate-dark); --text-muted:var(--swatch-slate-faded-10);
  --border:var(--swatch-slate-faded-10); --border-hover:var(--swatch-slate-faded-20);
  --card:var(--swatch-ivory-light); --card-faded:var(--swatch-slate-faded-10);
  --link:var(--swatch-ivory-medium); --link-hover:var(--swatch-ivory-faded-10);
  --btn-primary-bg:var(--swatch-slate-dark); --btn-primary-text:var(--swatch-ivory-light);
  --btn-secondary-border:var(--swatch-slate-dark); --btn-secondary-text:var(--swatch-slate-dark);
  --btn-secondary-bg-hover:var(--swatch-slate-dark); --btn-secondary-text-hover:var(--swatch-ivory-light);
}
/* 彩色底变体 */
.bg-olive{--bg:var(--swatch-olive)}   .bg-clay{--bg:var(--swatch-clay)}
.bg-oat{--bg:var(--swatch-oat)}       .bg-cactus{--bg:var(--swatch-cactus)}
.bg-sky{--bg:var(--swatch-sky)}       .bg-heather{--bg:var(--swatch-heather)}
.bg-fig{--bg:var(--swatch-fig)}       .bg-coral{--bg:var(--swatch-coral)}
.bg-kraft{--bg:var(--swatch-kraft)}   .bg-manilla{--bg:var(--swatch-manilla)}

/* ══ 基础排版 ══ */
*,*::before,*::after{box-sizing:border-box}
body{
  margin:0; background:var(--bg); color:var(--text);
  font-family:var(--font-serif);      /* ← 正文衬线 */
  font-size:1.125rem; line-height:1.5;
  -webkit-font-smoothing:antialiased;
}
h1,h2,h3,h4{
  font-family:var(--font-sans); font-weight:700; line-height:1.1;
  letter-spacing:0; text-wrap:balance; margin:0 0 1.5rem;
}
h1{font-size:3rem} h2{font-size:2rem} h3{font-size:1.5rem} h4{font-size:1.25rem}
p{text-wrap:pretty; margin:0 0 1rem}

/* 衬线标题修饰符 —— 切字族的同时必须降字重 */
.font-serif-display{ font-family:var(--font-serif); font-weight:400; }

.section{padding:var(--section-main) var(--site-margin); background:var(--bg); color:var(--text)}
.container{max-width:var(--container-main); margin-inline:auto}
.prose{max-width:var(--container-small)}
.eyebrow{font-family:var(--font-sans); font-size:.875rem; font-weight:500;
         letter-spacing:-.005em; color:var(--text-muted); margin-bottom:1rem}

:focus-visible{outline:var(--focus-width) solid var(--text); outline-offset:var(--focus-offset-outer)}

@media (max-width:768px){
  :root{--site-margin:1.5rem; --section-main:4rem; --section-page-top:5rem}
  h1{font-size:2.5rem} h2{font-size:1.75rem}
}
@media (prefers-reduced-motion:reduce){
  *{animation:none!important; transition-duration:.01ms!important}
}
```

---

## 9. 页面骨架示例

```html
<body class="theme-light">
  <nav class="theme-light">…衬线体导航链接…</nav>

  <section class="section theme-light" style="padding-top:var(--section-page-top)">
    <div class="container">
      <p class="eyebrow">Announcement</p>
      <h1 style="font-size:4rem">A headline written as a plain sentence.</h1>
      <p style="font-size:1.5rem;max-width:40ch">衬线体导语，一到两句，克制陈述。</p>
      <div style="display:flex;gap:1rem;margin-top:2rem">
        <a class="btn btn--primary">Get started</a>
        <a class="btn btn--secondary">Read the docs</a>
      </div>
    </div>
  </section>

  <!-- 次级背景，制造明暗节奏 -->
  <section class="section theme-light" style="background:var(--bg-secondary)">…卡片网格…</section>

  <!-- 彩色区块：注意文字仍是深色 -->
  <section class="section theme-color-dark bg-olive">…</section>

  <!-- 深色区块：按钮自动反色为暖白底深色字 -->
  <section class="section theme-dark">…</section>

  <!-- 页尾大宣言：衬线 400，8vw，10ch -->
  <section class="section theme-dark">
    <h2 class="font-serif-display" style="font-size:8vw;max-width:10ch;line-height:1.1">
      Anthropic is built on hard questions.
    </h2>
  </section>

  <footer class="section theme-dark" style="padding-block:4rem">…</footer>
</body>
```

---

## 10. 交付前自检清单

**排版**
- [ ] 正文默认是衬线体？
- [ ] 常规标题是无衬线 **700**？
- [ ] 若用了衬线标题，字重是否降到了 **400**（而非 700）？
- [ ] 衬线标题全页 ≤ 2 处，且用在宣言/引言场景？
- [ ] 超大宣言标题用了 `vw` 单位 + `max-width: 10-14ch`？
- [ ] 桌面导航链接用了衬线体？

**颜色 / 主题**
- [ ] 页面底色 `#faf9f5` 而非 `#ffffff`？深色区 `#141413` 而非 `#000`？
- [ ] 深色区边框用的是 `rgba(250,249,245,.1)` 暖白 10%，而非 `rgba(255,255,255,.1)`？
- [ ] 深色区主按钮是**暖白底 + 深色字**（完全反转）？
- [ ] 彩色区块（olive 等）的文字是**深色 `#141413`**，不是白色？
- [ ] 所有组件颜色走语义变量，无一处硬编码 hex？
- [ ] `--text-muted` 明暗主题都用 `#b0aea5`（未为深色另设）？

**形态 / 动效**
- [ ] 全局搜索 `box-shadow` 与 `gradient`，结果为 0？
- [ ] 所有圆角 ≤ 16px（chip 除外）？
- [ ] 所有描边都是 1px？
- [ ] 桌面 section 上下留白达到 160px 量级？
- [ ] 过渡统一 0.2s + `cubic-bezier(.165,.84,.44,1)`，无位移/缩放 hover？
- [ ] 有 `:focus-visible` 样式（2px outline，0.25rem offset）？
- [ ] 有 `prefers-reduced-motion` 降级？

**内容**
- [ ] 标题句子式大小写，无感叹号、无营销黑话？
- [ ] 每屏彩色元素 ≤ 1 个，且以整块背景形式出现？

---

## 附：给 Agent 的指令模板

> 严格遵循随附的《Anthropic 设计语言规范 v2》生成页面。硬性要求：
> ① 正文衬线体；常规标题无衬线 700；仅宣言/引言类标题用衬线且**字重必须为 400**。
> ② 配色一律通过 §8 的四套主题变量（`.theme-light/dark/color-light/color-dark`）驱动，禁止硬编码 hex。
> ③ 深色区：边框用暖白 10% `rgba(250,249,245,.1)`，主按钮反转为暖白底深色字。
> ④ 彩色区（olive 等）文字保持深色 `#141413`，**不要用白字**。
> ⑤ 禁用 box-shadow 与 gradient；圆角 8px；描边统一 1px；section 垂直留白 10rem；过渡统一 0.2s + `cubic-bezier(.165,.84,.44,1)`。
> 完成后逐条核对第 10 节自检清单并逐项报告结果。
