import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {MODES, PALETTES, createStoryState, getPaper, noteText, toggleMarkdownTask, moveInQueue, addPaper, effectiveFold, renderMarkdown, clamp} from '../website/assets/story-core.mjs';
import {copy} from '../website/assets/copy.mjs';

const html = readFileSync(new URL('../website/index.html', import.meta.url),'utf8');
const js = readFileSync(new URL('../website/assets/playground.mjs', import.meta.url),'utf8');
const css = readFileSync(new URL('../website/assets/playground.css', import.meta.url),'utf8');
test('actual mode and palette IDs are used',() => {
  assert.deepEqual(MODES,['off','basic','full']); assert.deepEqual(PALETTES,['warm','ink','forest','rose']);
  assert.equal(copy.zh.full,'完全渲染'); assert.equal(copy.en.full,'Full Render'); assert.equal(createStoryState().mode,'basic');
});
test('default state instances are independent',() => {
  const a=createStoryState(), b=createStoryState(); a.papers[0].tasks[0].checked=false;
  assert.equal(b.papers[0].tasks[0].checked,true); assert.equal(a.language,'en');
});
test('language switches retain default-note checks and custom note text',() => {
  const note=getPaper(createStoryState(),'note');
  const index=noteText(note,'en').split('\n').findIndex(line=>line.startsWith('- [ ]'));
  assert.ok(toggleMarkdownTask(note,'en',index,true));
  assert.match(noteText(note,'zh').split('\n')[index],/^- \[x\]/);
  note.text='# 我自己的 text\n- [ ] same line';
  assert.equal(noteText(note,'en'),noteText(note,'zh'));
  assert.ok(toggleMarkdownTask(note,'zh',1,true)); assert.equal(note.text,'# 我自己的 text\n- [x] same line');
  assert.equal(toggleMarkdownTask(note,'en',0,true),false);
});
test('reading exposure is derived without destroying the saved folded state',() => {
  const p=getPaper(createStoryState(),'note'); p.folded=true;
  assert.equal(effectiveFold(p,'markdown'),false); assert.equal(p.folded,true);
  assert.equal(effectiveFold(p,'capsules'),true); assert.equal(effectiveFold(p,'markdown',false,true),true);
});
test('temporary auto fold does not mutate the paper',() => {
  const p=getPaper(createStoryState(),'note'); assert.equal(effectiveFold(p,'capsules',true),true); assert.equal(p.folded,false);
  assert.equal(effectiveFold(p,'overview',false),false);
});
test('queue reorder stays bounded and does not modify input order',() => {
  const order=['a','b','c']; assert.deepEqual(moveInQueue(order,'b',-1),['b','a','c']);
  assert.deepEqual(moveInQueue(order,'a',-1),order); assert.deepEqual(moveInQueue(order,'c',1),order);
  assert.deepEqual(moveInQueue(order,'missing',1),order); assert.deepEqual(order,['a','b','c']);
});
test('paper creation has unique IDs, independent state and a six-paper cap',() => {
  const state=createStoryState();
  for(let i=0;i<4;i++) assert.ok(addPaper(state,i%2?'todo':'note'));
  assert.equal(addPaper(state),null); assert.equal(new Set(state.order).size,6); assert.equal(state.papers.length,6);
  assert.notEqual(state.papers[0].tasks,state.papers[3].tasks);
});
test('drag coordinates handle edges, tiny viewports and invalid values',() => {
  assert.equal(clamp(-9,0,1),0); assert.equal(clamp(5,0,1),1); assert.equal(clamp(NaN,0,1),0); assert.equal(clamp(50,12,-6),12);
});
for(const mode of MODES) test(`Markdown ${mode} never injects source HTML`,() => {
  const output=renderMarkdown('<img src=x onerror=alert(1)>\n[bad](javascript:alert(1))\n<script>bad()</script>',mode);
  assert.ok(!output.includes('<img')); assert.ok(!output.includes('<script>')); assert.ok(!output.includes('href="javascript:'));
});
test('rendered tasks are keyboard inputs tied to stable source lines',() => {
  const output=renderMarkdown('# h\n- [x] done\n- [ ] later','full','sample');
  assert.ok(output.includes('data-md-check="1"')); assert.ok(output.includes('data-key="md:sample:1"'));
  assert.ok(output.includes('data-note="sample"')); assert.equal((output.match(/type="checkbox"/g)||[]).length,2);
  assert.ok(renderMarkdown('- [ ] preview','full','sample',false).includes('disabled'));
});
test('full rendering supports headings, quote, code, safe links and lists',() => {
  const output=renderMarkdown('# Title\n\n> Quote\n\n1. one\n2. two\n\n```\n<x>\n```\n\n[link](https://example.com/?q="evil")');
  assert.match(output,/<h3>Title<\/h3>/); assert.ok(output.includes('<blockquote>'));
  assert.ok(output.includes('<ol>')); assert.ok(output.includes('&lt;x&gt;')); assert.ok(output.includes('&quot;evil&quot;'));
  assert.ok(output.includes('rel="noopener noreferrer"'));
});
test('renderer bounds input and closes unfinished code blocks',() => {
  assert.ok(renderMarkdown('x'.repeat(20000),'off').length<12100);
  assert.equal(renderMarkdown('```\n<unfinished>'),'<pre><code>&lt;unfinished&gt;</code></pre>');
});
test('bilingual keys match and every static copy token exists in both languages',() => {
  assert.deepEqual(Object.keys(copy.en).sort(),Object.keys(copy.zh).sort());
  for(const [,key] of html.matchAll(/data-(?:t|label)="([^"]+)"/g)) {
    assert.ok(copy.en[key],`missing en:${key}`); assert.ok(copy.zh[key],`missing zh:${key}`);
  }
});
test('six features and five FAQ themes remain on the home page',() => {
  assert.equal((html.match(/data-t="feature\dTitle"/g)||[]).length,6);
  assert.equal((html.match(/<details>/g)||[]).length,5);
  for(const section of ['overview','capsules','markdown','scripts','studio','features','faq','download']) assert.ok(html.includes(`id="${section}"`));
});
test('page assets are relative and scripts use no remote API or code evaluator',() => {
  for(const [,url] of html.matchAll(/(?:src|href)="([^"#]+\.(?:mjs|css|svg|jpg))"/g)) assert.ok(url.startsWith('assets/'),url);
  assert.ok(!/\beval\s*\(|new Function\s*\(|fetch\s*\(|XMLHttpRequest/.test(js));
  assert.ok(!js.includes("addEventListener('wheel'"));
  assert.ok(css.includes('prefers-reduced-motion')); assert.ok(css.includes('grid-template-columns:1fr 1fr') || css.includes('grid-template-columns:repeat(2'));
});
test('web pin state is explicit and independent between paper instances',() => {
  const state=createStoryState(); assert.equal(state.papers[0].pinned,false);
  state.papers[0].pinned=true; assert.equal(state.papers[1].pinned,false);
  assert.equal(addPaper(state).pinned,false);
});
