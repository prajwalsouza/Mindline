// Feed simulator dashboard: choose a recipe, generate, watch the feed arrive, inspect and download the result.
const $ = id => document.getElementById(id);
const api = (p, opt) => fetch(p, { cache: "no-store", ...opt }).then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; });
const fmt = n => (+n).toLocaleString("en-GB");
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const parseT = d3.timeParse("%Y-%m-%dT%H:%M");

let META, RECIPE, RUN = null, SIZE = "day", RATE = 8, src = null, cursor = -1, BINS = [], drawQueued = false, tickerLog = [];
const KIND_GROUP = { "culture received": "received", "culture result": "result", "organism identified": "organism", "organism corrected": "corrected",
  "isolate final": "organism", "susceptibility": "S/R result", "susceptibility corrected": "corrected", "duplicate": "duplicate", "culture cancelled": "cancelled" };
const GROUPS = ["received", "result", "organism", "S/R result", "corrected", "duplicate", "cancelled"];
const groupColor = () => ({ received: css("--ink-3"), result: css("--ink-2"), organism: css("--cool"), "S/R result": css("--ink"),
  corrected: css("--accent"), duplicate: css("--amber"), cancelled: css("--violet") });
const originColor = () => ({ replayed: css("--ink-3"), new: css("--cool"), injected: css("--accent") });
const HOT = new Set(["G1", "G2", "G3", "G6", "G7", "B1", "B2", "B5", "C9", "D1", "D2", "E3", "F1", "D7"]);

// ---------- theme ----------
function setTheme(t) {
  const root = document.documentElement; root.classList.add("theming"); void root.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theming")));
  root.dataset.theme = t; try { localStorage.setItem("feedsim-theme", t); } catch {}
  document.querySelectorAll("#theme button").forEach(b => b.setAttribute("aria-pressed", b.dataset.theme === t));
  if (META && RECIPE) { drawTimeline(); renderKnobs(); renderEvents(); renderSources(); renderTray(); }
  if (RUN) { draw(); drawStatic(); }
}
$("theme").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setTheme(b.dataset.theme); });

// ---------- 1 · sources and how much each shaped the output ----------
const SRC_COLOR = () => ({ tyks: css("--ink"), mimic: css("--cool"), armd: css("--violet") });
function renderSources() {
  const sc = SRC_COLOR();
  const USE = { tyks: "Every case: replayed, or copied to make new ones", mimic: "How long each result takes to arrive", armd: "When patients come back" };
  $("srccards").innerHTML = META.sources.map(s => `<div class="card" style="--c:${sc[s.id]}"><h3><span class="dot"></span>${s.name}</h3><div class="use">${USE[s.id]}</div><div class="facts adv-only">${s.facts.map(f => `<span>${f}</span>`).join("")}</div></div>`).join("");
  drawRibbon();
}
function drawRibbon() {
  const el = $("ribbon"), w = W(el), sc = SRC_COLOR();
  const items = RUN ? RUN.contrib : [
    { source: "tyks", label: "Replayed records", n: 1 }, { source: "tyks", label: "Patterns for new cases", n: 1 }, { source: "tyks", label: "Templates for injected cases", n: 1 },
    { source: "mimic", label: "Delay and release hour", n: 1 }, { source: "armd", label: "Returning patients (gap)", n: 1 }, { source: "armd", label: "Expected-resistant rule", n: 1 }];
  const max = d3.max(items, d => d.n) || 1, wid = d => RUN ? Math.max(3, Math.sqrt(d.n / max) * 44) : 10;
  const gap = 14, h = d3.sum(items, wid) + gap * (items.length + 1) + 30;
  const lx = 150, rx = Math.min(w - 380, w * .42);
  el.innerHTML = ""; const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const totalCases = RUN ? d3.sum(items.filter(d => d.source === "tyks"), d => d.n) : 0;
  const srcIds = ["tyks", "mimic", "armd"], names = { tyks: "Tyks", mimic: "MIMIC-IV demo", armd: "Stanford ARMD" };
  let ry = gap, ly = gap;
  const srcY = {};
  srcIds.forEach(id => { const its = items.filter(d => d.source === id), hh = d3.sum(its, wid) + 6 * (its.length - 1); srcY[id] = { y: ly, h: hh, off: 0 }; ly += hh + gap * 2.2; });
  const shift = (h - 30 - ly) / 2; srcIds.forEach(id => srcY[id].y += Math.max(0, shift));
  items.forEach(d => {
    const ww = wid(d), s = srcY[d.source], y0 = s.y + s.off + ww / 2, y1 = ry + ww / 2; s.off += ww + 6;
    svg.append("path").attr("d", `M${lx},${y0} C${(lx + rx) / 2},${y0} ${(lx + rx) / 2},${y1} ${rx},${y1}`).attr("fill", "none").attr("stroke", sc[d.source]).attr("stroke-opacity", RUN ? .22 : .1).attr("stroke-width", ww);
    svg.append("rect").attr("x", rx).attr("y", ry).attr("width", 6).attr("height", ww).attr("rx", 2).attr("fill", sc[d.source]);
    const pct = !RUN ? "" : d.source === "tyks" ? ` · ${d.n / totalCases < .01 ? "<1" : Math.round(d.n / totalCases * 100)}% of cases` : d.source === "mimic" ? " · every delivery" :
      d.label.startsWith("Returning") ? ` · ${Math.round(d.n / Math.max(1, RUN.cases.new || 0) * 100)}% of new cases` : "";
    const t = svg.append("text").attr("class", "lab").attr("x", rx + 14).attr("y", ry + ww / 2 + 4).attr("fill", css("--ink")).style("font-size", "13px").text(d.label);
    t.append("tspan").attr("dx", 10).attr("fill", css("--ink-3")).style("font-size", "12px").text(RUN ? `${fmt(d.n)} ${d.unit}${pct}` : "generate to see");
    ry += ww + gap;
  });
  srcIds.forEach(id => {
    const s = srcY[id];
    svg.append("rect").attr("x", lx - 6).attr("y", s.y).attr("width", 6).attr("height", s.h).attr("rx", 2).attr("fill", sc[id]);
    svg.append("text").attr("class", "lab").attr("x", lx - 14).attr("y", s.y + s.h / 2 + 4).attr("text-anchor", "end").attr("fill", css("--ink")).style("font-size", "14px").style("font-weight", 600).text(names[id]);
  });
  svg.append("text").attr("class", "lab").attr("x", lx).attr("y", h - 6).text(RUN ? "Ribbon thickness grows with the square root of the count, so small contributions stay visible." : "Weights appear after the first generation.");
}

// ---------- 2–4 · the recipe, built up step by step ----------
const EGROUPS = {
  real: { title: "Real changes", sub: "The tool must find these.", c: "--accent" },
  look: { title: "Look-alikes", sub: "They look like a change but aren't.", c: "--violet" },
  data: { title: "Data problems", sub: "Results missing or late.", c: "--amber" },
};
const EVENTS = [
  { code: "G1", g: "real", name: "Outbreak", sub: "A cluster of similar cases on one ward", ctl: ["ward", "flag", "n", "days"] },
  { code: "G2", g: "real", name: "Slow drift", sub: "Resistance slowly creeps up", ctl: ["drug2", "extra"] },
  { code: "G6", g: "real", name: "Sudden rise", sub: "More resistant results, same number of cases", ctl: ["ward", "drug", "rise", "days"] },
  { code: "G3", g: "real", name: "First-ever CPE", sub: "One new kind of resistance appears", ctl: ["ward"] },
  { code: "G7", g: "look", name: "Pseudo-outbreak", sub: "A lab mix-up that looks like an outbreak", ctl: ["n", "wards", "days"] },
  { code: "F1", g: "look", name: "Screening starts", sub: "More tests, so more cases are found", ctl: ["ward", "per_day"] },
  { code: "D1", g: "look", name: "New lab rules", sub: "Results change because the rules changed", ctl: ["drug", "flip"] },
  { code: "A4", g: "data", name: "Feed outage", sub: "Nothing arrives for a few days", ctl: ["ward", "days"] },
  { code: "A2", g: "data", name: "Late batch", sub: "Some results arrive a week late", ctl: ["ward", "days", "late_days"] },
];
const MESS = { clean: { label: "None", on: [], f: 0, about: "Only normal delays" },
  realistic: { label: "Normal", on: ["A3", "A6", "B1", "B2", "E3"], f: 1, about: "Some results repeated or corrected" },
  rough: { label: "High", on: ["A3", "A6", "B1", "B2", "E3", "B5", "C9", "D2", "D9"], f: 4, about: "Lots of problems, for stress tests" } };
const ALL_MESS = ["A3", "A6", "B1", "B2", "E3", "B5", "C9", "D2", "D9"];
let MESSLVL = "realistic", STEP = 1, drawnLanes = new Set(), prevChips = new Set(), prevMess = new Set(), autoPlayed = null;
const cat = code => META.catalogue.find(c => c.code === code);
const pd = d3.timeParse("%Y-%m-%d"), ymd = d3.timeFormat("%Y-%m-%d"), nice = d3.timeFormat("%d %b %Y");
const D0 = () => pd("2023-10-02"), D1x = () => pd("2027-06-30");
const day2date = d => d3.timeDay.offset(pd(RECIPE.start), d);
const winDays = () => d3.timeDay.count(pd(RECIPE.start), pd(RECIPE.end));
const evColor = e => css(EGROUPS[e.g].c);

function setMess(level) {
  MESSLVL = level; const m = MESS[level];
  ALL_MESS.forEach(code => delete RECIPE.scenarios[code]);
  m.on.forEach(code => { const p = { ...cat(code).params }; if ("rate" in p) p.rate = +(p.rate * m.f).toFixed(4); RECIPE.scenarios[code] = p; });
  changed();
}
function changed(regen = true) { drawTimeline(); renderKnobs(); renderEvents(); renderScenarios(); renderTray(); if (regen) scheduleGenerate(); }

// the timeline: history and window (step 2), plus a fault lane (step 3), plus the anomalies (step 4)
function drawTimeline() {
  const el = $("timeline"); if (!el.isConnected || STEP < 2 || STEP > 4) return;
  const w = W(el), layer = STEP, lane = 24;
  const on = layer >= 4 ? EVENTS.filter(e => e.code in RECIPE.scenarios) : [];
  const groupsShown = [...new Set(on.map(e => e.g))];
  const m = { l: 178, r: 16, t: 26 }, barsH = 54, base = m.t + barsH, top2 = base + 58;
  const messH = layer >= 3 ? 44 : 0, lanesTop = top2 + 36 + messH, h = lanesTop + on.length * lane + groupsShown.length * 20 + 8;
  const x = d3.scaleTime().domain([D0(), D1x()]).range([m.l, w - m.r]), pxDay = (x(D1x()) - x(D0())) / d3.timeDay.count(D0(), D1x());
  const s0 = pd(RECIPE.start), s1 = pd(RECIPE.end);
  const x2 = d3.scaleTime().domain([d3.timeDay.offset(s0, -6), d3.timeDay.offset(s1, 6)]).range([m.l, w - m.r]);
  const pxDay2 = (x2.range()[1] - x2.range()[0]) / d3.timeDay.count(...x2.domain());
  el.innerHTML = ""; const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const weekly = META.weekly.map(([d, n]) => [pd(d), n]), maxN = d3.max(weekly, d => d[1]);
  const y = d3.scaleLinear().domain([0, maxN]).range([0, barsH - 6]), bw = Math.max(1, pxDay * 7 - 1.5), end = pd(META.source_range[1]);
  weekly.forEach(([d, n]) => svg.append("rect").attr("x", x(d)).attr("y", base - y(n)).attr("width", bw).attr("height", y(n)).attr("rx", 1).attr("fill", css("--ink-3")).attr("opacity", .55));
  weekly.filter(([d]) => d3.timeDay.offset(d, 364) > end && d3.timeDay.offset(d, 364) < D1x()).forEach(([d, n]) =>
    svg.append("rect").attr("x", x(d3.timeDay.offset(d, 364))).attr("y", base - y(n)).attr("width", bw).attr("height", y(n)).attr("rx", 1)
      .attr("fill", "none").attr("stroke", css("--cool")).attr("stroke-opacity", .55).attr("stroke-dasharray", "2 2"));
  svg.append("line").attr("x1", x(end)).attr("x2", x(end)).attr("y1", m.t - 18).attr("y2", base).attr("stroke", css("--cool")).attr("stroke-dasharray", "3 3");
  svg.append("text").attr("class", "lab").attr("x", x(end) - 6).attr("y", m.t - 8).attr("text-anchor", "end").attr("fill", css("--cool")).text("supplied data ends · after it, new cases are resampled");
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${base})`).call(d3.axisBottom(x).ticks(d3.timeMonth.every(w < 1100 ? 6 : 3)).tickFormat(d3.timeFormat("%b %Y")).tickSizeOuter(0));
  svg.append("text").attr("class", "lab").attr("x", m.l - 12).attr("y", base - 20).attr("text-anchor", "end").text("cultures per week");
  const band = svg.append("rect").attr("class", "band").attr("x", x(s0)).attr("y", m.t - 4).attr("width", x(s1) - x(s0)).attr("height", barsH + 4).attr("rx", 6)
    .attr("fill", css("--accent")).attr("fill-opacity", .06).attr("stroke", "none");
  [[x(s0), x2(s0)], [x(s1), x2(s1)]].forEach(([a, b]) => svg.append("path").attr("d", `M${a},${base + 20} L${b},${top2 - 4}`).attr("stroke", css("--accent")).attr("stroke-opacity", .35).attr("stroke-dasharray", "2 3"));
  const handle = d => { const g = svg.append("g").attr("class", "handle").attr("transform", `translate(${x(d)},0)`);
    g.append("line").attr("y1", m.t - 4).attr("y2", base + 20).attr("stroke", css("--accent")).attr("stroke-width", 2);
    g.append("circle").attr("cy", m.t - 4).attr("r", 7).attr("fill", css("--accent"));
    g.append("rect").attr("x", -9).attr("y", m.t - 14).attr("width", 18).attr("height", barsH + 36).attr("fill", "transparent"); return g; };
  const hs = handle(s0), he = handle(s1);
  // the window, zoomed
  svg.append("g").attr("class", "axis").attr("transform", `translate(0,${top2 + 14})`).call(d3.axisTop(x2).ticks(d3.timeMonth.every(winDays() > 300 ? 2 : 1)).tickFormat(d3.timeFormat("%b %Y")).tickSizeOuter(0)).select(".domain").remove();
  svg.append("text").attr("class", "lab").attr("x", x2(s0)).attr("y", top2 - 10).attr("fill", css("--accent")).style("font-weight", 600).text(nice(s0));
  svg.append("text").attr("class", "lab").attr("x", x2(s1)).attr("y", top2 - 10).attr("text-anchor", "end").attr("fill", css("--accent")).style("font-weight", 600).text(nice(s1));
  if (end > s0 && end < s1) {
    svg.append("rect").attr("x", x2(end)).attr("y", top2 + 18).attr("width", x2(s1) - x2(end)).attr("height", 5).attr("rx", 2).attr("fill", css("--cool")).attr("opacity", .5);
    svg.append("rect").attr("x", x2(s0)).attr("y", top2 + 18).attr("width", x2(end) - x2(s0)).attr("height", 5).attr("rx", 2).attr("fill", css("--ink-3")).attr("opacity", .5);
    svg.append("line").attr("x1", x2(end)).attr("x2", x2(end)).attr("y1", top2 + 16).attr("y2", h - 4).attr("stroke", css("--cool")).attr("stroke-dasharray", "3 3");
  } else svg.append("rect").attr("x", x2(s0)).attr("y", top2 + 18).attr("width", x2(s1) - x2(s0)).attr("height", 5).attr("rx", 2).attr("fill", end <= s0 ? css("--cool") : css("--ink-3")).attr("opacity", .5);
  svg.append("text").attr("class", "lab").attr("x", m.l - 12).attr("y", top2 + 24).attr("text-anchor", "end").text("replayed · new");
  // step 3 layer: where the faults land, as a sprinkle of dots whose density follows the mess level
  if (layer >= 3) {
    const yy = top2 + 46, rate = d3.sum(MESS[MESSLVL].on, c => (RECIPE.scenarios[c] || {}).rate || 0), n = Math.min(900, Math.round(rate * winDays() * 9));
    const g = svg.append("g").attr("class", drawnLanes.has("mess:" + MESSLVL) ? "" : "fadein"); drawnLanes.add("mess:" + MESSLVL);
    g.append("text").attr("class", "lab").attr("x", m.l - 12).attr("y", yy + 4).attr("text-anchor", "end").attr("fill", css("--ink-2")).style("font-size", "12px").text(`Feed faults · ${MESS[MESSLVL].label}`);
    const rnd = d3.randomLcg(RECIPE.seed);
    for (let i = 0; i < n; i++) g.append("circle").attr("cx", x2(s0) + rnd() * (x2(s1) - x2(s0))).attr("cy", yy + (rnd() - .5) * 16).attr("r", 1.4).attr("fill", css("--violet")).attr("opacity", .7);
    if (!n) g.append("text").attr("class", "lab").attr("x", x2(s0) + 8).attr("y", yy + 4).text("no faults: only realistic delays");
  }
  // step 4 layer: the anomalies, grouped as real changes, look-alikes and data problems
  let yy = lanesTop;
  groupsShown.forEach(gk => {
    svg.append("text").attr("class", "lab").attr("x", m.l - 12).attr("y", yy + 2).attr("text-anchor", "end").attr("fill", css(EGROUPS[gk].c)).style("font-weight", 600).style("letter-spacing", ".06em").text(EGROUPS[gk].title.toUpperCase());
    yy += 20;
    on.filter(e => e.g === gk).forEach(e => {
      const p = RECIPE.scenarios[e.code], col = evColor(e), a = day2date(p.day ?? 0), key = "ev:" + e.code, fresh = !drawnLanes.has(key); drawnLanes.add(key);
      const g = svg.append("g").attr("class", "lane").datum(e.code);
      const until = ["D1", "F1", "G2"].includes(e.code) ? s1 : p.days ? day2date(p.day + p.days) : null;
      g.append("text").attr("class", "lab").attr("x", m.l - 12).attr("y", yy + 4).attr("text-anchor", "end").attr("fill", css("--ink-2")).style("font-size", "12px")
        .text(`${e.name}${p.ward ? " · " + p.ward : ["D1", "G6", "G2"].includes(e.code) ? " · " + p.drug : ""}`);
      const shape = g.append("g").attr("class", fresh ? "grow" : "");
      if (e.code === "G2") shape.append("path").attr("class", "bar").attr("d", `M${x2(s0)},${yy + 6} L${x2(s1)},${yy - 7} L${x2(s1)},${yy + 6} Z`).attr("fill", col).attr("fill-opacity", .45);
      else if (until) shape.append("rect").attr("class", "bar").attr("x", x2(a)).attr("y", yy - 7).attr("width", Math.max(8, x2(until) - x2(a))).attr("height", 14).attr("rx", 7).attr("fill", col).attr("fill-opacity", ["D1", "F1"].includes(e.code) ? .35 : .85);
      else shape.append("circle").attr("class", "bar").attr("cx", x2(a)).attr("cy", yy).attr("r", 7).attr("fill", col);
      if (e.code === "G1" || e.code === "G7") d3.range(Math.min(p.n, 40)).forEach(i => shape.append("circle").attr("cx", x2(a) + 7 + i * Math.max(0, (x2(until) - x2(a) - 14)) / Math.max(1, Math.min(p.n, 40) - 1)).attr("cy", yy).attr("r", 1.8).attr("fill", css("--paper")));
      if (e.code === "A2") { const arr = day2date(p.day + p.days + p.late_days); shape.append("path").attr("d", `M${x2(until)},${yy} L${x2(arr)},${yy}`).attr("stroke", col).attr("stroke-width", 1.5).attr("stroke-dasharray", "3 3"); shape.append("circle").attr("cx", x2(arr)).attr("cy", yy).attr("r", 3.5).attr("fill", col); }
      const txt = e.code === "G2" ? `+${p.extra} points a year` : e.code === "A2" ? `${nice(a)} · arrives ${p.late_days} days late` : e.code === "G6" ? `${nice(a)} · +${p.rise} points` : nice(a);
      const lx = e.code === "G2" ? x2(s0) + 8 : e.code === "A2" ? x2(day2date(p.day + p.days + p.late_days)) + 10 : (until ? x2(until) : x2(a)) + 12, far = lx > w - 170;
      g.append("text").attr("class", "lab").attr("x", far ? x2(a) - 12 : lx).attr("text-anchor", far ? "end" : "start").attr("y", yy + 4).text(txt);
      g.append("rect").attr("x", (e.code === "G2" ? x2(s0) : x2(a)) - 10).attr("y", yy - 11).attr("width", Math.max(20, (until ? x2(until) - (e.code === "G2" ? x2(s0) : x2(a)) : 0) + 20)).attr("height", 22).attr("fill", "transparent");
      yy += lane;
    });
  });
  // dragging: either edge or the whole window on the overview; any dated anomaly in the zoomed window
  const drag = (node, px, onMove) => node.call(d3.drag().on("start", function (ev) { this.__x = ev.x; this.__snap = JSON.stringify(RECIPE); })
    .on("drag", function (ev) { onMove(Math.round((ev.x - this.__x) / px), JSON.parse(this.__snap)); if (!drawTimeline.raf) drawTimeline.raf = requestAnimationFrame(() => { drawTimeline.raf = 0; changed(false); }); })
    .on("end", () => scheduleGenerate()));
  const clampWin = (st, en) => { const lo = d3.timeDay.offset(D0(), 14); if (st < lo || en > D1x() || d3.timeDay.count(st, en) < 28) return null; return [st, en]; };
  const moveStart = (dd, b, keepEnd) => {
    const st = d3.timeDay.offset(pd(b.start), dd), en = keepEnd ? pd(b.end) : d3.timeDay.offset(pd(b.end), dd);
    const c = clampWin(st, en); if (!c) return;
    RECIPE.start = ymd(c[0]); RECIPE.end = ymd(c[1]);
    for (const k in RECIPE.scenarios) if ("day" in RECIPE.scenarios[k]) RECIPE.scenarios[k].day = keepEnd ? Math.max(0, b.scenarios[k].day - dd) : b.scenarios[k].day;
  };
  drag(hs, pxDay, (dd, b) => moveStart(dd, b, true));
  drag(he, pxDay, (dd, b) => { const c = clampWin(pd(b.start), d3.timeDay.offset(pd(b.end), dd)); if (c) RECIPE.end = ymd(c[1]); });
  drag(band, pxDay, (dd, b) => moveStart(dd, b, false));
  svg.selectAll(".lane").each(function (code) { if (!("day" in RECIPE.scenarios[code])) return; drag(d3.select(this), pxDay2, (dd, b) => { RECIPE.scenarios[code].day = Math.max(0, Math.min(winDays() - 1, b.scenarios[code].day + dd)); }); });
}

const dotGrid = (n, cols, gap, r, lit, col) => Array.from({ length: n }, (_, i) => `<circle cx="${(i % cols) * gap + r + 1}" cy="${Math.floor(i / cols) * gap + r + 1}" r="${r}" fill="${i < lit ? col : css("--line")}"/>`).join("");
function renderKnobs() {
  // step 2: the window in words
  const nd = winDays(), newDays = Math.max(0, Math.min(nd, d3.timeDay.count(pd(META.source_range[1]), pd(RECIPE.end))));
  $("seedk").innerHTML = `<div class="big">${nice(day2date(0))} – ${nice(pd(RECIPE.end))}</div>
    <div class="mini"><svg width="220" height="10"><rect width="${220 * (nd - newDays) / nd}" height="8" rx="4" fill="${css("--ink-3")}"/><rect x="${220 * (nd - newDays) / nd}" width="${220 * newDays / nd}" height="8" rx="4" fill="${css("--cool")}"/></svg>
    <span class="muted">${nd} days · <b style="color:var(--ink-2)">${nd - newDays}</b> replayed · <b style="color:var(--cool)">${newDays}</b> new</span></div>
    <div class="row adv-only">Seed <input type="number" id="seed" value="${RECIPE.seed}"><button class="chip sm" id="shuffle">Shuffle</button><span>same seed, same data</span></div>`;
  $("seed").onchange = () => { RECIPE.seed = +$("seed").value || 1; changed(); };
  $("shuffle").onclick = () => { RECIPE.seed = 1 + Math.floor(Math.random() * 9999); changed(); };
  // step 3: one switch, and what it adds
  const m = MESS[MESSLVL], per1000 = Math.round(1000 * d3.sum(m.on, c => (RECIPE.scenarios[c] || {}).rate || 0));
  $("mess").innerHTML = `<div class="seg">${Object.entries(MESS).map(([k, v]) => `<button data-m="${k}" aria-pressed="${k === MESSLVL}">${v.label}</button>`).join("")}</div>
    <div class="mini"><svg width="203" height="28">${dotGrid(200, 40, 5, 1.6, Math.round(per1000 / 5), css("--violet"))}</svg><div class="val">${per1000 ? `≈ ${per1000} in 1,000 rows` : "No faults"}<small>${m.about}</small></div></div>`;
  $("mess").onclick = e => { const b = e.target.closest("button"); if (b) setMess(b.dataset.m); };
  const unit = { A3: "cultures", A6: "hourly batches", B1: "S/R results", B2: "isolates", E3: "isolates", B5: "cultures", C9: "cultures", D2: "Enterobacterales isolates", D9: "one day" };
  $("messlist").innerHTML = ALL_MESS.map(code => {
    const c = cat(code), on = code in RECIPE.scenarios, p = RECIPE.scenarios[code] || c.params, lit = p.rate ? Math.max(1, Math.round(p.rate * 1000)) : 0, fresh = on && !prevMess.has(code);
    return `<div class="fault ${on ? "" : "off"} ${fresh ? "added" : ""}"><header><code>${code}</code><b>${c.label}</b></header><p>${c.about}</p>
      ${p.rate !== undefined ? `<div class="mini"><svg width="203" height="23">${dotGrid(200, 40, 5, 1.6, Math.round(lit / 5) || (lit ? 1 : 0), css("--violet"))}</svg><span class="val">${on ? `${lit} in 1,000` : "off"}<small>${unit[code]}</small></span></div>` : `<div class="muted">${on ? "on" : "off"} · ${unit[code]}</div>`}</div>`;
  }).join("");
  prevMess = new Set(ALL_MESS.filter(c => c in RECIPE.scenarios));
}

function ctlHtml(code, k, v) {
  const step = dir => `<button class="step" data-code="${code}" data-k="${k}" data-step="${dir}">${dir < 0 ? "−" : "+"}</button>`;
  const pick = (label, key, opts, fmtv = o => o) => `<div class="row"><span>${label}</span>${opts.map(o => `<button class="chip sm ${v === o ? "on" : ""}" data-code="${code}" data-k="${key}" data-v="${o}">${fmtv(o)}</button>`).join("")}</div>`;
  if (k === "ward") return pick("Ward", "ward", META.wards);
  if (k === "flag") return pick("Type", "flag", ["mrsa", "esbl", "vre"], o => o.toUpperCase());
  if (k === "drug") return pick("Drug", "drug", ["CIP", "CRO", "TMP", "NIT", "TZP", "MEM"]);
  if (k === "drug2") { v = RECIPE.scenarios[code].drug; return pick("Drug", "drug", ["TMP", "CIP", "AMP"]); }
  if (k === "n" || k === "per_day") return `<div class="row st"><span>${k === "n" ? "Cases" : "Per day"}</span>${step(-1)}<svg width="142" height="${v > 20 ? 15 : 8}">${dotGrid(Math.min(40, v), 20, 7, 2.6, 99, css("--accent"))}</svg><span class="val">${v}</span>${step(1)}</div>`;
  if (k === "flip" || k === "rise") { const pct = k === "flip" ? Math.round(v * 100) : v;
    return `<div class="row st"><span>${k === "flip" ? "Flips" : "Rise"}</span>${step(-1)}<svg width="127" height="21">${dotGrid(100, 25, 5, 1.7, pct, css(k === "flip" ? "--violet" : "--accent"))}</svg><span class="val">${k === "flip" ? pct + "% of S" : "+" + pct + " pts"}</span>${step(1)}</div>`; }
  if (k === "wards") return `<div class="row st"><span>Wards</span>${step(-1)}<svg width="120" height="14">${META.wards.map((w, i) => `<rect x="${i * 13}" width="11" height="11" rx="2" fill="${i < v ? css("--violet") : css("--line")}"/>`).join("")}</svg><span class="val">${v} of ${META.wards.length}</span>${step(1)}</div>`;
  if (k === "extra") {
    // a small chart of the resistant share over the window: the trend the data shows, and with the extra drift
    const t = META.trends[RECIPE.scenarios[code].drug] || { slope: 0, last_share: .2 }, yrs = winDays() / 365.25, y0 = t.last_share * 100;
    const ya = y0 + t.slope * yrs, yb = ya + v * yrs, top = Math.max(yb, ya) + 2, bot = y0 - 3, sy = val => 4 + (top - val) / (top - bot) * 34;
    return `<div class="row st"><span>Extra</span>${step(-1)}<svg width="110" height="42"><line x1="4" x2="106" y1="${sy(y0)}" y2="${sy(ya)}" stroke="${css("--ink-3")}" stroke-width="1.5" stroke-dasharray="3 3"/>
      <line x1="4" x2="106" y1="${sy(y0)}" y2="${sy(yb)}" stroke="${css("--accent")}" stroke-width="2"/><circle cx="106" cy="${sy(yb)}" r="3" fill="${css("--accent")}"/></svg>
      <span class="val">+${v} pts/yr<small>${y0.toFixed(0)}% → ${yb.toFixed(0)}% · data trend ${t.slope >= 0 ? "+" : ""}${t.slope} dashed</small></span>${step(1)}</div>`;
  }
  if (k === "days" || k === "late_days") return `<div class="row st"><span>${k === "days" ? "Lasts" : "Arrives"}</span>${step(-1)}<span class="val" style="min-width:84px;text-align:center">${v} days${k === "late_days" ? " late" : ""}</span>${step(1)}</div>`;
  return "";
}
function renderEvents() {
  $("events").innerHTML = Object.entries(EGROUPS).map(([gk, G]) => `<div class="egroup"><h3><i style="--c:${css(G.c)}"></i>${G.title}</h3><p>${G.sub}</p></div><div class="events">` +
    EVENTS.filter(e => e.g === gk).map(e => {
      const on = e.code in RECIPE.scenarios, p = RECIPE.scenarios[e.code] || cat(e.code).params;
      const when = "day" in p ? ` · ${nice(day2date(p.day))}` : "";
      return `<div class="ev ${on ? "on" : ""}" style="--c:${evColor(e)}"><header data-toggle="${e.code}"><span class="sw"></span><div><b>${e.name}</b><small>${e.sub}${on ? when : ""}</small></div></header>
        <div class="ctl">${e.ctl.map(k => ctlHtml(e.code, k, p[k])).join("")}</div></div>`;
    }).join("") + `</div>`).join("");
}
function tweak(code, k, val) { RECIPE.scenarios[code] = { ...(RECIPE.scenarios[code] || cat(code).params), [k]: val }; changed(); }
$("events").addEventListener("click", e => {
  const t = e.target.closest("[data-toggle]"), b = e.target.closest("button");
  if (t) { const c = t.dataset.toggle; if (c in RECIPE.scenarios) delete RECIPE.scenarios[c]; else { RECIPE.scenarios[c] = { ...cat(c).params }; drawnLanes.delete("ev:" + c); } return changed(); }
  if (!b || !b.dataset.code) return;
  const { code, k } = b.dataset, cur = RECIPE.scenarios[code][k];
  if (b.dataset.v) return tweak(code, k, b.dataset.v);
  const d = +b.dataset.step;
  const lim = { flip: [.01, 1, .02], rise: [5, 60, 5], extra: [1, 20, 1], n: [1, 40, 1], per_day: [1, 40, 1], wards: [2, META.wards.length, 1], days: [1, 60, 1], late_days: [1, 60, 1] }[k] || [1, 60, 1];
  tweak(code, k, Math.max(lim[0], Math.min(lim[1], +(cur + d * lim[2]).toFixed(2))));
});

// advanced: every scenario with its raw parameters
function renderScenarios() {
  const order = ["New cases", "Real events", "Timing", "Revisions", "Identity", "Structure", "Content", "Practice"];
  const list = [...META.catalogue].sort((a, b) => order.indexOf(a.group) - order.indexOf(b.group));
  $("scenarios").innerHTML = list.map(s => {
    const fixed = s.code === "A1" || s.code === "N", on = fixed || s.code in RECIPE.scenarios, p = { ...s.params, ...(RECIPE.scenarios[s.code] || {}) };
    const inputs = Object.entries(p).map(([k, v]) => `<label>${k.replace("_", " ")} <input type="${typeof v === "number" ? "number" : "text"}" step="any" data-code="${s.code}" data-k="${k}" value="${v}"></label>`).join("");
    return `<div class="scen ${on ? "on" : ""} ${fixed ? "fixed" : ""}"><header data-adv="${fixed ? "" : s.code}"><span class="sw"></span><code>${s.code}</code><b>${s.label}</b><span class="grp">${s.group} · ${s.mechanism}</span></header><p>${s.about}${fixed ? " Always on." : ""}</p>${inputs ? `<div class="ctl row">${inputs}</div>` : ""}</div>`;
  }).join("");
}
$("scenarios").addEventListener("click", e => {
  const h = e.target.closest("header[data-adv]"); if (!h || !h.dataset.adv) return;
  const c = h.dataset.adv; if (c in RECIPE.scenarios) delete RECIPE.scenarios[c]; else RECIPE.scenarios[c] = { ...cat(c).params }; changed();
});
$("scenarios").addEventListener("change", e => {
  const t = e.target; if (!t.dataset.code || !RECIPE.scenarios[t.dataset.code]) return;
  RECIPE.scenarios[t.dataset.code][t.dataset.k] = t.type === "number" ? +t.value : t.value; changed();
});

// the tray: what has been added so far, as chips that pop in when they first appear
function renderTray() {
  const chips = [[`win`, `${d3.timeFormat("%b %Y")(pd(RECIPE.start))} – ${d3.timeFormat("%b %Y")(pd(RECIPE.end))}`, css("--ink-3")],
    [`mess:${MESSLVL}`, `${MESS[MESSLVL].label} noise`, css("--violet")],
    ...EVENTS.filter(e => e.code in RECIPE.scenarios).map(e => { const p = RECIPE.scenarios[e.code]; return [`ev:${e.code}`, `${e.name}${p.ward ? " · " + p.ward : p.drug ? " · " + p.drug : ""}`, evColor(e)]; }),
];
  $("tray").innerHTML = chips.map(([k, t, c]) => `<span class="rchip ${prevChips.has(k) ? "" : "pop"}" style="--c:${c}"><i></i>${t}</span>`).join("");
  prevChips = new Set(chips.map(c => c[0]));
}

// regenerate shortly after the last change, so every knob shows its effect
let genTimer, genBusy = false, genAgain = false;
function scheduleGenerate() { clearTimeout(genTimer); setStatus("wait", "Regenerating in a moment…"); genTimer = setTimeout(runGenerate, 600); }
function setStatus(kind, html) { $("spin").className = "spin " + (kind === "busy" || kind === "wait" ? "on" : kind === "ok" ? "ok" : ""); $("status").className = "status" + (kind === "err" ? " err" : ""); $("status").innerHTML = html; }
async function runGenerate() {
  if (genBusy) { genAgain = true; return; }
  genBusy = true; stop(); setStatus("busy", "Generating…"); document.body.classList.add("loading");
  try {
    RUN = await api("/api/runs", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(RECIPE) });
    const c = RUN.cases;
    setStatus("ok", `<b>${fmt(RUN.deliveries)}</b> rows from ${fmt((c.replayed || 0) + (c.new || 0) + (c.injected || 0))} cases · ${RUN.checks.every(k => k.ok) ? "checks pass" : "<em>some checks fail</em>"}`);
    drawRibbon(); drawStatic(); renderTabs(); loadTable(); await showAll();
    if (STEP === 5 && autoPlayed !== RUN.id) { autoPlayed = RUN.id; resetLive(); play(); }
    sxReset(); if (!document.body.classList.contains("adv")) sxPlay();
  } catch (err) { setStatus("err", err.message); }
  document.body.classList.remove("loading");
  genBusy = false; if (genAgain) { genAgain = false; runGenerate(); }
}

// ---------- the six steps ----------
const NEXT_LABEL = { 1: "Next", 2: "Next", 3: "Next", 4: "Watch it", 5: "See the data", 6: "Start again" };
function goStep(n) {
  const dir = n < STEP ? "back" : "";
  STEP = n; try { history.replaceState(null, "", "#step" + n); } catch {}
  document.querySelectorAll(".panel").forEach(p => { const on = +p.dataset.panel === n; p.classList.toggle("active", on); p.classList.toggle("back", on && dir === "back"); });
  document.querySelectorAll("#steps button").forEach(b => { const k = +b.dataset.step; b.setAttribute("aria-current", k === n ? "step" : "false"); b.classList.toggle("done", k < n); });
  $("trackFill").style.width = `${(n - 1) / 5 * 100}%`;
  const slot = document.querySelector(`.panel[data-panel="${n}"] .tlslot`);
  if (slot) { slot.append($("tlwrap")); drawTimeline(); }
  $("back").disabled = n === 1; $("nextStep").textContent = NEXT_LABEL[n] + (n < 6 ? " →" : "");
  if (n === 5 && RUN) { draw(); drawStatic(); if (autoPlayed !== RUN.id) { autoPlayed = RUN.id; resetLive(); play(); } }
  if (n === 6) loadTable();
  if (n === 1) drawRibbon();
  scrollTo({ top: 0, behavior: "smooth" });
}
$("advsw").addEventListener("click", () => { const on = !document.body.classList.contains("adv"); document.body.classList.toggle("adv", on); if (on && SX.src) sxPlay(); if (!on) setTimeout(sxDraw, 50); $("advsw").setAttribute("aria-pressed", on); try { localStorage.setItem("feedsim-adv", on ? "1" : ""); } catch {} if (RUN) { draw(); drawStatic(); } drawTimeline(); });
try { if (localStorage.getItem("feedsim-adv")) { document.body.classList.add("adv"); $("advsw").setAttribute("aria-pressed", "true"); } } catch {}
$("steps").addEventListener("click", e => { const b = e.target.closest("button"); if (b) goStep(+b.dataset.step); });
$("back").onclick = () => STEP > 1 && goStep(STEP - 1);
$("nextStep").onclick = () => goStep(STEP < 6 ? STEP + 1 : 1);

// ---------- 3 · live ----------
function chips(el, opts, cur, on) {
  el.innerHTML = `<span class="lbl">${el.dataset.label || ""}</span>` + opts.map(([v, t]) => `<button class="chip ${v === cur ? "on" : ""}" data-v="${v}">${t}</button>`).join("");
  el.onclick = e => { const b = e.target.closest("button"); if (b) on(b.dataset.v); };
}
function renderControls() {
  $("size").dataset.label = "Step"; $("rate").dataset.label = "Speed";
  chips($("size"), [["hour", "Hourly"], ["day", "Daily"], ["week", "Weekly"]], SIZE, v => { SIZE = v; renderControls(); if (RUN) { const was = !!src; resetLive(); if (was) play(); } });
  chips($("rate"), [["2", "Slow"], ["8", "Normal"], ["24", "Fast"], ["60", "Fastest"]], String(RATE), v => { RATE = +v; renderControls(); if (src) { stop(); play(); } });
}
function resetLive() { stop(); cursor = -1; BINS = []; tickerLog = []; $("ticker").innerHTML = ""; draw(); }
function play() {
  if (!RUN) return;
  if (BINS.done) resetLive();
  stop();
  src = new EventSource(`/api/runs/${RUN.id}/live?size=${SIZE}&rate=${RATE}&from=${cursor + 1}`);
  $("play").textContent = "Pause";
  src.onmessage = e => { const b = JSON.parse(e.data); BINS[b.i] = b; cursor = b.i; pushTicker(b); queueDraw(); };
  src.addEventListener("done", () => { BINS.done = true; stop(); });
  src.onerror = () => stop();
}
function stop() { if (src) { src.close(); src = null; } $("play").textContent = cursor >= 0 && !BINS.done ? "Resume" : "Play"; }
$("play").addEventListener("click", () => src ? stop() : play());
async function showAll() {
  if (!RUN) return; stop();
  BINS = await api(`/api/runs/${RUN.id}/bins?size=${SIZE}`); BINS.done = true; cursor = BINS.length - 1;
  tickerLog = []; BINS.slice(-3).forEach(pushTicker); draw(); stop();
}
$("all").addEventListener("click", showAll);
function pushTicker(b) {
  for (const [t, text, tag] of b.ticker) tickerLog.unshift({ t, text, tag });
  tickerLog = tickerLog.slice(0, 12);
}
function queueDraw() { if (!drawQueued) { drawQueued = true; requestAnimationFrame(() => { drawQueued = false; draw(); }); } }

function draw() {
  const seen = BINS.slice(0, cursor + 1).filter(Boolean);
  const last = seen[seen.length - 1];
  $("clock").textContent = last ? d3.timeFormat(SIZE === "hour" ? "%a %d %b %Y, %H:00" : "%a %d %b %Y")(parseT(last.t)) : "–";
  $("clockSub").textContent = !RUN ? "Generate a dataset, then play it." : last ? `${fmt(cursor + 1)} of ${fmt(RUN ? Math.ceil((parseT(RUN.end) - parseT(RUN.start)) / ({ hour: 36e5, day: 864e5, week: 6048e5 })[SIZE]) : 0)} ${SIZE === "day" ? "days" : SIZE + "s"} delivered` : "Press Play to start the feed.";
  const sum = (f) => seen.reduce((s, b) => s + f(b), 0), k = (b, n) => b.kinds[n] || 0, tg = (b, n) => b.tags[n] || 0;
  const counters = [
    ["Samples received", sum(b => k(b, "culture received"))], ["Results", sum(b => k(b, "susceptibility"))], ["Still waiting", last ? last.backlog : 0],
    ["Problems", sum(b => k(b, "susceptibility corrected") + k(b, "organism corrected") + k(b, "duplicate") + tg(b, "A2") + tg(b, "A4")), true],
    ["Rows delivered", sum(b => b.rows), false, true], ["Corrections", sum(b => k(b, "susceptibility corrected") + k(b, "organism corrected")), true, true],
    ["Duplicates", sum(b => k(b, "duplicate")), true, true], ["Late rows", sum(b => tg(b, "A2") + tg(b, "A4")), true, true], ["Event rows", sum(b => b.origin.injected || 0), true, true]];
  $("counters").innerHTML = counters.map(([l, v, acc, adv]) => `<div class="counter ${acc && v ? "acc" : ""} ${adv ? "adv-only" : ""}"><b>${fmt(v)}</b><small>${l}</small></div>`).join("");
  $("ticker").innerHTML = tickerLog.slice(0, 12).map(x => `<li><time>${x.t.slice(5).replace("T", " ")}</time><span class="tag ${HOT.has(x.tag) || x.tag === "injected" || x.tag === "A4" || x.tag === "A2" ? "hot" : ""}">${x.tag}</span><span>${x.text}</span></li>`).join("");
  plotClock(seen); plotKinds(seen); plotBacklog(seen); plotWards(seen);
}

// ---------- plots ----------
const W = el => Math.max(320, el.clientWidth);
function frame(id, h) { const el = $(id); const w = W(el); el.innerHTML = ""; const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`); return { el, w, h, svg }; }
function timeX(w, m) { return d3.scaleTime().domain([parseT(RUN.start), parseT(RUN.end)]).range([m.l, w - m.r]); }
function axisX(svg, x, y) { svg.append("g").attr("class", "axis").attr("transform", `translate(0,${y})`).call(d3.axisBottom(x).ticks(8).tickSizeOuter(0)); }
function empty(id, msg) { $(id).innerHTML = `<div class="empty">${msg}</div>`; }
// merge bins so a plot never needs more than ~max columns
function coarse(seen, max) {
  if (!seen.length) return [];
  const f = Math.max(1, Math.ceil(BINS.length / max)), out = [];
  for (const b of seen) {
    const j = Math.floor(b.i / f);
    const o = out[j] || (out[j] = { i: j, t: b.t, rows: 0, kinds: {}, wards: {}, backlog: 0, n: 0 });
    o.rows += b.rows; o.backlog = b.backlog;
    for (const [kk, v] of Object.entries(b.kinds)) o.kinds[kk] = (o.kinds[kk] || 0) + v;
    for (const [kk, v] of Object.entries(b.wards)) o.wards[kk] = (o.wards[kk] || 0) + v;
  }
  return out.filter(Boolean).map(o => ({ ...o, span: f }));
}
const stepMs = () => ({ hour: 36e5, day: 864e5, week: 6048e5 })[SIZE];

function plotClock(seen) {
  if (!RUN) return empty("p-clock", "Generate a dataset to see it arrive.");
  const m = { l: 56, r: 16, t: 10, b: 26 }, { w, h, svg, el } = frame("p-clock", 360);
  const x = timeX(w, m), y = d3.scaleTime().domain([d3.timeDay.offset(parseT(RUN.start), -14), parseT(RUN.end)]).range([h - m.b, m.t]);
  svg.append("line").attr("x1", x(parseT(RUN.start))).attr("y1", y(parseT(RUN.start))).attr("x2", x(parseT(RUN.end))).attr("y2", y(parseT(RUN.end))).attr("stroke", css("--line")).attr("stroke-dasharray", "4 4");
  svg.append("text").attr("class", "lab").attr("x", x(parseT(RUN.end)) - 40).attr("y", y(parseT(RUN.end)) - 6).attr("text-anchor", "end").text("no delay");
  axisX(svg, x, h - m.b);
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6).tickSizeOuter(0));
  // the data-end line: after it, cases are new, not replayed
  const end = d3.timeParse("%Y-%m-%d")(META.source_range[1]);
  if (end > parseT(RUN.start) && end < parseT(RUN.end)) {
    svg.append("line").attr("x1", m.l).attr("x2", w - m.r).attr("y1", y(end)).attr("y2", y(end)).attr("stroke", css("--cool")).attr("stroke-dasharray", "2 4");
    svg.append("text").attr("class", "lab").attr("x", m.l + 6).attr("y", y(end) - 5).attr("fill", css("--cool")).text("supplied data ends · new cases above");
  }
  const cv = document.createElement("canvas"), dpr = devicePixelRatio || 1, r = el.querySelector("svg").getBoundingClientRect(), sc = r.width / w;
  cv.width = r.width * dpr; cv.height = h * sc * dpr; Object.assign(cv.style, { position: "absolute", left: 0, top: 0, width: r.width + "px", height: h * sc + "px", pointerEvents: "none" });
  el.style.position = "relative"; el.append(cv);
  const ctx = cv.getContext("2d"); ctx.scale(dpr * sc, dpr * sc);
  const oc = originColor(), pts = seen.flatMap(b => b.points), thin = Math.max(1, Math.ceil(pts.length / 9000));
  pts.forEach((p, i) => {
    const tag = p[4] === "A6" || p[4] === "N" ? "" : p[4], ev = ["G1", "G3", "F1", "G6", "G7", "G2"].includes(tag), late = tag === "A2" || tag === "A4";
    if (!tag && i % thin) return;
    ctx.globalAlpha = tag ? .95 : .4; ctx.fillStyle = ev ? css("--accent") : late ? css("--amber") : tag ? css("--violet") : oc[p[3]] || css("--ink-3");
    const rr = ev ? 3.2 : tag ? 2 : 1.2; ctx.beginPath(); ctx.arc(x(parseT(p[1])), y(parseT(p[0])), rr, 0, 6.3); ctx.fill();
  });
  // label the truth events that have happened by now
  const now = seen.length ? parseT(seen[seen.length - 1].t) : null;
  RUN.truth.filter(t => t.start && ["G1", "G3", "G6", "G7", "A4", "A2", "D1", "F1"].includes(t.code)).forEach((t, j) => {
    const d = d3.timeParse("%Y-%m-%d")(t.start); if (!now || d > now || d < parseT(RUN.start)) return;
    svg.append("line").attr("x1", x(d)).attr("x2", x(d)).attr("y1", m.t).attr("y2", h - m.b).attr("stroke", css("--accent")).attr("stroke-opacity", .25);
    svg.append("text").attr("class", "lab").attr("x", x(d) + 4).attr("y", m.t + 10 + (j % 4) * 13).attr("fill", css("--accent")).text(`${t.code} ${t.label}`);
  });
  svg.append("text").attr("class", "lab").attr("x", m.l).attr("y", m.t - 0).attr("dy", -2).text("sample time ↑");
  svg.append("text").attr("class", "lab").attr("x", w - m.r).attr("y", h - 2).attr("text-anchor", "end").text("delivered →");
  legend(el, [["replayed", oc.replayed], ["new", oc.new], ["outbreak, CPE, screening", css("--accent")], ["outage or late batch", css("--amber")], ["correction, breakpoint, implausible", css("--violet")]]);
}
function legend(el, items) { const d = document.createElement("div"); d.className = "legend"; d.innerHTML = items.map(([t, c]) => `<span><i style="background:${c}"></i>${t}</span>`).join(""); el.append(d); }

function plotKinds(seen) {
  if (!RUN) return empty("p-kinds", "–");
  const m = { l: 44, r: 10, t: 8, b: 26 }, { w, h, svg, el } = frame("p-kinds", 220), x = timeX(w, m);
  const bins = coarse(seen, 160), gc = groupColor();
  const rows = bins.map(b => { const o = { t: parseT(b.t), span: b.span }; GROUPS.forEach(g => o[g] = 0); for (const [kk, v] of Object.entries(b.kinds)) o[KIND_GROUP[kk] || "result"] += v; return o; });
  const st = d3.stack().keys(GROUPS)(rows), max = d3.max(rows, r => GROUPS.reduce((s, g) => s + r[g], 0)) || 1;
  const y = d3.scaleLinear().domain([0, max]).nice().range([h - m.b, m.t]);
  const bw = Math.max(1, (x(new Date(+parseT(RUN.start) + stepMs() * (bins[0]?.span || 1))) - x(parseT(RUN.start))) - 1);
  svg.append("g").selectAll("g").data(st).join("g").attr("fill", d => gc[d.key]).selectAll("rect").data(d => d).join("rect")
    .attr("x", d => x(d.data.t)).attr("width", bw).attr("y", d => y(d[1])).attr("height", d => Math.max(0, y(d[0]) - y(d[1])));
  axisX(svg, x, h - m.b);
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));
  legend(el, GROUPS.map(g => [g, gc[g]]));
}
function plotBacklog(seen) {
  if (!RUN) return empty("p-backlog", "–");
  const m = { l: 44, r: 10, t: 8, b: 26 }, { w, h, svg } = frame("p-backlog", 220), x = timeX(w, m);
  const bins = coarse(seen, 400), y = d3.scaleLinear().domain([0, d3.max(bins, b => b.backlog) || 1]).nice().range([h - m.b, m.t]);
  svg.append("path").datum(bins).attr("fill", css("--accent")).attr("fill-opacity", .12)
    .attr("d", d3.area().x(b => x(parseT(b.t))).y0(h - m.b).y1(b => y(b.backlog)));
  svg.append("path").datum(bins).attr("fill", "none").attr("stroke", css("--accent")).attr("stroke-width", 1.6).attr("d", d3.line().x(b => x(parseT(b.t))).y(b => y(b.backlog)));
  axisX(svg, x, h - m.b);
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(4).tickSizeOuter(0));
}
function plotWards(seen) {
  if (!RUN) return empty("p-wards", "–");
  const wards = RUN.wards, m = { l: 60, r: 10, t: 6, b: 26 }, { w, h, svg } = frame("p-wards", 26 + wards.length * 22), x = timeX(w, m);
  const bins = coarse(seen, 200), y = d3.scaleBand().domain(wards).range([m.t, h - m.b]).padding(.12);
  const max = d3.max(bins, b => d3.max(wards, wd => b.wards[wd] || 0)) || 1;
  const bw = Math.max(1, x(new Date(+parseT(RUN.start) + stepMs() * (bins[0]?.span || 1))) - x(parseT(RUN.start)));
  const col = d3.scaleSequential(t => d3.interpolate(css("--sheet-2"), css("--ink"))(t)).domain([0, Math.sqrt(max)]);
  wards.forEach(wd => bins.forEach(b => {
    const v = b.wards[wd] || 0;
    svg.append("rect").attr("x", x(parseT(b.t))).attr("y", y(wd)).attr("width", bw + .3).attr("height", y.bandwidth()).attr("fill", v ? col(Math.sqrt(v)) : "transparent");
  }));
  RUN.truth.filter(t => ["A4", "A2"].includes(t.code)).forEach(t => {
    const a = d3.timeParse("%Y-%m-%d")(t.start); if (!seen.length || a > parseT(seen[seen.length - 1].t)) return;
    svg.append("rect").attr("x", x(a)).attr("y", y(t.ward) - 2).attr("width", Math.max(4, x(d3.timeParse("%Y-%m-%d")(t.end)) - x(a))).attr("height", y.bandwidth() + 4)
      .attr("fill", "none").attr("stroke", css("--amber")).attr("stroke-dasharray", "3 2").attr("rx", 3);
  });
  svg.append("g").attr("class", "axis").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).tickSize(0)).select(".domain").remove();
  axisX(svg, x, h - m.b);
}

// static plots: the whole run, not time-dependent
async function drawStatic() {
  if (!RUN) return;
  // case types
  { const el = $("p-types"); const items = [["Replayed from Tyks", RUN.cases.replayed || 0, css("--ink-3")], ["New after the data ends", RUN.cases.new || 0, css("--cool")], ["Injected", RUN.cases.injected || 0, css("--accent")]];
    const sc = RUN.truth.filter(t => !["A1", "N"].includes(t.code)).map(t => [`${t.code} · ${t.label}`, t.count, HOT.has(t.code) ? css("--accent") : css("--amber")]);
    const all = [...items, null, ...sc], m = { l: 230, r: 50 }, w = W(el), rh = 20, h = all.length * rh + 10;
    el.innerHTML = ""; const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
    const x1 = d3.scaleLinear().domain([0, d3.max(items, d => d[1]) || 1]).range([0, w - m.l - m.r]);
    const x2 = d3.scaleLinear().domain([0, d3.max(sc, d => d[1]) || 1]).range([0, w - m.l - m.r]);
    all.forEach((d, i) => {
      if (!d) { svg.append("text").attr("class", "lab").attr("x", 0).attr("y", i * rh + 14).text("rows touched by each scenario:"); return; }
      const x = i < 3 ? x1 : x2, yy = i * rh + 4;
      svg.append("text").attr("class", "lab").attr("x", m.l - 8).attr("y", yy + 11).attr("text-anchor", "end").attr("fill", css("--ink-2")).text(d[0]);
      svg.append("rect").attr("x", m.l).attr("y", yy + 2).attr("width", Math.max(2, x(d[1]))).attr("height", 11).attr("rx", 3).attr("fill", d[2]);
      svg.append("text").attr("class", "lab").attr("x", m.l + Math.max(2, x(d[1])) + 6).attr("y", yy + 11).text(fmt(d[1]));
    }); }
  // delays
  { const d = await api(`/api/runs/${RUN.id}/delays`), el = $("p-delays"), specs = ["urine", "wound", "blood"].filter(s => d.hist[s]);
    const w = W(el), ph = 92, h = specs.length * (ph + 10) + 22, m = { l: 60, r: 10 }; el.innerHTML = "";
    const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`), x = d3.scaleLinear().domain([0, 21 * 12]).range([m.l, w - m.r]);
    specs.forEach((s, k) => {
      const hs = d.hist[s], y0 = k * (ph + 10) + ph, y = d3.scaleLinear().domain([0, d3.max(hs) || 1]).range([0, ph - 18]);
      svg.append("text").attr("class", "lab").attr("x", 0).attr("y", y0 - ph / 2).attr("fill", css("--ink")).text(s);
      hs.forEach((v, i) => svg.append("rect").attr("x", x(i * 12) + .5).attr("y", y0 - y(v)).attr("width", x(12) - x(0) - 1).attr("height", y(v)).attr("fill", css("--ink-3")).attr("fill-opacity", .7));
      const md = d.mimic_median_h[s];
      if (md) { svg.append("line").attr("x1", x(md)).attr("x2", x(md)).attr("y1", y0 - ph + 14).attr("y2", y0).attr("stroke", css("--accent")).attr("stroke-width", 1.5);
        svg.append("text").attr("class", "lab").attr("x", x(md) + 4).attr("y", y0 - ph + 22).attr("fill", css("--accent")).text(`MIMIC median ${Math.round(md)} h`); }
    });
    svg.append("g").attr("class", "axis").attr("transform", `translate(0,${h - 18})`).call(d3.axisBottom(x).tickValues([0, 24, 48, 72, 96, 120, 168, 240]).tickFormat(v => v + (v >= 240 ? "+ h" : " h")).tickSizeOuter(0)); }
}

// ---------- 4 · tables ----------
let TAB = "deliveries", FILTER = { origin: "", tag: "", q: "" }, OFFSET = 0;
const LIMIT = 50;
function renderTabs() {
  const n = RUN ? { deliveries: RUN.deliveries, cultures: RUN.final.cultures, isolates: RUN.final.isolates, susceptibility: RUN.final.susceptibility, truth: RUN.truth.length, batches: null, checks: RUN.checks.length } : {};
  const names = { deliveries: "Deliveries", cultures: "Cultures", isolates: "Isolates", susceptibility: "Susceptibility", truth: "Truth", batches: "Batches", checks: "Checks" };
  $("tabs").innerHTML = Object.entries(names).map(([k, t]) => `<button data-t="${k}" aria-pressed="${k === TAB}">${t}${n[k] != null ? `<small>${fmt(n[k])}</small>` : ""}</button>`).join("");
  chips($("origin"), [["", "All origins"], ["replayed", "Replayed"], ["new", "New"], ["injected", "Injected"]], FILTER.origin, v => { FILTER.origin = v; OFFSET = 0; renderTabs(); loadTable(); });
  const tags = RUN ? RUN.truth.map(t => t.code).filter(c => c !== "A1") : [];
  chips($("tagf"), [["", "Any scenario"], ...tags.map(t => [t, t])], FILTER.tag, v => { FILTER.tag = v; OFFSET = 0; renderTabs(); loadTable(); });
}
$("tabs").addEventListener("click", e => { const b = e.target.closest("button"); if (b) { TAB = b.dataset.t; OFFSET = 0; renderTabs(); loadTable(); } });
let qTimer; $("q").addEventListener("input", () => { clearTimeout(qTimer); qTimer = setTimeout(() => { FILTER.q = $("q").value; OFFSET = 0; loadTable(); }, 250); });
$("prev").onclick = () => { OFFSET = Math.max(0, OFFSET - LIMIT); loadTable(); };
$("next").onclick = () => { OFFSET += LIMIT; loadTable(); };
async function loadTable() {
  if (!RUN) { $("table").innerHTML = `<tr><td class="empty">Generate a dataset first.</td></tr>`; return; }
  const qs = new URLSearchParams({ ...FILTER, offset: OFFSET, limit: LIMIT });
  const d = await api(`/api/runs/${RUN.id}/table/${TAB}?${qs}`);
  const ci = c => d.columns.indexOf(c);
  $("table").innerHTML = `<thead><tr>${d.columns.map(c => `<th>${c}</th>`).join("")}</tr></thead><tbody>${d.rows.map(r => `<tr>${r.map((v, i) => {
    const col = d.columns[i], hot = (col === "tags" && String(v).split(" ").some(t => HOT.has(t) || t === "A2" || t === "A4")) || (col === "origin" && v === "injected") || (col === "ok" && v === false);
    return `<td class="${hot ? "hot" : col === "origin" && v === "new" ? "new" : ""}">${v === true ? "✓" : v === false ? "✕" : v}</td>`; }).join("")}</tr>`).join("")}</tbody>`;
  $("pageinfo").textContent = d.total ? `${fmt(OFFSET + 1)}–${fmt(Math.min(OFFSET + LIMIT, d.total))} of ${fmt(d.total)}` : "No rows";
  $("prev").disabled = OFFSET === 0; $("next").disabled = OFFSET + LIMIT >= d.total;
  const fq = new URLSearchParams(FILTER).toString();
  $("csv").href = `/api/runs/${RUN.id}/csv/${TAB}?${fq}`; $("zip").href = `/api/runs/${RUN.id}/feed.zip`;
}

// ---------- the simple view: one visual, everything already chosen ----------
const SX = { dots: [], src: null, day: -1, done: false, events: [], seen: new Set(), runId: null, raf: 0 };
const EV_NAMES = { G1: "Outbreak", G2: "Resistance starts creeping up", G3: "First-ever CPE", G6: "Sudden rise", G7: "Lab mix-up (looks like an outbreak)",
  F1: "Screening starts", D1: "New lab rules", A4: "Feed outage", A2: "Late batch" };
const sxCol = code => ["G1", "G2", "G3", "G6"].includes(code) ? css("--accent") : ["G7", "F1", "D1", "B1", "B2", "E3", "B5", "C9", "D2"].includes(code) ? css("--violet") : css("--amber");
function sxSources() {
  const sc = SRC_COLOR(), use = { tyks: "Every case", mimic: "When each result arrives", armd: "When patients come back" };
  $("sxsrc").innerHTML = META.sources.map(s => `<li style="--c:${sc[s.id]}"><i></i><b>${s.name}</b><em>✓ in use</em><span>${use[s.id]}</span></li>`).join("");
}
function sxGeom() {
  const el = $("sxvis"), w = el.clientWidth, h = el.clientHeight, m = { l: 64, r: 12, t: 10, b: 28 };
  const x = d3.scaleTime().domain([parseT(RUN.start), parseT(RUN.end)]).range([m.l, w - m.r]).clamp(true);
  const y = d3.scaleBand().domain(RUN.wards).range([m.t, h - m.b]).padding(.22);
  return { el, w, h, m, x, y };
}
function sxReset() {
  if (SX.src) { SX.src.close(); SX.src = null; }
  SX.dots = []; SX.day = -1; SX.done = false; SX.events = []; SX.seen = new Set(); SX.runId = RUN && RUN.id;
  $("sxev").innerHTML = ""; $("sxdate").textContent = RUN ? nice(parseT(RUN.start)) : "–"; $("sxplay").textContent = "Play"; sxDraw();
}
function sxPlay() {
  if (!RUN) return;
  if (SX.src) { SX.src.close(); SX.src = null; $("sxplay").textContent = "Resume"; return; }
  if (SX.done || SX.runId !== RUN.id) sxReset();
  SX.src = new EventSource(`/api/runs/${RUN.id}/live?size=day&rate=7&from=${SX.day + 1}`);
  $("sxplay").textContent = "Pause";
  SX.src.onmessage = e => sxBin(JSON.parse(e.data));
  SX.src.addEventListener("done", () => { SX.done = true; SX.src.close(); SX.src = null; $("sxplay").textContent = "Play again"; });
  SX.src.onerror = () => { if (SX.src) { SX.src.close(); SX.src = null; } $("sxplay").textContent = "Play"; };
  sxLoop();
}
function sxBin(b) {
  SX.day = b.i; const today = parseT(b.t); $("sxdate").textContent = nice(today);
  const g = sxGeom(), now = performance.now();
  b.points.forEach((p, k) => {
    if (!RUN.wards.includes(p[5])) return;
    const tag = p[4] === "A6" || p[4] === "N" ? "" : p[4];
    const col = tag ? sxCol(tag) : p[3] === "new" ? css("--cool") : css("--ink-3");
    const ty = g.y(p[5]) + g.y.bandwidth() * (.15 + .7 * Math.random());
    SX.dots.push({ ev: parseT(p[0]), kn: parseT(p[1]), ward: p[5], tag, kind: p[2], col, ty, t0: now + k * 12, r: tag ? 2.6 : 1.6 });
  });
  if (SX.dots.length > 12000) SX.dots.splice(0, SX.dots.length - 12000);
  // narrate events as the feed reaches them
  RUN.truth.forEach(t => {
    if (!EV_NAMES[t.code] || SX.seen.has(t.code) || !t.start) return;
    if (d3.timeParse("%Y-%m-%d")(t.start) <= today) {
      SX.seen.add(t.code);
      SX.events.unshift({ t: t.start, text: `${EV_NAMES[t.code]}${t.ward && t.code !== "G7" ? " · " + t.ward : ""}`, c: sxCol(t.code) });
      $("sxev").innerHTML = SX.events.slice(0, 7).map(e => `<li style="--c:${e.c}"><i></i><time>${d3.timeFormat("%d %b")(pd(e.t))}</time><span>${e.text}</span></li>`).join("");
    }
  });
  sxLoop();
}
function sxLoop() { if (!SX.raf) SX.raf = requestAnimationFrame(sxFrame); }
function sxFrame() {
  SX.raf = 0; const busy = sxDraw(); if (busy || SX.src) sxLoop();
}
let sxHover = null;
function sxDraw() {
  if (!RUN || document.body.classList.contains("adv")) return false;
  const g = sxGeom(), cv = $("sxcanvas"), dpr = devicePixelRatio || 1;
  if (cv.width !== Math.round(g.w * dpr) || cv.height !== Math.round(g.h * dpr)) { cv.width = Math.round(g.w * dpr); cv.height = Math.round(g.h * dpr); }
  const ctx = cv.getContext("2d"); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, g.w, g.h);
  ctx.font = "500 12px Inter, sans-serif"; ctx.textBaseline = "middle";
  RUN.wards.forEach(wd => {
    const yy = g.y(wd) + g.y.bandwidth() / 2, hot = sxHover && sxHover.ward === wd;
    ctx.fillStyle = hot ? css("--ink") : css("--ink-3"); ctx.textAlign = "right"; ctx.fillText(wd, g.m.l - 12, yy);
    ctx.strokeStyle = css("--line"); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(g.m.l, g.y(wd) + g.y.bandwidth() + g.y.step() * .11); ctx.lineTo(g.w - g.m.r, g.y(wd) + g.y.bandwidth() + g.y.step() * .11); ctx.stroke();
  });
  ctx.textAlign = "center"; ctx.fillStyle = css("--ink-3"); ctx.font = "400 11px Inter, sans-serif";
  g.x.ticks(d3.timeMonth.every(1)).forEach(t => ctx.fillText(d3.timeFormat("%b")(t), g.x(t), g.h - 10));
  const end = pd(META.source_range[1]);
  if (end > parseT(RUN.start) && end < parseT(RUN.end)) { ctx.fillStyle = css("--cool"); ctx.textAlign = "left"; ctx.fillText("new cases from here", g.x(end) + 6, g.h - 10);
    ctx.strokeStyle = css("--cool"); ctx.setLineDash([2, 4]); ctx.beginPath(); ctx.moveTo(g.x(end), g.m.t); ctx.lineTo(g.x(end), g.h - g.m.b); ctx.stroke(); ctx.setLineDash([]); }
  const today = SX.day >= 0 ? d3.timeDay.offset(parseT(RUN.start), SX.day + 1) : null, now = performance.now();
  let busy = false;
  for (const d of SX.dots) {
    const k = Math.max(0, Math.min(1, (now - d.t0) / 900)), e = 1 - Math.pow(1 - k, 4);
    if (k < 1) busy = true;
    const xs = g.x(d.kn), xe = g.x(d.ev), xx = xs + (xe - xs) * e;
    const dim = sxHover && sxHover.ward !== d.ward ? .25 : 1;
    ctx.globalAlpha = (d.tag ? .95 : .55) * dim * Math.min(1, k * 3); ctx.fillStyle = d.col;
    ctx.beginPath(); ctx.arc(xx, d.ty, d.r, 0, 6.283); ctx.fill();
  }
  ctx.globalAlpha = 1;
  if (today) { const tx = g.x(today); ctx.strokeStyle = css("--accent"); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(tx, g.m.t - 4); ctx.lineTo(tx, g.h - g.m.b + 4); ctx.stroke(); }
  return busy;
}
$("sxplay").addEventListener("click", sxPlay);
$("sxvis").addEventListener("pointermove", e => {
  if (!RUN) return; const g = sxGeom(), r = g.el.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
  const ward = RUN.wards.find(w => py >= g.y(w) - g.y.step() * .11 && py <= g.y(w) + g.y.bandwidth() + g.y.step() * .11);
  let best = null, bd = 64;
  for (const d of SX.dots) { if (d.ward !== ward) continue; const dx = g.x(d.ev) - px, dy = d.ty - py, dd = dx * dx + dy * dy; if (dd < bd) { bd = dd; best = d; } }
  sxHover = ward ? { ward } : null;
  const tip = $("sxtip");
  if (best) {
    const late = Math.round((best.kn - best.ev) / 864e5);
    tip.innerHTML = `<b>${best.ward}</b> · ${best.kind.replace("susceptibility", "result")}<br>sampled ${d3.timeFormat("%d %b")(best.ev)}, arrived ${late} day${late === 1 ? "" : "s"} later${best.tag && EV_NAMES[best.tag] ? `<br><b style="color:${best.col}">${EV_NAMES[best.tag]}</b>` : ""}`;
    tip.style.left = g.x(best.ev) + "px"; tip.style.top = best.ty + "px"; tip.classList.add("on");
  } else if (ward) {
    const n = SX.dots.filter(d => d.ward === ward).length;
    tip.innerHTML = `<b>${ward}</b> · ${fmt(n)} results so far`; tip.style.left = px + "px"; tip.style.top = (g.y(ward)) + "px"; tip.classList.add("on");
  } else tip.classList.remove("on");
  sxDraw();
});
$("sxvis").addEventListener("pointerleave", () => { sxHover = null; $("sxtip").classList.remove("on"); sxDraw(); });

// follow the app's theme when it changes in the admin shell's settings
addEventListener("storage", e => { if (e.key === "rl-theme" && e.newValue) setTheme(e.newValue.replace(/"/g, "")); });

// ---------- start ----------
(async function init() {
  setTheme(document.documentElement.dataset.theme);   // follows the app's theme; no switch of its own
  renderControls(); renderTabs(); loadTable();
  META = await api("/api/meta");
  RECIPE = JSON.parse(JSON.stringify(META.presets.demo.recipe));
  renderSources(); sxSources(); draw();
  const fromHash = +((location.hash.match(/step(\d)/) || [])[1] || 1);
  goStep(fromHash >= 1 && fromHash <= 6 ? fromHash : 1);
  changed();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { drawTimeline(); drawRibbon(); sxDraw(); if (RUN) { draw(); drawStatic(); } }, 200); });
})();
