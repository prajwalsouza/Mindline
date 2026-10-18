// Hospital clock: each point is one sample, each ring one ward, time clockwise.
// Canvas handles the full feed; the adjacent searchable list is its keyboard equivalent.
const OV = { data: null, query: '', ward: '', status: '', through: '', selected: null, page: 0, serial: 0 };
const ovEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const ovDate = value => value ? niceDate(value) : 'Date unavailable';
const ovDay = value => Date.parse(value + 'T12:00:00Z');
const ovISO = value => new Date(value).toISOString().slice(0, 10);
const ovNormalize = value => value.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
const ovStatus = r => r.resistant === true ? 'Resistance found' : r.resistant === false ? 'No resistance found in reported tests' : r.status_label || 'No resistance result available';
const ovWard = r => r.ward_name || OV.data.wards.find(w => w.code === r.ward)?.name || r.ward;
const ovSpec = r => typeof specName === 'function' ? specName(r.specimen) : r.specimen;
const ovSearchText = r => [r.label, r.date, ovDate(r.date), ovWard(r), r.organism, ovSpec(r), r.age, r.sex === 'M' ? 'man male' : r.sex === 'F' ? 'woman female' : '', ovStatus(r), ...(r.flags || []), ...(r.drugs || []).map(d => `${d.name || d.code} ${d.result === 'R' ? 'resistant' : d.result === 'I' ? 'susceptible increased exposure' : 'susceptible'}`)].join(' ').toLowerCase();

async function renderOverview() {
  const serial = ++OV.serial;
  $('page').innerHTML = '<section class="ov-page"><h1>Data.</h1><p class="ov-intro">Loading the hospital clock…</p><div class="skel" style="height:480px"></div></section>';
  try {
    const data = await api('/api/app/overview');
    if (serial !== OV.serial || VIEW !== 'overview') return;
    const oldEnd = OV.data?.end;
    OV.data = data;
    OV.through = !OV.through || OV.through === oldEnd ? data.end : OV.through < data.start ? data.start : OV.through > data.end ? data.end : OV.through;
    if (OV.ward && !data.wards.some(w => w.code === OV.ward)) OV.ward = '';
    OV.selected = null; OV.page = 0;
    data.records.forEach(r => { r._search = ovNormalize(ovSearchText(r)); });
    ovBuild();
  } catch (error) {
    if (serial !== OV.serial || VIEW !== 'overview') return;
    $('page').innerHTML = '<section class="ov-page"><h1>Data.</h1><p>The sample data could not load. Please try again.</p><button class="ov-action" id="ov-retry">Try again</button></section>';
    $('ov-retry').onclick = renderOverview;
  }
}

function ovBuild() {
  const d = OV.data;
  $('page').innerHTML = `<section class="ov-page">
    <header class="ov-header"><div><h1>Data.</h1><p class="ov-intro">A year of samples, across the hospital.</p></div><p class="ov-source">Synthetic demo data<br>Results available on ${ovEsc(ovDate(d.asof))}</p></header>
    <div class="ov-controls" role="search" aria-label="Search the hospital samples">
      <label class="ov-search">Search samples<input id="ov-search" type="search" placeholder="Bacteria, ward, antibiotic or sample…" value="${ovEsc(OV.query)}" autocomplete="off"></label>
      <label>Ward<select id="ov-ward"><option value="">All wards</option>${d.wards.map(w => `<option value="${ovEsc(w.code)}"${OV.ward === w.code ? ' selected' : ''}>${ovEsc(w.name)}</option>`).join('')}</select></label>
      <label>Lab result<select id="ov-status"><option value="">All results</option><option value="resistant">Resistance found</option><option value="not-resistant">No resistance found</option><option value="pending">Awaiting final result</option><option value="other">No resistance result</option></select></label>
      <button class="ov-action ov-reset" id="ov-reset">Reset filters</button>
    </div>
    <div id="ov-summary" class="ov-summary" aria-live="polite"></div>
    <div class="ov-layout">
      <div class="ov-visual">
        <div class="ov-key" id="ov-key"><span class="ov-r-text"><i class="ov-dot ov-resistant"></i>Resistance found</span><span><i class="ov-dot ov-clear"></i>No resistance found</span><span><i class="ov-dot ov-pending"></i>No result yet / not applicable</span><span><i class="ov-selected-key"></i>Selected sample</span><span class="ov-ward"><i class="ov-ward-key"></i>Ward</span><span class="ov-timeline"><i class="ov-time-key"></i>Sample date</span></div>
        <p class="ov-guide" id="ov-guide">Each dot is one sample, including repeat samples. Each ring is one ward. Dates run clockwise. Hover for details; click a dot to keep it open. Click a ring or its name to filter the ward.</p>
        <div id="ov-pinned" class="ov-pinned" hidden></div>
        <div class="ov-clock" id="ov-clock"><canvas id="ov-canvas" width="1440" height="1440" role="img" aria-describedby="ov-guide ov-key" aria-label="Hospital samples arranged by ward and sample date. Use the sample list below the chart to explore with a keyboard."></canvas><svg id="ov-labels" viewBox="0 0 720 720" aria-label="Ward rings and sample date control"></svg><div class="ov-tooltip" id="ov-tooltip" role="tooltip" hidden></div></div>
        <div class="ov-time"><label for="ov-through">Show samples through <strong id="ov-through-label"></strong></label><input id="ov-through" type="range" min="0" max="${Math.round((ovDay(d.end)-ovDay(d.start))/86400000)}" step="1"><div class="ov-time-ends"><span>${ovEsc(ovDate(d.start))}</span><span>${ovEsc(ovDate(d.end))}</span></div><p>Drag the clock hand or move this slider to filter sample dates. Lab results stay as available on ${ovEsc(ovDate(d.asof))}.</p></div>
      </div>
      <aside class="ov-sidebar" aria-label="Sample details and matching results"><section class="ov-detail" id="ov-detail"></section><section class="ov-results"><header><h2>Explore the samples</h2><span id="ov-match-count"></span></header><p class="ov-list-hint">Most recent first. Select a row to find its dot.</p><div id="ov-list"></div><div class="ov-pages"><button class="ov-action" id="ov-prev">Previous</button><span id="ov-page-number"></span><button class="ov-action" id="ov-next">Next</button></div></section></aside>
    </div>
  </section>`;
  $('ov-status').value = OV.status;
  $('ov-search').oninput = e => { OV.query = e.target.value; OV.page = 0; OV.selected = null; ovUpdate(); };
  $('ov-ward').onchange = e => { OV.ward = e.target.value; OV.page = 0; OV.selected = null; ovUpdate(); };
  $('ov-status').onchange = e => { OV.status = e.target.value; OV.page = 0; OV.selected = null; ovUpdate(); };
  $('ov-reset').onclick = () => { Object.assign(OV, { query: '', ward: '', status: '', through: d.end, selected: null, page: 0 }); ovBuild(); };
  $('ov-through').value = Math.round((ovDay(OV.through)-ovDay(d.start))/86400000);
  $('ov-through').oninput = e => ovSetThrough(+e.target.value);
  $('ov-prev').onclick = () => { OV.page--; ovList(); };
  $('ov-next').onclick = () => { OV.page++; ovList(); };
  ovUpdate();
}

function ovSetThrough(day) {
  OV.through = ovISO(ovDay(OV.data.start) + Math.max(0, Math.min(day, +$('ov-through').max)) * 86400000);
  OV.selected = null; OV.page = 0;
  $('ov-through').value = day;
  ovUpdate();
}

function ovUpdate() {
  const words = ovNormalize(OV.query).trim().split(/\s+/).filter(Boolean);
  OV.matches = OV.data.records.filter(r => r.date <= OV.through && (!OV.ward || r.ward === OV.ward) && words.every(w => r._search.includes(w)) && (!OV.status || (OV.status === 'resistant' ? r.resistant === true : OV.status === 'not-resistant' ? r.resistant === false : OV.status === 'pending' ? ['waiting','organism_known'].includes(r.status) : r.resistant == null && !['waiting','organism_known'].includes(r.status))));
  OV.matches.sort((a, b) => b.date.localeCompare(a.date) || String(a.id).localeCompare(String(b.id)));
  $('ov-through-label').textContent = ovDate(OV.through);
  const resistant = OV.matches.filter(r => r.resistant === true).length;
  const pending = OV.matches.filter(r => ['waiting','organism_known'].includes(r.status)).length;
  $('ov-summary').innerHTML = `<div><strong>${fmt(OV.matches.length)}</strong><span>matching samples</span></div><div class="ov-resistance-summary"><strong>${fmt(resistant)}</strong><span>with resistance found</span></div><div><strong>${fmt(pending)}</strong><span>awaiting a final result</span></div>`;
  ovDraw(); ovDetail(); ovList();
}

function ovDraw() {
  const canvas = $('ov-canvas'), svg = d3.select('#ov-labels'), ctx = canvas.getContext('2d');
  const cx = 360, cy = 360, outer = 302, inner = 111, wards = OV.data.wards;
  const step = (outer-inner)/Math.max(1, wards.length-1), startAngle = -Math.PI/2 + .29, span = Math.PI*2-.58;
  const maxDays = Math.max(1, (ovDay(OV.data.end)-ovDay(OV.data.start))/86400000);
  const angle = date => startAngle + (ovDay(date)-ovDay(OV.data.start))/86400000/maxDays*span;
  const pos = (r,a) => [cx+r*Math.cos(a),cy+r*Math.sin(a)];
  ctx.setTransform(2,0,0,2,0,0); ctx.clearRect(0,0,720,720);
  const ink = css('--ink-2'), muted = css('--ink-3'), line = css('--line'), red = css('--accent'), selectedInk = css('--ink'), wardColor = css('--ward'), timeColor = css('--timeline');
  ctx.strokeStyle = line; ctx.lineWidth = 1;
  wards.forEach((_, i) => { ctx.beginPath(); ctx.arc(cx,cy,inner+i*step,startAngle,startAngle+span); ctx.stroke(); });
  const matching = new Set(OV.matches.map(r => r.id));
  OV.points = [];
  // A stable small radial offset separates samples taken on the same day.
  for (const r of OV.data.records) {
    if (r.date > OV.through || !matching.has(r.id)) continue;
    const wi = wards.findIndex(w => w.code === r.ward); if (wi < 0) continue;
    let hash = 0; for (const c of String(r.id)) hash = ((hash*31)+c.charCodeAt(0))|0;
    const jitter = (((hash>>>0)%997)/996-.5)*Math.min(step*.72, 16);
    const [x,y] = pos(inner+wi*step+jitter, angle(r.date));
    const point = {x,y,r}; OV.points.push(point);
    ctx.beginPath(); ctx.arc(x,y,r.resistant === true ? 1.8 : 1.35,0,Math.PI*2);
    ctx.globalAlpha = r.resistant === true ? .92 : r.resistant === false ? .52 : .48;
    ctx.fillStyle = r.resistant === true ? red : r.resistant === false ? ink : muted; ctx.fill();
  }
  ctx.globalAlpha = 1;
  const selected = OV.points.find(p => p.r.id === OV.selected);
  if (selected) { ctx.beginPath(); ctx.arc(selected.x,selected.y,6,0,Math.PI*2); ctx.strokeStyle = selectedInk; ctx.lineWidth = 2.5; ctx.stroke(); }
  // Cache the complete plot: pointer movement paints only a highlight layer,
  // leaving SVG controls, keyboard focus and the data filters untouched.
  const base = document.createElement('canvas'); base.width=canvas.width; base.height=canvas.height;
  base.getContext('2d').drawImage(canvas,0,0);
  const wardStats = new Map(wards.map(w => [w.code,{samples:0,resistant:0}]));
  OV.points.forEach(p=>{const n=wardStats.get(p.r.ward);if(n){n.samples++;n.resistant+=p.r.resistant===true;}});
  let hoverKey=null;
  const hoverPaint=(ward,point)=>{
    const key=ward ? `${ward}/${point?.r.id || ''}` : '';
    if(key===hoverKey)return; hoverKey=key;
    const stats=wardStats.get(ward),name=wards.find(w=>w.code===ward)?.name;
    svg.select('.ov-center-number').text(fmt(stats ? stats.samples : OV.matches.length));
    svg.select('.ov-center-label').classed('ov-ward', Boolean(ward)).text(name || 'samples in view');
    svg.select('.ov-center-date').classed('ov-r-text',Boolean(stats)).text(stats ? `${fmt(stats.resistant)} with resistance` : ovDate(OV.through));
    svg.selectAll('.ov-ring-label').classed('is-hovered',function(){return this.dataset.ward===ward;});
    ctx.setTransform(1,0,0,1,0,0);ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(base,0,0);ctx.setTransform(2,0,0,2,0,0);
    if(!ward)return;
    ctx.globalAlpha=.65;ctx.fillStyle=css('--paper');ctx.fillRect(0,0,720,720);ctx.globalAlpha=1;
    const wi=wards.findIndex(w=>w.code===ward);
    ctx.beginPath();ctx.arc(cx,cy,inner+wi*step,startAngle,startAngle+span);ctx.strokeStyle=wardColor;ctx.lineWidth=Math.min(step*.85,19);ctx.globalAlpha=.09;ctx.stroke();ctx.globalAlpha=1;
    for(const p of OV.points){if(p.r.ward!==ward)continue;ctx.beginPath();ctx.arc(p.x,p.y,p.r.resistant===true?2.1:1.65,0,Math.PI*2);ctx.fillStyle=p.r.resistant===true?red:p.r.resistant===false?ink:muted;ctx.fill();}
    if(point){ctx.beginPath();ctx.arc(point.x,point.y,6.5,0,Math.PI*2);ctx.strokeStyle=selectedInk;ctx.lineWidth=2;ctx.stroke();}
  };
  svg.selectAll('*').remove();
  wards.forEach((w,i) => {
    const g = svg.append('g').attr('class','ov-ring-label').attr('data-ward',w.code).attr('tabindex',0).attr('role','button').attr('aria-label',`Filter to ${w.name}`).attr('aria-pressed',OV.ward === w.code);
    g.append('text').attr('x',cx).attr('y',cy-inner-i*step+4).attr('text-anchor','middle').text(w.name);
    const activate = () => { OV.ward = OV.ward === w.code ? '' : w.code; $('ov-ward').value = OV.ward; OV.selected = null; OV.page = 0; ovUpdate(); };
    g.on('click',activate).on('keydown',e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activate(); } });
  });
  const first = new Date(OV.data.start + 'T12:00:00Z');
  for (let m = new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+1,1,12)); m.getTime() <= ovDay(OV.data.end); m.setUTCMonth(m.getUTCMonth()+1)) {
    const a = angle(ovISO(m)), p = pos(outer+24,a), tick = pos(outer+10,a), edge = pos(outer+14,a);
    svg.append('line').attr('x1',tick[0]).attr('y1',tick[1]).attr('x2',edge[0]).attr('y2',edge[1]).attr('stroke',line);
    svg.append('text').attr('class','ov-month').attr('x',p[0]).attr('y',p[1]+4).attr('text-anchor','middle').text(m.toLocaleDateString(typeof loc === 'function' ? loc() : 'en-GB',{month:'short',timeZone:'UTC'}));
  }
  svg.append('text').attr('class','ov-center-number').attr('x',cx).attr('y',cy-3).attr('text-anchor','middle').text(fmt(OV.matches.length));
  svg.append('text').attr('class','ov-center-label').attr('x',cx).attr('y',cy+21).attr('text-anchor','middle').text('samples in view');
  svg.append('text').attr('class','ov-center-date').attr('x',cx).attr('y',cy+43).attr('text-anchor','middle').text(ovDate(OV.through));
  const handA = angle(OV.through), p0 = pos(inner-21,handA), p1 = pos(outer+10,handA);
  svg.append('line').attr('x1',p0[0]).attr('y1',p0[1]).attr('x2',p1[0]).attr('y2',p1[1]).attr('stroke',timeColor).attr('stroke-width',1.5).attr('pointer-events','none');
  const knob = svg.append('circle').attr('class','ov-hand').attr('cx',p1[0]).attr('cy',p1[1]).attr('r',8).attr('fill',timeColor).attr('tabindex',0).attr('role','slider').attr('aria-label','Latest sample date shown').attr('aria-valuemin',0).attr('aria-valuemax',maxDays).attr('aria-valuenow',Math.round((ovDay(OV.through)-ovDay(OV.data.start))/86400000)).attr('aria-valuetext',ovDate(OV.through));
  knob.on('keydown',e => { const delta = e.key === 'ArrowLeft' || e.key === 'ArrowDown' ? -1 : e.key === 'ArrowRight' || e.key === 'ArrowUp' ? 1 : 0; if (delta || ['Home','End'].includes(e.key)) { e.preventDefault(); ovSetThrough(e.key === 'Home' ? 0 : e.key === 'End' ? maxDays : +$('ov-through').value+delta); document.querySelector('.ov-hand')?.focus(); } });
  // Pointer capture belongs to the persistent canvas, so repainting SVG does not interrupt a drag.
  knob.on('pointerdown',e => { e.preventDefault(); const el = canvas; el.setPointerCapture(e.pointerId); OV.dragging = true; });
  const toPoint = e => { const box=canvas.getBoundingClientRect(); return [(e.clientX-box.left)/box.width*720,(e.clientY-box.top)/box.height*720]; };
  canvas.onpointermove = e => {
    const [x,y]=toPoint(e);
    if (OV.dragging) { let a=Math.atan2(y-cy,x-cx)-startAngle; while(a<0)a+=Math.PI*2; ovSetThrough(Math.round(Math.max(0,Math.min(1,a/span))*maxDays)); return; }
    let hit=null, distance=64;
    for(const p of OV.points) { const ds=(p.x-x)**2+(p.y-y)**2; if(ds<distance){distance=ds;hit=p;} }
    const radius=Math.hypot(x-cx,y-cy),wi=Math.round((radius-inner)/step);
    const ward=hit?.r.ward || (wi>=0&&wi<wards.length&&Math.abs(radius-(inner+wi*step))<step*.48?wards[wi].code:null);
    OV.hover=hit; canvas.style.cursor=ward?'pointer':'default'; const tip=$('ov-tooltip'); hoverPaint(ward,hit);
    if(!ward){tip.hidden=true;return;}
    const w=wards.find(w=>w.code===ward),n=wardStats.get(ward);
    tip.innerHTML=hit ? `<strong class="${hit.r.organism ? 'ov-organism' : ''}">${ovEsc(hit.r.organism || hit.r.status_label || 'Sample')}</strong><span>${ovEsc(ovWard(hit.r))} · ${ovEsc(ovSpec(hit.r))}</span><span>${ovEsc(ovDate(hit.r.date))}</span><span class="${hit.r.resistant===true?'ov-r-text':''}">${ovEsc(ovStatus(hit.r))}</span><small>Click to keep these details open</small>` : `<strong>${ovEsc(w.name)}</strong><span>${fmt(n.samples)} matching samples</span><span class="ov-r-text">${fmt(n.resistant)} with resistance found</span><small>Click this ring to filter to ${ovEsc(w.name)}</small>`;
    tip.hidden=false; const box=canvas.getBoundingClientRect(); tip.style.left=`${Math.max(8,Math.min(box.width-270,x/720*box.width+14))}px`; tip.style.top=`${Math.max(8,Math.min(box.height-tip.offsetHeight-8,y/720*box.height+12))}px`;
  };
  canvas.onpointerleave=()=>{if(!OV.dragging){$('ov-tooltip').hidden=true;hoverPaint(null,null);}};
  canvas.onpointerup=e=>{
    if(OV.dragging){OV.dragging=false;try{canvas.releasePointerCapture(e.pointerId);}catch{}return;}
    const [x,y]=toPoint(e); let hit=null,distance=64;
    for(const p of OV.points){const ds=(p.x-x)**2+(p.y-y)**2;if(ds<distance){distance=ds;hit=p;}}
    if(hit){ovSelect(hit.r.id);return;}
    const radius=Math.hypot(x-cx,y-cy), wi=Math.round((radius-inner)/step);
    if(wi>=0 && wi<wards.length && Math.abs(radius-(inner+wi*step))<step*.48){
      OV.ward=OV.ward===wards[wi].code?'':wards[wi].code; $('ov-ward').value=OV.ward; OV.selected=null; OV.page=0; ovUpdate();
    }
  };
  canvas.onpointercancel=()=>{OV.dragging=false;};
}

function ovSelect(id) {
  OV.selected = OV.selected === id ? null : id;
  $('ov-tooltip').hidden = true;
  ovDraw(); ovDetail(); ovList();
}

function ovDetail() {
  const el = $('ov-detail'), r = OV.matches.find(r => r.id === OV.selected);
  const pinned=$('ov-pinned');
  pinned.hidden=!r;
  if(r){
    pinned.innerHTML=`<span>Selected: <strong class="${r.organism?'ov-organism':''}">${ovEsc(r.organism || r.status_label)}</strong> · ${ovEsc(ovWard(r))} · ${ovEsc(ovDate(r.date))}</span><button class="ov-action" id="ov-see-detail">View sample details</button><button class="ov-action" id="ov-unpin">Clear</button>`;
    $('ov-see-detail').onclick=()=>{el.scrollIntoView({behavior:typeof reduceMotion==='function'&&reduceMotion()?'auto':'smooth',block:'start'});el.tabIndex=-1;el.focus({preventScroll:true});};
    $('ov-unpin').onclick=()=>ovSelect(OV.selected);
  }
  if (!r) { el.innerHTML = '<h2>Look closer.</h2><p>Select a dot or a sample below to see the ward, bacteria, patient age and lab results.</p><p class="ov-detail-note">A sample can contain several bacteria. Red means resistance to at least one tested antibiotic; it does not mean resistance to every drug.</p>'; return; }
  const sex = r.sex === 'M' ? 'Man' : r.sex === 'F' ? 'Woman' : 'Sex not recorded';
  const resultLabel = code => code === 'R' ? 'Resistant' : code === 'I' ? 'Susceptible with increased exposure' : code === 'S' ? 'Susceptible' : code;
  el.innerHTML = `<header><h2 class="${r.organism ? 'ov-organism' : ''}">${ovEsc(r.organism || r.status_label || 'Sample')}</h2><button class="ov-action" id="ov-clear-sample">Clear selection</button></header><p class="ov-sample-ref">${ovEsc(r.label || 'Sample '+r.id)} · Synthetic record</p><dl><div><dt>Sample taken</dt><dd>${ovEsc(ovDate(r.date))}</dd></div><div><dt>Ward</dt><dd>${ovEsc(ovWard(r))}</dd></div><div><dt>Sample</dt><dd>${ovEsc(ovSpec(r))}</dd></div><div><dt>Patient</dt><dd>${ovEsc(sex)}${r.age != null ? `, aged ${ovEsc(r.age)} at sampling` : ', age not recorded'}</dd></div><div><dt>Lab status</dt><dd>${ovEsc(r.status_label || ovStatus(r))}</dd></div><div><dt>Resistance</dt><dd class="${r.resistant===true?'ov-r-text':''}">${ovEsc(ovStatus(r))}</dd></div></dl>${(r.drugs || []).length ? `<h3>Reported antibiotic tests</h3><ul class="ov-drugs">${r.drugs.map(d => `<li><span>${ovEsc(d.name || d.code)}${r.organisms?.length>1 ? `<small class="ov-organism">${ovEsc(d.organism)}</small>` : ''}</span><strong class="${d.result==='R'?'ov-r-text':''}">${ovEsc(resultLabel(d.result))}</strong></li>`).join('')}</ul>` : '<p>No antibiotic test results are available for this sample.</p>'}${r.flags?.length ? `<p class="ov-detail-note">Lab flags: ${r.flags.map(ovEsc).join(', ')}</p>` : ''}`;
  $('ov-clear-sample').onclick = () => ovSelect(OV.selected);
}

function ovList() {
  const n = OV.matches.length, size = 6, pages = Math.max(1,Math.ceil(n/size));
  OV.page = Math.max(0,Math.min(OV.page,pages-1));
  $('ov-match-count').textContent = fmt(n);
  $('ov-list').innerHTML = n ? OV.matches.slice(OV.page*size,OV.page*size+size).map(r=>`<button class="ov-result${OV.selected===r.id?' is-selected':''}" data-ov-id="${ovEsc(r.id)}" aria-pressed="${OV.selected===r.id}"><span class="ov-result-heading"><i class="ov-dot ${r.resistant===true?'ov-resistant':r.resistant===false?'ov-clear':'ov-pending'}" aria-hidden="true"></i><strong class="${r.organism ? 'ov-organism' : ''}">${ovEsc(r.organism || r.status_label || 'Sample')}</strong><time>${ovEsc(ovDate(r.date))}</time></span><span>${ovEsc(ovWard(r))} · ${ovEsc(ovSpec(r))}</span><small><span class="${r.resistant===true?'ov-r-text':''}">${ovEsc(ovStatus(r))}</span> · ${ovEsc(r.label || r.id)}</small></button>`).join('') : '<p class="ov-empty">No samples match these filters. Try another word, widen the date range, or reset filters.</p>';
  $('ov-list').querySelectorAll('[data-ov-id]').forEach(b=>{b.onclick=e=>{const id=b.dataset.ovId;ovSelect(id);if(e.detail===0)Array.from($('ov-list').querySelectorAll('[data-ov-id]')).find(item=>item.dataset.ovId===id)?.focus();};});
  $('ov-prev').disabled = OV.page===0; $('ov-next').disabled = OV.page>=pages-1;
  $('ov-page-number').textContent = n ? `${OV.page*size+1}–${Math.min(n,(OV.page+1)*size)} of ${fmt(n)}` : '0 samples';
}
