// ---------- the Morning brief, top: this morning in one sentence, the last 7 days, today's results as they arrived, and incidents ----------
// Quiet by default: one sentence, four numbers with a week of context, two charts. Details appear on hover (the shared tooltip).
const MB_DAY = d => { const x = new Date(d + "T12:00"); return x.toLocaleDateString(loc(), { weekday: "short", day: "numeric", month: "short" }); };
const MB_LANES = [["received", "Samples received"], ["organism", "Organism named"], ["susceptibility", "Susceptibility"], ["fixed", "Corrected or duplicate"]];
const MB_COL = k => ({ first: css("--accent"), above: css("--accent"), cluster: css("--accent"), grew: css("--accent"), case: css("--ink"), calm: css("--cool"), ended: css("--cool") }[k] || css("--ink-3"));

function mbText(i) {
  const w = i.ward ? iWard(i.ward) : "", s = n => (n === 1 ? "" : "s");
  return {
    case: `${i.n} new ${i.flag} on ${w}`, first: `First ${i.flag} ever on ${w}`, above: `${w} above its usual`, calm: `${w} back within its usual`,
    cluster: `New ${i.flag} ${i.organism} cluster`, grew: `${i.flag} ${i.organism} cluster grew to ${i.n}`, ended: `${i.flag} ${i.organism} cluster over`,
    gap: `No samples from ${w}`, late: `${i.n} late result${s(i.n)} from ${w}`, fixed: `${i.n} result${s(i.n)} corrected`,
  }[i.kind] || i.kind;
}
function mbDetail(i) {
  return {
    case: `first resistant isolate per patient, confirmed by the lab that day`, first: `no ${i.flag} had ever been recorded on this ward before`,
    above: `${i.n} new resistant cases in 4 weeks against about ${i.expected} usually`, calm: `${i.n} in the last 4 weeks`,
    cluster: `${i.n} cases with the same organism and resistance pattern · ${(i.wards || []).map(iWard).join(", ")}`,
    grew: `${i.was} → ${i.n} cases · ${(i.wards || []).map(iWard).join(", ")}`, ended: `no new case for 4 weeks`,
    gap: `usually about ${Math.round(i.usual)} a day: check the feed before reading a drop`, late: `sampled more than 10 days earlier; they count on their sample dates`,
    fixed: `results changed after they were first sent · ${(i.wards || []).map(iWard).join(", ")}`,
  }[i.kind] || "";
}
// the morning in one sentence: the two things that matter most today, then how much data arrived
function mbSentence(B) {
  const today = B.incidents.filter(i => i.day === B.today), parts = [];
  for (const i of today) {
    if (parts.length >= 2) break;
    if (i.kind === "above") parts.push(`<b>${iWard(i.ward)}</b> crossed its usual level`);
    else if (i.kind === "first") parts.push(`the first <b>${i.flag}</b> ever on ${iWard(i.ward)}`);
    else if (i.kind === "cluster") parts.push(`a new <b>${i.flag} ${i.organism}</b> cluster`);
    else if (i.kind === "grew") parts.push(`the <b>${i.flag} ${i.organism}</b> cluster grew to <b class="acc">${i.n}</b>`);
    else if (i.kind === "gap") parts.push(`<b>${iWard(i.ward)}</b> sent no samples`);
  }
  const p = B.pulse[B.pulse.length - 1], arrived = p.arrived != null ? ` ${fmt(p.arrived)} results arrived${p.issues ? `, ${p.issues} late or corrected` : ""}.` : "";
  if (!parts.length) return `A quiet day: nothing crossed a line.${arrived}`;
  const s = parts.join(", and ");
  return s[0] === "<" ? `${s.replace(/^<b>/, "<b>")}.${arrived}` : `${cap(s)}.${arrived}`;
}

function morningTop(B) {
  const el = $("mb"); if (!el || !B.pulse) return;
  const stats = [["new", "New resistant cases"], ["above", "Wards above their usual"], ["arrived", "Results arrived"], ["issues", "Late or corrected"]]
    .filter(([k]) => B.pulse.some(p => p[k] != null));
  el.innerHTML = `<p class="mb-hero">${mbSentence(B)}</p>
    <span class="mb-key">Last 7 days · <span class="kc-acc">today</span></span>
    <div class="mb-pulse">${stats.map(([k, l]) => `<div class="mb-stat"><span class="k">${l}</span><b class="v">${fmt(B.pulse[B.pulse.length - 1][k] ?? 0)}</b><div class="mb-bars" id="mbb-${k}"></div></div>`).join("")}</div>
    <div class="mb-row">
      ${B.arrivals.length ? `<div class="mb-arr"><h3 class="bq">As it arrived today · <span class="kc-acc">late</span></h3><div id="mb-arr"></div></div>` : ""}
      <div class="mb-inc"><h3 class="bq">Incidents</h3><div id="mb-inc"></div></div>
    </div>`;
  stats.forEach(([k]) => mbBars(k, B.pulse));
  if (B.arrivals.length) mbArrivals(B.arrivals);
  mbIncidents(B);
}
// a week of context for each number: today in the accent
function mbBars(k, pulse) {
  const W = 160, H = 34, svg = iSvg($("mbb-" + k), W, H), max = Math.max(1, d3.max(pulse, p => p[k] || 0));
  const x = d3.scaleBand().domain(pulse.map(p => p.day)).range([0, W]).padding(.3), y = d3.scaleLinear().domain([0, max]).range([H - 2, 3]);
  svg.selectAll("rect").data(pulse).join("rect").attr("x", p => x(p.day)).attr("width", x.bandwidth()).attr("rx", 2)
    .attr("y", H - 2).attr("height", 0).attr("fill", (p, i) => i === pulse.length - 1 ? css("--accent") : css("--ink-3")).attr("opacity", (p, i) => i === pulse.length - 1 ? 1 : .55)
    .attr("data-tip", p => tipEsc(`${MB_DAY(p.day)}: <b>${fmt(p[k] ?? 0)}</b>`))
    .call(s => iT(s).delay((p, i) => i * 50).attr("y", p => y(p[k] || 0)).attr("height", p => Math.max(1.5, H - 2 - y(p[k] || 0))));
}
// today's deliveries on a 24-hour line, in four lanes; late results in the accent. They drop in by the hour.
function mbArrivals(arr) {
  const W = 760, lh = 40, x0 = 170, H = MB_LANES.length * lh + 30, svg = iSvg($("mb-arr"), W, H);
  const x = d3.scaleLinear().domain([0, 24]).range([x0, W - 10]);
  MB_LANES.forEach(([k, l], i) => {
    svg.append("text").attr("class", "ix-name").attr("x", x0 - 14).attr("y", 8 + i * lh + lh / 2 + 4).attr("text-anchor", "end").text(l);
    svg.append("line").attr("x1", x0).attr("x2", W - 10).attr("y1", 8 + i * lh + lh / 2).attr("y2", 8 + i * lh + lh / 2).attr("stroke", css("--line"));
  });
  const lane = Object.fromEntries(MB_LANES.map(([k], i) => [k, i]));
  const late = a => a[3] > 10;
  svg.selectAll("circle").data(arr).join("circle")
    .attr("cx", a => x(a[0])).attr("cy", (a, i) => 8 + lane[a[1]] * lh + lh / 2 + (((i * 7919) % 17) - 8) * 1.2)
    .attr("r", 0).attr("fill", a => late(a) ? css("--accent") : css("--ink-3")).attr("opacity", a => late(a) ? 1 : .7)
    .attr("data-tip", a => tipEsc(`${iWard(a[2])} · ${String(Math.floor(a[0])).padStart(2, "0")}:${String(Math.round(a[0] % 1 * 60)).padStart(2, "0")}<br>${MB_LANES[lane[a[1]]][1].toLowerCase()} · sampled ${a[3]} days earlier${late(a) ? "<br><b>late</b>" : ""}`))
    .call(s => iT(s).delay(a => a[0] * 70).attr("r", a => late(a) ? 4 : 3));
  svg.append("g").attr("class", "ix-axis").attr("transform", `translate(0,${H - 8})`).call(d3.axisBottom(x).tickValues([0, 6, 12, 18, 24]).tickFormat(h => `${String(h).padStart(2, "0")}:00`).tickSize(0));
}
// three days of incidents, newest first; a click on one opens its ward
function mbIncidents(B) {
  const days = [...new Set([B.today, ...B.incidents.map(i => i.day)])].sort().reverse().slice(0, 3);
  const label = d => d === B.today ? t("today") : d === B.yesterday ? "Yesterday" : MB_DAY(d);
  $("mb-inc").innerHTML = days.map(d => {
    const items = B.incidents.filter(i => i.day === d);
    return `<div class="mb-day"><span class="k">${label(d)}</span>${items.length ? items.map(i => `<button class="mb-i k-${i.kind}" ${i.ward ? `data-ward="${i.ward}"` : ""} data-tip="${tipEsc(mbDetail(i))}"><i style="--c:${MB_COL(i.kind)}"></i>${mbText(i)}</button>`).join("")
      : `<span class="mb-none">Nothing crossed a line.</span>`}</div>`;
  }).join("");
}
document.addEventListener("click", e => {
  const b = e.target.closest("#mb-inc .mb-i[data-ward]"); if (!b) return;
  WS.ward = b.dataset.ward; WS.fp = null; go("wards");
});

// hovering a new-case dot lights up its resistance type in the words below
document.addEventListener("pointerover", e => {
  const c = e.target.closest && e.target.closest("#b-new circle[data-type]"); if (!c) return;
  const mark = tp => document.querySelectorAll("#b-new .tw").forEach(w => { w.classList.toggle("on", w.dataset.type === tp); w.classList.toggle("off", !!tp && w.dataset.type !== tp); });
  mark(c.dataset.type); c.addEventListener("pointerleave", () => mark(null), { once: true });
});
