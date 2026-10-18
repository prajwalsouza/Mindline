// ---------- Ask: a question box on Insights; answers stream in as text and the app's own charts ----------
// The server (ask.py) answers from its cache at once, or runs the local model and returns blocks when it finishes. Either way the
// page plays the blocks in order: words rise in, a chart's skeleton shimmers and resolves into the chart, then the next line.
let ANS_ON = false, ANS_SEQ = 0, ANS_SELECTIONS = null;
const ANS_ITEMS = {};
const ansEsc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
const ASK_ICON = '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>';
const ORG_SHORT = o => o.split(" ")[0][0] + ". " + o.split(" ").slice(-1)[0];

function askBar() {
  return `<form class="askbar" id="askbar" autocomplete="off"><span class="ai">${ASK_ICON}</span>
    <input id="askq" type="text" placeholder="Ask about this hospital's data…" aria-label="Ask a question" role="combobox" aria-autocomplete="list" aria-controls="asksug" aria-expanded="false" maxlength="300">
    <button class="ask-submit" type="submit">Ask</button><ul class="asksug" id="asksug" role="listbox" aria-label="Saved questions" hidden></ul></form>`;
}
// suggestions: earlier questions that match what is typed (they answer at once, from the cache)
let sugT = 0, sugI = -1;
async function askSuggest() {
  const q = $("askq").value, my = ++sugT;
  const r = await api(`/api/app/ask/suggest?q=${encodeURIComponent(q)}`).catch(() => ({ q: [] }));
  if (my !== sugT || !$("askq") || document.activeElement !== $("askq")) return;
  const ul = $("asksug"); sugI = -1; $("askq").removeAttribute("aria-activedescendant");
  ul.innerHTML = r.q.map((s, i) => `<li id="ask-option-${i}" role="option" aria-selected="false" data-q="${ansEsc(s)}">${ansEsc(s)}</li>`).join("");
  ul.hidden = !r.q.length; $('askq').setAttribute('aria-expanded', String(!ul.hidden));

}
document.addEventListener("input", e => { if (e.target.id === "askq") askSuggest(); });
document.addEventListener("focusin", e => { if (e.target.id === "askq") askSuggest(); });
document.addEventListener("focusout", e => { if (e.target.id === "askq") setTimeout(() => { const ul = $("asksug"); if (ul) ul.hidden = true; $("askq")?.setAttribute("aria-expanded", "false"); }, 150); });
document.addEventListener("keydown", e => {
  if (e.target.id !== "askq") return;
  const items = [...document.querySelectorAll("#asksug li")];
  if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); if (!items.length) return; sugI = sugI < 0 ? (e.key === "ArrowDown" ? 0 : items.length - 1) : (sugI + (e.key === "ArrowDown" ? 1 : -1) + items.length) % items.length; items.forEach((li, i) => { li.classList.toggle("on", i === sugI); li.setAttribute("aria-selected", String(i === sugI)); }); $("askq").setAttribute("aria-activedescendant", items[sugI].id); $("askq").value = items[sugI].dataset.q; }
  if (e.key === "Escape") { $("asksug").hidden = true; $("askq").setAttribute("aria-expanded", "false"); }
});
document.addEventListener("mousedown", e => { const li = e.target.closest("#asksug li"); if (li) { e.preventDefault(); $("askq").value = li.dataset.q; $("asksug").hidden = true; openAnswer(li.dataset.q); } });
document.addEventListener("submit", e => { if (e.target.id !== "askbar") return; e.preventDefault(); const q = $("askq").value.trim(); if (q) { $("asksug").hidden = true; openAnswer(q); } });
document.addEventListener("click", e => {
  if (e.target.closest(".ans-back")) return closeAnswer();
  const f = e.target.closest(".ans-follow [data-q]"); if (f) { $("askq").value = f.dataset.q; openAnswer(f.dataset.q); }
});

function resetAnswer() {
  $('itip')?.classList.remove('on');
  if (ANS_ON) $('clockpill').hidden = false;
  $('page').classList.remove('ask-answer');
  ANS_SEQ++; sugT++; ANS_ON = false;
  document.querySelectorAll("#ins [id$='-page']").forEach(n => { n.id = n.id.replace(/-page$/, ""); });
  if (ANS_SELECTIONS) { Object.keys(ISEL).forEach(k => delete ISEL[k]); Object.assign(ISEL, ANS_SELECTIONS); ANS_SELECTIONS = null; }
  Object.keys(ANS_ITEMS).forEach(k => delete ANS_ITEMS[k]);
}
function closeAnswer() {
  resetAnswer();
  if (!$("ans")) return;
  $("ans").hidden = true; $("ans").innerHTML = ""; $("ins").hidden = false;
  $("askq").value = "";
  // Refresh the overview if the simulation clock moved while this dated answer was open.
  renderInsights();
  scrollTo({ top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
}
async function openAnswer(q) {
  resetAnswer();
  ANS_SELECTIONS = JSON.parse(JSON.stringify(ISEL));
  const my = ++ANS_SEQ; ANS_ON = true;
  $('page').classList.add('ask-answer'); $('clockpill').hidden = true;
  insIO?.disconnect(); insGIO?.disconnect();
  $("ins").hidden = true; if ($("insmenu")) $("insmenu").hidden = true;
  $("askq").setAttribute("aria-expanded", "false");
  const el = $("ans"); el.hidden = false;
  el.innerHTML = `<button class="ans-back" type="button">Back to Insights</button><h2 class="ans-q">${ansEsc(q)}</h2><p class="ans-meta" id="ansmeta" role="status"></p><div class="ans-body" id="ansbody" aria-busy="true"></div>`;
  window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + scrollY - 90), behavior: reduceMotion() ? "auto" : "smooth" });
  const body = $("ansbody"), meta = $("ansmeta");
  body.innerHTML = `<div class="ans-think"><span class="sk w80"></span><span class="sk w60"></span><span class="sk w70"></span><div class="sk viz"></div></div>`;
  let r = await api("/api/app/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ q }) }).catch(e => ({ status: "error", error: e.message }));
  if (my !== ANS_SEQ) return;
  let played = 0;
  const show = async () => {
    if (!(r.blocks || []).length || my !== ANS_SEQ) return;
    if (!played) body.innerHTML = "";
    meta.textContent = `Synthetic demo data up to ${niceDate(r.asof)} · ${r.cached ? "Saved answer" : "Generated answer"}`;
    el.dataset.asof = r.asof;
    const next = r.blocks.slice(played); played = r.blocks.length;
    await playBlocks(next, body, my);
  };
  if (r.status === "running") {
    const jid = r.id;
    meta.textContent = "Reading the figures…";
    while (my === ANS_SEQ && r.status === "running") {
      await show();
      await new Promise(res => setTimeout(res, 900));
      if (my !== ANS_SEQ) return;
      r = await api(`/api/app/ask/job?id=${jid}`).catch(e => ({ status: "error", error: e.message }));
    }
    if (my !== ANS_SEQ) return;
  }
  body.setAttribute("aria-busy", "false");
  if (r.status === "nocache") {
    meta.textContent = "Saved demo answers";
    body.innerHTML = `<p class="ans-t">This demo hasn't answered that one yet. Try one of these:</p><div class="ans-follow on">${(r.suggest || []).map(s => `<button data-q="${ansEsc(s)}">${ansEsc(s)}</button>`).join("")}</div>`;
    return;
  }
  if (r.status !== "done") { meta.textContent = ""; body.innerHTML = `<p class="ans-t muted">${r.status === "stopped" ? "This answer was stopped." : `No answer: ${ansEsc(r.error || "something went wrong")}`}</p>`; return; }
  await show();
}

// the answer, one block after another
const ansMd = s => {
  const markup = ansEsc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>");
  return window.OrganismText ? OrganismText.html(markup) : markup;
};
const sleep = ms => new Promise(r => setTimeout(r, reduceMotion() ? 0 : ms));
async function playBlocks(blocks, body, my) {
  const seen = new Set();
  for (const b of blocks) {
    if (my !== ANS_SEQ) return;
    if (b.t === "text") {
      const p = document.createElement("p"); p.className = "ans-t"; body.append(p);
      let i = 0; p.innerHTML = ansMd(b.md).replace(/(<[^>]+>)|([^\s<]+)/g, (m, tag) => tag ? tag : `<span class="aw" style="--i:${i++}">${m}</span>`);
      requestAnimationFrame(() => p.classList.add("on"));
      await sleep(Math.min(2200, 120 + i * 38));
    } else if (b.t === "number") {
      const d = document.createElement("div"); d.className = "ans-num";
      d.innerHTML = `<span class="k">${ansEsc(b.label)}</span><b>${ansEsc(b.value)}</b>${b.note ? `<span class="s">${ansEsc(b.note)}</span>` : ""}`;
      body.append(d); requestAnimationFrame(() => d.classList.add("on")); await sleep(500);
    } else if (b.t === "viz") {
      if ((seen.has(b.c) || ANS_ITEMS[b.c]) && IR[b.c]) continue; seen.add(b.c);
      const box = document.createElement("div"); box.className = "ans-viz"; box.innerHTML = `<div class="sk viz"></div>`; body.append(box);
      await sleep(650);
      if (my !== ANS_SEQ) return;
      drawAnswerViz(box, b);
      await sleep(700);
    } else if (b.t === "followup" && b.q.length) {
      const d = document.createElement("div"); d.className = "ans-follow";
      d.innerHTML = `<span class="k">Ask next</span>${b.q.map(q => `<button data-q="${ansEsc(q)}">${ansEsc(q)}</button>`).join("")}`;
      body.append(d); requestAnimationFrame(() => d.classList.add("on"));
    }
  }
}
function drawAnswerViz(box, b) {
  if (IR[b.c]) {                                                   // one of the Insights charts, with the answer's own selection
    box.innerHTML = `<article class="ins-q in" id="q-${b.c}" data-id="${b.c}" data-drawn="1"><div class="graph-title-row"><p class="ans-chart-context">${IR[b.c].meta(b.data)}</p>${graphExportMenu()}</div><div class="ins-bento"><div class="ins-main" id="m-${b.c}" tabindex="0" role="region" aria-label="Interactive chart"></div><div class="ins-side" id="s-${b.c}"></div></div></article>`;
    // the page's own copy of this chart shares its ids: hide it while the answer is open
    const own = document.querySelector(`#ins #q-${b.c}`); if (own) own.id = `q-${b.c}-page`, own.querySelector(".ins-main").id = `m-${b.c}-page`, own.querySelector(".ins-side").id = `s-${b.c}-page`;
    ANS_ITEMS[b.c] = b.data;
    const p = b.p || {}, S = ISEL[b.c] = {};
    if (p.drug) S.drug = p.drug; if (p.ward) S.ward = p.ward; if (p.dim) S.dim = p.dim; if (p.a) S.a = p.a; if (p.org) S.org = ORG_SHORT(p.org);
    IR[b.c].draw(b.data);
    const hint = document.createElement("p"); hint.className = "ans-scroll-hint"; hint.textContent = "Scroll the chart sideways for more detail."; box.append(hint);
    return;
  }
  const title = {trend: "Resistance over time", drugs: "Antibiotic lab results", ward_weeks: "Resistant cases by week"}[b.c] || "Answer graph";
  box._graphExport = {title, kind: b.c, data: b.data};
  box.innerHTML = `<div class="graph-title-row"><h3>${title}</h3>${graphExportMenu()}</div><div class="ans-chart"></div>`;
  ({ trend: drawTrend, drugs: drawDrugRows, ward_weeks: drawWardWeeks })[b.c]?.(box.querySelector('.ans-chart'), b.data);
}
// ---------- charts only answers use ----------
// resistant share by month over two years, with a soft band for small months
function drawTrend(el, d) {
  const ser = d.series.filter(m => m.n >= 10), W = 760, H = 240, svg = iSvg(el, W, H);
  if (!ser.length) { el.innerHTML = `<p class="muted">Too few results to draw.</p>`; return; }
  const x = d3.scalePoint().domain(ser.map(m => m.month)).range([40, W - 20]), y = d3.scaleLinear().domain([0, d3.max(ser, m => m.r / m.n) * 1.2 || .1]).range([H - 30, 30]);
  svg.append("text").attr("class", "ix-lab").attr("x", 40).attr("y", 14).html(`<tspan fill="${css("--ink")}" font-weight="600">${ORG_SHORT(d.org)} · ${drugName(d.drug)}${d.spec ? " · " + d.spec : ""}</tspan> · resistant, by month`);
  svg.append("g").attr("class", "ix-axis").attr("transform", "translate(34,0)").call(d3.axisLeft(y).ticks(4).tickFormat(d3.format(".0%")).tickSize(0));
  const line = svg.append("path").attr("d", d3.line().x(m => x(m.month)).y(m => y(m.r / m.n)).curve(d3.curveMonotoneX)(ser)).attr("fill", "none").attr("stroke", css("--accent")).attr("stroke-width", 2.5);
  if (!reduceMotion()) { const L = line.node().getTotalLength(); line.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(1100).attr("stroke-dashoffset", 0); }
  svg.selectAll("circle").data(ser).join("circle").attr("cx", m => x(m.month)).attr("cy", m => y(m.r / m.n)).attr("r", 3).attr("fill", css("--accent"))
    .attr("data-tip", m => tipEsc(`${m.month}: <b>${m.r} of ${m.n}</b> resistant`));
  svg.selectAll("text.m").data(ser.filter((m, i) => i % 6 === 0)).join("text").attr("class", "ix-lab").attr("x", m => x(m.month)).attr("y", H - 8).attr("text-anchor", "middle").text(m => m.month);
}
// the doctor's drug list in miniature: 20 dots per drug for 12 months
function drawDrugRows(el, ab) {
  const drugs = ab.drugs.slice(0, 9), W = 760, rh = 30, H = drugs.length * rh + 40, x0 = 170, svg = iSvg(el, W, H);
  svg.append("text").attr("class", "ix-lab").attr("x", x0).attr("y", 14).html(`${ab.ward ? wardName(ab.ward) : "All wards"}${ab.sex ? ` · ${ab.sex === "F" ? "women" : "men"}` : ""}${ab.age ? " · " + ab.age : ""} · ${ab.spec} · <tspan fill="${css("--ink")}" font-weight="600">●</tspan> worked · ○ didn't, of 20`);
  drugs.forEach((d, i) => {
    const g = svg.append("g").attr("transform", `translate(0,${38 + i * rh})`).attr("data-tip", tipEsc(`<b>${cap(drugName(d.code, d.name))}</b><br>worked for ${iPct(d.year.share)} (${fmt(d.year.s)} of ${fmt(d.year.n)})${d.source === "hospital" ? "<br>hospital-wide: too few tested on the ward" : ""}`));
    g.append("rect").attr("x", 0).attr("y", -rh / 2).attr("width", W).attr("height", rh).attr("fill", "transparent");
    g.append("text").attr("class", "ix-name").attr("x", x0 - 16).attr("y", 5).attr("text-anchor", "end").text(iDrug(d.code));
    const f = Math.round(d.year.share * 20);
    g.selectAll("circle").data(d3.range(20)).join("circle").attr("cx", k => x0 + 6 + k * 24).attr("r", 0).attr("fill", k => k < f ? css("--ink") : css("--paper")).attr("stroke", k => k < f ? css("--ink") : css("--ink-3")).attr("stroke-width", 1.4)
      .call(s => iT(s).delay(k => i * 40 + k * 10).attr("r", 6));
  });
}
// one ward's new resistant cases per week over a year, by type, the types named in their colours
function drawWardWeeks(el, d) {
  const W = 760, H = 220, svg = iSvg(el, W, H), col = TYPE_COL(), types = d.types.filter(tp => d.weeks.some(w => w[tp]));
  const x = d3.scaleBand().domain(d3.range(d.weeks.length)).range([20, W - 20]).padding(.2), ymax = Math.max(3, d3.max(d.weeks, w => d3.sum(types, tp => w[tp] || 0)));
  const y = d3.scaleLinear().domain([0, ymax]).range([H - 30, 34]);
  svg.append("text").attr("class", "ix-lab").attr("x", 20).attr("y", 14).html(`<tspan fill="${css("--ink")}" font-weight="600">${wardName(d.ward)}</tspan> · new resistant cases per week · ${types.map(tp => `<tspan fill="${col[tp]}" font-weight="600">${tp}</tspan>`).join(" · ")}`);
  svg.selectAll("g.l").data(d3.stack().keys(types).value((w, k) => w[k] || 0)(d.weeks)).join("g").attr("fill", s => col[s.key])
    .selectAll("rect").data(s => s).join("rect").attr("x", (v, i) => x(i)).attr("width", x.bandwidth()).attr("rx", 1.5).attr("y", H - 30).attr("height", 0)
    .call(s => iT(s).delay((v, i) => i * 8).attr("y", v => y(v[1])).attr("height", v => Math.max(0, y(v[0]) - y(v[1]))));
  svg.selectAll("rect.hit").data(d.weeks).join("rect").attr("x", (w, i) => x(i)).attr("width", x.step()).attr("y", 20).attr("height", H - 50).attr("fill", "transparent")
    .attr("data-tip", (w, i) => tipEsc(`week ${i + 1} of 52: ${types.map(tp => `${w[tp] || 0} ${tp}`).join(", ")}`));
  if (d.usual != null) svg.append("line").attr("x1", 20).attr("x2", W - 20).attr("y1", y(d.usual)).attr("y2", y(d.usual)).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "3 4");
}

// ---------- admin: answers being written right now (stoppable) and the answers kept for reuse ----------
let ADM_T = 0;
async function renderAnswersAdmin() {
  clearTimeout(ADM_T);
  if (VIEW !== "answers") return;
  const p = $("page"), d = await api("/api/app/ask/jobs").catch(e => ({ error: e.message }));
  if (VIEW !== "answers") return;
  if (d.error) { p.innerHTML = `<p class="muted">${ansEsc(d.error)}</p>`; return; }
  const running = d.jobs.filter(j => j.status === "running");
  p.innerHTML = `<div class="dhead"><div><h1>Answers.</h1><p>Questions asked on Insights. ${d.codex && d.mode === "live" ? `New questions go to the local model <b>${d.model}</b>; stop any that run too long.` : "Cache only: new questions are not sent to a model."}</p></div></div>
    <section class="adm"><h3 class="bq">Being written now</h3>${running.length ? running.map(j => `<div class="adm-row"><span class="dot run"></span><b>${ansEsc(j.q)}</b><small>${j.seconds}s · ${j.model}</small><button class="adm-stop" data-stop="${j.id}">Stop</button></div>`).join("") : `<p class="muted">Nothing running.</p>`}</section>
    <section class="adm"><h3 class="bq">Recent</h3>${d.jobs.filter(j => j.status !== "running").slice(0, 8).map(j => `<div class="adm-row"><span class="dot ${j.status}"></span><b>${ansEsc(j.q)}</b><small>${j.status}${j.error ? ": " + ansEsc(j.error) : ""} · ${j.seconds}s</small></div>`).join("") || `<p class="muted">None yet.</p>`}</section>
    <section class="adm"><h3 class="bq">Kept for reuse · ${d.cache.length}</h3>${d.cache.map(c => `<div class="adm-row"><span class="dot done"></span><b>${ansEsc(c.q)}</b><small>asked ${c.asked}× · ${c.model || ""} · ${c.seconds ?? "–"}s · data to ${ansEsc(c.asof || "unknown")}</small><button class="adm-forget" data-forget="${ansEsc(c.key)}">Forget</button></div>`).join("") || `<p class="muted">Nothing kept yet.</p>`}</section>`;
  ADM_T = setTimeout(renderAnswersAdmin, running.length ? 1500 : 6000);
}
document.addEventListener("click", async e => {
  const s = e.target.closest("[data-stop]"); if (s) { await api("/api/app/ask/stop", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: s.dataset.stop }) }); return renderAnswersAdmin(); }
  const f = e.target.closest("[data-forget]"); if (f) { await api("/api/app/ask/forget", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: f.dataset.forget }) }); return renderAnswersAdmin(); }
});
