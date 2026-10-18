// ---------- filters: a floating button opens a glass panel of tiles and one slider (Morning brief and Ward overview) ----------
// No dropdowns. Tiles say what they are and how much is behind them; selection is shown by colour, never by a box.
// Resistance types are shared with Settings (HYG.types). Wards and "in hospital" filter the brief on the page, instantly;
// on the Ward overview one ward focuses it and the slider sets the window.
const FILT = Object.assign({ wards: [], onset: "any" }, store.get("rl-filters", {}));
const saveFilt = () => store.set("rl-filters", FILT);
const F_STEPS = [2, 4, 8, 13, 26, 52];
const FICON = '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>';

const fType = f => HYG.types.includes(f);
const fWard = w => !FILT.wards.length || FILT.wards.includes(w);
const filtersOn = () => (HYG.types.length < 4) + (FILT.wards.length > 0) + (FILT.onset !== "any");

// the brief, as the filters see it
function filterBrief(B) {
  if (!B || !filtersOn()) return B;
  const caseOk = c => c.flags.some(fType) && fWard(c.ward) && (FILT.onset === "any" || (c.hday || 0) >= 3);
  const incOk = i => (!i.flag || fType(i.flag)) && (!i.ward || fWard(i.ward)) && (!i.wards || i.wards.some(fWard));
  return { ...B, new_cases: B.new_cases.filter(caseOk), clusters: B.clusters.filter(c => c.flags.some(fType) && c.wards.some(fWard)),
    wards: B.wards.filter(w => fWard(w.code)), all_wards: B.all_wards.filter(w => fWard(w.code)), health: B.health.filter(h => fWard(h.ward)),
    incidents: (B.incidents || []).filter(incOk), arrivals: (B.arrivals || []).filter(a => fWard(a[2])) };
}

function syncFilterButton() {
  let b = $("filtbtn");
  const show = VIEW === "brief" || VIEW === "wards";
  if (!b) { b = document.createElement("button"); b.id = "filtbtn"; b.className = "filtbtn"; b.type = "button"; $("who").before(b); b.onclick = () => toggleFilters(); }   // in the sticky top bar
  b.hidden = !show; b.title = "Filters"; b.setAttribute("aria-label", "Filters");
  const n = filtersOn(); b.innerHTML = FICON + (n ? `<i>${n}</i>` : "");
  if (!show && $("filtpanel")) $("filtpanel").hidden = true;
}
function toggleFilters(open) {
  let p = $("filtpanel");
  if (!p) { p = document.createElement("aside"); p.id = "filtpanel"; p.className = "filtpanel"; p.hidden = true; $("app").append(p); }
  p.hidden = open === undefined ? !p.hidden : !open;
  if (!p.hidden) paintFilters();
}
function paintFilters() {
  const p = $("filtpanel"); if (!p || p.hidden) return;
  const col = TYPE_COL(), onWards = VIEW === "wards";
  const typeN = tp => onWards ? (WD ? WD.cases.filter(c => c.flags.includes(tp) && (!WS.ward || c.ward === WS.ward)).length : "") : BR_RAW ? BR_RAW.new_cases.filter(c => c.flags.includes(tp)).length : "";
  const wardN = w => { const a = (onWards ? WD && WD.wards : BR_RAW && BR_RAW.all_wards) || []; const x = a.find(z => z.code === w); return x ? x.recent : ""; };
  const win = onWards && WD ? winSet()[1] - winSet()[0] + 1 : HYG.windowWeeks, step = F_STEPS.reduce((b, s, i) => Math.abs(s - win) < Math.abs(F_STEPS[b] - win) ? i : b, 0);
  p.innerHTML = `<header><b>Filters</b><button class="f-x" data-f="close" aria-label="Close">×</button></header>
    <section><span class="fk">Resistance types</span><div class="ftiles t4">${["ESBL", "MRSA", "VRE", "CPE"].map(tp => `<button class="ftile${fType(tp) ? " on" : ""}" data-f="type" data-v="${tp}" style="--c:${col[tp]}"><b>${tp}</b><small>${typeN(tp) !== "" ? `${typeN(tp)} ${onWards ? "in 52 weeks" : "since yesterday"}` : ""}</small></button>`).join("")}</div></section>
    <section><span class="fk">${onWards ? "Focus a ward" : "Wards"}<button class="f-all${FILT.wards.length ? "" : " on"}" data-f="allwards">${onWards ? "all wards" : "all"}</button></span>
      <div class="ftiles t3">${META.wards.map(w => `<button class="ftile w${FILT.wards.includes(w.code) ? " on" : ""}" data-f="ward" data-v="${w.code}"><b>${wardName(w.code)}</b><small>${wardN(w.code) !== "" ? `${wardN(w.code)} in 4 weeks` : ""}</small></button>`).join("")}</div></section>
    ${onWards ? `<section><span class="fk">Window</span><div class="fslider" data-f="slider" style="--p:${step / (F_STEPS.length - 1)}"><span class="fill"></span><b>${F_STEPS[step]} weeks</b>${F_STEPS.map((s, i) => `<i style="left:${i / (F_STEPS.length - 1) * 100}%"></i>`).join("")}</div></section>`
      : `<section><span class="fk">Where it was found</span><div class="ftiles t2"><button class="ftile${FILT.onset === "any" ? " on" : ""}" data-f="onset" data-v="any"><b>Anywhere</b><small>every new case</small></button><button class="ftile${FILT.onset === "hospital" ? " on" : ""}" data-f="onset" data-v="hospital"><b>In hospital</b><small>sampled on day 3+ of the stay</small></button></div></section>`}
    <footer><button class="f-reset" data-f="reset">Reset</button></footer>`;
}
async function applyFilters(refetchWards) {
  saveFilt(); store.set("rl-hyg", HYG); syncFilterButton(); paintFilters();
  if (VIEW === "brief" && BR_RAW) paintBrief();
  if (VIEW === "wards" && WD) {
    WS.ward = FILT.wards.length === 1 ? FILT.wards[0] : null; WS.fp = null;
    if (refetchWards) { WD = await api(`/api/app/wards?types=${HYG.types.join(",").toLowerCase()}`); drawFingerprints.last = null; }
    drawWards(); paintFilters();
  }
}
document.addEventListener("click", e => {
  const b = e.target.closest("#filtpanel [data-f]");
  if (!b) { const p = $("filtpanel"); if (p && !p.hidden && document.contains(e.target) && !e.target.closest("#filtpanel, #filtbtn")) p.hidden = true; return; }
  const f = b.dataset.f, v = b.dataset.v;
  if (f === "close") return toggleFilters(false);
  if (f === "type") { const on = HYG.types.includes(v); if (on && HYG.types.length === 1) return; HYG.types = on ? HYG.types.filter(x => x !== v) : ["ESBL", "MRSA", "VRE", "CPE"].filter(x => x === v || HYG.types.includes(x)); return applyFilters(true); }
  if (f === "ward") { if (VIEW === "wards") FILT.wards = FILT.wards[0] === v ? [] : [v]; else FILT.wards = FILT.wards.includes(v) ? FILT.wards.filter(x => x !== v) : [...FILT.wards, v]; return applyFilters(); }
  if (f === "allwards") { FILT.wards = []; return applyFilters(); }
  if (f === "onset") { FILT.onset = v; return applyFilters(); }
  if (f === "reset") { FILT.wards = []; FILT.onset = "any"; HYG.types = ["ESBL", "MRSA", "VRE", "CPE"]; if (VIEW === "wards" && WD) WS.win = null; return applyFilters(true); }
});
// the window slider: a thick pill you drag or tap; it snaps to 2, 4, 8, 13, 26 or 52 weeks
document.addEventListener("pointerdown", e => {
  const s = e.target.closest("#filtpanel .fslider"); if (!s || VIEW !== "wards" || !WD) return;
  s.setPointerCapture(e.pointerId);
  const set = ev => {
    const r = s.getBoundingClientRect(), i = Math.round(Math.max(0, Math.min(1, (ev.clientX - r.left) / r.width)) * (F_STEPS.length - 1)), n = Math.min(WD.weeks, F_STEPS[i]);
    s.style.setProperty("--p", i / (F_STEPS.length - 1)); s.querySelector("b").textContent = `${F_STEPS[i]} weeks`;
    const end = winSet()[1]; WS.win = [Math.max(0, end - n + 1), end]; WS.preview = null; drawWards();
  };
  set(e); s.onpointermove = set; s.onpointerup = () => { s.onpointermove = null; paintFilters(); };
});
addEventListener("keydown", e => { const p = $("filtpanel"); if (e.key === "Escape" && p && !p.hidden) p.hidden = true; });
