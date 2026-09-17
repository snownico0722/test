import test from 'node:test';
import assert from 'node:assert/strict';
import {createStoryState,dockPapers,setPluginConfig,layoutEdgeQueue} from '../website/assets/story-core.mjs';
import {readFileSync} from 'node:fs';
const html=readFileSync(new URL('../website/index.html',import.meta.url),'utf8');
test('100 replacements keep the linked note out of the four-slot queue',()=>{
 const s=createStoryState();
 for(let i=0;i<100;i++){
   setPluginConfig(s,{type:i%2?'focus':'converter',minutes:12,items:null});
   assert.deepEqual(dockPapers(s).map(p=>p.id),['todo','maker','script','plugin']);
   assert.equal(s.papers.length,3);assert.equal(s.pluginRevision,i+1);
 }
});
test('all four preview positions fit bounded desktops and touch layouts',()=>{
 const ids=['todo','maker','script','plugin'];
 for(const [compact,gap] of [[30,12],[44,4]])for(const room of [280,360,470,650,820]){
  let session=null;
  for(const owner of [...ids,...ids.toReversed(),...ids]){
   session=layoutEdgeQueue(ids,owner,session,room,278,compact,gap);
   for(let i=0;i<ids.length;i++){
    const h=ids[i]===owner?session.height:compact;
    assert.ok(session.tops[i]>=0 && session.tops[i]+h<=room);
    if(i<ids.length-1)assert.ok(session.tops[i]+h+gap<=session.tops[i+1]);
   }
  }
 }
});
test('only four actual paper surfaces expose resize handles',()=>{
 assert.equal((html.match(/class="paper-resize"/g)||[]).length,4);
 assert.equal((html.match(/data-resize="e"/g)||[]).length,4);
 assert.equal((html.match(/data-resize="s"/g)||[]).length,4);
 assert.equal((html.match(/data-resize="se"/g)||[]).length,4);
});
test('script folding uses the existing sidebar, not a sixth floating capsule',()=>{
 assert.ok(!html.includes('id="script-capsule-stage"'));
 assert.ok(!html.includes('id="master-capsule"'));
 assert.ok(html.includes('id="queue-toggle"'));
 assert.ok(html.includes('id="script-output" role="status"'));
});
