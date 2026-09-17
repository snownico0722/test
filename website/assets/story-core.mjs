// Website state is separate from the desktop implementation. No storage or bridge.
import {escapeHTML} from './plugin-core.mjs';

export const MODES = ['off', 'basic', 'full'];
export const PALETTES = ['warm', 'ink', 'forest', 'rose'];
export const seedText = {
  en: '# A little space to think\n\nKeep **the important things** close. Everything else can wait.\n\n## Today, not someday\n- [x] Make room on the desktop\n- [ ] Try the hover preview\n- [ ] Make a little tool\n\n> A few quiet papers. No extra layer of management.\n\n```powershell\nGet-FileHash .\\PaperTodo.exe\n```\n\n[Explore PaperTodo](https://github.com/snownico0722/PaperTodo)',
  zh: '# 给想法，留一点位置\n\n把 **重要的事** 放在手边，其他的可以慢一点。\n\n## 就从今天开始\n- [x] 给桌面腾出一点空间\n- [ ] 试试胶囊悬停预览\n- [ ] 做一个自己的小工具\n\n> 几张安静的纸，不多一层管理。\n\n```powershell\nGet-FileHash .\\PaperTodo.exe\n```\n\n[了解 PaperTodo](https://github.com/snownico0722/PaperTodo)'
};
export function createStoryState() {
  return {
    language: 'en', chapter: 'overview', palette: 'warm', dark: false,
    mode: 'basic', modeManual: false, autoEnabled: true, queueClosed: false, side: 'right',
    order: ['todo', 'note'], preview: null, extraCounter: 0,
    papers: [
      {id: 'todo', type: 'todo', title: null, folded: false, pinned: false, x: .08, y: .07, tasks: [
        {id: 't1', key: 'task1', text: null, checked: true},
        {id: 't2', key: 'task2', text: null, checked: false},
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
export function moveInQueue(order, id, direction) {
  const next = [...order], i = next.indexOf(id), j = i + Math.sign(direction);
  if (i < 0 || j < 0 || j >= next.length) return next;
  [next[i], next[j]] = [next[j], next[i]];
  return next;
}
export function addPaper(state, type = 'note') {
  if (state.papers.length >= 6) return null;
  const n = ++state.extraCounter;
  const paper = {id: `extra-${n}`, type, title: null, folded: false, pinned: false, x: .2 + n * .12, y: .16 + n * .1};
  if (type === 'todo') paper.tasks = [];
  else {paper.text = ''; paper.checks = {};}
  state.papers.push(paper); state.order.push(paper.id);
  return paper;
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
  if (mode === 'off') return `<pre>${escapeHTML(lines.join('\n'))}</pre>`;
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
