#!/usr/bin/env python3
"""Checks the site folder. Run from the repo root: python3 tools/check_site.py

Fails on banned wording, broken old URLs, broken internal links and unprocessed copy markup.
Dated reports and notes are archives, so wording checks skip them.
"""
import html
import pathlib
import re
import sys
from urllib.parse import unquote, urlparse

DIST = pathlib.Path('site')
ARCHIVE = ('reports', 'notes', 'numbers')

BANNED = [r'\bbeats?\b', r'\bwins?\b', r'half the cost', r'\bcursor\b', r'hand-?written', r'\bSaTML\b', r'\bMLSys\b',
          r'Priced Reads', r'#378\b', r'\bSeattle\b', r'—', r'\bpublished paper', r'staffing']

OLD_URLS = [
    '/', '/404.html', '/favicon.svg', '/og.png', '/robots.txt', '/sitemap.xml',
    '/Harshith_Kantamneni_Resume.pdf', '/Harshith_Kantamneni_GPU_Kernel_Resume.pdf',
    '/Harshith_Kantamneni_LLM_Inference_Resume.pdf', '/Harshith_Kantamneni_Agentic_AI_Resume.pdf',
    '/Recursive_Verification_Surface_Collapse_paper.pdf',
    '/certificates/NVIDIA_Accelerated_Computing_Modern_CUDA_Cpp.pdf', '/certificates/NVIDIA_Art_of_Compressing_LLMs.pdf',
    '/notes/kv-copies-gqa/', '/notes/llm-judge-bias/', '/notes/tier-per-task/',
    '/reports/recursive-verification-surface-collapse/',
    '/reports/below-the-measurement-floor-a-pre-registered-dense-vs-moe-null-at-sub-100m-active-parameters/',
]
OLD_ANCHORS = ['writing', 'about', 'triton']


def exists(path):
    p = DIST / path.lstrip('/')
    return p.is_file() or (p / 'index.html').is_file()


def visible(text):
    text = re.sub(r'<(script|style)\b.*?</\1>', ' ', text, flags=re.S)
    return html.unescape(re.sub(r'<[^>]+>', ' ', text))


def main():
    errors = []
    for url in OLD_URLS:
        if not exists(url):
            errors.append(f'old URL broken: {url}')
    home = (DIST / 'index.html').read_text()
    for anchor in OLD_ANCHORS:
        if f'id="{anchor}"' not in home:
            errors.append(f'old anchor missing: /#{anchor}')

    pages = sorted(DIST.glob('**/*.html'))
    for page in pages:
        rel = page.relative_to(DIST)
        text = page.read_text()
        if rel.parts[0] in ARCHIVE:
            continue
        shown = visible(text)
        for rx in BANNED:
            for m in re.finditer(rx, shown, flags=re.I):
                errors.append(f'{rel}: banned wording "{m.group()}": ...{shown[max(0, m.start() - 40):m.end() + 40].strip()}...')
        if '[[' in shown or '{{' in shown:
            errors.append(f'{rel}: unprocessed copy markup')
        ids = set(re.findall(r'\bid="([^"]+)"', text))
        for href in re.findall(r'\bhref="([^"]+)"', text):
            if href.startswith(('http:', 'https:', 'mailto:')):
                continue
            u = urlparse(href)
            path = unquote(u.path)
            if path and not exists(path):
                errors.append(f'{rel}: broken link {href}')
            elif not path and u.fragment and u.fragment not in ids:
                errors.append(f'{rel}: broken anchor {href}')
            elif path and u.fragment:
                target = DIST / path.lstrip('/')
                target = target if target.is_file() else target / 'index.html'
                if target.suffix == '.html' and f'id="{u.fragment}"' not in target.read_text():
                    errors.append(f'{rel}: broken anchor {href}')

    print(f'{len(pages)} pages, {len(errors)} problems')
    print('\n'.join(errors))
    return 1 if errors else 0


if __name__ == '__main__':
    sys.exit(main())
