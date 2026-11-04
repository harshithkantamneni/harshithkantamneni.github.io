/* Search this page: a small BM25, the same idea as the sparse half of bert */
const D=$('#find'),Q=$('#find-q'),RS=$('#find-r'),OPEN=$('#find-open');
if(D&&D.showModal&&OPEN){OPEN.hidden=false;
  let cur=[],sel=0;
  const tok=s=>(s.toLowerCase().match(/[a-z0-9][a-z0-9.\-+#×]*/g)||[]).map(t=>t.replace(/[.\-]+$/,''));
  let docs=null,df,avg;
  const build=()=>{docs=[];$$('.step,.wrow,.proj,.b,.case-top,.pc,.dl').forEach(el=>{const h=el.querySelector('h3,h2,.wt,.pn,.bl,.dn,.ph');const title=h?(h.firstChild&&h.firstChild.textContent||h.textContent).trim():'';const text=(el.querySelector('.vh')||el).textContent.replace(/\s+/g,' ').trim();if(!text)return;const sec=el.closest('section');const tag=sec&&sec.querySelector('.case-title,h2');const t=tok(text);const f={};t.forEach(w=>f[w]=(f[w]||0)+1);docs.push({el,title,text,tag:tag?tag.textContent.trim():'',f,n:t.length});});
    df={};docs.forEach(d=>Object.keys(d.f).forEach(w=>df[w]=(df[w]||0)+1));avg=docs.reduce((a,d)=>a+d.n,0)/docs.length;};
  const search=q=>{const ws=tok(q),N=docs.length,k1=1.2,b=.75;return docs.map(d=>{let s=0;ws.forEach(w=>{const f=d.f[w]||0;if(!f)return;const idf=Math.log(1+(N-df[w]+.5)/(df[w]+.5));s+=idf*f*(k1+1)/(f+k1*(1-b+b*d.n/avg));});return{d,s};}).filter(x=>x.s>0).sort((a,b)=>b.s-a.s).slice(0,7);};
  const esc=s=>s.replace(/[&<>]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;'}[c]));
  const snip=(t,ws)=>{const l=t.toLowerCase();let at=-1;for(const w of ws){at=l.indexOf(w);if(at>=0)break;}const st=Math.max(0,at-50);let o=esc((st?'...':'')+t.slice(st,st+150)+(t.length>st+150?'...':''));ws.forEach(w=>{if(w.length>1)o=o.replace(new RegExp('('+w.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+')','ig'),'<mark>$1</mark>');});return o;};
    const go=i=>{const r=cur[i];if(!r)return;D.close();if(window.__lenis)window.__lenis.start();if(r.act){r.act();return;}const el=r.d.el;if(window.__lenis)window.__lenis.scrollTo(el,{offset:-90});else el.scrollIntoView({block:'center'});el.classList.remove('focus-flash');void el.offsetWidth;el.classList.add('focus-flash');};
  const ACT=[['Go to Kernels',()=>window.__go('#ch-k')],['Go to Inference',()=>window.__go('#ch-i')],['Go to Agents',()=>window.__go('#ch-a')],['Run a kernel on my GPU',()=>window.__go('#yourgpu')],['Read the 60-second version',()=>window.__short(true,true)],["Take the skeptic's tour",()=>window.__tour()],['Open the résumé',()=>{location.href=$('#nav-res').getAttribute('href');}],['Copy my email address',()=>{const e='kantamneniharshith@gmail.com';if(navigator.clipboard)navigator.clipboard.writeText(e).catch(()=>{});$('#step-hud').textContent=e;$('#step-hud').classList.add('on');setTimeout(()=>$('#step-hud').classList.remove('on'),2200);}]];
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
