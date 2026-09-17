"""Final browser screenshots. HTTP by default; explicit DOM_ONLY never proves HTTP/CSP.
Use --profile WIDTHxHEIGHT-LANG to capture one batch in constrained environments.
"""
from pathlib import Path
from io import BytesIO
import json,argparse
from PIL import Image
from playwright.sync_api import sync_playwright,expect
from browser_loader import ROOT,MODE,load_page
from browser_smoke import server,launch,go,make,rest
OUT=ROOT/'evidence'/'screenshots-final';OUT.mkdir(parents=True,exist_ok=True)
PROFILES=['1440x900-en','1440x900-zh','390x844-en','390x844-zh']

def capture(profile):
    size,lang=profile.split('-');width,height=map(int,size.split('x'));records=[]
    with server() as base,sync_playwright() as pw:
        browser=launch(pw);context=browser.new_context(viewport={'width':width,'height':height},has_touch=width<500,reduced_motion='reduce')
        page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
        load_page(page,lang,base);rest(page)
        for view in ['overview','edge-preview','markdown','script','maker','tool-edge','tool-preview','tool-open']:
            if view=='overview':go(page,'overview')
            elif view=='edge-preview':
                go(page,'capsules');page.locator('[data-action="preview-todo"]').click()
            elif view=='markdown':go(page,'markdown');page.locator('[data-mode="full"]').click()
            elif view=='script':
                go(page,'scripts');page.locator('#script-next').click()
            elif view=='maker':go(page,'studio')
            elif view=='tool-edge':make(page);rest(page,3100)
            elif view=='tool-preview':page.locator('[data-capsule="plugin"]').focus();page.keyboard.press('ArrowLeft')
            elif view=='tool-open':page.locator('#preview-open').click()
            page.mouse.move(1,1);rest(page,150)
            filename=f'{profile}-{view}.png'
            if width<500:
                page.evaluate('window.scrollTo({top:0,behavior:"instant"})');rest(page,100)
                r=page.locator('#desktop-scene').bounding_box()
                image=Image.open(BytesIO(page.screenshot(full_page=True,animations='disabled')))
                # Include current chapter text AND the one workbench; long screenshot is deliberate.
                story=page.locator('#story').bounding_box();y=max(0,int(story['y'])-5)
                image.crop((0,y,width,int(r['y']+r['height']+50))).save(OUT/filename)
            else:page.screenshot(path=str(OUT/filename),animations='disabled')
            records.append({'file':filename,'view':view,'viewport':[width,height],'language':lang,'mode':'DOM_ONLY' if MODE else 'HTTP'})
        assert not errors,errors;version=browser.version;context.close();browser.close()
    (OUT/f'{profile}.json').write_text(json.dumps({'mode':'DOM_ONLY' if MODE else 'HTTP','browser':version,'screenshots':records},indent=2))
    print(profile, len(records),'screenshots',flush=True)
    if profile=='1440x900-en':
        image=Image.open(OUT/f'{profile}-overview.png').convert('RGB')
        image.crop((0,64,1440,820)).resize((1200,630),Image.Resampling.LANCZOS).save(ROOT/'website/assets/share-workbench.jpg',quality=85,optimize=True)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('--profile',choices=PROFILES);args=parser.parse_args()
    for profile in ([args.profile] if args.profile else PROFILES):capture(profile)
