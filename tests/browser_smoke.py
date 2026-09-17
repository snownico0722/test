"""Real HTTP by default. Explicit PAPER_DEMO_IN_MEMORY=1 never qualifies as HTTP/CSP.

Motion cases use actual mouse/keyboard/touch input at normal animation speed, record
presented rectangles each requestAnimationFrame, and optionally record browser video.
"""
from pathlib import Path
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
from contextlib import contextmanager
from threading import Thread
import argparse,json,os,shutil,time,traceback,subprocess,sys
from playwright.sync_api import sync_playwright,expect
from browser_loader import load_page, MODE
ROOT=Path(__file__).resolve().parents[1]
EVIDENCE=ROOT/'evidence';EVIDENCE.mkdir(exist_ok=True)
@contextmanager
def server():
    class Handler(SimpleHTTPRequestHandler):
        def __init__(self,*args,**kw):super().__init__(*args,directory=str(ROOT/'website'),**kw)
        def do_GET(self):
            if self.path.startswith('/nested/test/'):self.path='/'+self.path[len('/nested/test/'):]
            super().do_GET()
        def log_message(self,*args):pass
    http=ThreadingHTTPServer(('127.0.0.1',0),Handler);thread=Thread(target=http.serve_forever,daemon=True);thread.start()
    try:yield f'http://127.0.0.1:{http.server_port}/'
    finally:http.shutdown();http.server_close()
def launch(pw):
    args={'headless':True};exe=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
    if exe:args['executable_path']=exe
    return pw.chromium.launch(**args)
INTERVAL_PROBE="""(()=>{const set=window.setInterval.bind(window),clear=window.clearInterval.bind(window);window.__activeIntervals=new Set();window.setInterval=(...a)=>{let h=set(...a);__activeIntervals.add(h);return h;};window.clearInterval=h=>{__activeIntervals.delete(h);return clear(h);};})();"""
def rest(p,ms=420):p.wait_for_timeout(ms)
def go(p,chapter):
    p.locator(f'[data-chapter-link="{chapter}"]' if p.viewport_size['width']<980 else f'#navigation a[href="#{chapter}"]').click()
    expect(p.locator('#desktop-scene')).to_have_attribute('data-chapter',chapter);rest(p,650)
def make(p,recipe='focus'):
    if p.locator('#desktop-scene').get_attribute('data-chapter')!='studio':go(p,'studio')
    if p.locator('#maker').is_hidden():p.locator('#make-again').click();rest(p)
    p.locator(f'[data-recipe="{recipe}"]').click();p.locator('#build').click()
    expect(p.locator('#desktop-scene')).to_have_attribute('data-view','plugins');rest(p,600)
    expect(p.locator('[data-capsule="plugin"]')).to_be_visible();expect(p.locator('#plugin-paper')).to_be_visible()
    expect(p.locator('#todo-paper')).to_be_hidden();expect(p.locator('#note-paper')).to_be_hidden()
def desktop(p):
    p.locator('[data-capsule="plugin"]').click();rest(p)
def identity(p):
    return p.evaluate('__original.every(n=>n.isConnected) && __original[0]===document.querySelector("#desktop-scene") && document.querySelectorAll("#live-plugin").length<=1')
def assert_bounds(p):
    assert p.evaluate('document.documentElement.scrollWidth<=innerWidth+1'),'horizontal overflow'
    assert p.locator('.scene-canvas').count()==1
    scene=p.locator('#desktop-scene').bounding_box();assert scene and scene['width']>250
    if p.viewport_size['width']>=980:
        assert scene['y']>=50 and scene['y']+scene['height']<=p.viewport_size['height']-20,scene
    for sel in ['#todo-paper','#note-paper','#plugin-paper','#maker','#script-editor','#script-result','#preview-card','.edge-slot']:
        for loc in p.locator(sel).all():
            if loc.is_visible():
                r=loc.bounding_box();assert r['x']>=scene['x']-1 and r['x']+r['width']<=scene['x']+scene['width']+1,(sel,r,scene)
    assert identity(p)
def initial(p):
    for sel in ['#todo-paper','#note-paper','[data-capsule="todo"]']:expect(p.locator(sel)).to_be_visible()
    assert p.locator('[data-capsule="note"]').count()==0
    assert p.locator('[data-capsule="todo"] .capsule-title').inner_text()==p.locator('#todo-title').inner_text()
    assert_bounds(p)
def linked(p):
    p.locator('#note-paper [data-action="fold"]').click();rest(p)
    expect(p.locator('#note-paper')).to_be_hidden();assert p.locator('[data-capsule="note"]').count()==0
    p.locator('#todo-body .task-link').click();rest(p);expect(p.locator('#note-paper')).to_be_visible();assert identity(p)
def preview(p):
    p.locator('#todo-paper [data-action="fold"]').click();rest(p,550)
    p.locator('[data-capsule="todo"]').hover();rest(p)
    expect(p.locator('#preview-card')).to_be_visible()
    assert p.locator('#preview-card').evaluate('n=>n.parentElement.dataset.edgeSlot')=='todo'
    p.locator('#preview-body [data-task="t2"]').check();expect(p.locator('#todo-body [data-task="t2"]')).to_be_checked()
    p.locator('#preview-body .task-link').click();rest(p);expect(p.locator('#note-paper')).to_be_visible()
    rest(p,450);p.locator('[data-capsule="todo"]').hover();rest(p)
    # Clicking the text opens the paper; only its checkbox checks the item.
    p.locator('#preview-body .task-text').last.click();rest(p)
    expect(p.locator('#todo-paper')).to_be_visible();expect(p.locator('#todo-body [data-task="t3"]')).not_to_be_checked()
    p.mouse.move(620,150);rest(p,500);p.locator('[data-capsule="todo"]').hover();rest(p)
    p.mouse.move(610,790);rest(p,450);expect(p.locator('#preview-card')).to_be_hidden()
def dragging(p):
    header=p.locator('#todo-paper .paper-header');r=header.bounding_box();before=p.locator('#todo-paper').bounding_box()
    p.mouse.move(r['x']+90,r['y']+17);p.mouse.down();p.mouse.move(r['x']+145,r['y']+75,steps=12);p.mouse.up()
    after=p.locator('#todo-paper').bounding_box();assert after['x']>before['x']+20 and after['y']>before['y']+40,(before,after)
    header.focus();p.keyboard.press('Shift+ArrowDown');p.keyboard.press('ArrowLeft');after=p.locator('#todo-paper').bounding_box()
    p.locator('#todo-paper [data-action="fold"]').click();rest(p);p.locator('[data-capsule="todo"]').click();rest(p)
    r=p.locator('#todo-paper').bounding_box();assert abs(r['x']-after['x'])<1 and abs(r['y']-after['y'])<1
    go(p,'markdown');go(p,'overview');r=p.locator('#todo-paper').bounding_box();assert abs(r['x']-after['x'])<1,(r,after)
    assert_bounds(p)
def queue(p):
    initial(p);p.locator('#queue-toggle').click();rest(p);expect(p.locator('[data-edge-slot="todo"]')).to_be_hidden()
    expect(p.locator('#todo-paper')).to_be_visible();p.locator('#queue-toggle').click();rest(p);initial(p)
    for chapter in ['capsules','markdown','scripts','studio','overview']:
        go(p,chapter);expect(p.locator('[data-capsule="todo"]')).to_be_visible();assert p.locator('[data-capsule="note"]').count()==0
        assert_bounds(p)
def markdown(p):
    go(p,'markdown');p.locator('[data-mode="full"]').click();rest(p)
    p.locator('#note-body [data-md-check]').nth(1).check();p.locator('#language').click();rest(p)
    expect(p.locator('#note-body [data-md-check]').nth(1)).to_be_checked()
    p.locator('[data-mode="off"]').click();assert '- [x]' in p.locator('#note-body').inner_text()
    assert p.locator('#note-body pre,#note-body code').count()==0
    assert p.locator('#note-body .plain-note').evaluate('n=>getComputedStyle(n).backgroundColor')=='rgba(0, 0, 0, 0)'
    go(p,'overview');go(p,'markdown');expect(p.locator('[data-mode="off"]')).to_have_attribute('aria-pressed','true')
def scripts(p):
    go(p,'scripts')
    cycle=p.locator('#script-next')
    assert p.locator('#scripts .actions button').count()==1
    cycle.click();rest(p);expect(p.locator('#script-result')).to_be_visible()
    cycle.click();rest(p);expect(p.locator('#script-editor')).to_be_visible()
    cycle.click();cycle.click();rest(p)
    expect(p.locator('#script-editor')).to_be_visible()
    expect(p.locator('#script-result')).to_be_hidden()
    p.locator('#script-editor [data-script="fold"]').click();rest(p);expect(p.locator('#lightning')).to_be_visible()
    p.locator('#lightning').click();rest(p);expect(p.locator('#script-result')).to_be_visible()
    p.locator('#script-result [data-script="back"]').click();rest(p);expect(p.locator('#script-editor')).to_be_visible()
    assert identity(p);assert_bounds(p)
def tool(p):
    make(p);p.evaluate('window.__tool=document.querySelector("#live-plugin")')
    p.locator('[data-capsule="plugin"]').hover();rest(p);p.locator('#live-plugin .widget-actions button').first.click();rest(p,1200)
    assert p.locator('#live-plugin .timer-digits').inner_text()!='25:00'
    p.locator('#preview-open').click();rest(p);assert p.evaluate('__tool===document.querySelector("#plugin-home>#live-plugin")')
    p.locator('#plugin-paper [data-action="fold"]').click();rest(p)
    go(p,'capsules');expect(p.locator('[data-capsule="plugin"]')).to_be_visible();assert p.evaluate('__tool.isConnected')
    p.locator('[data-capsule="plugin"]').click();rest(p);assert p.locator('#live-plugin .timer-digits').inner_text()!='25:00'
    assert p.evaluate('__activeIntervals.size')==1

def replace(p):
    make(p);p.evaluate('window.__old=document.querySelector("#live-plugin")')
    p.locator('#make-again').click();rest(p);assert p.locator('#maker textarea').count()==0
    p.locator('[data-recipe="focus"]').click();p.locator('#build').click();p.locator('#cancel-build').click();rest(p,1600)
    assert p.evaluate('__old.isConnected && __activeIntervals.size===1')
    # Force a renderer failure, not a model failure: transaction must preserve the old slot.
    p.evaluate("""(()=>{const original=document.createElement.bind(document);document.createElement=(tag,...a)=>{if(tag==='section'){document.createElement=original;throw new Error('test renderer failure');}return original(tag,...a);};})()""")
    p.locator('#build').click();rest(p,1700);expect(p.locator('#prompt-error')).not_to_be_empty();assert p.evaluate('__old.isConnected && __activeIntervals.size===1')
    p.locator('[data-recipe="converter"]').click();p.locator('#build').click();expect(p.locator('#maker')).to_be_hidden();rest(p)
    assert p.evaluate('!__old.isConnected && __activeIntervals.size===0');assert p.locator('[data-capsule="plugin"]').count()==1
    p.locator('[data-capsule="plugin"]').click();rest(p)
    p.locator('#live-plugin .converter-input').fill('2');p.locator('#language').click();expect(p.locator('#live-plugin .converter-input')).to_have_value('2')
    assert p.locator('#tool-title').inner_text()==p.locator('[data-capsule="plugin"] .capsule-title').inner_text()

def preset_only(p):
    make(p,'converter')
    assert p.locator('#source-details,#download-demo,#prompt,textarea,[contenteditable]').count()==0
    assert p.locator('a[href*="CodexCliBridge"]').count()==0
    desktop(p);p.locator('#live-plugin .converter-input').fill('0.3048')
    expect(p.locator('#live-plugin .converter-output')).to_have_text('1 ft')

def keyboard(p):
    cap=p.locator('[data-capsule="todo"]');cap.focus();p.keyboard.press('ArrowLeft');rest(p);expect(p.locator('#preview-open')).to_be_focused()
    p.keyboard.press('Escape');rest(p);expect(cap).to_be_focused()
    p.keyboard.press('Enter');rest(p);expect(p.locator('#todo-paper .paper-header')).to_be_focused()
    go(p,'studio');p.locator('[data-recipe="focus"]').press('Enter')
    expect(p.locator('#desktop-scene')).to_have_attribute('data-chapter','studio')
    p.locator('#build').press('Enter');expect(p.locator('#desktop-scene')).to_have_attribute('data-view','plugins')
    rest(p);assert p.evaluate('document.getAnimations().every(a=>a.effect.getComputedTiming().duration<=1)')

def touch(p):
    cap=p.locator('[data-capsule="todo"]');long_press(p,cap);expect(p.locator('#preview-card')).to_be_visible()
    p.locator('#preview-body [data-task="t2"]').tap();expect(p.locator('#todo-body [data-task="t2"]')).to_be_checked()
    p.locator('#preview-body .task-link').tap();rest(p);expect(p.locator('#note-paper')).to_be_visible()
    h=p.locator('#todo-paper .paper-header');h.scroll_into_view_if_needed();r=h.bounding_box();old=p.locator('#todo-paper').bounding_box()
    session=p.context.new_cdp_session(p);x=r['x']+70;y=r['y']+20
    session.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for d in [10,25,45]:session.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x,'y':y+d}]})
    session.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});session.detach()
    new=p.locator('#todo-paper').bounding_box();assert new['y']>old['y']+30,(old,new)
    make(p);p.locator('[data-capsule="plugin"]').tap();rest(p);expect(p.locator('#plugin-paper')).to_be_visible();assert_bounds(p)

FRAME_PROBE="""(()=>{window.__frames=[];const generation=window.__frameGeneration=(window.__frameGeneration||0)+1;let stop=performance.now()+1600;const tick=t=>{if(window.__frameGeneration!==generation)return;const c=document.querySelector('#workbench-canvas').getBoundingClientRect();let nodes=[...document.querySelectorAll('#paper-deck>.paper,#maker,#script-editor,#script-result,.edge-slot')].filter(n=>!n.hidden);__frames.push({t,canvas:{x:c.x,y:c.y,w:c.width,h:c.height},nodes:nodes.map(n=>{const r=n.getBoundingClientRect();return {id:n.id||n.dataset.edgeSlot,x:r.x-c.x,y:r.y-c.y,w:r.width,h:r.height,opacity:Number(getComputedStyle(n).opacity),moving:n.dataset.moving||''};})});if(t<stop)requestAnimationFrame(tick);};requestAnimationFrame(tick);})();"""
def sample(p,action,name,ms=560):
    p.evaluate(FRAME_PROBE);action();rest(p,ms);frames=p.evaluate('__frames');
    (EVIDENCE/'frames').mkdir(exist_ok=True);(EVIDENCE/'frames'/f'{name}.json').write_text(json.dumps(frames,indent=1))
    assert len(frames)>=5, len(frames)
    for fr in frames:
        for r in fr['nodes']:
            if r['opacity']>.02:
                assert r['x']>=-2 and r['x']+r['w']<=fr['canvas']['w']+2,(name,r,fr['canvas'])
    return frames

def motion_case(p):
    r=p.locator('#desktop-scene').bounding_box();initial_height=r['height']
    frames=sample(p,lambda:p.locator('#todo-paper [data-action="fold"]').click(),'fold')
    widths=[n['w'] for fr in frames for n in fr['nodes'] if n['id']=='todo-paper' and n['moving']]
    assert len(widths)>3 and max(widths)-min(widths)>120,widths
    sample(p,lambda:p.locator('[data-capsule="todo"]').click(),'unfold');expect(p.locator('#todo-paper')).to_be_visible()
    rest(p,450)
    frames=sample(p,lambda:p.locator('[data-capsule="todo"]').hover(),'preview-open')
    slots=[(fr,n) for fr in frames for n in fr['nodes'] if n['id']=='todo']
    assert any(170<n['w']<325 for _,n in slots),slots
    assert all(abs(n['x']+n['w']-fr['canvas']['w'])<2 for fr,n in slots),'edge detaches while resizing'
    sample(p,lambda:p.mouse.move(580,600),'preview-retract');expect(p.locator('#preview-card')).to_be_hidden()
    for name in ['markdown','scripts','studio','overview']:
        sample(p,lambda name=name:go(p,name),'chapter-'+name,100)
        assert abs(p.locator('#desktop-scene').bounding_box()['height']-initial_height)<1
    assert identity(p)

def transfer(p):
    make(p);p.locator('[data-capsule="todo"]').hover();rest(p)
    r=p.locator('[data-edge-slot="plugin"]').bounding_box();a=p.locator('[data-edge-slot="script"]').bounding_box();assert r['y']>=a['y']+a['height']+7
    # Cross the actual narrow corridor before entering the next member.
    x=r['x']+r['width']-30;p.mouse.move(x,a['y']+a['height']+5);rest(p,180);expect(p.locator('#preview-card')).to_be_visible()
    sample(p,lambda:p.mouse.move(x,r['y']+20),'preview-transfer-down')
    assert p.locator('#preview-card').evaluate('n=>n.parentElement.dataset.edgeSlot')=='plugin'
    p.locator('#live-plugin .widget-actions button').first.click();rest(p,1100)
    sample(p,lambda:p.locator('[data-capsule="todo"]').hover(),'preview-transfer-up')
    assert p.locator('#preview-card').evaluate('n=>n.parentElement.dataset.edgeSlot')=='todo'
    p.mouse.move(580,600);rest(p,450)
    expected=p.evaluate('parseFloat(getComputedStyle(document.querySelector("#desktop-scene")).getPropertyValue("--capsule-hit-height"))+parseFloat(getComputedStyle(document.querySelector("#desktop-scene")).getPropertyValue("--capsule-gap"))')
    assert abs(p.locator('[data-edge-slot="plugin"]').bounding_box()['y']-p.locator('[data-edge-slot="todo"]').bounding_box()['y']-3*expected)<1
    assert p.evaluate('__activeIntervals.size')==1

def interruption(p):
    # Real mouse clicks avoid Playwright's animation-stability wait during reversal.
    p.locator('#todo-paper .paper-header').focus();p.keyboard.press('PageDown');rest(p,100)
    p.keyboard.press('PageDown');rest(p,90);p.keyboard.press('PageUp');rest(p,80);p.keyboard.press('PageUp');rest(p,1300)
    expect(p.locator('#desktop-scene')).to_have_attribute('data-chapter','overview');initial(p)
    for _ in range(3):
        b=p.locator('#todo-paper [data-action="fold"]').bounding_box();p.mouse.click(b['x']+b['width']/2,b['y']+b['height']/2);rest(p,65)
        cap=p.locator('[data-capsule="todo"]').bounding_box();p.mouse.click(cap['x']+20,cap['y']+cap['height']/2);rest(p,90)
    rest(p,450);expect(p.locator('#todo-paper')).to_be_visible();assert p.locator('[data-moving]').count()==0;assert_bounds(p)

def build_motion(p):
    go(p,'studio');p.locator('[data-recipe="focus"]').click()
    p.locator('#queue-toggle').click();rest(p)  # success must reveal its new side slot
    p.locator('#build').click();rest(p,1020)
    frames=sample(p,lambda:None,'tool-arrival',850)
    expect(p.locator('#maker')).to_be_hidden();expect(p.locator('[data-capsule="plugin"]')).to_be_visible()
    assert p.locator('#plugin-paper').is_visible() and p.locator('#todo-paper').is_hidden() and p.locator('#note-paper').is_hidden()
    assert any(n['id']=='plugin-paper' and n['moving']=='in' for f in frames for n in f['nodes']), 'no moving tool on success'
    p.locator('[data-capsule="plugin"]').hover();rest(p)
    p.locator('#live-plugin .widget-actions button').first.click();rest(p,900)
    p.locator('#preview-open').click();rest(p)
    p.locator('#plugin-paper [data-action="fold"]').click();rest(p,500)
    p.evaluate('window.__old=document.querySelector("#live-plugin")')
    p.locator('#make-again').click();rest(p);p.locator('[data-recipe="converter"]').click();p.locator('#build').click();rest(p,650)
    assert p.evaluate('__old.isConnected && __activeIntervals.size===1')
    rest(p,1000);assert p.evaluate('!__old.isConnected && __activeIntervals.size===0')
    assert p.locator('[data-capsule="plugin"]').count()==1;assert identity(p);assert_bounds(p)

def moved_return(p):
    h=p.locator('#todo-paper .paper-header').bounding_box()
    p.mouse.move(h['x']+90,h['y']+15);p.mouse.down();p.mouse.move(h['x']+142,h['y']+75,steps=18);p.mouse.up()
    original=p.locator('#todo-paper').bounding_box()
    frames=sample(p,lambda:p.locator('#todo-paper [data-action="fold"]').click(),'moved-fold')
    cap=p.locator('[data-capsule="todo"]').bounding_box()
    samples=[(f,n) for f in frames for n in f['nodes'] if n['id']=='todo-paper' and n['moving']=='out']
    f,n=samples[-1];assert abs(n['x']+f['canvas']['x']-cap['x'])<3 and abs(n['y']+f['canvas']['y']-cap['y'])<3
    sample(p,lambda:p.locator('[data-capsule="todo"]').click(),'moved-unfold')
    now=p.locator('#todo-paper').bounding_box();assert abs(now['x']-original['x'])<1 and abs(now['y']-original['y'])<1
    p.set_viewport_size({'width':1280,'height':720});rest(p,500);assert_bounds(p)
    p.locator('#todo-paper [data-action="fold"]').click();rest(p,65)
    p.emulate_media(reduced_motion='reduce');rest(p,80);assert p.locator('[data-moving]').count()==0
    p.locator('[data-capsule="todo"]').click();rest(p);assert_bounds(p)

def scrolling(p):
    seen=[];p.mouse.move(560,350)
    for chapter in ['capsules','markdown','scripts','studio','scripts','markdown','capsules','overview']:
        box=p.locator('#'+chapter).bounding_box()
        p.mouse.wheel(0,box['y']-p.viewport_size['height']*.4)
        rest(p,650);expect(p.locator('#desktop-scene')).to_have_attribute('data-chapter',chapter)
        seen.append(chapter);assert identity(p)
    assert seen[-1]=='overview'
    expect(p.locator('#todo-paper')).to_be_visible();expect(p.locator('#note-paper')).to_be_visible()

def layout(p):
    initial(p);h=p.locator('#desktop-scene').bounding_box()['height']
    for c in ['capsules','markdown','scripts','studio']:
        go(p,c);assert_bounds(p);assert abs(p.locator('#desktop-scene').bounding_box()['height']-h)<1
    make(p);assert_bounds(p)
    for loc in p.locator('.capsule-title').all():
        assert loc.is_visible() and loc.inner_text();assert loc.evaluate('n=>getComputedStyle(n).opacity')=='1'
    p.locator('[data-capsule="plugin"]').focus();p.keyboard.press('ArrowLeft');rest(p);assert_bounds(p)
    p.locator('#preview-open').click();rest(p);assert_bounds(p)
    p.locator('#plugin-paper [data-action="fold"]').click();rest(p);p.locator('#language').click();rest(p);assert_bounds(p)
    assert p.locator('[data-capsule="plugin"] .capsule-title').inner_text()==p.locator('#tool-title').inner_text()

def long_press(p,loc):
    loc.scroll_into_view_if_needed();r=loc.bounding_box();x=r['x']+30;y=r['y']+r['height']/2
    cd=p.context.new_cdp_session(p)
    cd.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]});rest(p,500)
    cd.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cd.detach();rest(p,850)

def resize_contract(p):
    paper=p.locator('#todo-paper');before=paper.bounding_box();r=paper.locator('[data-resize="se"]').bounding_box()
    font=paper.locator('.task-text').first.evaluate('n=>getComputedStyle(n).fontSize')
    p.mouse.move(r['x']+r['width']/2,r['y']+r['height']/2);p.mouse.down();p.mouse.move(r['x']+r['width']/2+74,r['y']+r['height']/2+64,steps=14);p.mouse.up()
    grown=paper.bounding_box();assert grown['width']>=before['width']+70 and grown['height']>=before['height']+60,(before,grown)
    assert paper.locator('.task-text').first.evaluate('n=>getComputedStyle(n).fontSize')==font
    paper.locator('[data-resize="se"]').focus();p.keyboard.press('ArrowLeft');p.keyboard.press('ArrowUp');sized=paper.bounding_box()
    assert abs(sized['width']-grown['width']+8)<1 and abs(sized['height']-grown['height']+8)<1
    # Cancel a resize restores the last committed size, not the initial size.
    r=paper.locator('[data-resize="se"]').bounding_box();p.mouse.move(r['x']+10,r['y']+10);p.mouse.down();p.mouse.move(r['x']+40,r['y']+40,steps=5);p.keyboard.press('Escape');p.mouse.up()
    assert abs(paper.bounding_box()['width']-sized['width'])<1
    paper.locator('[data-action="fold"]').click();rest(p);p.locator('[data-capsule="todo"]').click();rest(p,1100)
    assert abs(paper.bounding_box()['width']-sized['width'])<1
    go(p,'markdown');go(p,'overview');p.locator('#language').click();rest(p)
    assert abs(paper.bounding_box()['width']-sized['width'])<1
    p.set_viewport_size({'width':1280,'height':720});rest(p);assert_bounds(p)
    p.set_viewport_size({'width':1440,'height':900});rest(p);assert abs(paper.bounding_box()['width']-sized['width'])<1
    # Real border resizing, bounded at the local workbench edge.
    r=paper.locator('[data-resize="e"]').bounding_box();p.mouse.move(r['x']+2,r['y']+12);p.mouse.down();p.mouse.move(1430,r['y']+12,steps=8);p.mouse.up();assert_bounds(p)

def sidebar_routes(p):
    ids=['todo','maker','script'];assert p.locator('[data-capsule]').evaluate_all('(ns)=>ns.map(n=>n.dataset.capsule)')==ids
    assert p.locator('.master-capsule').count()==0
    p.locator('#todo-body .task-link').click();rest(p);expect(p.locator('#note-paper')).to_be_visible()
    p.locator('[data-capsule="maker"]').click();rest(p,1100);expect(p.locator('#maker')).to_be_visible();assert p.locator('#maker textarea').count()==0
    p.locator('[data-capsule="script"]').click();rest(p,1100);expect(p.locator('#script-editor')).to_be_visible();expect(p.locator('#desktop-scene')).to_have_attribute('data-chapter','scripts')
    p.locator('[data-capsule="todo"]').click();rest(p,1100);expect(p.locator('#todo-paper')).to_be_visible()
    make(p);assert p.locator('[data-capsule]').count()==4
    p.evaluate('window.__firstTool=document.querySelector("#live-plugin")')
    p.locator('[data-capsule="maker"]').click();rest(p,1100);expect(p.locator('#maker')).to_be_visible();make(p,'habits')
    assert p.locator('[data-capsule]').count()==4 and p.locator('#live-plugin').count()==1 and p.evaluate('!__firstTool.isConnected')
    assert identity(p)

def script_play(p):
    run=p.locator('#lightning');assert run.evaluate('n=>n.closest("[data-edge-slot]").dataset.edgeSlot')=='script'
    run.click();expect(p.locator('#desktop-scene')).to_have_attribute('data-chapter','scripts')
    expect(p.locator('#script-result')).to_have_attribute('data-running','true')
    expect(run).to_be_disabled();expect(p.locator('#script-output')).to_have_text('Running…')
    rest(p,1000);expect(p.locator('#script-output')).to_have_text('Hello, PaperTodo.');expect(run).to_be_enabled()
    assert p.locator('#script-result [data-script="run"]').count()==0
    p.locator('#script-result [data-script="back"]').click();rest(p)
    p.locator('#script-editor .paper-header [data-script="run"]').click();rest(p,950)
    expect(p.locator('#script-result')).to_have_attribute('data-running','false');assert p.locator('[data-capsule]').count()==3
    p.locator('#script-result [data-script="close"]').click();rest(p);expect(p.locator('#script-result')).to_be_hidden()
    expect(p.locator('#script-editor')).to_be_hidden();expect(run).to_be_visible();assert p.locator('.script-capsule-stage').count()==0

def linked_note_state(p):
    b=p.locator('#note-body [data-md-check]').nth(1);b.check()
    linked(p);expect(p.locator('#note-body [data-md-check]').nth(1)).to_be_checked()
    go(p,'markdown');p.locator('[data-mode="full"]').click();expect(p.locator('#note-body [data-md-check]').nth(1)).to_be_checked()
    assert p.locator('[data-capsule="note"]').count()==0;assert identity(p)

def resize_motion(p):
    paper=p.locator('#todo-paper');r=paper.locator('[data-resize="se"]').bounding_box()
    p.mouse.move(r['x']+10,r['y']+10);p.mouse.down()
    def action():
        p.mouse.move(r['x']+90,r['y']+80,steps=22);p.mouse.up()
    frames=sample(p,action,'resize-drag',500)
    sizes=[n['w'] for f in frames for n in f['nodes'] if n['id']=='todo-paper'];assert max(sizes)-min(sizes)>60 and len(set(round(x) for x in sizes))>=5
    paper.locator('[data-action="fold"]').click();rest(p);sample(p,lambda:p.locator('[data-capsule="todo"]').click(),'resized-return',800)
    assert abs(paper.bounding_box()['width']-380)<2


def resize_remaining_papers(p):
    def shrink(selector):
        node=p.locator(selector);expect(node).to_be_visible();grip=node.locator('[data-resize="se"]');r=grip.bounding_box();before=node.bounding_box()
        x=r['x']+r['width']/2;y=r['y']+r['height']/2
        p.mouse.move(x,y);p.mouse.down();p.mouse.move(x-30,y-24,steps=9);p.mouse.up();after=node.bounding_box()
        assert abs(before['width']-after['width']-30)<1 and abs(before['height']-after['height']-24)<1,(selector,before,after)
        assert_bounds(p)
    shrink('#note-paper');go(p,'scripts');shrink('#script-editor');make(p);desktop(p);shrink('#plugin-paper')
    p.evaluate('window.__resizedTool=document.querySelector("#live-plugin")')
    p.locator('#plugin-paper [data-action="fold"]').click();rest(p);p.locator('[data-capsule="plugin"]').click();rest(p)
    assert p.evaluate('__resizedTool===document.querySelector("#live-plugin")')

def touch_resize(p):
    node=p.locator('#todo-paper');grip=node.locator('[data-resize="se"]');grip.scroll_into_view_if_needed();r=grip.bounding_box();before=node.bounding_box();scroll=p.evaluate('scrollY')
    x=r['x']+r['width']/2;y=r['y']+r['height']/2;cd=p.context.new_cdp_session(p)
    cd.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[{'x':x,'y':y}]})
    for delta in [8,16,24,32]:cd.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[{'x':x-delta,'y':y-delta}]})
    cd.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]});cd.detach()
    after=node.bounding_box();assert abs(before['width']-after['width']-32)<1 and abs(before['height']-after['height']-32)<1,(before,after)
    assert abs(p.evaluate('scrollY')-scroll)<1,'Resizing must not scroll the page'
    node.locator('[data-action="fold"]').tap();rest(p);p.locator('[data-capsule="todo"]').tap();rest(p)
    assert abs(node.bounding_box()['width']-after['width'])<1;assert_bounds(p)

def script_effect_motion(p):
    run=p.locator('#lightning');p.evaluate(FRAME_PROBE);run.click();rest(p,250)
    expect(p.locator('#script-result')).to_have_attribute('data-running','true');expect(run).to_be_disabled()
    assert p.locator('#script-output').inner_text()!='Hello, PaperTodo.'
    p.screenshot(path=str(EVIDENCE/'script-running.png'));rest(p,700)
    expect(p.locator('#script-result')).to_have_attribute('data-running','false');expect(run).to_be_enabled()
    expect(p.locator('#script-output')).to_have_text('Hello, PaperTodo.');p.screenshot(path=str(EVIDENCE/'script-complete.png'))
    frames=p.evaluate('__frames');(EVIDENCE/'frames').mkdir(exist_ok=True);(EVIDENCE/'frames'/'script-running-result.json').write_text(json.dumps(frames,indent=1))
    assert len(frames)>10;run.click();rest(p,80);expect(run).to_be_disabled();rest(p,850)
    expect(p.locator('#script-output')).to_have_text('Hello, PaperTodo.');assert identity(p);assert_bounds(p)

def markdown_geometry(p):
    normal=p.locator('#note-paper').bounding_box()
    go(p,'markdown');expanded=p.locator('#note-paper').bounding_box()
    assert expanded['width']>normal['width'] and expanded['height']>normal['height']
    go(p,'overview');restored=p.locator('#note-paper').bounding_box()
    assert abs(restored['width']-normal['width'])<1 and abs(restored['height']-normal['height'])<1
    go(p,'markdown');p.locator('#note-paper .paper-resize').press('ArrowRight');rest(p)
    manual=p.locator('#note-paper').bounding_box()
    expect(p.locator('#note-paper')).to_have_attribute('data-layout','manual')
    for chapter in ['capsules','markdown','overview']:
        go(p,chapter);current=p.locator('#note-paper').bounding_box()
        assert abs(current['width']-manual['width'])<1 and abs(current['height']-manual['height'])<1


def snap_exit(p):
    go(p,'studio');p.mouse.move(280,450);p.mouse.wheel(0,900);rest(p,800)
    assert p.evaluate('getComputedStyle(document.documentElement).scrollSnapType')=='none'
    before=p.evaluate('scrollY');p.mouse.wheel(0,220);rest(p,500)
    delta=p.evaluate('scrollY')-before
    assert 100<delta<300,delta
    go(p,'overview')
    assert p.evaluate('getComputedStyle(document.documentElement).scrollSnapType')=='y mandatory'


SCENARIOS=[('markdown-auto-manual-geometry',markdown_geometry),('snap-exit',snap_exit),('resize-other-papers',resize_remaining_papers),('resize-contract',resize_contract),('sidebar-routes',sidebar_routes),('script-direct-run',script_play),('linked-note-state',linked_note_state),('initial',initial),('linked-note',linked),('hover-actions',preview),('title-drag',dragging),('persistent-queue',queue),('markdown-state',markdown),('script-sequence',scripts),('live-tool-portals',tool),('transactional-replace',replace),('preset-only',preset_only),('keyboard-reduced-motion',keyboard)]
MOTIONS=[('script-effect-motion',script_effect_motion),('resize-motion',resize_motion),('continuous-surfaces',motion_case),('queue-transfers',transfer),('rapid-reversal',interruption),('build-and-replace-motion',build_motion),('dragged-fold-return',moved_return),('ordinary-reverse-scroll',scrolling)]
def run(group='all',record=False,selected=''):
    cases=[]
    if group in ['all','interaction']:
        cases += [(n,fn,(1440,900),'en',False,False,'') for n,fn in SCENARIOS]
        cases += [('touch-phone',touch,(390,844),'zh',True,False,''),('touch-resize',touch_resize,(390,844),'zh',True,False,'')]
    if group in ['all','motion']:cases += [(n,fn,(1440,900),'zh',False,True,'') for n,fn in MOTIONS]
    if group in ['all','layout']:
        for size in [(1440,900),(1366,768),(1280,720),(390,844),(320,568),(768,1024),(1024,768)]:
            for lang in ['en','zh']:cases.append((f'layout-{size[0]}x{size[1]}-{lang}',layout,size,lang,False,False,''))
    if group in ['all','http']:
        cases += [('root-HTTP',initial,(1440,900),'en',False,False,''),('nested-HTTP',initial,(1280,720),'zh',False,False,'nested/test/')]
    if selected:cases=[c for c in cases if c[0] in selected.split(',')]
    if MODE and group=='http':raise RuntimeError('HTTP group cannot use DOM fixture')
    if MODE:cases=[c for c in cases if 'HTTP' not in c[0]]
    report={'mode':'DOM_ONLY' if MODE else 'HTTP','group':group,'results':[],'limitations':['DOM fixture: no homepage HTTP/module-fetch/CSP acceptance'] if MODE else []}
    if not selected and len(cases)>1:
        for case in cases:
            args=[sys.executable,__file__,'--group',group,'--case',case[0]]+(['--record'] if record else [])
            result=subprocess.run(args,cwd=ROOT,timeout=60)
            child=EVIDENCE/f'browser-{report["mode"].lower()}-{group}-{case[0]}.json'
            if child.exists():
                part=json.loads(child.read_text());report['results'].extend(part['results']);report['browser']=part.get('browser')
            else:report['results'].append({'name':case[0],'status':'FAIL','error':'Child test did not produce a report'})
            if result.returncode:break
        report.update(passed=sum(r['status']=='PASS' for r in report['results']),failed=sum(r['status']=='FAIL' for r in report['results']),planned=len(cases))
        (EVIDENCE/f'browser-{report["mode"].lower()}-{group}.json').write_text(json.dumps(report,indent=2,ensure_ascii=False))
        print('TOTAL',json.dumps({k:report[k] for k in ['passed','failed','planned']}),flush=True)
        return 1 if report['failed'] else 0
    with server() as base,sync_playwright() as pw:
        for name,fn,size,lang,touch_mode,normal,suffix in cases:
            browser=launch(pw);report['browser']=browser.version
            errors=[];responses=[];start=time.monotonic()
            options=dict(viewport={'width':size[0],'height':size[1]},has_touch=touch_mode,is_mobile=touch_mode,reduced_motion='no-preference' if normal else 'reduce',accept_downloads=True)
            if record and normal:options.update(record_video_dir=str(EVIDENCE/'videos'),record_video_size={'width':size[0],'height':size[1]})
            c=browser.new_context(**options);c.add_init_script(INTERVAL_PROBE);p=c.new_page();p.set_default_timeout(7000)
            p.on('pageerror',lambda e:errors.append(str(e)));p.on('response',lambda r:responses.append({'url':r.url,'status':r.status}))
            try:
                if MODE:p.evaluate(INTERVAL_PROBE)
                load_page(p,lang,base+suffix);rest(p,80)
                p.evaluate('window.__original=[document.querySelector("#desktop-scene"),document.querySelector("#todo-paper"),document.querySelector("#note-paper")]')
                fn(p);assert not errors,errors
                if not MODE:
                    for path in ['playground.mjs','motion.mjs','story-core.mjs','plugin-core.mjs','copy.mjs','playground.css']:
                        assert any(r['url'].endswith(path) and r['status']==200 for r in responses),(path,responses)
                row={'name':name,'status':'PASS','seconds':round(time.monotonic()-start,2),'normal_motion':normal}
            except Exception as error:
                row={'name':name,'status':'FAIL','error':str(error),'console_errors':errors,'traceback':traceback.format_exc()}
                try:p.screenshot(path=str(EVIDENCE/f'failure-{name}.png'))
                except Exception:pass
            video=p.video;c.close()
            if video:row['video']=str(Path(video.path()).relative_to(ROOT))
            browser.close()
            report['results'].append(row);print(name,row['status'],row.get('error','')[:200],flush=True)
            if row['status']=='FAIL':break
    report.update(passed=sum(r['status']=='PASS' for r in report['results']),failed=sum(r['status']=='FAIL' for r in report['results']),planned=len(cases))
    path=EVIDENCE/f'browser-{report["mode"].lower()}-{group}{"-"+selected.replace(",","_") if selected else ""}.json';path.write_text(json.dumps(report,indent=2,ensure_ascii=False));print(json.dumps({k:report[k] for k in ['passed','failed','planned']}))
    return 1 if report['failed'] else 0
if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--group',choices=['all','interaction','layout','motion','http'],default='all');parser.add_argument('--record',action='store_true');parser.add_argument('--case',default='');a=parser.parse_args();raise SystemExit(run(a.group,a.record,a.case))
