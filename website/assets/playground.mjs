import {recipes, resolveLanguage, planFromPrompt, mountPlugin, exportPlugin, escapeHTML} from './plugin-core.mjs';
import {MODES, PALETTES, createStoryState, clamp, getPaper, noteText, toggleMarkdownTask, moveInQueue, addPaper, effectiveFold, renderMarkdown} from './story-core.mjs';
import {copy, translate} from './copy.mjs';

// One data model, several responsive views. The DOM is not the source of truth.
let state = createStoryState();
const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const scenes = $$('.scene');
const motion = matchMedia('(prefers-reduced-motion: reduce)');
const desktop = matchMedia('(min-width: 960px) and (min-height: 760px)');
const t = key => translate(state.language, key);
const esc = escapeHTML;
let autoTimer = 0, autoFold = false, mdFolded = false, previewScene = '', previewTimer = 0;
let suppressedHoverId = null;
let frontId = 'note', taskCounter = 10, toastTimer = 0, scriptState = 'note', scriptTouched = false;
let previewHandle = null, currentConfig = null, generation = 0, generationTimer = 0, building = false;
let generationStatus = 'buildIdle', errorKey = '', sourceShown = false, recipe = 'focus', promptIsCustom = false;
let tools = [], toolSerial = 0, pendingDialog = null, dialogReturn = null;
const editing = new Set(), drafts = new Map(), animations = new Set();
const iconPaths = {
 pin: '<path d="M6 2h6l-1 5 3 3v2H4v-2l3-3zM9 12v5"/>',
 grip: '<path d="M7 5h.01M7 9h.01M7 13h.01M11 5h.01M11 9h.01M11 13h.01" stroke-width="3"/>',
 todo: '<rect x="3" y="3" width="12" height="12" rx="2"/><path d="m6 9 2 2 4-4"/>',
 note: '<path d="M4 2h7l4 4v10H4zM10 2v5h5M7 10h5M7 13h5"/>',
 link: '<path d="m7 11 4-4M6 12l-1 1a3 3 0 0 1-4-4l3-3a3 3 0 0 1 4 0m2 6a3 3 0 0 0 4 0l3-3a3 3 0 0 0-4-4l-1 1"/>',
 fold: '<path d="m4 6 5 5 5-5M4 14h10"/>',
 close: '<path d="m4 4 10 10M14 4 4 14"/>',
 newtodo: '<rect x="2" y="3" width="10" height="12" rx="2"/><path d="m4 8 2 2 3-4M14 10v6M11 13h6"/>',
 newnote: '<path d="M3 2h7l3 3v3M3 2v14h6M11 13h6M14 10v6"/>',
};
const icon = kind => `<svg aria-hidden="true" viewBox="0 0 18 18">${iconPaths[kind] || iconPaths.note}</svg>`;
function btn(action, label, content, id = '', extra = '') {
  return `<button type="button" class="icon-button" data-action="${action}" data-paper="${esc(id)}" data-key="${action}:${esc(id)}" aria-label="${esc(t(label))}" title="${esc(t(label))}" ${extra}>${content}</button>`;
}
function title(paper) {return paper.title ?? t(paper.id === 'todo' ? 'today' : paper.id === 'note' ? 'noteTitle' : 'untitled');}
function view(scene) {return scene.dataset.scene === 'shared' ? (['overview', 'capsules', 'markdown'].includes(state.chapter) ? state.chapter : 'overview') : scene.dataset.scene;}
function visible(element) {return Boolean(element && element.getClientRects().length && getComputedStyle(element).visibility !== 'hidden');}
function activeScene() {return desktop.matches ? $('#desktop-scene') : $(`[data-scene="${['overview', 'capsules', 'markdown'].includes(state.chapter) ? state.chapter : 'overview'}"]`);}
function announce(message) {clearTimeout(toastTimer); $('#toast').textContent = message; $('#toast').hidden = false; toastTimer = setTimeout(() => {$('#toast').hidden = true;}, 4200);}
function stopAuto() {
  state.autoEnabled = false; clearTimeout(autoTimer);
  // A temporary demonstrated fold becomes an intentional current state on interaction.
  if (autoFold) {getPaper(state, 'note').folded = true; autoFold = false;}
  $$('[data-action="auto"]').forEach(button => {button.textContent = t('autoOff'); button.setAttribute('aria-pressed', 'false');});
}
function captureFocus(scene) {
  const active = document.activeElement;
  return {key: scene.contains(active) ? active.dataset.field || active.dataset.key : null,
    selection: scene.contains(active) && typeof active.selectionStart === 'number' ? [active.selectionStart, active.selectionEnd] : null,
    scroll: Object.fromEntries($$('[data-scroll]', scene).map(n => [n.dataset.scroll, [n.scrollTop, n.scrollLeft]]))};
}
function restoreFocus(scene, bookmark) {
  for (const node of $$('[data-scroll]', scene)) {
    const pos = bookmark.scroll[node.dataset.scroll]; if (pos) {node.scrollTop = pos[0]; node.scrollLeft = pos[1];}
  }
  if (!bookmark.key) return;
  const node = $$('[data-field],[data-key]', scene).find(n => (n.dataset.field || n.dataset.key) === bookmark.key);
  if (visible(node)) {node.focus({preventScroll: true}); if (bookmark.selection && typeof node.setSelectionRange === 'function') node.setSelectionRange(...bookmark.selection);}
}
function todoRows(paper, preview = false) {
  return paper.tasks.map((task, index) => {
    const text = task.text ?? t(task.key);
    return `<div class="todo-row"><label class="task-check"><input type="checkbox" data-task="${esc(task.id)}" data-paper="${paper.id}" data-key="${preview ? 'preview-' : ''}check:${paper.id}:${task.id}" aria-label="${esc(t('completeTask') + ': ' + text)}" ${task.checked ? 'checked' : ''}></label>${preview
      ? `<span class="task-text">${esc(text)}</span>`
      : `<input class="task-text" data-field="task:${paper.id}:${task.id}" data-task-text="${task.id}" data-paper="${paper.id}" aria-label="${esc(t('taskLabel'))} ${index + 1}" maxlength="80" value="${esc(text)}">`}${paper.id === 'todo' && index === 1 && !preview ? `<button class="task-tail" type="button" data-action="linked-note" data-key="linked-note:${paper.id}" aria-label="${esc(t('linkTask'))}" title="${esc(t('linkTask'))}">↗</button>` : ''}</div>`;
  }).join('');
}
function paperHTML(paper, scene) {
  const v = view(scene), isMainNote = paper.id === 'note', folded = effectiveFold(paper, v, autoFold, mdFolded);
  const readMode = v === 'overview' && !state.modeManual ? 'full' : state.mode;
  const body = paper.type === 'todo' ? todoRows(paper) : editing.has(paper.id)
    ? `<textarea class="note-editor" data-field="note:${paper.id}" data-note-input="${paper.id}" maxlength="12000" aria-label="${esc(t('paperText'))}" spellcheck="false">${esc(noteText(paper, state.language))}</textarea>`
    : `<div class="markdown" data-mode-rendered="${readMode}">${renderMarkdown(noteText(paper, state.language), readMode, paper.id)}</div>`;
  return `<article class="paper" data-id="${paper.id}" data-type="${paper.type}" data-main-note="${isMainNote}" data-front="${frontId === paper.id}" data-pinned="${Boolean(paper.pinned)}" aria-label="${esc(title(paper))}" ${folded ? 'hidden' : ''}>
    <div class="paper-header">${btn('pin',paper.pinned ? 'unpinCanvas' : 'pinCanvas',icon('pin'),paper.id,`aria-pressed="${Boolean(paper.pinned)}"`)}
    <input class="paper-title" aria-label="${esc(t('rename'))}" data-field="title:${paper.id}" data-title="${paper.id}" value="${esc(title(paper))}" maxlength="20">
    <button type="button" class="icon-button drag-grip" data-drag="${paper.id}" data-key="drag:${paper.id}" aria-label="${esc(t('drag'))}" title="${esc(t('drag'))}">${icon('grip')}</button><div class="paper-actions">${btn('link', 'link', icon('link'), paper.id)}${paper.type === 'note' ? btn('external', 'external', 'MD', paper.id).replace('class="icon-button"','class="icon-button external-button"') : ''}${btn('new-todo', 'newTodoTitle', icon('newtodo'), paper.id).replace('class="icon-button"','class="icon-button new-paper-action"')}${btn('new-note', 'newNoteTitle', icon('newnote'), paper.id).replace('class="icon-button"','class="icon-button new-paper-action"')}${btn('fold', 'fold', icon('fold'), paper.id)}</div></div>
    <div class="paper-body" data-scroll="body:${paper.id}">${body}</div>${paper.type === 'todo'
      ? `<form class="todo-add" data-add-task="${paper.id}"><input data-field="draft:${paper.id}" data-draft="${paper.id}" aria-label="${esc(t('newTask'))}" placeholder="${esc(t('newTask'))}" maxlength="80" value="${esc(drafts.get(paper.id) || '')}" ${paper.tasks.length >= 12 ? 'disabled' : ''}><button type="submit" aria-label="${esc(t('add'))}" ${paper.tasks.length >= 12 ? 'disabled' : ''}>+</button></form><div class="paper-footer"><span data-count="${paper.id}">${paper.tasks.filter(x => x.checked).length} / ${paper.tasks.length} ${esc(t('complete'))}</span><span aria-hidden="true">${paper.type === 'todo' ? '☑' : '↗'}</span></div>`
      : `<div class="paper-footer"><button type="button" data-action="edit-note" data-paper="${paper.id}" data-key="edit-note:${paper.id}">${esc(t(editing.has(paper.id) ? 'doneEditing' : 'editNote'))}</button><span>${esc(t(readMode))} · 100%</span></div>`}</article>`;
}
function previewHTML(scene) {
  const paper = getPaper(state, state.preview);
  if (!paper || previewScene !== scene.dataset.scene || state.queueClosed) return '';
  return `<aside class="preview-card" role="region" aria-label="${esc(t('previewLabel'))}" data-preview="${paper.id}">
    <div class="preview-head"><span>${esc(title(paper))}</span>${btn('dismiss-preview', 'closePreview', icon('close'), paper.id)}</div>
    <div class="preview-body" data-scroll="preview:${paper.id}">${paper.type === 'todo' ? todoRows(paper, true) : `<div class="markdown">${renderMarkdown(noteText(paper, state.language), 'full', paper.id, false)}</div>`}</div>
    <div class="preview-footer-row"><button type="button" data-action="open" data-paper="${paper.id}" data-key="preview-open:${paper.id}">${esc(t('open'))} ↗</button><div>${btn('queue-up','moveUp','↑',paper.id)}${btn('queue-down','moveDown','↓',paper.id)}</div></div>
    <p class="preview-help">${esc(t(paper.type === 'todo' ? 'previewHint' : 'notePreviewHint'))}</p></aside>`;
}
function renderScene(scene) {
  const bookmark = captureFocus(scene), v = view(scene);
  scene.dataset.view = v; scene.dataset.mdFolded = String(v === 'markdown' && effectiveFold(getPaper(state,'note'),v,autoFold,mdFolded)); scene.dataset.palette = state.palette; scene.dataset.dark = String(state.dark); scene.dataset.side = state.side;
  scene.setAttribute('role', 'region'); scene.setAttribute('aria-label', t('sceneLabel'));
  const folded = state.order.map(id => getPaper(state, id)).filter(p => p && effectiveFold(p, v, autoFold, mdFolded));
  scene.innerHTML = `<div class="scene-top"><span>${esc(t('sceneTitle'))}</span><span class="scene-number">${String(['overview','capsules','markdown'].indexOf(v)+1).padStart(2,'0')} / 03</span></div>
    <div class="scene-canvas"><div class="canvas-watermark" aria-hidden="true"><span>${state.language === 'zh' ? '留一点空白，' : 'a little space'}</span>${state.language === 'zh' ? '给下一个想法。' : 'for the next idea.'}</div><div class="canvas-corner" aria-hidden="true">✳</div>
    ${state.papers.map(p => paperHTML(p, scene)).join('')}
    <div class="capsule-rail" aria-label="${esc(t('queue'))}" ${folded.length ? '' : 'hidden'}><button type="button" class="capsule master-capsule" data-action="queue" data-key="queue" aria-expanded="${!state.queueClosed}" aria-label="${esc(t('queueToggle'))}" title="${esc(t('queueToggle'))}"><span aria-hidden="true">${state.queueClosed ? '▤' : '▱'}</span><span class="master-label">${esc(t('master'))}</span><span>${folded.length}</span></button>
    <div class="queue-items" ${state.queueClosed ? 'hidden' : ''}>${folded.map(p => `<button type="button" class="capsule" data-capsule="${p.id}" data-key="capsule:${p.id}" aria-label="${esc(title(p) + ' · ' + t('previewLabel'))}" aria-expanded="${state.preview === p.id && previewScene === scene.dataset.scene}" title="${esc(title(p))}"><span class="capsule-symbol" aria-hidden="true">${p.type === 'todo' ? '☑' : '≡'}</span><span class="capsule-title">${esc(title(p))}</span></button>`).join('')}</div>
    <div class="queue-tools"><button type="button" data-action="side" data-key="side" aria-label="${esc(t('switchSide'))}" title="${esc(t('switchSide'))}">⇄</button><button type="button" data-action="reorder" data-key="reorder" ${folded.length < 2 ? 'disabled' : ''} aria-label="${esc(t('reorder'))}" title="${esc(t('reorder'))}">↕</button></div></div>
    ${previewHTML(scene)}${v === 'markdown' && mdFolded ? `<button type="button" class="button open-note-fallback" data-action="open" data-paper="note">${esc(t('openNote'))}</button>` : ''}</div>
    <div class="scene-bottom"><div class="scene-tools"><div><div class="palette-select" role="group" aria-label="${esc(t('paletteLabel'))}">${PALETTES.map((p,i) => `<button type="button" data-palette-select="${p}" data-key="palette:${p}" aria-label="${esc(t(p))}" title="${esc(t(p))}" aria-pressed="${state.palette === p}"><i style="--swatch:${['#e2ce9c','#a9bacf','#a9c3a2','#d2a9b3'][i]}"></i></button>`).join('')}</div><button type="button" data-action="theme" data-key="theme" aria-pressed="${state.dark}">${esc(t(state.dark ? 'light' : 'dark'))}</button></div><div><button type="button" data-action="new-todo" data-key="new-todo">${esc(t('newTodo'))}</button><button type="button" data-action="new-note" data-key="new-note">${esc(t('newNote'))}</button><button type="button" data-action="tidy" data-key="tidy">${esc(t('tidy'))}</button></div></div>
    <div class="scene-options"><button type="button" data-action="auto" data-key="auto" aria-pressed="${state.autoEnabled}">${esc(t(state.autoEnabled ? 'autoOn' : 'autoOff'))}</button><button type="button" data-action="reset" data-key="reset">${esc(t('reset'))}</button></div><div class="scene-hint">${esc(t(desktop.matches ? 'sceneHint' : 'mobileHint'))}</div></div>`;
  for (const action of ['queue-up','queue-down']) {const b = $(`[data-action="${action}"]`,scene); if (b) {const i = folded.findIndex(p => p.id === b.dataset.paper); b.disabled = action === 'queue-up' ? i <= 0 : i >= folded.length-1;}}
  layoutScene(scene); restoreFocus(scene, bookmark);
}
function layoutScene(scene) {
  const canvas = $('.scene-canvas', scene); if (!canvas || !visible(scene)) return;
  const w = canvas.clientWidth, h = canvas.clientHeight;
  for (const card of $$('.paper', scene)) {
    const paper = getPaper(state, card.dataset.id);
    const md = view(scene) === 'markdown' && paper.id === 'note';
    const margin = w < 481 ? 12 : 21;
    const x = md ? margin : clamp(paper.x, 0, 1) * Math.max(0, w - card.offsetWidth - 24) + 12;
    const y = md ? margin : clamp(paper.y, 0, 1) * Math.max(0, h - card.offsetHeight - 24) + 12;
    card.style.left = `${x}px`; card.style.top = `${y}px`;
  }
  const preview = $('.preview-card', scene);
  if (preview) {
    const capsule = $(`[data-capsule="${state.preview}"]`, scene);
    const cr = canvas.getBoundingClientRect(), r = capsule?.getBoundingClientRect();
    const small = w < 481;
    preview.style.left = `${small ? 15 : state.side === 'right' ? Math.max(12, w - preview.offsetWidth - 169) : 169}px`;
    preview.style.top = `${clamp(small ? 170 : (r ? r.top - cr.top : 80), 12, h - preview.offsetHeight - 12)}px`;
  }
}
function renderScenes() {cancelAnimations(); scenes.forEach(renderScene); updateTheming(); updateModes();}
function updateTheming() {$$('.themed').forEach(n => {n.dataset.palette = state.palette; n.dataset.dark = String(state.dark);});}
function updateModes() {$$('[data-mode]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.mode === state.mode)));}
function cancelAnimations() {for (const {animation,node,ghost} of animations) {animation.cancel(); if (ghost !== false) node.remove();} animations.clear();}
function animateRealPaper(node, keyframes) {
  if (!visible(node) || motion.matches) return;
  const animation = node.animate(keyframes,{duration:340,easing:'cubic-bezier(.2,.7,.2,1)'});
  const entry = {animation,node,ghost:false}; animations.add(entry);
  animation.finished.catch(() => {}).finally(() => animations.delete(entry));
}
function paperGeometry(scene) {
  const note = $('[data-id=note]',scene);
  return visible(note) ? {left:note.style.left,top:note.style.top,width:`${note.offsetWidth}px`,height:`${note.offsetHeight}px`} : null;
}
function animateFold(oldNode, scene, id) {
  if (!oldNode || motion.matches || !visible(scene)) return;
  const target = $(`[data-capsule="${id}"]`, scene) || $('.master-capsule', scene);
  if (!visible(target)) return;
  const from = oldNode.rect, to = target.getBoundingClientRect(), node = oldNode.clone;
  node.classList.add('motion-ghost','themed'); node.removeAttribute('hidden'); node.dataset.palette = state.palette; node.dataset.dark = String(state.dark);
  node.inert = true; node.setAttribute('aria-hidden','true');
  $$('[id]',node).forEach(n => n.removeAttribute('id'));
  Object.assign(node.style, {position:'fixed',left:`${from.left}px`,top:`${from.top}px`,width:`${from.width}px`,maxWidth:'none',height:`${from.height}px`,transition:'none'});
  document.body.append(node);
  const animation = node.animate([{transform:'translate(0,0) scale(1)',opacity:.95},{transform:`translate(${to.left-from.left}px,${to.top-from.top}px) scale(${to.width/from.width},${to.height/from.height})`,opacity:.1}], {duration:340,easing:'cubic-bezier(.2,.7,.2,1)'});
  const entry = {animation,node}; animations.add(entry);
  animation.finished.catch(() => {}).finally(() => {node.remove(); animations.delete(entry);});
}
function foldPaper(id, scene) {
  const paper = getPaper(state,id); if (!paper) return;
  const card = $(`[data-id="${id}"]`,scene), old = visible(card) ? {rect:card.getBoundingClientRect(),clone:card.cloneNode(true)} : null;
  cancelAnimations(); paper.folded = true; if (id === 'note' && view(scene) === 'markdown') mdFolded = true;
  state.queueClosed = false; state.preview = null; renderScenes(); animateFold(old,scene,id);
  $(`[data-capsule="${id}"]`,scene)?.focus({preventScroll:true});
}
function openPaper(id, scene, focus = true) {
  const paper = getPaper(state,id); if (!paper) return;
  const capsule = $(`[data-capsule="${id}"]`,scene) || $('.master-capsule',scene);
  const from = visible(capsule) ? capsule.getBoundingClientRect() : null;
  cancelAnimations();
  paper.folded = false; if (id === 'note') {mdFolded = false; autoFold = false;}
  state.preview = null; frontId = id; renderScenes();
  const node = $(`[data-id="${id}"]`,scene);
  if (from && visible(node)) {const to = node.getBoundingClientRect(); node.style.transformOrigin = '0 0'; animateRealPaper(node,[{transform:`translate(${from.left-to.left}px,${from.top-to.top}px) scale(${from.width/to.width},${from.height/to.height})`,opacity:.3},{transform:'none',opacity:1}]);}
  if (focus) $(`[data-title="${id}"]`,scene)?.focus({preventScroll:true});
}
function showPreview(id, scene, focus = false) {
  clearTimeout(previewTimer);
  if (state.preview === id && previewScene === scene.dataset.scene) {if (focus) $('.preview-body input:not(:disabled),.preview-footer-row [data-action=open]',scene)?.focus({preventScroll:true}); return;}
  suppressedHoverId = null;
  state.preview = id; previewScene = scene.dataset.scene; renderScenes();
  if (focus) $('.preview-body input:not(:disabled),.preview-footer-row [data-action=open]',scene)?.focus({preventScroll:true});
}
function dismissPreview(focus = false) {
  const id = state.preview, scene = scenes.find(s => s.dataset.scene === previewScene);
  clearTimeout(previewTimer); suppressedHoverId = id; state.preview = null; renderScenes();
  if (focus && scene) $(`[data-capsule="${id}"]`,scene)?.focus({preventScroll:true});
}
function dialog(kind) {
  dialogReturn = document.activeElement; pendingDialog = kind;
  $('#dialog-title').textContent = t(kind === 'reset' ? 'resetTitle' : 'dialogLabel');
  $('#dialog-text').textContent = t(kind === 'reset' ? 'resetHint' : kind === 'link' ? 'linkHint' : 'externalHint');
  $('#dialog-cancel').textContent = t(kind === 'reset' ? 'cancelReset' : 'close');
  $('#dialog-confirm').textContent = t('resetConfirm'); $('#dialog-confirm').hidden = kind !== 'reset';
  $('#dialog').showModal(); $('#dialog-cancel').focus();
}
function closeDialog() {$('#dialog').close(); if (visible(dialogReturn)) dialogReturn.focus({preventScroll:true}); pendingDialog = null;}
$('#dialog-cancel').addEventListener('click',closeDialog);
$('#dialog').addEventListener('cancel',() => {pendingDialog = null;});
$('#dialog-confirm').addEventListener('click',() => {closeDialog(); resetDemo();});

// Delegation lets every responsive scene share the same rules without duplicate state.
document.addEventListener('click',event => {
  const control = event.target.closest('[data-action],[data-mode],[data-palette-select],[data-capsule]');
  if (!control) {
    const background = event.target.closest('.preview-card');
    if (background && !event.target.closest('button,input,label,a,textarea')) {stopAuto(); openPaper(background.dataset.preview, background.closest('.scene'));}
    return;
  }
  const scene = control.closest('.scene') || activeScene();
  const action = control.dataset.action, id = control.dataset.paper;
  if (action !== 'auto' && action !== 'reset') stopAuto();
  if (control.dataset.capsule) {showPreview(control.dataset.capsule,scene,true); return;}
  if (control.dataset.mode) {state.mode = control.dataset.mode; state.modeManual = true; renderScenes(); return;}
  if (control.dataset.paletteSelect) {state.palette = control.dataset.paletteSelect; renderScenes(); return;}
  switch(action) {
    case 'pin': {const paper = getPaper(state,id); paper.pinned = !paper.pinned; frontId = id; renderScenes(); break;}
    case 'fold': foldPaper(id,scene); break;
    case 'open': openPaper(id,scene); break;
    case 'fold-all': {
      const old = state.papers.map(p => {const n = $(`[data-id="${p.id}"]`,scene); return [p.id, visible(n) ? {rect:n.getBoundingClientRect(),clone:n.cloneNode(true)} : null];});
      cancelAnimations(); state.papers.forEach(p => {p.folded = true;}); mdFolded = view(scene) === 'markdown'; state.queueClosed = false; state.preview = null; renderScenes(); old.forEach(([pid,snapshot]) => animateFold(snapshot,scene,pid));
      if (!desktop.matches) scene.scrollIntoView({block:'start',behavior:motion.matches?'instant':'smooth'}); break;
    }
    case 'preview-todo': getPaper(state,'todo').folded = true; state.queueClosed = false; showPreview('todo',scene,true); if (!desktop.matches) scene.scrollIntoView({block:'start',behavior:motion.matches?'instant':'smooth'}); break;
    case 'queue': state.queueClosed = !state.queueClosed; state.preview = null; renderScenes(); break;
    case 'side': state.side = state.side === 'right' ? 'left' : 'right'; cancelAnimations(); renderScenes(); break;
    case 'queue-up': case 'queue-down': {const queue = state.order.filter(pid => effectiveFold(getPaper(state,pid),view(scene),autoFold,mdFolded)); const reordered = moveInQueue(queue,id,action === 'queue-up' ? -1 : 1); let at = 0; state.order = state.order.map(pid => queue.includes(pid) ? reordered[at++] : pid); renderScenes(); break;}
    case 'reorder': {const first = state.order.shift(); state.order.push(first); renderScenes(); announce(t('reorder')); break;}
    case 'dismiss-preview': dismissPreview(true); break;
    case 'theme': state.dark = !state.dark; renderScenes(); break;
    case 'new-note': case 'new-todo': {
      const paper = addPaper(state,action === 'new-note' ? 'note' : 'todo');
      if (!paper) {announce(t('paperLimit')); break;}
      frontId = paper.id; if (paper.type === 'note') editing.add(paper.id);
      // A reading-only chapter stays a reading chapter. Added papers are available in overview.
      if (view(scene) === 'markdown') {document.getElementById('overview').scrollIntoView(); state.chapter = 'overview';}
      renderScenes(); const target = activeScene(); $(`[data-title="${paper.id}"]`,target)?.focus({preventScroll:true}); break;
    }
    case 'tidy': state.papers.forEach((p,i) => {p.x = i%2 ? .84 : .08; p.y = i%2 ? .93 : .07;}); cancelAnimations(); renderScenes(); break;
    case 'edit-note': if (editing.has(id)) editing.delete(id); else editing.add(id); renderScenes(); $(`[data-note-input="${id}"]`,scene)?.focus({preventScroll:true}); break;
    case 'linked-note': openPaper('note',scene); break;
    case 'link': case 'external': dialog(action); break;
    case 'reset': dialog('reset'); break;
    case 'auto': state.autoEnabled = !state.autoEnabled; state.modeManual = !state.autoEnabled; autoFold = false; renderScenes(); scheduleAuto(); break;
  }
});
document.addEventListener('input',event => {
  const input = event.target, scene = input.closest('.scene'); if (!scene) return;
  stopAuto();
  if (input.dataset.title) getPaper(state,input.dataset.title).title = input.value;
  if (input.dataset.taskText) getPaper(state,input.dataset.paper).tasks.find(task => task.id === input.dataset.taskText).text = input.value;
  if (input.dataset.noteInput) getPaper(state,input.dataset.noteInput).text = input.value;
  if (input.dataset.draft) drafts.set(input.dataset.draft,input.value);
  // Update other views, never replace an IME composition or caret in the active editor.
  for (const other of scenes) if (other !== scene) renderScene(other);
  if (input.dataset.title) {
    const paper = getPaper(state,input.dataset.title); $(`[data-id="${paper.id}"]`,scene)?.setAttribute('aria-label',title(paper));
  }
});
document.addEventListener('change',event => {
  const input = event.target;
  if (input.dataset.task) {
    stopAuto(); const task = getPaper(state,input.dataset.paper)?.tasks.find(x => x.id === input.dataset.task); if (task) task.checked = input.checked; renderScenes();
  } else if (input.dataset.mdCheck) {
    stopAuto(); const paper = getPaper(state,input.dataset.note); if (paper) toggleMarkdownTask(paper,state.language,Number(input.dataset.mdCheck),input.checked); renderScenes();
  }
});
document.addEventListener('submit',event => {
  const id = event.target.dataset.addTask; if (!id) return;
  event.preventDefault(); stopAuto(); const paper = getPaper(state,id), input = $('input',event.target), text = input.value.trim();
  if (!text) return;
  if (paper.tasks.length >= 12) {announce(t('taskLimit')); return;}
  paper.tasks.push({id:`t${++taskCounter}`,text,checked:false}); drafts.delete(id); renderScenes();
});
for (const scene of scenes) {
  scene.addEventListener('pointerover',event => {
    const capsule = event.target.closest('[data-capsule]');
    if (capsule && capsule.dataset.capsule !== suppressedHoverId && event.pointerType !== 'touch' && !capsule.contains(event.relatedTarget)) {stopAuto(); showPreview(capsule.dataset.capsule,scene);}
    if (event.target.closest('.preview-card,.capsule-rail')) clearTimeout(previewTimer);
  });
  scene.addEventListener('pointerout',event => {
    const leaving = event.target.closest('[data-capsule]'); if (leaving && !leaving.contains(event.relatedTarget)) suppressedHoverId = null;
    if (!event.target.closest('.preview-card,.capsule-rail')) return;
    if (event.relatedTarget?.closest?.('.preview-card,.capsule-rail')?.closest('.scene') === scene) return;
    clearTimeout(previewTimer);
    previewTimer = setTimeout(() => {
      if (state.preview && !$('.preview-card',scene)?.contains(document.activeElement)) dismissPreview();
    },230);
  });
  scene.addEventListener('focusin',event => {if (event.target.matches('input,textarea')) stopAuto(); const card = event.target.closest('.paper'); if (card) {frontId = card.dataset.id; $$('.paper',scene).forEach(n => {n.dataset.front = String(n === card);});}});
  scene.addEventListener('keydown',event => {
    if (event.key === 'Escape' && state.preview) {event.preventDefault(); dismissPreview(true);}
    const grip = event.target.closest('[data-drag]');
    if (!grip || !['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(event.key)) return;
    event.preventDefault(); stopAuto(); cancelAnimations(); const paper = getPaper(state,grip.dataset.drag);
    if (view(scene) === 'markdown' && paper.id === 'note') return;
    const delta = event.shiftKey ? .15 : .035;
    paper.x = clamp(paper.x + (event.key === 'ArrowRight' ? delta : event.key === 'ArrowLeft' ? -delta : 0),0,1);
    paper.y = clamp(paper.y + (event.key === 'ArrowDown' ? delta : event.key === 'ArrowUp' ? -delta : 0),0,1); layoutScene(scene);
  });
  scene.addEventListener('pointerdown',event => {
    const card = event.target.closest('.paper');
    if (card) {frontId = card.dataset.id; $$('.paper',scene).forEach(n => {n.dataset.front = String(n === card);});}
    const grip = event.target.closest('[data-drag]'); if (!grip || event.button !== 0) return;
    const paper = getPaper(state,grip.dataset.drag); if (view(scene) === 'markdown' && paper.id === 'note') return;
    stopAuto(); cancelAnimations();
    const canvas = $('.scene-canvas',scene), start = {x:event.clientX,y:event.clientY,px:parseFloat(card.style.left),py:parseFloat(card.style.top)};
    grip.setPointerCapture(event.pointerId);
    const move = e => {
      const dx = Math.max(0,canvas.clientWidth-card.offsetWidth-24), dy = Math.max(0,canvas.clientHeight-card.offsetHeight-24);
      paper.x = dx ? clamp((start.px + e.clientX - start.x - 12)/dx,0,1) : 0;
      paper.y = dy ? clamp((start.py + e.clientY - start.y - 12)/dy,0,1) : 0; layoutScene(scene);
    };
    const end = () => {grip.removeEventListener('pointermove',move); grip.removeEventListener('pointerup',end); grip.removeEventListener('pointercancel',end); grip.removeEventListener('lostpointercapture',end); scenes.forEach(layoutScene);};
    grip.addEventListener('pointermove',move); grip.addEventListener('pointerup',end); grip.addEventListener('pointercancel',end); grip.addEventListener('lostpointercapture',end);
  });
}

// Native scrolling: no wheel cancellation, no page-key interception, no trapped long sections.
let scrollFrame = 0;
function updateChapter() {
  scrollFrame = 0;
  const sections = $$('[data-chapter]'), threshold = innerHeight * .46;
  let current = sections[0];
  for (const section of sections) {const r = section.getBoundingClientRect(); if (r.top <= threshold) current = section;}
  const rect = current.getBoundingClientRect();
  const next = rect.bottom < 90 ? 'other' : current.dataset.chapter;
  if (next !== state.chapter) {
    const scene = $('#desktop-scene'), from = paperGeometry(scene);
    cancelAnimations(); clearTimeout(autoTimer); state.chapter = next; autoFold = false; mdFolded = false; state.preview = null;
    renderScenes();
    const node = $('[data-id=note]',scene), to = paperGeometry(scene);
    if (desktop.matches && from && to) animateRealPaper(node,[from,to]);
    scheduleAuto();
  }
  $$('#navigation a').forEach(a => a.setAttribute('aria-current',String(a.hash === `#${next}`)));
}
addEventListener('scroll',() => {if (!scrollFrame) scrollFrame = requestAnimationFrame(updateChapter);},{passive:true});
function scheduleAuto() {
  clearTimeout(autoTimer);
  if (!state.autoEnabled || document.hidden || motion.matches || pendingDialog) return;
  if (state.chapter === 'capsules') {
    if (getPaper(state,'note').folded) return;
    autoTimer = setTimeout(() => {
      if (!state.autoEnabled || document.hidden || state.chapter !== 'capsules') return;
      autoFold = !autoFold; renderScenes();
      autoTimer = setTimeout(() => {autoFold = false; renderScenes();},1600);
    },1100);
  } else if (state.chapter === 'markdown' && !state.modeManual) {
    autoTimer = setTimeout(() => {
      if (!state.autoEnabled || document.hidden || state.chapter !== 'markdown') return;
      state.mode = MODES[(MODES.indexOf(state.mode)+1)%MODES.length]; renderScenes(); scheduleAuto();
    },2300);
  } else if (state.chapter === 'scripts' && !scriptTouched) {
    autoTimer = setTimeout(() => {if (!document.hidden && state.autoEnabled && state.chapter === 'scripts') {scriptState = 'capsule'; updateScript();}},1300);
  }
}
document.addEventListener('visibilitychange',() => {clearTimeout(autoTimer); if (!document.hidden) scheduleAuto();});
motion.addEventListener('change',() => {cancelAnimations(); if (motion.matches) {autoFold = false; renderScenes();} scheduleAuto();});
const resize = new ResizeObserver(() => {cancelAnimations(); scenes.forEach(layoutScene);}); scenes.forEach(scene => resize.observe(scene));
desktop.addEventListener('change',() => {cancelAnimations(); previewScene = activeScene().dataset.scene; renderScenes(); updateChapter();});
addEventListener('resize',() => {cancelAnimations(); scenes.forEach(layoutScene);});

function updateScript() {
  $('#script-editor').hidden = scriptState !== 'note'; $('#script-capsule-stage').hidden = scriptState !== 'capsule'; $('#script-result').hidden = scriptState !== 'result';
}
$$('[data-script]').forEach(button => button.addEventListener('click',() => {
  stopAuto(); scriptTouched = true;
  const action = button.dataset.script;
  scriptState = action === 'fold' ? 'capsule' : action === 'run' ? 'result' : 'note'; updateScript();
  if (action === 'run') {
    // Fixed, documented result only. Never eval, spawn, or execute user text.
    const node = $('#script-result'); if (!motion.matches) node.animate([{opacity:.35},{opacity:1}],{duration:280});
    $('[data-script="back"]',node)?.focus({preventScroll:true});
  } else if (action === 'fold') $('#lightning').focus({preventScroll:true});
}));
$('#lightning').addEventListener('contextmenu',event => {event.preventDefault(); scriptTouched = true; stopAuto(); scriptState = 'note'; updateScript(); $('[data-script="fold"]').focus({preventScroll:true});});

// Template workbench retains the original recipe/mount/export implementation.
function workbenchText() {
  $('#build-status').textContent = t(generationStatus); $('#prompt-error').textContent = errorKey ? t(errorKey) : '';
  $('#char-count').textContent = `${$('#prompt').value.length} / 500`;
  $('#build').disabled = building; $('#cancel-build').hidden = !building; $('#pipeline').setAttribute('aria-busy',String(building));
  $$('[data-recipe]').forEach(button => button.setAttribute('aria-pressed',String(button.dataset.recipe === recipe && !promptIsCustom)));
  if (currentConfig) $('#source-code').textContent = exportPlugin(currentConfig,state.language);
  $('#tool-count').textContent = `${tools.length} / 6`; $('#canvas-empty').hidden = tools.length > 0;
  for (const tool of tools) {
    $('.tool-title',tool.node).textContent = t(`${tool.config.type === 'focus' ? 'focus' : tool.config.type === 'habits' ? 'habits' : 'checklist'}Name`);
    $('[data-tool-fold]',tool.node).setAttribute('aria-label',t('foldTool')); $('[data-tool-remove]',tool.node).setAttribute('aria-label',t('removeTool'));
  }
}
function showSource(show) {
  sourceShown = show; $('#preview-stage').hidden = show; $('#source-stage').hidden = !show;
  $('#source-tab').setAttribute('aria-pressed',String(show)); $('#preview-tab').setAttribute('aria-pressed',String(!show));
  if (currentConfig) $('#source-code').textContent = exportPlugin(currentConfig,state.language);
}
function cancelBuild() {
  generation++; clearTimeout(generationTimer); building = false; generationStatus = 'buildCancelled'; $('#build-progress').value = 0; workbenchText();
}
function generate() {
  const plan = planFromPrompt($('#prompt').value);
  if (!plan.ok) {errorKey = {empty:'generationEmpty',long:'generationLong',unsupported:'generationUnsupported',duration:'generationDuration'}[plan.error]; workbenchText(); $('#prompt').focus(); return;}
  clearTimeout(generationTimer); const token = ++generation;
  errorKey = ''; building = true; generationStatus = 'building'; $('#build-progress').value = 0; workbenchText();
  let step = 0;
  const advance = () => {
    if (token !== generation) return;
    $('#build-progress').value = ++step;
    if (step < 3) {generationTimer = setTimeout(advance,motion.matches ? 20 : 260); return;}
    building = false; generationStatus = 'buildDone'; currentConfig = structuredClone(plan.config);
    previewHandle?.dispose(); $('#empty-preview').hidden = true; $('#plugin-preview').hidden = false;
    previewHandle = mountPlugin($('#plugin-preview'),currentConfig,state.language);
    $('#install').disabled = false; $('#download-demo').disabled = false; showSource(false); workbenchText();
  };
  generationTimer = setTimeout(advance,motion.matches ? 20 : 260);
}
$('#build-form').addEventListener('submit',event => {event.preventDefault(); generate();});
$('#prompt').addEventListener('input',() => {if (building) cancelBuild(); promptIsCustom = true; errorKey = ''; workbenchText();});
$('#prompt').addEventListener('keydown',event => {if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {event.preventDefault(); if (!building) generate();}});
$('#cancel-build').addEventListener('click',cancelBuild);
$$('[data-recipe]').forEach(button => button.addEventListener('click',() => {if (building) cancelBuild(); recipe = button.dataset.recipe; promptIsCustom = false; $('#prompt').value = recipes[recipe][state.language]; errorKey = ''; workbenchText();}));
$('#preview-tab').addEventListener('click',() => showSource(false)); $('#source-tab').addEventListener('click',() => showSource(true));
$('#download-demo').addEventListener('click',() => {
  if (!currentConfig) return;
  const blob = new Blob([exportPlugin(currentConfig,state.language)],{type:'text/html;charset=utf-8'}), url = URL.createObjectURL(blob), a = document.createElement('a');
  a.href = url; a.download = `papertodo-${currentConfig.type}-web-demo.html`; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url),30000);
});
$('#install').addEventListener('click',() => {
  if (!currentConfig) return;
  if (tools.length >= 6) {announce(t('toolLimit')); return;}
  const node = document.createElement('article'); node.className = 'tool-paper'; node.dataset.tool = String(++toolSerial);
  node.innerHTML = `<div class="paper-header"><span class="paper-type" aria-hidden="true">✳</span><span class="paper-name tool-title"></span><button type="button" class="icon-button" data-tool-fold aria-expanded="true">${icon('fold')}</button><button type="button" class="icon-button" data-tool-remove>${icon('close')}</button></div><div class="tool-body"></div>`;
  $('#tool-canvas').append(node);
  const config = structuredClone(currentConfig), handle = mountPlugin($('.tool-body',node),config,state.language), tool = {node,config,handle}; tools.push(tool);
  $('[data-tool-fold]',node).addEventListener('click',event => {const folded = node.classList.toggle('folded'); $('.tool-body',node).hidden = folded; event.currentTarget.setAttribute('aria-expanded',String(!folded));});
  $('[data-tool-remove]',node).addEventListener('click',() => {handle.dispose(); node.remove(); tools = tools.filter(x => x !== tool); workbenchText(); $('#install').focus({preventScroll:true});});
  workbenchText(); announce(t('toolAdded'));
});
function setLanguage(language, updateURL = true) {
  const center = innerHeight * .5;
  const readingNode = (!desktop.matches && scenes.find(n => {const r=n.getBoundingClientRect(); return visible(n) && r.top<=center && r.bottom>center;})) || $$('main section[id]').find(n => {const r=n.getBoundingClientRect(); return r.top<=center && r.bottom>center;});
  const oldY = scrollY, oldTop = readingNode ? readingNode.getBoundingClientRect().top + oldY : 0;
  state.language = language === 'zh' ? 'zh' : 'en'; document.documentElement.lang = state.language === 'zh' ? 'zh-CN' : 'en'; document.title = t('pageTitle');
  $$('[data-t]').forEach(node => {node.textContent = t(node.dataset.t);});
  $$('[data-label]').forEach(node => node.setAttribute('aria-label',t(node.dataset.label)));
  $('#language').textContent = state.language === 'zh' ? 'EN' : '中文'; $('#language').setAttribute('aria-label',state.language === 'zh' ? 'Switch to English' : '切换到中文');
  $('meta[name="description"]').content = t('heroLead'); $('meta[property="og:title"]').content = t('pageTitle'); $('meta[property="og:description"]').content = t('heroLead');
  $$('.guide-link').forEach(a => {a.href = `https://github.com/snownico0722/PaperTodo/blob/main/doc/USER_GUIDE${state.language === 'en' ? '.en' : ''}.md`;});
  $$('.archive-link').forEach(a => {a.href = `classic.html?lang=${state.language}`;});
  $('#build-progress').setAttribute('aria-label',t('building')); $('.preview-tabs').setAttribute('aria-label',`${t('preview')} / ${t('source')}`);
  if (!promptIsCustom) $('#prompt').value = recipes[recipe][state.language];
  previewHandle?.setLanguage(state.language); tools.forEach(tool => tool.handle.setLanguage(state.language));
  renderScenes(); workbenchText(); updateScript();
  if (readingNode && updateURL) {const newTop = readingNode.getBoundingClientRect().top + scrollY; scrollTo({top:oldY + newTop - oldTop,behavior:'instant'});}
  try {localStorage.setItem('papertodo-language',state.language);} catch { /* optional preference; content never stored */ }
  if (updateURL && ['http:','https:'].includes(location.protocol)) {const url = new URL(location.href); url.searchParams.set('lang',state.language); history.replaceState(null,'',url);}
}
$('#language').addEventListener('click',() => setLanguage(state.language === 'en' ? 'zh' : 'en'));
$('#menu-toggle').addEventListener('click',() => {const opened = $('#menu-toggle').getAttribute('aria-expanded') !== 'true'; $('#menu-toggle').setAttribute('aria-expanded',String(opened)); $('#navigation').classList.toggle('open',opened);});
function closeMenu() {$('#navigation').classList.remove('open'); $('#menu-toggle').setAttribute('aria-expanded','false');}
$$('#navigation a').forEach(a => a.addEventListener('click',closeMenu));
document.addEventListener('click',event => {if (!event.target.closest('.site-header')) closeMenu();});
document.addEventListener('keydown',event => {if (event.key === 'Escape' && $('#menu-toggle').getAttribute('aria-expanded') === 'true') {closeMenu(); $('#menu-toggle').focus();}});
$('#try-demo').addEventListener('click',() => {stopAuto(); state.chapter = 'overview'; renderScenes(); activeScene().scrollIntoView({block:'center',behavior:motion.matches?'instant':'smooth'}); const input = $('[data-task-text]',activeScene()); input?.focus({preventScroll:true}); announce(t('focusCanvas'));});
function resetDemo() {
  const language = state.language, chapter = state.chapter;
  clearTimeout(autoTimer); clearTimeout(previewTimer); cancelAnimations(); cancelBuild();
  previewHandle?.dispose(); previewHandle = null; tools.forEach(tool => tool.handle.dispose()); tools = []; $('#tool-canvas').replaceChildren();
  currentConfig = null; $('#plugin-preview').hidden = true; $('#empty-preview').hidden = false; $('#source-code').textContent = ''; $('#install').disabled = true; $('#download-demo').disabled = true;
  editing.clear(); drafts.clear(); state = createStoryState(); state.chapter = chapter; autoFold = false; mdFolded = false; scriptTouched = false; scriptState = 'note';
  promptIsCustom = false; recipe = 'focus'; generationStatus = 'buildIdle'; errorKey = ''; showSource(false); setLanguage(language); scheduleAuto();
  $('[data-action="reset"]',activeScene())?.focus({preventScroll:true});
}
let stored = null; try {stored = localStorage.getItem('papertodo-language');} catch { /* unavailable storage is fine */ }
const query = new URLSearchParams(location.search).get('lang');
// data-language is only used by the explicit in-memory test fixture, never a URL bypass.
setLanguage(resolveLanguage(query || document.documentElement.dataset.language,stored),false); updateChapter(); scheduleAuto();
