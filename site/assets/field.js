/* One field of dots. In the background it drifts. In a scene it becomes what is being measured. */
(function(){
const root=document.documentElement,qs=new URLSearchParams(location.search);
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
const back=document.getElementById('field'),over=document.getElementById('fieldTop');
const api={on:false,bind(){},text(){},release(){},releaseIf(){},tint(){},sync(){}};
window.__field=api;
if(reduce||qs.has('static')||!back||!over)return;
const bx=back.getContext('2d'),ox=over.getContext('2d');
const N=(navigator.hardwareConcurrency||8)<4?800:1000;
const AMB=[150,170,200];
let W=0,H=0,dpr=1,mx=-999,my=-999,tt=0,running=false,cur=null,tint=AMB.slice(),tintT=AMB.slice(),last=0;
const P=[],idx=[];
for(let i=0;i<N;i++){idx.push(i);P.push({x:Math.random()*innerWidth,y:Math.random()*innerHeight,hx:0,hy:0,vis:-1,r:.7,a:0,c:AMB.slice(),tr:.7,ta:0,tc:AMB,sq:0,tsq:0,h:0,b:0,ox:0,oy:0,e:.055+Math.random()*.07,fly:0,pu:0});}
const shuffle=()=>{for(let i=N-1;i>0;i--){const j=Math.random()*(i+1)|0,t=idx[i];idx[i]=idx[j];idx[j]=t;}};
function layout(){
  W=innerWidth;H=innerHeight;dpr=W>880?Math.min(devicePixelRatio||1,2):1;
  [back,over].forEach(c=>{c.width=W*dpr;c.height=H*dpr;});
  let gap=46;while(Math.floor(W/gap)*Math.floor(H/gap)>N)gap+=4;
  let i=0;
  for(let x=gap;x<W;x+=gap)for(let y=gap;y<H;y+=gap){if(i>=N)break;const p=P[i++];p.hx=x;p.hy=y;p.vis=((x/gap+y/gap)&1)?0:1;}
  for(;i<N;i++){const p=P[i];p.hx=Math.random()*W;p.hy=Math.random()*H;p.vis=-1;}
}
const enabled=()=>api.on&&W>880&&!root.classList.contains('short');
function clear(){if(cur&&cur.zone.classList)cur.zone.classList.remove('dotting');for(const p of P){if(p.b){p.b=0;p.fly=1;p.pu=0;p.tsq=0;p.h=0;}}}
function release(){clear();cur=null;}
const rgb=s=>{const m=s.match(/[\d.]+/g);if(!m)return null;if(m.length>3&&+m[3]===0)return null;return[+m[0],+m[1],+m[2]];};

/* Each .d element is the layout: the dot flies to its centre and takes its size and colour. */
function bind(zone,opts){
  if(!enabled())return;
  if(typeof zone==='string')zone=document.querySelector(zone);if(!zone)return;
  const same=cur&&cur.zone===zone;
  if(!same){clear();shuffle();}
  const zr=zone.getBoundingClientRect(),els=zone.querySelectorAll('.d');
  els.forEach((el,i)=>{
    if(i>=N)return;
    const p=P[idx[i]],r=el.getBoundingClientRect(),cs=getComputedStyle(el),fill=rgb(cs.backgroundColor);
    p.b=1;p.fly=0;p.ox=r.left-zr.left+r.width/2;p.oy=r.top-zr.top+r.height/2;p.tr=r.width/2;p.ta=1;
    p.tc=fill||rgb(cs.borderTopColor)||AMB;p.h=fill?0:1;p.tsq=cs.borderTopLeftRadius==='50%'?0:1;
    p.pu=opts&&opts.pulse&&el.closest('.host')?1:0;
  });
  cur={zone,pulse:opts&&opts.pulse,again:()=>bind(zone,opts)};
}

/* A chapter title is drawn by the dots, glyph by glyph where the page really set it. */
function sample(h,fine){
  const r=h.getBoundingClientRect(),w=Math.ceil(r.width),hh=Math.ceil(r.height)+40,cs=getComputedStyle(h);
  const c=document.createElement('canvas');c.width=w;c.height=hh;const o=c.getContext('2d',{willReadFrequently:true});
  o.font=cs.fontWeight+' '+cs.fontSize+' '+cs.fontFamily;o.fillStyle='#fff';o.textBaseline='alphabetic';
  const probe=document.createElement('span');probe.style.cssText='display:inline-block;width:0;height:0;vertical-align:baseline';h.appendChild(probe);
  const base=probe.getBoundingClientRect().bottom-r.top;probe.remove();
  const t=h.firstChild,rg=document.createRange();
  for(let i=0;i<t.length;i++){rg.setStart(t,i);rg.setEnd(t,i+1);o.fillText(t.data[i],rg.getBoundingClientRect().left-r.left,base+20);}
  const d=o.getImageData(0,0,w,hh).data;
  for(let s=fine?3:5;s<24;s++){
    const pts=[];
    for(let y=0,row=0;y<hh;y+=s*.88,row++)for(let x=row%2?s/2:0;x<w;x+=s){const a=d[((y|0)*w+(x|0))*4+3];if(a>140)pts.push([x,y-20]);}
    if(pts.length<=N*.94)return{pts,s};
  }
  return{pts:[],s:8};
}
function text(h,opts){
  if(!enabled()||(cur&&cur.zone===h))return;
  const go=()=>{
    if(!enabled())return;
    const {pts,s}=sample(h,opts&&opts.fine);if(!pts.length)return;
    clear();shuffle();
    const col=(h.dataset.rgb||'255,255,255').split(',').map(Number);
    pts.forEach((q,i)=>{const p=P[idx[i]];p.b=1;p.fly=0;p.ox=q[0];p.oy=q[1];p.tr=s*.36;p.ta=.95;p.tc=col;p.h=0;p.tsq=0;p.pu=0;});
    if(opts&&opts.ttl)h.classList.add('dotting');
    cur={zone:h,ttl:opts&&opts.ttl?performance.now()+opts.ttl:0,again:()=>{cur=null;text(h,opts);}};
  };
  (document.fonts&&document.fonts.ready?document.fonts.ready:Promise.resolve()).then(go);
}

function draw(now){
  if(document.hidden){running=false;return;}
  running=true;tt+=.006;
  const dt=Math.min(100,last?now-last:16.67)/16.67;last=now;const ease=e=>1-Math.pow(1-e,dt);const k14=ease(.14),k10=ease(.1),k20=ease(.2);
  bx.setTransform(dpr,0,0,dpr,0,0);bx.clearRect(0,0,W,H);ox.setTransform(dpr,0,0,dpr,0,0);ox.clearRect(0,0,W,H);
  let zr=null;
  if(cur&&cur.ttl&&now>cur.ttl)release();
  if(cur){zr=cur.zone.getBoundingClientRect();if(zr.bottom<-80||zr.top>H+80){release();zr=null;}}
  for(let k=0;k<3;k++)tint[k]+=(tintT[k]-tint[k])*.04;
  const per=cur&&cur.pulse?cur.pulse():0,ph=per?(now%per)/per:0,zw=zr?zr.width:1;
  let lastB='',lastO='';
  for(let i=0;i<N;i++){
    const p=P[i];let tx,ty,tr,ta,tc,boost=1;
    const d=Math.hypot(p.x-mx,p.y-my),infl=d<240?1-d/240:0;
    if(p.b&&zr){
      tx=zr.left+p.ox;ty=zr.top+p.oy;tr=p.tr*(1+infl*.3);ta=p.ta;tc=p.tc;
      if(p.pu){const u=Math.abs(p.ox/zw-ph);boost=u<.1?2.4-u*14:1;}
    }else{
      tx=p.hx;ty=p.hy;tc=tint;
      if(p.vis<0||(!p.vis&&infl===0)){ta=0;tr=.7;}
      else{tr=.7+infl*2.4+Math.sin(tt*2+p.hx*.01+p.hy*.01)*.3;ta=(.05+infl*.5)*.5;}
    }
    const ke=1-Math.pow(1-p.e,dt);p.x+=(tx-p.x)*ke;p.y+=(ty-p.y)*ke;p.r+=(tr-p.r)*k14;p.a+=(ta-p.a)*k10;p.sq+=(p.tsq-p.sq)*k20;
    p.c[0]+=(tc[0]-p.c[0])*k10;p.c[1]+=(tc[1]-p.c[1])*k10;p.c[2]+=(tc[2]-p.c[2])*k10;
    if(p.fly&&Math.abs(p.x-p.hx)+Math.abs(p.y-p.hy)<4)p.fly=0;
    if(p.a<.006)continue;
    const onTop=p.b||p.fly,g=onTop?ox:bx,r=Math.max(.2,p.r);
    const col='rgb('+(Math.min(255,p.c[0]*boost)|0)+','+(Math.min(255,p.c[1]*boost)|0)+','+(Math.min(255,p.c[2]*boost)|0)+')';
    g.globalAlpha=Math.min(1,p.a);
    if(p.h&&p.b){g.strokeStyle=col;const lw=Math.min(1.5,r*.32);g.lineWidth=lw;g.strokeRect(p.x-r+lw/2,p.y-r+lw/2,2*r-lw,2*r-lw);continue;}
    if(onTop){if(lastO!==col){g.fillStyle=col;lastO=col;}}else if(lastB!==col){g.fillStyle=col;lastB=col;}
    if(p.sq>.5)g.fillRect(p.x-r,p.y-r,2*r,2*r);
    else{g.beginPath();g.arc(p.x,p.y,r,0,6.2832);g.fill();}
  }
  requestAnimationFrame(draw);
}

api.on=true;
const mark=()=>root.classList.toggle('field-on',api.on&&innerWidth>880&&!root.classList.contains('short'));
mark();
api.bind=bind;api.text=text;api.release=release;
api.releaseIf=z=>{if(typeof z==='string')z=document.querySelector(z);if(cur&&cur.zone===z)release();};
api.tint=c=>{tintT=c||AMB;};
api.sync=()=>{mark();if(root.classList.contains('short'))release();};
layout();
addEventListener('mousemove',e=>{mx=e.clientX;my=e.clientY;},{passive:true});
addEventListener('resize',()=>{layout();mark();if(innerWidth<=880)release();else if(cur&&cur.again)cur.again();});
document.addEventListener('visibilitychange',()=>{if(!document.hidden&&!running)requestAnimationFrame(draw);});
requestAnimationFrame(draw);
})();
