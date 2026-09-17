"""Real Chromium interaction checks. HTTP by default, explicit DOM fixture opt-in.
Run from the repository root: python tests/browser_smoke.py
"""
from contextlib import contextmanager
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from threading import Thread
from urllib.parse import urlsplit
import json
import os
import shutil
import sys
import subprocess
import traceback
import time

from playwright.sync_api import sync_playwright, expect
from browser_loader import ROOT, MODE, load_page

EVIDENCE = ROOT / 'evidence'
EVIDENCE.mkdir(exist_ok=True)
RESULTS = []
BASE = ''

class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT / 'website'), **kwargs)
    def log_message(self, *_):
        pass
    def translate_path(self, path):
        if path.startswith('/nested/test/'):
            path = path[len('/nested/test') :]
        return super().translate_path(path)

@contextmanager
def server():
    httpd = ThreadingHTTPServer(('127.0.0.1', 0), Handler)
    thread = Thread(target=httpd.serve_forever, daemon=True)
    thread.start()
    try:
        yield f'http://127.0.0.1:{httpd.server_port}/'
    finally:
        httpd.shutdown()
        httpd.server_close()

def visit(page, anchor):
    page.locator(f'#{anchor}').evaluate("el => window.scrollTo({top:scrollY+el.getBoundingClientRect().top-parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav')),behavior:'instant'})")
    page.wait_for_timeout(100)

def click_language(page):
    # Physical pointer input avoids Chromium's scrollIntoView-on-sticky-header quirk.
    box=page.locator('#language').bounding_box()
    assert box and 0 <= box['y'] < page.viewport_size['height']
    page.mouse.click(box['x']+box['width']/2,box['y']+box['height']/2)

def click(scene, action, paper=None):
    selector = f'[data-action="{action}"]' + (f'[data-paper="{paper}"]' if paper else '')
    scene.locator(selector).first.click()

def studio_build(page, prompt=None):
    visit(page, 'studio')
    if prompt is not None:
        page.locator('#prompt').fill(prompt)
    page.locator('#build').click()
    expect(page.locator('#plugin-preview')).to_be_visible()
    expect(page.locator('#pipeline')).to_have_attribute('aria-busy','false')

def state_persistence(page):
    scene = page.locator('#desktop-scene')
    scene.locator('[data-title=todo]').fill('My 自定义 title')
    scene.locator('[data-task-text=t2]').fill('Do not replace <my text>')
    scene.locator('[data-task=t3]').check()
    scene.locator('[data-draft=todo]').fill('Unsubmitted text')
    click(scene,'edit-note','note')
    text = '# My 笔记\n\n- [ ] Keep me\n\nA personal paragraph.'
    scene.locator('[data-note-input=note]').fill(text)
    click(scene,'fold','note')
    expect(scene.locator('[data-id=note]')).to_be_hidden()
    visit(page,'markdown')
    expect(scene.locator('[data-id=note]')).to_be_visible()
    expect(scene.locator('[data-note-input=note]')).to_have_value(text)
    click_language(page)
    expect(scene.locator('[data-note-input=note]')).to_have_value(text)
    click(scene,'edit-note','note')
    page.locator('[data-mode=full]').click()
    scene.locator('[data-md-check="2"]').check()
    assert page.evaluate('document.activeElement.dataset.key') == 'md:note:2'
    visit(page,'overview')
    expect(scene.locator('[data-id=note]')).to_be_hidden()
    expect(scene.locator('[data-title=todo]')).to_have_value('My 自定义 title')
    expect(scene.locator('[data-task-text=t2]')).to_have_value('Do not replace <my text>')
    expect(scene.locator('[data-task=t3]')).to_be_checked()
    expect(scene.locator('[data-draft=todo]')).to_have_value('Unsubmitted text')
    page.set_viewport_size({'width':390,'height':844})
    mobile = page.locator('[data-scene=overview]')
    mobile.scroll_into_view_if_needed()
    expect(mobile.locator('[data-task=t3]')).to_be_checked()
    expect(mobile.locator('[data-draft=todo]')).to_have_value('Unsubmitted text')
    mobile.locator('[data-capsule=note]').click()
    click(mobile,'open','note')
    click(mobile,'edit-note','note')
    expect(mobile.locator('[data-note-input=note]')).to_have_value(text.replace('- [ ]','- [x]'))

def capsule_preview_queue(page):
    visit(page,'capsules')
    page.locator('[data-action=fold-all]').click()
    scene=page.locator('#desktop-scene')
    expect(scene.locator('.paper:visible')).to_have_count(0)
    scene.locator('[data-capsule=todo]').hover()
    expect(scene.locator('.preview-card')).to_be_visible()
    scene.locator('.preview-card [data-task=t2]').check()
    assert page.evaluate('document.activeElement.dataset.key') == 'preview-check:todo:t2'
    page.keyboard.press('Escape')
    expect(scene.locator('.preview-card')).to_have_count(0)
    assert page.evaluate('document.activeElement.dataset.key') == 'capsule:todo'
    page.mouse.move(10,500)
    click(scene,'queue')
    expect(scene.locator('.queue-items')).to_be_hidden()
    click(scene,'queue')
    expect(scene.locator('.queue-items')).to_be_visible()
    first=scene.locator('[data-capsule]').first.get_attribute('data-capsule')
    click(scene,'reorder')
    assert scene.locator('[data-capsule]').first.get_attribute('data-capsule') != first
    click(scene,'side')
    expect(scene).to_have_attribute('data-side','left')
    scene.locator('[data-capsule=todo]').focus()
    page.keyboard.press('Enter')
    expect(scene.locator('.preview-card [data-task=t2]')).to_be_checked()
    click(scene,'open','todo')
    expect(scene.locator('[data-id=todo]')).to_be_visible()
    expect(scene.locator('[data-id=note]')).to_be_hidden()
    expect(scene.locator('[data-id=todo] [data-task=t2]')).to_be_checked()

def markdown_modes(page):
    visit(page,'markdown'); scene=page.locator('#desktop-scene')
    page.locator('[data-mode=off]').click()
    expect(scene.locator('[data-id=note] pre')).to_contain_text('# A little space')
    page.locator('[data-mode=basic]').click()
    assert scene.locator('.basic-heading').count() == 2
    page.locator('[data-mode=full]').click()
    expect(scene.locator('[data-md-check]')).to_have_count(3)
    scene.locator('[data-md-check="6"]').check()
    click_language(page)
    expect(scene.locator('[data-md-check="6"]')).to_be_checked()
    expect(scene.locator('[data-id=note] h3')).to_contain_text('给想法')
    page.locator('[data-mode=off]').click()
    expect(scene.locator('[data-id=note] pre')).to_contain_text('- [x] 试试胶囊悬停预览')
    visit(page,'capsules'); visit(page,'markdown')
    expect(page.locator('[data-mode=off]')).to_have_attribute('aria-pressed','true')
    click(scene,'external','note')
    expect(page.locator('#dialog')).to_be_visible()
    expect(page.locator('#dialog-text')).to_contain_text('系统关联程序')
    page.keyboard.press('Escape')
    expect(page.locator('#dialog')).not_to_be_visible()
    assert page.evaluate('document.activeElement.dataset.key') == 'external:note'

def drag_add_reset(page):
    scene=page.locator('#desktop-scene'); grip=scene.locator('[data-drag=todo]')
    b=grip.bounding_box(); page.mouse.move(b['x']+b['width']/2,b['y']+b['height']/2)
    page.mouse.down(); page.mouse.move(b['x']+220,b['y']+145,steps=8); page.mouse.up()
    position=scene.locator('[data-id=todo]').evaluate('(n)=>({left:parseFloat(n.style.left),top:parseFloat(n.style.top)})')
    assert position['left']>30 and position['top']>60
    grip.focus(); page.keyboard.press('Shift+ArrowLeft')
    assert scene.locator('[data-id=todo]').evaluate('(n)=>parseFloat(n.style.left)') < position['left']
    before=scene.locator('[data-id=todo]').get_attribute('style')
    scene.locator('[data-task-text=t2]').fill('typing does not drag')
    page.keyboard.press('ArrowRight')
    assert scene.locator('[data-id=todo]').get_attribute('style') == before
    for i in range(9):
        scene.locator('[data-draft=todo]').fill(f'Additional task {i}')
        scene.locator('[data-add-task=todo] button').click()
    expect(scene.locator('[data-id=todo] .todo-row')).to_have_count(12)
    expect(scene.locator('[data-add-task=todo] button')).to_be_disabled()
    for _ in range(5):
        scene.locator('.scene-bottom [data-action=new-todo]').click()
    expect(scene.locator('.paper')).to_have_count(6)
    expect(page.locator('#toast')).to_contain_text('six papers')
    click(scene,'reset'); page.locator('#dialog-cancel').click()
    expect(scene.locator('.paper')).to_have_count(6)
    click(scene,'reset'); page.locator('#dialog-confirm').click()
    expect(scene.locator('.paper')).to_have_count(2)
    expect(scene.locator('[data-task=t3]')).not_to_be_checked()

def script_flow(page):
    visit(page,'scripts')
    page.locator('#script-editor [data-script=fold]').first.click()
    expect(page.locator('#lightning')).to_be_visible()
    page.locator('#lightning').click(button='right')
    expect(page.locator('#script-editor')).to_be_visible()
    page.locator('#script-editor [data-script=fold]').first.click()
    page.locator('#lightning').click()
    expect(page.locator('#script-result')).to_be_visible()
    click_language(page)
    expect(page.locator('#script-result')).to_be_visible()
    expect(page.locator('#script-result')).to_contain_text('演示结果')
    page.locator('#script-result [data-script=run]').click()
    expect(page.locator('#script-result')).to_contain_text('Hello, PaperTodo.')
    page.locator('#script-result [data-script=back]').click()
    expect(page.locator('#script-editor')).to_be_visible()
    assert len(page.context.pages) == 1

def timer_instances(page):
    studio_build(page,'Make a 12-minute timer')
    preview=page.locator('#plugin-preview')
    expect(preview.locator('.timer-digits')).to_have_text('12:00')
    preview.get_by_role('button',name='Start',exact=True).click()
    expect(preview.locator('.timer-digits')).not_to_have_text('12:00',timeout=2500)
    preview.get_by_role('button',name='Pause',exact=True).click()
    paused=preview.locator('.timer-digits').inner_text()
    click_language(page); page.wait_for_timeout(1100)
    expect(preview.locator('.timer-digits')).to_have_text(paused)
    expect(page.locator('#prompt')).to_have_value('Make a 12-minute timer')
    page.locator('#source-tab').click()
    expect(page.locator('#source-code')).to_contain_text('"minutes":12')
    page.locator('#preview-tab').click()
    expect(preview.locator('.timer-digits')).to_have_text(paused)
    page.locator('#install').click(); page.locator('#install').click()
    cards=page.locator('.tool-paper')
    expect(cards).to_have_count(2)
    cards.nth(0).get_by_role('button',name='开始',exact=True).click()
    expect(cards.nth(0).locator('.timer-digits')).not_to_have_text('12:00',timeout=2500)
    expect(cards.nth(1).locator('.timer-digits')).to_have_text('12:00')
    cards.nth(0).locator('[data-tool-fold]').click()
    expect(cards.nth(0).locator('.tool-body')).to_be_hidden()
    cards.nth(0).locator('[data-tool-fold]').click()
    cards.nth(0).locator('[data-tool-remove]').click()
    expect(cards).to_have_count(1)
    preview.get_by_role('button',name='重置',exact=True).click()
    expect(preview.locator('.timer-digits')).to_have_text('12:00')

def recipes_cancel_export(page):
    studio_build(page,'Make a habit tracker: Read, Walk')
    preview=page.locator('#plugin-preview')
    preview.locator('input[type=checkbox]').first.check()
    page.emulate_media(reduced_motion='no-preference')
    page.locator('[data-recipe=focus]').click(); page.locator('#build').click(); page.locator('#cancel-build').click()
    page.wait_for_timeout(850)
    expect(preview.locator('input[type=checkbox]').first).to_be_checked()
    expect(page.locator('#build-status')).to_contain_text('Cancelled')
    page.emulate_media(reduced_motion='reduce')
    payload='Make a checklist: <img src=x onerror=alert(1)>, Keep me'
    page.locator('#prompt').fill(payload); page.locator('#build').click()
    expect(page.locator('#pipeline')).to_have_attribute('aria-busy','false')
    expect(preview.locator('input[type=checkbox]')).to_have_count(2)
    assert preview.locator('img').count() == 0
    preview.locator('input[type=checkbox]').first.check()
    add=preview.locator('form input'); add.fill('My custom 新任务'); add.press('Enter')
    expect(preview.locator('input[type=checkbox]')).to_have_count(3)
    click_language(page)
    expect(preview).to_contain_text('My custom 新任务')
    expect(preview.locator('input[type=checkbox]').first).to_be_checked()
    expect(page.locator('#prompt')).to_have_value(payload)
    page.locator('#source-tab').click(); source=page.locator('#source-code').inner_text()
    assert '<img src=x onerror=' not in source
    with page.expect_download() as download_info:
        page.locator('#download-demo').click()
    saved=EVIDENCE/'exported-checklist.html'; download_info.value.save_as(str(saved))
    assert saved.read_text() == source
    exported=page.context.new_page(); exported.set_content(source,wait_until='domcontentloaded')
    expect(exported.locator('input[type=checkbox]')).to_have_count(2)
    exported.locator('input[type=checkbox]').first.check()
    expect(exported.locator('input[type=checkbox]').first).to_be_checked()
    assert exported.locator('img').count()==0
    exported.close()

def auto_lifecycle(page):
    page.emulate_media(reduced_motion='no-preference')
    visit(page,'markdown')
    before=page.locator('[data-mode][aria-pressed=true]').get_attribute('data-mode')
    page.wait_for_timeout(2450)
    after=page.locator('[data-mode][aria-pressed=true]').get_attribute('data-mode')
    assert before != after
    page.evaluate("Object.defineProperty(document,'hidden',{configurable:true,get:()=>true}); document.dispatchEvent(new Event('visibilitychange'))")
    page.wait_for_timeout(2500)
    assert page.locator('[data-mode][aria-pressed=true]').get_attribute('data-mode') == after
    page.evaluate("delete document.hidden; document.dispatchEvent(new Event('visibilitychange'))")
    page.locator('[data-mode=full]').click()
    visit(page,'capsules'); visit(page,'markdown'); page.wait_for_timeout(2450)
    expect(page.locator('[data-mode=full]')).to_have_attribute('aria-pressed','true')
    expect(page.locator('#desktop-scene [data-action=auto]')).to_have_attribute('aria-pressed','false')

def native_themes_and_pin(page):
    scene=page.locator('#desktop-scene')
    click(scene,'pin','todo')
    expect(scene.locator('[data-id=todo]')).to_have_attribute('data-pinned','true')
    expect(scene.locator('[data-action=pin][data-paper=todo]')).to_have_attribute('aria-pressed','true')
    # Bringing a normal note forward must not put it above the pinned paper.
    scene.locator('[data-title=note]').fill('A normal note')
    todo_z=scene.locator('[data-id=todo]').evaluate('n=>Number(getComputedStyle(n).zIndex)')
    note_z=scene.locator('[data-id=note]').evaluate('n=>Number(getComputedStyle(n).zIndex)')
    assert todo_z>note_z
    expected={'warm':['rgb(255, 249, 234)','rgb(33, 31, 28)'], 'ink':['rgb(246, 247, 249)','rgb(26, 28, 32)'], 'forest':['rgb(243, 248, 241)','rgb(26, 30, 27)'], 'rose':['rgb(253, 245, 246)','rgb(33, 28, 30)']}
    for palette, values in expected.items():
        scene.locator(f'[data-palette-select={palette}]').click()
        for dark, expected_bg in enumerate(values):
            if scene.get_attribute('data-dark')!=str(bool(dark)).lower(): click(scene,'theme')
            color=scene.locator('[data-id=todo]').evaluate('n=>getComputedStyle(n).backgroundColor')
            assert color==expected_bg,(palette,dark,color)
            assert page.locator('.themed').evaluate_all('(nodes)=>nodes.every(n=>n.dataset.palette===nodes[0].dataset.palette && n.dataset.dark===nodes[0].dataset.dark)')
    click_language(page)
    expect(scene.locator('[data-id=todo]')).to_have_attribute('data-pinned','true')
    click(scene,'pin','todo')
    expect(scene.locator('[data-id=todo]')).to_have_attribute('data-pinned','false')

def fold_targets_and_interrupts(page):
    scene=page.locator('#desktop-scene')
    # Test the destination rather than relying only on a screenshot of an animation.
    page.emulate_media(reduced_motion='no-preference')
    grip=scene.locator('[data-drag=todo]'); grip.focus(); page.keyboard.press('Shift+ArrowRight')
    click(scene,'fold','todo')
    metrics=page.evaluate("""() => {
      const ghost=document.querySelector('.motion-ghost');
      if(!ghost)return null;
      const frames=ghost.getAnimations()[0].effect.getKeyframes();
      const matrix=new DOMMatrix(frames.at(-1).transform);
      const to=document.querySelector('#desktop-scene [data-capsule=todo]').getBoundingClientRect();
      return {x:parseFloat(ghost.style.left)+matrix.e,y:parseFloat(ghost.style.top)+matrix.f,w:parseFloat(ghost.style.width)*matrix.a,h:parseFloat(ghost.style.height)*matrix.d,tx:to.left,ty:to.top,tw:to.width,th:to.height};
    }""")
    assert metrics is not None,'The fold should have a live animation.'
    for name,target in [('x','tx'),('y','ty'),('w','tw'),('h','th')]: assert abs(metrics[name]-metrics[target])<1,(name,metrics)
    page.set_viewport_size({'width':1280,'height':1000})
    expect(page.locator('.motion-ghost')).to_have_count(0)
    page.emulate_media(reduced_motion='reduce')
    for _ in range(4):
        scene.locator('[data-capsule=todo]').focus(); page.keyboard.press('Enter')
        click(scene,'open','todo'); click(scene,'fold','todo')
    scene.locator('[data-capsule=todo]').focus(); page.keyboard.press('Enter'); click(scene,'open','todo')
    expect(scene.locator('[data-id=todo]')).to_be_visible()
    page.set_viewport_size({'width':1024,'height':1000})
    bounds=scene.locator('[data-id=todo]').bounding_box(); canvas=scene.locator('.scene-canvas').bounding_box()
    assert bounds['x']>=canvas['x'] and bounds['x']+bounds['width']<=canvas['x']+canvas['width']+1
    assert bounds['y']>=canvas['y'] and bounds['y']+bounds['height']<=canvas['y']+canvas['height']+1
    expect(page.locator('.motion-ghost')).to_have_count(0)

def responsive(page, width, lang):
    assert page.evaluate('document.documentElement.scrollWidth') <= width+1
    assert page.locator('html').get_attribute('lang') == ('zh-CN' if lang=='zh' else 'en')
    if width<781:
        page.locator('#menu-toggle').click()
        expect(page.locator('#navigation')).to_be_visible()
        page.keyboard.press('Escape')
        expect(page.locator('#navigation')).not_to_be_visible()
    visit(page,'capsules'); page.locator('[data-action=preview-todo]').click()
    scene=page.locator('#desktop-scene' if width>=960 else '[data-scene=capsules]')
    expect(scene.locator('.preview-card')).to_be_visible()
    box=scene.locator('.preview-card').bounding_box(); assert box['x']>=0 and box['x']+box['width']<=width+1
    visit(page,'markdown'); page.locator('[data-mode=full]').click()
    md=page.locator('#desktop-scene' if width>=960 else '[data-scene=markdown]')
    md.locator('[data-id=note]').scroll_into_view_if_needed()
    # Check that the folded queue cannot cover the reading toolbar.
    assert not md.locator('.capsule-rail').is_visible()
    for b in md.locator('[data-id=note] .paper-header button:visible').all():
        box=b.bounding_box(); parent=md.locator('[data-id=note]').bounding_box()
        assert box['x']+box['width']<=parent['x']+parent['width']+1
    visit(page,'scripts'); page.locator('#script-editor [data-script=fold]').first.click(); page.locator('#lightning').click()
    expect(page.locator('#script-result')).to_be_visible()
    studio_build(page)
    expect(page.locator('#plugin-preview .timer-digits')).to_have_text('25:00')
    page.locator('#install').click()
    expect(page.locator('.tool-paper')).to_have_count(1)
    page.locator('#faq summary').first.click()
    expect(page.locator('#faq details').first).to_have_attribute('open','')
    assert page.evaluate('document.documentElement.scrollWidth')<=width+1
    if width>=960:
        cols=page.locator('.feature-grid').evaluate('n=>getComputedStyle(n).gridTemplateColumns.split(" ").length')
        assert cols==2
    assert page.locator('#features article').count()==6 and page.locator('#faq details').count()==5
    for a in page.locator('a[href^="#"]').all():
        href=a.get_attribute('href')
        if href!='#': assert page.locator(href).count()==1,href

CASES=[('native palette values, complete themes and canvas pin semantics',native_themes_and_pin),('fold targets after movement, resize interruption and repeated actions',fold_targets_and_interrupts),('session state across language, chapters and resize',state_persistence),('interactive preview, keyboard recovery and queue operations',capsule_preview_queue),('Markdown levels and external editor explanation',markdown_modes),('pointer/keyboard dragging, limits and reset consent',drag_add_reset),('script folding, replay and return without execution',script_flow),('timer controls and independent canvas instances',timer_instances),('templates, cancellation, custom text and actual export',recipes_cancel_export),('auto-demo lifecycle gates (synthetic visibility event)',auto_lifecycle)]

def main():
    global BASE
    group = sys.argv[sys.argv.index('--group')+1] if '--group' in sys.argv else 'all'
    if group == 'all':
        # Fresh browser processes bound font/cache memory and isolate each test batch.
        for batch in ['interactions','layout-en','layout-zh']:
            result = subprocess.run([sys.executable,__file__,'--group',batch],check=False)
            if result.returncode: return result.returncode
        reports=[json.loads((EVIDENCE/f"browser-{'dom' if MODE else 'http'}-{batch}.json").read_text()) for batch in ['interactions','layout-en','layout-zh']]
        combined=dict(reports[0]); combined['results']=[r for report in reports for r in report['results']]; combined['passed']=sum(r['passed'] for r in reports); combined['total']=sum(r['total'] for r in reports)
        (EVIDENCE/f"browser-{'dom' if MODE else 'http'}.json").write_text(json.dumps(combined,ensure_ascii=False,indent=2)); print(json.dumps({k:v for k,v in combined.items() if k!='results'},indent=2)); return 0
    with server() as BASE, sync_playwright() as p:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        browser=p.chromium.launch(executable_path=executable, args=['--no-sandbox'] if os.geteuid()==0 else []) if hasattr(os,'geteuid') else p.chromium.launch(executable_path=executable)
        version=browser.version
        # Fail explicitly rather than quietly substituting DOM mode for an HTTP failure.
        probe=browser.new_page()
        try:
            load_page(probe,base_url=BASE)
            if not MODE:
                load_page(probe,'zh',BASE+'nested/test/')
                expect(probe.locator('html')).to_have_attribute('lang','zh-CN')
        except Exception as error:
            report={'mode':'DOM_ONLY' if MODE else 'HTTP','browser':version,'status':'BLOCKED_OR_LOAD_FAILED','error':str(error),'passed':0}
            (EVIDENCE/'browser-http.json').write_text(json.dumps(report,indent=2))
            print(json.dumps(report,indent=2)); browser.close(); return 2
        probe.close()
        cases=CASES+[(f'layout and key flows {width}px {lang}',lambda pg,w=width,l=lang:responsive(pg,w,l),width,lang) for width in [320,390,430,768,1024,1440,1920] for lang in ['en','zh']]
        # A short desktop window reflows to readable mobile scenes instead of clipping the sticky stage.
        cases += [('short-height desktop, effective zoom reflow',lambda pg:responsive(pg,720,'en'),720,'en',450)]
        if group == 'interactions': cases=cases[:len(CASES)]
        elif group in ['layout-en','layout-zh']: cases=[case for case in cases[len(CASES):] if len(case)>3 and case[3]==group[-2:]]
        else: raise ValueError('Unknown group: '+group)
        for case in cases:
            print('RUN',case[0],time.strftime('%H:%M:%S'),flush=True)
            name,run=case[:2]; width=case[2] if len(case)>2 else 1440; lang=case[3] if len(case)>3 else 'en'; height=case[4] if len(case)>4 else 1000 if width>=960 else 844
            context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<960,reduced_motion='reduce',accept_downloads=True)
            page=context.new_page(); errors=[]; page.on('pageerror',lambda error:errors.append(str(error)))
            page.set_default_timeout(5000)
            try:
                load_page(page,lang,BASE); run(page)
                assert not errors,errors
                RESULTS.append({'name':name,'status':'PASS'})
                print('PASS',name,flush=True)
            except Exception as error:
                RESULTS.append({'name':name,'status':'FAIL','error':str(error),'traceback':traceback.format_exc(),'console_errors':errors})
                print('FAIL',name,traceback.format_exc(),flush=True)
                try: page.screenshot(path=str(EVIDENCE/f'failure-{len(RESULTS)}.png'),timeout=5000)
                except Exception: pass
            finally:
                context.close()
        browser.close()
    report={'mode':'DOM_ONLY' if MODE else 'HTTP','browser':version,'http_module_loading':'NOT_TESTED' if MODE else 'PASS_ROOT_AND_SUBPATH','status':'PASS' if all(r['status']=='PASS' for r in RESULTS) else 'FAIL','passed':sum(r['status']=='PASS' for r in RESULTS),'total':len(RESULTS),'results':RESULTS}
    (EVIDENCE/f"browser-{'dom' if MODE else 'http'}-{group}.json").write_text(json.dumps(report,ensure_ascii=False,indent=2))
    print(json.dumps({k:v for k,v in report.items() if k!='results'},indent=2))
    return 0 if report['status']=='PASS' else 1

if __name__=='__main__':
    sys.exit(main())
