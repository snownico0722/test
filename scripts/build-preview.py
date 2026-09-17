"""Bundle the source homepage as a dependency-free offline preview.

The website's primary entry remains website/index.html with native modules over HTTP.
This bundle does not count as HTTP/module-loading acceptance.
"""
from pathlib import Path
import argparse, base64, re
ROOT=Path(__file__).resolve().parents[1]

def bundle(destination:Path):
    html=(ROOT/'website/index.html').read_text(encoding='utf-8')
    css=(ROOT/'website/assets/playground.css').read_text(encoding='utf-8')
    code=[]
    for name in ['plugin-core.mjs','story-core.mjs','copy.mjs','motion.mjs','playground.mjs']:
        source=(ROOT/'website/assets'/name).read_text(encoding='utf-8')
        source=re.sub(r'^import .*?;\s*$','',source,flags=re.M)
        source=re.sub(r'\bexport (?=(?:const|let|function|class)\b)','',source)
        code.append(source)
    script='(() => {\n'+'\n'.join(code)+'\n})();'
    # A JS string containing an exported HTML script tag must not end this outer script.
    script=re.sub(r'</script',r'<\\/script',script,flags=re.I)
    html=re.sub(r'[ \t]*<script\b[^>]*>[\s\S]*?</script>','',html)
    html=html.replace('<link rel="stylesheet" href="assets/playground.css">','<style>\n'+css+'\n</style>')
    icon=base64.b64encode((ROOT/'website/assets/mark.svg').read_bytes()).decode('ascii')
    html=html.replace('href="assets/mark.svg"','href="data:image/svg+xml;base64,'+icon+'"')
    thumbnail=ROOT/'website/assets/share-workbench.jpg'
    if thumbnail.exists():
        image=base64.b64encode(thumbnail.read_bytes()).decode('ascii')
        html=html.replace('content="assets/share-workbench.jpg"','content="data:image/jpeg;base64,'+image+'"')
    html=re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>',
        '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; script-src \'unsafe-inline\'; style-src \'unsafe-inline\'; img-src data:; connect-src \'none\'; object-src \'none\'; base-uri \'none\'; form-action \'none\'">',html)
    html=html.replace('</body>','<script>\n'+script+'\n</script>\n</body>')
    destination.parent.mkdir(parents=True,exist_ok=True)
    destination.write_text(html,encoding='utf-8')
    print(destination)

if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('destination',nargs='?',type=Path,default=ROOT/'preview.html')
    bundle(parser.parse_args().destination)
