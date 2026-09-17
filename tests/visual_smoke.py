"""Visual contracts for the new chrome and copy; same explicit HTTP/DOM fixture."""
import json
from playwright.sync_api import sync_playwright, expect
from browser_smoke import ROOT, server, launch, rest, go
from browser_loader import MODE, load_page

def run():
    rows=[]
    with server() as base, sync_playwright() as pw:
        browser=launch(pw)
        for lang,touch in [('en',False),('zh',False),('en',True),('zh',True)]:
            c=browser.new_context(viewport={'width':390 if touch else 1440,'height':844 if touch else 900},has_touch=touch,is_mobile=touch,reduced_motion='reduce')
            p=c.new_page();errors=[];p.on('pageerror',lambda e:errors.append(str(e)))
            load_page(p,lang,base);rest(p)
            geometry=p.evaluate('''()=>{
              const css=n=>getComputedStyle(n), slot=document.querySelector('.edge-slot'), master=document.querySelector('#queue-toggle');
              const pseudo=getComputedStyle(slot,'::before');
              return {slot:slot.getBoundingClientRect().height, paint:parseFloat(pseudo.height)+(pseudo.boxSizing==='border-box'?0:parseFloat(pseudo.borderTopWidth)+parseFloat(pseudo.borderBottomWidth)),
                beforeHeight:getComputedStyle(slot,'::before').height,
                beforeTop:getComputedStyle(slot,'::before').top,
                master:master.getBoundingClientRect().width,
                radius:css(document.querySelector('#todo-paper')).borderRadius,
                checkboxRadius:css(document.querySelector('#todo-body input')).borderRadius};
            }''')
            assert geometry['radius']=='16px',geometry
            assert geometry['checkboxRadius']=='4px',geometry
            assert geometry['master']<=44,geometry
            assert p.locator('[data-capsule]').count()==3
            assert p.locator('[data-capsule="todo"]').bounding_box()['width']==104
            assert geometry['slot']==(44 if touch else 30),geometry
            assert geometry['paint']==30,geometry
            assert p.locator('#todo-body .task-text').first.inner_text() not in ['task1','task2','task3']
            palettes={'warm':('rgb(255, 249, 234)','rgb(33, 31, 28)'), 'ink':('rgb(246, 247, 249)','rgb(26, 28, 32)'), 'forest':('rgb(243, 248, 241)','rgb(26, 30, 27)'), 'rose':('rgb(253, 245, 246)','rgb(33, 28, 30)')}
            for palette,(light,dark) in palettes.items():
                p.locator(f'[data-palette-choice="{palette}"]').click()
                assert p.locator('#todo-paper').evaluate('n=>getComputedStyle(n).backgroundColor')==light
                p.locator('#dark-toggle').press('End')
                assert p.locator('#todo-paper').evaluate('n=>getComputedStyle(n).backgroundColor')==dark
                p.locator('#dark-toggle').press('Home')
            p.locator('[data-palette-choice="warm"]').click()
            go(p,'capsules');p.locator('[data-action="preview-todo"]').click();rest(p)
            title=p.locator('#preview-title').bounding_box();count=p.locator('#preview-count').bounding_box()
            assert 0<=count['x']-(title['x']+title['width'])<=9,(title,count)
            assert p.locator('.preview-footer-row').count()==0
            p.locator('#preview-body [data-task="t2"]').check()
            p.locator('#preview-close').click();rest(p)
            expect(p.locator('#todo-body [data-task="t2"]')).to_be_checked()
            go(p,'studio');assert p.locator('#maker textarea').count()==0
            expect(p.locator('[data-recipe="focus"]')).to_have_attribute('aria-pressed','true')
            assert p.locator('#pipeline').is_hidden()
            p.locator('[data-recipe="habits"]').click();p.locator('#language').click()
            expect(p.locator('[data-recipe="habits"]')).to_have_attribute('aria-pressed','true')
            assert p.locator('#recipe-description').inner_text()
            assert p.locator('#demo-disclosure').count()==1
            p.emulate_media(forced_colors='active');go(p,'overview')
            p.locator('#todo-body [data-task="t3"]').check()
            assert p.locator('#todo-body [data-task="t3"]').evaluate('n=>getComputedStyle(n).appearance')=='auto'
            assert not errors,errors
            rows.append({'language':lang,'touch':touch,'status':'PASS','geometry':geometry})
            c.close()
        version=browser.version;browser.close()
    result={'mode':'DOM_ONLY' if MODE else 'HTTP','browser':version,'passed':len(rows),'checks':['compact sidebar toggle','30px visible capsules / 44px touch targets','16px paper corners','custom accessible checkboxes','title + inline count','no preview footer','real translated tasks','preset-only maker','language keeps selected recipe','forced colors','four palettes in light/dark'],'results':rows}
    (ROOT/'evidence/visual-contracts.json').write_text(json.dumps(result,indent=2,ensure_ascii=False));print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':run()
