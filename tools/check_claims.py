#!/usr/bin/env python3
"""Fail if a number on a checked page has no entry in data/claims.json, or an entry lacks conditions or a source.

Run from the repo root: python3 tools/check_claims.py
"""
import json
import pathlib
import re
import sys
from html.parser import HTMLParser

PAGES = {'home': 'site/index.html'}
# Dated reports and notes are archives: their numbers trace to the document they report on.
# The numbers page is the ledger itself, and the 404 page has none.
WEB_SKIP = ('reports', 'notes', 'numbers', '404')
for built in sorted(pathlib.Path('web/dist').glob('**/index.html')):
    parts = built.relative_to('web/dist').parts
    if parts[0] not in WEB_SKIP:
        PAGES['web/' + '/'.join(parts[:-1])] = str(built)
BLOCK = {'p', 'li', 'h1', 'h2', 'h3', 'h4', 'td', 'th', 'tr', 'div', 'figcaption', 'section', 'article', 'text', 'button'}
# Names and chart scales, not claims.
ALLOW = [r'^B=\d+,.*$', r'^Packed .*', r'gpt-oss-120b', r'Qwen2\.5-7B', r'bge-base-en-v1\.5', r'nDCG@10', r'JSON-RPC 2\.0', r'4-bit', r'RTX \d{4}', r'\b[34]090\b',
         r'ECE \d{3}', r'ICLR 2026', r'#\d+', r'^76$', r'^10$', r'at 2 measured memory sizes', r'the 2 measured sizes', r'PARITY 1\.0×',
         r'^1\.0$', r'^\.75$', r'^\.50$', r'^\.25$', r'^0$', r'^50K$', r'^100K$', r'^500K$', r'^1M$', r'^2M$',
         r'^1\.6×$', r'^1\.4×$', r'^1\.2×$', r'^1×$', r'^0\.8×$', r'^0\.6×$', r'^4/2$', r'^16/4$', r'^8/4$', r'^8/2$', r'^128$', r'^256$', r'^512$', r'^1024$', r'^2048$',
         r'States checked [A-Z][a-z]{2} \d{1,2}, \d{4}', r'^[A-Z][a-z]{2} \d{1,2}$', r'(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{1,2}(, 2026)?', r'ECE \d{3}', r'2026 log', r'in 2026', r'Dec 2025', r'^0$']


class Text(HTMLParser):
    def __init__(self):
        super().__init__()
        self.skip, self.out = 0, []

    def handle_starttag(self, tag, attrs):
        self.skip += tag in ('script', 'style', 'noscript')
        if tag in BLOCK:
            self.out.append('\n')

    def handle_endtag(self, tag):
        self.skip -= tag in ('script', 'style', 'noscript')

    def handle_data(self, data):
        if not self.skip:
            self.out.append(data)


def lines(path):
    parser = Text()
    parser.feed(pathlib.Path(path).read_text())
    return [re.sub(r'\s+', ' ', line).strip() for line in ''.join(parser.out).split('\n') if line.strip()]


def main():
    claims = json.load(open('data/claims.json'))['claims']
    errors = []
    for c in claims:
        if not c.get('conditions'):
            errors.append(f"{c['id']}: no conditions")
        if not c.get('source') or not all(s.get('url') or s.get('note') for s in c['source']):
            errors.append(f"{c['id']}: no source")
    shows = sorted({s.replace('\n', ' ').strip() for c in claims for s in c['shows'] if s.strip()}, key=len, reverse=True)
    for page, path in PAGES.items():
        for line in lines(path):
            rest = line
            for s in shows:
                rest = rest.replace(s, ' ')
            for a in ALLOW:
                rest = re.sub(a, ' ', rest)
            rest = re.sub(r'\b[A-Za-z][A-Za-z-]*\d[\w.-]*', ' ', rest)  # fp16, A100, NVFP4, p50
            for m in re.finditer(r'\.?\d[\d,.]*[%×]?', rest):
                errors.append(f'{page}: "{m.group()}" has no claim: {line[:90]}')
    print(f'{len(claims)} claims, {len(errors)} problems')
    print('\n'.join(errors))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
