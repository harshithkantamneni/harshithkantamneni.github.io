import html,json,pathlib,re
# Builds site/index.html and site/assets/{story,field}.js. Run from the repo root.
import os
N=os.path.dirname(os.path.abspath(__file__))+'/'
R=pathlib.Path
src=R(N+'index.src.html').read_text();css=R(N+'style.css').read_text();js=R(N+'story.src.js').read_text()
CODE='''# visit nearer blocks first to carry their remaining stick into earlier blocks
for i_s in range(0, TK, BS):
    o_k = TK - BS - i_s + tl.arange(0, BS)
    m_k = o_k >= 0
    p_k = k + (bos * H + i_h) * K + o_k[:, None] * (H*K) + o_d[None, :]
    p_v = v + (bos * H + i_h) * V + o_k[:, None] * (H*V) + o_v[None, :]
    b_k = tl.load(p_k, mask=m_k[:, None] & (o_d[None, :] < K), other=0.)
    b_v = tl.load(p_v, mask=m_k[:, None] & (o_v[None, :] < V), other=0.)

    b_s = tl.sum(b_q[None, :] * b_k.to(tl.float32), 1) * scale * RCP_LN2
    b_log_om_beta, b_p = _stickbreaking_attn_weights(b_s=b_s, b_log_rem=b_log_rem, m_s=m_k, AXIS=0)
    b_o += tl.sum(b_p.to(b_v.dtype).to(tl.float32)[:, None] * b_v.to(tl.float32), 0)
    b_log_rem += tl.sum(b_log_om_beta, 0)'''
# Set FLA_SRC to a flash-linear-attention checkout to check the excerpt against the merged kernel.
if os.environ.get('FLA_SRC'):
    real=R(os.environ['FLA_SRC']+'/fla/ops/stickbreaking_attn/decoding.py').read_text()
    for l in CODE.split('\n'): assert not l.strip() or l.strip() in real,l
code=''.join(f'<span class="ln">{html.escape(l) or " "}</span>' for l in CODE.split('\n'))
flags=json.load(open(N+'gate.json'))['flags']
waf=''.join(f'<i class="d w{f}"></i>' for f in flags)
mem=''.join('<i class="d on"></i>' if i<32 else '<i class="d"></i>' for i in range(61))
jet=[(256,63.1),(512,63.9),(1024,64.9),(2048,114.6),(4096,209.4),(8192,398.1)]
cols=''.join(f'<div class="jc" data-k="{k}" data-v="{v}"><div class="jd">{"<i class=d></i>"*round(v/10)}</div><b>{v}</b><span>{k}</span></div>' for k,v in jet)
bug='<i class="d"></i>'*20
labend=R(N+'labend.html').read_text() if R(N+'labend.html').exists() else ''
seq2=R(N+'seq2.js').read_text() if R(N+'seq2.js').exists() else ''
for a,b in [('/*STYLE*/',css),('/*CODE*/',code),('/*WAF*/',waf),('/*MEM*/',mem),('/*BUG*/',bug),('<!--LABEND-->',labend)]:
    assert a in src,a;src=src.replace(a,b)
R('site/index.html').write_text(src)
tr=json.load(open(N+'triton.json'))
tri=json.dumps([[p['M'],p['N'],p['K'],p['fp16'],p['bf16']] for p in tr],separators=(',',':'))
assert '/*TRITON*/[]' in js;js=js.replace('/*TRITON*/[]',tri)
search=R(N+'search.js').read_text()
# palette: actions before typing, jump with the story's own scrolling
search=search.replace("if(window.__lenis)window.__lenis.scrollTo(el,{offset:-90});else el.scrollIntoView({block:'center'});el.classList.remove('focus-flash');void el.offsetWidth;el.classList.add('focus-flash');","goTo(el);")
search=search.replace("$$('.step,.wrow,.proj,.b,.case-top,.pc,.dl').forEach(el=>{const h=el.querySelector('h3,h2,.wt,.pn,.bl,.dn,.ph');const title=h?(h.firstChild&&h.firstChild.textContent||h.textContent).trim():'';","$$('.say,.numb,.note,.eng-b p,.pincap p,.chase a,.more,.orow,figcaption').forEach(el=>{const title='';")
search=search.replace("const sec=el.closest('section');const tag=sec&&sec.querySelector('.case-title,h2');","const sec=el.closest('article,section');const tag=sec&&sec.querySelector('.sname,.ptitle,.say');")
search=search.replace("['Go to Kernels',()=>window.__go('#ch-k')],['Go to Inference',()=>window.__go('#ch-i')],['Go to Agents',()=>window.__go('#ch-a')]","['Go to Kernels',()=>scrollToY(yOf($('#ch-k')))],['Go to Inference',()=>scrollToY(yOf($('#ch-i')))],['Go to Agents',()=>scrollToY(yOf($('#ch-a')))],['See all work',()=>{location.href='/work/';}]")
search=search.replace("['Run a kernel on my GPU',()=>window.__go('#yourgpu')]","['Run a kernel on my GPU',()=>scrollToY(yOf($('#yourgpu')))]")
search=search.replace("[\"Take the skeptic's tour\",()=>window.__tour()],","")
search=search.replace("['Read the 60-second version',()=>window.__short(true,true)]","['Read the 60-second version',()=>{location.href='/60/';}]")
js=js.replace('/*SEARCH*/',search).replace('/*GPU*/',R(N+'gpu.js').read_text()).replace('/*SEQ2*/',seq2)
R('site/assets/story.js').write_text(js)
f=R(N+'field.js').read_text()
f=f.replace("api.on=!!window.gsap;","api.on=true;")
R('site/assets/field.js').write_text(f)
print('built',len(src),len(js),len(f))
