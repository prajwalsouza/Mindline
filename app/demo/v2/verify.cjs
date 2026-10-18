// Run against the existing read-only static route; does not change the app clock.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {chromium}=require('C:/Users/Administrator/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'pitch/submission/build/v2-review');
fs.mkdirSync(out,{recursive:true});
const assert=(value,message)=>{if(!value)throw Error(message);};
(async()=>{
 const browser=await chromium.launch({headless:true,executablePath:'C:/Users/Administrator/AppData/Local/ms-playwright/chromium-1217/chrome-win64/chrome.exe'});
 const errors=[],checks=[];
 try {
  const page=await browser.newPage({viewport:{width:1600,height:900}});
  page.on('pageerror',e=>errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
  page.on('response',r=>{if(r.status()>=400)errors.push(`${r.status()} ${r.url()}`);});
  await page.goto('http://127.0.0.1:8800/demo-v2/');
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>window.mindlineV2);
  const scenes=await page.evaluate(()=>window.mindlineV2.scenes);
  assert(await page.evaluate(()=>mindlineV2.duration===106),'Duration must be 106 seconds');
  for(const s of scenes){
   await page.evaluate(t=>mindlineV2.seek(t),s.start+3);
   await page.screenshot({path:path.join(out,`desktop-${s.id}.png`)});
   const geom=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,
    footer:document.querySelector('.transport').getBoundingClientRect().bottom,
    caption:document.querySelector('.scene-caption').getBoundingClientRect().bottom,
    visual:document.querySelector('#visual').getBoundingClientRect().bottom}));
   assert(!geom.overflow,`Horizontal overflow desktop ${s.id}`);
   checks.push({scene:s.id,desktop:geom});
  }
  await page.evaluate(()=>mindlineV2.seek(43));
  await page.getByRole('button',{name:'Last 4 weeks',exact:true}).click();
  assert((await page.locator('.drug-number').first().innerText()).includes('13 / 14'),'Recent drug counts');
  assert(!(await page.evaluate(()=>mindlineV2.state().playing)),'Exploration pauses');
  await page.evaluate(()=>mindlineV2.seek(60));
  await page.getByRole('button',{name:'Emergency: 3 resistant cases',exact:true}).click();
  assert(await page.locator('.ward-detail h2').innerText()==='Emergency','Ward selection');
  await page.evaluate(()=>mindlineV2.seek(52));
  await page.getByRole('button',{name:'Keep this note'}).click();
  assert(await page.getByRole('button',{name:'Kept with the patient record ✓',exact:true}).count()===1,'Presentation note save');
  await page.evaluate(()=>mindlineV2.seek(93));
  await page.getByRole('button',{name:'Try another seed'}).click();
  assert((await page.locator('#seed-label').innerText()).includes('2427'),'Seed changes');
  await page.getByRole('button',{name:'Story & sources'}).click();
  assert(await page.locator('#credits').isVisible(),'Sources open');
  await page.keyboard.press('Escape');
  assert(!(await page.locator('#credits').isVisible()),'Sources escape');
  await page.evaluate(()=>{document.activeElement.blur();mindlineV2.seek(0);});
  await page.keyboard.press('ArrowRight');
  assert((await page.evaluate(()=>mindlineV2.state())).scene==='mindlines','Keyboard next');
  await page.keyboard.press('Space');
  await page.waitForTimeout(350);
  assert((await page.evaluate(()=>mindlineV2.state())).playing,'Space plays');
  await page.keyboard.press('Space');
  assert(!(await page.evaluate(()=>mindlineV2.state())).playing,'Space pauses');
  // Every second must render, including exact boundaries and final end state.
  const timeline=await page.evaluate(()=>{
   const seen=[];for(let i=0;i<=106;i++){mindlineV2.seek(i);seen.push(mindlineV2.state().scene);}return [...new Set(seen)];
  });
  assert(timeline.length===14,'All scenes render across the timeline');
  await page.evaluate(()=>{mindlineV2.seek(105.9);mindlineV2.play();});
  await page.waitForTimeout(250);
  assert(!(await page.evaluate(()=>mindlineV2.state())).playing,'End stops');
  await page.setViewportSize({width:390,height:844});
  for(const s of scenes){
   await page.evaluate(t=>mindlineV2.seek(t),s.start+3);
   await page.screenshot({path:path.join(out,`mobile-${s.id}.png`),fullPage:true});
   const geom=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,height:document.documentElement.scrollHeight}));
   assert(!geom.overflow,`Horizontal overflow mobile ${s.id}`);
   checks.find(c=>c.scene===s.id).mobile=geom;
  }
  const reduced=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:'reduce'});
  reduced.on('pageerror',e=>errors.push(e.message));
  await reduced.goto('http://127.0.0.1:8800/demo-v2/?autoplay=1');
  await reduced.waitForFunction(()=>window.mindlineV2);
  assert(!(await reduced.evaluate(()=>mindlineV2.state())).playing,'Reduced motion starts paused');
  for(const s of scenes)await reduced.evaluate(t=>mindlineV2.seek(t),s.start);
  await reduced.evaluate(()=>mindlineV2.seek(82));
  await reduced.screenshot({path:path.join(out,'reduced-prediction.png')});
  await page.setViewportSize({width:1600,height:900});
  await page.goto('http://127.0.0.1:8800/demo-v2/?clean=1');
  await page.waitForFunction(()=>window.mindlineV2);
  await page.evaluate(()=>mindlineV2.seek(31));
  assert(!(await page.locator('.transport').isVisible()),'Clean capture hides controls');
  await page.screenshot({path:path.join(out,'clean-brand.png')});
  await page.goto('file:///'+path.join(root,'app/static/demo-v2/index.html').replaceAll('\\','/'));
  await page.waitForFunction(()=>window.mindlineV2);
  await page.evaluate(()=>mindlineV2.seek(77));
  assert(await page.locator('.loss-row').count()===2,'Offline file rendering');
  const originals=JSON.parse(fs.readFileSync(path.join(__dirname,'original-demo-sha256.json')));
  const externalChanges=[];
  for(const [file,hash] of Object.entries(originals)) {
   const same=crypto.createHash('sha256').update(fs.readFileSync(path.join(root,file))).digest('hex')===hash;
   // Other work is adding an unreferenced detection snapshot in the V1 directory.
   // Verify the four original film assets strictly; record ancillary changes.
   if(['index.html','demo.js','demo.css','data.json'].includes(path.basename(file)))assert(same,`Original changed: ${file}`);
   else if(!same)externalChanges.push(file);
  }
  const report={duration:106,scenes:scenes.length,errors,checks,originalFilmAssetsUnchanged:true,externalChanges,interactions:'passed',reducedMotion:'passed',offline:'passed',cleanCapture:'passed'};
  fs.writeFileSync(path.join(out,'verification.json'),JSON.stringify(report,null,2));
  assert(errors.length===0,JSON.stringify(errors));
  console.log(JSON.stringify(report,null,2));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
