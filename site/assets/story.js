/* The story: reading pace, figures that draw as you reach them, and the small tools around them. */
(function(){
const $=(q,r)=>(r||document).querySelector(q),$$=(q,r)=>[...(r||document).querySelectorAll(q)];
const root=document.documentElement,qs=new URLSearchParams(location.search);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const NS='http://www.w3.org/2000/svg',K='#FF6A4D',K2='#FF9A85',I='#FFB454',A='#6AA8FF',R='#41D6C3',INK='#EEEFF1',MID='#9398A0',DIM='#7C828B',LINE='rgba(255,255,255,.13)',OFF='#2c3138';
const S=(t,a,p)=>{const e=document.createElementNS(NS,t);if(a)for(const k in a)e.setAttribute(k,a[k]);if(p)p.appendChild(e);return e;};
const T=(p,x,y,s,a)=>{const e=S('text',Object.assign({x,y},a||{}),p);e.textContent=s;return e;};
const clamp=(x,a,b)=>Math.max(a==null?0:a,Math.min(b==null?1:b,x));
const seg=(p,a,b)=>clamp((p-a)/(b-a));
const ease=t=>t*t*(3-2*t);
const lerp=(a,b,t)=>a+(b-a)*t;
const tip=$('#tip');
const showTip=(html,x,y)=>{tip.innerHTML=html;tip.classList.add('on');tip.style.left=Math.min(innerWidth-tip.offsetWidth-8,Math.max(8,x+14))+'px';tip.style.top=Math.max(8,y-tip.offsetHeight-12)+'px';};
const hideTip=()=>tip.classList.remove('on');
const isStatic=()=>reduce||qs.has('static');
if(qs.has('short'))location.replace('/60/');

/* ---------- smooth wheel, same as the original site ---------- */
let lenis=null;
if(window.Lenis&&!reduce){lenis=new Lenis({lerp:.1,smoothWheel:true});window.__lenis=lenis;const raf=t=>{lenis.raf(t);requestAnimationFrame(raf);};requestAnimationFrame(raf);}
const scrollToY=(y,opts)=>{if(lenis)lenis.scrollTo(y,Object.assign({duration:1},opts||{}));else scrollTo({top:y});};
const yOf=el=>el.getBoundingClientRect().top+scrollY;
function goTo(el){if(typeof el==='string')el=$(el);if(!el)return;const d=el.closest&&el.closest('details');if(d)d.open=true;const pin=el.closest&&el.closest('.pin');if(pin&&el.dataset.at!=null){const n=+pin.dataset.steps,top=yOf(pin),h=pin.offsetHeight-innerHeight;scrollToY(top+(+el.dataset.at+.5)/n*h);return;}const r=el.getBoundingClientRect();scrollToY(r.top+scrollY-(r.height<innerHeight*.8?(innerHeight-r.height)/2:90));}
window.__go=goTo;
document.addEventListener('click',e=>{const a=e.target.closest&&e.target.closest('a[href^="#"]');if(!a||a.getAttribute('href')==='#')return;const t=$(a.getAttribute('href'));if(t){e.preventDefault();scrollToY(yOf(t)-(t.classList.contains('story')?84:0));}});

/* ---------- sentences that light up as you read ---------- */
const says=$$('.say');
says.forEach(p=>{if(reduce)return;const txt=p.textContent;p.setAttribute('aria-label',txt);p.innerHTML=txt.split(/(\s+)/).map(w=>/\s+/.test(w)?w:'<span class="w" aria-hidden="true">'+w+'</span>').join('');p._w=$$('.w',p);});
function readSay(vh){for(const p of says){if(!p._w)continue;const r=p.getBoundingClientRect();if(r.bottom<-vh*.5||r.top>vh*1.2)continue;const prog=clamp((vh*.94-r.top)/(vh*.32));const n=p._w.length,lit=prog*(n+3);for(let i=0;i<n;i++){const o=clamp(lit-i,0,1);const v=.14+.86*o;if(p._w[i]._o!==v){p._w[i]._o=v;p._w[i].style.opacity=v;}}}}

/* ---------- figures ---------- */
const figs=[];
function fig(sel,build,opts){const host=$(sel);if(!host)return;const svg=$('svg',host);const f=Object.assign({host,svg,build,draw:null,last:-1,w:0,h:0},opts||{});figs.push(f);if(window.ResizeObserver)new ResizeObserver(()=>{const r=svg.getBoundingClientRect();if(Math.round(r.width)!==f.w||Math.round(r.height)!==f.h)make(f);paint();}).observe(svg);}
function make(f){const r=f.svg.getBoundingClientRect();f.w=Math.round(r.width);f.h=Math.round(r.height);if(!f.w||!f.h)return;f.svg.setAttribute('viewBox','0 0 '+f.w+' '+f.h);f.svg.innerHTML='';f.draw=f.build(f.svg,f.w,f.h)||null;f.last=-1;}

/* one token, three layers */
fig('#fig-intro',(s,W,H)=>{
  const ys=[H*.84,H*.5,H*.16],names=['GPU kernels','Inference','Agents'],subs=['CUDA and Triton','llama.cpp and vLLM','memory and verification'],cols=[K,I,A],tx=W-26;
  const ls=ys.map((y,i)=>{const g=S('g',{},s);const l=S('line',{x1:0,x2:W,y1:y,y2:y,stroke:cols[i],'stroke-width':i===0?4:2,'stroke-linecap':'round'},g);const a=T(g,0,y-16,names[i],{class:'s',style:'font-size:'+(i===0?26:20)+'px;font-weight:500'});const b=T(g,0,y+24,subs[i],{});return{g,l,a,b};});
  const track=S('line',{x1:tx,x2:tx,y1:ys[0],y2:ys[0],stroke:'#fff','stroke-width':1.5,opacity:.5},s);
  const dot=S('circle',{cx:tx,cy:ys[0],r:8,fill:'#fff',style:'filter:drop-shadow(0 0 10px #fff)'},s);
  return p=>{const t=p*5;const pos=t<1?0:t<2?ease(seg(t,1,1.5))*.0:t<3?ease(seg(t,2,2.6)):t<4?1+ease(seg(t,3,3.6)):2;const y=pos<=1?lerp(ys[0],ys[1],pos):lerp(ys[1],ys[2],pos-1);dot.setAttribute('cy',y);track.setAttribute('y2',y);
    ls.forEach((o,i)=>{const on=t>=4?1:(t>=i+1&&t<i+2)?1:(t>=i+1?.5:.16);o.g.style.opacity=on;o.g.style.transition='opacity .4s';});};
},{pin:'#intro',key:1});

/* the stick */
fig('#fig-stick',(s,W,H)=>{
  const B=[.24,.31,.14,.27,.19,.34,.16,.29,.21,.33,.17,.25,.3,.2],N=B.length,yw=H*.2,ys=H*.56,h=Math.min(46,H*.13);
  let rem=1;const w=[];for(let i=0;i<N;i++){w.push(B[i]*rem);rem*=1-B[i];}
  const x=i=>W-14-(i*(W-28)/(N-1));
  const lk=S('g',{},s),st=S('g',{},s);
  S('rect',{x:0,y:ys,width:W,height:h,rx:5,fill:'none',stroke:LINE},s);
  T(s,W,yw-34,'newest word',{'text-anchor':'end',class:'s',style:'font-size:14px;fill:'+MID});T(s,0,yw-34,'earlier words',{class:'s',style:'font-size:14px;fill:'+MID});
  const left=T(s,8,ys+h+24,'what\'s left',{class:'s',style:'font-size:14px;fill:'+MID});
  let cx=W;const segs=[],links=[],dots=[];
  for(let i=0;i<N;i++){const sw=w[i]*W;cx-=sw;const a=S('rect',{x:cx+1,y:ys,width:Math.max(0,sw-2),height:h,rx:3,fill:i%2?K2:K},st);a.style.transformBox='fill-box';a.style.transformOrigin='right';segs.push(a);
    const mid=cx+sw/2;links.push(S('path',{d:'M'+x(i)+' '+(yw+12)+' C'+x(i)+' '+(yw+ys)/2+','+mid+' '+(yw+ys)/2+','+mid+' '+ys,fill:'none',stroke:i%2?K2:K,'stroke-width':1.2},lk));dots.push(S('circle',{cx:x(i),cy:yw,r:6,fill:OFF},s));}
  const remX=cx;
  return p=>{const k=p*N*1.25;
    for(let i=0;i<N;i++){const u=clamp(k-i);segs[i].style.transform='scaleX('+u+')';links[i].style.opacity=u>0?(k-i<1.6?.9:.22):0;dots[i].setAttribute('fill',u>0?(i%2?K2:K):OFF);const grow=seg(p,.8,1);dots[i].setAttribute('r',lerp(6,4+Math.sqrt(w[i])*34,u>0?grow:0));}
    left.setAttribute('x',8);left.style.opacity=seg(p,.05,.2);};
},{pin:'#stick',key:1});

/* the gain grows with the cache */
fig('#fig-ladder',(s,W,H)=>{
  const rows=[['1024',72.4,72.8,'1.0×'],['4096',275.0,929.4,'3.4×'],['16384',1082.4,14190.3,'13.1×'],['65536',4301.8,226529.2,'52.7×']],lab=W<560?52:74,ra=W<560?58:84,x=v=>lab+(Math.log10(v)-1.6)/(5.6-1.6)*(W-lab-ra);
  const top=30,rh=(H-top-6)/4;T(s,0,14,'keys',{});T(s,W,14,'gain',{'text-anchor':'end'});
  const gs=rows.map((r,i)=>{const y=top+rh*(i+.5),g=S('g',{},s);T(g,0,y+4,r[0],{style:'fill:'+INK});S('line',{x1:x(r[1]),x2:x(r[2]),y1:y,y2:y,stroke:LINE,'stroke-width':2},g);S('circle',{cx:x(r[2]),cy:y,r:6,fill:MID},g);S('circle',{cx:x(r[1]),cy:y,r:7,fill:K},g);
    if(i===0){T(g,x(r[1])+14,y+4,W<560?'72.4 and 72.8':'72.4 with the cache, 72.8 recomputing',{});}else if(W>=560){T(g,x(r[1]),y-14,r[1].toFixed(1),{'text-anchor':'middle'});T(g,x(r[2]),y-14,r[2].toFixed(1),{'text-anchor':'middle'});}
    if(i===1){T(g,x(r[1]),y+24,'with the cache',{'text-anchor':'middle',class:'s',style:'font-size:13px;fill:'+K});T(g,x(r[2]),y+24,'recomputing',{'text-anchor':'middle',class:'s',style:'font-size:13px;fill:'+MID});}
    T(g,W,y+5,r[3],{'text-anchor':'end',class:'b',style:'font-size:'+(i===3?20:15)+'px'});return g;});
  return p=>gs.forEach((g,i)=>g.style.opacity=seg(p,i/4.2,(i+1)/4.2));
});

/* the copy: draw the data that moves */
function copyFig(mode){return (s,W,H)=>{
  const top=26,hh=26,nar=W<560,b1=mode==='copy'?H*.46:H*.62,colW=W/8;
  T(s,0,14,'KV cache: 8 heads, stored once',{class:'s',style:'font-size:14px'});
  const tops=[];for(let i=0;i<8;i++){const x=i*colW+3;tops.push(S('rect',{x,y:top,width:colW-6,height:hh,rx:3,fill:K},s));}
  const lines=[],bots=[];const bw=W/64;
  for(let j=0;j<64;j++){const i=j>>3,x0=i*colW+colW/2,x1=j*bw+bw/2;lines.push(S('line',{x1:x0,y1:top+hh,x2:x1,y2:b1,stroke:mode==='copy'?K:INK,'stroke-width':1,opacity:0},s));
    if(mode==='copy')bots.push(S('rect',{x:j*bw+.6,y:b1,width:Math.max(1,bw-1.2),height:hh+6,rx:1,fill:K2,opacity:0},s));else bots.push(S('circle',{cx:x1,cy:b1+4,r:Math.min(3.4,bw*.36),fill:INK,opacity:0},s));}
  T(s,0,b1+hh+28,mode==='copy'?(W<560?'Workspace: 64 copies':'Workspace: 64 copies, written before the math starts'):'64 query heads read the 8 KV heads directly. No workspace.',{class:'s',style:'font-size:14px'});
  let bar=null;
  if(mode==='copy'){const y=H-46,sc=v=>v/14*W;const g=S('g',{},s);
    const c=S('rect',{x:0,y,width:sc(7.28),height:20,rx:3,fill:K},g);const a=S('rect',{x:sc(7.28)+3,y,width:sc(6.0)-3,height:20,rx:3,fill:'#59606b'},g);const a2=S('rect',{x:sc(13.28)+1,y,width:sc(.7),height:20,rx:3,fill:'#3a3f47'},g);
    const lc=T(g,0,y+40,'Copying 7.28 ms',{class:'s',style:'font-size:15px;fill:'+K});const la=T(g,sc(7.28)+3,y+40,'Attention 6.0-6.7 ms',{class:'s',style:'font-size:15px'});bar={c,a,a2,lc,la,sc};}
  return p=>{for(let j=0;j<64;j++){const u=seg(p,.05+j/64*.55,.05+j/64*.55+.08);lines[j].setAttribute('opacity',u*(mode==='copy'?.32:.22));bots[j].setAttribute('opacity',u);}
    if(bar){const u=seg(p,.55,.85),v=seg(p,.8,1);bar.c.style.transformOrigin='left';bar.c.style.transformBox='fill-box';bar.c.style.transform='scaleX('+u+')';[bar.a,bar.a2,bar.la].forEach(e=>e.style.opacity=v);bar.lc.style.opacity=u;}};
};}
fig('#fig-copy',copyFig('copy'));fig('#fig-nocopy',copyFig('direct'));

/* which KV head does each query head read? */
let headShape=[8,4];
fig('#fig-heads',(s,W,H)=>{
  const [q,kv]=headShape,r=q/kv,yq=30,yk=H-34,xq=i=>16+(i+.5)*(W-32)/q,xk=i=>16+(i+.5)*(W-32)/kv;
  T(s,0,12,'query heads',{class:'s',style:'font-size:14px;fill:'+MID});T(s,0,H-2,'KV heads',{class:'s',style:'font-size:14px;fill:'+MID});
  for(let h=0;h<q;h++){const a=Math.floor(h/r),b=Math.floor(h/kv)%kv;S('line',{x1:xq(h),y1:yq,x2:xk(a),y2:yk,stroke:INK,'stroke-width':2,opacity:.75},s);if(a!==b)S('line',{x1:xq(h),y1:yq,x2:xk(b),y2:yk,stroke:K,'stroke-width':2,'stroke-dasharray':'5 4'},s);}
  for(let h=0;h<q;h++)S('circle',{cx:xq(h),cy:yq,r:6,fill:INK},s);
  for(let i=0;i<kv;i++)S('rect',{x:xk(i)-18,y:yk-7,width:36,height:14,rx:3,fill:'#59606b'},s);
  const same=Array.from({length:q},(_,h)=>Math.floor(h/r)===Math.floor(h/kv)%kv).every(Boolean);const v=$('#hm-v');v.innerHTML=same?"Same lines. A test at this shape can't see the bug.":'<span style="color:'+K+'">Dashed lines are the bug.</span> A test at this shape catches it.';v.classList.toggle('same',same);
});
$$('#heads button').forEach(b=>b.addEventListener('click',()=>{headShape=[+b.dataset.q,+b.dataset.kv];$$('#heads button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));const f=figs.find(x=>x.host.id==='fig-heads');if(f)make(f);}));

/* three kernels become one, and the memory arrows disappear */
fig('#fig-fuse',(s,W,H)=>{
  const yk=34,bh=52,ym=H-34,names=['linear','bias','GeLU'],gap=W*.1,bw=(W-2*gap)/3;
  T(s,0,14,'kernels',{class:'s',style:'font-size:14px;fill:'+MID});T(s,0,H-2,'HBM',{class:'s',style:'font-size:14px;fill:'+MID});
  S('line',{x1:0,x2:W,y1:ym,y2:ym,stroke:'#59606b','stroke-width':3},s);
  const boxes=names.map((n,i)=>{const g=S('g',{},s);const r=S('rect',{y:yk,height:bh,rx:6,fill:K},g);const t=T(g,0,yk+bh/2+6,n,{'text-anchor':'middle',class:'s',style:'font-weight:500;fill:#120B06;font-size:16px'});return{g,r,t};});
  const arrows=[];for(let i=0;i<2;i++){const g=S('g',{},s);const x0=(i+1)*bw+i*gap-bw*.2,x1=(i+1)*(bw+gap)+bw*.2;
    S('path',{d:'M'+x0+' '+(yk+bh)+' L'+x0+' '+(ym-2),stroke:INK,'stroke-width':1.5,fill:'none'},g);S('path',{d:'M'+(x0-5)+' '+(ym-9)+' L'+x0+' '+(ym-2)+' L'+(x0+5)+' '+(ym-9),stroke:INK,'stroke-width':1.5,fill:'none'},g);T(g,x0-8,(yk+bh+ym)/2,'writes',{'text-anchor':'end'});
    S('path',{d:'M'+x1+' '+(ym-2)+' L'+x1+' '+(yk+bh+2),stroke:INK,'stroke-width':1.5,fill:'none'},g);S('path',{d:'M'+(x1-5)+' '+(yk+bh+9)+' L'+x1+' '+(yk+bh+2)+' L'+(x1+5)+' '+(yk+bh+9),stroke:INK,'stroke-width':1.5,fill:'none'},g);T(g,x1+8,(yk+bh+ym)/2,'reads',{});arrows.push(g);}
  const one=T(s,W/2,yk+bh/2+6,'one fused kernel',{'text-anchor':'middle',class:'s',style:'font-weight:500;fill:#120B06;font-size:17px'});
  const kept=T(s,W/2,(yk+bh+ym)/2,'the intermediate stays in registers',{'text-anchor':'middle',class:'s',style:'font-size:14px;fill:'+MID});
  return p=>{const m=ease(seg(p,.5,.95));boxes.forEach((b,i)=>{const x0=i*(bw+gap),x=lerp(x0,0,m),w=lerp(bw,W,m);b.r.setAttribute('x',x);b.r.setAttribute('width',w);b.t.setAttribute('x',x+w/2);b.t.style.opacity=1-m*1.6;b.g.style.opacity=seg(p,i*.1,i*.1+.15);});
    arrows.forEach((a,i)=>a.style.opacity=seg(p,.2+.08*i,.3+.08*i)*(1-seg(p,.5,.72)));one.style.opacity=seg(p,.82,.98);kept.style.opacity=seg(p,.85,1);};
});

/* 76 shapes */
const TRI=[[128,4096,4096,0.856,0.876],[128,4096,11008,0.759,0.7],[128,4096,16384,0.696,0.622],[128,5120,5120,0.991,1.02],[128,5120,13824,0.835,0.769],[128,5120,20480,0.735,0.728],[128,8192,8192,0.962,0.972],[128,8192,28672,0.717,0.733],[128,8192,32768,0.708,0.717],[128,11008,4096,1.731,1.282],[128,13824,5120,1.336,1.39],[128,16384,4096,1.01,0.986],[128,20480,5120,0.966,0.982],[128,28672,8192,1.079,1.285],[128,32768,8192,1.081,1.263],[256,4096,4096,1.079,1.117],[256,4096,11008,0.777,0.772],[256,4096,16384,0.718,0.708],[256,5120,5120,1.079,1.084],[256,5120,13824,0.876,0.97],[256,5120,20480,0.795,0.796],[256,8192,8192,0.785,0.765],[256,8192,28672,0.582,0.606],[256,8192,32768,0.604,0.619],[256,11008,4096,1.052,1.011],[256,13824,5120,0.995,0.998],[256,16384,4096,1.015,1.237],[256,20480,5120,1.055,1.208],[256,28672,8192,0.94,0.951],[256,32768,8192,0.962,0.966],[512,4096,4096,0.899,1.039],[512,4096,11008,0.724,0.742],[512,4096,16384,0.683,0.701],[512,5120,5120,1.32,0.945],[512,5120,13824,0.729,0.731],[512,5120,20480,0.717,0.718],[512,8192,8192,1.085,0.945],[512,8192,28672,0.754,0.773],[512,8192,32768,0.749,0.769],[512,11008,4096,1.015,1.004],[512,13824,5120,0.99,0.984],[512,16384,4096,1.028,1.155],[512,20480,5120,0.999,1.001],[512,28672,8192,0.965,0.997],[512,32768,8192,0.931,0.938],[1024,4096,4096,1.136,1.186],[1024,4096,11008,0.806,0.852],[1024,4096,16384,0.813,0.793],[1024,5120,5120,1.042,1.211],[1024,5120,13824,0.981,0.903],[1024,5120,20480,0.94,0.859],[1024,8192,8192,0.97,0.958],[1024,8192,16384,0.932,0.876],[1024,8192,28672,0.887,0.889],[1024,8192,32768,0.882,0.886],[1024,11008,4096,1.123,1.132],[1024,13824,5120,1.077,1.021],[1024,16384,4096,1.014,1.07],[1024,20480,5120,1.062,1.01],[1024,28672,8192,0.978,0.972],[1024,32768,8192,1.081,0.961],[2048,4096,4096,1.03,1.157],[2048,4096,11008,0.91,0.915],[2048,4096,16384,0.87,0.873],[2048,5120,5120,1.073,0.999],[2048,5120,13824,0.866,0.865],[2048,5120,20480,0.838,0.838],[2048,8192,8192,0.919,0.923],[2048,8192,28672,0.835,0.841],[2048,8192,32768,0.87,0.884],[2048,11008,4096,1.135,1.11],[2048,13824,5120,1.024,1.021],[2048,16384,4096,1.137,1.093],[2048,20480,5120,1.018,1.016],[2048,28672,8192,0.933,0.933],[2048,32768,8192,0.992,0.939]];
let prec='fp16';
fig('#fig-swarm',(s,W,H)=>{
  const ms=[128,256,512,1024,2048],L=44,Rr=8,T0=14,B=34,yy=v=>T0+(1.8-v)/(1.8-.55)*(H-T0-B),gw=(W-L-Rr)/5;
  [[1,'parity'],[1.4,'1.4×'],[.6,'0.6×']].forEach(([v,lb])=>{S('line',{x1:L,x2:W-Rr,y1:yy(v),y2:yy(v),stroke:v===1?'#fff':LINE,'stroke-width':1,'stroke-dasharray':v===1?'4 4':'',opacity:v===1?.55:1},s);T(s,L-8,yy(v)+4,v===1?'1×':lb,{'text-anchor':'end'});});
  T(s,W-Rr,yy(1.4)-10,'Above the dashed line: faster than separate kernels',{'text-anchor':'end',class:'s',style:'font-size:13px;fill:'+MID});
  ms.forEach((m,i)=>T(s,L+gw*(i+.5),H-8,'batch '+m,{'text-anchor':'middle'}));
  const dots=[];ms.forEach((m,i)=>{const g=TRI.filter(r=>r[0]===m),n=g.length;g.forEach((r,k)=>{const x=L+gw*i+gw*.12+(n>1?k/(n-1):.5)*gw*.76;const c=S('circle',{cx:x,cy:yy(r[3]),r:W<560?4:6,fill:'#59606b'},s);c.__r=r;c.style.transition='cy .55s cubic-bezier(.2,.7,.2,1),fill .3s';dots.push(c);});});
  const best=T(s,0,0,'',{class:'b'});
  const set=()=>{let bi=0,bv=0;dots.forEach((c,i)=>{const v=prec==='fp16'?c.__r[3]:c.__r[4];c.setAttribute('cy',yy(v));c.style.cy=yy(v)+'px';c.setAttribute('fill',v>1?I:'#59606b');if(v>bv){bv=v;bi=i;}});const b=dots[bi],x=+b.getAttribute('cx');best.textContent=bv.toFixed(2)+'×';best.setAttribute('x',x+12);best.setAttribute('y',yy(bv)+5);};set();
  s.__set=set;
  s.onpointermove=e=>{const c=e.target;if(c.__r){const v=prec==='fp16'?c.__r[3]:c.__r[4];showTip('<b>M='+c.__r[0]+', N='+c.__r[1]+', K='+c.__r[2]+'</b><br>'+v.toFixed(2)+'× against separate kernels',e.clientX,e.clientY);}else hideTip();};s.onpointerleave=hideTip;
  return p=>dots.forEach((c,i)=>c.style.opacity=seg(p,i/90,i/90+.2));
});
$$('#sc-seg button').forEach(b=>b.addEventListener('click',()=>{prec=b.dataset.v;$$('#sc-seg button').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));const sv=$('#fig-swarm svg');if(sv.__set)sv.__set();$('#sc-note').textContent=prec==='fp16'?'Each dot is one matrix size. Hover for its dimensions. Median 0.96×, with 27 faster than separate kernels.':'Each dot is one matrix size. Hover for its dimensions. In bf16 the median is 0.95×, with 25 faster than separate kernels.';}));

/* 12 configurations */
const GRID=[['gpt-oss-120b, faster-memory host',[['11%',34.9,54.0,69.9],['25%',40.0,85.6,109.2],['40%',47.7,132.2,152.5]]],['Qwen3-30B-A3B, faster-memory host',[['12.5%',19.5,38.7,40.0],['25%',22.1,54.7,63.1],['43.75%',28.4,103.1,108.2]]],['gpt-oss-120b, stock-clock host',[['11%',28.9,48.0,57.9],['25%',33.6,78.7,94.1],['40%',40.1,122.2,133.6]]],['Qwen3-30B-A3B, stock-clock host',[['12.5%',16.1,32.7,33.5],['25%',18.5,51.4,53.9],['43.75%',23.8,98.3,95.8]]]];
fig('#fig-grid',(s,W,H)=>{
  const cols=W<760?1:2,cg=44,pw=(W-cg*(cols-1))/cols,rowsN=Math.ceil(4/cols),ph=H/rowsN,gs=[];
  GRID.forEach((pn,ip)=>{const px=(ip%cols)*(pw+cg),py=Math.floor(ip/cols)*ph,lab=58,x=v=>px+lab+v/160*(pw-lab-6);const g=S('g',{},s);T(g,px,py+18,pn[0],{class:'s',style:'font-weight:500'});
    const rh=(ph-70)/3;pn[1].forEach((r,ir)=>{const y=py+42+rh*(ir+.5),rg=S('g',{},g);T(rg,px,y+4,r[0],{style:'fill:'+INK});S('line',{x1:x(r[1]),x2:x(Math.max(r[2],r[3])),y1:y,y2:y,stroke:LINE,'stroke-width':2},rg);
      S('circle',{cx:x(r[1]),cy:y,r:6,fill:'#060708',stroke:MID,'stroke-width':2},rg);const d=x(r[2]);S('path',{d:'M'+d+' '+(y-7)+' L'+(d+7)+' '+y+' L'+d+' '+(y+7)+' L'+(d-7)+' '+y+'Z',fill:'#C9CED6'},rg);S('circle',{cx:x(r[3]),cy:y,r:7,fill:K,stroke:'#060708','stroke-width':1.5},rg);
      const hit=S('rect',{x:px,y:y-rh/2,width:pw,height:rh,fill:'transparent'},rg);hit.onpointermove=e=>showTip('<b>'+r[0]+' on the GPU</b><br>My cache '+r[3].toFixed(1)+'<br>FreeToken '+r[2].toFixed(1)+'<br>Stock '+r[1].toFixed(1)+' tokens/s',e.clientX,e.clientY);hit.onpointerleave=hideTip;
      if(r[3]<r[2]){S('circle',{cx:x(r[3]),cy:y,r:13,fill:'none',stroke:'#fff','stroke-width':1},rg);T(rg,x(r[3])-18,y+4,'0.97×',{'text-anchor':'end',style:'fill:'+INK});}gs.push(rg);});
    T(g,px+lab,py+ph-14,'0',{});T(g,px+pw-6,py+ph-14,'160 tokens/s',{'text-anchor':'end'});});
  return p=>gs.forEach((g,i)=>g.style.opacity=seg(p,i/14,i/14+.25));
});

/* the ruler */
const MS={'000':20.59,'010':20.18,'100':20.11,'110':15.13,'111':13.78};
let fsKey='000',fsTouched=false;
fig('#fig-ruler',(s,W,H)=>{
  const x=v=>(v-9.2)/(21.2-9.2)*W,y=H-44;
  S('line',{x1:0,x2:W,y1:y,y2:y,stroke:LINE,'stroke-width':2},s);
  [[20.59,''],[15.13,''],[13.78,'']].forEach(([v])=>{S('line',{x1:x(v),x2:x(v),y1:y-6,y2:y+6,stroke:MID},s);T(s,x(v),y+24,v.toFixed(2),{'text-anchor':'middle'});});
  S('line',{x1:x(10.02),x2:x(10.02),y1:y-12,y2:y+12,stroke:'#fff','stroke-width':2},s);T(s,x(10.02),y+24,'10.02',{'text-anchor':'middle',style:'fill:'+INK});T(s,x(10.02),y-20,'the limit',{'text-anchor':'middle',class:'s',style:'font-size:14px'});
  const br=S('g',{},s);S('path',{d:'M'+x(10.02)+' '+(y-3)+' H'+x(13.78),stroke:I,'stroke-width':4},br);T(br,(x(10.02)+x(13.78))/2+24,y-20,'still left',{'text-anchor':'middle',class:'s',style:'font-size:14px;fill:'+I});
  const m=S('circle',{cx:x(20.59),cy:y,r:10,fill:I,style:'transition:cx .55s cubic-bezier(.2,.7,.2,1);filter:drop-shadow(0 0 10px rgba(255,180,84,.7))'},s);
  s.__m=v=>{m.setAttribute('cx',x(v));m.style.cx=x(v)+'px';br.style.opacity=v<14?1:0;};s.__m(MS[fsKey]);
},{auto:p=>{if(fsTouched)return;const k=p<.4?'000':p<.72?'110':'111';if(k!==fsKey)setFs(k,false);}});
const fsNote={'000':'The deployed cache, with no foresight.','010':"The deployed cache's choices, each part read once.",'100':"Foresight about what to keep, each part read twice.",'110':"Foresight about what to keep, each part read once.",'111':"The same, with each copy started before it's needed."};
let fsCur=20.59,fsRaf=0;
function setFs(k,fromUser){fsKey=k;const sw=$$('#foresight .sw');sw.forEach((b,i)=>b.setAttribute('aria-checked',k[i]==='1'?'true':'false'));sw[2].disabled=!(k[0]==='1'&&k[1]==='1');const v=MS[k];$('#fs-n').textContent=fsNote[k];const sv=$('#fig-ruler svg');if(sv.__m)sv.__m(v);cancelAnimationFrame(fsRaf);const from=fsCur,t0=performance.now(),o=$('#fs-v');const tick=t=>{const f=clamp((t-t0)/450),e=1-Math.pow(1-f,3);fsCur=from+(v-from)*e;o.textContent=fsCur.toFixed(2);if(f<1)fsRaf=requestAnimationFrame(tick);};fsRaf=requestAnimationFrame(tick);}
$$('#foresight .sw').forEach((b,i)=>b.addEventListener('click',()=>{fsTouched=true;const a=fsKey.split('');a[i]=a[i]==='1'?'0':'1';if(a[2]==='1'&&!(a[0]==='1'&&a[1]==='1'))a[2]='0';if(!(a[0]==='1'&&a[1]==='1'))a[2]='0';setFs(a.join(''),true);}));

/* bert: two measured sizes */
function slope(all){return (s,W,H)=>{
  const L=W<560?60:150,Rr=W<560?60:150,T0=14,B=34,x1=L,x2=W-Rr,y=v=>T0+(1-v)*(H-T0-B);
  S('line',{x1,x2:x1,y1:T0,y2:H-B,stroke:LINE},s);S('line',{x1:x2,x2,y1:T0,y2:H-B,stroke:LINE},s);T(s,x1,H-10,'98,519 tokens',{'text-anchor':'middle',style:'fill:'+INK});T(s,x2,H-10,'1.26M tokens',{'text-anchor':'middle',style:'fill:'+INK});
  const ser=[['full context',.90,.08,[.80,.98],[.02,.16],MID,0],['bert',.96,.90,[.90,1],[.82,.98],R,-1],['agentic grep',.92,.90,[.84,.98],[.82,.98],I,1]];
  const gs=[];ser.forEach((r,i)=>{if(!all&&i>0)return;const g=S('g',{},s);const dx=r[6]*7;const ln=S('line',{x1:x1+dx,x2:x2+dx,y1:y(r[1]),y2:y(r[2]),stroke:r[5],'stroke-width':2.5},g);ln.setAttribute('stroke-dasharray','2000');ln.setAttribute('stroke-dashoffset','2000');
    S('line',{x1:x1+dx,x2:x1+dx,y1:y(r[3][0]),y2:y(r[3][1]),stroke:r[5],opacity:.6},g);S('line',{x1:x2+dx,x2:x2+dx,y1:y(r[4][0]),y2:y(r[4][1]),stroke:r[5],opacity:.6},g);S('circle',{cx:x1+dx,cy:y(r[1]),r:6,fill:r[5]},g);const c2=S('circle',{cx:x2+dx,cy:y(r[2]),r:6,fill:r[5]},g);
    const ly1=i===0?y(r[1])+16:i===1?y(r[1])-2:y(r[1])+4;T(g,x1-16,ly1,r[0]+' '+r[1].toFixed(2),{'text-anchor':'end',style:'fill:'+r[5]});if(i!==2||!all){if(i===0){T(g,x2+16,y(r[2])+4,'full context '+r[2].toFixed(2),{style:'fill:'+r[5]});}else{T(g,x2+16,y(r[2])+4,'bert and grep 0.90',{style:'fill:'+INK});}}gs.push([g,ln,c2]);});
  return p=>gs.forEach(([g,ln,c2],i)=>{const u=seg(p,.15+i*.14,.7+i*.08);g.style.opacity=seg(p,i*.12,.15+i*.12);ln.setAttribute('stroke-dashoffset',2000*(1-u));c2.style.opacity=u>.95?1:0;});
};}
fig('#fig-slope1',slope(false));fig('#fig-slope2',slope(true));

/* forensics of a forged signature */
function seq(steps,lanes){return (s,W,H)=>{
  const nar=W<560,xs=lanes.map((n,i)=>(i+.5)*W/lanes.length),top=26,bot=H-6;
  lanes.forEach((n,i)=>{T(s,xs[i],16,n[0],{'text-anchor':'middle',class:'s',style:'font-weight:500;font-size:'+(nar?13:16)+'px'});S('line',{x1:xs[i],x2:xs[i],y1:top,y2:bot,stroke:n[1]||LINE,'stroke-width':n[2]||1.5,'stroke-dasharray':n[3]||''},s);});
  const rh=(bot-top-14)/steps.length,gs=steps.map((st,i)=>{const y=top+rh*(i+.72),g=S('g',{},s),a=xs[st.f],b=st.t==null?a:xs[st.t],col=st.c||INK,dir=b>a?1:-1;
    if(st.t===st.f||st.t==null){const r=38;S('path',{d:'M'+a+' '+(y-14)+' h'+r+' v18 h-'+(r-8),fill:'none',stroke:col,'stroke-width':2},g);S('path',{d:'M'+(a+15)+' '+(y-1)+' l-7 3 l7 3',fill:'none',stroke:col,'stroke-width':2},g);T(g,a+r+8,y-2,st.l,{class:'s',style:'font-size:'+(nar?12:14)+'px;fill:'+col});return g;}
    if(st.broken){const mid=lerp(a,b,st.broken);S('line',{x1:a,x2:mid,y1:y,y2:y,stroke:col,'stroke-width':2,'stroke-dasharray':st.dash||''},g);S('path',{d:'M'+(mid-7)+' '+(y-7)+' l14 14 m0 -14 l-14 14',stroke:col,'stroke-width':2.5},g);}
    else{S('line',{x1:a,x2:b-dir*6,y1:y,y2:y,stroke:col,'stroke-width':2,'stroke-dasharray':st.dash||''},g);S('path',{d:'M'+(b-dir*12)+' '+(y-6)+' L'+b+' '+y+' L'+(b-dir*12)+' '+(y+6),fill:'none',stroke:col,'stroke-width':2},g);}
    T(g,(a+b)/2,y-10,st.l,{'text-anchor':'middle',class:'s',style:'font-size:'+(nar?12:14)+'px;fill:'+col});return g;});
  return p=>gs.forEach((g,i)=>g.style.opacity=seg(p,i/gs.length,(i+.8)/gs.length));
};}
fig('#fig-seq1',seq([{f:0,t:1,l:'starts the session'},{f:1,t:3,l:'writes 5 PI sign-offs',c:K},{f:1,t:2,l:'never called',c:DIM,dash:'5 5',broken:.8}],[['Runner'],['Director',A,2],['PI agent','rgba(255,255,255,.1)',1.5,'3 5'],['Lab record']]));
fig('#fig-seq2',seq([{f:0,t:1,l:'starts the session, logs every call'},{f:1,t:3,l:'writes a PI sign-off',c:K},{f:1,t:2,l:'never called',c:DIM,dash:'5 5',broken:.8},{f:0,t:3,l:'compares the sign-off with its log',c:R},{f:0,t:0,l:'no call logged: refused',c:R}],[['Runner',R,2],['Director',A,2],['PI agent','rgba(255,255,255,.1)',1.5,'3 5'],['Lab record']]));


/* for engineers */
fig('#fig-ratio',(s,W,H)=>{
  const rows=[['B=8, T=1024',1.04],['B=4, T=2048',1.07],['B=2, T=4096',1.16],['B=1, T=8192',1.20],['B=4, T=2048, H=32',1.42],['Packed 512+...+5120',1.07],['Packed 8×1024',1.32],['Packed 8192',1.19]],x=v=>12+(v-1)/.46*(W-24),y=H-30;
  S('line',{x1:12,x2:W-12,y1:y,y2:y,stroke:LINE,'stroke-width':2},s);T(s,x(1),y+22,'1.0× the authors',{});T(s,W-12,y+22,'1.42×',{'text-anchor':'end'});
  rows.forEach((r,i)=>{const c=S('circle',{cx:x(r[1]),cy:y-((i%3)+1)*17,r:6,fill:K},s);c.onpointermove=e=>showTip('<b>'+r[0]+'</b><br>'+r[1].toFixed(2)+'×',e.clientX,e.clientY);c.onpointerleave=hideTip;S('line',{x1:x(r[1]),x2:x(r[1]),y1:y,y2:y-((i%3)+1)*17,stroke:LINE},s);});
});
let occRegs=255;
fig('#fig-occ',(s,W,H)=>{
  const regs=occRegs,ctas=Math.min(16,Math.floor(65536/(128*regs))),warps=ctas*4,cw=128*regs/65536*W;
  T(s,0,14,'The SM\'s register file: 65536 registers',{class:'s',style:'font-size:14px;fill:'+MID});S('rect',{x:0,y:24,width:W,height:30,rx:4,fill:'none',stroke:LINE},s);
  for(let i=0;i<ctas;i++)S('rect',{x:i*cw+1,y:24,width:Math.max(1,cw-2),height:30,rx:3,fill:i%2?I:K},s);
  T(s,0,84,'64 warp slots',{class:'s',style:'font-size:14px;fill:'+MID});const n=64,gap=W/n;for(let i=0;i<n;i++)S('circle',{cx:(i+.5)*gap,cy:104,r:Math.min(5,gap*.38),fill:i<warps?(Math.floor(i/4)%2?I:K):OFF},s);
  T(s,0,146,ctas+' CTAs of 4 warps, '+warps+' of 64 warps, '+(warps/64*100).toFixed(1)+'% occupancy',{class:'b'});
});
const occR=$('#occ-r');if(occR)occR.addEventListener('input',()=>{occRegs=+occR.value;$('#occ-o').textContent=occR.value;const f=figs.find(x=>x.host.id==='fig-occ');if(f)make(f);});
fig('#fig-gqatab',(s,W,H)=>{
  const rows=[['64/8 d128',14.57,6.66,3.30,'2.19×'],['64/8 d64',8.23,4.23,4.09,'1.95×'],['32/8 d128',9.91,6.66,3.30,'1.49×'],['32/2 d256',17.15,12.55,9.96,'1.37×'],['8/1 d128',7.59,6.63,3.30,'1.15×']],L=84,Rr=56,x=v=>L+v/18*(W-L-Rr),rh=(H-30)/5;
  rows.forEach((r,i)=>{const y=30+rh*(i+.5);T(s,0,y+4,r[0],{style:'fill:'+INK});S('line',{x1:x(r[2]),x2:x(r[1]),y1:y,y2:y,stroke:K,'stroke-width':2},s);S('circle',{cx:x(r[1]),cy:y,r:6,fill:'#060708',stroke:MID,'stroke-width':2},s);S('circle',{cx:x(r[2]),cy:y,r:7,fill:K},s);const d=x(r[3]);S('path',{d:'M'+d+' '+(y-7)+' L'+(d+7)+' '+y+' L'+d+' '+(y+7)+' L'+(d-7)+' '+y+'Z',fill:'#C9CED6'},s);T(s,W,y+4,r[4],{'text-anchor':'end',class:'b'});if(i===0){T(s,x(r[1]),y-14,'develop',{'text-anchor':'middle',class:'s',style:'font-size:13px;fill:'+MID});T(s,x(r[2]),y-14,'prototype',{'text-anchor':'middle',class:'s',style:'font-size:13px;fill:'+K});T(s,d,y-14,'backend',{'text-anchor':'middle',class:'s',style:'font-size:13px;fill:#C9CED6'});}});
});

/* ---------- pinned captions ---------- */
const pins=$$('.pin').map(el=>({el,n:+el.dataset.steps,caps:$$('[data-at]',el)}));

/* ---------- the frame ---------- */
const sheets=$$('.story').map(el=>({el,bar:$('.shead',el),link:$('.it[href="#'+el.id+'"]'),v:-1})).filter(s=>s.bar);let sheetOn=null;
let queued=false;
function paint(){if(queued)return;queued=true;requestAnimationFrame(()=>{queued=false;frame();});}
function frame(){
  const vh=innerHeight,st=isStatic();
  if(!st)readSay(vh);
  for(const f of figs){const r=f.svg.getBoundingClientRect();if(!r.width)continue;if(!f.draw&&f.w===0)make(f);
    let p=1;
    if(!st){if(f.pin){const pe=$(f.pin),b=pe.getBoundingClientRect();p=clamp(-b.top/Math.max(1,pe.offsetHeight-vh));}else{if(r.bottom<-200||r.top>vh+200)continue;p=clamp((vh*.98-r.top)/(vh*.4));}}
    if(f.auto&&!st)f.auto(p);
    if(f.draw&&Math.abs(p-f.last)>.001){f.draw(p);f.last=p;}}
  for(const q of pins){if(st){q.caps.forEach(c=>c.classList.add('on'));continue;}const b=q.el.getBoundingClientRect();const t=clamp(-b.top/Math.max(1,q.el.offsetHeight-vh))*q.n,i=Math.min(q.n-1,Math.floor(t));q.caps.forEach(c=>c.classList.toggle('on',+c.dataset.at===i));}
  let on=null;for(const s of sheets){const r=s.el.getBoundingClientRect();if(r.top<vh*.5&&r.bottom>vh*.5)on=s;if(r.bottom<-40||r.top>vh+40)continue;const v=clamp((vh*.55-r.top)/Math.max(1,r.height-vh*.1));if(v!==s.v){s.v=v;s.bar.style.setProperty('--sp',v.toFixed(4));if(s.link)s.link.style.setProperty('--sp',v.toFixed(4));}}
  if(on!==sheetOn){if(sheetOn&&sheetOn.link)sheetOn.link.classList.remove('on');if(on&&on.link)on.link.classList.add('on');sheetOn=on;}
  chapters(vh);zones(vh);
}
addEventListener('scroll',paint,{passive:true});addEventListener('resize',()=>{figs.forEach(make);paint();});addEventListener('load',()=>{figs.forEach(make);paint();});
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(()=>{figs.forEach(make);paint();});

/* ---------- where you are ---------- */
const CH=[['#ch-k',0,.5,'#FF6A4D','/Harshith_Kantamneni_Resume.pdf',[255,106,77]],['#ch-i',.5,.75,'#FFB454','/resume/inference/Harshith_Kantamneni_Resume.pdf',[255,180,84]],['#ch-a',.75,1,'#6AA8FF','/resume/agents/Harshith_Kantamneni_Resume.pdf',[106,168,255]]];
const tok=null,bar=$('.pbar'),nav=$('#nav-res'),fres=$('#foot-res'),rail=$('.idx');let active=-2;
function chapters(vh){const y=scrollY+vh*.5,tops=CH.map(c=>yOf($(c[0]))),end=yOf($('#next'));let ch=-1,t=0;for(let i=0;i<CH.length;i++){const a=tops[i],b=i<2?tops[i+1]:end;if(y>=a){ch=i;t=CH[i][1]+(CH[i][2]-CH[i][1])*clamp((y-a)/Math.max(1,b-a));}}if(y>=end){ch=-1;t=1;}
  if(tok)tok.style.bottom=(t*100)+'%';if(bar)bar.style.transform='scaleX('+t.toFixed(4)+')';
  if(ch!==active){active=ch;root.style.setProperty('--ch',ch>=0?CH[ch][3]:'#9398A0');if(rail)rail.classList.toggle('live',ch>=0);$$('.nl a[data-l]').forEach(a=>a.classList.toggle('on',+a.dataset.l===ch));$$('.glow').forEach((g,i)=>g.style.opacity=i===ch?1:0);const h=ch>=0?CH[ch][4]:CH[0][4];if(nav)nav.href=h;if(fres)fres.href=h;if(window.__field)window.__field.tint(ch>=0?CH[ch][5]:null);}}

/* ---------- dots: titles and the few figures made of dots ---------- */
const F=window.__field||{bind(){},text(){},release(){},releaseIf(){},tint(){},sync(){}};
let zoneNow=null;const fieldZones=$$('.ptitle,[data-field]');
function zones(vh){let z=null;for(const e of fieldZones){const r=e.getBoundingClientRect();if(r.height&&r.top<vh*.97&&r.bottom>vh*.06){z=e;break;}}if(z!==zoneNow){zoneNow=z;if(!z){F.release();return;}if(z.classList.contains('ptitle'))F.text(z);else F.bind(z);}if(z&&z.id==='fz-bug'){const fx=z.getBoundingClientRect().top<vh*.42;if(z.classList.contains('fixed')!==fx){z.classList.toggle('fixed',fx);F.bind(z);}}}
const jr=$('#jet-r');if(jr){const cs=$$('#fz-jet .jc'),o=$('#jet-o');const js=()=>{const i=+jr.value;cs.forEach((c,k)=>c.classList.toggle('sel',k===i));const c=cs[i];o.textContent='Each dot is ten microseconds. '+c.dataset.v+' microseconds at '+c.dataset.k+' keys.';if(zoneNow&&zoneNow.id==='fz-jet')F.bind('#fz-jet');};jr.addEventListener('input',js);cs.forEach((c,k)=>c.classList.toggle('sel',k===+jr.value));}

/* ---------- reading the merged kernel ---------- */
const ct=$('#code-tabs');if(ct){const lines=$$('#code-pre .ln'),sy=$('#code-say');const set=b=>{$$('button',ct).forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));const [a,z]=b.dataset.r.split('-').map(Number);lines.forEach((l,i)=>l.classList.toggle('hl',i>=a&&i<=z));sy.textContent=b.dataset.say;};$$('button',ct).forEach(b=>b.addEventListener('click',()=>set(b)));set($('button',ct));}
$$('details.eng').forEach(d=>d.addEventListener('toggle',()=>{if(d.open)figs.forEach(f=>{if(d.contains(f.host))make(f);});paint();}));

if(reduce||qs.has('static'))root.classList.add('static');

/* ---------- J and K step through the story, for walking someone through it ---------- */
const hud=$('#step-hud');let hudT=0,lastI=-1,lastT=0;
function stops(){const out=[];const vh=innerHeight;$$('.hero,.pin,.plate,.beat,.block,.close,footer').forEach(e=>{if(e.offsetParent===null&&e.tagName!=='FOOTER')return;if(e.closest('.pin')&&!e.classList.contains('pin'))return;const r=e.getBoundingClientRect(),top=r.top+scrollY;if(!r.height)return;if(e.classList.contains('pin')&&!root.classList.contains('static')){const n=+e.dataset.steps,h=e.offsetHeight-vh;for(let i=0;i<n;i++)out.push(top+(i+.5)/n*h);return;}out.push(r.height>=vh*.9?top-70:top-(vh-r.height)/2);});return out.sort((a,b)=>a-b);}
function step(dir){const s=stops(),y=scrollY,t=performance.now();let i=s.findIndex(v=>v>y+8);i=i<0?s.length-1:i-1;if(t-lastT<900&&lastI>=0)i=lastI;const n=clamp(dir>0?i+1:i-1,0,s.length-1);lastI=n;lastT=t;scrollToY(s[n],{duration:.8});if(hud){hud.textContent=(n+1)+' / '+s.length;hud.classList.add('on');clearTimeout(hudT);hudT=setTimeout(()=>hud.classList.remove('on'),1300);}}
window.__step=step;
addEventListener('keydown',e=>{if(/INPUT|TEXTAREA|SELECT/.test(e.target.tagName||'')||e.metaKey||e.ctrlKey||e.altKey||$('dialog[open]'))return;const k=e.key.toLowerCase();if(k==='j'){e.preventDefault();step(1);}else if(k==='k'){e.preventDefault();step(-1);}});

/* ---------- dialogs hold the page still ---------- */
if(window.MutationObserver)new MutationObserver(()=>{const on=!!$('dialog[open]');root.classList.toggle('dlg',on);if(lenis)on?lenis.stop():lenis.start();}).observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});

/* Search this page: a small BM25, the same idea as the sparse half of bert */
const D=$('#find'),Q=$('#find-q'),RS=$('#find-r'),OPEN=$('#find-open');
if(D&&D.showModal&&OPEN){OPEN.hidden=false;
  let cur=[],sel=0;
  const tok=s=>(s.toLowerCase().match(/[a-z0-9][a-z0-9.\-+#×]*/g)||[]).map(t=>t.replace(/[.\-]+$/,''));
  let docs=null,df,avg;
  const build=()=>{docs=[];$$('.say,.numb,.note,.eng-b p,.pincap p,.chase a,.more,figcaption').forEach(el=>{const title='';const text=el.textContent.replace(/\s+/g,' ').trim();if(!text)return;const sec=el.closest('article,section');const tag=sec&&sec.querySelector('.sname,.ptitle,.say');const t=tok(text);const f={};t.forEach(w=>f[w]=(f[w]||0)+1);docs.push({el,title,text,tag:tag?tag.textContent.trim():'',f,n:t.length});});
    df={};docs.forEach(d=>Object.keys(d.f).forEach(w=>df[w]=(df[w]||0)+1));avg=docs.reduce((a,d)=>a+d.n,0)/docs.length;};
  const search=q=>{const ws=tok(q),N=docs.length,k1=1.2,b=.75;return docs.map(d=>{let s=0;ws.forEach(w=>{const f=d.f[w]||0;if(!f)return;const idf=Math.log(1+(N-df[w]+.5)/(df[w]+.5));s+=idf*f*(k1+1)/(f+k1*(1-b+b*d.n/avg));});return{d,s};}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,7);};
  const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const snip=(t,ws)=>{const l=t.toLowerCase();let at=-1;for(const w of ws){at=l.indexOf(w);if(at>=0)break;}const st=Math.max(0,at-50);let o=esc((st?'...':'')+t.slice(st,st+150)+(t.length>st+150?'...':''));ws.forEach(w=>{if(w.length>1)o=o.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>');});return o;};
    const go=i=>{const r=cur[i];if(!r)return;D.close();if(r.act){r.act();return;}const el=r.d.el;goTo(el);};
  const ACT=[['Go to Kernels',()=>scrollToY(yOf($('#ch-k')))],['Go to Inference',()=>scrollToY(yOf($('#ch-i')))],['Go to Agents',()=>scrollToY(yOf($('#ch-a')))],['See all work',()=>{location.href='/work/';}],['Run a kernel on my GPU',()=>scrollToY(yOf($('#yourgpu')))],['Read the 60-second version',()=>{location.href='/60/';}],['Open the résumé',()=>{location.href=$('#nav-res').getAttribute('href');}],['Copy my email address',()=>{const e='kantamneniharshith@gmail.com';if(navigator.clipboard)navigator.clipboard.writeText(e).catch(()=>{});$('#step-hud').textContent=e;$('#step-hud').classList.add('on');setTimeout(()=>$('#step-hud').classList.remove('on'),2200);}]];
  const paint=()=>{const q=Q.value.trim();if(!q){cur=ACT.map(a=>({act:a[1]}));sel=0;RS.innerHTML=ACT.map((a,i)=>'<a href="#" role="option" data-i="'+i+'" class="'+(i?'':'on')+'"><b>'+a[0]+'</b></a>').join('');return;}if(!docs)build();cur=search(q);sel=0;const ws=tok(q);
    if(!cur.length){RS.innerHTML='<p style="padding:12px;color:var(--mid);font-size:14px">Nothing on this page matches that. Try a GPU, a model or a PR number, such as H200 or #1319.</p>';return;}
    RS.innerHTML=cur.map((r,i)=>'<a href="#" role="option" data-i="'+i+'" class="'+(i?'':'on')+'"><b>'+esc(r.d.title||r.d.tag)+'</b><small>'+snip(r.d.text,ws)+'</small></a>').join('');};
  const open=()=>{D.showModal();Q.value='';paint();Q.focus();};
  OPEN.addEventListener('click',open);
  addEventListener('keydown',e=>{const tag=(e.target.tagName||'');const typing=/INPUT|TEXTAREA|SELECT/.test(tag);if((e.key==='/'&&!typing&&!e.metaKey&&!e.ctrlKey)||((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k')){e.preventDefault();open();}});
  Q.addEventListener('input',paint);
  Q.addEventListener('keydown',e=>{if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();if(!cur.length)return;sel=(sel+(e.key==='ArrowDown'?1:cur.length-1))%cur.length;$$('a',RS).forEach((a,i)=>{a.classList.toggle('on',i===sel);if(i===sel)a.scrollIntoView({block:'nearest'});});}else if(e.key==='Enter'){e.preventDefault();go(sel);}});
  RS.addEventListener('click',e=>{const a=e.target.closest('a');if(!a)return;e.preventDefault();go(+a.dataset.i);});
  D.addEventListener('click',e=>{if(e.target===D)D.close();});
}


/* Run a kernel on your GPU */
const runB=$('#gpu-run');
if(runB){
  const out=$('#gpu-out'),hm=$('#hm'),SZ=[1,2,4,8,16,32,64],cells={};
  hm.innerHTML='<span></span>'+SZ.map(x=>'<b>'+x+'</b>').join('')+SZ.map(y=>'<b>'+y+'</b>'+SZ.map(x=>{const ok=x*y<=256;return '<i data-x="'+x+'" data-y="'+y+'"'+(ok?'':' class="no"')+'></i>';}).join('')).join('');
  $$('i',hm).forEach(c=>{cells[c.dataset.x+'x'+c.dataset.y]=c;});
  let stopped=false,running=false;
  const say=t=>{out.textContent=t;};
  if(!navigator.gpu){runB.disabled=true;runB.textContent='WebGPU not available here';say("This browser doesn't expose WebGPU here. Current Chrome, Edge and Safari do on most machines.");}
  const WGSL='struct P{n:u32};@group(0)@binding(0)var<storage,read>a:array<f32>;@group(0)@binding(1)var<storage,read>b:array<f32>;@group(0)@binding(2)var<storage,read_write>c:array<f32>;@group(0)@binding(3)var<uniform>p:P;override WX:u32=1;override WY:u32=1;@compute @workgroup_size(WX,WY)fn main(@builtin(global_invocation_id)g:vec3<u32>){let n=p.n;if(g.x>=n||g.y>=n){return;}var s=0.0;let ro=g.y*n;let co=g.x*n;for(var k=0u;k<n;k++){s+=a[ro+k]*b[co+k];}c[ro+g.x]=s;}';
  const fill=(arr,seed)=>{let x=seed>>>0||1;for(let i=0;i<arr.length;i++){x^=x<<13;x>>>=0;x^=x>>>17;x^=x<<5;x>>>=0;arr[i]=(x/2147483648)-1;}};
  const median=v=>v.slice().sort((p,q)=>p-q)[v.length>>1];
  function heat(res){
    const vals=Object.values(res);if(!vals.length)return;
    const lo=Math.log(Math.min(...vals)),hi=Math.log(Math.max(...vals)),best=Math.max(...vals);
    Object.entries(res).forEach(([k,v])=>{const c=cells[k],u=hi>lo?(Math.log(v)-lo)/(hi-lo):1;c.style.background='color-mix(in srgb,#FF6A4D '+Math.round(8+u*84)+'%,#101216)';c.textContent=v>=100?Math.round(v):v>=1?v.toFixed(v>=10?0:1):v.toFixed(2);c.title=k.replace('x','×')+': '+(v<1?v.toFixed(3):v.toFixed(1))+' GFLOP/s';c.classList.toggle('best',v===best);c.classList.add('done');c.style.color=u>.55?'#120B06':'#EEEFF1';});
  }
  async function sweep(){
    running=true;stopped=false;runB.textContent='Stop';
    Object.values(cells).forEach(c=>{c.style.background='';c.textContent='';c.classList.remove('best','done');c.style.color='';});
    let device;
    try{
      const adapter=await navigator.gpu.requestAdapter({powerPreference:'high-performance'});
      if(!adapter)throw new Error("No GPU adapter is available to this page.");
      const ts=adapter.features.has('timestamp-query');
      device=await adapter.requestDevice({requiredFeatures:ts?['timestamp-query']:[]});
      device.lost.then(i=>{if(running&&!stopped)say('The browser ended the GPU session ('+(i.message||i.reason||'device lost')+'). Results above are still valid.');});
      const info=adapter.info||{},name=[info.vendor,info.architecture].filter(Boolean).join(' ')||'your GPU';
      const soft=!!(info.isFallbackAdapter||adapter.isFallbackAdapter);
      const mod=device.createShaderModule({code:WGSL});
      const lay=device.createBindGroupLayout({entries:[{binding:0,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},{binding:1,visibility:GPUShaderStage.COMPUTE,buffer:{type:'read-only-storage'}},{binding:2,visibility:GPUShaderStage.COMPUTE,buffer:{type:'storage'}},{binding:3,visibility:GPUShaderStage.COMPUTE,buffer:{type:'uniform'}}]});
      const pl=device.createPipelineLayout({bindGroupLayouts:[lay]});
      const pipe=(wx,wy)=>device.createComputePipelineAsync({layout:pl,compute:{module:mod,entryPoint:'main',constants:{WX:wx,WY:wy}}});
      const qset=ts?device.createQuerySet({type:'timestamp',count:2}):null,qb=ts?device.createBuffer({size:16,usage:GPUBufferUsage.QUERY_RESOLVE|GPUBufferUsage.COPY_SRC}):null,rb=ts?device.createBuffer({size:16,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ}):null;
      let n=256,A,B,ba,bb,bc,bu,br,group;
      const alloc=m=>{n=m;[ba,bb,bc,bu,br].forEach(x=>x&&x.destroy());const s=n*n*4;A=new Float32Array(n*n);B=new Float32Array(n*n);ba=device.createBuffer({size:s,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});bb=device.createBuffer({size:s,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_DST});bc=device.createBuffer({size:s,usage:GPUBufferUsage.STORAGE|GPUBufferUsage.COPY_SRC|GPUBufferUsage.COPY_DST});br=device.createBuffer({size:s,usage:GPUBufferUsage.COPY_DST|GPUBufferUsage.MAP_READ});bu=device.createBuffer({size:16,usage:GPUBufferUsage.UNIFORM|GPUBufferUsage.COPY_DST});device.queue.writeBuffer(bu,0,new Uint32Array([n,0,0,0]));group=device.createBindGroup({layout:lay,entries:[{binding:0,resource:{buffer:ba}},{binding:1,resource:{buffer:bb}},{binding:2,resource:{buffer:bc}},{binding:3,resource:{buffer:bu}}]});};
      const fresh=seed=>{fill(A,seed*2+1);fill(B,seed*2+2);device.queue.writeBuffer(ba,0,A);device.queue.writeBuffer(bb,0,B);};
      async function once(p,wx,wy){
        const enc=device.createCommandEncoder();enc.clearBuffer(bc);
        const pass=enc.beginComputePass(ts?{timestampWrites:{querySet:qset,beginningOfPassWriteIndex:0,endOfPassWriteIndex:1}}:{});
        pass.setPipeline(p);pass.setBindGroup(0,group);pass.dispatchWorkgroups(Math.ceil(n/wx),Math.ceil(n/wy));pass.end();
        if(ts){enc.resolveQuerySet(qset,0,2,qb,0);enc.copyBufferToBuffer(qb,0,rb,0,16);}
        const t0=performance.now();device.queue.submit([enc.finish()]);await device.queue.onSubmittedWorkDone();const t1=performance.now();
        if(ts){await rb.mapAsync(GPUMapMode.READ);const q=new BigUint64Array(rb.getMappedRange().slice(0));rb.unmap();const ms=Number(q[1]-q[0])/1e6;if(ms>0)return ms;}
        return t1-t0;
      }
      async function verify(){
        const enc=device.createCommandEncoder();enc.copyBufferToBuffer(bc,0,br,0,n*n*4);device.queue.submit([enc.finish()]);
        await br.mapAsync(GPUMapMode.READ);const C=new Float32Array(br.getMappedRange().slice(0));br.unmap();
        for(let t=0;t<64;t++){const i=(t*2654435761>>>0)%n,j=(t*40503+7)%n;let s=0;for(let k=0;k<n;k++)s+=A[i*n+k]*B[j*n+k];if(Math.abs(C[i*n+j]-s)>1e-2*(1+Math.abs(s)))return false;}
        return true;
      }
      /* Size the problem so the best shape takes tens of milliseconds, on any GPU */
      say('Sizing the problem for '+name+'...');
      alloc(256);fresh(1);const probe=await pipe(16,16);await once(probe,16,16);const pm=await once(probe,16,16);
      let m=Math.round(256*Math.cbrt(25/Math.max(pm,.2))/64)*64;m=Math.max(128,Math.min(1024,m));if(m!==n)alloc(m);
      const todo=[];SZ.forEach(x=>SZ.forEach(y=>{if(x*y<=256)todo.push([x,y]);}));
      for(let i=todo.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[todo[i],todo[j]]=[todo[j],todo[i]];}
      const res={};let bad=0,done=0;
      for(const [x,y] of todo){
        if(stopped)break;
        fresh(done+3);
        const p=await pipe(x,y);await once(p,x,y);
        const t=[];for(let r=0;r<3&&!stopped;r++)t.push(await once(p,x,y));
        if(!t.length)break;
        if(!(await verify()))bad++;
        res[x+'x'+y]=2*n*n*n/(median(t)*1e6);done++;
        heat(res);say('Shape '+done+' of '+todo.length+' on '+name+', N='+n+'...');
      }
      const e=Object.entries(res).sort((p,q)=>q[1]-p[1]);
      if(e.length){const [k,v]=e[0],lo=e[e.length-1][1];
        say((stopped?'Stopped. ':'')+'On '+name+(soft?' (a software adapter, not a real GPU)':'')+', N='+n+': the fastest shape here is '+k.replace('x','×')+' at '+(v<1?v.toFixed(3):v.toFixed(1))+' GFLOP/s, '+(v/lo).toFixed(1)+'× the slowest. '+(bad?bad+' shapes returned answers that disagreed with your CPU, so ignore this run. ':'Answers matched your CPU on 64 sampled elements per shape. ')+'Timer: '+(ts?'GPU timestamps':'CPU clock around each submit')+', median of 3 runs after a warm-up.');
      }else say('Stopped before the first shape finished.');
      [ba,bb,bc,bu,br,qb,rb].forEach(x=>x&&x.destroy());if(qset)qset.destroy();
    }catch(err){say("This run didn't finish: "+(err&&err.message||err)+'. Results above, if any, are still valid.');}
    running=false;stopped=false;runB.textContent='Run it again';
    if(device){const d=device;setTimeout(()=>{try{d.destroy();}catch(e){}},100);}
  }
  runB.addEventListener('click',()=>{if(running){stopped=true;return;}sweep();});
}


frame();
})();
