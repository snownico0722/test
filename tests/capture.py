"""Capture five real page regions in two languages at desktop and phone widths.

Default: real HTTP pages. PAPER_DEMO_IN_MEMORY=1 explicitly records DOM_ONLY.
The share image is a crop of the final page screenshot, not a design mockup.
"""
from pathlib import Path
import json
import os
import shutil
import subprocess
import sys
from playwright.sync_api import sync_playwright, expect
from browser_loader import ROOT, MODE, load_page
from browser_smoke import server, visit, studio_build

OUT = ROOT / 'evidence' / 'screenshots'
OUT.mkdir(parents=True, exist_ok=True)
PROFILES = {'desktop': {'width': 1440, 'height': 1000}, 'mobile': {'width': 390, 'height': 844}}

def capture(profile, language):
    rows=[]
    with server() as base, sync_playwright() as p:
        executable=os.environ.get('CHROMIUM_PATH') or shutil.which('chromium')
        browser=p.chromium.launch(executable_path=executable)
        context=browser.new_context(viewport=PROFILES[profile],has_touch=profile=='mobile',reduced_motion='reduce')
        page=context.new_page()
        errors=[]; page.on('pageerror',lambda error: errors.append(str(error)))
        load_page(page,language,base)
        # Reduced-motion preference stops presentation timers without changing the page.
        for name,anchor in [('overview','overview'),('capsules','capsules'),('markdown','markdown'),('scripts','scripts'),('plugins','studio')]:
            visit(page,anchor)
            if name=='capsules':
                page.locator('[data-action=fold-all]').click()
                page.locator('[data-action=preview-todo]').click()
                active=page.locator('#desktop-scene' if profile=='desktop' else '[data-scene=capsules]')
                expect(active.locator('.preview-card')).to_be_visible()
            elif name=='markdown':
                page.locator('[data-mode=full]').click()
            elif name=='scripts':
                page.locator('#script-editor [data-script=fold]').first.click()
                page.locator('#lightning').click()
            elif name=='plugins':
                studio_build(page,'做一个 12 分钟的番茄钟' if language=='zh' else 'Make a 12-minute focus timer')
            page.mouse.move(1,1)
            page.wait_for_timeout(160)
            # Capsule hover state must stay visible for the evidence capture.
            if name=='capsules':
                page.locator('[data-action=preview-todo]').click()
            filename=f'{profile}-{language}-{name}.png'
            if profile=='mobile' or name in ['scripts','plugins']:
                page.locator('#'+anchor).screenshot(path=str(OUT/filename),animations='disabled')
            else:
                # Shared sticky stage lives outside the textual chapter element.
                page.screenshot(path=str(OUT/filename),animations='disabled')
            rows.append({'file':filename,'region':name,'profile':profile,'language':language,'viewport':PROFILES[profile]})
        assert not errors, errors
        browser.close()
    (OUT/f'{profile}-{language}.json').write_text(json.dumps(rows,indent=2))


def main():
    if len(sys.argv)==3:
        capture(sys.argv[1],sys.argv[2]); return
    for profile in PROFILES:
        for language in ['en','zh']:
            subprocess.run([sys.executable,__file__,profile,language],check=True)
    rows=[]
    for file in sorted(OUT.glob('*.json')):
        if file.name!='index.json': rows.extend(json.loads(file.read_text()))
    report={'mode':'DOM_ONLY' if MODE else 'HTTP','screenshots':rows,'native_desktop_app_screenshots':False}
    (OUT/'index.json').write_text(json.dumps(report,indent=2))
    from PIL import Image
    image=Image.open(OUT/'desktop-en-overview.png').convert('RGB')
    # Keep headline, controls and actual rendered papers; crop only blank outer margins.
    image=image.crop((0,60,1440,816)).resize((1200,630),Image.Resampling.LANCZOS)
    image.save(ROOT/'website/assets/share-preview.jpg',quality=78,optimize=True)
    print(f"Saved {len(rows)} screenshots ({report['mode']}) and share-preview.jpg")

if __name__=='__main__': main()
