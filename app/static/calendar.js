// ---------- the feed calendar: every simulated day marked notable, active or quiet; a click goes to that day ----------
// Opens from the clock. Notable days are the brief's own incidents (a ward over its normal, a cluster starting or growing,
// a first-ever resistance type, a ward that sent nothing, a large late batch); the key is written in its colours above the months.
let CAL = null, calAt = 0;
async function loadCalendar(force) {
  if (!force && CAL && CAL.ready && Date.now() - calAt < 60000) return CAL;
  CAL = await api("/api/app/calendar"); calAt = Date.now();
  if (!CAL.ready) setTimeout(() => { if ($("calpop") && !$("calpop").hidden) loadCalendar(true).then(renderCalendar); }, 4000);   // refines once built
  return CAL;
}
async function jumpNotable() {
  const c = await loadCalendar();
  const next = c.days.find(d => d.day > CLOCK.today && d.level === "notable");
  if (next) await clockAction("set", { day: next.day });
  if ($("calpop") && !$("calpop").hidden) renderCalendar();
}
async function toggleCalendar() {
  let el = $("calpop");
  if (!el) { el = document.createElement("div"); el.id = "calpop"; el.className = "calpop"; el.hidden = true; $("app").append(el); }
  el.hidden = !el.hidden; renderClock();
  if (!el.hidden) { el.innerHTML = `<div class="skel" style="height:220px"></div>`; await loadCalendar(); renderCalendar(); }
}
function renderCalendar() {
  const el = $("calpop"); if (!el || el.hidden || !CAL) return;
  const byDay = Object.fromEntries(CAL.days.map(d => [d.day, d]));
  const start = new Date(CAL.first + "T12:00"), end = new Date(CAL.last + "T12:00"), months = [];
  for (let m = new Date(start.getFullYear(), start.getMonth(), 1); m <= end; m = new Date(m.getFullYear(), m.getMonth() + 1, 1)) months.push(m);
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const tip = d => {
    if (!d) return "";
    const inc = (d.incidents || []).map(i => typeof mbText === "function" ? mbText(i) : i.kind);
    return tipEsc(`<b>${new Date(d.day + "T12:00").toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" })}</b><br>${inc.length ? inc.join("<br>") : d.level === "quiet" ? "nothing crossed a line" : `${d.resistant} resistant result${d.resistant === 1 ? "" : "s"}`}<br>${fmt(d.arrived)} results arrived`);
  };
  const wd = [...Array(7)].map((_, i) => new Date(2026, 0, 5 + i).toLocaleDateString(loc(), { weekday: "narrow" }));
  el.innerHTML = `<div class="cal-head"><b>${t("calendar")}</b><span class="cal-key"><span class="kc-acc">notable</span> · <span class="kc-ink">active</span> · <span class="kc-ink3">quiet</span>${CAL.ready ? "" : " · <i>refining…</i>"}</span></div>
    <div class="cal-months">${months.map(m => {
      const first = (m.getDay() + 6) % 7, n = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
      const cells = [...Array(first)].map(() => `<span></span>`).concat([...Array(n)].map((_, k) => {
        const day = iso(new Date(m.getFullYear(), m.getMonth(), k + 1)), d = byDay[day];
        const cls = d ? `cd l-${d.level}${day === CLOCK.today ? " now" : ""}` : `cd out${day === CAL.data_end && CLOCK.today === day ? " now" : ""}`;
        return d ? `<button class="${cls}" data-day="${day}" data-tip="${tip(d)}">${k + 1}</button>` : `<span class="${cls}">${k + 1}</span>`;
      })).join("");
      return `<div class="cal-m"><span class="cal-mn">${m.toLocaleDateString(loc(), { month: "long", year: "numeric" })}</span><div class="cal-g">${wd.map(w => `<span class="cw">${w}</span>`).join("")}${cells}</div></div>`;
    }).join("")}</div>`;
}
document.addEventListener("click", async e => {
  const b = e.target.closest("#calpop .cd[data-day]"); if (b) { stopPlay(); await clockAction("set", { day: b.dataset.day }); renderCalendar(); return; }
  const el = $("calpop");
  if (el && !el.hidden && document.contains(e.target) && !e.target.closest("#calpop, #clockpill")) { el.hidden = true; renderClock(); }   // a re-rendered button is no longer in the page
});
addEventListener("keydown", e => { const el = $("calpop"); if (e.key === "Escape" && el && !el.hidden) { el.hidden = true; renderClock(); } });
