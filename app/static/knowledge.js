// Admin Knowledge Graph: what clinicians noticed, did and why, drawn as one calm flow.
// Only the de-identified, generalized concepts the API returns. A repeat is a mention, never proof.
const KG = { data:null, prep:null, serial:0, query:'', match:null, tokens:[], selected:null, hover:null, width:0, mode:'', ro:null, drawn:false, qSerial:0, questions:null, question:null };
const kgEsc = value => String(value ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kgNorm = value => String(value ?? '').toLowerCase().normalize('NFKD').replace(/[̀-ͯ]/g,'').replace(/[^\p{L}\p{N}\s]/gu,' ').replace(/\s+/g,' ').trim();
// Question words in English, Finnish and Swedish carry no concept; they are ignored when searching.
const KG_STOP = new Set('what which who why how when where do does did we you i is are was were be been the a an of to for in on at with about and or if then should would can could our my me us any there this that it its usually happens happen mita miksi milloin miten kun jos me mina se on ja tai mitka teemme vad varfor nar hur om vi jag det ar och eller att gor'.split(' '));
const KG_COL = {ward:0, drug:0, organism:0, resistance:0, condition:1, action:2, reason:3};
const KG_KIND = {condition:'When', action:'Then', reason:'Because', ward:'Ward', drug:'Medicine', organism:'Bacterium', resistance:'Resistance'};
const KG_CHIPS = ['ESBL', 'What do we do for fever?', 'meropenem', 'Urology', 'kipu', 'handover'];
const kgMonth = (value, month='long') => /^\d{4}-\d{2}$/.test(value || '') ? new Date(value+'-01T12:00:00Z').toLocaleDateString(typeof loc==='function'?loc():'en-GB',{month,year:'numeric',timeZone:'UTC'}) : value || '';
const kgLang = code => KG.data?.options.languages.find(l=>l.code===code)?.label || code || '';
const kgMotion = () => !(typeof reduceMotion==='function' && reduceMotion());
const kgList = items => items.length<2 ? items.join('') : items.slice(0,-1).join(', ')+' and '+items[items.length-1];
const kgPlural = (n, one, many) => `${fmt(n)} ${n===1?one:many}`;

async function renderKnowledge() {
  const serial=++KG.serial;
  KG.ro?.disconnect(); KG.ro=null; KG.drawn=false; KG.width=0; KG.mode='';
  $('page').innerHTML='<section class="kg-page"><header class="kg-head"><h1>Knowledge graph</h1><p class="kg-lead">Loading what clinicians noticed…</p></header><div class="skel" style="height:520px"></div></section>';
  try {
    const data=await api('/api/app/knowledge/graph');
    if(serial!==KG.serial || VIEW!=='knowledge')return;
    KG.data=data; KG.prep=kgPrepare(data);
    if(KG.selected && !KG.prep.byId.has(KG.selected))KG.selected=null;
    if(document.fonts?.ready)await document.fonts.ready;
    if(serial!==KG.serial || VIEW!=='knowledge')return;
    kgBuild();
  } catch(error) {
    if(serial!==KG.serial || VIEW!=='knowledge')return;
    $('page').innerHTML='<section class="kg-page"><header class="kg-head"><h1>Knowledge graph</h1><p class="kg-lead">The shared knowledge could not load.</p></header><button class="kg-chip" id="kg-retry">Try again</button></section>';
    $('kg-retry').onclick=renderKnowledge;
  }
}

// ---------- the graph, as rules: who or what → when → then → because ----------
function kgPrepare(d) {
  const entryById=new Map(d.entries.map(e=>[e.id,e]));
  const nodes=d.nodes.filter(n=>n.type in KG_COL).map(n=>({...n,entries:n.entry_ids.map(id=>entryById.get(id)).filter(Boolean)}));
  nodes.forEach(n=>{n.count=n.entries.length;n.set=new Set(n.entries.map(e=>e.id));n.norm=kgNorm(n.label);});
  const byId=new Map(nodes.map(n=>[n.id,n])),all=new Map(d.nodes.map(n=>[n.id,n]));
  const questions=new Map(d.edges.filter(e=>e.label==='framed by').map(e=>[e.source,all.get(e.target)?.label]));
  const links=new Map(),rules=new Map();
  const link=(a,b,e)=>{const id=a.id+'>'+b.id;let l=links.get(id);if(!l)links.set(id,l={id,source:a,target:b,facet:KG_COL[a.type]===0,ward:a.type==='ward',set:new Set()});l.set.add(e.id);};
  for(const e of d.entries){
    const ns=e.concept_ids.map(id=>byId.get(id)).filter(Boolean),of=type=>ns.filter(n=>n.type===type);
    const when=of('condition'),then=of('action'),why=of('reason'),facets=ns.filter(n=>KG_COL[n.type]===0);
    facets.forEach(f=>when.forEach(w=>link(f,w,e))); when.forEach(w=>then.forEach(t=>link(w,t,e))); then.forEach(t=>why.forEach(y=>link(t,y,e)));
    if(when[0]&&then[0]){
      const key=when[0].id+'|'+then[0].id;let r=rules.get(key);
      if(!r)rules.set(key,r={key,when:when[0],then:then[0],why:new Map(),entries:[]});
      r.entries.push(e);why.forEach(y=>r.why.set(y.id,y));e._rule=r;
    }
    e._s=kgNorm([e.if,e.then,e.why,e.summary,e.ward_name,e.ward,kgLang(e.language),kgMonth(e.month),kgMonth(e.month,'short'),e.source_text,...ns.map(n=>n.label),...when.map(w=>questions.get(w.id)||'')].join(' '));
  }
  const ruleList=[...rules.values()].map(r=>({...r,langs:new Set(r.entries.map(e=>e.language)),wards:new Set(r.entries.map(e=>e.ward)),why:[...r.why.values()]})).sort((a,b)=>b.entries.length-a.entries.length||a.then.label.localeCompare(b.then.label));
  ruleList.forEach(r=>r.entries.forEach(e=>{e._rule=r;}));
  links.forEach(l=>{l.count=l.set.size;});
  return {nodes,byId,links:[...links.values()],rules:ruleList,questions,entries:d.entries};
}

function kgFacts() {
  const P=KG.prep,d=KG.data,top=P.rules[0],langs=d.options.languages;
  const allLangs=P.rules.filter(r=>r.langs.size===langs.length).length,multiWard=P.rules.filter(r=>r.wards.size>1).length;
  const wards=d3.rollups(P.entries,v=>v.length,e=>e.ward).sort((a,b)=>b[1]-a[1]);
  const topWard=P.nodes.find(n=>n.type==='ward'&&n.entries[0]?.ward===wards[0]?.[0]);
  const wardRule=topWard?d3.rollups(topWard.entries.filter(e=>e._rule),v=>v.length,e=>e._rule.key).sort((a,b)=>b[1]-a[1])[0]:null;
  const wardTop=wardRule?P.rules.find(r=>r.key===wardRule[0]):null;
  const months=d.options.months.map(m=>({m,n:P.entries.filter(e=>e.month===m).length})),last=months[months.length-1],max=d3.max(months,m=>m.n)||1;
  const spark=`<span class="kg-spark" aria-hidden="true">${months.map(m=>`<i style="height:${Math.max(8,m.n/max*100)}%"></i>`).join('')}</span>`;
  return `<button class="kg-fact" data-kg-node="${kgEsc(top.then.id)}"><small>Written most often</small><strong>${kgEsc(top.then.label)}</strong><span>${kgPlural(top.entries.length,'note','notes')}, ${kgPlural(top.wards.size,'ward','wards')}, ${top.langs.size===langs.length?'every language':kgPlural(top.langs.size,'language','languages')}</span></button>
    <div class="kg-fact"><small>Across languages</small><strong>${fmt(allLangs)} of ${fmt(P.rules.length)} rules</strong><span>written in ${kgList(langs.map(l=>l.label))}; ${fmt(multiWard)} on more than one ward</span></div>
    ${topWard?`<button class="kg-fact" data-kg-node="${kgEsc(topWard.id)}"><small>Most active ward</small><strong class="kg-ward">${kgEsc(topWard.label)}</strong><span>${kgPlural(topWard.count,'note','notes')}${wardTop?`, most often “${kgEsc(wardTop.then.label)}”`:''}</span></button>`:''}
    ${last?`<div class="kg-fact"><small>Latest month</small><strong>${kgEsc(kgMonth(last.m))}</strong><span>${kgPlural(last.n,'note','notes')}, ${fmt(P.entries.length)} in ${fmt(months.length)} months</span>${spark}</div>`:''}`;
}

function kgBuild() {
  const P=KG.prep;
  $('page').innerHTML=`<section class="kg-page" id="kg-page">
    <header class="kg-head"><h1>Knowledge graph</h1><p class="kg-lead">What clinicians noticed, did and why, from ${kgPlural(P.entries.length,'de-identified note','de-identified notes')} in three languages. A repeat is a mention, not proof.</p></header>
    <div class="kg-facts" id="kg-facts">${kgFacts()}</div>
    <div class="kg-searchbar" role="search">
      <label class="kg-search"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/></svg><input id="kg-query" type="search" value="${kgEsc(KG.query)}" placeholder="Search a condition, medicine, ward or word" autocomplete="off" spellcheck="false" aria-label="Search the knowledge graph" aria-describedby="kg-found"><span class="kg-found" id="kg-found" aria-live="polite"></span></label>
      <div class="kg-chips" aria-label="Common searches">${KG_CHIPS.map(c=>`<button class="kg-chip" data-kg-chip="${kgEsc(c)}">${kgEsc(c)}</button>`).join('')}</div>
    </div>
    <div class="kg-main">
      <div class="kg-viz" id="kg-viz"></div>
      <aside class="kg-side" id="kg-side"><div class="kg-overview" id="kg-overview"></div><div class="kg-detail" id="kg-detail" role="region" aria-label="Selected concept" aria-live="polite"></div></aside>
    </div>
    <section class="kg-ask" aria-labelledby="kg-ask-title"><h2 id="kg-ask-title">Structured questions</h2><p>Answered from the local linked-data copy of the same notes.</p><div class="kg-ask-list" id="kg-ask-list"></div><div id="kg-answer" aria-live="polite"></div></section>
  </section>`;
  $('kg-facts').querySelectorAll('[data-kg-node]').forEach(b=>{b.onclick=()=>kgSelect(b.dataset.kgNode,true);});
  const q=$('kg-query');
  q.oninput=()=>kgSearch(q.value);
  q.onkeydown=e=>{
    if(e.key==='Enter'){e.preventDefault();const best=kgBest();if(best)kgSelect(best,true);}
    else if(e.key==='Escape'){e.preventDefault();if(q.value)kgSearch('');else kgSelect(null);}
  };
  document.querySelectorAll('[data-kg-chip]').forEach(b=>{b.onclick=()=>{const v=KG.query===b.dataset.kgChip?'':b.dataset.kgChip;q.value=v;kgSearch(v);if(v){const best=kgBest();if(best)kgSelect(best,true);}else kgSelect(null);};});
  if(!KG.keys){KG.keys=true;document.addEventListener('keydown',e=>{if(VIEW==='knowledge'&&e.key==='Escape'&&KG.selected&&document.activeElement?.id!=='kg-query')kgSelect(null);});}
  kgOverview();kgSearch(KG.query,true);kgAskList();
  KG.ro=new ResizeObserver(()=>{if(VIEW!=='knowledge'||!$('kg-viz')){KG.ro?.disconnect();return;}const w=Math.round($('kg-viz').getBoundingClientRect().width);if(w&&Math.abs(w-KG.width)>2)kgDraw();});
  KG.ro.observe($('kg-viz'));
  kgDraw();kgDetail();
}

// ---------- search ----------
function kgSearch(value, quiet) {
  KG.query=value;
  const tokens=kgNorm(value).split(' ').filter(w=>w&&!KG_STOP.has(w));
  KG.tokens=tokens;
  if(!tokens.length){KG.match=null;}
  else{
    const scored=KG.prep.entries.map(e=>[e,tokens.filter(w=>e._s.includes(w)).length]),best=d3.max(scored,s=>s[1]);
    KG.match=new Set(best?scored.filter(s=>s[1]===best).map(s=>s[0].id):[]);
  }
  const found=$('kg-found');
  if(found)found.textContent=KG.match?(KG.match.size?kgPlural(KG.match.size,'note','notes'):'No notes'):'';
  document.querySelectorAll('[data-kg-chip]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kgChip===KG.query));
  if(!quiet){kgPaint();kgOverview();}
}

function kgHit(n) { return KG.tokens.length>0 && KG.tokens.some(w=>n.norm.includes(w)); }

function kgBest() {
  if(!KG.tokens.length)return null;
  const P=KG.prep,whole=kgNorm(KG.query);
  let best=null,score=0;
  for(const n of P.nodes){
    const words=KG.tokens.filter(w=>n.norm.includes(w)).length;
    let s=words*10+(n.norm===whole?40:n.norm.startsWith(KG.tokens[0])?6:0);
    if(KG.match&&n.entries.some(e=>KG.match.has(e.id)))s+=n.entries.filter(e=>KG.match.has(e.id)).length/(n.count||1)*4;
    if(words&&s>score){score=s;best=n;}
  }
  if(best)return best.id;
  if(!KG.match?.size)return null;
  // No concept carries the word itself (a Finnish or Swedish phrasing): focus the rule it most often belongs to.
  const top=d3.rollups(P.entries.filter(e=>KG.match.has(e.id)&&e._rule),v=>v.length,e=>e._rule.then.id).sort((a,b)=>b[1]-a[1])[0];
  return top?.[0]||null;
}

// ---------- focus: hover beats selection, which narrows search ----------
function kgActive() {
  const id=KG.hover||KG.selected,node=id&&KG.prep.byId.get(id);
  if(!node)return KG.match;
  if(KG.match&&!KG.hover){const both=new Set([...node.set].filter(x=>KG.match.has(x)));if(both.size)return both;}
  return node.set;
}

function kgSelect(id, scroll) {
  // A second click on the selected concept clears it; links from facts, lists and search always select.
  KG.selected=!id?null:KG.selected===id&&!scroll?null:id;
  KG.hover=null;kgPaint();kgDetail();
  if(KG.selected&&scroll&&KG.mode!=='wide'){const el=document.querySelector(`[data-kg-id="${CSS.escape(KG.selected)}"]`);if(el&&KG.mode==='phone')el.scrollIntoView({block:'center',behavior:kgMotion()?'smooth':'auto'});}
}

function kgPaint() {
  const set=kgActive(),focus=KG.hover||KG.selected,on=n=>!set||n.entries.some(e=>set.has(e.id));
  const svg=d3.select('#kg-svg');
  if(!svg.empty()){
    svg.classed('kg-focus',!!set);
    svg.selectAll('.kg-node').classed('kg-dim',n=>!on(n)).classed('kg-hit',n=>kgHit(n)).classed('kg-sel',n=>n.id===KG.selected).attr('aria-pressed',n=>n.id===KG.selected);
    svg.selectAll('.kg-link').classed('kg-on',l=>!!set&&[...l.set].some(x=>set.has(x))).classed('kg-off',l=>!!set&&![...l.set].some(x=>set.has(x)));
    svg.classed('kg-hovering',!!focus);
  }
  document.querySelectorAll('.kg-rule,.kg-facet').forEach(el=>{
    const ids=el.dataset.kgSet?.split(' ')||[];const lit=!set||ids.some(x=>set.has(x));
    el.classList.toggle('kg-dim',!lit);el.setAttribute('aria-pressed',el.dataset.kgId===KG.selected);
    const n=KG.prep.byId.get(el.dataset.kgId);el.classList.toggle('kg-hit',!!n&&kgHit(n));
  });
}

// ---------- drawing ----------
function kgDraw() {
  const box=$('kg-viz');if(!box)return;
  const W=Math.round(box.getBoundingClientRect().width),page=$('kg-page'),pageW=page.getBoundingClientRect().width;
  KG.width=W;
  const mode=pageW>=1180?'wide':W>=700?'mid':'phone';
  if(mode!==KG.mode){KG.mode=mode;page.dataset.mode=mode;}
  if(mode==='phone'){kgDrawList();}
  else{const w2=Math.round(box.getBoundingClientRect().width);KG.width=w2;kgDrawGraph(w2);}
  kgPaint();
}

const kgCanvas=document.createElement('canvas').getContext('2d');
function kgMeasure(text, font) { kgCanvas.font=font; return kgCanvas.measureText(text).width; }
function kgWrap(text, width, font, lines=2) {
  const words=String(text).split(/\s+/),rows=[];let row='';
  for(let i=0;i<words.length;i++){
    const next=row?row+' '+words[i]:words[i];
    if(kgMeasure(next,font)<=width||!row){row=next;continue;}
    if(rows.length===lines-1){row=[row,...words.slice(i)].join(' ');break;}
    rows.push(row);row=words[i];
    if(rows.length===lines-1){row=words.slice(i).join(' ');break;}
  }
  if(row)rows.push(row);
  const last=rows.length-1;
  if(kgMeasure(rows[last],font)>width){let s=rows[last];while(s.length>1&&kgMeasure(s+'…',font)>width)s=s.slice(0,-1);rows[last]=s.replace(/[\s,;]+$/,'')+'…';}
  return rows;
}

function kgDrawGraph(W) {
  const P=KG.prep,box=$('kg-viz'),font=`500 12.5px ${css('--body')||'Inter, sans-serif'}`,small=`400 11.5px ${css('--body')||'Inter, sans-serif'}`;
  const of=type=>P.nodes.filter(n=>n.type===type);
  const facetX=Math.round(Math.min(200,Math.max(158,W*.19))),gap=Math.round(Math.max(84,W*.085)),c1=facetX+gap,colW=(W-c1)/3;
  const xs=[facetX,c1,c1+colW,c1+colW*2],labelW=colW-36,lastW=W-xs[3]-18,rowH=50,top=74;
  const r=d3.scaleSqrt().domain([1,d3.max(P.nodes,n=>n.count)||2]).range([3.2,8.5]);
  const pack=(list,step,from,to)=>{list.forEach((n,i)=>{n.y=Math.max(n.want,i?list[i-1].y+step:from);});if(to!=null)for(let i=list.length-1;i>=0;i--)n2(i);function n2(i){const lim=i===list.length-1?to:list[i+1].y-step;if(list[i].y>lim)list[i].y=Math.max(from+i*step,lim);}};
  const want=(n,dir)=>{const ls=P.links.filter(l=>(dir==='in'?l.target:l.source)===n&&!(dir==='out'&&l.ward)),t=d3.sum(ls,l=>l.count);return t?d3.sum(ls,l=>(dir==='in'?l.source:l.target).y*l.count)/t:top;};
  // Antimicrobial rules (those naming a medicine, bacterium or resistance) lead; the rest follow by mentions.
  const amr=n=>P.links.some(l=>l.target===n&&l.facet&&!l.ward);
  const when=of('condition').sort((a,b)=>amr(b)-amr(a)||b.count-a.count||a.label.localeCompare(b.label));
  when.forEach((n,i)=>{n.x=xs[1];n.y=top+i*rowH;});
  const bottom=top+(when.length-1)*rowH;
  for(const [type,c] of [['action',2],['reason',3]]){const list=of(type);list.forEach(n=>{n.x=xs[c];n.want=want(n,'in');});list.sort((a,b)=>a.want-b.want||b.count-a.count);pack(list,rowH,top,Math.max(bottom,top+(list.length-1)*rowH));}
  const facetStep=30,things=P.nodes.filter(n=>['drug','organism','resistance'].includes(n.type));
  things.forEach(n=>{n.x=facetX;n.want=want(n,'out');});things.sort((a,b)=>a.want-b.want||b.count-a.count);
  pack(things,facetStep,top,null);
  const wards=of('ward').sort((a,b)=>b.count-a.count||a.label.localeCompare(b.label)),wardTop=(things.length?things[things.length-1].y+facetStep+30:top);
  wards.forEach((n,i)=>{n.x=facetX;n.y=wardTop+i*facetStep;});
  const H=Math.ceil(Math.max(bottom,...P.nodes.map(n=>n.y))+34);
  const first=!KG.drawn&&kgMotion();KG.drawn=true;
  box.innerHTML=`<svg id="kg-svg" class="${first?'kg-enter':''}" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="group" aria-label="Rules from clinicians' notes: ward or medicine, when, then, because. ${P.nodes.length} concepts."></svg>`;
  const svg=d3.select('#kg-svg');
  svg.append('rect').attr('class','kg-bg').attr('width',W).attr('height',H).on('click',()=>{if(KG.selected)kgSelect(null);});
  const heads=[[xs[0],'Ward or medicine','end'],[xs[1],'When','start'],[xs[2],'Then','start'],[xs[3],'Because','start']];
  svg.append('g').attr('class','kg-heads').attr('aria-hidden','true').selectAll('text').data(heads).join('text').attr('x',(h,i)=>i?h[0]-4:h[0]+4).attr('y',24).attr('text-anchor',h=>h[2]).text(h=>h[1]);
  const path=l=>{const sx=l.source.x+r(l.source.count)+2,tx=l.target.x-r(l.target.count)-2,mx=sx+(tx-sx)*.5;return `M${sx},${l.source.y}C${mx},${l.source.y} ${mx},${l.target.y} ${tx},${l.target.y}`;};
  svg.append('g').attr('class','kg-links').attr('aria-hidden','true').selectAll('path').data(P.links).join('path')
    .attr('class',l=>`kg-link${l.facet?' kg-facet-link':''}${l.ward?' kg-ward-link':''}`).attr('d',path).attr('stroke-width',l=>Math.min(2.2,.7+Math.sqrt(l.count)*.4))
    .style('animation-delay',l=>`${240+KG_COL[l.target.type]*110}ms`);
  const g=svg.append('g').attr('class','kg-nodes').selectAll('g').data(P.nodes).join('g')
    .attr('class',n=>`kg-node kg-t-${n.type}`).attr('data-kg-id',n=>n.id).attr('transform',n=>`translate(${n.x},${n.y})`)
    .attr('tabindex',0).attr('role','button').attr('aria-label',n=>`${KG_KIND[n.type]}: ${n.label}. ${kgPlural(n.count,'note','notes')}.`)
    .style('animation-delay',n=>`${KG_COL[n.type]*90}ms`);
  g.append('circle').attr('class','kg-halo').attr('r',n=>r(n.count)+7);
  g.append('circle').attr('class','kg-dot').attr('r',n=>r(n.count));
  g.each(function(n){
    const el=d3.select(this),facet=KG_COL[n.type]===0,count=fmt(n.count),cw=kgMeasure(' '+count,small)+4;
    const text=el.append('text').attr('class','kg-label');
    if(facet){
      const room=facetX-r(n.count)-14-cw,rows=kgWrap(n.label,room,font,1);
      text.attr('x',-r(n.count)-9).attr('y',4.5).attr('text-anchor','end');
      text.append('tspan').text(rows[0]);text.append('tspan').attr('class','kg-n').text(' '+count);
    } else {
      const room=(n.type==='reason'?lastW:labelW),rows=kgWrap(n.label,room-cw,font,2),x=-r(n.count)+1,base=-Math.max(9,r(n.count)+4);
      rows.forEach((row,i)=>{const t=text.append('tspan').attr('x',x).attr('y',base-(rows.length-1-i)*15).text(row);if(i===rows.length-1)el.select('text').append('tspan').attr('class','kg-n').text(' '+count);void t;});
    }
    el.append('title').text(`${KG_KIND[n.type]}: ${n.label}`);
  });
  g.on('pointerenter',(e,n)=>{KG.hover=n.id;kgPaint();}).on('pointerleave',()=>{KG.hover=null;kgPaint();})
    .on('focus',(e,n)=>{KG.hover=n.id;kgPaint();}).on('blur',()=>{KG.hover=null;kgPaint();})
    .on('click',(e,n)=>{e.stopPropagation();kgSelect(n.id);})
    .on('keydown',(e,n)=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();kgSelect(n.id);}});
  if(first)setTimeout(()=>$('kg-svg')?.classList.remove('kg-enter'),1400);
}

function kgDrawList() {
  const P=KG.prep,box=$('kg-viz'),ids=n=>n.entries.map(e=>e.id).join(' ');
  const facet=n=>`<button class="kg-facet kg-t-${n.type}" data-kg-id="${kgEsc(n.id)}" data-kg-set="${ids(n)}"><i style="--s:${(5+Math.sqrt(n.count)*1.6).toFixed(1)}px"></i>${kgEsc(n.label)}<b>${fmt(n.count)}</b></button>`;
  const wards=P.nodes.filter(n=>n.type==='ward').sort((a,b)=>b.count-a.count),things=P.nodes.filter(n=>['drug','organism','resistance'].includes(n.type)).sort((a,b)=>b.count-a.count);
  box.innerHTML=`<div class="kg-phone">
    <div class="kg-facets"><div><small>Wards</small><p>${wards.map(facet).join('')}</p></div>${things.length?`<div><small>Medicines and bacteria</small><p>${things.map(facet).join('')}</p></div>`:''}</div>
    <ol class="kg-rules">${P.rules.map(r=>`<li><button class="kg-rule" data-kg-id="${kgEsc(r.then.id)}" data-kg-set="${r.entries.map(e=>e.id).join(' ')}">
      <span class="kg-rule-when"><em>When</em>${kgEsc(r.when.label)}</span><span class="kg-rule-then"><em>Then</em>${kgEsc(r.then.label)}</span>${r.why.length?`<span class="kg-rule-why"><em>Because</em>${kgEsc(r.why.map(y=>y.label).join('; '))}</span>`:''}<b>${fmt(r.entries.length)}</b></button></li>`).join('')}</ol></div>`;
  box.querySelectorAll('[data-kg-id]').forEach(b=>{b.onclick=()=>kgSelect(b.dataset.kgId);});
}

// ---------- the side: what stands out, and the selected concept ----------
function kgRuleRow(r, n) {
  const langs=KG.data.options.languages.filter(l=>r.langs.has(l.code)).map(l=>l.code.toUpperCase()).join(' · ');
  return `<button class="kg-rrow" data-kg-node="${kgEsc(r.then.id)}"><span><small>When ${kgEsc(r.when.label.charAt(0).toLowerCase()+r.when.label.slice(1))}</small>${kgEsc(r.then.label)}<small class="kg-meta">${langs} · ${kgPlural(r.wards.size,'ward','wards')}</small></span><b>${fmt(n ?? r.entries.length)}</b></button>`;
}

function kgOverview() {
  const P=KG.prep,el=$('kg-overview');if(!el)return;
  const match=KG.match,rules=P.rules.map(r=>({r,n:match?r.entries.filter(e=>match.has(e.id)).length:r.entries.length})).filter(x=>x.n).sort((a,b)=>b.n-a.n||b.r.entries.length-a.r.entries.length);
  const wards=P.nodes.filter(n=>n.type==='ward').map(w=>{const es=w.entries.filter(e=>!match||match.has(e.id)),top=d3.rollups(es.filter(e=>e._rule),v=>v.length,e=>e._rule.then.label).sort((a,b)=>b[1]-a[1])[0];return {w,n:es.length,top};}).filter(x=>x.n).sort((a,b)=>b.n-a.n);
  el.innerHTML=`<h2>${match?(match.size?`Matching “${kgEsc(KG.query)}”`:'Nothing matches'):'Written most often'}</h2>
    ${match&&!match.size?'<p class="kg-quiet">Try a medicine, a ward, or a word in English, Finnish or Swedish.</p>':`<div class="kg-rlist">${rules.slice(0,match?8:5).map(x=>kgRuleRow(x.r,x.n)).join('')}</div>`}
    ${wards.length?`<h2>By ward</h2><div class="kg-wlist">${wards.map(x=>`<button class="kg-wrow" data-kg-node="${kgEsc(x.w.id)}"><span><strong class="kg-ward">${kgEsc(x.w.label)}</strong><small>${x.top?kgEsc(x.top[0]):''}</small></span><b>${fmt(x.n)}</b></button>`).join('')}</div>`:''}`;
  el.querySelectorAll('[data-kg-node]').forEach(b=>{b.onclick=()=>kgSelect(b.dataset.kgNode,true);});
}

function kgDetail() {
  const el=$('kg-detail'),page=$('kg-page');if(!el)return;
  const n=KG.selected&&KG.prep.byId.get(KG.selected);
  page.classList.toggle('kg-has-detail',!!n);el.classList.toggle('open',!!n);
  if(!n){el.setAttribute('aria-hidden','true');return;}
  el.removeAttribute('aria-hidden');
  const d=KG.data,P=KG.prep,es=n.entries;
  const wards=d3.rollups(es,v=>v.length,e=>e.ward_name).sort((a,b)=>b[1]-a[1]);
  const langs=d.options.languages.map(l=>[l.label,es.filter(e=>e.language===l.code).length]).filter(x=>x[1]);
  const months=d.options.months.map(m=>[m,es.filter(e=>e.month===m).length]),max=d3.max(months,m=>m[1])||1;
  const rules=d3.rollups(es.filter(e=>e._rule),v=>v.length,e=>e._rule).sort((a,b)=>b[1]-a[1]);
  const said=[],seen=new Set();
  for(const e of [...es].sort((a,b)=>b.month.localeCompare(a.month))){if(said.length>=3)break;const k=e.source==='committed'?'kept':e.language;if(seen.has(k))continue;if(e.source_text||e.source==='committed'){seen.add(k);said.push(e);}}
  const question=P.questions.get(n.id);
  el.innerHTML=`<div class="kg-detail-in">
    <header><small class="kg-kind kg-t-${n.type}">${KG_KIND[n.type]}</small><button class="kg-close" id="kg-close" aria-label="Close">×</button></header>
    <h2>${kgEsc(n.label)}</h2>
    <p class="kg-count">${kgPlural(n.count,'note mentions','notes mention')} this${question?`<span>Asked as “${kgEsc(question)}”</span>`:''}</p>
    <dl class="kg-dl">
      <div><dt>Wards</dt><dd>${wards.slice(0,5).map(([w,c])=>`<span class="kg-ward">${kgEsc(w)}</span> ${fmt(c)}`).join('<i>·</i>')}${wards.length>5?`<i>·</i>${fmt(wards.length-5)} more`:''}</dd></div>
      <div><dt>Languages</dt><dd>${langs.map(([l,c])=>`${kgEsc(l)} ${fmt(c)}`).join('<i>·</i>')}</dd></div>
      <div><dt>Months</dt><dd><span class="kg-months" aria-label="${months.filter(m=>m[1]).map(m=>`${kgMonth(m[0])}: ${m[1]}`).join(', ')}">${months.map(m=>`<i title="${kgEsc(kgMonth(m[0]))}: ${m[1]}" style="height:${m[1]?Math.max(10,m[1]/max*100):0}%"></i>`).join('')}</span><span class="kg-range"><span>${kgEsc(kgMonth(months[0]?.[0],'short'))}</span><span>${kgEsc(kgMonth(months[months.length-1]?.[0],'short'))}</span></span></dd></div>
    </dl>
    <h3>${rules.length===1?'The rule':'Rules'}</h3>
    <div class="kg-rules-d">${rules.map(([r,c])=>`<button class="kg-chain" data-kg-node="${kgEsc(r.then.id)}"><span><em>When</em>${kgEsc(r.when.label)}</span><span><em>Then</em>${kgEsc(r.then.label)}</span>${r.why.length?`<span><em>Because</em>${kgEsc(r.why.map(y=>y.label).join('; '))}</span>`:''}<b>${fmt(c)}</b></button>`).join('')}</div>
    ${said.length?`<h3>Said as</h3>${said.map(e=>e.source==='committed'?`<figure class="kg-said"><figcaption>Kept note · ${kgEsc(e.ward_name)} · ${kgEsc(kgMonth(e.month,'short'))}</figcaption><blockquote>${kgEsc(e.summary)}</blockquote></figure>`:`<figure class="kg-said"><figcaption>${kgEsc(kgLang(e.language))} · illustrative</figcaption><blockquote lang="${kgEsc(e.language)}">${kgEsc(e.source_text)}</blockquote></figure>`).join('')}`:''}
  </div>`;
  $('kg-close').onclick=()=>kgSelect(null);
  el.querySelectorAll('[data-kg-node]').forEach(b=>{b.onclick=()=>kgSelect(b.dataset.kgNode,true);});
  el.scrollTop=0;
}

// ---------- structured questions, answered by the local RDF store ----------
async function kgAskList() {
  const serial=KG.serial;
  try{
    if(!KG.questions)KG.questions=(await api('/api/app/knowledge/questions')).questions;
    if(serial!==KG.serial||!$('kg-ask-list'))return;
    $('kg-ask-list').innerHTML=KG.questions.map(q=>`<button class="kg-chip" data-kg-q="${kgEsc(q.id)}" aria-pressed="false">${kgEsc(q.label)}</button>`).join('');
    $('kg-ask-list').querySelectorAll('[data-kg-q]').forEach(b=>{b.onclick=()=>kgAsk(b.dataset.kgQ);});
  }catch(error){if($('kg-ask-list'))$('kg-ask-list').innerHTML='<p class="kg-quiet">The structured questions are unavailable.</p>';}
}

async function kgAsk(question) {
  const serial=++KG.qSerial,out=$('kg-answer');
  document.querySelectorAll('[data-kg-q]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.kgQ===question));
  if(KG.question===question){KG.question=null;out.innerHTML='';document.querySelectorAll('[data-kg-q]').forEach(b=>b.setAttribute('aria-pressed','false'));return;}
  KG.question=question;out.innerHTML='<p class="kg-quiet">Finding notes…</p>';
  try{
    const result=await api('/api/app/knowledge/query',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,filters:{}})});
    if(serial!==KG.qSerial||!$('kg-answer'))return;
    const columns=result.columns||[],rows=result.rows||[];
    const cell=(row,c)=>{let v=row[c.key];if(v===null||v===undefined)return '';
      if(c.key==='ward')v=KG.data.options.wards.find(w=>w.code===v)?.name||v;else if(c.key==='language')v=kgLang(v);
      else if(c.key==='languages')v=String(v).split(',').map(x=>kgLang(x.trim())).join(', ');else if(c.key==='source')v=v==='illustrative'?'Illustrative':v==='committed'?'Kept note':v;
      else if(c.key==='month')v=kgMonth(v,'short');else if(c.key==='kind')v=KG_KIND[v]||v;return kgEsc(v);};
    out.innerHTML=`<p class="kg-quiet">${kgPlural(rows.length,'result','results')}</p>${rows.length?`<div class="kg-table"><table><thead><tr>${columns.map(c=>`<th scope="col">${kgEsc(c.label)}</th>`).join('')}</tr></thead><tbody>${rows.map(row=>`<tr>${columns.map(c=>`<td>${cell(row,c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`:''}<details class="kg-sparql"><summary>SPARQL</summary><pre><code>${kgEsc(result.sparql||'')}</code></pre></details>`;
  }catch(error){if(serial===KG.qSerial&&$('kg-answer'))out.innerHTML='<p class="kg-quiet">The question could not be answered. Please try again.</p>';}
}
