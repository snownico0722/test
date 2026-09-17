"""Run normal HTTP checks by default; explicit DOM-only fixture for restricted hosts.

PAPER_DEMO_IN_MEMORY=1 does not navigate a URL, exercise CSP, or test module fetching.
It injects the same local source into about:blank and must never be reported as HTTP.
"""
from pathlib import Path
import os
import re

ROOT = Path(__file__).resolve().parents[1]
MODE = os.environ.get('PAPER_DEMO_IN_MEMORY') == '1'

def load_page(page, language='en', base_url='http://127.0.0.1:4173/'):
    if not MODE:
        page.goto(f'{base_url}?lang={language}', wait_until='networkidle')
        page.wait_for_selector('.scene-canvas:visible')
        return 'HTTP'
    html = (ROOT / 'website/index.html').read_text()
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]*>', '', html)
    html = re.sub(r'<script\b[^>]*>[\s\S]*?</script>', '', html)
    html = re.sub(r'<link\b[^>]*>', '', html)
    html = html.replace('<html lang="en">', f'<html lang="en" data-language="{language}">')
    css = (ROOT / 'website/assets/playground.css').read_text()
    html = html.replace('</head>', f'<style>{css}</style></head>')
    page.set_content(html, wait_until='domcontentloaded')
    names = ['plugin-core.mjs', 'story-core.mjs', 'copy.mjs', 'motion.mjs', 'playground.mjs']
    code = []
    for name in names:
        source = (ROOT / 'website/assets' / name).read_text()
        source = re.sub(r'^import .*?;\s*$', '', source, flags=re.M)
        source = re.sub(r'\bexport (?=(?:const|let|function|class)\b)', '', source)
        code.append(source)
    page.add_script_tag(content='(() => {\n' + '\n'.join(code) + '\n})();')
    page.wait_for_selector('.scene-canvas:visible')
    return 'DOM_ONLY'
