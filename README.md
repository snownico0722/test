# PaperTodo · Compact workbench — Revision 4

A bilingual, single-workbench demo for PaperTodo papers, edge capsules, Markdown, scripts and the plugin system. This is the current revision on `feat/astra-playground-20260916` in `snownico0722/test`.

## Preview

Open `preview.html` for the standalone bundle. Serve the modular website with:

```sh
python -m http.server 4173 --directory website
```

Visit `http://localhost:4173/?lang=zh` or `?lang=en`. There is no server-side application.

## Current behavior

- Desktop scroll snapping covers the first five chapters. Beyond chapter five the remaining feature, FAQ and download content scrolls freely. Returning to the story restores snapping.
- Below 980px the two guidance links are hidden. A small chapter-number badge and readable, matching type replace the tiny compressed heading. Chapter tabs and Previous/Next remain available. The 540px phone breakpoint still uses a 48px header and 660px workbench.
- Markdown automatically enlarges the original Weekend note to a maximum of 414 × 440px. Leaving that chapter restores its compact default. Dragging or resizing the note, including keyboard adjustment, gives the user control of both size and position for the rest of the session. Geometry is only clamped when required by the available viewport; preferred values are retained.
- The fifth chapter is named Plugin system. Creation and completion use their own paper presentation, so Today and Weekend cannot reappear just because a plugin has finished. Completion opens the generated plugin in the same workbench and retains its named side capsule. Creating again replaces the same slot. Explicitly opening a base paper still works.
- The three presets are Focus timer, Habit tracker and Unit converter. The converter supports m/ft, °C/°F and kg/lb, reversible direction, and live numeric input. Language changes and capsule previews preserve its state. No free-form generation prompt is exposed.
- The script chapter keeps one Run script / Back to the paper cycle button. Paper and capsule Run buttons remain, while the powershell result has only Close and Back. These are browser simulations and do not execute commands on the computer.
- Three permanent capsules plus one generated plugin; Weekend remains linked to Today and has no side capsule. Palette controls and a two-position dark-mode slider stay in the footer of the workbench. Papers keep draggable title bars and resize grips; the outer demo title bar is absent.

## Checks

```sh
node --test tests/*.test.mjs
node --experimental-vm-modules scripts/check-modules.mjs
python scripts/build-preview.py
```

Current evidence: `evidence/LOCAL-V4-VALIDATION.json`. The Node suite has 59 passing checks, including exact unit conversions and invalid numeric input, and the five-module link check passes. Actual browser validation uses HTTP in the Codex in-app browser. Python browser tests were updated and syntax-checked but were not executed locally. Earlier delivery reports remain in the local source packages; this branch includes the current validation summary. Physical touch devices and full motion-performance suites remain unverified.

For a separate full browser-test environment, install the dependencies already specified in the bundled test scripts, then run `tests/browser_smoke.py`, `tests/visual_smoke.py` and `tests/preview_smoke.py`. The new regression cases cover Markdown automatic/manual geometry and exiting chapter snapping.

The GitHub Actions workflow runs checks and uploads validation artifacts. It does not deploy the production website. `website/classic.html` remains the original archived site.

## 中文

本轮七项修订详见 `docs/WORKBENCH-REVISION-V4.md`。第五页后恢复自由滚动；窄屏隐藏两个引导入口，章节标题改用编号块与清晰的正文级标题。Markdown 自动放大后会在其他页恢复小尺寸，手动拖动或调整大小后不再自动干涉。第五章统一叫“插件系统”，制作完成只展示当前插件。第三个预设换为真正可操作的“单位换算”，支持长度、温度和重量，不再是待办清单。

生成后直接使用插件，也可以通过同名侧边胶囊收起、预览、展开。再次制作只替换一个插件位置；制作取消或失败保留原插件。关联笔记、三并列胶囊按钮、脚本单键循环、深色滑块以及前几轮文字精简继续保留。
