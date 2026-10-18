// ---------- Insights: fixed questions, answered from the data known today, one below the other ----------
// Each question is an article: the question, the answer in one sentence, its time window and how sure we are, then a
// bento row (the main chart, and borderless cards beside it that pick and preview what the chart shows), and "How we know".
// Groups and questions come from /api/app/insights, which leaves out anything the data can't answer.
const INS_T = {
  en: {
    title: "Insights.", sub: "Questions people here ask, answered from the data up to {d}. A question appears only when the data can answer it.",
    how: "How we know", clear: "Clear", possible: "Possible, could be chance", none: "No clear change", vs: "vs", to: "to", points: "percentage points",
    g_rising: "Is it really rising?", g_trust: "Can we trust the numbers?", g_linked: "Are cases linked?", g_rules: "Do our rules still hold?",
    g_patient: "For a patient like this", g_fails: "If the first choice fails", g_colleagues: "What colleagues decided",
    q_losing: "Which drugs show rising resistance?", q_volume: "More resistant results, or just more samples?", q_unusual: "Is any ward unusual for itself?",
    q_quiet: "Is a quiet week a real zero?", q_late: "Are results arriving late?", q_linked: "Are these cases more than chance?",
    q_rules: "Does resistance to one drug still predict another?", q_who: "Does who the patient is change the odds?",
    q_unknown: "Before the lab names the organism, how often does it work?", q_guide: "Is the last month a better guide than the year?",
    q_fails: "If it's resistant to one drug, what else fails?", q_colleagues: "What do colleagues start for cases like this?",
  },
  fi: {
    title: "Oivallukset.", sub: "Kysymyksiä, joita täällä kysytään, vastattuna datasta {d} asti. Kysymys näkyy vain, kun data riittää vastaukseen.",
    how: "Miten tiedämme", clear: "Selvä", possible: "Mahdollinen, voi olla sattumaa", none: "Ei selvää muutosta", vs: "vs", to: "–", points: "prosenttiyksikköä",
    g_rising: "Nouseeko se oikeasti?", g_trust: "Voiko lukuihin luottaa?", g_linked: "Liittyvätkö tapaukset toisiinsa?", g_rules: "Pitävätkö nyrkkisäännöt yhä?",
    g_patient: "Tällaiselle potilaalle", g_fails: "Jos ensimmäinen valinta ei tehoa", g_colleagues: "Mitä kollegat päättivät",
    q_losing: "Mitkä lääkkeet menettävät tehoaan?", q_volume: "Enemmän resistenttejä tuloksia vai vain enemmän näytteitä?", q_unusual: "Poikkeaako jokin osasto omasta tasostaan?",
    q_quiet: "Onko hiljainen viikko todellinen nolla?", q_late: "Tulevatko tulokset myöhässä?", q_linked: "Ovatko tapaukset enemmän kuin sattumaa?",
    q_rules: "Ennustaako resistenssi yhdelle lääkkeelle yhä toista?", q_who: "Muuttaako potilaan tausta todennäköisyyttä?",
    q_unknown: "Kuinka usein se tehoaa ennen kuin mikrobi tunnetaan?", q_guide: "Onko viime kuukausi parempi opas kuin vuosi?",
    q_fails: "Jos mikrobi kestää yhtä lääkettä, mikä muu pettää?", q_colleagues: "Mitä kollegat aloittavat tällaisissa tapauksissa?",
  },
  sv: {
    title: "Insikter.", sub: "Frågor som ställs här, besvarade med data fram till {d}. En fråga visas bara när datan kan besvara den.",
    how: "Hur vi vet", clear: "Tydlig", possible: "Möjlig, kan vara slump", none: "Ingen tydlig förändring", vs: "mot", to: "–", points: "procentenheter",
    g_rising: "Ökar det verkligen?", g_trust: "Kan vi lita på siffrorna?", g_linked: "Hänger fallen ihop?", g_rules: "Håller våra tumregler?",
    g_patient: "För en sådan patient", g_fails: "Om förstahandsvalet inte biter", g_colleagues: "Vad kollegor beslutade",
    q_losing: "Vilka läkemedel tappar mark?", q_volume: "Fler resistenta svar, eller bara fler prov?", q_unusual: "Avviker någon avdelning från sig själv?",
    q_quiet: "Är en tyst vecka en verklig nolla?", q_late: "Kommer svaren sent?", q_linked: "Är fallen mer än slump?",
    q_rules: "Förutsäger resistens mot ett läkemedel fortfarande ett annat?", q_who: "Ändrar patientens bakgrund oddsen?",
    q_unknown: "Hur ofta biter det innan labbet vet vilken mikrob det är?", q_guide: "Är senaste månaden en bättre vägledning än året?",
    q_fails: "Om den är resistent mot ett läkemedel, vad mer sviker?", q_colleagues: "Vad sätter kollegor in i sådana fall?",
  },
};
const ti = (k, v) => { let s = (INS_T[LANG] || INS_T.en)[k] ?? INS_T.en[k] ?? k; if (v) for (const [a, b] of Object.entries(v)) s = s.replaceAll(`{${a}}`, b); return s; };

let INS = null;
const ISEL = {};                                            // what each question has selected (a drug, a ward, a pair...)
const iPct = (x, d = 0) => x == null ? "–" : (x * 100).toFixed(x >= .99 && x < 1 ? Math.max(d, 1) : d) + "%";   // 99.6% never shows as 100%
const iPts = x => (x > 0 ? "+" : x < 0 ? "−" : "") + Math.abs(x * 100).toFixed(1);
const iDrug = c => { const n = cap(drugName(c)); return n.length > 18 && n.includes("-") ? n.split("-")[0].slice(0, 3) + "-" + n.split("-")[1].slice(0, 4) : n; };   // "Pip-tazo"
const iWard = c => wardName(c);
const iWin = w => `${niceDate(w.from)} – ${niceDate(w.to)}`;
const iSure = s => `<span class="sure s-${s}">${ti(s)}</span>`;
const iFmt = n => fmt(Math.round(n));
const iOnce = y => y == null ? "" : y >= 100 ? "less than once a century" : y >= 1.5 ? `about once in ${Math.round(y)} years` : y >= .75 ? "about once a year" : "several times a year";
const iOneIn = p => p <= .001 ? "less than 1 in 1,000" : p < .01 ? `about 1 in ${Math.round(1 / p / 10) * 10}` : p < .2 ? `about 1 in ${Math.round(1 / p)}` : `${Math.round(p * 100)} in 100`;
const iSvg = (el, W, H) => d3.select(el).html("").append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("preserveAspectRatio", "xMidYMid meet");
const iT = sel => sel.transition().duration(reduceMotion() ? 0 : 650).ease(d3.easeCubicOut);
// a borderless bento card: a small label, a big value, a line under it; `act` makes it pick something in the main chart
const bx = ({ k = "", v = "", s = "", cls = "", act = "", on = false, wide = false, inner = "" }) =>
  `<div class="bx ${cls}${wide ? " w" : ""}${act ? " act" : ""}${on ? " on" : ""}" ${act}>${k ? `<span class="k">${k}</span>` : ""}${v !== "" ? `<b class="v">${v}</b>` : ""}${s ? `<span class="s">${s}</span>` : ""}${inner}</div>`;

async function renderInsights(refresh) {
  const p = $("page"), role = SESSION.role === "doctor" ? "doctor" : "hygiene";
  if (!refresh || !$("ins")) {
    if (typeof resetAnswer === "function") resetAnswer();
    p.innerHTML = `<div class="dhead ins-head"><div><h1>${ti("title")}</h1><p id="insub"></p></div></div>
      ${typeof askBar === "function" ? askBar() : ""}<div class="ans" id="ans" hidden></div>
      <div class="ins" id="ins">${Array.from({ length: 2 }, () => `<div class="ins-q in"><div class="skel" style="height:34px;width:60%"></div><div class="skel" style="height:320px;margin-top:22px"></div></div>`).join("")}</div>`;
  }
  // the group menu floats over the window, so it lives in the app shell (the page has a transform, which would pin it to the page)
  if (!$("insmenu")) { const m = document.createElement("nav"); m.id = "insmenu"; m.className = "ins-menu"; m.setAttribute("aria-label", "Insight groups"); $("app").append(m); }
  $("insmenu").hidden = typeof ANS_ON !== "undefined" && ANS_ON;
  const d = await api(`/api/app/insights?role=${role}&ward=${encodeURIComponent(F.ward || "URO")}&spec=${encodeURIComponent(F.spec || "urine")}`);
  if (VIEW !== "insights") return;
  if (typeof ANS_ON !== "undefined" && ANS_ON) { INS = d; return; }   // an answer is open: leave it as asked
  const changed = !INS || INS.groups.map(g => g.items.map(i => i.id).join()).join("|") !== d.groups.map(g => g.items.map(i => i.id).join()).join("|");
  INS = d;
  $("insub").textContent = ti("sub", { d: niceDate(d.asof) }) + (d.source === "feed" ? ` · ${t("liveFeed")}` : "");
  if (changed || !refresh) {
    $("ins").innerHTML = d.groups.map(g => `<section class="ins-group" id="g-${g.id}" data-g="${g.id}"><h2 class="ins-gk">${ti("g_" + g.id)}</h2>${g.items.map(insArticle).join("")}</section>`).join("");
    $("insmenu").innerHTML = d.groups.map(g => `<button data-g="${g.id}">${ti("g_" + g.id)}</button>`).join("");
    insObserve();
  } else {                                                    // a new day from the feed: same questions, new answers, in place
    d.groups.forEach(g => g.items.forEach(it => {
      const a = $("q-" + it.id); if (!a) return;
      a.querySelector(".ins-a").innerHTML = IR[it.id].answer(it); a.querySelector(".ins-meta").innerHTML = IR[it.id].meta(it);
      if (a.dataset.drawn) IR[it.id].draw(it);
    }));
  }
}
function insArticle(it) {
  const R = IR[it.id];
  return `<article class="ins-q" id="q-${it.id}" data-id="${it.id}">
    <div class="graph-title-row"><h3 class="ins-qt">${ti("q_" + it.id)}</h3>${graphExportMenu()}</div><p class="ins-a">${R.answer(it)}</p><p class="ins-meta">${R.meta(it)}</p>
    <div class="ins-bento"><div class="ins-main" id="m-${it.id}"></div><div class="ins-side" id="s-${it.id}"></div></div>
    <details class="ins-how"><summary>${ti("how")}</summary><p>${R.how(it)}</p></details></article>`;
}
const insItem = id => (typeof ANS_ON !== "undefined" && ANS_ON && ANS_ITEMS[id]) || (INS && INS.groups.flatMap(g => g.items).find(i => i.id === id));
// scrollytelling: each question rises in and draws its charts as it arrives; the menu follows the group in view
let insIO = null, insGIO = null;
function insObserve() {
  insIO && insIO.disconnect(); insGIO && insGIO.disconnect();
  insIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    const a = e.target; a.classList.add("in");
    if (!a.dataset.drawn) { a.dataset.drawn = 1; const it = insItem(a.dataset.id); if (it) IR[it.id].draw(it); }
  }), { rootMargin: "0px 0px -12% 0px", threshold: .08 });
  document.querySelectorAll(".ins-q[data-id]").forEach(a => insIO.observe(a));
  insGIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) document.querySelectorAll("#insmenu button").forEach(b => b.classList.toggle("on", b.dataset.g === e.target.dataset.g));
  }), { rootMargin: "-40% 0px -55% 0px" });
  document.querySelectorAll(".ins-group").forEach(g => insGIO.observe(g));
  const b = document.querySelector("#insmenu button"); if (b) b.classList.add("on");
}
document.addEventListener("click", e => {
  const m = e.target.closest("#insmenu button"); if (m) { $("g-" + m.dataset.g).scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "start" }); return; }
  const c = e.target.closest(".ins-q [data-pick]"); if (!c) return;
  const a = c.closest(".ins-q"), it = insItem(a.dataset.id); if (!it) return;
  ISEL[it.id] = Object.assign(ISEL[it.id] || {}, JSON.parse(c.dataset.pick)); IR[it.id].draw(it);
});
// hovering a card previews its pick in the main chart; leaving restores the selection
document.addEventListener("pointerover", e => {
  const c = e.target.closest(".ins-q [data-peek]"); if (!c) return;
  // Side controls are replaced when a selection redraws; hovering them must not restart that redraw.
  if (c.closest(".ins-side")) return;
  const a = c.closest(".ins-q"), it = insItem(a.dataset.id); if (!it || !IR[it.id].peek) return;
  IR[it.id].peek(it, JSON.parse(c.dataset.peek));
  c.addEventListener("pointerleave", () => IR[it.id].peek(it, null), { once: true });
});
const pick = o => `data-pick='${JSON.stringify(o)}' data-peek='${JSON.stringify(o)}'`;

// one glass tooltip for every chart: details stay hidden until something is hovered
const tipEsc = s => String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
const chips = (items, on) => `<div class="chips">${items.map(([label, o, extra = ""]) => `<button type="button" class="ichip${o.org ? " organism-choice" : ""}${on(o) ? " on" : ""}" aria-pressed="${!!on(o)}" ${pick(o)}>${label}${extra}</button>`).join("")}</div>`;
(function () {
  const tip = document.createElement("div"); tip.className = "itip"; tip.id = "itip"; document.body.append(tip);
  const move = e => { const w = tip.offsetWidth; tip.style.left = Math.min(innerWidth - w - 12, Math.max(12, e.clientX - w / 2)) + "px"; tip.style.top = (e.clientY - tip.offsetHeight - 16) + "px"; };
  document.addEventListener("pointerover", e => { const el = e.target.closest && e.target.closest("#ins [data-tip], #mb [data-tip], #calpop [data-tip], #b-new [data-tip], #ans [data-tip]"); if (!el) return; tip.innerHTML = el.getAttribute("data-tip"); tip.classList.add("on"); move(e); });
  document.addEventListener("pointermove", e => { if (tip.classList.contains("on")) move(e); }, { passive: true });
  document.addEventListener("pointerout", e => { const el = e.target.closest && e.target.closest("#ins [data-tip], #mb [data-tip], #calpop [data-tip], #b-new [data-tip], #ans [data-tip]"); if (el && !el.contains(e.relatedTarget)) tip.classList.remove("on"); });
  addEventListener("scroll", () => tip.classList.remove("on"), { passive: true });
})();

// ---------- the questions ----------
const IR = {};

// Interpret the backend's adjusted difference; confidence intervals are not BH-adjusted.
const iPer100 = diff => {
  const n = Math.round(Math.abs(diff) * 1000) / 10, low = Math.floor(n), high = Math.ceil(n);
  return `${low === high ? low : `${low}–${high}`} ${diff < 0 ? "fewer" : "more"} resistant results per 100 comparable tests`;
};
function iChangeMeaning(d, floor, kind = "change") {
  if (d.sure === "clear") return kind === "difference" ? "Clear statistical difference" : `Clear statistical ${d.diff < 0 ? "decrease" : "increase"}`;
  if (Math.abs(d.diff) < floor) return "Below the app’s reporting threshold";
  return d.sure === "possible" ? "Suggestive change, not confirmed across drugs" : "Change is uncertain";
}
function iChangeGuide(d, floor, comparison, kind = "change") {
  const lim = Math.max(Math.abs(d.ci[0]), Math.abs(d.ci[1]), Math.abs(d.diff), .01) * 1.15;
  const x = v => 18 + (v + lim) / (lim * 2) * 264;
  const crosses = d.ci[0] <= 0 && d.ci[1] >= 0;
  const color = d.diff > 0 ? "var(--accent)" : "var(--ink)";
  const range = `${iPts(d.ci[0])} to ${iPts(d.ci[1])} percentage points`;
  return `<div class="i-interpret">
    <h4>How to read this</h4>
    <p>${comparison}. <b>${iPts(d.diff)} percentage points</b> means about ${iPer100(d.diff)} after matching the patient mix.</p>
    <svg class="i-ci" viewBox="0 0 300 70" role="img" aria-label="Adjusted change ${iPts(d.diff)} percentage points; 95% confidence interval ${range}; zero means no change">
      <line x1="${x(0)}" x2="${x(0)}" y1="7" y2="45" stroke="var(--ink-3)" stroke-dasharray="3 3"/>
      <line x1="${x(d.ci[0])}" x2="${x(d.ci[1])}" y1="26" y2="26" stroke="${color}" stroke-width="3"/>
      ${d.ci.map(v => `<line x1="${x(v)}" x2="${x(v)}" y1="20" y2="32" stroke="${color}" stroke-width="2"/>`).join("")}
      <circle cx="${x(d.diff)}" cy="26" r="5" fill="${color}"/>
      <text x="18" y="62">Less resistance</text><text x="150" y="62" text-anchor="middle">0 = no change</text><text x="282" y="62" text-anchor="end">More resistance</text>
    </svg>
    <p><b>95% confidence interval: ${range}.</b> The dot is the estimate; the line shows its uncertainty. ${crosses ? "The range includes zero: these results do not rule out no change." : "The range stays on one side of zero."}</p>
    <p><b>${iChangeMeaning(d, floor, kind)}.</b> “Clear” requires evidence after checking all drugs and a change of at least ${floor * 100} percentage ${floor === .01 ? "point" : "points"}. This is an app reporting rule, not a clinical high/low boundary.</p>
  </div>`;
}

// · Which drugs are losing ground? raw shares per year (left), the like-with-like change with its interval (right)
IR.losing = {
  answer(it) {
    const up = it.drugs.filter(d => d.sure === "clear" && d.diff > 0);
    const down = it.drugs.filter(d => d.sure === "clear" && d.diff < 0);
    if (up.length) return `<b>${iDrug(up[0].drug)}</b> resistance rose by <b class="acc">${Math.abs(up[0].diff * 100).toFixed(1)} ${ti("points")}</b> after matching the patient mix — about ${iPer100(up[0].diff)}.${down.length ? ` Resistance fell for ${down.map(d => iDrug(d.drug)).join(", ")}.` : ""}`;
    return `No drug meets the criteria for a clear rise in resistance. The ranges below show what remains uncertain.`;
  },
  meta: it => `Hospital-wide · First ${it.org} from ${it.spec} per patient · ${iWin(it.windows[0])} ${ti("vs")} ${iWin(it.windows[it.windows.length - 1])}`,
  how: it => `Each year counts the first ${it.org} from ${it.spec} per patient, tested on that drug. Raw percentages describe the observed tests. Adjusted percentages compare the earliest and latest windows using the same sex, age-group (under 65 or 65+) and ward mix, restricted to groups present in both windows (direct standardisation). This accounts for those measured differences in who was sampled, not every possible cause. Error bars are ordinary 95% confidence intervals for the adjusted difference, calculated with a normal approximation; they are not adjusted for multiple comparisons. A “clear” result requires a change of at least 1 percentage point and a Benjamini–Hochberg adjusted p-value below 0.05 across ${it.drugs.length} drugs. This helps limit false signals when many drugs are checked. The size rule is an app reporting choice, not a clinical threshold. Calendar-year changes in EUCAST breakpoints are not ruled out.`,
  draw(it) {
    const S = ISEL.losing = ISEL.losing || {}; if (!it.drugs.some(d => d.drug === S.drug)) S.drug = (it.drugs.find(d => d.sure === "clear") || it.drugs[0]).drug;
    const W = 760, rh = 36, H = it.drugs.length * rh + 72, x0 = 150, x1 = 450, f0 = 515, f1 = 740;
    const svg = iSvg($("m-losing"), W, H).attr("role", "img").attr("aria-label", "Observed resistance rates and adjusted changes, with 95% confidence intervals"), max = Math.min(1, d3.max(it.drugs, d => d3.max(d.years, y => y.share)) * 1.1) || .1;
    const x = d3.scaleLinear().domain([0, max]).range([x0, x1]), lim = d3.max(it.drugs, d => Math.max(Math.abs(d.ci[0]), Math.abs(d.ci[1]))) * 1.1 || .01;
    const fx = d3.scaleLinear().domain([-lim, lim]).range([f0, f1]);
    svg.append("text").attr("class", "ix-lab").attr("x", x0).attr("y", 12).text("Observed resistance · earliest → latest");
    svg.append("text").attr("class", "ix-lab").attr("x", fx(0)).attr("y", 12).attr("text-anchor", "middle").text("Adjusted change · percentage points");
    svg.append("line").attr("x1", fx(0)).attr("x2", fx(0)).attr("y1", 22).attr("y2", H - 27).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "3 3").attr("stroke-width", 1.5);
    const col = d => d.sure === "clear" ? (d.diff > 0 ? css("--accent") : css("--cool")) : css("--ink-3");
    const g = svg.selectAll("g.row").data(it.drugs).join("g").attr("class", "row ix-row").attr("transform", (d, i) => `translate(0,${38 + i * rh})`)
      .attr("data-pick", d => JSON.stringify({ drug: d.drug })).attr("data-peek", d => JSON.stringify({ drug: d.drug }))
      .attr("data-tip", d => tipEsc(`<b>${iDrug(d.drug)}</b><br>Observed resistance: ${d.years.map(y => `${y.r}/${y.n} (${iPct(y.share, 1)})`).join(" → ")}<br>Adjusted change: ${iPts(d.diff)} percentage points<br>95% confidence interval: ${iPts(d.ci[0])} ${ti("to")} ${iPts(d.ci[1])} percentage points<br>${iChangeMeaning(d, .01)}`)).style("opacity", 0);
    g.append("rect").attr("x", 0).attr("y", -rh / 2).attr("width", W).attr("height", rh).attr("fill", "transparent");
    g.append("text").attr("class", d => "ix-name" + (d.drug === S.drug ? " on" : "")).attr("x", x0 - 16).attr("y", 5).attr("text-anchor", "end").text(d => iDrug(d.drug));
    g.append("line").attr("x1", d => x(d.years[0].share)).attr("x2", d => x(d.years[0].share)).attr("stroke", col).attr("stroke-width", 3).attr("stroke-linecap", "round")
      .call(s => iT(s).delay((d, i) => 200 + i * 40).attr("x2", d => x(d.years[d.years.length - 1].share)));
    g.append("circle").attr("cx", d => x(d.years[0].share)).attr("r", 5).attr("fill", css("--paper")).attr("stroke", col).attr("stroke-width", 1.5);
    g.append("circle").attr("cx", d => x(d.years[d.years.length - 1].share)).attr("r", 5.5).attr("fill", col);
    g.append("line").attr("x1", fx(0)).attr("x2", fx(0)).attr("stroke", col).attr("stroke-width", 5).attr("stroke-linecap", "round").attr("opacity", .3)
      .call(s => iT(s).delay((d, i) => 300 + i * 40).attr("x1", d => fx(d.ci[0])).attr("x2", d => fx(d.ci[1])));
    g.append("circle").attr("cx", fx(0)).attr("r", 4.5).attr("fill", col).call(s => iT(s).delay((d, i) => 300 + i * 40).attr("cx", d => fx(d.diff)));
    [0, 1].forEach(end => g.append("line").attr("x1", d => fx(d.ci[end])).attr("x2", d => fx(d.ci[end])).attr("y1", -5).attr("y2", 5).attr("stroke", col).attr("stroke-width", 1.5));
    svg.append("g").attr("class", "ix-axis").attr("transform", `translate(0,${H - 25})`).call(d3.axisBottom(x).ticks(4).tickFormat(v => iPct(v)).tickSize(3));
    svg.append("g").attr("class", "ix-axis").attr("transform", `translate(0,${H - 25})`).call(d3.axisBottom(fx).tickValues([-lim, 0, lim]).tickFormat(v => v === 0 ? "0 · no change" : iPts(v)).tickSize(3));
    $("m-losing").insertAdjacentHTML("beforeend", `<p class="i-chart-key">Each drug is compared with its own earlier results. Open dot: earliest window. Filled dot: latest window. Right-hand dot: adjusted change; capped line: 95% confidence interval. Left of zero means less resistance; right means more. Select a drug for its counts and explanation.</p>`);
    iT(g).delay((d, i) => i * 40).style("opacity", d => d.sure === "clear" || d.drug === S.drug ? 1 : .65);
    this.side(it, S.drug);
  },
  side(it, code) {
    const d = it.drugs.find(x => x.drug === code);
    $("s-losing").innerHTML = bx({ k: iDrug(d.drug), v: `${iPts(d.diff)} <small>${ti("points")}</small>`, s: `Adjusted change · ${iChangeMeaning(d, .01)}`, cls: "hero i-change" })
      + `<div class="i-interpret i-observed"><h4>Observed lab results</h4><p>Earliest: <b>${d.r0} of ${d.n0} (${iPct(d.raw0, 1)})</b> resistant.<br>Latest: <b>${d.r1} of ${d.n1} (${iPct(d.raw1, 1)})</b> resistant.</p><p>After matching the patient mix: ${iPct(d.adj0, 1)} → ${iPct(d.adj1, 1)}. This adjusted comparison produces the change above.</p></div>`
      + iChangeGuide(d, .01, "Latest window compared with earliest")
      + bx({ k: "Observed resistance by month", wide: true, inner: `<div class="spark" id="sp-losing"></div>` });
    const ser = d.monthly.filter(m => m.n >= 10), el = $("sp-losing"); if (!ser.length) return;
    const W = 420, H = 70, svg = iSvg(el, W, H), x = d3.scalePoint().domain(ser.map(m => m.m)).range([4, W - 4]), y = d3.scaleLinear().domain([0, d3.max(ser, m => m.r / m.n) * 1.15 || 1]).range([H - 4, 6]);
    svg.append("path").attr("d", d3.line().x(m => x(m.m)).y(m => y(m.r / m.n)).curve(d3.curveMonotoneX)(ser)).attr("fill", "none").attr("stroke", d.sure === "clear" && d.diff > 0 ? css("--accent") : css("--ink-2")).attr("stroke-width", 2);
    svg.selectAll("rect").data(ser).join("rect").attr("x", m => x(m.m) - 6).attr("width", 12).attr("y", 0).attr("height", H).attr("fill", "transparent")
      .attr("data-tip", m => tipEsc(`${m.m}: ${m.r} of ${m.n} resistant`));
  },
  peek(it, o) {
    const code = o ? o.drug : ISEL.losing.drug;
    d3.select("#m-losing").selectAll("g.row").style("opacity", d => d.drug === code || d.sure === "clear" ? 1 : .45).select(".ix-name").classed("on", d => d.drug === code);
    this.side(it, code);
  },
};

// · More resistant results, or more samples? an exact split of the change, as a waterfall
IR.volume = {
  answer(it) {
    const d = it.drugs[0], delta = d.r1 - d.r0, mostly = Math.abs(d.share) >= Math.abs(d.volume) ? (d.share >= 0 ? "a higher resistant share" : "a lower resistant share") : (d.volume >= 0 ? "more samples" : "fewer samples");
    return `<b>${iDrug(d.drug)}</b>: ${Math.abs(delta)} ${delta >= 0 ? "more" : "fewer"} resistant results than last year, mostly from <b class="acc">${mostly}</b>.`;
  },
  meta: it => `First ${it.org} from ${it.spec} per patient · ${iWin(it.windows[0])} ${ti("vs")} ${iWin(it.windows[1])}`,
  how: it => `The change in resistant results is split exactly in two: the change in how many isolates were tested (at the average resistant share of the two years) and the change in the share (at the average number tested). They add up to the whole change. Whether the share itself changed is tested with a two-proportion test, corrected across the ${it.drugs.length} drugs. Admissions and patient-days are not in the data, so this can't say whether more patients were infected.`,
  draw(it) {
    const S = ISEL.volume = ISEL.volume || {}; if (!it.drugs.some(d => d.drug === S.drug)) S.drug = it.drugs[0].drug;
    const d = it.drugs.find(x => x.drug === S.drug);
    const steps = [{ k: "Last year", a: 0, b: d.r0, c: css("--ink-3"), tip: `${d.r0} resistant of ${iFmt(d.n0)} tested` },
      { k: d.volume >= 0 ? "More samples" : "Fewer samples", a: d.r0, b: d.r0 + d.volume, c: css("--ink-3"), soft: 1, tip: `${iFmt(d.n0)} → ${iFmt(d.n1)} tested: ${d.volume >= 0 ? "+" : "−"}${Math.abs(d.volume).toFixed(0)} results` },
      { k: "Resistant share", a: d.r0 + d.volume, b: d.r1, c: d.sure !== "none" ? (d.share > 0 ? css("--accent") : css("--cool")) : css("--ink-2"), tip: `${iPct(d.p0, 1)} → ${iPct(d.p1, 1)}: ${d.share >= 0 ? "+" : "−"}${Math.abs(d.share).toFixed(0)} results · ${ti(d.sure)}` },
      { k: "This year", a: 0, b: d.r1, c: css("--ink"), tip: `${d.r1} resistant of ${iFmt(d.n1)} tested` }];
    const W = 640, H = 280, svg = iSvg($("m-volume"), W, H), x = d3.scaleBand().domain(steps.map(s => s.k)).range([20, W - 20]).padding(.42);
    const lo = d3.min(steps, s => Math.min(s.a, s.b)), hi = d3.max(steps, s => Math.max(s.a, s.b)), base = Math.max(0, lo - (hi - lo) * 1.2);
    const y = d3.scaleLinear().domain([base, hi * 1.04]).range([H - 40, 30]);
    const g = svg.selectAll("g.st").data(steps).join("g").attr("data-tip", s => tipEsc(s.tip));
    g.append("rect").attr("x", s => x(s.k)).attr("width", x.bandwidth()).attr("rx", 6).attr("fill", s => s.c).attr("opacity", s => s.soft ? .5 : 1)
      .attr("y", y(base)).attr("height", 0).call(s => iT(s).delay((s, i) => i * 160).attr("y", s => y(Math.max(s.a, s.b))).attr("height", s => Math.max(2, Math.abs(y(s.a) - y(s.b)))));
    g.filter((s, i) => i === 0 || i === 3).append("text").attr("class", "ix-num").attr("x", s => x(s.k) + x.bandwidth() / 2).attr("y", s => y(s.b) - 10).attr("text-anchor", "middle").text(s => iFmt(s.b));
    g.append("text").attr("class", "ix-lab").attr("x", s => x(s.k) + x.bandwidth() / 2).attr("y", H - 14).attr("text-anchor", "middle").attr("fill", (s, i) => i === 2 ? s.c : null).style("font-weight", (s, i) => i === 2 ? 600 : null).text(s => s.k);
    steps.slice(0, 3).forEach((s, i) => svg.append("line").attr("x1", x(s.k) + x.bandwidth()).attr("x2", x(steps[i + 1].k)).attr("y1", y(s.b)).attr("y2", y(s.b)).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "2 4"));
    $("s-volume").innerHTML = bx({ k: "Resistant results", v: `${d.r1 - d.r0 >= 0 ? "+" : "−"}${Math.abs(d.r1 - d.r0)}`, s: `${d.r0} → ${d.r1} · share ${iPct(d.p0, 1)} → ${iPct(d.p1, 1)} · ${iSure(d.sure)}`, cls: "hero" })
      + bx({ k: "Drug", wide: true, inner: chips(it.drugs.map(x => [iDrug(x.drug), { drug: x.drug }]), o => o.drug === S.drug) });
  },
  peek(it, o) { if (!o) return this.draw(it); const keep = ISEL.volume.drug; ISEL.volume.drug = o.drug; this.draw(it); ISEL.volume.drug = keep; },
};

// · Is any ward unusual for itself? each ward's count against the range its own past year would give
IR.unusual = {
  answer(it) {
    const c = it.wards.filter(w => w.sure === "clear");
    if (c.length) return `<b class="acc">${iWard(c[0].ward)}</b> is unusual for itself: <b class="acc">${c[0].n}</b> new resistant cases in 4 weeks, against about ${Math.max(1, Math.round(c[0].expected))}.`;
    const f = it.wards.filter(w => w.flagged);       // above its usual by the app's rule, but not yet clear once all wards are counted
    if (f.length) return `<b>${iWard(f[0].ward)}</b> is above its usual (${f[0].n} against about ${Math.max(1, Math.round(f[0].expected))}), but a rise like this happens by chance ${iOnce(f[0].years)}: watch the next days.`;
    return `Every ward is within its own usual range.`;
  },
  meta: it => `New ESBL, MRSA, VRE or CPE cases, first per patient and type · ${iWin(it.windows[0])} ${ti("vs")} each ward's ${iWin(it.windows[1])}`,
  how: it => `For each ward, new resistant cases in the last 4 weeks are compared with the same ward's previous 48 weeks, scaled to 4 weeks. The soft band is the range you'd see 95% of the time if nothing had changed (Poisson). "Once in N years" is how rarely a count at least this high would happen by chance. Corrected across the ${it.wards.length} wards, and fewer than 3 cases is never called unusual.`,
  draw(it) {
    const S = ISEL.unusual = ISEL.unusual || {}; if (!it.wards.some(w => w.ward === S.ward)) S.ward = it.wards[0].ward;
    const W = 700, rh = 34, H = it.wards.length * rh + 30, x0 = 170, x1 = W - 40, max = d3.max(it.wards, w => Math.max(w.n, w.range[1])) + 1;
    const x = d3.scaleLinear().domain([0, max]).range([x0, x1]), svg = iSvg($("m-unusual"), W, H);
    svg.append("text").attr("class", "ix-lab").attr("x", x0).attr("y", 12).html(`cases in 4 weeks · <tspan fill="${css("--accent")}">unusual</tspan> · <tspan fill="${css("--ink")}">above its usual</tspan> · soft band: the usual range`);
    const col = w => w.sure === "clear" ? css("--accent") : w.flagged || w.sure === "possible" ? css("--ink") : css("--ink-3");
    const g = svg.selectAll("g").data(it.wards).join("g").attr("class", "ix-row").attr("transform", (w, i) => `translate(0,${32 + i * rh})`)
      .attr("data-pick", w => JSON.stringify({ ward: w.ward })).attr("data-peek", w => JSON.stringify({ ward: w.ward }))
      .attr("data-tip", w => tipEsc(`<b>${iWard(w.ward)}</b><br>${w.n} cases · usual ${w.range[0]}–${w.range[1]}${w.n >= 1 ? `<br>by chance ${iOnce(w.years)}` : ""}${Object.keys(w.types).length ? `<br>${Object.entries(w.types).map(([k, n]) => `${n} ${k}`).join(", ")}` : ""}`))
      .style("opacity", w => w.sure !== "none" || w.ward === S.ward ? 1 : .55);
    g.append("rect").attr("x", 0).attr("y", -rh / 2).attr("width", W).attr("height", rh).attr("fill", "transparent");
    g.append("text").attr("class", w => "ix-name" + (w.ward === S.ward ? " on" : "")).attr("x", x0 - 16).attr("y", 5).attr("text-anchor", "end").text(w => iWard(w.ward));
    g.append("rect").attr("x", w => x(w.range[0])).attr("width", w => Math.max(6, x(w.range[1]) - x(w.range[0]))).attr("y", -7).attr("height", 14).attr("rx", 7).attr("fill", css("--sheet-2"));
    g.append("circle").attr("cx", x(0)).attr("r", w => w.sure === "clear" ? 8 : 5.5).attr("fill", col).call(s => iT(s).delay((w, i) => i * 50).attr("cx", w => x(w.n)));
    this.side(it, S.ward);
  },
  side(it, code) {
    const w = it.wards.find(x => x.ward === code);
    $("s-unusual").innerHTML = bx({ k: iWard(w.ward), v: `${w.n} <small>${ti("vs")} ~${Math.max(0, Math.round(w.expected))}</small>`, s: `usual ${w.range[0]}–${w.range[1]}${w.n ? ` · by chance ${iOnce(w.years)}` : ""} · ${iSure(w.sure)}`, cls: "hero" })
      + bx({ k: "52 weeks", wide: true, inner: `<div class="spark" id="sp-unusual"></div>` });
    const W = 420, H = 64, svg = iSvg($("sp-unusual"), W, H), wk = w.weekly, x = d3.scaleBand().domain(d3.range(wk.length)).range([0, W]).padding(.25), y = d3.scaleLinear().domain([0, Math.max(3, d3.max(wk))]).range([H - 2, 4]);
    svg.selectAll("rect").data(wk).join("rect").attr("x", (v, i) => x(i)).attr("width", x.bandwidth()).attr("y", v => y(v)).attr("height", v => H - 2 - y(v)).attr("rx", 1.5)
      .attr("fill", (v, i) => i >= wk.length - 4 ? (w.sure === "clear" ? css("--accent") : css("--ink")) : css("--ink-3")).attr("data-tip", (v, i) => tipEsc(`${v} case${v === 1 ? "" : "s"}, ${wk.length - i} week${wk.length - i === 1 ? "" : "s"} ago`));
  },
  peek(it, o) { const code = o ? o.ward : ISEL.unusual.ward; d3.select("#m-unusual").selectAll("g.ix-row").select(".ix-name").classed("on", w => w.ward === code); this.side(it, code); },
};

// · Is a quiet week a real zero? every culture, ward by week; a gap is a week far below the ward's own usual
IR.quiet = {
  answer(it) { const g = it.gaps[0]; return `<b>${iWard(g.ward)}</b> sent <b class="acc">${g.n === 0 ? "no" : g.n}</b> cultures in the week to ${niceDate(g.end)}: <span class="kc-acc">missing data</span>, not fewer infections.`; },
  meta: it => `All cultures, including negative and mixed growth · ${iWin(it.windows[0])}, each week against the ward's 26 weeks before it`,
  how: () => `Every culture counts, whatever it grew. Each week is compared with the median of the ward's 26 weeks before it. A week is marked when so few cultures would happen by chance less than once in 1,000 weeks (Poisson), and only for wards that usually send at least 10 a week. A gap says the data is missing or sampling stopped; it can't say which, and it is never read as resistance falling.`,
  draw(it) {
    const S = ISEL.quiet = ISEL.quiet || {}; if (!S.cell) S.cell = { ward: it.gaps[0].ward, k: it.gaps[0].k };
    const rows = it.rows, wk = it.weeks, W = 760, rh = 26, H = rows.length * rh + 34, x0 = 150, cw = (W - x0 - 4) / wk;
    const svg = iSvg($("m-quiet"), W, H);
    rows.forEach((r, i) => {
      const g = svg.append("g").attr("transform", `translate(0,${6 + i * rh})`);
      g.append("text").attr("class", "ix-name").attr("x", x0 - 14).attr("y", rh / 2 + 4).attr("text-anchor", "end").text(iWard(r.ward));
      g.selectAll("rect").data(r.cells).join("rect").attr("class", "ix-cell").attr("x", (c, j) => x0 + j * cw).attr("y", 3).attr("width", cw - 1.5).attr("height", rh - 6).attr("rx", 2)
        .attr("fill", c => c.gap ? css("--accent") : d3.interpolate(css("--paper"), css("--ink-3"))(Math.min(1, c.usual ? c.n / c.usual : 0) * .7 + .1))
        .attr("data-pick", c => JSON.stringify({ cell: { ward: r.ward, k: c.k } })).attr("data-peek", c => JSON.stringify({ cell: { ward: r.ward, k: c.k } }))
        .attr("data-tip", c => tipEsc(`<b>${iWard(r.ward)}</b>, week to ${niceDate(c.end)}<br>${c.n} cultures · usual ${Math.round(c.usual)}${c.gap ? "<br>a gap: check the source" : ""}`))
        .attr("opacity", 0).call(s => iT(s).delay((c, j) => j * 8).attr("opacity", 1));
    });
    const months = rows[0].cells.filter((c, j) => j && c.end.slice(5, 7) !== rows[0].cells[j - 1].end.slice(5, 7) && +c.end.slice(5, 7) % 3 === 1);
    svg.selectAll("text.m").data(months).join("text").attr("class", "ix-lab").attr("x", c => x0 + rows[0].cells.indexOf(c) * cw).attr("y", H - 4).text(c => niceDate(c.end).replace(/^\d+\s/, "").replace(/\s\d{4}$/, ""));
    this.side(it, S.cell);
  },
  side(it, cell) {
    const r = it.rows.find(x => x.ward === cell.ward), c = r.cells.find(x => x.k === cell.k);
    const others = it.rows.filter(x => x.ward !== cell.ward).map(x => x.cells.find(y => y.k === cell.k)), on = d3.sum(others, y => y.n), ou = d3.sum(others, y => y.usual);
    $("s-quiet").innerHTML = bx({ k: `${iWard(cell.ward)} · ${niceDate(c.end)}`, v: `${c.n} <small>${ti("vs")} ${Math.round(c.usual)}</small>`, s: `${c.gap ? "a gap: check the source" : "within reach of usual"} · other wards that week ${iFmt(on)} ${ti("vs")} ${iFmt(ou)}`, cls: "hero" + (c.gap ? " gap" : "") })
      + bx({ k: "Weekly cultures", wide: true, inner: `<div class="spark" id="sp-quiet"></div>` });
    const W = 420, H = 64, svg = iSvg($("sp-quiet"), W, H), x = d3.scaleLinear().domain([0, r.cells.length - 1]).range([4, W - 4]), y = d3.scaleLinear().domain([0, d3.max(r.cells, z => Math.max(z.n, z.usual)) * 1.1]).range([H - 6, 6]);
    svg.append("path").attr("d", d3.line().x((z, j) => x(j)).y(z => y(z.n)).curve(d3.curveMonotoneX)(r.cells)).attr("fill", "none").attr("stroke", css("--ink-2")).attr("stroke-width", 1.8);
    const j = r.cells.indexOf(c); svg.append("circle").attr("cx", x(j)).attr("cy", y(c.n)).attr("r", 5).attr("fill", c.gap ? css("--accent") : css("--ink"));
  },
  peek(it, o) { this.side(it, o ? o.cell : ISEL.quiet.cell); },
};

// · Are results arriving late? days from sample to result, per ward (live feed only)
IR.late = {
  answer: it => `Half of results arrive within <b>${it.median.toFixed(1)} days</b>; <b class="acc">${iPct(it.after7)}</b> take <span class="kc-acc">longer than a week</span>.`,
  meta: it => `Every susceptibility result received · ${iWin(it.windows[0])} · live feed`,
  how: () => `For each susceptibility result received in the last 4 weeks: the days from the sample to the result reaching us. Dots are a sample of up to 60 results per ward; the tick is the median and the faint mark the 90th percentile. A late batch is results arriving more than 10 days after their samples on the same day.`,
  draw(it) {
    const S = ISEL.late = ISEL.late || {}; S.ward = S.ward || it.wards[0].ward;
    const W = 720, rh = 32, H = it.wards.length * rh + 34, x0 = 160, x = d3.scaleLinear().domain([0, Math.min(30, d3.max(it.wards, w => w.p90) * 1.2)]).range([x0, W - 20]).clamp(true);
    const svg = iSvg($("m-late"), W, H);
    const g = svg.selectAll("g").data(it.wards).join("g").attr("class", "ix-row").attr("transform", (w, i) => `translate(0,${18 + i * rh})`).attr("data-pick", w => JSON.stringify({ ward: w.ward })).attr("data-peek", w => JSON.stringify({ ward: w.ward }))
      .attr("data-tip", w => tipEsc(`<b>${iWard(w.ward)}</b><br>median ${w.median.toFixed(1)} days · 9 in 10 within ${w.p90.toFixed(1)}<br>${iPct(w.late)} over a week, of ${iFmt(w.n)}`));
    g.append("rect").attr("x", 0).attr("y", -rh / 2).attr("width", W).attr("height", rh).attr("fill", "transparent");
    g.append("text").attr("class", w => "ix-name" + (w.ward === S.ward ? " on" : "")).attr("x", x0 - 14).attr("y", 5).attr("text-anchor", "end").text(w => iWard(w.ward));
    g.selectAll("circle").data(w => w.sample).join("circle").attr("cx", v => x(v)).attr("cy", (v, i) => ((i * 7) % 11) - 5).attr("r", 2.2).attr("fill", v => v > 7 ? css("--accent") : css("--ink-3")).attr("opacity", .7);
    g.append("line").attr("x1", w => x(w.median)).attr("x2", w => x(w.median)).attr("y1", -10).attr("y2", 10).attr("stroke", css("--ink")).attr("stroke-width", 2.5);
    svg.append("g").attr("class", "ix-axis").attr("transform", `translate(0,${H - 8})`).call(d3.axisBottom(x).ticks(5).tickFormat(v => v + " d").tickSize(0));
    $("s-late").innerHTML = bx({ k: "All wards", v: `${it.median.toFixed(1)} <small>days</small>`, s: `median, sample to result · ${iPct(it.after7)} over a week · ${iFmt(it.n)} results`, cls: "hero" })
      + (it.batches.length ? bx({ k: "Late batches", wide: true, inner: chips(it.batches.map(b => [`${b.n} from ${iWard(b.ward)}`, { ward: b.ward }]), o => o.ward === S.ward) }) : "");
  },
  peek(it, o) { const code = o ? o.ward : ISEL.late.ward; d3.select("#m-late").selectAll(".ix-name").classed("on", w => w.ward === code); },
};

// · Are these cases more than chance? the cases on a year's timeline; how rare their pattern is; how tightly they bunch
IR.linked = {
  answer(it) {
    const c = it.clusters[0], rare = c.pool ? c.match / c.pool < .2 : false;
    if (c.sure === "clear" && rare) return `These <b>${c.n} ${c.flags.join("/")} ${c.organism}</b> cases look linked: a rare pattern, <b class="acc">bunched in time</b>.`;
    if (c.sure === "clear") return `These <b>${c.n} ${c.flags.join("/")} ${c.organism}</b> cases bunch in time, but their pattern is common.`;
    return `No sign these <b>${c.n} ${c.flags.join("/")} ${c.organism}</b> cases are linked: ${rare ? "a rare pattern, but" : "a common pattern and"} ordinary timing.`;
  },
  meta: it => `Resistant cases with the same organism and pattern · ${iWin(it.windows[0])}`,
  how: () => `Rarity: among this year's first isolates of the organism that were tested on the same drugs, how many share the exact resistance pattern. Bunching: the most cases in any 4 weeks, compared with 1,999 random reshuffles of the same number of cases across the year (a scan test); "1 in N" is how often chance bunches them at least this tightly. Filled dots were sampled on day 3 or later of the stay. Strain typing and contact data would be needed to confirm a link.`,
  draw(it) {
    const S = ISEL.linked = ISEL.linked || {}; if (S.i == null || S.i >= it.clusters.length) S.i = 0;
    const c = it.clusters[S.i], W = 760, H = 220, x0 = 10, x1 = W - 10, end = new Date(INS.asof), start = new Date(end - 364 * 864e5);
    const x = d3.scaleTime().domain([start, end]).range([x0, x1]), svg = iSvg($("m-linked"), W, H);
    const bw = (x1 - x0) / 52, yb = d3.scaleLinear().domain([0, d3.max(c.background) || 1]).range([0, 46]);
    svg.selectAll("rect.bg").data(c.background).join("rect").attr("x", (v, i) => x0 + i * bw).attr("width", bw - 1.5).attr("y", v => H - 24 - yb(v)).attr("height", v => yb(v)).attr("rx", 1.5).attr("fill", css("--sheet-2"))
      .attr("data-tip", (v, i) => tipEsc(`${v} ${c.organism} that week, any pattern`));
    if (c.dense) svg.append("rect").attr("x", x(new Date(c.dense[0])) - 6).attr("width", Math.max(12, x(new Date(c.dense[1])) - x(new Date(c.dense[0])) + 12)).attr("y", 6).attr("height", H - 34).attr("rx", 10)
      .attr("fill", css("--accent")).attr("opacity", .07).attr("data-tip", tipEsc(`busiest 4 weeks: ${c.in28} cases`));
    if (c.dense) svg.append("text").attr("class", "ix-lab").attr("x", x(new Date(c.dense[1])) + 6).attr("y", 20).attr("text-anchor", "end").attr("fill", css("--accent")).style("font-weight", 600).text("busiest 4 weeks");
    svg.append("text").attr("class", "ix-lab").attr("x", x0).attr("y", 20).text("● sampled on day 3+ of the stay   ○ earlier or outpatient");
    const stack = {};
    const dots = c.cases.map(k => { const wk = Math.floor((new Date(k.date) - start) / 6048e5); stack[wk] = (stack[wk] || 0) + 1; return { ...k, j: stack[wk] - 1 }; });
    const inDense = k => c.dense && k.date >= c.dense[0] && k.date <= c.dense[1];
    svg.selectAll("circle.cs").data(dots).join("circle").attr("class", "cs").attr("cx", k => x(new Date(k.date))).attr("cy", k => H - 92 - k.j * 15).attr("r", 0)
      .attr("fill", k => (k.hday || 0) >= 3 ? (inDense(k) ? css("--accent") : css("--ink")) : css("--paper")).attr("stroke", k => inDense(k) ? css("--accent") : css("--ink")).attr("stroke-width", 2)
      .attr("data-tip", k => tipEsc(`${iWard(k.ward)} · ${niceDate(k.date)}${k.hday ? ` · day ${k.hday} of the stay` : ""}`))
      .call(s => iT(s).delay((k, i) => i * 30).attr("r", 6));
    svg.append("g").attr("class", "ix-axis").attr("transform", `translate(0,${H - 16})`).call(d3.axisBottom(x).ticks(4).tickFormat(d3.timeFormat("%b")).tickSize(0));
    $("s-linked").innerHTML = bx({ k: "Same pattern", v: `${c.match} <small>of ${iFmt(c.pool)}</small>`, s: `${c.organism} tested on the same drugs · ${c.pool && c.match / c.pool < .2 ? "a rare pattern" : "a common pattern"}`, cls: "hero" })
      + bx({ k: "Bunched by chance", v: iOneIn(c.p), s: `${c.in28} cases in the busiest 4 weeks · ${iSure(c.sure)}` })
      + bx({ k: "Wards", inner: chips(c.wards.map(([w, n]) => [iWard(w), { ward: w }, ` <b>${n}</b>`]), () => false) })
      + (it.clusters.length > 1 ? bx({ k: "Cluster", wide: true, inner: chips(it.clusters.map((k, i) => [`${k.flags.join("/")} ${k.organism}`, { i }]), o => o.i === S.i) }) : "");
  },
  peek(it, o) { d3.select("#m-linked").selectAll("circle.cs").attr("opacity", k => !o || o.i != null || k.ward === o.ward ? 1 : .15); },
};

// · Do our rules still hold? the same 20-dot rows as the doctor's view, before and now
IR.rules = {
  answer(it) {
    const p = it.pairs[0], q = `"if ${drugName(p.a)} fails, ${drugName(p.b)} fails too"`;
    if (p.state === "gone") return `Recent results <b class="acc">do not show the earlier association</b>: ${q}.`;
    if (p.state === "weaker") return `The rule ${q} <b class="acc">is weaker</b> than it was.`;
    return `The tracked associations remain supported in these data.`;
  },
  meta: it => `First ${it.org} from ${it.spec} per patient · ${iWin(it.windows[0])} ${ti("vs")} ${iWin(it.windows[1])}`,
  how: it => `A rule is a pair of drugs whose resistance went together in the earlier period: an odds ratio of at least 1.5 with its interval above 1, and the second drug failing in 10–90% of cases when the first failed. For each of the ${it.n_rules} rules, the odds ratio now is compared with before (a ratio of odds ratios), corrected across all of them. A faded rule is a reason to recheck a local habit, not proof that the bacteria changed.`,
  draw(it) {
    const S = ISEL.rules = ISEL.rules || {}; if (S.i == null || S.i >= it.pairs.length) S.i = 0;
    const p = it.pairs[S.i], W = 760, H = 210, svg = iSvg($("m-rules"), W, H);
    [["Before", p.before, 20], ["Now", p.now, 410]].forEach(([lab, v, ox], k) => {
      const g = svg.append("g").attr("transform", `translate(${ox},0)`);
      g.append("text").attr("class", "ix-big").attr("x", 0).attr("y", 28).text(lab);
      [[`when ${drugName(p.a)} fails`, v.cond[0], v.n[0], css("--accent")], [`when ${drugName(p.a)} works`, v.cond[1], v.n[1], css("--ink-3")]].forEach(([t2, share, n, c], r) => {
        const y = 92 + r * 64, f = Math.round(share * 20);
        g.append("text").attr("class", "ix-lab").attr("x", 0).attr("y", y - 18).attr("fill", r === 0 ? css("--accent") : null).style("font-weight", r === 0 ? 600 : null).text(`${cap(drugName(p.b))} fails ${t2}`);
        const row = g.append("g").attr("data-tip", tipEsc(`${cap(drugName(p.b))} fails ${t2}: <b>${iPct(share)}</b> of ${iFmt(n)}`));
        row.append("rect").attr("x", -4).attr("y", y - 10).attr("width", 320).attr("height", 20).attr("fill", "transparent");
        row.selectAll(null).data(d3.range(20)).join("circle").attr("cx", i => 8 + i * 15.5).attr("cy", y).attr("r", 0).attr("fill", i => i < f ? c : css("--paper")).attr("stroke", i => i < f ? c : css("--line")).attr("stroke-width", 1.4)
          .call(s => iT(s).delay(i => k * 300 + r * 120 + i * 14).attr("r", 5.4));
      });
    });
    svg.append("line").attr("x1", 380).attr("x2", 380).attr("y1", 14).attr("y2", H - 14).attr("stroke", css("--line"));
    $("s-rules").innerHTML = bx({ k: `${cap(drugName(p.b))} resistance when ${drugName(p.a)} is resistant`, v: `${iPct(p.before.cond[0])} → ${iPct(p.now.cond[0])}`, s: `before ${ti("vs")} now · <span class="st st-${p.state}">${p.state === "gone" ? "earlier difference not clear now" : p.state}</span> · ${it.n_rules} pairs tracked`, cls: "hero" })
      + bx({ k: "Rule", wide: true, inner: chips(it.pairs.map((q, i) => [`${cap(drugName(q.a))} → ${drugName(q.b)}`, { i }, ` <i class="dot st-${q.state}"></i>`]), o => o.i === S.i) });
  },
  peek(it, o) { if (!o) return this.draw(it); const keep = ISEL.rules.i; ISEL.rules.i = o.i; this.draw(it); ISEL.rules.i = keep; },
};

// · Does who the patient is change the odds? two dots per drug, the patient's own group filled
IR.who = {
  answer(it) {
    for (const dim of ["sex", "age"]) {
      const v = it.dims[dim]; if (!v) continue;
      const c = v.drugs.filter(d => d.sure === "clear").sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0]; if (!c) continue;
      const [l0, l1] = dim === "sex" ? ["women", "men"] : ["patients under 65", "patients 65+"];
      return `For <b>${drugName(c.drug)}</b>, resistance is <b class="acc">${Math.abs(c.diff * 100).toFixed(1)} ${ti("points")}</b> higher among ${c.diff > 0 ? l1 : l0} after matching the patient mix.`;
    }
    return `No clear difference by sex or age is established here. This does not rule out a difference.`;
  },
  meta: it => `First ${it.org} from ${it.spec} per patient · ${iWin(it.windows[0])}`,
  how: it => `Two years of the first ${it.org} from ${it.spec} per patient. Women and men are compared after giving both the same age-group and ward mix; under 65 and 65+ after the same sex and ward mix (direct standardisation). The displayed 95% confidence interval uses a normal approximation and is not corrected for multiple comparisons. “Clear” requires a Benjamini–Hochberg adjusted p-value below 0.05 across drugs and a difference of at least 2 percentage points. This is an app reporting rule, not a clinical threshold. This describes groups, not this patient's own risk, and it doesn't say sex or age causes resistance.`,
  draw(it) {
    const S = ISEL.who = ISEL.who || {}; S.dim = it.dims[S.dim] ? S.dim : Object.keys(it.dims)[0];
    const v = it.dims[S.dim]; if (!v.drugs.some(d => d.drug === S.drug)) S.drug = (v.drugs.filter(d => d.sure === "clear").sort((a, b) => Math.abs(b.diff) - Math.abs(a.diff))[0] || v.drugs[0]).drug;
    const mine = S.dim === "sex" ? (F.sex === "M" ? 1 : 0) : (F.age === "65+" ? 1 : F.age === "<65" ? 0 : -1);
    const W = 700, rh = 30, H = v.drugs.length * rh + 40, x0 = 160, max = d3.max(v.drugs, d => Math.max(d.adj0, d.adj1)) * 1.12 || .1;
    const x = d3.scaleLinear().domain([0, max]).range([x0, W - 30]), svg = iSvg($("m-who"), W, H);
    const labs = S.dim === "sex" ? ["Women", "Men"] : ["Under 65", "65+"];
    svg.append("text").attr("class", "ix-lab").attr("x", x0).attr("y", 12).html(`○ ${labs[0]}   ● ${labs[1]}   · <tspan fill="${css("--accent")}" font-weight="600">a clear difference</tspan>${mine >= 0 ? `   · this patient: ${labs[mine].toLowerCase()}` : ""}`);
    const g = svg.selectAll("g").data(v.drugs).join("g").attr("class", "ix-row").attr("transform", (d, i) => `translate(0,${34 + i * rh})`).attr("data-pick", d => JSON.stringify({ drug: d.drug })).attr("data-peek", d => JSON.stringify({ drug: d.drug }))
      .attr("data-tip", d => tipEsc(`<b>${iDrug(d.drug)}</b><br>${labs[0]} ${iPct(d.adj0, 1)} · ${labs[1]} ${iPct(d.adj1, 1)}<br>Adjusted difference: ${iPts(d.diff)} percentage points<br>95% confidence interval: ${iPts(d.ci[0])} ${ti("to")} ${iPts(d.ci[1])} percentage points<br>${iChangeMeaning(d, .02, "difference")}`))
      .style("opacity", d => d.sure === "clear" || d.drug === S.drug ? 1 : .4);
    g.append("rect").attr("x", 0).attr("y", -rh / 2).attr("width", W).attr("height", rh).attr("fill", "transparent");
    g.append("text").attr("class", d => "ix-name" + (d.drug === S.drug ? " on" : "")).attr("x", x0 - 16).attr("y", 5).attr("text-anchor", "end").text(d => iDrug(d.drug));
    const col = d => d.sure === "clear" ? css("--accent") : css("--ink-3");
    g.append("line").attr("x1", d => x(d.adj0)).attr("x2", d => x(d.adj0)).attr("stroke", col).attr("stroke-width", 2.5).call(s => iT(s).delay((d, i) => i * 40).attr("x2", d => x(d.adj1)));
    g.append("circle").attr("cx", d => x(d.adj0)).attr("r", 6).attr("fill", css("--paper")).attr("stroke", col).attr("stroke-width", 2);
    g.append("circle").attr("cx", d => x(d.adj0)).attr("r", 6).attr("fill", col).call(s => iT(s).delay((d, i) => i * 40).attr("cx", d => x(d.adj1)));
    this.side(it, S.drug);
  },
  side(it, code) {
    const S = ISEL.who, v = it.dims[S.dim], d = v.drugs.find(x => x.drug === code), labs = S.dim === "sex" ? ["Women", "Men"] : ["Under 65", "65+"];
    $("s-who").innerHTML = bx({ k: iDrug(d.drug), v: `${iPts(d.diff)} <small>${ti("points")}</small>`, s: `${labs[1]} ${ti("vs")} ${labs[0].toLowerCase()} · adjusted resistance: ${iPct(d.adj1, 1)} ${ti("vs")} ${iPct(d.adj0, 1)}`, cls: "hero i-change" })
      + iChangeGuide(d, .02, `${labs[1]} compared with ${labs[0].toLowerCase()}`, "difference")
      + bx({ k: "Compare", wide: true, inner: chips(Object.keys(it.dims).map(k => [k === "sex" ? "By sex" : "By age", { dim: k }]), o => o.dim === S.dim) });
  },
  peek(it, o) { if (o && o.dim) return; const code = o ? o.drug : ISEL.who.drug; d3.select("#m-who").selectAll(".ix-name").classed("on", d => d.drug === code); this.side(it, code); },
};

// · Before the lab names the organism: works for every organism grown, fails for one, or not tested; an organism tick on top
IR.unknown = {
  answer(it) {
    const d = it.drugs[0], ec = d.by_org["E. coli"];
    return `Before the lab names it, <b>${drugName(d.drug)}</b> works <b>${iPct(d.works / d.n)}</b> of the time${ec ? `; <span class="kc-acc">${iPct(ec.works)} once it's E. coli</span>` : ""}.`;
  },
  meta: it => `First positive ${it.spec} culture per patient, ${it.scope === "ward" ? iWard(it.ward) : "whole hospital"} · ${iWin(it.windows[0])} · ${iFmt(it.n)} cultures`,
  how: it => `The first positive ${it.spec} culture per patient in the last year (on the ward, or hospital-wide when the ward has fewer than 200). A culture counts as "works" only if every organism grown was susceptible, "fails" if any was resistant, and "not tested" if a result is missing, which is kept as unknown, not counted as working. The tick shows the same drug once the chosen organism is known (at least 20 tested). This is laboratory susceptibility, not the chance of curing an infection.`,
  draw(it) {
    const S = ISEL.unknown = ISEL.unknown || {}; if (S.org === undefined) S.org = it.organisms[0]?.org || null;
    const W = 720, rh = 32, H = it.drugs.length * rh + 34, x0 = 160, x1 = W - 20, x = d3.scaleLinear().domain([0, 1]).range([x0, x1]), svg = iSvg($("m-unknown"), W, H);
    svg.append("text").attr("class", "ix-lab").attr("x", x0).attr("y", 12).html(`<tspan fill="${css("--ink-2")}">works</tspan> · <tspan fill="${css("--accent")}">fails</tspan> · not tested${S.org ? `   <tspan fill="${css("--accent")}">| once it's ${S.org}</tspan>` : ""}`);
    const g = svg.selectAll("g").data(it.drugs).join("g").attr("transform", (d, i) => `translate(0,${32 + i * rh})`)
      .attr("data-tip", d => tipEsc(`<b>${iDrug(d.drug)}</b><br>works ${iPct(d.works / d.n)} · fails ${iPct(d.fails / d.n)} · not tested ${iPct(d.untested / d.n)}${S.org && d.by_org[S.org] ? `<br>once it's ${S.org}: works ${iPct(d.by_org[S.org].works)}` : ""}`));
    g.append("text").attr("class", "ix-name").attr("x", x0 - 16).attr("y", 5).attr("text-anchor", "end").text(d => iDrug(d.drug));
    const seg = d => [[0, d.works / d.n, css("--ink-3"), .55], [d.works / d.n, (d.works + d.fails) / d.n, css("--accent"), 1], [(d.works + d.fails) / d.n, 1, css("--ink-3"), .2]];
    g.selectAll("rect").data(seg).join("rect").attr("x", s => x(s[0])).attr("y", -8).attr("height", 16).attr("fill", s => s[2]).attr("opacity", s => s[3]).attr("width", 0)
      .call(s => iT(s).delay((s, i) => i * 120).attr("width", s => Math.max(0, x(s[1]) - x(s[0]) - 1.5)));
    g.filter(d => S.org && d.by_org[S.org]).append("line").attr("x1", d => x(d.by_org[S.org].works)).attr("x2", d => x(d.by_org[S.org].works)).attr("y1", -14).attr("y2", 14).attr("stroke", css("--organism")).attr("stroke-width", 3).attr("stroke-linecap", "round");
    const d0 = it.drugs[0];
    $("s-unknown").innerHTML = bx({ k: iDrug(d0.drug), v: iPct(d0.works / d0.n), s: `works for every organism grown · ${iFmt(it.n)} cultures${it.never.length ? ` · never works: ${it.never.map(n => `${n.org} with ${drugName(n.drug)}`).join(", ")}` : ""}`, cls: "hero" })
      + bx({ k: "Once it's", wide: true, inner: chips([["any organism", { org: null }], ...it.organisms.map(o => [o.org, { org: o.org }])], o => o.org === S.org) });
  },
  peek(it, o) { if (!o) return this.draw(it); const keep = ISEL.unknown.org; ISEL.unknown.org = o.org; this.draw(it); ISEL.unknown.org = keep; },
};

// · Is the last month a better guide than the year? 13 four-week windows: what happened, and what each guide predicted
IR.guide = {
  answer: it => `<b>The year</b> is a steadier guide than <span class="kc-acc">the last month</span>: it predicted the next month better for <b>${it.year_wins} of ${it.drugs.length}</b> drugs.`,
  meta: it => `${cap(it.spec)}, all organisms, ${iWard(it.ward)}, first isolate per patient · 13 four-week windows, ${iWin(it.windows[0])}`,
  how: () => `For each of the last 13 four-week windows, every result was predicted twice: from the 52 weeks before the window and from the 4 weeks before it, and each guide was scored by how surprised it was (log loss; lower is better). "Steadied" blends the last 4 weeks with the year, as if adding 40 results at the year's rate.`,
  draw(it) {
    const S = ISEL.guide = ISEL.guide || {}; if (!it.drugs.some(d => d.drug === S.drug)) S.drug = (it.drugs.find(d => d.year.share > .05) || it.drugs[0]).drug;
    const d = it.drugs.find(x => x.drug === S.drug), ser = d.series, W = 720, H = 250, svg = iSvg($("m-guide"), W, H);
    const x = d3.scalePoint().domain(ser.map(s => s.end)).range([20, W - 20]), max = d3.max(ser, s => Math.max(s.year, s.month, s.n ? s.r / s.n : 0)) * 1.15 || .1;
    const y = d3.scaleLinear().domain([0, max]).range([H - 30, 24]), r = d3.scaleSqrt().domain([0, d3.max(ser, s => s.n) || 1]).range([2, 9]);
    const line = k => d3.line().x(s => x(s.end)).y(s => y(s[k])).curve(d3.curveMonotoneX)(ser);
    const p1 = svg.append("path").attr("d", line("month")).attr("fill", "none").attr("stroke", css("--accent")).attr("stroke-width", 2).attr("stroke-dasharray", "5 5");
    const p2 = svg.append("path").attr("d", line("year")).attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 2.5);
    if (!reduceMotion()) { const L = p2.node().getTotalLength(); p2.attr("stroke-dasharray", `${L} ${L}`).attr("stroke-dashoffset", L).transition().duration(900).attr("stroke-dashoffset", 0); }
    svg.selectAll("circle").data(ser.filter(s => s.n)).join("circle").attr("cx", s => x(s.end)).attr("cy", s => y(s.r / s.n)).attr("r", s => r(s.n)).attr("fill", css("--ink-3")).attr("opacity", .5)
      .attr("data-tip", s => tipEsc(`4 weeks to ${niceDate(s.end)}<br>${s.r} of ${s.n} resistant<br>the year's guide ${iPct(s.year)} · the month's ${iPct(s.month)}`));
    svg.append("text").attr("class", "ix-lab").attr("x", 20).attr("y", 12).html(`● what happened   <tspan fill="${css("--ink")}" font-weight="600">— the year</tspan>   <tspan fill="${css("--accent")}" font-weight="600">- - the last month</tspan>`);
    $("s-guide").innerHTML = bx({ k: "The year wins", v: `${it.year_wins} <small>of ${it.drugs.length}</small>`, s: `${iDrug(d.drug)} now: ${iPct(d.year.share)} resistant over the year (${iFmt(d.year.r)} of ${iFmt(d.year.n)}); last 4 weeks ${d.month.r} of ${d.month.n}; steadied ${iPct(d.steady)}`, cls: "hero" })
      + bx({ k: "Drug", wide: true, inner: chips(it.drugs.map(x => [iDrug(x.drug), { drug: x.drug }]), o => o.drug === S.drug) });
  },
  peek(it, o) { if (!o) return this.draw(it); const keep = ISEL.guide.drug; ISEL.guide.drug = o.drug; this.draw(it); ISEL.guide.drug = keep; },
};

// · If it's resistant to one drug, what else fails? a matrix: rows = the drug that failed, columns = how often each other fails
IR.fails = {
  first: it => (it.drugs.includes(F.plan) ? F.plan : it.drugs.includes("AMP") ? "AMP" : it.drugs[0]),
  // what to suggest: the narrowest drug that still works at least 85% of the time, then the rest by how often they fail
  options(it, a) {
    const c = it.cells.filter(x => x.a === a), ok = c.filter(x => x.if_fails <= .15).sort((p, q) => it.drugs.indexOf(p.b) - it.drugs.indexOf(q.b));
    return [...ok, ...c.filter(x => x.if_fails > .15).sort((p, q) => p.if_fails - q.if_fails)];
  },
  answer(it) {
    const a = this.first(it), o = this.options(it, a);
    if (!o.length) return `Too few cases to say what else fails with ${drugName(a)}.`;
    return `If <b>${drugName(a)}</b> fails, <b class="acc">${drugName(o[0].b)}</b> is the narrowest drug that still usually works (${iPct(1 - o[0].if_fails)}).`;
  },
  meta: it => `${cap(it.spec)}, all organisms, first isolate per patient · ${iWin(it.windows[0])}`,
  how: () => `For each pair of drugs: how often the second drug fails when the first failed, against when the first worked, among isolates tested on both. A cell appears only with at least 20 isolates each way. A darker cell means the second drug fails more often after the first failed. "Clear" pairs differ by at least 5 points after correcting for the number of pairs.`,
  draw(it) {
    const S = ISEL.fails = ISEL.fails || {}; S.a = it.drugs.includes(S.a) ? S.a : this.first(it);
    const D = it.drugs, n = D.length, W = 720, c0 = 150, cs = Math.min(52, (W - c0 - 10) / n), H = 34 + n * cs, svg = iSvg($("m-fails"), W, H);
    const col = v => d3.interpolate(css("--paper"), css("--accent"))(Math.min(1, v / .8));
    D.forEach((b, j) => svg.append("text").attr("class", "ix-lab").attr("x", c0 + j * cs + cs / 2).attr("y", 20).attr("text-anchor", "middle").text(b));
    svg.append("text").attr("class", "ix-lab").attr("x", c0 - 14).attr("y", 20).attr("text-anchor", "end").html(`<tspan fill="${css("--accent")}" font-weight="600">darker</tspan>: fails more often`);
    const cell = Object.fromEntries(it.cells.map(c => [c.a + c.b, c]));
    D.forEach((a, i) => {
      const g = svg.append("g").attr("class", "ix-row").attr("transform", `translate(0,${30 + i * cs})`).attr("data-pick", JSON.stringify({ a })).style("opacity", a === S.a ? 1 : .35);
      g.append("text").attr("class", "ix-name" + (a === S.a ? " on" : "")).attr("x", c0 - 14).attr("y", cs / 2 + 4).attr("text-anchor", "end").text(iDrug(a));
      D.forEach((b, j) => {
        const c = cell[a + b]; if (a === b) return;
        const r = g.append("rect").attr("x", c0 + j * cs + 2).attr("y", 2).attr("width", cs - 4).attr("height", cs - 4).attr("rx", 6).attr("fill", c ? col(c.if_fails) : css("--sheet-2")).attr("opacity", 0);
        if (c) r.attr("data-tip", tipEsc(`If ${drugName(a)} fails, <b>${drugName(b)}</b> fails in ${iPct(c.if_fails)}<br>${ti("vs")} ${iPct(c.if_works)} when ${drugName(a)} works · ${c.n_fails} cases${c.before != null ? `<br>last year ${iPct(c.before)}` : ""}`));
        iT(r).delay(i * 30 + j * 15).attr("opacity", 1);
      });
    });
    const o = this.options(it, S.a);
    $("s-fails").innerHTML = bx({ k: `If ${drugName(S.a)} fails`, v: o[0] ? cap(drugName(o[0].b)) : "–", s: o[0] ? `narrowest that still works (${iPct(1 - o[0].if_fails)}) · also ${o.slice(1, 3).map(x => `${drugName(x.b)} ${iPct(1 - x.if_fails)}`).join(", ")}` : "", cls: "hero" })
      + bx({ k: "The drug that failed", wide: true, inner: chips(it.drugs.map(a => [iDrug(a), { a }]), x => x.a === S.a) });
  },
  peek(it, o) { if (!o || !o.a) return; },
};

// · What do colleagues start for cases like this? de-identified decisions, each set against how often it worked here
IR.colleagues = {
  answer: it => { const d = it.drugs[0]; return `Colleagues on ${iWard(it.ward)} start <b class="acc">${drugName(d.drug)}</b> most often.`; },
  meta: it => `De-identified decisions from narrated notes, ${iWard(it.ward)} · lab: ${iWin(it.windows[0])}`,
  how: () => `Decisions come from doctors' narrated notes, kept as ward knowledge without the patient: drug, sample, age band and month only. Each drug is set against how often it worked on this ward over the last year (shown only with at least 30 tested).`,
  draw(it) {
    const W = 700, rh = 38, H = it.drugs.length * rh + 16, svg = iSvg($("m-colleagues"), W, H);
    const g = svg.selectAll("g").data(it.drugs).join("g").attr("transform", (d, i) => `translate(0,${18 + i * rh})`)
      .attr("data-tip", d => tipEsc(`<b>${iDrug(d.drug)}</b>: ${d.decisions} decisions${d.works != null ? `<br>worked for ${iPct(d.works)} here last year` : ""}`));
    g.append("text").attr("class", "ix-name").attr("x", 150).attr("y", 5).attr("text-anchor", "end").text(d => iDrug(d.drug));
    g.selectAll("circle").data(d => d3.range(d.decisions)).join("circle").attr("cx", i => 170 + i * 18).attr("r", 0).attr("fill", css("--accent")).call(s => iT(s).delay(i => i * 40).attr("r", 6));
    $("s-colleagues").innerHTML = bx({ k: "Decisions shared", v: it.n, s: `de-identified · ${it.months.map(m => m[0]).join(", ")}`, cls: "hero" });
  },
};
