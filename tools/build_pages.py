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
:root{--bg:#14171e;--ink:#EEEFF1;--mid:#A2A7AF;--dim:#8D939C;--line:rgba(255,255,255,.08);--k:#FF6A4D;--i:#FFB454;--r:#41D6C3;--a:#6AA8FF;--sans:'Space Grotesk',system-ui,sans-serif;--mono:'JetBrains Mono',ui-monospace,monospace;--pad:clamp(20px,6.5vw,104px);--edge:max(var(--pad),calc((100vw - 1560px)/2))}
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:var(--bg);color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;overflow-x:clip}
body{background-image:radial-gradient(rgba(150,170,200,.2) 1px,transparent 1.2px);background-size:46px 46px;background-attachment:fixed}
a{color:inherit;text-decoration:none}
a:focus-visible,input:focus-visible,.tw:focus-visible{outline:2px solid var(--a);outline-offset:3px;border-radius:4px}
::selection{background:var(--a);color:#04111f}
.top{position:sticky;top:0;z-index:20;display:flex;justify-content:space-between;align-items:center;gap:20px;min-height:64px;padding:0 var(--edge);background:var(--bg);border-bottom:1px solid var(--line)}
.brand{font-size:15px;font-weight:500;letter-spacing:-.01em}
.nl{display:flex;flex-wrap:wrap;gap:6px 26px;font-size:14px}
.nl a{color:var(--mid);min-height:32px;display:inline-flex;align-items:center}.nl a:hover{color:#fff}.nl a.on{color:var(--c)}
.op{padding:clamp(56px,10vh,110px) var(--edge) clamp(28px,5vh,52px);background:radial-gradient(70vw 60vh at 86% 0,color-mix(in srgb,var(--c) 14%,transparent),transparent 72%)}
.crumb{font-size:clamp(16px,1.4vw,19px);font-weight:500;color:var(--c)}
.crumb:hover{text-decoration:underline;text-underline-offset:4px}
h1{font-size:clamp(40px,7.4vw,104px);line-height:1;font-weight:600;letter-spacing:-.04em;margin-top:14px;max-width:1100px;text-wrap:balance}
.lead{font-size:clamp(18px,2vw,24px);line-height:1.4;max-width:760px;margin-top:22px;letter-spacing:-.01em}
.state{font-family:var(--mono);font-size:12px;color:var(--mid);margin-top:14px}
.keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:0 28px;margin-top:40px;border-top:1px solid var(--line)}
.kn{padding:18px 0;border-bottom:1px solid var(--line)}
.kv{font-family:var(--mono);font-size:clamp(28px,3.4vw,44px);font-weight:700;letter-spacing:-.02em;color:var(--c);line-height:1.1}
.kl{font-size:14px;line-height:1.45;color:var(--mid);margin-top:6px}
.grid{display:grid;grid-template-columns:minmax(0,720px) minmax(0,270px);justify-content:space-between;gap:48px;padding:12px var(--edge) 40px}
.toc{position:sticky;top:104px;align-self:start;display:flex;flex-direction:column;gap:2px;font-size:14px;padding-top:40px}
.toc span{font-size:14px;color:var(--dim);margin-bottom:6px}
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
.prose tr:last-child td{border-bottom:0}.prose th{color:var(--mid);font-size:12px;font-weight:500}
.prose td.num,.prose th.num{text-align:right;white-space:nowrap}
.barv{display:inline-flex;align-items:center;gap:8px;min-width:120px}.barv .bt{flex:1;min-width:60px;height:7px;border-radius:4px;background:rgba(255,255,255,.07);overflow:hidden;display:block}.barv i{display:block;height:100%;background:var(--c)}
.next{display:flex;flex-wrap:wrap;justify-content:space-between;gap:14px;padding:30px var(--edge);border-top:1px solid var(--line)}
.next a{font-size:clamp(20px,2.4vw,30px);font-weight:600;letter-spacing:-.02em}.next a:hover{text-decoration:underline;text-underline-offset:5px}
.next small{display:block;font-size:14px;font-weight:400;letter-spacing:0;color:var(--dim);margin-bottom:6px}
.foot{display:flex;flex-wrap:wrap;gap:8px 22px;padding:28px var(--edge) 48px;border-top:1px solid var(--line);font-size:14px;color:var(--mid)}.foot a{min-height:28px;display:inline-flex;align-items:center}.foot a:hover{color:#fff}
.nf{display:block;font-size:14px;color:var(--dim);margin-top:28px}
.nf input{display:block;width:100%;max-width:560px;margin-top:8px;background:rgba(255,255,255,.03);border:1px solid var(--line);border-radius:10px;min-height:48px;padding:0 14px;font:400 16px var(--sans);color:var(--ink);letter-spacing:0;text-transform:none}
.claims{padding:10px var(--edge) 60px}.claim>*{max-width:76ch}
.claim{padding:20px 0;border-bottom:1px solid var(--line);scroll-margin-top:90px}
.claim:target{background:linear-gradient(90deg,rgba(255,180,84,.07),transparent);padding-left:12px}
.claim h2{font-size:18px;font-weight:500;line-height:1.35}
.claim .v{font-family:var(--mono);font-size:13px;color:var(--i);margin-top:6px;line-height:1.5}
.claim p{font-size:15px;line-height:1.55;color:var(--mid);margin-top:6px}
.claim p a{color:var(--ink);text-decoration:underline;text-underline-offset:3px}
@media(max-width:880px){.grid{grid-template-columns:minmax(0,1fr)}.toc{display:none}.nl a.ha{display:none}}
.brand{white-space:nowrap}@media(max-width:560px){.nl a:not(:last-child){display:none}}
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
<meta name="theme-color" content="#14171e">
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
<header class="top"><a class="brand" href="/">Harshith Kantamneni</a><div class="nl">{links}<a class="ha" href="/numbers/">Numbers</a><a href="{resume}">Résumé</a></div></header>
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


# ---------- /60/: the whole site for someone with a minute ----------
def row(num, name, text, resume, col, href):
    return (f'<div class="r60" style="--c:{col}"><div class="r60n">{num}</div><div><h2><a href="{href}">{name}</a></h2><p>{text}</p></div>'
            f'<a class="r60r" href="{resume}">Résumé</a></div>')


body60 = f"""<main style="--c:var(--k)">
<div class="op" style="padding-bottom:10px"><span class="crumb">The 60-second version</span>
<h1 style="font-size:clamp(30px,4.6vw,64px);line-height:1.08;font-weight:500">I build the software AI runs on, from GPU kernels up to the agents on top.</h1>
<p class="state" style="font-size:13px">Open to full-time roles. Milwaukee, WI (open to relocation). M.S. ECE, UW-Madison, Dec 2025.</p></div>
<div class="s60">
{row('52.7×', 'GPU kernels', "The low-level code that does an AI model's math. Kernels merged in flash-linear-attention, where one step ran 52.7× faster than recomputing at 64K keys. Tests merged in NVIDIA's cuDNN frontend, which catch 3 injected bugs that NVIDIA's tests missed.", '/Harshith_Kantamneni_Resume.pdf', 'var(--k)', '/#ch-k')}
{row('11 of 12', 'LLM inference', 'A cache in llama.cpp for AI models too big for the GPU. Faster than FreeToken in 11 of 12 test setups at batch 1, on 2 RTX 5090 hosts.', '/resume/inference/Harshith_Kantamneni_Resume.pdf', 'var(--i)', '/#ch-i')}
{row('5 forged', 'Agent systems', "A research lab of 31 Claude Code agent roles, where I caught an agent forging another agent's approvals, audited my own check against the logs, and rebuilt it so the same forgery is refused. And bert, searchable memory for coding agents.", '/resume/agents/Harshith_Kantamneni_Resume.pdf', 'var(--a)', '/#ch-a')}
</div>
<div class="a60"><a class="b60 p" href="mailto:kantamneniharshith@gmail.com">Email me</a><a class="b60" href="/#intro">Read the full story</a><a class="b60" href="/work/">See all work</a></div>
</main>"""
EXTRA60 = """<style>.s60{padding:14px var(--edge) 0}.r60{display:grid;grid-template-columns:minmax(150px,240px) minmax(0,1fr) auto;gap:clamp(16px,3vw,40px);align-items:center;padding:clamp(20px,3.4vh,34px) 0;border-top:1px solid var(--line)}.r60n{font-family:var(--mono);font-size:clamp(30px,4vw,54px);font-weight:700;letter-spacing:-.03em;color:var(--c);white-space:nowrap}.r60 h2{font-size:clamp(19px,1.7vw,24px);font-weight:500}.r60 h2 a:hover{text-decoration:underline;text-underline-offset:4px}.r60 p{font-size:16px;line-height:1.5;color:#c6cad1;margin-top:6px;max-width:44em}.r60r{font-size:14px;min-height:44px;display:inline-flex;align-items:center;padding:0 14px;border:1px solid var(--line);border-radius:9px}.r60r:hover{border-color:rgba(255,255,255,.34)}.a60{display:flex;flex-wrap:wrap;gap:10px;padding:24px var(--edge) 60px}.b60{font-size:15px;font-weight:500;min-height:48px;display:inline-flex;align-items:center;padding:0 20px;border:1px solid var(--line);border-radius:10px}.b60:hover{border-color:rgba(255,255,255,.34)}.b60.p{background:var(--ink);color:#08090a;border-color:var(--ink)}@media(max-width:760px){.r60{grid-template-columns:minmax(0,1fr)}.r60r{width:fit-content}}</style>"""
out = SITE / '60' / 'index.html'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(page('Harshith Kantamneni in 60 seconds', 'I build the software AI runs on, from GPU kernels up to the agents on top. The whole site, for someone with a minute.', '/60/', body60).replace('</head>', EXTRA60 + '\n</head>'))

# ---------- /work/: everything, grouped by layer ----------
parts = pathlib.Path('data/work/parts')
cards_raw = (parts / 'cards.html').read_text().split('\n')


def card_row(c):
    href = re.search(r'href="([^"]+)"', c)
    name = re.search(r'class="pn">([^<]*)', c).group(1)
    kind = re.search(r'class="pl">([^<]*)', c).group(1)
    desc = re.search(r'class="pd">(.*?)</div>', c, re.S).group(1)
    tag = 'a' if href else 'div'
    h = f' href="{href.group(1)}"' if href else ''
    return f'<{tag} class="wk"{h}><h3>{name}</h3><p>{desc}</p><span>{kind}</span></{tag}>'


by_name = {re.search(r'class="pn">([^<]*)', c).group(1): c for c in cards_raw if c.strip()}
up = (parts / 'upstream.html').read_text()
def up_row(m):
    href, dt, title, sub, cls, state = m.groups()
    st = 'ok' if 'st-ok' in cls else 'open' if 'st-open' in cls else 'closed'
    return f'<a class="wk pr" href="{href}"><h3><i class="st {st}"></i>{title}</h3><p>{sub}</p><span>{state}. {dt}</span></a>'


rows_up = ''.join(up_row(m) for m in re.finditer(r'<a class="wrow reveal"[^>]*href="([^"]+)"[^>]*><span class="wd">([^<]*)</span><span class="wt">(.*?)<span class="wsub">(.*?)</span></span><span class="wm([^"]*)">([^<]*)</span></a>', up))
def study(slug, name, text):
    return f'<a class="wk" href="/work/{slug}/"><h3>{name}</h3><p>{text}</p><span>Write-up</span></a>'


trace = (parts / 'trace.html').read_text()
trace = re.sub(r'href="#(ch-k|upstream|triton|gqa|kernels)"', 'href="#kernels"', trace)
trace = re.sub(r'href="#(ch-i|seconds|inference-more|jetson)"', 'href="#inference"', trace)
trace = re.sub(r'href="#(ch-a|bert|lab)"', 'href="#agents"', trace)
trace = trace.replace('class="trace reveal"', 'class="trace"')
writing = (parts / 'writing.html').read_text()
wr = ''.join(f'<a class="wk" href="{m.group(1).replace("https://harshithkantamneni.github.io", "")}/"><h3>{m.group(3)}</h3><p>{m.group(4)}</p><span>{m.group(5)}. {m.group(2)}</span></a>' for m in re.finditer(r'<a class="wrow reveal" href="([^"]+)"[^>]*><span class="wd">([^<]*)</span><span class="wt">(.*?)<span class="wsub">(.*?)</span></span><span class="wm">([^<]*)</span></a>', writing))
body_work = f"""<main style="--c:var(--k)">
<div class="op" style="padding-bottom:10px"><span class="crumb">Everything, grouped by layer</span><h1>All work</h1><p class="lead">The <a href="/" style="text-decoration:underline;text-underline-offset:4px">home page</a> tells the story. This page is the index.</p></div>
<div class="wsec">{trace}</div>
<section class="wsec" id="kernels" style="--c:var(--k)"><h2>GPU kernels</h2>
{study('stick-breaking-kernels', 'Stick-breaking attention kernels', 'Forward, backward and KV-cache decoding kernels in Triton, merged in flash-linear-attention.')}
{study('cudnn-gqa', 'GQA in NVIDIA cuDNN', 'What removing K/V head copies did on an A100, why that code closed, and the tests that merged.')}
{card_row(by_name["moe-kernels: a timing model of vLLM's fused MoE kernel"])}
<h3 class="wh">Every upstream PR, closed ones included. States checked Nov 3, 2026.</h3>
{rows_up}
<h3 class="wh">Team projects</h3>
{card_row(by_name['ML-guided kernel config'])}{card_row(by_name['MI300X + gem5 modeling'])}
</section>
<section class="wsec" id="inference" style="--c:var(--i)"><h2>LLM inference</h2>
{study('where-the-seconds-go', 'Where the Seconds Go', "A llama.cpp expert cache for batch-1 MoE decode when the model doesn't fit on the GPU, and a computed limit to read it against.")}
{card_row(by_name['vLLM on H100 NVL'])}{card_row(by_name['Speculative decoding on MoE'])}
<a class="wk" href="https://github.com/harshithkantamneni/edge-llm-gpu-profiling"><h3>Jetson Orin Nano profiling</h3><p>Attention and KV-cache decode kernels profiled with Nsight on a 15 W edge board.</p><span>Public repo</span></a>
</section>
<section class="wsec" id="agents" style="--c:var(--a)"><h2>Agent systems</h2>
{study('lab-verification', 'Lab verification and audit', 'Sign-off verification for a lab of Claude Code agent roles, an audit of it against runner logs, and an improved detector.')}
{study('bert', 'bert', 'A local MCP server that gives a coding agent searchable memory of a project, measured against agentic grep, including where grep scored higher.')}
{card_row(by_name['The Obsidian Archive'])}{card_row(by_name['HIVE'])}
</section>
<section class="wsec" id="writing" style="--c:var(--mid)"><h2>Writing</h2>{wr}</section>
</main>
<script>(function(){{const t=document.getElementById('tracks');if(!t)return;const ro=document.getElementById('readout'),line=t.querySelector('.play'),box=document.getElementById('trace'),base=ro.textContent,mon=['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'];const it=[...t.querySelectorAll('[data-say]')].map(e=>{{const l=parseFloat(e.style.left),w=parseFloat(e.style.width)||0;return{{l,r:l+w,m:!w,t:e.dataset.say}};}});t.addEventListener('pointermove',e=>{{const r=t.getBoundingClientRect(),p=Math.max(0,Math.min(100,(e.clientX-r.left)/r.width*100));line.style.left=p+'%';box.classList.add('scrub');const h=it.filter(i=>i.m?Math.abs(i.l-p)<1.3:p>=i.l&&p<=i.r).map(i=>i.t);ro.textContent=mon[Math.min(9,Math.floor(p/10))]+' 2026: '+(h.length?h.join('. ')+'.':'Nothing logged here.');}});t.addEventListener('pointerleave',()=>{{box.classList.remove('scrub');ro.textContent=base;}});}})();</script>"""
EXTRAW = """<style>.wsec{padding:clamp(30px,6vh,60px) var(--edge) 0;scroll-margin-top:70px}.wsec h2{font-size:clamp(28px,4vw,52px);font-weight:500;letter-spacing:-.03em;color:var(--c);margin-bottom:10px}.wh{font-size:14px;font-weight:400;color:var(--dim);padding:26px 0 10px}.wk{display:grid;grid-template-columns:minmax(0,1fr) minmax(0,1.5fr) 220px;gap:6px clamp(16px,3vw,40px);padding:16px 0;border-top:1px solid var(--line);align-items:baseline;transition:padding .25s}a.wk:hover{padding-left:8px}.wk h3{font-size:17px;font-weight:500;line-height:1.3}.wk p{font-size:14px;line-height:1.5;color:var(--mid)}.wk span{font-size:13px;color:var(--dim);white-space:nowrap;text-align:right}.st{display:inline-block;width:9px;height:9px;border-radius:50%;margin-right:9px;vertical-align:1px}.st.ok{background:#39d98a}.st.open{background:var(--i)}.st.closed{background:none;border:2px solid var(--dim)}
.trace{border-top:1px solid var(--line);padding-top:16px}.trace .vh{display:flex;flex-wrap:wrap;justify-content:space-between;gap:4px 16px;font-size:13px;color:var(--dim);text-transform:none}.ticks{position:relative;height:22px;margin-top:14px;font-family:var(--mono);font-size:11px;color:var(--dim)}.ticks span{position:absolute;top:0}.tracks{position:relative}.ln{padding:10px 0;border-top:1px solid var(--line)}.ln-n{display:inline-block;font-size:15px;font-weight:500;color:var(--c);margin-bottom:4px}.ln.lit .ln-n{font-size:22px;font-weight:600}.ln-t{position:relative}.gl{position:absolute;top:0;bottom:0;width:1px;background:rgba(255,255,255,.05)}.sb{position:absolute;height:14px;border-radius:4px;background:color-mix(in srgb,var(--c) 55%,#0a0c0f);transition:background .2s}.sb:hover,.sb:focus-visible{background:var(--c)}.sb::after{content:"";position:absolute;left:0;right:0;top:-6px;bottom:-6px}.ln.lit .sb{height:24px;background:var(--c)}.sp-l{position:absolute;font-family:var(--mono);font-size:12px;color:var(--ink);white-space:nowrap}.sp-l.r{transform:translateX(-100%)}.mk{position:absolute;width:14px;height:14px;margin-left:-7px;background:var(--c);border:2px solid #060708;transform:rotate(45deg);transition:transform .2s}.mk::after{content:"";position:absolute;inset:-6px}.ln.lit .mk{width:18px;height:18px;margin-left:-9px;background:#fff;border-color:var(--k)}.mk:hover,.mk:focus-visible{transform:rotate(45deg) scale(1.25)}.play{position:absolute;top:0;bottom:0;width:1px;background:#fff;opacity:0;pointer-events:none}.trace.scrub .play{opacity:.7}.readout{margin-top:6px;padding-top:12px;border-top:1px solid var(--line);font-family:var(--mono);font-size:13px;color:var(--mid);min-height:44px}
@media(max-width:760px){.wk{grid-template-columns:minmax(0,1fr)}.wk span{text-align:left}.trace .sp-l{font-size:11px}}</style>"""
out = SITE / 'work' / 'index.html'
out.write_text(page('All work: Harshith Kantamneni', 'Every project, upstream PR and write-up, grouped by layer: GPU kernels, LLM inference and agent systems.', '/work/', body_work).replace('</head>', EXTRAW + '\n</head>').replace('<a class="ha" href="/numbers/">Numbers</a>', '<a class="ha on" style="--c:var(--ink)" href="/work/">All work</a>'))
print('60 and work pages built')
