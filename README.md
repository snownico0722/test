# PaperTodo Playground

A paper-sized home for your ideas and little tools. A bilingual, interactive website experiment for PaperTodo, with a guided idea-to-plugin studio.

## Run locally

No framework, package installation, or build step is required for the website. From the repository root:

```sh
python -m http.server 4173 --directory website
```

Open `http://localhost:4173/`. Use `?lang=zh` for Chinese or `?lang=en` for English. English is the default; an explicit URL language takes priority over the last saved language choice. Serve the directory over HTTP: the home page uses native JavaScript modules, so opening `index.html` through `file://` is not supported.

Deploy the **contents of `website/`** as the static site root. Asset references are relative, including when the site is served from a repository subpath. This PR does not configure hosting, publish a website, or submit an entry to Product Hunt.

## What to try

- Drag a paper by its title, edit a note, change canvas color, fold/open papers, add a note, or tidy the canvas. Focus a title and use arrow keys to move it; Shift moves farther. The canvas holds up to seven papers.
- In **Plugin studio**, choose a focus timer, habit tracker, or launch checklist and press **Make my plugin**. Ctrl/Cmd + Enter also works. Try cancelling or changing the idea during assembly.
- Start, pause, and reset the timer; check off habits; add checklist items. **Add to canvas** creates an independent, fresh instance of the tool. Closing a paper disposes its timer.
- **Source** shows the actual standalone HTML used by **Export .html**. Open the exported file directly: it has no external dependencies. Exports begin in their initial state, rather than saving in-progress timer/checklist state.

Timer prompts recognize an integer duration from 1–120 minutes (default: 25). For habit/checklist demos, a colon introduces up to six comma-, semicolon-, newline-, or Chinese-punctuation-separated items, for example `Make a checklist: Design, Build, Test`. Checklists allow up to 12 items through the UI. Other requests produce a clear unsupported-template message, not an unrelated “AI-generated” result.

## What is real, and what is simulated

The canvas and resulting browser tools are interactive. **Plugin generation is a local, deterministic simulation using three templates.** It does not call GPT or any other model, request an API key, use the PaperTodo desktop bridge, or install desktop plugins. The exported HTML is a standalone browser demo, **not a desktop plugin package**.

Notes, prompts, and widget state live in the current tab and are not sent to a server or saved across refreshes. Only the chosen interface language is optionally kept in local storage. If storage is blocked, the page still works. The new page has no analytics or remote font/script dependencies; its content security policy disables connection requests. The original page is preserved separately and is not covered by this new-page implementation claim.

## Existing website preserved

`website/classic.html` is a byte-for-byte copy of the previous `website/index.html` (blob `9a2e6c7ff49bd00e41f761d453544b203297ae0c`). It retains the original desktop story and interactive demonstrations. The new navigation links to it and passes the selected language. The original favicon, robots file, and sitemap are unchanged.

## Checks

```sh
node --check website/assets/playground.mjs
node --check website/assets/plugin-core.mjs
node --test tests/core.test.mjs
```

Browser tests use Python Playwright. Keep the local HTTP server above running, then run:

```sh
python -m pip install playwright==1.57.0
python -m playwright install chromium
python tests/browser_smoke.py
```

`CHROMIUM_PATH` can select an installed Chromium binary. The tests cover timer controls, translation without data loss, custom checklist text, actual HTML download/export execution, script-injection escaping, repeated/cancelled builds, independent widget instances, paper limits, keyboard/pointer movement, reduced motion, and layouts at 320/390/768/1024/1440/1920 pixels in both languages.

In a managed environment that blocks browser navigation, the opt-in `PAPER_DEMO_IN_MEMORY=1` mode injects these exact local CSS/JS sources into `about:blank`. It does not change browser policies. That mode tests DOM and interaction behavior, **not HTTP module loading, deployment, or the landing page CSP**. During this implementation, 24 Node tests and all 10 Chromium browser scenarios passed in this mode, using Chromium 144 and Playwright 1.57.0. Actual blob downloads and the exported page's own CSP were exercised. A normal HTTP smoke run is still required after deployment.

## Challenge presentation

Suggested tagline: **A paper-sized home for your ideas and little tools.**

A 30–45 second walkthrough: move and edit a paper → describe a 12-minute timer → generate the demo → start/pause it → add it to the canvas → switch to a checklist → show the standalone source/export. Keep the simulation label visible and distinguish the existing Windows app from this browser experiment.

Reference: [GPT-6 Astra Challenge on Product Hunt](https://www.producthunt.com/contests/gpt-6-astra-challenge). The public contest page was checked; its linked submission guide could not be retrieved in this environment. This repository does not claim entry acceptance, eligibility, judging criteria, or an award. Before submitting, verify the live requirements and describe exactly how GPT-6 Astra was used during development, without representing this template demo as a live model integration.
