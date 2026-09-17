"""Check static bytes through HTTP, not browser execution or CSP acceptance."""
from pathlib import Path
import hashlib,json
from urllib.request import urlopen
from browser_smoke import server,ROOT

paths=['index.html','assets/playground.css','assets/playground.mjs','assets/story-core.mjs',
       'assets/motion.mjs','assets/plugin-core.mjs','assets/copy.mjs','assets/mark.svg','assets/share-workbench.jpg','robots.txt']
records=[]
with server() as base:
    for prefix in ['', 'nested/test/']:
        for path in paths:
            address=base+prefix+('' if path=='index.html' else path)
            with urlopen(address,timeout=10) as response:
                body=response.read();original=(ROOT/'website'/path).read_bytes()
                assert response.status==200 and body==original,(address,response.status)
                records.append({'path':'/'+prefix+path,'status':response.status,'type':response.headers['Content-Type'],
                    'bytes':len(body),'sha256':hashlib.sha256(body).hexdigest()})
report={'mode':'HTTP_ASSET_BYTES_ONLY','status':'PASS','requests':records,
        'limitations':'HTTP server bytes match source at root and subpath. No browser navigation, execution, CSS application, or CSP validation is performed.'}
(ROOT/'evidence').mkdir(exist_ok=True)
(ROOT/'evidence/http-asset-bytes.json').write_text(json.dumps(report,indent=2))
print(f'{len(records)} HTTP byte checks passed (not browser acceptance).')
