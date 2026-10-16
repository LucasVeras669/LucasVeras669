// Uso: node harness.js <box|tkd> <segundos> <prefixo_saida> [largura altura] [modo: mix|counter|flow|idle]
// Joga o jogo headless com toques nos botões e direcional, captura erros, FPS e screenshots.
const {chromium}=require(require('child_process').execSync('npm root -g').toString().trim()+'/playwright');
const [style='box',secs='20',out='/tmp/claude-0/-home-user-LucasVeras669/df342a4f-9004-59b5-89e6-2b9773635a0a/scratchpad/qa/run',vw='844',vh='390',mode='mix']=process.argv.slice(2);
(async()=>{
  const b=await chromium.launch();
  const p=await b.newPage({viewport:{width:+vw,height:+vh},hasTouch:true});
  const errs=[];p.on('pageerror',e=>errs.push('pageerror: '+e.message));p.on('console',m=>{if(m.type()==='error'||m.type()==='warning')errs.push(m.type()+': '+m.text());});
  await p.goto('file:///home/user/LucasVeras669/jogo/index.html');await p.waitForTimeout(900);
  await p.screenshot({path:out+'_menu.png'});
  await p.click(style==='box'?'#pickBox':'#pickTkd');await p.waitForTimeout(1600);
  await p.evaluate(()=>{window.__frames=0;(function f(){window.__frames++;requestAnimationFrame(f);})();});
  const t0=Date.now();let shot=0,taps=0;const ids=['b1','b2','b3','bAtk','bAtk','bAtk','bDod','bFin'];
  const has=async id=>p.evaluate(i=>!!document.getElementById(i),id);
  let i=0;
  while(Date.now()-t0<(+secs)*1000){
    const al=await p.evaluate(()=>{const b=document.getElementById('bCnt');return b&&b.classList.contains('alert');});
    let id;
    if(mode==='idle'){await p.waitForTimeout(200);}
    else if(al&&mode!=='flow'){await p.waitForTimeout(80+Math.random()*200);id='bCnt';}
    else if(mode==='counter'){await p.waitForTimeout(80);}
    else if(mode==='flow')id='bAtk';
    else id=ids[Math.floor(Math.random()*ids.length)];
    if(id&&await has(id)){try{await p.tap('#'+id,{timeout:500});taps++;}catch(e){}}
    // direcional virtual ocasional (arrasta no lado esquerdo)
    if(mode==='mix'&&i%9===0){const x=+vw*0.18,y=+vh*0.7;await p.mouse.move(x,y);await p.mouse.down();await p.mouse.move(x+(Math.random()<.5?-40:40),y+(Math.random()<.5?-30:30),{steps:4});await p.waitForTimeout(250);await p.mouse.up();}
    await p.waitForTimeout(140+Math.random()*160);
    if((Date.now()-t0)>shot*((+secs)*1000/6)){await p.screenshot({path:`${out}_${shot}.png`});shot++;}
    i++;
  }
  const fr=await p.evaluate(()=>window.__frames);
  const hud=await p.evaluate(()=>({round:document.getElementById('rlabel')?.textContent,score:document.getElementById('score')?.textContent,pHp:document.getElementById('pHp')?.style.width,eHp:document.getElementById('eHp')?.style.width,over:!document.getElementById('over')?.hidden,dbg:window.__FB?window.__FB.summary?.():null}));
  await p.screenshot({path:out+'_end.png'});
  console.log(JSON.stringify({style,mode,viewport:vw+'x'+vh,taps,approxFps:Math.round(fr/(+secs)),hud,errors:errs.slice(0,20),screens:shot},null,1));
  await b.close();
})();
