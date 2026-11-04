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
