# PaperTodo — the continuous desktop story

## Next iteration

The imported fusion website is the review baseline. Read [the latest GPT-6 Pro iteration brief](docs/NEXT-ITERATION-GPT6PRO.md) before changing it. That brief reflects the user's subsequent decisions: one persistent workbench across all demonstration chapters, a predefined to-do-to-note link, and a small, fixed set of interactive papers. It takes priority over conflicting scope in the [original requirements](docs/PaperTodo-官网融合改版需求-GPT6Pro.md) and the historical implementation notes below. The workbench redesign itself is still to be implemented.

A bilingual, static website experiment. The first three chapters share one desktop scene: papers → edge capsules and interactive previews → Markdown. Scripts and the local template workbench follow. The visual language comes from the original Playground PR; the paper controls and palettes are checked against the desktop source.

## Preview locally

From the repository root:

```sh
python -m http.server 4173 --directory website
```

Open `http://localhost:4173/` (English) or `http://localhost:4173/?lang=zh` (Chinese). `?lang=en` explicitly selects English. The homepage uses native JavaScript modules: serve it over HTTP, not by double-clicking `index.html`. Python is only a convenient local file server; it is **not a hosting dependency**. GitHub Pages or another static host can serve the contents of `website/` without a build step.

This implementation does not publish the site, change the formal PaperTodo repository, merge PR #1, or submit a competition entry.

## What to try

1. Check or edit a task, rename a paper, edit its note, add another paper, or drag its separate dotted title grip. Arrow keys move a focused grip; Shift moves farther. The left pin button pins the paper **inside this web canvas**, not on Windows.
2. Fold a paper with the top-right button. Hover a capsule, or tap/press Enter, to preview it. Check a task directly; click the preview background or Open to restore its paper. The master capsule hides/shows the queue, not its data. Move the queue left/right, rotate its order, or reorder one paper with the preview arrows.
3. Continue to Markdown. The same main note expands for reading. Compare **Off / Basic / Full Render**; Full Render has working task checkboxes. Leaving this chapter restores the previous folded state. User edits, checks, manual modes and palettes survive chapter and language changes.
4. Run the fixed note → lightning capsule → result demonstration. It executes **no PowerShell** and cannot access the computer.
5. Generate a timer, habit tracker or checklist, interact with it, add independent copies to the **web demo canvas**, inspect its exact source and export a standalone HTML file.

The web scene holds six papers and the tool canvas six tools. Todo/checklist demos have bounded task counts. These are **web demo limits**, not desktop product limits. Refreshing resets demo data; only the chosen UI language may be stored locally. Reset demo asks for confirmation. Custom text and unfinished task input are not translated or discarded during a language switch.

## What is real, and what is simulated

The papers, hover cards and resulting browser tools are interactive. **Generation uses three deterministic local templates, not GPT or another model.** No API keys, model backend, telemetry, desktop bridge or Windows installation is involved. Export downloads an independent HTML demonstration, **not a native PaperTodo plugin package**. Exports start from their configuration rather than serializing a running timer or checked tasks.

The native product separately supports real plugins. See the [desktop plugin manual](https://github.com/snownico0722/PaperTodo/blob/main/plugin-samples/README.md) and [Codex CLI Bridge documentation](https://github.com/snownico0722/PaperTodo/blob/main/plugin-samples/PaperTodo.Plugin.CodexCliBridge/README.md). This website does not claim a recorded native Codex execution, successful competition entry, award, or verified product performance. ChatGPT assisted with this website's implementation, tests and review; that is distinct from live model functionality in the page.

## Source and UI references

[Review notes and migration inventory](docs/FUSION-REVIEW.md) identify source revisions, exact native UI references, web adaptations and remaining verification gaps. Native screenshots were located in the source repository but were **not visually verified as current runtime screenshots**. This is a source-informed browser demonstration, not a pixel-perfect Windows capture.

`website/classic.html` remains the original byte-for-byte archive (`9a2e6c7ff49bd00e41f761d453544b203297ae0c`). The original plugin core and its 24 unit tests are unchanged. In the delivered overlay ZIP, unchanged `classic.html` and the old `.ico` are taken from the existing feature-branch checkout rather than duplicated. The new homepage uses `assets/mark.svg`. All important product demonstrations now live on the homepage; the archive is only a footer reference.

## Checks

```sh
node --test tests/*.test.mjs
node --check website/assets/playground.mjs
node --check website/assets/story-core.mjs
node --check website/assets/copy.mjs
node --check website/assets/plugin-core.mjs
python -m pip install playwright==1.57.0 Pillow==12.3.0
python -m playwright install chromium
python tests/browser_smoke.py
python tests/capture.py
```

Browser tests start their own local HTTP server and validate the root **and `/nested/test/`** paths. `CHROMIUM_PATH` can select a browser executable. Test batches run in fresh processes to bound browser memory. `tests/capture.py` captures desktop/mobile × English/Chinese × overview/capsules/Markdown/scripts/plugins, then creates the share image from an actual final-page screenshot.

The included `Website checks (no deployment)` workflow is prepared to run these checks after the files are committed and uploads website/validation artifacts. It does not deploy. A green workflow must be inspected before claiming HTTP acceptance.

### Verification from the implementation environment

- **45/45 Node tests passed**, including all 24 original plugin tests.
- **25/25 Chromium 144 scenarios passed in explicit DOM-only mode**: real DOM interaction, pointer/keyboard controls, palette values, fold animation target geometry, independent widgets, actual blob download/export, and both languages at 320/390/430/768/1024/1440/1920px. A short 720×450 reflow case is included.
- Twenty screenshots were captured in that same mode.
- **Normal HTTP browser navigation was attempted and blocked by the managed environment (`ERR_BLOCKED_BY_ADMINISTRATOR`). HTTP module loading, the homepage CSP and deployed hosting are not locally verified.** The DOM-only fixture removes the homepage CSP solely in its isolated `about:blank` test document; it never changes browser policy. Exported HTML was exercised with its own embedded CSP. Synthetic visibility events test lifecycle gating, not operating-system background throttling.

To reproduce only that explicitly limited fixture, set `PAPER_DEMO_IN_MEMORY=1` before the browser/capture commands. It is never an automatic fallback and cannot satisfy the HTTP acceptance requirement. Current reports belong in `evidence/`; screenshots and validation output are downloadable delivery artifacts rather than permanent site dependencies. No Safari, Firefox, real-phone or Windows-native execution is claimed.

## Deployment metadata

Assets use relative paths. No unconfirmed experimental canonical URL is advertised, and the old sitemap pointing at the formal site is removed. Once the actual public root is known, run:

```sh
node scripts/configure-site.mjs https://YOUR-CONFIRMED-HOST/YOUR-PATH/
```

This writes canonical/social-image URLs, robots and sitemap for **that explicit HTTPS root**, including repository subpaths. It only edits local files and does not publish. The included share image is a crop of the final browser page, not a speculative illustration. Do not point experiment metadata at the separate official site unless deploying there has actually been authorized.

---

## 中文说明

本次将旧站“纸片 → 胶囊 → Markdown”的连续演示，与 Playground 新视觉融合；脚本、扩展、六项特性、五项 FAQ 和下载都在首页。桌面保留固定演示区，手机改为章节内纵向演示，共用状态而不丢失输入。

从仓库根目录执行上面的 `python -m http.server 4173 --directory website`，访问 `http://localhost:4173/?lang=zh`。Python 只用于本地预览，部署仍是普通静态文件。

三个模板均为本地模拟，不调用 GPT；“加入网页画布”不等于安装到 Windows；导出是独立 HTML，不是桌面插件包。脚本区不执行 PowerShell。演示采用的 UI 源码、网页适配和未确认项，见[改版审阅说明](docs/FUSION-REVIEW.md)。

本环境已通过 45 项 Node 测试、25 组 Chromium DOM 交互/布局检查，并生成 20 张桌面/手机中英文截图。真实 HTTP 浏览器导航受到管理策略阻止，因此不能把 DOM 测试当作 HTTP、首页 CSP 或正式站验证。需要在普通浏览器或本分支的非部署 CI 中完成该项验收。

## Original overlay delivery record

This section describes the supplied ZIP's original packaging environment. Later branch uploads and validation should be checked in the current Git history and CI; the original blocked-write status below is historical.

GitHub write was blocked by the platform. No remote commit or workflow run was created. The delivered ZIP is an overlay for the existing `be5098ee371d83092d8bc21bdee172a35d768970` feature checkout. Apply it with the included script or copy the listed files and remove the obsolete `website/sitemap.xml`. The archive page and other untouched repository files remain in that checkout. `apply-fusion.ps1` refuses a different revision or a dirty checkout, backs up overwritten files, and never commits or pushes.

The separately delivered `papertodo-fusion-preview.html` bundles the exact final homepage CSS and JavaScript for convenient offline viewing. It is not the primary source entry, a desktop plugin, a deployment, or evidence of HTTP module loading. The actual site entry remains `website/index.html`.
