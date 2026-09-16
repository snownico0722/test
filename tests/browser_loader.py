"""Test our own local files without navigation when a managed browser blocks URLs.
Normal runs use the HTTP origin. The opt-in in-memory mode does not alter browser
policy; it injects the same authored JS/CSS into about:blank for DOM testing.
"""
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def load_page(page, query=''):
    if os.environ.get('PAPER_DEMO_IN_MEMORY') != '1':
        page.goto(f'http://127.0.0.1:4173/{query}', wait_until='networkidle')
        return
    html = (ROOT / 'website/index.html').read_text()
    html = re.sub(r'<meta http-equiv="Content-Security-Policy"[^>]+>', '', html)
    html = re.sub(r'<link[^>]+>', '', html)
    html = re.sub(r'<script[^>]+></script>', '', html)
    page.set_content(html)
    page.add_style_tag(content=(ROOT / 'website/assets/playground.css').read_text())
    core = (ROOT / 'website/assets/plugin-core.mjs').read_text().replace('export const ', 'const ').replace('export function ', 'function ')
    app = (ROOT / 'website/assets/playground.mjs').read_text()
    app = re.sub(r'^import[^\n]+\n', '', app)
    page.add_script_tag(content='(() => {\n' + core + '\n' + app + '\n})();')
