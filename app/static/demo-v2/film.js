/* Mindline V2. A deterministic 106-second film; no service or model calls.
   Scenes render from local snapshots. seek() is also the capture interface. */
(() => {
  'use strict';
  const D = window.FILM_DATA, $ = id => document.getElementById(id);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const params = new URLSearchParams(location.search);
  const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
  const esc = v => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const number = v => Number(v).toLocaleString('en-GB');
  const svg = (body, view = '0 0 1100 360', cls = '') => `<svg class="art ${cls}" viewBox="${view}" aria-hidden="true">${body}</svg>`;
  const circles = (n, f) => Array.from({length:n}, (_,i) => f(i)).join('');
  const line = (x1,y1,x2,y2,cls='hair') => `<path class="${cls} draw" pathLength="1" d="M${x1} ${y1}L${x2} ${y2}"/>`;
  const fp = (extra='') => `<svg class="fingerprint ${extra}" viewBox="0 0 300 340" aria-hidden="true">${circles(13,i => {
    const x=31+i*8.4,y=274-i*4.7,top=15+i*9.8,right=270-i*8.4;
    return `<path class="draw" pathLength="1" d="M${x} ${y} C${x-38} ${top+55},${right+8} ${top-65},${right} ${y-15} C${right-2} ${y+45},${195-i*2} ${320-i*5},${169-i*1.8} ${309-i*6}"/>`;
  })}<circle cx="147" cy="180" r="7" fill="var(--ink)"/></svg>`;
  const study = '<a href="https://www.bmj.com/content/329/7473/1013" target="_blank" rel="noreferrer">Gabbay & le May · BMJ, 2004</a> · Ethnography in two English general practices';
  const synthetic = 'Synthetic laboratory data · Frozen prototype output';
  const nit = D.antibiogram.drugs.find(d=>d.code==='NIT');
  const amp = D.antibiogram.drugs.find(d=>d.code==='AMP');
  const guide = D.guide.drugs.find(d=>d.drug==='NIT');
  const names = {ED:'Emergency','MED-A':'Medicine A','MED-B':'Medicine B',SURG:'Surgery',URO:'Urology',ICU:'ICU',GER:'Geriatrics','PHC-N':'Health centre N','PHC-S':'Health centre S'};
  const local = {period:'year',manualPeriod:false,ward:'ICU',saved:false,seed:2426};

  function threads() {
    const roots=[{y:65,t:'What we read',c:'stroke'},{y:140,t:'Who we learn from',c:'warm'},{y:215,t:'The patients we remember',c:'stroke'},{y:290,t:'What experience changes',c:'cool'}];
    if (innerWidth<=560) return `<div class="thread-map" role="img" aria-label="Reading, colleagues, patients and experience join to form a mindline.">${svg(roots.map((r,i)=>`<text x="0" y="${45+i*53}" style="font-size:17px">${r.t}</text><path class="${r.c} draw" pathLength="1" d="M245 ${40+i*53} C290 ${40+i*53},250 270,325 270"/>`).join('')+'<circle cx="325" cy="270" r="6" fill="var(--accent)"/><text x="165" y="278" class="thinking-word" style="font-size:32px!important">mindline</text>','0 0 360 315')}</div>`;
    return `<div class="thread-map" role="img" aria-label="Reading, colleagues, patients and experience join to form a mindline.">${svg(roots.map((r,i)=>`<text x="0" y="${r.y+6}">${r.t}</text><path class="${r.c} draw" pathLength="1" d="M350 ${r.y} C${500+i*25} ${r.y},${540-i*20} ${180+i*9},710 180 S890 ${70+i*63},1040 ${80+i*63}"/>`).join('')+'<circle cx="710" cy="180" r="8" fill="var(--accent)"/><text x="690" y="320" class="thinking-word">mindline</text>')}</div>`;
  }
  function drugs() {
    const period=local.period;
    return `<div class="drug-demo"><div class="evidence-context"><span>Urology · Women · Urine · All ages</span><div class="segment" aria-label="Evidence window"><button data-period="year" aria-pressed="${period==='year'}">Last 12 months</button><button data-period="recent" aria-pressed="${period==='recent'}">Last 4 weeks</button></div></div>${[nit,amp].map(d=>{
      const v=d[period], proportion=Math.round(v.s/v.n*20);
      return `<div class="drug-row"><strong>${esc(d.name)}</strong><div class="dot-strip" aria-hidden="true">${circles(20,i=>`<i class="${i<proportion?'yes':''}"></i>`)}</div><div class="drug-number">${v.s} <span class="muted">/ ${v.n}</span><small>reported susceptible</small></div></div>`;
    }).join('')}<div class="drug-legend"><i></i>Reported susceptible<i class="empty"></i>Other tested results <span>· Dots show rounded proportions</span></div></div>`;
  }
  function wardView() {
    const ward=D.wards.find(w=>w.code===local.ward);
    return `<div class="ward-demo"><div class="ward-field" aria-label="Resistant cases by ward">${D.wards.map(w=>`<button class="ward" data-ward="${w.code}" aria-pressed="${w.code===local.ward}" aria-label="${names[w.code]}: ${w.recent} resistant cases"><span class="ward-dot">${w.recent}</span><span class="ward-name">${names[w.code]}</span></button>`).join('')}</div><div class="ward-detail"><h2>${names[ward.code]}</h2><strong>${ward.recent}</strong><p>resistant cases in four weeks</p><p class="baseline">Usually about ${ward.expected.toFixed(1)} in the same length of time.</p><p class="small">${ward.code==='ICU'?'Worth investigating. A signal is a reason to look closer.':'Each ward is compared with its own history.'}</p></div></div>`;
  }
  function forecast() {
    const mobile=innerWidth<=560;
    const s=guide.series,x=i=>(mobile?45:65)+i*(mobile?35:79),y=v=>252-v/0.3*200;
    const edge=mobile?470:1040;
    const path=key=>s.map((v,i)=>`${i?'L':'M'}${x(i)} ${y(v[key])}`).join(' ');
    return `<div class="forecast" role="img" aria-label="Thirteen historical test windows: past-year and past-month estimates compared with the observed resistant share for nitrofurantoin in Urology urine samples.">${svg(
      [0,.1,.2,.3].map(v=>`${line(mobile?45:65,y(v),edge,y(v))}<text class="minor" x="2" y="${y(v)+5}">${Math.round(v*100)}%</text>`).join('')+
      `<text class="minor" x="${mobile?45:65}" y="22">${mobile?'Resistant share · nitrofurantoin':'Resistant share · nitrofurantoin · Urology urine'}</text><path d="${path('year')}" stroke="#948d7f" stroke-width="2.5" fill="none" class="draw" pathLength="1"/><path d="${path('month')}" class="warm draw" pathLength="1"/>`+
      s.map((v,i)=>`<circle data-reveal="${.6+i*.075}" cx="${x(i)}" cy="${y(v.r/v.n)}" r="5" fill="var(--ink)"/>`).join('')+
      `<text class="minor" x="${mobile?45:65}" y="292">Oct 2025</text><text class="minor" x="${mobile?380:930}" y="292">Sep 2026</text>`,mobile?'0 0 500 310':'0 0 1100 310')}
      <div class="chart-legend"><span class="year"><i></i>Earlier year predicts</span><span class="month"><i></i>Earlier month predicts</span><span class="actual"><i></i>Held-out results</span></div></div>`;
  }
  function generation() {
    const rnd=i=>{const n=Math.sin((i+local.seed)*12.9898)*43758.5453;return n-Math.floor(n);};
    const dots=circles(36,i=>`<circle cx="${30+(i%6)*22}" cy="${65+Math.floor(i/6)*23}" r="4" fill="${i%7===0?'var(--accent)':'var(--ink)'}"/>`);
    return `<div class="generator"><div role="img" aria-label="Past cases are resampled into test streams with ordinary arrivals, an injected cluster, or delayed deliveries.">${svg(dots+
      `<path d="M190 125H300" class="hair draw" pathLength="1"/><circle cx="315" cy="125" r="8" fill="var(--accent)"/>`+
      [40,125,210].map((y,j)=>`<path d="M325 125C400 125,380 ${y},470 ${y}H1030" class="${j===1?'warm':'hair'} draw" pathLength="1"/>`+circles(25,i=>{
        const xx=480+i*22+(rnd(i+j*40)-.5)*8,yy=y+(rnd(i+j*80)-.5)*22;
        return `<circle data-reveal="${.3+i*.06}" cx="${j===2&&i>12?Math.min(1030,xx+70):xx}" cy="${yy}" r="${j===1&&i>13?5:3}" fill="${j===1&&i>13?'var(--accent)':'var(--ink)'}"/>`;
      })).join('')+`<text class="minor" x="28" y="242">Historical cases</text>`,'0 0 1100 270')}</div>
      <div class="generator-labels"><div>Resample cases<small>Keep linked lab records</small></div><div>Vary the arrivals<small>Timing learned from data</small></div><div>Add difficult days<small>Clusters, gaps, corrections</small></div></div>
      <div class="seed-line"><span id="seed-label">Seed ${local.seed} · Repeatable test stream</span><button data-action="rerun">Try another seed ↗</button></div></div>`;
  }

  const scenes=[
    {id:'question',name:'The question',part:'Before the prescription',duration:6,title:'Where does a doctor’s<br>decision <em>begin?</em>',caption:'A page carries a recommendation. A person carries the years around it.',foot:'A film about evidence, experience, and what passes between people.',view:()=>`<div class="origin"><div class="paper"><div class="paper-title">Clinical guideline</div><strong>A recommendation<br>for a situation.</strong><div class="paper-lines">${'<i></i>'.repeat(5)}</div></div>${svg(`<path d="M30 165C180 165,100 40,285 65S390 215,555 140" class="warm draw" pathLength="1"/><path d="M30 185C150 185,215 275,360 230S440 110,555 140" class="stroke draw" pathLength="1"/><path d="M30 205C190 205,240 110,380 140S480 220,555 140" class="cool draw" pathLength="1"/><circle cx="555" cy="140" r="10" fill="var(--accent)"/><text class="minor" x="165" y="35">a conversation</text><text class="minor" x="275" y="293">a remembered patient</text><text x="430" y="92">a decision</text>`,'0 0 620 320')}</div>`},
    {id:'mindlines',name:'Mindlines',part:'What the ethnographers found',duration:9,title:'A guideline is read.<br>A <em>mindline</em> is formed.',caption:'In two English practices, researchers found knowledge being made and remade through experience and trusted colleagues.',foot:study,view:threads},
    {id:'reason',name:'What gets lost',part:'From experience to a record',duration:7,title:'The choice is recorded.<br>The <em>reason</em> can disappear.',caption:'Years of experience may fit into one decision. The record may keep only the decision.',foot:'Illustrative clinical reasoning · Fictional example',view:()=>`<div class="record-scene"><div><div class="spoken">“I changed the plan <span class="reason">because the last culture was resistant.</span>”</div><div class="label">What someone understood</div></div><div data-reveal="1"><table class="record-table"><tbody><tr><td>Patient</td><td>Demo patient</td></tr><tr><td>Decision</td><td>Plan changed</td></tr><tr><td>Reason</td><td class="missing">—</td></tr></tbody></table><div class="label">What a record might retain</div></div></div>`},
    {id:'ai',name:'The missing evidence',part:'What a model has to work with',duration:7,title:'AI can read<br>what <em>survives.</em>',caption:'It can learn from recorded history and new results. A reason never recorded is still missing evidence.',foot:'Our design premise: preserve the explanation alongside the observation.',view:()=>`<div class="machine-view"><div><h2>What happened</h2><div class="visible-record" aria-hidden="true">${'<i></i>'.repeat(72)}</div><p class="small">Recorded cases · Laboratory results · Written guidance</p></div><div class="missing-reason"><span class="serif">Why this time?</span><span class="small">No explanation in the record.</span></div></div>`},
    {id:'mindline',name:'Meet Mindline',part:'Mindline',duration:5,title:'Mindline',caption:'Local laboratory evidence, with a place for the reasoning around it.',foot:'A prototype for prescribing doctors and hospital hygiene teams.',view:()=>`<div class="brand-scene">${fp()}<div><div class="brand-type">Mindline</div><p class="brand-tagline">Capturing the fingerprints of wisdom</p></div></div>`,cls:'brand'},
    {id:'gather',name:'Gather',part:'01 · Gather the evidence',duration:7,title:'Results arrive<br><em>in pieces.</em>',caption:'A sample. An organism. A susceptibility result. Corrections update the same record.',foot:'Simulated feed · Linked records · Revision handling',view:()=>`<div class="aggregation"><div><div class="input-lanes">${['Sample','Organism','Result'].map((s,j)=>`<div class="lane"><span class="lane-label">${s}</span><div class="lane-dots">${circles(11-j*2,i=>`<i data-reveal="${i*.08+j*.3}"></i>`)}</div></div>`).join('')}</div><div class="sample-total">${number(D.samples)} samples in the recorded year</div></div><div class="aggregate-center">→</div><div class="merged-record" data-reveal=".8"><p class="record-label">One linked history.</p><p>What was sampled.</p><p>What the lab reported.</p><p>When it became known.</p><span class="revision" data-reveal="2">A revision replaces an earlier result.</span></div></div>`},
    {id:'doctor',name:'Check a decision',part:'02 · Put it beside a decision',duration:9,title:'Does the familiar<br>answer still <em>fit?</em>',caption:'Look at the year. Then the recent results. Keep the size of the evidence in view.',foot:synthetic+' · As of 1 Nov 2026 · Susceptibility is not a probability of cure',view:drugs},
    {id:'because',name:'Keep the reason',part:'03 · Preserve what mattered',duration:8,title:'Keep the <em>because.</em>',caption:'A result tells us what was found. A note can keep what made someone reconsider.',foot:'Fictional note · Current prototype: patient-linked capture and explicit reason extraction',view:()=>`<div class="note-demo"><blockquote>“I revisited the plan <mark>because her last culture was resistant.</mark>”</blockquote><div class="saved-note" data-reveal=".8"><h2>A decision, with its context.</h2><p><span>Attached to</span>Demo patient</p><p><span>Written by</span>Dr. Demo</p><p><span>Reason retained</span>Previous resistant culture</p><button data-action="save">${local.saved?'Kept with the patient record ✓':'Keep this note ↗'}</button><p class="small">Demonstration only</p></div></div>`},
    {id:'wards',name:'Notice a change',part:'04 · See beyond one patient',duration:9,title:'Nine cases.<br>Is that <em>unusual here?</em>',caption:'The hygiene team sees each ward against its own history. The ICU now deserves a closer look.',foot:synthetic+' · 30 Oct 2026 · All tracked resistance types · Select a ward to inspect',view:wardView},
    {id:'late',name:'Question the spike',part:'05 · Check what caused the change',duration:7,title:'Sometimes the change<br>is in the <em>delivery.</em>',caption:'A late batch can look like a sudden change. Sampling time and arrival time tell different stories.',foot:'Simulated feed · Southern health centre · 8 Oct 2026 · Schematic arrival bars',view:()=>`<div class="late-scene"><div class="late-chart" role="img" aria-label="Illustration of quiet arrival days followed by a batch of 22 late results.">${[5,4,7,0,0,0,22,6].map((v,i)=>`<div class="late-column ${!v?'empty':''} ${i===6?'highlight':''}" style="--height:${Math.max(1,v/22*100)}%"><span>${i===0?'2 Oct':i===6?'8 Oct':''}</span></div>`).join('')}</div><div class="late-detail"><strong>22</strong><p>results arrived late, together.</p><p class="small">A reason to check the feed before interpreting the spike.</p></div></div>`},
    {id:'ask',name:'Ask & see',part:'06 · Let the question choose the view',duration:8,title:'A question can<br>become a <em>view.</em>',caption:'Ask in ordinary language. The answer brings the relevant chart and its evidence with it.',foot:'Scripted replay of the new Ask feature · Generated answers use computed facts and a fixed chart catalogue',view:()=>`<div class="ask-demo"><p class="question-line"><span id="typed-question">Is last month a better guide than last year?</span><span class="question-cursor" aria-hidden="true"></span></p><div class="answer-layout" data-reveal="1.3"><div class="answer-text">For this example, the year predicted later results a little better.<span class="small">Nitrofurantoin · Urology urine · ${guide.tested} tests</span></div><div><div class="loss-rows">${[['Earlier year',guide.ll_year],['Earlier month',guide.ll_month]].map(([label,v])=>`<div class="loss-row"><span>${label}</span><div class="loss-track"><i style="--value:${v/.4*100}%"></i></div><span class="loss-value">${v.toFixed(3)}</span></div>`).join('')}</div><div class="loss-axis">Average prediction error (log loss) · Lower is better · Scale 0–0.4</div></div></div></div>`},
    {id:'prediction',name:'Test a prediction',part:'07 · Make the past earn our trust',duration:8,title:'Let the next month<br><em>answer.</em>',caption:'Estimate from earlier results. Reveal the next four weeks. Repeat, and see which history holds up.',foot:synthetic+' · 13 historical test windows · Observed laboratory resistance, not patient outcomes',view:forecast},
    {id:'generator',name:'Generate a test',part:'08 · Build difficult days to test against',duration:10,title:'What if the pattern<br><em>changed tomorrow?</em>',caption:'Resample past cases. Model when results arrive. Add a cluster, a gap, or a correction—and watch the system respond.',foot:'Synthetic event generator · Data-informed sampling plus configured scenarios · Branches are illustrative',view:generation},
    {id:'close',name:'Leave a trace',part:'Mindline',duration:6,title:'Mindline',caption:'Keep the evidence. Keep the reasoning.<br>Leave the next person more to work with.',foot:'Built for the Tyks Laboratories × Mylab antibiotic efficacy challenge.',view:()=>`<div class="brand-scene">${fp()}<div><div class="brand-type">Mindline</div><p class="brand-tagline">Capturing the fingerprints of wisdom</p><div class="final-links"><a href="../">Explore the app ↗</a><button data-action="replay">Watch again ↺</button></div></div></div>`,cls:'close'}
  ];
  let duration=0; scenes.forEach(s=>{s.start=duration;duration+=s.duration;});
  let t=0,playing=false,last=performance.now(),index=-1,music=true,audioAllowed=false,settled=true;
  let currentScene=null,seenPeriod='';
  const audio=$('score'); audio.volume=.65;
  $('seek').max=duration;
  document.documentElement.classList.toggle('clean',params.get('clean')==='1');
  $('chapters').innerHTML=scenes.map((s,i)=>`<button class="chapter-button" data-scene="${i}" style="--duration:${s.duration}" aria-label="${i+1}. ${s.name}" title="${s.name}"></button>`).join('');
  const chapterButtons=[...$('chapters').children];
  const timeText=v=>`${Math.floor(v/60)}:${String(Math.floor(v%60)).padStart(2,'0')}`;

  function draw(force=false) {
    const next=Math.max(0,scenes.findIndex(s=>t<s.start+s.duration));
    const selected=t>=duration?scenes.length-1:next;
    if (selected!==index || force) {
      index=selected;currentScene=scenes[index];seenPeriod='';
      $('scene').className=`scene-${currentScene.cls||currentScene.id}`;
      $('scene').dataset.scene=currentScene.id;
      $('chapter').textContent=currentScene.part;
      $('headline').innerHTML=currentScene.title;
      $('caption').innerHTML=currentScene.caption;
      $('footnote').innerHTML=currentScene.foot;
      $('visual').innerHTML=currentScene.view();
      if (!params.has('clean')) history.replaceState(null,'',`${location.pathname}${location.search}#${currentScene.id}`);
    }
    const elapsed=t-currentScene.start;
    // Animations are functions of film time, so pause, seek, replay and capture agree.
    const still=reduced||settled;
    const progress=still?1:clamp(elapsed/2.7);
    $('visual').style.setProperty('--draw',1-Math.pow(1-progress,3));
    $('visual').style.setProperty('--grow',still?1:clamp((elapsed-.5)/1.8));
    $('visual').querySelectorAll('[data-reveal]').forEach(el=>{
      const p=still?1:clamp((elapsed-Number(el.dataset.reveal))/.65);
      el.style.opacity=p;el.style.transform=reduced?'none':`translateY(${(1-p)*7}px)`;
    });
    if (currentScene.id==='doctor' && !local.manualPeriod) {
      const period=elapsed<4.6?'year':'recent';
      if (period!==seenPeriod) {local.period=period;seenPeriod=period;$('visual').innerHTML=drugs();}
    }
    if (currentScene.id==='ask') {
      const q='Is last month a better guide than last year?';
      $('typed-question').textContent=still?q:q.slice(0,Math.max(1,Math.floor(elapsed*35)));
    }
    chapterButtons.forEach((b,i)=>{b.style.setProperty('--fill',clamp((t-scenes[i].start)/scenes[i].duration));b.setAttribute('aria-current',String(i===index));});
    $('seek').value=t;
    $('time').textContent=`${timeText(t)} / ${timeText(duration)}`;
    $('previous').disabled=t===0;
    $('next').disabled=index===scenes.length-1;
  }
  function audioSync() {
    if (!audioAllowed || !music || !playing) {audio.pause();return;}
    if (Math.abs(audio.currentTime-t)>.35) {try {audio.currentTime=t;}catch {}}
    audio.play().catch(()=>{audioAllowed=false;$('music').textContent='Enable music';});
  }
  function setPlaying(value,gesture=false) {
    if(gesture) audioAllowed=true;
    if(value && t>=duration) {t=0;local.manualPeriod=false;}
    playing=value;if(value)settled=false;last=performance.now();
    $('play').innerHTML=playing?'Pause <span>Ⅱ</span>':t>=duration?'Replay <span>↺</span>':'Play film <span>↗</span>';
    $('play').setAttribute('aria-label',playing?'Pause film':'Play film');
    audioSync();draw();
  }
  function seek(seconds,{pause=true,settle=true}={}) {
    t=clamp(Number(seconds)||0,0,duration);last=performance.now();local.manualPeriod=false;settled=settle;
    if(pause) setPlaying(false);
    draw();audioSync();return {time:t,scene:currentScene.id};
  }
  function step(delta) {seek(scenes[clamp(index+delta,0,scenes.length-1)].start);}
  $('play').addEventListener('click',()=>setPlaying(!playing,true));
  $('previous').addEventListener('click',()=>step(-1));$('next').addEventListener('click',()=>step(1));
  $('seek').addEventListener('input',e=>seek(e.target.value));
  $('chapters').addEventListener('click',e=>{const b=e.target.closest('[data-scene]');if(b)seek(scenes[+b.dataset.scene].start);});
  $('music').addEventListener('click',()=>{music=$('music').textContent==='Enable music'?true:!music;audioAllowed=true;$('music').textContent=music?'Music on':'Music off';$('music').setAttribute('aria-pressed',music);audioSync();});
  $('fullscreen').addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen();}catch{}});
  $('about').addEventListener('click',()=>{setPlaying(false);$('credits').showModal();});
  $('close-credits').addEventListener('click',()=>$('credits').close());
  $('visual').addEventListener('click',e=>{
    const b=e.target.closest('button');if(!b)return;
    setPlaying(false);
    if(b.dataset.period){local.period=b.dataset.period;local.manualPeriod=true;$('visual').innerHTML=drugs();}
    if(b.dataset.ward){local.ward=b.dataset.ward;$('visual').innerHTML=wardView();}
    if(b.dataset.action==='save'){local.saved=true;b.textContent='Kept with the patient record ✓';}
    if(b.dataset.action==='rerun'){local.seed++;$('visual').innerHTML=generation();}
    if(b.dataset.action==='replay'){seek(0);setPlaying(true,true);}
  });
  addEventListener('keydown',e=>{
    if(e.altKey||e.ctrlKey||e.metaKey||$('credits').open||e.target.matches('input,button,a,textarea,select'))return;
    if([' ','k','K','p','P'].includes(e.key)){e.preventDefault();setPlaying(!playing,true);}
    if(e.key==='ArrowRight'){e.preventDefault();step(1);}
    if(e.key==='ArrowLeft'){e.preventDefault();step(-1);}
    if(e.key==='Home'){e.preventDefault();seek(0);}
    if(e.key==='End'){e.preventDefault();seek(scenes[scenes.length-1].start);}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden)setPlaying(false);});
  let portrait=innerWidth<=560;
  addEventListener('resize',()=>{const p=innerWidth<=560;if(p!==portrait){portrait=p;draw(true);}});
  addEventListener('hashchange',()=>{const found=scenes.find(s=>s.id===location.hash.slice(1));if(found)seek(found.start);});
  const initial=scenes.find(s=>s.id===location.hash.slice(1));
  if(initial)t=initial.start;
  function frame(now){if(playing){t=Math.min(duration,t+(now-last)/1000);draw();if(t>=duration)setPlaying(false);}last=now;requestAnimationFrame(frame);}
  window.mindlineV2={duration,scenes:scenes.map(({id,name,start,duration})=>({id,name,start,duration})),seek,play:()=>setPlaying(true),pause:()=>setPlaying(false),state:()=>({t,playing,scene:currentScene.id,reduced}),data:D};
  draw();requestAnimationFrame(frame);
  if(params.get('autoplay')==='1'&&!reduced)setPlaying(true);
})();
