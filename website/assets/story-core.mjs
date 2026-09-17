// Website state is separate from the desktop implementation. No storage or bridge.
import {escapeHTML} from './plugin-core.mjs';

export const MODES = ['off', 'basic', 'full'];
export const PALETTES = ['warm', 'ink', 'forest', 'rose'];
export const seedText = {
  "en": "# A slower weekend\n\nA little **time outdoors**, with no need to hurry.\n\n## Before we go\n- [x] Pick a day\n- [ ] Charge the camera\n- [ ] Pack a book\n\n> Leave room for the unplanned.\n\n`10:00` · Coffee, then a walk.\n\n[Weather forecast](https://www.weather.com/)",
  "zh": "# 慢一点的周末\n\n留一点 **户外时间**，不必赶路。\n\n## 出发之前\n- [x] 定好时间\n- [ ] 给相机充电\n- [ ] 带上一本书\n\n> 留一点空白，遇见计划之外。\n\n`10:00` · 喝杯咖啡，再去散步。\n\n[天气预报](https://www.weather.com/)"
};
export function createStoryState() {
  return {
    language: 'en', chapter: 'overview', palette: 'warm', dark: false,
    mode: 'basic', modeManual: false, autoEnabled: true, queueClosed: false, side: 'right',
    preview: null, pluginRevision: 0,
    papers: [
      {id: 'todo', type: 'todo', title: null, folded: false, pinned: false, x: .08, y: .07, tasks: [
        {id: 't1', key: 'task1', text: null, checked: true},
        {id: 't2', key: 'task2', text: null, checked: false, linkedPaper: 'note'},
        {id: 't3', key: 'task3', text: null, checked: false}
      ]},
      {id: 'note', type: 'note', title: null, folded: false, pinned: false, x: .84, y: .93, text: null, checks: {}}
    ]
  };
}
export function clamp(value, min, max) {return Math.min(Math.max(Number(value) || 0, min), Math.max(min, max));}
export function getPaper(state, id) {return state.papers.find(paper => paper.id === id);}
export function noteText(paper, language) {
  if (paper.text !== null) return paper.text;
  return seedText[language === 'zh' ? 'zh' : 'en'].split('\n').map((line, i) =>
    i in paper.checks ? line.replace(/^(\s*- \[)[ xX](\])/, `$1${paper.checks[i] ? 'x' : ' '}$2`) : line).join('\n');
}
export function toggleMarkdownTask(paper, language, lineIndex, checked) {
  const text = noteText(paper, language).split('\n');
  if (!/^\s*- \[[ xX]\]/.test(text[lineIndex] || '')) return false;
  if (paper.text === null) paper.checks[lineIndex] = Boolean(checked);
  else {text[lineIndex] = text[lineIndex].replace(/^(\s*- \[)[ xX](\])/, `$1${checked ? 'x' : ' '}$2`); paper.text = text.join('\n');}
  return true;
}
// The demo has one reserved tool slot. Replacing it never duplicates base papers.
export function setPluginConfig(state, config) {
  const previous = getPaper(state, 'plugin');
  const next = {id: 'plugin', type: 'plugin', folded: true,
    config: {...config, items: config.items ? [...config.items] : null}, revision: ++state.pluginRevision};
  if (previous) state.papers[state.papers.indexOf(previous)] = next;
  else state.papers.push(next);
  return next;
}
export const CHAPTERS = ['overview', 'capsules', 'markdown', 'scripts', 'studio'];
export function chapterView(chapter, makerOpen) {
  return chapter === 'studio' ? (makerOpen ? 'maker' : 'plugins') : chapter === 'scripts' ? 'script' : chapter === 'markdown' ? 'markdown' : 'desktop';
}
export function effectiveFold(paper, chapter, autoFold = false, markdownFolded = false) {
  if (paper.id === 'note' && chapter === 'markdown' && !markdownFolded) return false;
  return paper.folded || (autoFold && paper.id === 'note');
}

// Small, bounded renderer for this interactive demo, NOT PaperTodo's WPF parser.
// Tokenize before producing markup: text cannot introduce HTML or executable URLs.
function inline(text) {
  const tokens = /(`[^`\n]+`|\*\*[^*\n]+\*\*|\[[^\]\n]+\]\(https?:\/\/[^\s)]+\))/g;
  let result = '', last = 0;
  for (const match of text.matchAll(tokens)) {
    result += escapeHTML(text.slice(last, match.index));
    const value = match[0];
    if (value.startsWith('`')) result += `<code>${escapeHTML(value.slice(1, -1))}</code>`;
    else if (value.startsWith('**')) result += `<strong>${escapeHTML(value.slice(2, -2))}</strong>`;
    else {
      const link = /^\[([^\]]+)\]\((.+)\)$/.exec(value);
      result += `<a href="${escapeHTML(link[2])}" target="_blank" rel="noopener noreferrer">${escapeHTML(link[1])} ↗</a>`;
    }
    last = match.index + value.length;
  }
  return result + escapeHTML(text.slice(last));
}
export function renderMarkdown(source, mode = 'full', key = 'note', interactive = true) {
  const lines = String(source).slice(0, 12000).split('\n');
  if (mode === 'off') return `<div class="plain-note">${escapeHTML(lines.join('\n'))}</div>`;
  if (mode === 'basic') return lines.map(line => {
    const cls = /^#{1,3} /.test(line) ? 'basic-heading' : /^>/.test(line) ? 'basic-quote' : /^```/.test(line) ? 'basic-code' : '';
    return `<div class="basic-line ${cls}">${escapeHTML(line) || '<br>'}</div>`;
  }).join('');
  let inCode = false, code = [], html = [], list = null;
  function endList() {if (list) {html.push(`</${list}>`); list = null;}}
  lines.forEach((line, i) => {
    if (/^```/.test(line)) {
      endList();
      if (inCode) {html.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`); code = [];}
      inCode = !inCode; return;
    }
    if (inCode) {code.push(line); return;}
    const task = /^\s*- \[([ xX])\] (.*)/.exec(line);
    const bullet = /^(?:- |\d+\. )(.*)/.exec(line);
    if (task || bullet) {
      const tag = task || line.startsWith('-') ? 'ul' : 'ol';
      if (list !== tag) {endList(); html.push(`<${tag}>`); list = tag;}
      if (task) html.push(`<li class="md-task"><label><input type="checkbox" data-md-check="${i}" data-key="md:${escapeHTML(key)}:${i}" data-note="${escapeHTML(key)}" ${task[1] !== ' ' ? 'checked' : ''} ${interactive ? '' : 'disabled'}><span>${inline(task[2])}</span></label></li>`);
      else html.push(`<li>${inline(bullet[1])}</li>`);
      return;
    }
    endList();
    const heading = /^(#{1,3}) (.*)/.exec(line);
    if (heading) html.push(`<h${heading[1].length + 2}>${inline(heading[2])}</h${heading[1].length + 2}>`);
    else if (/^> ?/.test(line)) html.push(`<blockquote>${inline(line.replace(/^> ?/, ''))}</blockquote>`);
    else if (/^---+$/.test(line)) html.push('<hr>');
    else if (line.trim()) html.push(`<p>${inline(line)}</p>`);
  });
  endList();
  if (inCode) html.push(`<pre><code>${escapeHTML(code.join('\n'))}</code></pre>`);
  return html.join('');
}

// The linked note belongs to Today, not to the edge queue. One generated tool
// replaces the previous tool alongside the three fixed destinations.
export function dockPapers(state) {
  return [getPaper(state, 'todo'),
    {id:'maker', type:'maker', chapter:'studio'},
    {id:'script', type:'script', chapter:'scripts'}, getPaper(state, 'plugin')].filter(Boolean);
}

// Source-informed queue policy: expand in place, push followers; on transfer keep
// the pointed-at top where it fits, otherwise grow upward. Compact only on exit.
// This small web demo additionally bounds followers so every control stays reachable.
export function layoutEdgeQueue(ids, owner, previous, available, cardHeight, compact=30, gap=12) {
  const base=ids.map((_,i)=>i*(compact+gap));
  if(!owner || !ids.includes(owner)) return {owner:null, ids:[...ids], tops:base, height:compact};
  const i=ids.indexOf(owner), compatible=previous && previous.ids.join('|')===ids.join('|');
  const old=compatible?previous.ids.indexOf(previous.owner):-1;
  const current=compatible?previous.tops:base;
  const maxHeight=Math.max(compact, available-(ids.length-1)*(compact+gap));
  const height=Math.min(cardHeight,maxHeight), tops=[...base];
  if(old>=0 && i>=old) tops[i]=Math.min(current[i],available-height-(ids.length-i-1)*(compact+gap));
  tops[i]=Math.max(base[i],tops[i]);
  for(let j=i+1;j<ids.length;j++)tops[j]=tops[j-1]+(j===i+1?height:compact)+gap;
  return {owner, ids:[...ids], tops, height};
}
