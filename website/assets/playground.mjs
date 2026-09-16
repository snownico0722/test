import {recipes, planFromPrompt, mountPlugin, exportPlugin, resolveLanguage} from './plugin-core.mjs';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const originals = Object.fromEntries($$('[data-i18n]').map(node => [node.dataset.i18n, node.innerText]));
const messages = {
  en: {
    noteTitle: 'A thought for later', noteText: 'Make something\nsmall.\n\nMake it yours. ✳', notePlaceholder: 'What is on your mind?', noteAria: 'Editable paper note', move: 'Move paper with arrow keys or drag', fold: 'Fold paper', unfold: 'Open paper', remove: 'Remove paper', unfoldAll: 'Open all', maxPapers: 'Seven papers is the canvas limit. Close one to make room.', building: 'Assembling your local demo…', ready: 'Ready. Go ahead and try it.', cancelled: 'Build cancelled. Your idea is still here.', changed: 'Idea changed. Build when you are ready.', added: 'Your tool is on the canvas. Try dragging its title.', addedButton: 'Added ✓', exported: 'Standalone browser demo exported. Not a desktop plugin package.', empty: 'Give your little tool an idea first.', long: 'Keep your idea under 500 characters.', unsupported: 'This guided demo supports focus timers, habit trackers, and checklists. Try one of the examples.', duration: 'Choose a timer between 1 and 120 minutes.', sourceEmpty: 'Build a demo to inspect its actual standalone HTML.', fresh: 'Fresh, interactive demo · local template', previewAria: 'Plugin preview display', paletteAria: 'Canvas color', recipeAria: 'Try an example', progressAria: 'Demo assembly progress', canvasAria: 'Interactive paper canvas', downloadedError: 'The download could not start. The same HTML is available in Source.', focusName: 'Focus timer', habitsName: 'Daily rituals', checklistName: 'Launch list', placeholder: 'Make a 25-minute focus timer with a pause button…', title: 'PaperTodo — Small paper. Big possibilities.', description: 'A paper-sized home for your ideas and little tools. Play with PaperTodo’s desktop canvas and try a guided, local plugin-making demo.', sage: 'Sage', sand: 'Sand', lavender: 'Lavender'
  },
  zh: {
    skip: '跳到正文', navStudio: '插件工作台', navClassic: '桌面版故事 ↗', getApp: '获取 PaperTodo ↗', eyebrow: '少一点软件，多一点可能。', heroLine1: '小小纸片，', heroLine2: '不止于纸。', heroLead: '放下一个念头，装进一个小工具。让桌面不只是桌面，更像你自己的空间。', heroCta: '做一个小工具', heroPlay: '先玩玩这些纸片 ↓', proof1: '不用注册', proof2: '不用 API 密钥', proof3: '打开就能玩', heroFootnote: '这是 Windows 桌面应用的网页实验场。', canvasTitle: '留一块地方，给自己的想法', canvasHint: '拖动标题，写点什么，让它变成你的。', addNote: '+ 纸片', tidy: '整理一下', foldAll: '全部折叠', papers: '张纸片，无限种可能', sessionOnly: '只在本页 · 刷新即重置', studioEyebrow: '01 / 插件工作台', studioLine1: '你的桌面，', studioLine2: '还缺点什么？', studioLead: '一个番茄钟？一点小习惯？一张恰到好处的清单？说出来，试着用，再把它放到桌面上。', studioName: 'PaperTodo / 做一个插件', demoBadge: '模拟演示', promptLabel: '从一个想法开始。', promptShortcut: '⌘ / Ctrl + Enter 生成', focusName: '专注番茄钟', habitsName: '习惯打卡', checklistName: '发布清单', build: '一键生成插件', buildIdle: '有个想法，就够了。', cancel: '取消', step1: '匹配演示模板', step2: '组装插件界面', step3: '接好本地交互', step4: '准备放上桌面', disclosure: '这是模拟演示，不会实时调用 AI。三种本地模板展示从想法到插件的过程，输入内容不会发送到服务器。', preview: '预览', source: '源码', local: '仅在本地运行', emptyTitle: '下一个小工具，\n从这里开始。', emptyLead: '选一个想法，生成一个真的可以操作的小工具。', sourceHint: '这里是实际导出的独立网页源码。没有 API 密钥、外部脚本，也不会安装桌面插件。', previewCaption: '不只是一张效果图，生成后可以直接用。', downloadDemo: '导出 .html ↓', install: '放到桌面上', exportDisclosure: '导出的是独立网页演示，不是 PaperTodo 桌面插件安装包。', studioBottom: '小小工具，自己的用法，不必再开一个大软件。', possibilitiesEyebrow: '02 / 不做更大的软件，做更像你的软件。', possibilitiesTitle: '你的桌面，你说了算。', feature1Title: '想法，有个落脚点。', feature1Text: '便签和待办，就放在你工作的地方。移动一张纸，写下一个念头，把重要的事留在眼前。', feature2Title: '需要时出现，其余时间让开。', feature2Text: '把纸片折成小小的胶囊，需要时再展开。上面的桌面里，每张纸都可以亲手折叠。', feature3Title: '缺什么，就做什么。', feature3Text: '这个实验想探索：把一个小需求变成一个小工具，而不是为了它，切换到另一个庞大的应用。', realityEyebrow: '真实的产品，与正在探索的可能', realityTitle: '纸片是真的。\n实验也说清楚。', realTitle: 'PaperTodo 是 Windows 桌面应用。', realText: '原有网页展示便签、Markdown、边缘胶囊和脚本交互。这次新增实验场，也保留了原来的完整页面。', realLink: '看看桌面版的故事 ↗', experimentTitle: '这一页，试着向前多走一步。', experimentText: '插件工作台用本地模板模拟“描述需求，制作工具”。它不会调用 GPT、安装桌面插件，也不会在刷新后保留画布内容。', experimentLink: '在 GitHub 查看这个实验 ↗', closingEyebrow: '给在意的事，留一点位置。', closingLine1: '少一点折腾，', closingLine2: '多一点自己。', closingCta: '获取 Windows 版 PaperTodo ↗', closingNote: '也可以继续玩玩这个网页，不用下载。', challengeLink: 'GPT-6 Astra Challenge · 网页实验 ↗', footerNote: '让桌面更像你自己的地方。', noteTitle: '先把这个想法放下', noteText: '做一点\n小而美的东西。\n\n按自己的心意。✳', notePlaceholder: '此刻想到什么？', noteAria: '可以编辑的纸片笔记', move: '拖动或用方向键移动纸片', fold: '折叠纸片', unfold: '展开纸片', remove: '关闭纸片', unfoldAll: '全部展开', maxPapers: '画布最多放 7 张纸片，先关掉一张腾点地方。', building: '正在组装本地演示……', ready: '做好了，试着用用看。', cancelled: '已取消，想法还在。', changed: '想法变了，准备好后再生成。', added: '已经放到上面的桌面上，可以拖动标题移动它。', addedButton: '已放上 ✓', exported: '已导出独立网页演示，不是桌面插件安装包。', empty: '先写下你想要的小工具。', long: '把想法控制在 500 个字符以内。', unsupported: '这个模拟演示支持番茄钟、习惯打卡和清单，可以先试试上面的示例。', duration: '番茄钟时长支持 1 到 120 分钟。', sourceEmpty: '生成后，这里会展示可独立运行的网页源码。', fresh: '可交互的独立演示 · 本地模板', previewAria: '插件预览方式', paletteAria: '画布配色', recipeAria: '试一个示例', progressAria: '演示组装进度', canvasAria: '可交互的纸片画布', downloadedError: '未能启动下载，可以在“源码”里查看相同的 HTML。', placeholder: '做一个 25 分钟的专注番茄钟，可以暂停……', title: 'PaperTodo — 小小纸片，不止于纸。', description: '把想法放进纸片，把需求变成小工具。体验 PaperTodo 可交互的桌面画布与本地插件制作模拟演示。', sage: '鼠尾草绿', sand: '浅沙色', lavender: '浅薰衣草紫'
  }
};
let storedLanguage;
try {storedLanguage = localStorage.getItem('papertodo.playground.language');} catch { /* Storage is optional. */ }
const queryLanguage = new URLSearchParams(location.search).get('lang');
let language = resolveLanguage(queryLanguage, storedLanguage);
const t = key => messages[language][key] ?? messages.en[key] ?? originals[key] ?? key;
const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
const canvas = $('#canvas');
const papers = [];
const maxPapers = 7;
let zIndex = 10;
let toastTimeout;
let buildToken = 0;
let buildTimers = [];
let building = false;
let statusKey = 'buildIdle';
let preview = null;
let currentConfig = null;
let installed = false;
let activeView = 'preview';
let sourceText = '';

function setCopy(node, value) {
  const lines = String(value).split('\n');
  node.replaceChildren();
  lines.forEach((line, index) => {if (index) node.append(document.createElement('br')); node.append(document.createTextNode(line));});
}
function toast(key) {
  clearTimeout(toastTimeout);
  $('#toast').textContent = t(key);
  $('#toast').hidden = false;
  toastTimeout = setTimeout(() => {$('#toast').hidden = true;}, 4000);
}
function fitPaper(paper, x = paper.x, y = paper.y) {
  const width = canvas.clientWidth;
  const height = canvas.clientHeight;
  paper.x = Math.max(8, Math.min(x, Math.max(8, width - paper.root.offsetWidth - 8)));
  paper.y = Math.max(8, Math.min(y, Math.max(8, height - paper.root.offsetHeight - 8)));
  paper.root.style.left = `${paper.x}px`;
  paper.root.style.top = `${paper.y}px`;
}
function arrangePaper(paper, index) {
  const positions = [[.1, .18], [.87, .72], [.44, .38], [.68, .12], [.12, .92], [.95, .46], [.3, .7]];
  const [x, y] = positions[index % positions.length];
  fitPaper(paper, x * Math.max(0, canvas.clientWidth - paper.root.offsetWidth), y * Math.max(0, canvas.clientHeight - paper.root.offsetHeight));
}
function updateFoldButton() {
  const folded = papers.length > 0 && papers.every(paper => paper.folded);
  $('#fold-all').textContent = t(folded ? 'unfoldAll' : 'foldAll');
  $('#fold-all').setAttribute('aria-pressed', String(folded));
}
function translatePaper(paper) {
  const title = t(paper.type === 'note' ? 'noteTitle' : `${paper.type}Name`);
  paper.handle.textContent = title;
  paper.handle.setAttribute('aria-label', `${title}. ${t('move')}`);
  paper.foldButton.setAttribute('aria-label', t(paper.folded ? 'unfold' : 'fold'));
  paper.foldButton.setAttribute('aria-expanded', String(!paper.folded));
  paper.foldButton.textContent = paper.folded ? '+' : '−';
  paper.closeButton.setAttribute('aria-label', t('remove'));
  if (paper.note) {paper.note.placeholder = t('notePlaceholder'); paper.note.setAttribute('aria-label', t('noteAria')); if (paper.seed && !paper.dirty) paper.note.value = t('noteText');}
  paper.plugin?.setLanguage(language);
}
function setFolded(paper, folded) {
  paper.folded = folded;
  paper.root.classList.toggle('is-folded', folded);
  translatePaper(paper);
  fitPaper(paper);
  updateFoldButton();
}
function createPaper(type, config = null, seed = false) {
  if (papers.length >= maxPapers) {toast('maxPapers'); return null;}
  const root = document.createElement('article');
  root.className = 'paper is-new';
  const head = document.createElement('div'); head.className = 'paper-head';
  const handle = document.createElement('button'); handle.className = 'drag-handle'; handle.type = 'button';
  const foldButton = document.createElement('button'); foldButton.className = 'paper-action'; foldButton.type = 'button';
  const closeButton = document.createElement('button'); closeButton.className = 'paper-action'; closeButton.type = 'button'; closeButton.textContent = '×';
  const body = document.createElement('div'); body.className = 'paper-body';
  head.append(handle, foldButton, closeButton); root.append(head, body); canvas.append(root);
  const paper = {root, body, handle, foldButton, closeButton, type, seed, dirty: false, folded: false, x: 16, y: 16};
  if (type === 'note') {
    paper.note = document.createElement('textarea'); paper.note.rows = 5; paper.note.maxLength = 2000;
    paper.note.addEventListener('input', () => {paper.dirty = true;}); body.append(paper.note);
  } else {paper.plugin = mountPlugin(body, config || {type, minutes: 25, items: null}, language);}
  const raise = () => {root.style.zIndex = String(++zIndex);};
  root.addEventListener('pointerdown', raise);
  root.addEventListener('focusin', raise);
  foldButton.addEventListener('click', () => {setFolded(paper, !paper.folded);});
  closeButton.addEventListener('click', () => {
    const hadFocus = root.contains(document.activeElement);
    paper.observer?.disconnect(); paper.plugin?.dispose(); root.remove();
    papers.splice(papers.indexOf(paper), 1); $('#paper-count').textContent = papers.length;
    updateFoldButton(); if (hadFocus) $('#add-note').focus({preventScroll: true});
  });
  let drag = null;
  handle.addEventListener('pointerdown', event => {
    if (event.button !== 0 || !event.isPrimary) return;
    event.preventDefault(); handle.focus({preventScroll: true}); root.classList.add('is-dragging');
    drag = {id: event.pointerId, x: event.clientX, y: event.clientY, left: paper.x, top: paper.y};
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener('pointermove', event => {
    if (!drag || drag.id !== event.pointerId) return;
    fitPaper(paper, drag.left + event.clientX - drag.x, drag.top + event.clientY - drag.y);
  });
  const endDrag = () => {drag = null; root.classList.remove('is-dragging');};
  handle.addEventListener('pointerup', endDrag); handle.addEventListener('pointercancel', endDrag); handle.addEventListener('lostpointercapture', endDrag);
  handle.addEventListener('keydown', event => {
    const direction = {ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1]}[event.key];
    if (!direction) return;
    event.preventDefault(); const step = event.shiftKey ? 24 : 8;
    fitPaper(paper, paper.x + direction[0] * step, paper.y + direction[1] * step); raise();
  });
  papers.push(paper); translatePaper(paper); arrangePaper(paper, papers.length - 1); raise();
  paper.observer = new ResizeObserver(() => fitPaper(paper)); paper.observer.observe(root);
  $('#paper-count').textContent = papers.length; updateFoldButton();
  return paper;
}

function updatePrompt() {
  $('#char-count').textContent = `${$('#prompt').value.length} / 500`;
  $$('[data-recipe]').forEach(button => button.setAttribute('aria-pressed', String($('#prompt').value === recipes[button.dataset.recipe][language])));
}
function setView(view) {
  activeView = view;
  $('#preview-stage').hidden = view !== 'preview'; $('#source-stage').hidden = view !== 'source';
  $('#preview-tab').setAttribute('aria-pressed', String(view === 'preview'));
  $('#source-tab').setAttribute('aria-pressed', String(view === 'source'));
}
function updateSource() {
  sourceText = currentConfig ? exportPlugin(currentConfig, language) : '';
  $('#source-code').textContent = sourceText || t('sourceEmpty');
}
function setBusy(value) {
  building = value;
  $('#build').disabled = value;
  $('#cancel-build').hidden = !value;
  $('#pipeline').setAttribute('aria-busy', String(value));
}
function setStatus(key) {statusKey = key; $('#build-status').textContent = t(key);}
function cancelBuild(key = 'cancelled') {
  buildToken++;
  buildTimers.forEach(clearTimeout); buildTimers = [];
  if (building) {
    setBusy(false); setStatus(key); $('#build-progress').value = 0;
    $$('#build-steps li').forEach(step => {step.className = '';});
  }
}
function showPromptError(key) {
  $('#prompt-error').textContent = key ? t(key) : '';
  $('#prompt').setAttribute('aria-invalid', String(Boolean(key)));
  $('#prompt-error').dataset.error = key || '';
}
function updatePreviewControls() {
  $('#install').disabled = !currentConfig || installed || building;
  $('#download-demo').disabled = !currentConfig || building;
  const label = $('#install [data-i18n]'); label.textContent = t(installed ? 'addedButton' : 'install');
  $('#preview-caption').textContent = t(currentConfig ? 'fresh' : 'previewCaption');
}
function build(event) {
  event.preventDefault();
  const plan = planFromPrompt($('#prompt').value);
  cancelBuild();
  if (!plan.ok) {showPromptError(plan.error); $('#prompt').focus(); updatePreviewControls(); return;}
  showPromptError(null); setBusy(true); setStatus('building');
  preview?.dispose(); preview = null; currentConfig = null; installed = false;
  $('#plugin-preview').hidden = true; $('#empty-preview').hidden = false;
  $('#build-progress').value = 0;
  $$('#build-steps li').forEach(step => {step.className = '';});
  setView('preview'); updateSource(); updatePreviewControls();
  const token = ++buildToken;
  for (let index = 0; index < 4; index++) {
    buildTimers.push(setTimeout(() => {
      if (token !== buildToken) return;
      $('#build-progress').value = index + 1;
      $$('#build-steps li').forEach((step, i) => {step.className = i <= index ? 'done' : i === index + 1 ? 'active' : '';});
      if (index === 3) {
        currentConfig = plan.config;
        preview = mountPlugin($('#plugin-preview'), currentConfig, language);
        $('#empty-preview').hidden = true; $('#plugin-preview').hidden = false;
        buildTimers = []; setBusy(false); setStatus('ready'); updateSource(); updatePreviewControls();
      }
    }, reducedMotion() ? 0 : (index + 1) * 380));
  }
}
function setLanguage(next, persist = false) {
  const selected = Object.keys(recipes).find(key => $('#prompt').value === recipes[key][language]);
  if (building) cancelBuild('changed');
  language = next === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = t('title');
  $('meta[name=description]').content = t('description');
  $('meta[property="og:title"]').content = t('title');
  $('meta[property="og:description"]').content = t('description');
  $$('[data-i18n]').forEach(node => setCopy(node, t(node.dataset.i18n)));
  $('#language').textContent = language === 'zh' ? 'EN' : '中文';
  $('#language').setAttribute('aria-label', language === 'zh' ? 'Switch to English' : '切换到中文');
  canvas.setAttribute('aria-label', t('canvasAria'));
  $('.palette').setAttribute('aria-label', t('paletteAria'));
  $('.recipes').setAttribute('aria-label', t('recipeAria'));
  $('.preview-tabs').setAttribute('aria-label', t('previewAria'));
  $('#build-progress').setAttribute('aria-label', t('progressAria'));
  $$('.palette button').forEach(button => button.setAttribute('aria-label', t(button.dataset.palette)));
  $$('a[href^="classic.html"]').forEach(link => {link.href = `classic.html?lang=${language}`;});
  $('#prompt').placeholder = t('placeholder');
  if (selected) $('#prompt').value = recipes[selected][language];
  papers.forEach(translatePaper); preview?.setLanguage(language);
  setStatus(statusKey); showPromptError($('#prompt-error').dataset.error);
  updateFoldButton(); updatePrompt(); updateSource(); updatePreviewControls(); setView(activeView);
  if (persist) {
    try {localStorage.setItem('papertodo.playground.language', language);} catch { /* Private browsing still works. */ }
    try {const url = new URL(location.href); url.searchParams.set('lang', language); history.replaceState(null, '', url);} catch { /* Optional when hosted with restrictive history rules. */ }
  }
}

$('#prompt').value = recipes.focus[language];
$('#language').addEventListener('click', () => setLanguage(language === 'en' ? 'zh' : 'en', true));
$('#add-note').addEventListener('click', () => {const paper = createPaper('note'); paper?.note.focus({preventScroll: true});});
$('#tidy').addEventListener('click', () => papers.forEach(arrangePaper));
$('#fold-all').addEventListener('click', () => {const fold = !papers.every(paper => paper.folded); papers.forEach(paper => setFolded(paper, fold));});
$$('.palette button').forEach(button => button.addEventListener('click', () => {
  canvas.dataset.palette = button.dataset.palette;
  $$('.palette button').forEach(other => other.setAttribute('aria-pressed', String(other === button)));
}));
$$('[data-recipe]').forEach(button => button.addEventListener('click', () => {
  cancelBuild('changed'); $('#prompt').value = recipes[button.dataset.recipe][language];
  showPromptError(null); updatePrompt(); updatePreviewControls();
}));
$('#prompt').addEventListener('input', () => {cancelBuild('changed'); showPromptError(null); updatePrompt(); updatePreviewControls();});
$('#prompt').addEventListener('keydown', event => {
  if (event.key === 'Enter' && (event.ctrlKey || event.metaKey) && !event.isComposing) {event.preventDefault(); $('#build-form').requestSubmit();}
});
$('#build-form').addEventListener('submit', build);
$('#cancel-build').addEventListener('click', () => {cancelBuild(); updatePreviewControls(); $('#build').focus();});
$('#preview-tab').addEventListener('click', () => setView('preview'));
$('#source-tab').addEventListener('click', () => setView('source'));
$('#install').addEventListener('click', () => {
  if (!currentConfig || building || installed) return;
  const paper = createPaper(currentConfig.type, currentConfig);
  if (!paper) return;
  installed = true; updatePreviewControls(); toast('added');
  canvas.scrollIntoView({behavior: reducedMotion() ? 'instant' : 'smooth', block: 'center'});
  paper.handle.focus({preventScroll: true});
});
$('#download-demo').addEventListener('click', () => {
  if (!currentConfig || !sourceText || building) return;
  try {
    const url = URL.createObjectURL(new Blob([sourceText], {type: 'text/html;charset=utf-8'}));
    const link = document.createElement('a'); link.href = url; link.download = `papertodo-${currentConfig.type}-demo.html`;
    document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url), 1000); toast('exported');
  } catch {toast('downloadedError'); setView('source');}
});
const canvasObserver = new ResizeObserver(() => {
  canvas.style.setProperty('--canvas-body-height', `${canvas.clientHeight - 70}px`);
  papers.forEach(paper => fitPaper(paper));
});
canvasObserver.observe(canvas);
createPaper('note', null, true);
createPaper('checklist');
setLanguage(language);
$('#build').disabled = false;
window.addEventListener('pagehide', event => {
  if (event.persisted) return;
  cancelBuild(); clearTimeout(toastTimeout); preview?.dispose(); canvasObserver.disconnect();
  papers.forEach(paper => {paper.observer?.disconnect(); paper.plugin?.dispose();});
});
