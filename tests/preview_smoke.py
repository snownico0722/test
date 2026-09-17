"""Run the exact offline bundle in a browser WITH its own CSP intact.
This is not file:// or HTTP navigation and does not validate the modular homepage CSP.
"""
from pathlib import Path
import json
from playwright.sync_api import sync_playwright,expect
from browser_smoke import ROOT,launch,rest,INTERVAL_PROBE

def run():
    html=(ROOT/'preview.html').read_text(encoding='utf-8')
    assert "connect-src 'none'" in html and 'http-equiv="Content-Security-Policy"' in html
    rows=[]
    with sync_playwright() as pw:
        browser=launch(pw)
        for lang in ['en','zh']:
            c=browser.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce',accept_downloads=True)
            p=c.new_page();errors=[];violations=[];p.on('pageerror',lambda e:errors.append(str(e)))
            p.evaluate(INTERVAL_PROBE);p.set_content(html,wait_until='load');rest(p)
            p.evaluate("window.__csp=[];document.addEventListener('securitypolicyviolation',e=>__csp.push(e.violatedDirective))")
            if lang=='zh':p.locator('#language').click()
            expect(p.locator('html')).to_have_attribute('lang','zh-CN' if lang=='zh' else 'en')
            p.locator('#note-paper [data-action="fold"]').click();rest(p);p.locator('#todo-body .task-link').click();rest(p)
            expect(p.locator('#note-paper')).to_be_visible();assert p.locator('[data-capsule="note"]').count()==0
            p.locator('#navigation a[href="#studio"]').click();rest(p)
            p.locator('[data-recipe="focus"]').click();p.locator('#build').click();rest(p,650)
            expect(p.locator('#maker')).to_be_hidden();p.locator('[data-capsule="plugin"]').click();rest(p)
            p.locator('#live-plugin .widget-actions button').first.click();rest(p,1100)
            expect(p.locator('.timer-digits')).not_to_have_text('25:00',timeout=3500)
            assert p.locator('#source-details,#download-demo,#prompt,textarea').count()==0
            assert not p.evaluate('__csp') and not errors,(errors,p.evaluate('__csp'))
            rows.append({'language':lang,'status':'PASS','checks':['linked note without edge capsule','preset maker success','single tool capsule','timer','removed export and input controls'],'csp_intact':True})
            c.close()
        version=browser.version;browser.close()
    result={'mode':'EXACT_OFFLINE_BUNDLE_WITH_CSP','browser':version,'passed':len(rows),'results':rows,'limitations':'set_content of the intact bundle, not HTTP/file navigation or modular homepage CSP'}
    (ROOT/'evidence/preview.json').write_text(json.dumps(result,indent=2));print(json.dumps(result,ensure_ascii=False))
if __name__=='__main__':run()
