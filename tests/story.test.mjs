import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {CHAPTERS, MODES, PALETTES, createStoryState, getPaper, noteText, toggleMarkdownTask, setPluginConfig, effectiveFold, renderMarkdown, chapterView, clamp, dockPapers, layoutEdgeQueue} from '../website/assets/story-core.mjs';
import {copy} from '../website/assets/copy.mjs';
const html = readFileSync(new URL('../website/index.html', import.meta.url),'utf8');
const js = readFileSync(new URL('../website/assets/playground.mjs', import.meta.url),'utf8');
const css = readFileSync(new URL('../website/assets/playground.css', import.meta.url),'utf8');

test('the product mode IDs and palette values are retained',()=>{
 assert.deepEqual(MODES,['off','basic','full']); assert.deepEqual(PALETTES,['warm','ink','forest','rose']);
 assert.equal(copy.zh.full,'完全渲染'); assert.equal(copy.en.full,'Full Render'); assert.equal(createStoryState().mode,'basic');
});
test('fixed initial papers have a predefined link to the original note',()=>{
 const state=createStoryState(); assert.deepEqual(state.papers.map(p=>p.id),['todo','note']);
 assert.equal(state.papers[0].tasks[1].linkedPaper,'note'); assert.equal(getPaper(state,'note').type,'note');
});
test('fresh sessions do not share mutable check state',()=>{
 const a=createStoryState(),b=createStoryState();a.papers[0].tasks[0].checked=false;
 assert.equal(b.papers[0].tasks[0].checked,true);
});
test('repeated generation replaces the one tool slot without touching base identities or checks',()=>{
 const state=createStoryState(),note=getPaper(state,'note'),todo=getPaper(state,'todo');
 todo.tasks[1].checked=true;note.checks[7]=true;
 for(let i=0;i<10;i++)setPluginConfig(state,{type:i%2?'habits':'focus',minutes:12,items:['custom']});
 assert.equal(state.papers.length,3);assert.equal(state.pluginRevision,10);
 assert.equal(getPaper(state,'note'),note);assert.equal(getPaper(state,'todo'),todo);assert.equal(todo.tasks[1].checked,true);
 assert.deepEqual(state.papers.map(p=>p.id),['todo','note','plugin']);
});
test('tool configuration does not alias mutable incoming item arrays',()=>{
 const state=createStoryState(),input={type:'habits',items:['one'],minutes:25};
 const plugin=setPluginConfig(state,input);input.items.push('two');assert.deepEqual(plugin.config.items,['one']);
});
test('all five chapters resolve to a mode of the same workbench',()=>{
 assert.deepEqual(CHAPTERS,['overview','capsules','markdown','scripts','studio']);
 assert.equal(chapterView('studio',true),'maker');assert.equal(chapterView('studio',false),'plugins');
 assert.equal(chapterView('scripts',false),'script');assert.equal(chapterView('markdown',true),'markdown');
});
test('language changes retain checked source lines and original custom text',()=>{
 const note=getPaper(createStoryState(),'note'), index=noteText(note,'en').split('\n').findIndex(l=>l.startsWith('- [ ]'));
 assert.ok(toggleMarkdownTask(note,'en',index,true));assert.match(noteText(note,'zh').split('\n')[index],/^- \[x\]/);
 note.text='# custom\n- [ ] keep';assert.ok(toggleMarkdownTask(note,'zh',1,true));assert.equal(noteText(note,'en'),'# custom\n- [x] keep');
 assert.equal(toggleMarkdownTask(note,'en',0,true),false);
});
test('reading exposure can preserve the underlying folded state',()=>{
 const note=getPaper(createStoryState(),'note');note.folded=true;assert.equal(effectiveFold(note,'markdown'),false);
 assert.equal(note.folded,true);assert.equal(effectiveFold(note,'capsules'),true);
});
for(const mode of MODES)test(`Markdown ${mode} is bounded and never evaluates source HTML`,()=>{
 const output=renderMarkdown('<img src=x onerror=alert(1)>\n[bad](javascript:alert(1))\n<script>bad()</script>',mode);
 assert.ok(!output.includes('<img'));assert.ok(!output.includes('<script>'));assert.ok(!output.includes('href="javascript:'));
 assert.ok(renderMarkdown('x'.repeat(20000),'off').length<12100);
});
test('full tasks map to stable source lines and previews can be read-only',()=>{
 const output=renderMarkdown('# h\n- [x] done\n- [ ] later','full','note');
 assert.match(output,/data-md-check="1"/);assert.match(output,/data-key="md:note:1"/);
 assert.equal((output.match(/type="checkbox"/g)||[]).length,2);assert.match(renderMarkdown('- [ ] peek','full','note',false),/disabled/);
});
test('full rendering preserves headings, code, quotes, links, ordered lists and escaping',()=>{
 const out=renderMarkdown('# Title\n\n> Quote\n\n1. one\n2. two\n\n```\n<x>\n```\n\n[link](https://example.com/?q="evil")');
 for(const text of ['<h3>Title</h3>','<blockquote>','<ol>','&lt;x&gt;','&quot;evil&quot;','rel="noopener noreferrer"'])assert.ok(out.includes(text));
 assert.equal(renderMarkdown('```\n<unfinished>'),'<pre><code>&lt;unfinished&gt;</code></pre>');
});
test('preview clamping handles narrow and inconsistent bounds',()=>{
 assert.equal(clamp(-9,0,1),0);assert.equal(clamp(5,0,1),1);assert.equal(clamp(NaN,0,1),0);assert.equal(clamp(50,12,-6),12);
});
test('one canvas and one workbench replace all duplicated scenes',()=>{
 assert.equal((html.match(/id="desktop-scene"/g)||[]).length,1);assert.equal((html.match(/class="scene-canvas"/g)||[]).length,1);
 for(const old of ['id="tool-canvas"','class="mobile-scene"','class="script-stage"'])assert.ok(!html.includes(old));
 assert.ok(html.indexOf('id="maker"')>html.indexOf('id="workbench-canvas"'));
 assert.equal((html.match(/data-paper-id=/g)||[]).length,3);
});
test('free management and unsupported desktop operations have no visitor controls',()=>{
 for(const action of ['new-todo','new-note','delete','copy','external','pin','link'])assert.ok(!html.includes(`data-action="${action}"`));
 assert.ok(!html.includes('contenteditable'));assert.ok(!html.includes('data-add-task'));assert.equal((html.match(/data-drag-handle/g)||[]).length,4);
});
test('returning from the maker does not navigate or recreate the desktop',()=>{
 const body=js.match(/function returnToDesktop\(\) \{([\s\S]*?)\n\}/)[1];
 assert.ok(!/navigate\(|scrollTo\(|innerHTML/.test(body));assert.ok(body.includes('renderScene()'));
 assert.ok(js.includes('pluginHandle?.dispose()'));assert.ok(js.includes('target.append(pluginNode)'));
});
test('all interface tokens have matching bilingual entries',()=>{
 assert.deepEqual(Object.keys(copy.en).sort(),Object.keys(copy.zh).sort());
 for(const [,key] of html.matchAll(/data-(?:t|label)="([^"]+)"/g)){assert.ok(copy.en[key],`en:${key}`);assert.ok(copy.zh[key],`zh:${key}`);}
});
test('six features and five FAQ topics remain without adding new demonstration canvases',()=>{
 assert.equal((html.match(/data-t="feature\dTitle"/g)||[]).length,6);
 assert.equal((html.match(/<summary data-t="q\d"/g)||[]).length,5);
 for(const id of [...CHAPTERS,'features','faq','download'])assert.ok(html.includes(`id="${id}"`));
});
test('static modules stay local, keep reduced motion, and never hijack wheel events',()=>{
 assert.ok(html.includes("connect-src 'none'"));assert.ok(css.includes('prefers-reduced-motion'));assert.ok(css.includes('grid-template-columns:repeat(2'));
 assert.ok(!/\beval\s*\(|new Function\s*\(|fetch\s*\(|XMLHttpRequest/.test(js));assert.ok(!js.includes("addEventListener('wheel'"));
 assert.ok(!js.includes('min-height: 760px'));assert.ok(js.includes("matchMedia('(min-width: 980px)')"));
});

test('linked notes stay out of the dock and the generated tool is fourth',()=>{
 const state=createStoryState(),note=getPaper(state,'note');assert.equal(note.linkedOnly,undefined);
 for(const folded of [true,false]){state.papers.forEach(p=>p.folded=folded);assert.deepEqual(dockPapers(state).map(p=>p.id),['todo','maker','script']);}
 setPluginConfig(state,{type:'focus',minutes:12,items:null});assert.equal(getPaper(state,'plugin').folded,true);
 assert.deepEqual(dockPapers(state).map(p=>p.id),['todo','maker','script','plugin']);
});
test('preview growth pushes followers, downward transfer anchors and exit compacts',()=>{
 const ids=['todo','plugin'];let a=layoutEdgeQueue(ids,'todo',null,600,240);
 assert.deepEqual(a.tops,[0,252]);let b=layoutEdgeQueue(ids,'plugin',a,600,300);
 assert.equal(b.tops[1],252);assert.equal(b.tops[0],0);
 let c=layoutEdgeQueue(ids,'todo',b,600,240);assert.deepEqual(c.tops,[0,252]);
 assert.deepEqual(layoutEdgeQueue(ids,null,c,600,240).tops,[0,42]);
});
test('short preview transfer grows upward and leaves followers reachable',()=>{
 const ids=['todo','plugin'];const a=layoutEdgeQueue(ids,'todo',null,330,240),b=layoutEdgeQueue(ids,'plugin',a,330,440);
 assert.ok(b.tops[1]<a.tops[1]);assert.ok(b.tops[1]+b.height<=330);assert.ok(b.tops[1]>=42);
});

test('dynamic task and template names have real bilingual copy, not fallback keys',()=>{
 for(const lang of ['en','zh']) {
  for(const task of createStoryState().papers[0].tasks) assert.ok(copy[lang][task.key],`${lang}:${task.key}`);
  for(const type of ['focus','habits','converter']) {
   assert.ok(copy[lang][`${type}Name`]);assert.ok(copy[lang][`${type}Example`]);
  }
 }
});
test('visitor copy does not leak implementation constraints or duplicate onboarding',()=>{
 for(const phrase of ['同一组纸片','固定位置','同一个工作台','成功后，工具','原来的纸片还在','没有实际作用的按钮','单一位置']) {
  assert.ok(!Object.values(copy.zh).some(value=>value.includes(phrase)),phrase);
 }
 assert.ok(!html.includes('class="instructions"'));
 assert.ok(!html.includes('preview-footer-row'));
 assert.equal((html.match(/id="demo-disclosure"/g)||[]).length,1);
 assert.ok(js.includes("let selectedRecipe = 'focus'"));
});
test('native-like visual metrics have a dedicated app font and compact capsule geometry',()=>{
 assert.ok(css.includes('--capsule-body-height:30px'));
 assert.ok(css.includes('--capsule-hit-height:44px'));
 assert.ok(css.includes('--app-chrome:'));
 assert.ok(css.includes('border-radius:16px;box-shadow:0 2px 14px'));
 assert.ok(css.includes('appearance:none;-webkit-appearance:none'));
 assert.ok(css.includes('@media (forced-colors:active)'));
});
