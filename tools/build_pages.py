#!/usr/bin/env python3
"""Builds /work/<slug>/, /numbers/ and /numbers/claims.json from data/. Run from the repo root."""
import html
import json
import pathlib
import re

SITE = pathlib.Path('site')
claims = json.load(open('data/claims.json'))
by_id = {c['id']: c for c in claims['claims']}
cases = json.load(open('data/work/cases.json'))
PLAIN = {'profile.degree', 'cert.cuda', 'cert.llm', 'gem5.team', 'ml.team', 'lab.memory', 'count.roles'}
LANE = {
    'k': ('Kernels', '#ch-k', 'var(--k)', '/Harshith_Kantamneni_Resume.pdf'),
    'i': ('Inference', '#ch-i', 'var(--i)', '/resume/inference/Harshith_Kantamneni_Resume.pdf'),
    'a': ('Agents', '#ch-a', 'var(--a)', '/resume/agents/Harshith_Kantamneni_Resume.pdf'),
}
# Up the stack, the same order as the home page
ORDER = ['stick-breaking-kernels', 'cudnn-gqa', 'where-the-seconds-go', 'bert', 'lab-verification']
SCENE = {'stick-breaking-kernels': '#kernels', 'cudnn-gqa': '#gqa', 'where-the-seconds-go': '#seconds', 'bert': '#bert', 'lab-verification': '#lab'}
# Not confirmed anywhere public, so it stays out of the write-up
DROP = [' I noticed an empty PI folder next to the approvals.']

BASE = """
:root{--bg:#060708;--ink:#EEEFF1;--mid:#9398A0;--dim:#7C828B;--line:rgba(255,255,255,.08);--k:#FF6A4D;--i:#FFB454;--r:#41D6C3;--a:#6AA8FF;--sans:'Space Grotesk',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;--pad:clamp(20px,5vw,72px)}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;overflow-x:clip}
body{background-image:radial-gradient(rgba(150,170,200,.09) 1px,transparent 1.2px);background-size:46px 46px;background-attachment:fixed}
a{color:inherit;text-decoration:none}
a:focus-visible,input:focus-visible,.tw:focus-visible{outline:2px solid var(--a);outline-offset:3px;border-radius:4px}
::selection{background:var(--a);color:#04111f}
.top{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:20px;min-height:74px;padding:0 var(--pad);background:rgba(6,7,8,.82);backdrop-filter:blur(12px);-webkit-backdrop-filter:blur(12px);border-bottom:1px solid var(--line)}
.brand{font-family:var(--mono);font-size:13px;letter-spacing:.06em;font-weight:700}
.nl{display:flex;flex-wrap:wrap;gap:6px 24px;font-family:var(--mono);font-size:12px;letter-spacing:.1em;text-transform:uppercase}
.nl a{color:var(--mid);min-height:32px;display:inline-flex;align-items:center}.nl a:hover{color:#fff}.nl a.on{color:var(--c)}
.op{padding:clamp(56px,10vh,110px) var(--pad) clamp(28px,5vh,52px);background:radial-gradient(70vw 60vh at 86% 0,color-mix(in srgb,var(--c) 14%,transparent),transparent 72%)}
.crumb{font-family:var(--mono);font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:var(--c)}
.crumb:hover{text-decoration:underline;text-underline-offset:4px}
h1{font-size:clamp(40px,7.4vw,104px);line-height:1;font-weight:600;letter-spacing:-.04em;margin-top:14px;max-width:1100px;text-wrap:balance}
.lead{font-size:clamp(18px,2vw,24px);line-height:1.4;max-width:760px;margin-top:22px;letter-spacing:-.01em}
.state{font-family:var(--mono);font-size:12px;color:var(--mid);margin-top:14px}
.keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 28px;margin-top:40px;border-top:1px solid var(--line)}
.kn{padding:18px 0;border-bottom:1px solid var(--line)}
.kv{font-family:var(--mono);font-size:clamp(28px,3.4vw,44px);font-weight:700;letter-spacing:-.02em;color:var(--c);line-height:1.1}
.kl{font-size:14px;line-height:1.45;color:var(--mid);margin-top:6px}
.grid{display:grid;grid-template-columns:minmax(0,720px) minmax(0,220px);justify-content:space-between;gap:48px;padding:12px var(--pad) 40px;max-width:1320px}
.toc{position:sticky;top:104px;align-self:start;display:flex;flex-direction:column;gap:2px;font-size:14px;padding-top:40px}
.toc span{font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}
.toc a{color:var(--mid);min-height:32px;display:flex;align-items:center}.toc a:hover,.toc a.on{color:#fff}
.prose{font-size:17px;line-height:1.72;color:#cfd3d9;padding-top:18px;min-width:0}
.prose>*+*{margin-top:20px}
.prose h2{font-size:clamp(24px,3vw,34px);font-weight:600;letter-spacing:-.02em;color:var(--ink);margin-top:52px;line-height:1.15;scroll-margin-top:96px}
.prose h3{font-size:20px;font-weight:600;color:var(--ink);margin-top:34px;line-height:1.25}
.prose a{color:var(--ink);text-decoration:underline;text-decoration-color:color-mix(in srgb,var(--c) 70%,transparent);text-underline-offset:3px}
.prose a:hover{text-decoration-color:var(--c)}
.prose a.n{font-family:var(--mono);font-size:.92em;color:var(--c);text-decoration:underline dotted;text-underline-offset:4px}
.prose ul,.prose ol{padding-left:22px}.prose li{margin-top:8px}.prose li::marker{color:var(--dim)}
.prose code{font-family:var(--mono);font-size:.86em;background:rgba(255,255,255,.06);border:1px solid var(--line);padding:1px 6px;border-radius:5px}
.tw{overflow-x:auto;border:1px solid var(--line);border-radius:12px}
.prose table{width:100%;border-collapse:collapse;font-size:14px;font-family:var(--mono);min-width:520px;line-height:1.45}
.prose th,.prose td{padding:9px 12px;text-align:left;vertical-align:top;border-bottom:1px solid var(--line)}
.prose tr:last-child td{border-bottom:0}.prose th{color:var(--mid);font-size:11px;letter-spacing:.06em;text-transform:uppercase;font-weight:500}
.prose td.num,.prose th.num{text-align:right;white-space:nowrap}
.barv{display:inline-flex;align-items:center;gap:8px;min-width:120px}.barv .bt{flex:1;min-width:60px;height:7px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;display:block}.barv i{display:block;height:100%;background:var(--c)}
.next{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;padding:30px var(--pad);border-top:1px solid var(--line);max-width:1320px}
.next a{font-size:clamp(20px,2.4vw,30px);font-weight:600;letter-spacing:-.02em}.next a:hover{text-decoration:underline;text-underline-offset:5px}
.next small{display:block;font-family:var(--mono);font-size:11px;font-weight:400;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-bottom:6px}
.foot{display:flex;flex-wrap:wrap;gap:8px 22px;padding:28px var(--pad) 48px;border-top:1px solid var(--line);font-family:var(--mono);font-size:13px;color:var(--mid)}.foot a{min-height:28px;display:inline-flex;align-items:center}.foot a:hover{color:#fff}
.nf{display:block;font-family:var(--mono);font-size:11px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim);margin-top:28px}
.nf input{display:block;width:100%;max-width:560px;margin-top:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px;min-height:48px;padding:0 14px;font:400 16px var(--sans);color:var(--ink);letter-spacing:0;text-transform:none}
.claims{padding:10px var(--pad) 60px;max-width:1100px}
.claim{padding:20px 0;border-bottom:1px solid var(--line);scroll-margin-top:90px}
.claim:target{background:linear-gradient(90deg,rgba(255,180,84,.07),transparent);padding-left:12px}
.claim h2{font-size:18px;font-weight:500;line-height:1.35}
.claim .v{font-family:var(--mono);font-size:13px;color:var(--i);margin-top:6px;line-height:1.5}
.claim p{font-size:15px;line-height:1.55;color:var(--mid);margin-top:6px}
.claim p a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
@media(max-width:880px){.grid{grid-template-columns:minmax(0,1fr)}.toc{display:none}.nl a.ha{display:none}}
"""


def esc(s):
    return html.escape(str(s), quote=True)


def rich(s):
    def link(m):
        cid, text = m.group(1), m.group(2)
        c = by_id[cid]
        assert any(text in v or v in text for v in c['shows']), (cid, text, c['shows'])
        if cid in PLAIN:
            return text
        return f'<a class="n" href="/numbers/#{cid}" data-c="{cid}">{text}</a>'

    def bar(m):
        v, mx = m.group(1), m.group(2)
        return f'<span class="barv"><span class="bt"><i style="width:{min(100, float(v) / float(mx) * 100):.1f}%"></i></span><span>{v}</span></span>'

    s = re.sub(r'\[\[([\w.-]+)\|([^\]]+)\]\]', link, s)
    s = re.sub(r'\[\[([\w.-]+)\]\]', lambda m: f'<a class="n" href="/numbers/#{m.group(1)}" data-c="{m.group(1)}">conditions</a>', s)
    return re.sub(r'\{\{bar:([\d.]+)/([\d.]+)\}\}', bar, s)


def slug(t):
    return re.sub(r'[^a-z0-9]+', '-', re.sub(r'&#?\w+;|\'', '', t.lower())).strip('-')


def page(title, desc, path, body, resume='/Harshith_Kantamneni_Resume.pdf', lane=None):
    links = ''.join(f'<a {"class=on " if lane == k else ""}style="--c:{v[2]}" href="/{v[1]}">{v[0]}</a>' for k, v in LANE.items())
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1.0"/>
<title>{esc(title)}</title>
<meta name="description" content="{esc(desc)}"/>
<meta name="theme-color" content="#060708">
<link rel="canonical" href="https://harshithkantamneni.github.io{path}">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<meta property="og:type" content="article">
<meta property="og:title" content="{esc(title)}">
<meta property="og:description" content="{esc(desc)}">
<meta property="og:url" content="https://harshithkantamneni.github.io{path}">
<meta property="og:image" content="https://harshithkantamneni.github.io/og.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="https://harshithkantamneni.github.io/og.png">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet">
<style>{BASE}</style>
</head>
<body>
<header class="top"><a class="brand" href="/">HARSHITH KANTAMNENI</a><div class="nl">{links}<a class="ha" href="/numbers/">Numbers</a><a href="{resume}">Résumé</a></div></header>
{body}
<footer class="foot"><a href="/">Home</a><a href="/numbers/">Every number</a><a href="{resume}">Résumé</a><a href="mailto:kantamneniharshith@gmail.com">Email</a><a href="https://github.com/harshithkantamneni">GitHub</a><a href="https://www.linkedin.com/in/hk4231">LinkedIn</a></footer>
<script src="/numbers/num.js" defer></script>
<!-- Cloudflare Web Analytics -->
<script defer src='https://static.cloudflareinsights.com/beacon.min.js' data-cf-beacon='{{"token": "2e4646d7e5e149c0a3c87132e9fa66f1"}}'></script>
<!-- End Cloudflare Web Analytics -->
</body>
</html>
"""


for i, name in enumerate(ORDER):
    c = cases[name]
    lane = LANE[c['lane']]
    raw = pathlib.Path(f'data/work/{name}.html').read_text()
    for d in DROP:
        raw = raw.replace(d, '')
    toc = [(t, slug(t)) for t in re.findall(r'<h2>(.*?)</h2>', raw)]
    raw = re.sub(r'<h2>(.*?)</h2>', lambda m: f'<h2 id="{slug(m.group(1))}">{m.group(1)}</h2>', raw)
    raw = re.sub(r'<table>', '<div class="tw" tabindex="0"><table>', raw)
    raw = raw.replace('</table>', '</table></div>')
    keys = ''.join(f'<div class="kn"><div class="kv">{rich(k["v"])}</div><div class="kl">{esc(k["l"])}</div></div>' for k in c['keys'])
    keys = keys.replace('class="n"', 'class="n" style="color:inherit"')
    nav = ''.join(f'<a href="#{a}">{t}</a>' for t, a in toc)
    nxt = ORDER[i + 1] if i + 1 < len(ORDER) else None
    nx = (f'<a href="/work/{nxt}/"><small>Next, up the stack</small>{esc(cases[nxt]["title"])}</a>' if nxt
          else '<a href="/#about"><small>That\'s the top of the stack</small>Back to the home page</a>')
    body = f"""<main style="--c:{lane[2]}">
<div class="op"><a class="crumb" href="/{lane[1]}">{lane[0]}</a><h1>{esc(c['title'])}</h1><p class="lead">{esc(c['lead'])}</p><p class="state">{esc(c['state'])}</p><div class="keys">{keys}</div></div>
<div class="grid"><article class="prose">
{rich(raw)}
</article><aside class="toc" aria-label="On this page"><span>On this page</span>{nav}<a href="/{SCENE[name]}">See it in motion</a></aside></div>
<div class="next"><a href="/{SCENE[name]}"><small>On the home page</small>The interactive version</a>{nx}</div>
</main>"""
    out = SITE / 'work' / name / 'index.html'
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_text(page(f"{c['title']}: Harshith Kantamneni", c['lead'], f'/work/{name}/', body, lane[3], c['lane']))


def src(s):
    u = s.get('url')
    if u:
        m = re.search(r'github\.com/[^/]+/([^/]+)/(?:pull|issues)/(\d+)', u)
        if m:
            label = f'{m.group(1)} #{m.group(2)}'
        else:
            m = re.search(r'github\.com/[^/]+/([^/]+)', u)
            label = (m.group(1) + (f': {s["path"]}' if s.get('path') else '')) if m else 'Source'
        return f'<a href="{esc(u)}">{esc(label)}</a>'
    return 'Not public: ' + esc(s.get('note', ''))


pub = []
rows = []
for c in claims['claims']:
    pub.append({'id': c['id'], 'shows': c['shows'], 'means': c['means'], 'conditions': c['conditions'],
                'source': [{'html': src(s)} for s in c['source']]})
    rows.append(f'<article class="claim" id="{c["id"]}"><h2>{esc(c["means"])}</h2><div class="v">{esc(", ".join(c["shows"]))}</div><p>{esc(c["conditions"])}</p><p>{", ".join(src(s) for s in c["source"])}</p></article>')
num_body = f"""<main style="--c:var(--i)">
<div class="op" style="padding-bottom:18px"><span class="crumb">The ledger</span><h1>Every number and its source</h1><p class="lead">What each number on this site means, the conditions it holds under, and where to check it. Where a source isn't public, it says so.</p>
<label class="nf">Find a number<input id="nq" type="search" autocomplete="off" spellcheck="false"></label><p class="state" id="nc" role="status"></p></div>
<div class="claims" id="cl">{''.join(rows)}</div>
</main>
<script>(function(){{const q=document.getElementById('nq'),all=[...document.querySelectorAll('.claim')],n=document.getElementById('nc');const set=()=>{{const v=q.value.trim().toLowerCase();let k=0;all.forEach(a=>{{const on=!v||a.textContent.toLowerCase().includes(v);a.hidden=!on;if(on)k++;}});n.textContent=k?k+' of '+all.length+' numbers':'No number matches that. Try a GPU or a model, such as H200.';}};q.addEventListener('input',set);set();}})();</script>"""
out = SITE / 'numbers' / 'index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page('Every number and its source: Harshith Kantamneni', 'Each number on this site, with what it means, its conditions and its source.', '/numbers/', num_body))
(SITE / 'numbers' / 'claims.json').write_text(json.dumps(pub, ensure_ascii=False, separators=(',', ':')))
print(len(ORDER), 'write-ups,', len(rows), 'numbers')
