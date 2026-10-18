// Mindline — the film. A keynote-style walk through the product on real data (data.json, recorded from the
// API by app/demo/snapshot.py). Eight beats, about two minutes; the story and script are in app/demo/STORY.md.
// Click, → or space: next build. ←: back. P: play or pause. Hovering, picking and dragging inside a beat never advance it.
const d3 = window.d3;
const $ = id => document.getElementById(id);
const CAPTURE = new URLSearchParams(location.search).has('capture');
const STILL = new URLSearchParams(location.search).has('still');
if (CAPTURE || STILL) {
  document.documentElement.dataset.clean = 'true';
  document.documentElement.dataset.theme = 'quiet-light';
}
const REDUCED = STILL || matchMedia('(prefers-reduced-motion: reduce)').matches;
const D = await fetch('data.json').then(r => r.json());

// ---------------------------------------------------------------- data, prepared once
const fmt = d3.format(',');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;'}[c]));
const cap1 = s => s[0].toUpperCase() + s.slice(1);
const DAYS = Object.keys(D.days).sort();
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const dayName = s => `${+s.slice(8, 10)} ${MON[+s.slice(5, 7) - 1]}`;
const monthName = s => `${MON[+s.slice(5, 7) - 1]} ${s.slice(0, 4)}`;
const SAMPLES = d3.sum(D.wards.wards, w => d3.sum(w.volume));
const VOLUME = Object.fromEntries(D.wards.wards.map(w => [w.code, d3.sum(w.volume)]));
const NAME = {ED: 'Emergency', 'MED-A': 'Medicine A', 'MED-B': 'Medicine B', SURG: 'Surgery', URO: 'Urology', ICU: 'ICU', GER: 'Geriatrics', 'PHC-N': 'Health centre N', 'PHC-S': 'Health centre S'};
const DOC = D.doctor, AB = DOC.antibiogram;
const ROWS = ['NIT', 'MEC', 'TMP', 'AMP'].map(c => AB.drugs.find(d => d.code === c)).filter(Boolean);
const SURVIVED = (() => { for (const h of DOC.record.history) for (const i of h.isolates || []) if ((i.resisted || []).includes(DOC.plan)) return {org: i.short, date: h.date}; return null; })();
const SHARED = DOC.parsed.shared[0] || {};
// every resistant case in the order the lab confirmed it, with the day it arrived
const CASES = DAYS.flatMap(d => D.days[d].new_cases.map(c => ({...c, arrived: d, key: c.fp + c.short})));

// ---------------------------------------------------------------- stage: a fixed W×H box, scaled to fit above the controls
const frame = $('frame'), stage = $('stage'), H1 = $('h'), CAP = $('c'), tipEl = $('tip');
let W = 1600, H = 900, LAND = true;
function fit() {
  const band = CAPTURE || STILL ? 0 : parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--band')) || 64;
  const vw = innerWidth, vh = innerHeight - band, land = vw / vh > .95, changed = land !== LAND;
  LAND = land; W = land ? 1600 : 900; H = land ? 900 : 1500;
  const k = Math.min(vw / W, vh / H);
  Object.assign(stage.style, {width: W + 'px', height: H + 'px', transform: `translate(${(vw - W * k) / 2}px, ${(vh - H * k) / 2}px) scale(${k})`});
  $('svg').setAttribute('viewBox', `0 0 ${W} ${H}`);
  stage.dataset.o = land ? 'land' : 'port';
  return changed;
}
fit();

// ---------------------------------------------------------------- the film's tools, handed to every beat
const ctx = {instant: false};
let epoch = 0;
const timers = new Set();
ctx.later = (fn, ms) => {     // a timed step inside a build; runs at once when jumping or with reduced motion
  if (ctx.instant || REDUCED) return fn();
  const e = epoch, id = setTimeout(() => { timers.delete(id); if (e === epoch) fn(); }, ms);
  timers.add(id);
};
ctx.T = (sel, dur = 700, delay = 0, ease = d3.easeCubicOut) => ctx.instant || REDUCED ? sel : sel.transition().duration(dur).delay(delay).ease(ease);

// type: words rise in one after another; a change of line fades the old one up and out first
function words(text) {
  let i = 0;
  const markup = esc(text).replace(/\n/g, '<br>');
  const marked = window.OrganismText ? OrganismText.html(markup) : markup;
  return marked.replace(/(<[^>]+>)|([^\s<]+)/g, (m, tag) => tag ? tag : `<span class="w" style="--i:${i++}">${m}</span>`);
}
function say(el, text, cls = '') {
  const key = cls + '|' + text;
  if (el.dataset.key === key) return;
  el.dataset.key = key; clearTimeout(el._t);
  const base = el === H1 ? 'h ' : 'c ', inst = ctx.instant || REDUCED;
  const put = () => {
    el.className = base + cls + (inst ? ' instant' : ''); el.innerHTML = text ? words(text) : '';
    void el.offsetWidth; el.classList.add('on');
    if (inst) requestAnimationFrame(() => requestAnimationFrame(() => el.classList.remove('instant')));
  };
  if (!inst && el.textContent) { el.classList.add('out'); el._t = setTimeout(put, 280); } else put();
}
ctx.head = t => say(H1, t);
ctx.hero = t => say(H1, t, 'hero');
ctx.cap = t => say(CAP, t);

// one pool of dots carries through the whole film: lab results, then drug rows, then cases, then the logo
const N = 260;
const pool = d3.select('#pool').selectAll('circle').data(d3.range(N)).join('circle')
  .attr('cx', W / 2).attr('cy', H / 2).attr('r', 0).attr('class', 'k-mute').style('opacity', 0);
ctx.place = (targets, o = {}) => {   // targets[i] = {x, y, r, k (class), o (opacity), from: [x, y]}; dots without one fade out
  const inst = ctx.instant || REDUCED;
  pool.each(function (i) {
    const t = targets[i], s = d3.select(this).interrupt();
    if (t && t.k) s.attr('class', t.k);
    if (inst) { if (t) s.attr('cx', t.x).attr('cy', t.y).attr('r', t.r ?? 4).style('opacity', t.o ?? 1); else s.attr('r', 0).style('opacity', 0); return; }
    if (t && t.from) s.attr('cx', t.from[0]).attr('cy', t.from[1]);
    const delay = typeof o.stagger === 'function' ? o.stagger(i, t) : (o.stagger || 0) * i;
    const tr = s.transition().duration(o.dur ?? 900).delay(delay).ease(o.ease || d3.easeCubicInOut);
    if (t) tr.attr('cx', t.x).attr('cy', t.y).attr('r', t.r ?? 4).style('opacity', t.o ?? 1);
    else tr.attr('r', 0).style('opacity', 0);
  });
};
ctx.dots = () => pool;

// per-beat layers: drawings under the dots (art), drawings over them (art2), and HTML (ui)
function freshLayers(fade) {
  for (const id of ['art', 'art2']) {
    const old = document.getElementById(id), neu = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    old.after(neu); old.removeAttribute('id'); neu.id = id;
    if (fade) d3.select(old).interrupt().transition().duration(380).style('opacity', 0).remove(); else old.remove();
  }
  const oldUi = document.getElementById('ui'), ui = document.createElement('div');
  ui.className = 'ui'; oldUi.after(ui); oldUi.removeAttribute('id'); ui.id = 'ui';
  if (fade) { oldUi.classList.add('leaving'); setTimeout(() => oldUi.remove(), 420); } else oldUi.remove();
  ctx.art = d3.select('#art'); ctx.art2 = d3.select('#art2'); ctx.ui = ui;
}
ctx.html = (cls, html, style = {}) => { const el = document.createElement('div'); el.className = cls; el.innerHTML = html; Object.assign(el.style, style); ctx.ui.append(el); return el; };
ctx.on = el => { if (ctx.instant || REDUCED) el.classList.add('on'); else requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('on'))); return el; };
ctx.hold = () => { holdUntil = performance.now() + 3500; };
ctx.W = () => W; ctx.H = () => H; ctx.land = () => LAND;

// ---------------------------------------------------------------- 1 · Mindline: the yearly report, and what Tyks asked for instead
const LOGO_GAP = 37, LOGO_R = 13;
function logoAt(x, y) { return [[x - LOGO_GAP, y, 'k-ink'], [x, y - 11, 'k-acc'], [x + LOGO_GAP, y, 'k-mute']]; }
const WARD_ORDER = ['PHC-N', 'ED', 'ICU', 'SURG', 'URO', 'MED-A', 'MED-B', 'GER', 'PHC-S'];
const SHORTNAME = {ED: 'ED', 'MED-A': 'Med A', 'MED-B': 'Med B', SURG: 'Surgery', URO: 'Urology', ICU: 'ICU', GER: 'Geriatrics', 'PHC-N': 'Centre N', 'PHC-S': 'Centre S'};
function wardBlocks(W, H, land, total) {   // the year's dots shared out by ward volume, the last four weeks lit
  const vols = WARD_ORDER.map(c => VOLUME[c] || 0), sum = d3.sum(vols);
  const n = vols.map(v => Math.max(6, Math.round(v / sum * total)));
  const cols = 4, sp = land ? 15 : 17, gap = land ? 150 : 0;
  const out = [], labels = [];
  let k = 0;
  WARD_ORDER.forEach((code, wi) => {
    const cx = land ? W / 2 + (wi - 4) * gap : W / 2 + ((wi % 3) - 1) * 260, base = land ? H * .62 : H * .36 + Math.floor(wi / 3) * 300;
    const recent = Math.max(1, Math.round(n[wi] * 28 / 365));
    for (let j = 0; j < n[wi]; j++) {
      const col = j % cols, row = Math.floor(j / cols);
      out.push({x: cx + (col - 1.5) * sp, y: base - row * sp, r: 5, k: j >= n[wi] - recent ? 'k-acc' : 'k-mute', o: 1});
      k++;
    }
    labels.push([cx, base + 40, SHORTNAME[code]]);
  });
  return {dots: out, labels};
}
const B1 = {
  id: 'mindline', name: 'Mindline', steps: [4000, 5200, 6800],
  step(k, c) {
    const W = c.W(), H = c.H(), land = c.land();
    if (k === 0) {
      c.hero('Mindline'); c.cap('Antibiotic resistance, ward by ward, as it happens.');
      const r = d3.randomLcg(11), g = d3.randomNormal.source(r)(0, 1);
      c.place(d3.range(220).map(() => { const y = H * .5 + g() * H * .2, x = r() * W; return {x, y, r: 1.5 + r() * 2.4, k: 'k-mute', o: .38, from: [-30 - r() * 500, y]}; }),
        {dur: 2600, stagger: i => (i * 37 % 100) * 9, ease: d3.easeCubicOut});
    }
    if (k === 1) {
      c.head('Today: one report a year, for the whole hospital.'); c.cap(`${fmt(SAMPLES)} samples a year from nine wards and health centres, averaged into one table.`);
      const sp = land ? 18 : 20, cx = W * .5, cy = land ? H * .53 : H * .45;
      c.place(d3.range(240).map(i => ({x: cx + (i % 20 - 9.5) * sp, y: cy + (Math.floor(i / 20) - 5.5) * sp, r: 4.6, k: 'k-ink', o: 1})),
        {dur: 1000, stagger: i => (i % 20) * 28 + (i * 13 % 7) * 20});
    }
    if (k === 2) {
      c.head('Mindline: your ward, the last four weeks, against its year.'); c.cap('What Tyks asked for: up-to-date results from the doctor’s own ward. Updated with every result.');
      const {dots, labels} = wardBlocks(W, H, land, 236);
      c.place(dots, {dur: 1300, stagger: i => (i % 37) * 18});
      labels.forEach(([x, y, t], i) => c.art2.append('text').attr('class', 't-tiny').attr('x', x).attr('y', y).attr('text-anchor', 'middle').text(t).style('opacity', 0)
        .call(s => c.T(s, 600, 700 + i * 60).style('opacity', 1)));
    }
  }
};

// ---------------------------------------------------------------- 2 · what the ward knows, captured as it is said
const KIND = {note: 'thinks', reason: 'because', decision: 'decided', 'if-then': 'if → then'};
function narrHTML() {
  let wi = 0;
  const plain = s => s.split(/(\s+)/).map(t => !t || /^\s+$/.test(t) ? t : `<span class="wd" style="--d:${wi++}">${esc(t)}</span>`).join('');
  return DOC.parsed.facts.map(f => {
    let pos = 0, out = '';
    for (const e of [...f.entities].sort((a, b) => a.span[0] - b.span[0])) {
      out += plain(f.text.slice(pos, e.span[0]));
      const what = {drug: 'drug', organism: 'organism', resistance: 'resistance type', condition: 'condition', symptom: 'symptom'}[e.type] || e.type;
      out += `<span class="wd ent ${e.type}" data-live data-tip="<b>${esc(what)}</b> · ${esc(e.label)}${e.code && e.code !== e.label && e.type === 'drug' ? ' (' + esc(e.code) + ')' : ''}" style="--d:${wi++}">${esc(f.text.slice(e.span[0], e.span[1]))}</span>`;
      pos = e.span[1];
    }
    return `<p class="fact"><span class="kind ${f.kind}">${KIND[f.kind] || f.kind}</span>${out + plain(f.text.slice(pos))}</p>`;
  }).join('');
}
const B2 = {
  id: 'capture', name: 'What the ward knows', steps: [9200, 7600],
  enter(c) { c.place([], {dur: 600}); },
  step(k, c) {
    const land = c.land();
    if (k === 0) {
      c.head('And what the ward knows, as it is said.'); c.cap('A doctor on Urology, about a patient whose result is still in the lab.');
      const n = c.narr = c.html('narr arriving', narrHTML(), land ? {left: '330px', top: '235px', width: '1060px'} : {left: '210px', top: '300px', width: '640px'});
      n.querySelectorAll('.wd').forEach(w => { w.style.transitionDelay = (c.instant ? 0 : parseInt(w.style.getPropertyValue('--d')) * 55) + 'ms'; });
      c.on(n); requestAnimationFrame(() => n.querySelectorAll('.wd').forEach(w => w.classList.add('in')));
      if (c.instant || REDUCED) n.querySelectorAll('.wd').forEach(w => w.classList.add('in'));
      c.later(() => {   // once spoken, it is read: drugs, organisms, decisions and if-then rules light up
        c.cap('Drugs, bacteria, decisions and if-then rules are picked out, in English, Finnish or Swedish.');
        n.querySelectorAll('.wd').forEach(w => { w.style.transitionDelay = '0ms'; });
        n.classList.remove('arriving'); n.classList.add('parsed');
      }, 5200);
    }
    if (k === 1) {
      c.head('Kept twice, and kept apart.'); c.cap('Every word stays with the patient. Only the decision goes to the ward, without her.');
      const rec = c.html('card rec', `<h3>Patient record</h3><p class="sub">${esc(DOC.patient.id)} · identifiable · every word</p>`,
        land ? {left: '100px', top: '250px', width: '660px', height: '330px'} : {left: '70px', top: '250px', width: '760px', height: '570px'});
      rec.style.zIndex = 0; c.narr.style.zIndex = 1;
      c.narr.classList.add('filed');
      c.narr.style.transform = land ? 'translate(-190px, 108px) scale(.54)' : 'translate(-110px, 40px) scale(.74)';
      const age = SHARED.age_band ? `${SHARED.sex === 'F' ? 'woman' : 'man'} ${SHARED.age_band}` : '';
      const chips = [SHARED.sample, age, `${SHARED.decision === 'start' ? 'started' : 'switched to'} ${ROWS.find(d => d.code === SHARED.drug)?.name || SHARED.drug}`, SHARED.month && monthName(SHARED.month)].filter(Boolean);
      const know = c.html('card know', `<h3>Ward knowledge · ${esc(NAME[SHARED.ward] || SHARED.ward)}</h3><p class="sub">de-identified · for colleagues on the ward</p>
        <div class="chips">${chips.map((t, i) => `<span class="chip ${i === 2 ? 'acc' : ''}" style="--i:${i}">${esc(t)}</span>`).join('')}</div>
        <p class="gone"><b>Left behind</b>${DOC.parsed.removed.map((t, i) => `<s style="--i:${i}">${esc(t)}</s>`).join(' ')}</p>`,
        land ? {left: '810px', top: '268px', width: '700px'} : {left: '70px', top: '860px', width: '760px'});
      c.on(rec); c.on(know);
    }
  }
};

// ---------------------------------------------------------------- 3 · two people use it
const B3 = {
  id: 'users', name: 'Two users', steps: [6400],
  step(k, c) {
    const W = c.W(), H = c.H(), land = c.land();
    c.head('Two people use it, from the same evidence.'); c.cap('');
    const L = land ? [W * .3, H * .5] : [W * .5, H * .33], R = land ? [W * .7, H * .5] : [W * .5, H * .7];
    // the doctor: three drug rows; the hygiene team: wards, one of them warm
    const rows = d3.range(3 * 14).map(i => { const r = Math.floor(i / 14), j = i % 14; return {x: L[0] + (j - 6.5) * 22, y: L[1] - 40 + r * 40, r: 6.5, k: j < [12, 13, 8][r] ? 'k-ink' : 'k-hollow', o: 1}; });
    const wards = [[-90, -40, 26], [0, -70, 18], [85, -35, 22], [-60, 45, 20], [30, 40, 30], [110, 55, 14]];
    const cells = wards.flatMap(([dx, dy, r], wi) => d3.range(Math.round(r / 2.2)).map(j => { const a = j / Math.round(r / 2.2) * Math.PI * 2; return {x: R[0] + dx + Math.cos(a) * r, y: R[1] + dy + Math.sin(a) * r, r: 4.5, k: wi === 1 ? 'k-acc' : 'k-mute', o: 1}; }));
    c.place([...rows, ...cells], {dur: 1200, stagger: i => (i % 14) * 25});
    const block = (xy, h, lines, dy) => {
      const el = c.html('who', `<h3>${h}</h3>${lines.map(t => `<p>${t}</p>`).join('')}`, {left: (xy[0] - 260) + 'px', top: (xy[1] + dy) + 'px', width: '520px'});
      return c.on(el);
    };
    block(L, 'The doctor', ['One patient, a few seconds.', '“Will it work here?”'], land ? 110 : 90);
    block(R, 'The hygiene team', ['Every ward, every morning.', '“What changed, and is it real?”'], land ? 110 : 110);
  }
};

// ---------------------------------------------------------------- 4 · the doctor: will it work here?
function rowsLayout(W, H, land) {
  return land ? {x0: 610, sp: 26, r: 7.5, y: i => 318 + i * 98, label: i => [570, 318 + i * 98 + 8, 'end'], pct: i => [610 + 20 * 26 + 20, 318 + i * 98 + 8, 'start'], sub: i => [570, 318 + i * 98 + 34, 'end']}
    : {x0: 120, sp: 34, r: 9, y: i => 440 + i * 168, label: i => [104, 440 + i * 168 - 38, 'start'], pct: i => [W - 104, 440 + i * 168 - 38, 'end'], sub: i => [104, 440 + i * 168 + 46, 'start']};
}
const B4 = {
  id: 'doctor', name: 'The doctor', steps: [5600, 6600, 7000, 6400],
  enter(c) {
    const W = c.W(), H = c.H(), L = c.L = rowsLayout(W, H, c.land());
    const gx = L.x0 + 15.5 * L.sp;   // the 80% line, between dot 16 and dot 17
    c.art.append('line').attr('x1', gx).attr('x2', gx).attr('y1', L.y(0) - 34).attr('y2', L.y(ROWS.length - 1) + 22).attr('class', 's-line').attr('stroke-width', 2).attr('stroke-dasharray', '3 6');
    c.art.append('text').attr('x', gx).attr('y', c.land() ? L.y(0) - 44 : L.y(ROWS.length - 1) + 52).attr('text-anchor', 'middle').attr('class', 't-tiny').text('80%');
    const rows = c.art2.selectAll('g.row').data(ROWS).join('g').attr('class', 'row').attr('data-live', '').style('opacity', 0);
    rows.append('rect').attr('class', 'hit').attr('x', c.land() ? 300 : 80).attr('y', (d, i) => L.y(i) - (c.land() ? 40 : 70)).attr('width', c.land() ? 1000 : W - 160).attr('height', c.land() ? 86 : 140).attr('fill', 'transparent');
    rows.append('text').attr('class', 't-label').each(function (d, i) { const [x, y, a] = L.label(i); d3.select(this).attr('x', x).attr('y', y).attr('text-anchor', a).text(cap1(d.name)); });
    rows.append('text').attr('class', 't-label pct').each(function (d, i) { const [x, y, a] = L.pct(i); d3.select(this).attr('x', x).attr('y', y).attr('text-anchor', a).text(`${Math.round(d.year.share * 100)}%`); });
    rows.append('text').attr('class', 't-small').each(function (d, i) {
      const [x, y, a] = L.pct(i); d3.select(this).attr('x', c.land() ? x : x - 96).attr('y', c.land() ? y + 26 : y).attr('text-anchor', a).text(`${fmt(d.year.s)} of ${fmt(d.year.n)}`);
    });
    rows.on('click', (e, d) => { e.stopPropagation(); c.hold(); setPlan(c, d.code); });
    c.T(rows, 700, 300).style('opacity', 1);
  },
  step(k, c) {
    const L = c.L, land = c.land(), last = L.y(ROWS.length - 1);
    if (k === 0) {
      c.head('The doctor: will it work here?'); c.cap('Woman, 65+, urine sample, on Urology. Her result is still in the lab.');
      c.place(ROWS.flatMap((d, i) => d3.range(20).map(j => ({x: L.x0 + j * L.sp, y: L.y(i), r: L.r, k: j < Math.round(d.year.share * 20) ? 'k-ink' : 'k-hollow', o: 1}))),
        {dur: 1100, stagger: i => (i % 20) * 22 + Math.floor(i / 20) * 110});
    }
    if (k === 1) {
      c.head('This ward’s year, and its last four weeks.'); c.cap('Filled dots: susceptible in the lab, 12 months on Urology. The marker: the last four weeks, as a count while numbers are small.');
      ROWS.forEach((d, i) => {
        if (!d.recent.n) return;
        const x = L.x0 - L.sp / 2 + d.recent.share * 20 * L.sp, y = L.y(i) - L.r - 8, acc = d.code === DOC.plan;
        const m = c.art2.append('path').attr('d', 'M-9,-13L9,-13L0,0Z').attr('class', acc ? 'f-acc' : 'f-ink3').attr('transform', `translate(${x},${y - 30})`).style('opacity', 0);
        c.T(m, 800, 200 + i * 120, d3.easeBackOut).attr('transform', `translate(${x},${y})`).style('opacity', 1);
        if (acc) c.T(c.art2.append('text').attr('x', x).attr('y', y - 22).attr('text-anchor', 'middle').attr('class', 't-small t-acc').text(`last 4 weeks: ${d.recent.s} of ${d.recent.n}`).style('opacity', 0), 600, 900).style('opacity', 1);
      });
    }
    if (k === 2) {
      c.head('And what came before.'); c.cap('What her bacteria survived, and what colleagues on this ward started in recent weeks.');
      const ai = ROWS.findIndex(d => d.code === DOC.plan);
      if (ai >= 0 && SURVIVED) {
        const [x, y, a] = L.sub(ai);
        c.T(c.art2.append('text').attr('x', x).attr('y', y).attr('text-anchor', a).attr('class', 't-small t-acc').text(`Her ${SURVIVED.org} survived it · ${monthName(SURVIVED.date)}`).style('opacity', 0), 700, 200).style('opacity', 1);
      }
      const age = SHARED.age_band ? `${SHARED.sex === 'F' ? 'woman' : 'man'} ${SHARED.age_band}` : '';
      c.note = c.html('note', `<i></i><span><b>A colleague on this ward</b> · started ${esc(ROWS.find(d => d.code === SHARED.drug)?.name || '')} · ${esc([age, SHARED.sample].filter(Boolean).join(', '))} · ${esc(monthName(SHARED.month || '2026-11'))}<small>de-identified</small></span>`,
        land ? {left: (L.x0 - 6) + 'px', top: (last + 64) + 'px', width: '960px', whiteSpace: 'nowrap'} : {left: '104px', top: (last + 90) + 'px', width: '700px'});
      c.later(() => c.on(c.note), 600);
    }
    if (k === 3) {
      c.head('One look, a few seconds.'); c.cap('Say the plan; see the evidence for it and against it. No ranking, no advice. Pick any drug.');
      setPlan(c, DOC.alt);
    }
  }
};
function setPlan(c, code) {
  c.art2.selectAll('g.row').classed('alt', d => d.code !== code).classed('plan', d => d.code === code)
    .select('.t-label').attr('class', d => 't-label' + (d.code === code ? ' t-acc' : ''));
  const pi = ROWS.findIndex(d => d.code === code);
  c.T(c.dots().filter(i => i < ROWS.length * 20), 500).style('opacity', i => Math.floor(i / 20) === pi ? 1 : .35);
}

// ---------------------------------------------------------------- 5 · the hygiene team: what changed, and is it real?
const POS = {'PHC-N': [-.95, -.55], 'PHC-S': [-.95, .55], ED: [-.5, 0], ICU: [-.08, -.52], SURG: [.4, -.52], GER: [.2, 0], 'MED-A': [-.08, .52], 'MED-B': [.4, .52], URO: [.86, 0]};
function wardXY(code, W, H, land) {
  const [nx, ny] = POS[code];
  return land ? [W / 2 + 40 + nx * 470, H * .5 + ny * 210] : [W / 2 + ny * 300, H * .46 + nx * 420];
}
function drawWards(c) {
  const W = c.W(), H = c.H(), land = c.land();
  const rs = d3.scaleSqrt().domain([0, d3.max(Object.values(VOLUME))]).range([0, 60]);
  c.wards = D.meta.wards.map(w => ({code: w.code, xy: wardXY(w.code, W, H, land), r: Math.max(26, rs(VOLUME[w.code] || 0))}));
  c.link = c.art.append('path').attr('class', 's-acc').attr('stroke-width', 3).attr('stroke-dasharray', '2 8').attr('stroke-linecap', 'round').style('opacity', 0);
  const g = c.art.selectAll('g.ward').data(c.wards).join('g').attr('class', 'ward').attr('transform', d => `translate(${d.xy})`).style('opacity', 0);
  g.append('circle').attr('class', 'halo').attr('r', d => d.r + 30).attr('filter', 'url(#glow)');
  g.append('circle').attr('class', 'body').attr('r', d => d.r);
  g.append('text').attr('class', 'count');
  g.append('text').attr('class', 'name').attr('y', d => d.r + 48).text(d => NAME[d.code] || d.code);
  c.T(g, 700, 0).style('opacity', 1);
  c.dayText = c.art2.append('text').attr('class', 't-day').attr('x', land ? W - 110 : W - 100).attr('y', land ? 214 : H - 350).attr('text-anchor', 'end');
  const s = c.strip = {x0: land ? 380 : 100, x1: land ? 1220 : W - 100, y: land ? H - 196 : H - 296};
  const xs = c.dayX = d3.scalePoint().domain(DAYS).range([s.x0, s.x1]);
  const st = c.art2.append('g').attr('class', 'strip').attr('data-live', '');
  st.selectAll('line.tick').data(DAYS).join('line').attr('class', 'tick').attr('x1', d => xs(d)).attr('x2', d => xs(d)).attr('y1', s.y - 6).attr('y2', s.y + 6);
  c.nowTick = st.append('line').attr('class', 'now').attr('y1', s.y - 16).attr('y2', s.y + 16);
  st.append('text').attr('class', 't-tiny').attr('x', s.x0).attr('y', s.y + 42).text(dayName(DAYS[0]));
  st.append('text').attr('class', 't-tiny').attr('x', s.x1).attr('y', s.y + 42).attr('text-anchor', 'end').text(dayName(DAYS[DAYS.length - 1]));
  const scrub = e => {
    c.rolling = false; c.hold();
    const [mx] = d3.pointer(e, st.node()), i = Math.max(0, Math.min(DAYS.length - 1, Math.round((mx - s.x0) / (s.x1 - s.x0) * (DAYS.length - 1))));
    setDay(c, DAYS[i]);
  };
  st.append('rect').attr('class', 'hit').attr('x', s.x0 - 20).attr('y', s.y - 34).attr('width', s.x1 - s.x0 + 40).attr('height', 68)
    .on('pointerdown', e => { e.stopPropagation(); e.target.setPointerCapture(e.pointerId); scrub(e); })
    .on('pointermove', e => { if (e.buttons || e.pointerType === 'mouse') scrub(e); }).on('click', e => e.stopPropagation());
}
function clearWards(c) {
  c.rolling = false;
  c.T(c.art.selectAll('g.ward, path'), 400).style('opacity', 0).remove();
  c.T(c.art2.selectAll('*'), 400).style('opacity', 0).remove();
  c.place([], {dur: 500});
}
const B5 = {
  id: 'hygiene', name: 'The hygiene team', steps: [8200, 8000, 7400, 8200],
  enter(c) { drawWards(c); },
  step(k, c) {
    const W = c.W(), H = c.H(), land = c.land();
    if (k === 0) {
      c.head('The hygiene team: what changed since yesterday?'); c.cap('Each new resistant case lands on its ward the day the lab confirms it.');
      roll(c, DAYS[0], '2026-10-18', 250, () => c.cap('18 Oct · ICU: three cases. Within its usual range, so nothing is coloured yet.'));
    }
    if (k === 1) {
      c.head('Each ward against its own normal.'); c.cap('');
      roll(c, '2026-10-19', D.morning, 380, () => {
        const icu = D.days[D.morning].all_wards.find(w => w.code === 'ICU');
        c.head(`ICU: ${icu.recent} new cases in four weeks, usually about ${Math.round(icu.expected)}.`);
        c.cap('One MRSA pattern, also seen in the ED. A click opens the cases, the weeks and the wards behind it.');
      });
    }
    if (k === 2) {
      clearWards(c);
      c.head('Arrived together, not sampled together.'); c.cap('A feed outage, then late results all at once. Shown as a delivery problem, never as resistance.');
      lateBatch(c, W, H, land);
    }
    if (k === 3) {
      c.T(c.art.selectAll('.chart'), 400).style('opacity', 0).remove();
      c.head('And slow drifts, each year too small to notice.'); c.cap('');
      slowTrend(c, W, H, land);
    }
  }
};
function roll(c, a, b, ms, done) {
  const ds = DAYS.filter(d => d >= a && d <= b);
  let i = 0; c.rolling = true;
  const tick = () => { if (!c.rolling) return; setDay(c, ds[i]); if (++i < ds.length) c.later(tick, ms); else done && done(); };
  tick();
}
function setDay(c, day) {
  const at = Object.fromEntries(c.wards.map(w => [w.code, w]));
  const today = D.days[day], aw = Object.fromEntries(today.all_wards.map(w => [w.code, w]));
  const hotWard = code => aw[code] && aw[code].recent >= 3 && aw[code].z > 2;
  const cl = today.clusters.find(x => x.wards.includes('ICU') && x.status !== 'over');
  const hotKey = cl && hotWard('ICU') ? cl.key : null;
  const seen = {}, targets = [];
  CASES.forEach((cs, i) => {
    if (cs.arrived > day || i >= N) return;
    const w = at[cs.ward]; if (!w) return;
    const j = seen[cs.ward] = (seen[cs.ward] ?? -1) + 1, ring = Math.floor(j / 16), a = -Math.PI / 2 + (j % 16) * Math.PI / 8 + ring * .2;
    const R = w.r + 15 + ring * 14, x = w.xy[0] + Math.cos(a) * R, y = w.xy[1] + Math.sin(a) * R;
    const fresh = cs.arrived === day && !c.instant;
    targets[i] = {x, y, r: 6, k: hotKey && cs.key === hotKey ? 'k-acc' : 'k-ink', o: 1, from: fresh ? [x, y - 80] : null};
  });
  c.place(targets, {dur: 520, ease: d3.easeCubicOut});
  c.art.selectAll('g.ward').classed('hot', d => hotWard(d.code)).select('.count').text(d => aw[d.code] && aw[d.code].recent ? aw[d.code].recent : '');
  const icu = at.ICU, ed = at.ED, linked = cl && cl.wards.includes('ED') && hotKey;
  if (icu && ed) {
    const mx = (icu.xy[0] + ed.xy[0]) / 2 - (c.land() ? 40 : -60), my = (icu.xy[1] + ed.xy[1]) / 2 + (c.land() ? 50 : 40);
    c.link.attr('d', `M${ed.xy[0]},${ed.xy[1]}Q${mx},${my} ${icu.xy[0]},${icu.xy[1]}`);
    c.T(c.link, 600).style('opacity', linked ? .9 : 0);
  }
  c.dayText.text(dayName(day));
  c.nowTick.attr('x1', c.dayX(day)).attr('x2', c.dayX(day));
}
function lateBatch(c, W, H, land) {
  const DAY = '2026-10-08', h = D.days[DAY].health.find(x => x.ward === 'PHC-S'), late = D.days[DAY].late['PHC-S'] || 0;
  const box = land ? {x0: 430, x1: 1170, yb: 650, yt: 300} : {x0: 110, x1: W - 110, yb: 1020, yt: 520};
  const x = d3.scaleBand().domain(h.days.map(d => d.day)).range([box.x0, box.x1]).padding(.38), y = d3.scaleLinear().domain([0, 36]).range([box.yb, box.yt]);
  const g = c.art.append('g').attr('class', 'chart');
  g.append('text').attr('class', 't-tiny').attr('x', box.x0).attr('y', box.yt - 26).text(`${NAME['PHC-S']} · samples per day`);
  g.selectAll('rect.bar').data(h.days).join('rect').attr('class', 'f-ink3').attr('x', d => x(d.day)).attr('width', x.bandwidth()).attr('rx', 4)
    .attr('y', box.yb).attr('height', 0).call(s => c.T(s, 800, (d, i) => 300 + i * 45).attr('y', d => y(d.n)).attr('height', d => box.yb - y(d.n)));
  const usual = d3.line().x(d => x(d.day) + x.bandwidth() / 2).y(d => y(d.usual)).curve(d3.curveMonotoneX);
  const u = g.append('path').attr('d', usual(h.days)).attr('class', 's-ink2').attr('stroke-width', 2).attr('stroke-dasharray', '5 7').style('opacity', 0);
  c.T(u, 700, 1000).style('opacity', .9);
  const lastD = h.days[h.days.length - 1];
  g.append('text').attr('class', 't-small').attr('x', box.x1 + 12).attr('y', y(lastD.usual) + 6).text('usual').style('opacity', 0).call(s => c.T(s, 600, 1200).style('opacity', 1));
  const held = h.days.filter(d => d.day >= '2026-10-03' && d.day < DAY);
  if (held.length) {
    const bx0 = x(held[0].day), bx1 = x(held[held.length - 1].day) + x.bandwidth(), by = y(19);
    c.T(g.append('path').attr('d', `M${bx0},${by + 10}V${by}H${bx1}V${by + 10}`).attr('class', 's-ink2').attr('stroke-width', 2).style('opacity', 0), 600, 1600).style('opacity', 1);
    g.append('text').attr('class', 't-small').attr('x', (bx0 + bx1) / 2).attr('y', by - 14).attr('text-anchor', 'middle').text('results held back').style('opacity', 0).call(s => c.T(s, 600, 1700).style('opacity', 1));
  }
  if (late) {
    const lx = x(DAY), top = y(lastD.n + late);
    const lb = g.append('rect').attr('x', lx).attr('width', x.bandwidth()).attr('rx', 4).attr('fill', 'url(#hatch)').attr('class', 's-ink2').attr('stroke-width', 2)
      .attr('y', top - 60).attr('height', y(lastD.n) - top).style('opacity', 0);
    c.T(lb, 900, 2400, d3.easeBounceOut).attr('y', top).style('opacity', 1);
    g.append('text').attr('class', 't-label').attr('x', lx + x.bandwidth() / 2 + (land ? 0 : -10)).attr('y', top - 20).attr('text-anchor', land ? 'middle' : 'end')
      .text(`+${late} late, at once`).style('opacity', 0).call(s => c.T(s, 600, 2900).style('opacity', 1));
  }
}
// the finding: E. coli in urine, trimethoprim, first isolate per patient per year (supplied dataset, Oct–Sep years)
const TMP_YEARS = [['2023–24', 415, 2528], ['2024–25', 484, 2593], ['2025–26', 506, 2538]];
function slowTrend(c, W, H, land) {
  const g = c.art.append('g').attr('class', 'chart');
  const box = land ? {x0: 470, x1: 1130, yb: 640, yt: 300} : {x0: 150, x1: W - 150, yb: 1000, yt: 480};
  const x = d3.scalePoint().domain(TMP_YEARS.map(d => d[0])).range([box.x0, box.x1]).padding(.3), y = d3.scaleLinear().domain([.12, .22]).range([box.yb, box.yt]);
  g.append('text').attr('class', 't-tiny').attr('x', box.x0).attr('y', box.yt - 40).text('E. coli in urine · resistant to trimethoprim');
  g.append('line').attr('x1', box.x0).attr('x2', box.x1).attr('y1', box.yb).attr('y2', box.yb).attr('class', 's-line').attr('stroke-width', 1.5);
  const pts = TMP_YEARS.map(([yr, r, n]) => ({yr, r, n, v: r / n, x: x(yr), y: y(r / n)}));
  const line = g.append('path').attr('d', d3.line().x(p => p.x).y(p => p.y)(pts)).attr('class', 's-acc').attr('stroke-width', 3);
  const L = line.node().getTotalLength();
  if (!(c.instant || REDUCED)) line.attr('stroke-dasharray', L).attr('stroke-dashoffset', L).transition().delay(500).duration(1400).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
  pts.forEach((p, i) => {
    const d = c.T(g.append('circle').attr('cx', p.x).attr('cy', p.y).attr('r', 0).attr('class', 'f-acc'), 600, 500 + i * 450, d3.easeBackOut).attr('r', 11);
    g.append('text').attr('class', 't-num').attr('x', p.x).attr('y', p.y - 34).attr('text-anchor', 'middle').text(`${(p.v * 100).toFixed(1)}%`).style('opacity', 0).call(s => c.T(s, 600, 700 + i * 450).style('opacity', 1));
    g.append('text').attr('class', 't-small').attr('x', p.x).attr('y', box.yb + 36).attr('text-anchor', 'middle').text(p.yr);
    g.append('text').attr('class', 't-tiny').attr('x', p.x).attr('y', box.yb + 64).attr('text-anchor', 'middle').text(`${fmt(p.r)} of ${fmt(p.n)}`);
  });
  const tmp = ROWS.find(d => d.code === 'TMP');
  c.later(() => c.cap(`First isolate per patient, each year. On Urology, the doctor’s trimethoprim row now sits at ${Math.round(tmp.year.share * 100)}%, just above the 80% line.`), 2000);
}

// ---------------------------------------------------------------- 6 · ask: a question becomes a view, built only from charts the app already has
// The catalogue is the app's own (app/ask.py CHARTS); the answers are its saved ones (app/answers/ask_cache.json → ask.json).
// It is live: type, or tap a question, and the answer rebuilds. Nothing here calls a model.
const CATALOGUE = [['losing', 'Losing ground'], ['volume', 'Count or share'], ['unusual', 'Against its own normal'], ['quiet', 'Quiet or missing'], ['late', 'Arrival delay'],
  ['linked', 'Linked cases'], ['rules', 'Rules that change'], ['who', 'Who it affects'], ['unknown', 'Before the organism'], ['guide', 'Last month or last year'],
  ['fails', 'If one fails'], ['trend', 'Trend'], ['drugs', 'Drug list'], ['ward_weeks', 'Ward by week']];
const CHART_NAME = Object.fromEntries(CATALOGUE);
const ASK = await fetch('ask.json').then(r => r.json()).catch(() => []);
const ASK_FIRST = Math.max(0, ASK.findIndex(a => /quiet week/i.test(a.q)));
// Health centre South, cultures per ISO week, 2025 w44 → 2026 w03 (supplied dataset); week 50 (8–14 Dec) has none
const QUIET = [['44', 53], ['45', 64], ['46', 47], ['47', 41], ['48', 60], ['49', 51], ['50', 0], ['51', 48], ['52', 66], ['01', 48], ['02', 41], ['03', 43]];
// a small drawing for each chart an answer can pick, from the figures that answer states
function miniViz(el, id) {
  const w = 560, h = 250, g = d3.select(el).append('svg').attr('viewBox', `0 0 ${w} ${h}`).append('g');
  const bars = (data, max, fmtv, accIdx = -1) => {
    const x = d3.scaleBand().domain(data.map(d => d[0])).range([30, w - 30]).padding(.35), y = d3.scaleLinear().domain([0, max]).range([h - 50, 34]);
    g.selectAll('rect.b').data(data).join('rect').attr('class', (d, i) => 'b ' + (i === accIdx ? 'f-acc' : 'f-ink3')).attr('x', d => x(d[0])).attr('width', x.bandwidth()).attr('rx', 5)
      .attr('y', h - 50).attr('height', 0).transition().duration(REDUCED ? 0 : 700).delay((d, i) => i * 50).attr('y', d => y(d[1])).attr('height', d => h - 50 - y(d[1]));
    g.selectAll('text.l').data(data).join('text').attr('class', 'l t-tiny').attr('x', d => x(d[0]) + x.bandwidth() / 2).attr('y', h - 20).attr('text-anchor', 'middle').text(d => d[0]);
    if (fmtv) g.selectAll('text.v').data(data).join('text').attr('class', 'v t-small').attr('x', d => x(d[0]) + x.bandwidth() / 2).attr('y', d => y(d[1]) - 10).attr('text-anchor', 'middle').text(d => fmtv(d[1]));
    return {x, y};
  };
  const note = t => { el.dataset.note = t; };
  if (id === 'quiet') {
    const {x, y} = bars(QUIET.map(([k, v]) => ['w' + k, v]), 70, null);
    g.append('rect').attr('x', x('w50') - 3).attr('width', x.bandwidth() + 6).attr('y', y(59)).attr('height', h - 50 - y(59)).attr('rx', 5).attr('fill', 'none').attr('class', 's-acc').attr('stroke-width', 2).attr('stroke-dasharray', '4 5');
    g.append('text').attr('class', 't-small t-acc').attr('x', x('w50') + x.bandwidth() / 2).attr('y', y(59) - 10).attr('text-anchor', 'middle').text('missing, not quiet');
    note('Health centre S · cultures per week');
  } else if (id === 'losing' || id === 'trend') {
    const x = d3.scalePoint().domain(TMP_YEARS.map(d => d[0])).range([80, w - 80]), y = d3.scaleLinear().domain([.12, .22]).range([h - 50, 50]);
    const pts = TMP_YEARS.map(([k, r, n]) => [x(k), y(r / n), r / n, k]);
    g.append('path').attr('d', d3.line()(pts.map(p => [p[0], p[1]]))).attr('class', 's-acc').attr('stroke-width', 3);
    pts.forEach(p => { g.append('circle').attr('cx', p[0]).attr('cy', p[1]).attr('r', 8).attr('class', 'f-acc'); g.append('text').attr('class', 't-small').attr('x', p[0]).attr('y', p[1] - 18).attr('text-anchor', 'middle').text((p[2] * 100).toFixed(1) + '%'); g.append('text').attr('class', 't-tiny').attr('x', p[0]).attr('y', h - 20).attr('text-anchor', 'middle').text(p[3]); });
    note('E. coli in urine · resistant to trimethoprim');
  } else if (id === 'volume') {
    bars([['tested, before', 2592], ['tested, now', 2544], ['resistant, before', 483], ['resistant, now', 509]], 2900, fmt, 3);
    note('E. coli in urine · trimethoprim');
  } else if (id === 'unusual') {
    const x = d3.scaleLinear().domain([0, 6]).range([60, w - 60]), yy = h / 2;
    g.append('line').attr('x1', x(0)).attr('x2', x(6)).attr('y1', yy).attr('y2', yy).attr('class', 's-line').attr('stroke-width', 2);
    g.append('rect').attr('x', x(0)).attr('width', x(3) - x(0)).attr('y', yy - 18).attr('height', 36).attr('rx', 18).attr('class', 'f-sheet');
    g.append('text').attr('class', 't-tiny').attr('x', (x(0) + x(3)) / 2).attr('y', yy + 50).attr('text-anchor', 'middle').text('usual range 0–3');
    g.append('circle').attr('cx', x(4)).attr('cy', yy).attr('r', 12).attr('class', 'f-acc');
    g.append('text').attr('class', 't-small t-acc').attr('x', x(4)).attr('y', yy - 28).attr('text-anchor', 'middle').text('Urology · 4 in 4 weeks');
  } else if (id === 'rules') {
    bars([['before · CIP-R', 31.3], ['before · CIP-S', 16.3], ['now · CIP-R', 20.4], ['now · CIP-S', 20.0]], 40, v => v + '%', 0);
    note('also resistant to trimethoprim');
  } else if (id === 'guide') {
    d3.range(10).forEach(i => g.append('circle').attr('cx', 72 + i * 46).attr('cy', h / 2 - 10).attr('r', 15).attr('class', i < 7 ? 'k-ink' : 'k-hollow'));
    g.append('text').attr('class', 't-small').attr('x', 57).attr('y', h / 2 + 50).text('last year the better guide for 7 of 10 drugs');
  } else if (id === 'who') {
    bars([['women', 6], ['men', 13]], 16, v => v + '%', 1);
    note('E. coli in urine · resistant to ciprofloxacin');
  } else {
    g.append('text').attr('class', 't-small').attr('x', w / 2).attr('y', h / 2).attr('text-anchor', 'middle').text(CHART_NAME[id] || id);
  }
}
const mdHTML = s => esc(s || '').replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
function bento(c, i) {
  const a = ASK[i]; if (!a || !c.bento) return;
  const texts = a.blocks.filter(b => b.t === 'text'), viz = a.blocks.filter(b => b.t === 'viz'), fu = (a.blocks.find(b => b.t === 'followup') || {}).q || [];
  const asof = a.asof ? `${dayName(a.asof)} ${a.asof.slice(0, 4)}` : '';
  c.bento.innerHTML = `<div class="tile t-main"><p>${mdHTML(texts[0]?.md)}</p></div>
    <div class="tile t-viz"><span class="pick">${esc(CHART_NAME[viz[0]?.c] || '')}</span><div class="v"></div></div>
    <div class="tile t-more"><p>${mdHTML(texts[1]?.md)}</p></div>
    <div class="tile t-next"><span class="pick">Ask next</span>${fu.map(q => { const j = ASK.findIndex(x => x.q.toLowerCase() === q.toLowerCase()); return `<button data-live ${j >= 0 ? `data-ask="${j}"` : 'disabled'}>${esc(q)}</button>`; }).join('')}
      <small>Saved answer · data to ${esc(asof)}</small></div>`;
  if (viz[0]) { const v = c.bento.querySelector('.t-viz .v'); miniViz(v, viz[0].c); if (v.dataset.note) c.bento.querySelector('.t-viz .pick').insertAdjacentHTML('beforeend', `<em> · ${esc(v.dataset.note)}</em>`); }
  c.bento.classList.remove('in'); void c.bento.offsetWidth; c.bento.classList.add('in');
  c.chips?.querySelectorAll('[data-ask]').forEach(b => b.classList.toggle('on', +b.dataset.ask === i));
}
const words2 = s => s.toLowerCase().match(/[a-zäöå]{3,}/g) || [];
function bestAsk(q) {   // the saved answer sharing the most words with what was typed
  const w = new Set(words2(q)); let best = -1, score = 0;
  ASK.forEach((a, i) => { const sc = words2(a.q).filter(x => w.has(x)).length; if (sc > score) { score = sc; best = i; } });
  return best;
}
const B6 = {
  id: 'ask', name: 'Ask', steps: [7600, 11000],
  enter(c) { c.place([], {dur: 500}); },
  step(k, c) {
    const land = c.land();
    if (k === 0) {
      c.head('Or the team simply asks.'); c.cap('');
      const bar = c.html('askbar', `<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5"/><path d="m16 16 4 4"/></svg><input data-live type="text" aria-label="Ask a question" placeholder="Ask about the data">`,
        land ? {left: '330px', top: '165px', width: '940px'} : {left: '90px', top: '250px', width: '720px'});
      c.on(bar);
      const inp = c.askInput = bar.querySelector('input'), q = ASK[ASK_FIRST]?.q || '';
      if (c.instant || REDUCED) inp.value = q;
      else [...q].forEach((ch, i) => c.later(() => { inp.value += ch; }, 400 + i * 40));
      inp.addEventListener('input', () => { c.hold(); const j = bestAsk(inp.value); c.chips?.querySelectorAll('[data-ask]').forEach(b => b.classList.toggle('near', +b.dataset.ask === j)); });
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') { const j = bestAsk(inp.value); if (j >= 0 && c.bento) bento(c, j); } });
      inp.addEventListener('focus', () => c.hold());
      const cat = c.cat = c.html('cat', CATALOGUE.map(([id, label], i) => `<span data-c="${id}" style="--i:${i}">${label}</span>`).join(''),
        land ? {left: '250px', top: '300px', width: '1100px'} : {left: '90px', top: '400px', width: '720px'});
      c.on(cat);
      c.later(() => c.cap('A language model reads the question and picks from charts the app already draws. It cannot invent new ones.'), 2400);
      c.later(() => { cat.classList.add('picked'); const v = (ASK[ASK_FIRST]?.blocks || []).filter(b => b.t === 'viz'); cat.querySelectorAll('[data-c]').forEach(s => s.classList.toggle('on', v.some(x => x.c === s.dataset.c))); }, 4600);
    }
    if (k === 1) {
      c.head('Built from parts we trust.');
      if (c.cat) c.cat.classList.add('away');
      c.chips = c.html('askchips', ASK.map((a, i) => `<button data-live data-ask="${i}">${esc(a.q)}</button>`).join(''),
        land ? {left: '170px', top: '262px', width: '1260px'} : {left: '90px', top: '340px', width: '720px'});
      c.bento = c.html('bento', '', land ? {left: '170px', top: '412px', width: '1260px', height: '348px'} : {left: '90px', top: '640px', width: '720px', height: '690px'});
      const pick = e => { const b = e.target.closest('[data-ask]'); if (!b) return; e.stopPropagation(); c.hold(); bento(c, +b.dataset.ask); if (c.askInput) c.askInput.value = ASK[+b.dataset.ask].q; };
      c.chips.addEventListener('click', pick); c.bento.addEventListener('click', pick);
      c.on(c.chips); c.on(c.bento); bento(c, ASK_FIRST);
      c.cap('Tap a question or type one. Approved views only, so even a small model stays within the evidence.');
    }
  }
};

// ---------------------------------------------------------------- 7 · the knowledge graph: what the wards say, adding up
// Counts from app/knowledge.py dashboard(): illustrative seeded notes plus what was committed in the demo.
const KG = await fetch('knowledge-summary.json').then(r => { if (!r.ok) throw Error('No summary'); return r.json(); })
  .then(s => ({notes:s.contributions, concepts:s.nodes, links:s.edges, languages:s.languages}))
  .catch(() => ({notes:109, concepts:63, links:125, languages:3}));
const SAID = [['en', 'Urology', 'If ESBL is reported, I would switch to meropenem.'], ['fi', 'Medicine A', 'Jos tulee ESBL, vaihdan meropeneemiin.'], ['sv', 'Geriatrics', 'Om det blir ESBL byter jag till meropenem.']];
const B7 = {
  id: 'graph', name: 'Knowledge graph', steps: [7400, 7800],
  enter(c) { c.place([], {dur: 500}); },
  step(k, c) {
    const W = c.W(), H = c.H(), land = c.land();
    const hub = land ? [W * .68, H * .5] : [W * .5, H * .72];
    if (k === 0) {
      c.head('Said in three languages, on three wards.'); c.cap('Three doctors, months apart, recorded the same if-then rule.');
      SAID.forEach(([lang, ward, text], i) => {
        const el = c.html('said', `<span class="lang">${lang}</span><p>${esc(text)}</p><small>${esc(ward)}</small>`,
          land ? {left: '170px', top: (270 + i * 140) + 'px', width: '580px'} : {left: '90px', top: (240 + i * 160) + 'px', width: '720px'});
        el.style.transitionDelay = (c.instant ? 0 : i * 450) + 'ms'; c.on(el);
      });
      const g = c.art2.append('g').attr('class', 'kgc').style('opacity', 0);
      g.append('circle').attr('cx', hub[0]).attr('cy', hub[1]).attr('r', 64).attr('class', 'f-acc').style('opacity', .12);
      g.append('circle').attr('cx', hub[0]).attr('cy', hub[1]).attr('r', 18).attr('class', 'f-acc');
      g.append('text').attr('class', 't-label').attr('x', hub[0]).attr('y', hub[1] + 104).attr('text-anchor', 'middle').text('If ESBL → switch to meropenem');
      g.append('text').attr('class', 't-small').attr('x', hub[0]).attr('y', hub[1] + 136).attr('text-anchor', 'middle').text('one concept · 3 wards · 3 languages');
      c.T(g, 900, 1800).style('opacity', 1);
      if (land) SAID.forEach((s, i) => {
        const y0 = 312 + i * 140, x0 = 770, p = c.art.append('path').attr('d', `M${x0},${y0}C${(x0 + hub[0]) / 2},${y0} ${(x0 + hub[0]) / 2},${hub[1]} ${hub[0] - 28},${hub[1]}`)
          .attr('class', 's-acc').attr('stroke-width', 2).style('opacity', .55);
        const L = p.node().getTotalLength();
        if (!(c.instant || REDUCED)) p.attr('stroke-dasharray', L).attr('stroke-dashoffset', L).transition().delay(900 + i * 300).duration(1100).ease(d3.easeCubicInOut).attr('stroke-dashoffset', 0);
      });
    }
    if (k === 1) {
      c.head('Over time, what the wards know adds up.');
      c.ui.querySelectorAll('.said').forEach(el => el.classList.remove('on'));
      c.T(c.art.selectAll('path'), 400).style('opacity', 0).remove();
      c.T(c.art2.selectAll('.kgc'), 400).style('opacity', 0).remove();
      // a quiet constellation: concepts as dots, links as faint curves; the ESBL rule is the warm one
      const r = d3.randomLcg(5), cx = W / 2, cy = land ? H * .5 : H * .48, R = land ? 300 : 330;
      const nodes = d3.range(KG.concepts).map(i => { const a = i * 2.39996, d = Math.sqrt((i + .5) / KG.concepts) * R; return {x: cx + Math.cos(a) * d * (land ? 1.5 : 1), y: cy + Math.sin(a) * d * (land ? .8 : 1.15), r: 4 + r() * 6}; });
      const links = d3.range(KG.links).map(() => { const a = Math.floor(r() * KG.concepts); let b = Math.floor(r() * KG.concepts); if (b === a) b = (a + 1) % KG.concepts; return [nodes[a], nodes[b]]; })
        .filter(([a, b]) => Math.hypot(a.x - b.x, a.y - b.y) < R * .9);
      c.art.append('g').selectAll('path').data(links).join('path').attr('d', ([a, b]) => `M${a.x},${a.y}Q${(a.x + b.x) / 2 + (b.y - a.y) * .15},${(a.y + b.y) / 2 - (b.x - a.x) * .15} ${b.x},${b.y}`)
        .attr('class', 's-ink3').attr('stroke-width', 1).style('opacity', 0).call(s => c.T(s, 900, (d, i) => 600 + i * 6).style('opacity', .35));
      c.place(nodes.map((n, i) => ({x: n.x, y: n.y, r: i === 0 ? 14 : n.r, k: i === 0 ? 'k-acc' : 'k-mute', o: 1, from: [cx, cy]})), {dur: 1300, stagger: i => i * 14});
      c.cap(`${KG.notes} illustrative notes, ${KG.concepts} concepts, ${KG.languages} languages, all de-identified. A repeat is a mention, never proof. Next: bring a rule back when its result arrives.`);
    }
  }
};

// ---------------------------------------------------------------- 8 · close
const B8 = {
  id: 'close', name: 'Mindline', steps: [9000],
  step(k, c) {
    const W = c.W(), H = c.H(), land = c.land(), L = logoAt(W / 2, H * .33);
    c.hero('Mindline');
    c.cap('Your ward, the last four weeks, against its year.\nUpdated with every result, read in seconds.\nWhat the lab knows, and what the ward knows.');
    c.place(d3.range(N).map(i => i < 3 ? {x: L[i][0], y: L[i][1], r: LOGO_R, k: L[i][2], o: 1} : {x: L[i % 3][0], y: L[i % 3][1], r: 0, o: 0}), {dur: 1400, stagger: i => i < 3 ? i * 120 : 0});
    const links = c.html('links', `<a class="go" href="../" data-live>Open the app <span aria-hidden="true">→</span></a><button type="button" class="again" data-live>Watch again</button>`, {top: (H * (land ? .64 : .6)) + 'px'});
    links.querySelector('.again').addEventListener('click', e => { e.stopPropagation(); setPlaying(true); show(0, 0); });
    c.on(links);
  }
};

const BEATS = [B1, B2, B3, B4, B5, B6, B7, B8];
if (CAPTURE) {
  const speed = 100000 / d3.sum(BEATS, b => d3.sum(b.steps));
  BEATS.forEach(b => { b.steps = b.steps.map(ms => ms * speed); });
}

// ---------------------------------------------------------------- the player
let bi = 0, si = 0, started = false, playing = !REDUCED && !CAPTURE, stepAt = performance.now(), pausedEl = 0, holdUntil = 0, autoT = 0, lastNext = 0;
function show(b, s, {instant = false} = {}) {
  epoch++; timers.forEach(clearTimeout); timers.clear(); clearTimeout(autoT); tip(null);
  const newBeat = b !== bi || !started;
  bi = b; si = s; started = true;
  freshLayers(newBeat && !instant);
  ctx.rolling = false; ctx.note = null;
  const beat = BEATS[b], ui = ctx.ui;
  // earlier builds of this beat are drawn at once; the build being entered animates (unless jumping back)
  const settle = () => { void ui.offsetWidth; getComputedStyle(ui).opacity; ui.classList.remove('instant'); ctx.instant = false; };
  ctx.instant = true; ui.classList.add('instant');
  if (s === 0 && !instant) settle();          // a fresh beat sets its stage up in motion
  beat.enter && beat.enter(ctx);
  for (let k = 0; k < s; k++) beat.step(k, ctx);
  if (!instant && ctx.instant) settle();
  beat.step(s, ctx);
  if (instant) { void ui.offsetWidth; requestAnimationFrame(() => ui.classList.remove('instant')); }
  ctx.instant = false;
  stepAt = performance.now(); pausedEl = 0;
  schedule();
  history.replaceState(null, '', location.pathname + location.search + '#' + beat.id + (s ? '/' + s : ''));
}
function next() {
  const b = BEATS[bi];
  if (si < b.steps.length - 1) show(bi, si + 1);
  else if (bi < BEATS.length - 1) show(bi + 1, 0);
  else setPlaying(false);
}
function prev() {
  if (si > 0) show(bi, si - 1, {instant: true});
  else if (bi > 0) show(bi - 1, BEATS[bi - 1].steps.length - 1, {instant: true});
}
function schedule() {
  clearTimeout(autoT);
  if (!playing) return;
  const left = Math.max(300, BEATS[bi].steps[si] - (performance.now() - stepAt));
  autoT = setTimeout(() => {
    const now = performance.now();
    if (now < holdUntil) { stepAt += holdUntil - now; return schedule(); }   // someone is exploring: wait
    if (bi === BEATS.length - 1 && si === BEATS[bi].steps.length - 1) {
      if (CAPTURE) document.documentElement.dataset.captureState = 'complete';
      return setPlaying(false);
    }
    next();
  }, left);
}
function setPlaying(p) {
  if (p && !playing) stepAt = performance.now() - pausedEl;
  if (!p && playing) pausedEl = performance.now() - stepAt;
  playing = p;
  const btn = $('play'); btn.classList.toggle('paused', !p);
  btn.setAttribute('aria-label', p ? 'Pause (P)' : 'Play (P)'); btn.title = p ? 'Pause (P)' : 'Play (P)';
  schedule();
}

// seek bar: one segment per beat, filling as it plays
const bar = $('bar');
const segs = BEATS.map((b, i) => {
  const el = document.createElement('div'); el.className = 'seg'; el.style.flexGrow = d3.sum(b.steps);
  el.innerHTML = `<div class="fill"></div><span>${esc(b.name)}</span>`;
  el.addEventListener('click', e => { e.stopPropagation(); show(i, 0); });
  bar.append(el);
  return {el, fill: el.querySelector('.fill')};
});
(function paint() {
  const el = playing ? performance.now() - stepAt : pausedEl;
  segs.forEach((s, i) => {
    const b = BEATS[i], f = i < bi ? 1 : i > bi ? 0 : (d3.sum(b.steps.slice(0, si)) + Math.min(el, b.steps[si])) / d3.sum(b.steps);
    s.fill.style.width = (f * 100).toFixed(2) + '%'; s.el.classList.toggle('cur', i === bi);
  });
  requestAnimationFrame(paint);
})();

// input: a click on the stage moves on; anything alive (words, rows, the day strip, links) is for exploring
frame.addEventListener('click', e => {
  if (e.target.closest('[data-live], a, button')) return;
  const now = performance.now(); if (now - lastNext < 300) return; lastNext = now;
  next();
});
addEventListener('keydown', e => {
  if (e.metaKey || e.ctrlKey || e.altKey || e.target.closest('input, textarea')) return;   // typing a question is not navigating
  if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); next(); }
  else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); prev(); }
  else if (e.key === 'p' || e.key === 'k') setPlaying(!playing);
  else if (e.key === 'Home') show(0, 0);
});
$('play').addEventListener('click', e => { e.stopPropagation(); if (!playing && bi === BEATS.length - 1 && si === BEATS[bi].steps.length - 1) { setPlaying(true); show(0, 0); } else setPlaying(!playing); });
$('theme').addEventListener('click', e => {
  e.stopPropagation();
  const t = document.documentElement.dataset.theme === 'matte-dark' ? 'quiet-light' : 'matte-dark';
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('rl-theme', JSON.stringify(t)); } catch (_) {}
});
// tips on recognised words, and a pause while someone hovers anything alive
function tip(html, el) {
  if (!html) { tipEl.classList.remove('on'); return; }
  const r = el.getBoundingClientRect(); tipEl.innerHTML = html;
  tipEl.style.left = (r.left + r.width / 2) + 'px'; tipEl.style.top = r.top + 'px'; tipEl.classList.add('on');
}
frame.addEventListener('pointerover', e => { const t = e.target.closest('[data-tip]'); tip(t ? t.dataset.tip : null, t); });
frame.addEventListener('pointermove', e => { if (!CAPTURE && e.target.closest('[data-live]')) ctx.hold(); }, {passive: true});
addEventListener('resize', () => { if (fit()) show(bi, si, {instant: true}); });

// start where the link says (#doctor/2), or at the beginning; follow the link if it changes
function fromHash() {
  const [hid, hstep] = (location.hash.slice(1) || '').split('/'), b = Math.max(0, BEATS.findIndex(x => x.id === hid));
  return [b, Math.min(+hstep || 0, BEATS[b].steps.length - 1)];
}
addEventListener('hashchange', () => { const [b, s] = fromHash(); if (b !== bi || s !== si) show(b, s); });
setPlaying(playing);
show(...fromHash());
if (CAPTURE) {
  document.documentElement.dataset.captureState = 'ready';
  const start = document.createElement('button');
  start.className = 'capture-start'; start.textContent = 'Start recording';
  start.onclick = () => {
    start.remove(); document.documentElement.dataset.captureState = 'recording';
    setPlaying(true); show(0, 0);
  };
  document.body.append(start);
}
