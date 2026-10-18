// Mindline export: a document built from the data each view rendered (BR, WD, AB/PT), never a copy of the screen.
// The same document is downloaded as a self-contained HTML file or printed to PDF from a hidden frame.
// Always light, A4-sized vector charts, every number with its n, and the full lists behind each card.
// Loaded after app.js and uses its globals: META, CLOCK, LANG, t, loc, fmt, niceDate, drugName, wardName, specName, shareText,
// BR, WD, WS, HYG, AB, PT, F, casesIn, winSet, winZ, wkOf, wkDate, MIN_CASES, PLACE, NATURAL, api.

const XP = { paper: "#ffffff", ink: "#17181c", ink2: "#4a4c52", ink3: "#808188", line: "#e2dfd6", faint: "#efede7", band: "#f2f0ea",
  accent: "#ef4630", cool: "#2f8f86", amber: "#c98a0c", violet: "#6b5fd3", grey: "#b9b8b3" };
const XTYPE = { ESBL: XP.accent, MRSA: XP.violet, VRE: XP.amber, CPE: XP.cool };

const XS = {
  en: {
    asOf: "As of", source: "Source", showing: "Showing", exportedAt: "Exported",
    srcData: "Tyks laboratory data up to {d}", srcFeed: "Simulated live feed on {d}; Tyks data ends {e}",
    caseId: "Case", ward: "Ward", organism: "Organism", resistance: "Resistance", sample: "Sample", sampled: "Sampled", stay: "Day of stay", early: "outpatient or day 1–2",
    filled: "filled: sampled on day 3 or later of the stay", open: "open: outpatient or earlier in the stay",
    status: "Status", cluster: "Cluster", cases: "Cases", day3: "Day 3+", firstLast: "First – last case", last60: "Last 60 days", sinceLast: "last case {d} days ago",
    clFn: "One dot per case per day over the last 60 days; today is the right edge. A cluster with no new case for 28 days is over; clusters quiet for more than 60 days are left out.",
    name: "Name", last4: "Last 4 weeks", usual: "Usual", usualRange: "Usual range", z: "z", reading: "Reading",
    above: "above its usual range", within: "within its usual range", tooFew: "fewer than 3 cases: not judged",
    wardsFn: "Usual: the ward's own average for 4 weeks over the year before. Range: usual ± 2√usual. A ward is called above normal only with 3 or more cases and z above 2.",
    pair: "Organism · antibiotic · sample", now12: "Last 12 months", before12: "12 months before", months24: "24 months", resistantOf: "{r} of {n} resistant",
    crossed: "crossed a threshold", noChange: "no clear change",
    trendsFn: "Resistant share per month; months with fewer than 10 tests are left out of the line. A threshold is crossed when z is beyond 2 and the share moved at least 2 points.",
    trendsVer: "Dashed line: {v} from {m}.",
    samples14: "Samples, 14 days", usual14: "Usual, 14 days", missing7: "Missing days, last 7", pending: "Pending", late: "Late results",
    healthFn: "Bars: samples per day. Tick: the median of the same weekday in the 4 weeks before. Dashed box: no samples on a day when 2 or more were expected.",
    xWhen: "When · new resistant cases per week, last 52 weeks", xWhere: "Where · each ward against its own normal in this window", xWhat: "What · cases with the same organism and resistance pattern",
    window: "Window", focusWard: "Ward in focus", focusPattern: "Pattern in focus", types: "Resistance types", weekOf: "Week from", total: "Total",
    typeTotals: "Last 52 weeks: {list}.", samplesSent: "Samples sent, 52 weeks", inWindow: "Cases in window", usualWindow: "Usual for window",
    shared: "Wards that share patients", sharedFn: "Patients sampled on both wards in the last 12 months.",
    resistantTo: "Resistant to", susceptibleTo: "Susceptible to", wardsCol: "Wards", dates: "Dates", allCases: "Every case in the window", none: "none",
    mapFn: "Circle size: samples sent in 52 weeks. Colour: above the ward's usual level for this window, only with 3 or more cases. Lines: shared patients, thicker for more.",
    whenFn: "Bars: cases per week by resistance type (a case with two types counts in both). Dashed line: the usual weekly level. Shaded: the window.",
    patterns: "{n} patterns", whatFn: "A pattern is the organism plus its result for each of the 12 antibiotics tested. First resistant isolate per patient and type.",
    drugsQ: "How often each antibiotic killed similar patients' bacteria", spectrum: "Spectrum", basis: "Based on", killed12: "Killed, last 12 months", ci: "95% interval",
    note: "Note", changedNote: "last {weeks} weeks clearly different", basisWard: "this ward", basisAll: "all wards", wardOnly: "ward has {n}",
    drugsFn: "Dot: share killed in the last 12 months; band: 95% interval; dashed line: 80%; triangle: last {weeks} weeks (grey when fewer than 30 tests).",
    selected: "Selected antibiotic", month: "Month", tested: "Tested", killed: "Killed", share: "Share", monthlyFn: "Killed share per month, last 12 months; dot size follows the number tested. The current month is not complete.",
    growsSub: "Share of first isolates, last 12 months, {n} isolates.", hist: "This patient's samples", survivedCol: "Survived",
    signals: "Signals", cohort: "Similar patients: {y} first isolates in 12 months, {r} in the last {weeks} weeks.",
    patient: "Patient", typical: "Typical patient for the filters", drug: "Antibiotic", narrow: "narrow", moderate: "moderate", broad: "broad", reserve: "reserve",
  },
  fi: {
    asOf: "Tilanne", source: "Lähde", showing: "Näkymä", exportedAt: "Viety",
    srcData: "Tyksin laboratoriodata {d} asti", srcFeed: "Simuloitu live-syöte {d}; Tyksin data päättyy {e}",
    caseId: "Tapaus", ward: "Osasto", organism: "Mikrobi", resistance: "Resistenssi", sample: "Näyte", sampled: "Näytepäivä", stay: "Hoitopäivä", early: "avohoito tai päivä 1–2",
    filled: "täytetty: näyte hoitopäivänä 3 tai myöhemmin", open: "avoin: avohoito tai hoitojakson alku",
    status: "Tila", cluster: "Rypäs", cases: "Tapauksia", day3: "Päivä 3+", firstLast: "Ensimmäinen – viimeisin", last60: "Viimeiset 60 päivää", sinceLast: "viimeisin {d} päivää sitten",
    clFn: "Yksi piste tapausta kohden päivittäin viimeisten 60 päivän ajalta; oikea reuna on tämä päivä. Rypäs on ohi, kun uutta tapausta ei ole tullut 28 päivään; yli 60 päivää hiljaiset rypäät jätetään pois.",
    name: "Nimi", last4: "Viim. 4 viikkoa", usual: "Tavallinen", usualRange: "Tavallinen vaihtelu", z: "z", reading: "Tulkinta",
    above: "yli tavallisen vaihtelun", within: "tavallisen vaihtelun sisällä", tooFew: "alle 3 tapausta: ei tulkita",
    wardsFn: "Tavallinen: osaston oma keskiarvo 4 viikolle edeltävän vuoden ajalta. Vaihtelu: tavallinen ± 2√tavallinen. Osasto on yli tavallisen vain, kun tapauksia on vähintään 3 ja z on yli 2.",
    pair: "Mikrobi · antibiootti · näyte", now12: "Viim. 12 kk", before12: "Edelliset 12 kk", months24: "24 kk", resistantOf: "{r}/{n} resistenttejä",
    crossed: "ylitti rajan", noChange: "ei selvää muutosta",
    trendsFn: "Resistenttien osuus kuukausittain; kuukaudet, joilla on alle 10 testiä, jätetään viivasta pois. Raja ylittyy, kun z on yli 2 ja osuus muuttui vähintään 2 prosenttiyksikköä.",
    trendsVer: "Katkoviiva: {v} alkaen {m}.",
    samples14: "Näytteet, 14 pv", usual14: "Tavallinen, 14 pv", missing7: "Puuttuvat päivät, viim. 7", pending: "Odottaa", late: "Myöhässä",
    healthFn: "Palkit: näytteet päivittäin. Merkki: saman viikonpäivän mediaani edeltävältä 4 viikolta. Katkoviivalaatikko: ei näytteitä päivänä, jona niitä odotettiin vähintään 2.",
    xWhen: "Milloin · uudet resistentit tapaukset viikoittain, viimeiset 52 viikkoa", xWhere: "Missä · kukin osasto omaan tasoonsa nähden tällä aikavälillä", xWhat: "Mitä · tapaukset, joilla on sama mikrobi ja resistenssiprofiili",
    window: "Aikaväli", focusWard: "Valittu osasto", focusPattern: "Valittu profiili", types: "Resistenssityypit", weekOf: "Viikko alkaen", total: "Yhteensä",
    typeTotals: "Viimeiset 52 viikkoa: {list}.", samplesSent: "Näytteitä, 52 vk", inWindow: "Tapauksia aikavälillä", usualWindow: "Tavallinen aikavälille",
    shared: "Osastot, joilla on yhteisiä potilaita", sharedFn: "Potilaat, joilta on otettu näyte molemmilla osastoilla viimeisen 12 kuukauden aikana.",
    resistantTo: "Resistentti", susceptibleTo: "Herkkä", wardsCol: "Osastot", dates: "Päivät", allCases: "Kaikki aikavälin tapaukset", none: "ei mitään",
    mapFn: "Ympyrän koko: lähetetyt näytteet 52 viikossa. Väri: yli osaston tavallisen tason tällä aikavälillä, vain kun tapauksia on vähintään 3. Viivat: yhteiset potilaat, paksumpi kun niitä on enemmän.",
    whenFn: "Palkit: tapaukset viikoittain resistenssityypin mukaan (kahden tyypin tapaus lasketaan kumpaankin). Katkoviiva: tavallinen viikkotaso. Varjostettu: aikaväli.",
    patterns: "{n} profiilia", whatFn: "Profiili on mikrobi ja sen tulos kullekin 12 testatusta antibiootista. Ensimmäinen resistentti isolaatti potilasta ja tyyppiä kohden.",
    drugsQ: "Kuinka usein kukin antibiootti tehosi samankaltaisten potilaiden bakteereihin", spectrum: "Kirjo", basis: "Perusta", killed12: "Tehosi, viim. 12 kk", ci: "95 %:n väli",
    note: "Huom.", changedNote: "viim. {weeks} viikkoa selvästi eri", basisWard: "tämä osasto", basisAll: "kaikki osastot", wardOnly: "osastolla {n}",
    drugsFn: "Piste: tehonnut osuus viimeisen 12 kuukauden aikana; nauha: 95 %:n väli; katkoviiva: 80 %; kolmio: viimeiset {weeks} viikkoa (harmaa, kun testejä on alle 30).",
    selected: "Valittu antibiootti", month: "Kuukausi", tested: "Testattu", killed: "Tehosi", share: "Osuus", monthlyFn: "Tehonnut osuus kuukausittain, viimeiset 12 kuukautta; pisteen koko kertoo testien määrän. Kuluva kuukausi on kesken.",
    growsSub: "Osuus ensimmäisistä isolaateista, viimeiset 12 kk, {n} isolaattia.", hist: "Tämän potilaan näytteet", survivedCol: "Selvisi",
    signals: "Signaalit", cohort: "Samankaltaiset potilaat: {y} ensimmäistä isolaattia 12 kuukaudessa, {r} viimeisen {weeks} viikon aikana.",
    patient: "Potilas", typical: "Tyypillinen potilas valinnoille", drug: "Antibiootti", narrow: "kapea", moderate: "keskilaaja", broad: "laaja", reserve: "varalääke",
  },
  sv: {
    asOf: "Läge", source: "Källa", showing: "Visar", exportedAt: "Exporterad",
    srcData: "Tyks laboratoriedata till {d}", srcFeed: "Simulerat liveflöde {d}; Tyks data slutar {e}",
    caseId: "Fall", ward: "Avdelning", organism: "Mikrob", resistance: "Resistens", sample: "Prov", sampled: "Provdag", stay: "Vårddag", early: "öppenvård eller dag 1–2",
    filled: "fylld: prov vårddag 3 eller senare", open: "öppen: öppenvård eller tidigt i vårdtiden",
    status: "Status", cluster: "Kluster", cases: "Fall", day3: "Dag 3+", firstLast: "Första – senaste fall", last60: "Senaste 60 dagarna", sinceLast: "senaste fall för {d} dagar sedan",
    clFn: "En prick per fall och dag under de senaste 60 dagarna; högerkanten är i dag. Ett kluster utan nytt fall på 28 dagar är över; kluster tysta i mer än 60 dagar utelämnas.",
    name: "Namn", last4: "Senaste 4 veckor", usual: "Normalt", usualRange: "Normal spridning", z: "z", reading: "Tolkning",
    above: "över sin normala spridning", within: "inom sin normala spridning", tooFew: "färre än 3 fall: bedöms inte",
    wardsFn: "Normalt: avdelningens eget medelvärde för 4 veckor under året innan. Spridning: normalt ± 2√normalt. En avdelning kallas över normalt bara vid minst 3 fall och z över 2.",
    pair: "Mikrob · antibiotikum · prov", now12: "Senaste 12 mån", before12: "12 mån innan", months24: "24 mån", resistantOf: "{r} av {n} resistenta",
    crossed: "passerade en gräns", noChange: "ingen tydlig förändring",
    trendsFn: "Resistent andel per månad; månader med färre än 10 tester utelämnas ur linjen. En gräns passeras när z är över 2 och andelen ändrats minst 2 procentenheter.",
    trendsVer: "Streckad linje: {v} från {m}.",
    samples14: "Prov, 14 dagar", usual14: "Normalt, 14 dagar", missing7: "Saknade dagar, senaste 7", pending: "Väntar", late: "Sena svar",
    healthFn: "Staplar: prov per dag. Streck: medianen för samma veckodag de 4 veckorna innan. Streckad ruta: inga prov en dag då minst 2 väntades.",
    xWhen: "När · nya resistenta fall per vecka, senaste 52 veckorna", xWhere: "Var · varje avdelning mot sin egen normalnivå i perioden", xWhat: "Vad · fall med samma mikrob och resistensmönster",
    window: "Period", focusWard: "Vald avdelning", focusPattern: "Valt mönster", types: "Resistenstyper", weekOf: "Vecka från", total: "Totalt",
    typeTotals: "Senaste 52 veckorna: {list}.", samplesSent: "Skickade prov, 52 v", inWindow: "Fall i perioden", usualWindow: "Normalt för perioden",
    shared: "Avdelningar som delar patienter", sharedFn: "Patienter med prov på båda avdelningarna under de senaste 12 månaderna.",
    resistantTo: "Resistent mot", susceptibleTo: "Känslig för", wardsCol: "Avdelningar", dates: "Datum", allCases: "Alla fall i perioden", none: "inga",
    mapFn: "Cirkelns storlek: skickade prov på 52 veckor. Färg: över avdelningens normala nivå i perioden, bara vid minst 3 fall. Linjer: gemensamma patienter, tjockare när de är fler.",
    whenFn: "Staplar: fall per vecka efter resistenstyp (ett fall med två typer räknas i båda). Streckad linje: normal veckonivå. Skuggat: perioden.",
    patterns: "{n} mönster", whatFn: "Ett mönster är mikroben och dess svar för vart och ett av de 12 testade antibiotika. Första resistenta isolat per patient och typ.",
    drugsQ: "Hur ofta varje antibiotikum dödade liknande patienters bakterier", spectrum: "Spektrum", basis: "Underlag", killed12: "Dödade, senaste 12 mån", ci: "95 %-intervall",
    note: "Obs", changedNote: "senaste {weeks} veckorna tydligt annorlunda", basisWard: "denna avdelning", basisAll: "alla avdelningar", wardOnly: "avdelningen har {n}",
    drugsFn: "Prick: andel dödade de senaste 12 månaderna; band: 95 %-intervall; streckad linje: 80 %; triangel: senaste {weeks} veckorna (grå vid färre än 30 tester).",
    selected: "Valt antibiotikum", month: "Månad", tested: "Testade", killed: "Dödade", share: "Andel", monthlyFn: "Andel dödade per månad, senaste 12 månaderna; prickens storlek följer antalet testade. Innevarande månad är inte komplett.",
    growsSub: "Andel av första isolat, senaste 12 månaderna, {n} isolat.", hist: "Patientens prov", survivedCol: "Överlevde",
    signals: "Signaler", cohort: "Liknande patienter: {y} första isolat på 12 månader, {r} de senaste {weeks} veckorna.",
    patient: "Patient", typical: "Typisk patient för valen", drug: "Antibiotikum", narrow: "smalt", moderate: "medel", broad: "brett", reserve: "reserv",
  },
};
const xt = (k, v = {}) => String(XS[LANG]?.[k] ?? XS.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
const xe = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const xnum = (v, d = 0) => v == null || isNaN(v) ? "–" : (+v).toLocaleString(loc(), { minimumFractionDigits: d, maximumFractionDigits: d });
const xpct = (v, d = 0) => v == null || isNaN(v) ? "–" : xnum(v * 100, d) + "%";
const xr = v => Math.round(v * 10) / 10;
const xmonth = (ym, withYear) => new Date(ym + "-01T00:00").toLocaleDateString(loc(), withYear ? { month: "short", year: "numeric" } : { month: "short" });
const xshort = s => new Date(s + "T00:00").toLocaleDateString(loc(), { day: "numeric", month: "short" });

// ---------- small SVG and layout builders ----------
const xsvg = (W, H, inner, label, cls = "") => `<svg class="${cls}" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${xe(label)}" xmlns="http://www.w3.org/2000/svg" font-family="Inter, system-ui, sans-serif">${inner}</svg>`;
const xtext = (x, y, s, o = {}) => `<text x="${xr(x)}" y="${xr(y)}" font-size="${o.size || 10}" fill="${o.fill || XP.ink3}"${o.anchor ? ` text-anchor="${o.anchor}"` : ""}${o.weight ? ` font-weight="${o.weight}"` : ""}>${xe(s)}</text>`;
const xline = (x1, y1, x2, y2, stroke, o = {}) => `<line x1="${xr(x1)}" y1="${xr(y1)}" x2="${xr(x2)}" y2="${xr(y2)}" stroke="${stroke}" stroke-width="${o.w || 1}"${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.op != null ? ` stroke-opacity="${o.op}"` : ""}${o.cap ? ` stroke-linecap="${o.cap}"` : ""}/>`;
const xrect = (x, y, w, h, fill, o = {}) => `<rect x="${xr(x)}" y="${xr(y)}" width="${xr(Math.max(0, w))}" height="${xr(Math.max(0, h))}" fill="${fill}"${o.rx ? ` rx="${o.rx}"` : ""}${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ""}${o.dash ? ` stroke-dasharray="${o.dash}"` : ""}${o.op != null ? ` fill-opacity="${o.op}"` : ""}/>`;
const xcirc = (cx, cy, r, fill, o = {}) => `<circle cx="${xr(cx)}" cy="${xr(cy)}" r="${xr(r)}" fill="${fill}"${o.stroke ? ` stroke="${o.stroke}" stroke-width="${o.sw || 1}"` : ""}${o.op != null ? ` opacity="${o.op}"` : ""}/>`;
const xlegend = items => `<p class="xleg">${items.map(([c, label, shape]) => `<span><i class="${shape || ""}" style="--c:${c}"></i>${xe(label)}</span>`).join("")}</p>`;
// rows: arrays of cell HTML (already escaped)
// cols: [label, numeric?, extra class]; "nw" keeps a column on one line
const xcls = c => { const k = [c && c[1] ? "n" : "", c && c[2] || ""].filter(Boolean).join(" "); return k ? ` class="${k}"` : ""; };
const xtable = (cols, rows, cls = "") => rows.length ? `<table class="${cls}"><thead><tr>${cols.map(c => `<th${xcls(c)}>${xe(c[0])}</th>`).join("")}</tr></thead>
  <tbody>${rows.map(r => `<tr>${r.map((c, i) => `<td${xcls(cols[i])}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "";
const xsec = ({ q, big, sub, fig, legend = "", table = "", fn = "", extra = "" }) =>
  `<section class="xs"><div class="xkeep"><h2 class="xq">${xe(q)}</h2>${big ? `<p class="xbig">${big}</p>` : ""}${sub ? `<p class="xsub">${sub}</p>` : ""}${fig ? `<figure>${fig}</figure>` : ""}${legend}</div>${table}${extra}${fn ? `<p class="fn">${fn}</p>` : ""}</section>`;
const xsmall = s => `<small>${s}</small>`;

// ---------- morning brief ----------
function xBrief() {
  const B = BR, col = XTYPE, sections = [];
  // 1 · new cases since yesterday
  {
    const cs = B.new_cases, hosp = cs.filter(c => (c.hday || 0) >= 3).length, wards = META.wards.map(w => w.code), W = 680, bw = W / wards.length;
    const per = d3.group(cs, c => c.ward), maxN = d3.max(wards, w => (per.get(w) || []).length) || 0, rows = Math.max(1, Math.ceil(maxN / 4)), H = 40 + rows * 16;
    let s = "";
    wards.forEach((w, i) => {
      const cx = i * bw + bw / 2, list = per.get(w) || [];
      s += xline(i * bw + 6, H - 24, (i + 1) * bw - 6, H - 24, XP.line);
      s += xtext(cx, H - 8, w, { anchor: "middle", fill: list.length ? XP.ink : XP.ink3, weight: list.length ? 600 : null });
      list.forEach((c, k) => { const c0 = col[c.flags[0]] || XP.accent, hospital = (c.hday || 0) >= 3;
        s += xcirc(cx + ((k % 4) - 1.5) * 14, H - 34 - Math.floor(k / 4) * 16, 5.5, hospital ? c0 : XP.paper, { stroke: c0, sw: 1.8 }); });
    });
    const types = [...new Set(cs.flatMap(c => c.flags))];
    const rowsT = [...cs].sort((a, b) => a.ward.localeCompare(b.ward) || a.date.localeCompare(b.date)).map(c => [
      `<b>${xe(c.ward)}</b>`, `<i>${xe(c.short)}</i>`, xe(c.flags.join(", ")), xe(specName(c.spec)), xe(niceDate(c.date)), c.hday ? xe(t("wDay", { d: c.hday })) : `<span class="mute">${xt("early")}</span>`, `<span class="mute">${xe(c.id)}</span>`]);
    sections.push(xsec({ q: t("bNewQ"), big: cs.length ? xe(t("bNewBig", { n: cs.length })) : xe(t("bNewNone")),
      sub: cs.length ? xe(t("bNewSub", { h: hosp })) : "", fig: cs.length ? xsvg(W, H, s, t("bNewQ")) : "",
      legend: cs.length ? xlegend([...types.map(tp => [col[tp], tp]), [XP.ink3, xt("filled")], [XP.ink3, xt("open"), "open"]]) : "",
      table: xtable([[xt("ward"), 0, "nw"], [xt("organism"), 0, "nw"], [xt("resistance")], [xt("sample")], [xt("sampled"), 0, "nw"], [xt("stay")], [xt("caseId"), 0, "nw"]], rowsT) }));
  }
  // 2 · clusters
  {
    const cl = B.clusters, active = cl.filter(c => c.status !== "over").length;
    const spark = c => { const W = 180, mx = Math.max(1, d3.max(c.daily)), H = 14 + mx * 6, x = i => 4 + i * (W - 8) / 59; let s = xline(0, H - 6, W, H - 6, XP.line);
      c.daily.forEach((n, i) => { for (let j = 0; j < n; j++) s += xcirc(x(i), H - 10 - j * 6, 2.4, c.status === "over" ? XP.grey : XP.accent); });
      return xsvg(W, H, s, `${c.organism} ${c.flags.join(" ")}`, "inl"); };
    const rows = cl.map(c => [`<span class="st ${c.status === "new" || c.status === "growing" ? "acc" : c.status === "over" ? "mute" : ""}">${xe(t("cl_" + c.status))}</span>`,
      `<b><i>${xe(c.organism)}</i></b> ${xe(c.flags.join(" "))}${xsmall(xe(c.wards.join(", ")))}`, `${fmt(c.n)}`, `${fmt(c.hospital ?? 0)}`,
      `${xe(niceDate(c.first))} – ${xe(niceDate(c.last))}${xsmall(xe(xt("sinceLast", { d: c.since })))}`, spark(c)]);
    sections.push(xsec({ q: t("bClusterQ"), big: xe(active ? t("bClusterBig", { n: active }) : t("bClusterNone")),
      table: xtable([[xt("status")], [xt("cluster")], [xt("cases"), 1], [xt("day3"), 1], [xt("firstLast")], [xt("last60")]], rows, "cl"), fn: xt("clFn") }));
  }
  // 3 · wards against their own normal
  {
    const ws = [...B.all_wards].sort((a, b) => b.z - a.z), above = B.wards, W = 680, rh = 24, top = 6, H = ws.length * rh + top + 26;
    const band = w => [Math.max(0, w.expected - 2 * Math.sqrt(w.expected + .5)), w.expected + 2 * Math.sqrt(w.expected + .5)];
    const max = Math.max(6, d3.max(ws, w => Math.max(w.recent, band(w)[1]))), x = d3.scaleLinear().domain([0, max]).nice().range([64, W - 70]);
    let s = "";
    x.ticks(6).forEach(v => { s += xline(x(v), top, x(v), H - 22, XP.faint); s += xtext(x(v), H - 8, xnum(v), { anchor: "middle" }); });
    ws.forEach((w, i) => {
      const y = top + i * rh, [lo, hi] = band(w), flagged = w.recent >= MIN_CASES && w.z > 2;
      s += xtext(0, y + 13, w.code, { fill: flagged ? XP.accent : XP.ink2, weight: flagged ? 600 : null });
      s += xrect(x(lo), y + 3, Math.max(2, x(hi) - x(lo)), 12, XP.band, { rx: 6 });
      s += xline(x(w.expected), y, x(w.expected), y + 18, XP.ink3, { dash: "2 2" });
      s += xcirc(x(w.recent), y + 9, 5.5, flagged ? XP.accent : w.recent < MIN_CASES ? XP.paper : XP.ink, { stroke: flagged ? XP.accent : XP.ink2, sw: 1.4 });
      s += xtext(W, y + 13, `${fmt(w.recent)}`, { anchor: "end", fill: flagged ? XP.accent : XP.ink, weight: 600, size: 11 });
    });
    const rows = ws.map(w => { const [lo, hi] = band(w), flagged = w.recent >= MIN_CASES && w.z > 2;
      return [`<b>${xe(w.code)}</b>`, xe(wardName(w.code)), fmt(w.recent), xnum(w.expected, 1), `${xnum(lo, 1)}–${xnum(hi, 1)}`, xnum(w.z, 2),
        flagged ? `<span class="acc">${xt("above")}</span>` : w.recent < MIN_CASES ? `<span class="mute">${xt("tooFew")}</span>` : xt("within")]; });
    sections.push(xsec({ q: t("bWardsQ"), big: xe(above.length ? t("bWardsBig", { w: above.map(w => w.code).join(", ") }) : t("bWardsNone")), sub: xe(t("bWardsSub")),
      fig: xsvg(W, H, s, t("bWardsQ")), legend: xlegend([[XP.band, xt("usualRange"), "bar"], [XP.ink3, xt("usual"), "dash"], [XP.accent, xt("above")]]),
      table: xtable([[xt("ward")], [xt("name")], [xt("last4"), 1], [xt("usual"), 1], [xt("usualRange"), 1], [xt("z"), 1], [xt("reading")]], rows), fn: xt("wardsFn") }));
  }
  // 4 · slow trends
  {
    const tr = B.trends, crossed = tr.filter(x => x.crossed);
    const spark = x => {
      const W = 200, H = 56, pts = x.series.map((m, i) => ({ i, v: m.n >= 10 ? m.r / m.n : null, month: m.month })), vals = pts.filter(p => p.v != null).map(p => p.v);
      const sx = d3.scaleLinear().domain([0, pts.length - 1]).range([2, W - 2]), lo = Math.max(0, d3.min(vals) - .02), hi = d3.max(vals) + .02, sy = d3.scaleLinear().domain([lo, hi]).range([H - 16, 10]);
      let s = "";
      B.versions.forEach(v => { const i = pts.findIndex(p => p.month === v.from); if (i >= 0) s += xline(sx(i), 8, sx(i), H - 14, XP.violet, { dash: "2 3" }); });
      s += `<path d="${d3.line().defined(p => p.v != null).x(p => xr(sx(p.i))).y(p => xr(sy(p.v))).curve(d3.curveLinear)(pts)}" fill="none" stroke="${x.crossed ? XP.accent : XP.ink2}" stroke-width="1.5"/>`;
      s += xtext(2, H - 2, xmonth(pts[0].month, true), { size: 8.5 }) + xtext(W - 2, H - 2, xmonth(pts[pts.length - 1].month, true), { size: 8.5, anchor: "end" });
      s += xtext(W - 2, 7, `${xpct(lo)}–${xpct(hi)}`, { size: 8, anchor: "end" });
      return xsvg(W, H, s, `${x.organism} ${x.drug}`, "inl");
    };
    const rows = tr.map(x => { const a = x.series.slice(-12), b = x.series.slice(0, 12), r1 = d3.sum(a, m => m.r), r0 = d3.sum(b, m => m.r);
      return [`<b><i>${xe(x.organism)}</i></b> · ${xe(drugName(x.drug))}${x.spec ? ` · ${xe(specName(x.spec))}` : ""}`,
        `<b>${xpct(x.now, 1)}</b>${xsmall(xe(xt("resistantOf", { r: fmt(r1), n: fmt(x.n_now) })))}`, `${xpct(x.before, 1)}${xsmall(xe(xt("resistantOf", { r: fmt(r0), n: fmt(x.n_before) })))}`,
        xnum(x.z, 2), x.crossed ? `<span class="acc">${xt("crossed")}</span>` : xt("noChange"), spark(x)]; });
    const ver = B.versions.length ? " " + xt("trendsVer", { v: B.versions[B.versions.length - 1].version, m: xmonth(B.versions[B.versions.length - 1].from, true) }) : "";
    sections.push(xsec({ q: t("bTrendsQ"), big: xe(crossed.length ? t("bTrendsBig", { n: crossed.length }) : t("bTrendsNone")), sub: xe(t("bTrendsSub")),
      table: xtable([[xt("pair")], [xt("now12"), 1], [xt("before12"), 1], [xt("z"), 1], [xt("reading")], [xt("months24")]], rows, "tr"), fn: xt("trendsFn") + ver }));
  }
  // 5 · data health
  {
    const hs = B.health, gaps = hs.filter(h => h.missing_days), late = Object.entries(B.late);
    const big = gaps.length ? t("bHealthGaps", { w: gaps.map(h => h.ward).join(", ") }) : late.length ? t("bHealthLate", { w: late.map(([w]) => w).join(", ") }) : t("bHealthOk");
    const W = 680, rh = 26, H = hs.length * rh + 22, x = d3.scaleBand().domain(d3.range(14)).range([64, W - 60]).padding(.2);
    let s = "";
    hs.forEach((h, i) => {
      const y = i * rh, max = Math.max(3, d3.max(h.days, d => Math.max(d.n, d.usual)));
      s += xtext(0, y + 16, h.ward, { fill: h.missing_days ? XP.amber : XP.ink2, weight: h.missing_days ? 600 : null });
      h.days.forEach((d, k) => {
        const missing = d.n === 0 && d.usual >= 2, bh = Math.max(1.5, d.n / max * 18);
        if (missing) s += xrect(x(k), y + 2, x.bandwidth(), 18, "none", { rx: 2, stroke: XP.amber, dash: "2 2", sw: 1.2 });
        else s += xrect(x(k), y + 20 - bh, x.bandwidth(), bh, XP.grey, { rx: 1 });
        if (d.usual > 0) s += xline(x(k) - 1, y + 20 - d.usual / max * 18, x(k) + x.bandwidth() + 1, y + 20 - d.usual / max * 18, XP.ink2, { w: .9 });
      });
      s += xtext(W, y + 16, fmt(d3.sum(h.days, d => d.n)), { anchor: "end", fill: XP.ink, weight: 600 });
    });
    const days = hs[0] ? hs[0].days : [];
    [0, 7, 13].forEach(k => { if (days[k]) s += xtext(x(k) + x.bandwidth() / 2, H - 4, xshort(days[k].day), { anchor: "middle", size: 9 }); });
    const rows = hs.map(h => [`<b>${xe(h.ward)}</b>`, fmt(d3.sum(h.days, d => d.n)), xnum(d3.sum(h.days, d => d.usual), 1), h.missing_days ? `<span class="amb">${fmt(h.missing_days)}</span>` : "0",
      fmt(h.pending || 0), B.late[h.ward] ? `<span class="amb">${fmt(B.late[h.ward])}</span>` : "0"]);
    const ver = B.versions.length ? `<p class="xsub">${xe(t("bVersion", { v: B.versions[B.versions.length - 1].version, m: xmonth(B.versions[B.versions.length - 1].from, true) }))}</p>` : "";
    sections.push(xsec({ q: t("bHealthQ"), big: xe(big), sub: xe(t("bHealthSub")), fig: xsvg(W, H, s, t("bHealthQ")),
      legend: xlegend([[XP.grey, xt("samples14"), "bar"], [XP.ink, xt("usual"), "tick"], [XP.amber, t("bHealthGaps", { w: "" }).replace(/[:：]\s*$/, ""), "box"]]),
      table: xtable([[xt("ward")], [xt("samples14"), 1], [xt("usual14"), 1], [xt("missing7"), 1], [xt("pending"), 1], [xt("late"), 1]], rows), extra: ver, fn: xt("healthFn") }));
  }
  // 6 · from colleagues
  {
    const ns = B.notes;
    sections.push(xsec({ q: t("bNotesQ"), big: xe(ns.length ? t("bNotesBig", { n: ns.length }) : t("bNotesNone")),
      extra: ns.length ? `<ul class="xnotes">${ns.map(r => `<li>${xe(shareText({ ...r.fields, ward: r.fields.ward || "", sample: r.fields.sample || "" }))}${xsmall(`${xe(t("deid"))} · ${xe(r.fields.month)}`)}</li>`).join("")}</ul>` : "" }));
  }
  return { title: t("briefTitle"), asof: B.today, lead: xe(`${longDate(B.today)} · ${t("sinceYesterday")} (${niceDate(B.yesterday)})`), sections, scope: "" };
}

// ---------- ward overview ----------
function xWards() {
  const win = winSet(), ward = WS.ward, fp = WS.fp, types = HYG.types, col = XTYPE, sections = [];
  const from = wkDate(win[0]), to = wkDate(win[1] + 1), nW = win[1] - win[0] + 1;
  // the sentence on the page, for the committed window (never a hover preview)
  const zs = WD.wards.map(w => { const n = casesIn({ ward: w.code, fp: null, win }).length; return { ...w, n, wz: winZ(w, n, win), ew: w.expected / 4 * nW }; }).sort((a, b) => b.wz - a.wz);
  const top = zs[0], nSel = casesIn({ ward, fp, win }).length;
  const lead = `${xe(types.join(", "))} · ${xe(from)} – ${xe(to)}. ` + (ward ? `<b>${xe(wardName(ward))}</b>: ${nSel} ${xe(t("wCases"))}.`
    : top.wz > 2 && top.n >= MIN_CASES ? t("wMost", { ward: `<b>${xe(wardName(top.code))}</b>`, n: top.n, e: xnum(top.ew, 1) }) : zs.every(w => w.n < MIN_CASES) ? xe(t("wFew")) : xe(t("wCalm")));
  const fpCase = fp ? WD.cases.find(c => c.fp + c.short === fp) : null;
  const scope = `<dt>${xt("window")}</dt><dd>${xe(from)} – ${xe(to)} · ${xe(t("weeks", { n: nW }))}</dd><dt>${xt("types")}</dt><dd>${xe(types.join(", "))}</dd>` +
    (ward ? `<dt>${xt("focusWard")}</dt><dd>${xe(ward)} · ${xe(wardName(ward))}</dd>` : "") + (fpCase ? `<dt>${xt("focusPattern")}</dt><dd><i>${xe(fpCase.short)}</i> ${xe(fpCase.flags.join(" "))}</dd>` : "");
  // 1 · when: cases per week, the window shaded
  {
    const W = 680, H = 190, m = { l: 34, r: 64, t: 24, b: 22 }, wsel = ward ? WD.wards.filter(w => w.code === ward) : WD.wards;
    const per = d3.range(WD.weeks).map(k => { const o = { k }; types.forEach(tp => o[tp] = 0); return o; });
    WD.cases.forEach(c => { if (ward && c.ward !== ward) return; const k = wkOf(c.date); if (k < 0) return; c.flags.forEach(f => { if (per[k][f] != null) per[k][f] += 1; }); });
    const x = d3.scaleBand().domain(d3.range(WD.weeks)).range([m.l, W - m.r]).padding(.18), ymax = Math.max(4, d3.max(per, o => d3.sum(types, tp => o[tp])));
    const y = d3.scaleLinear().domain([0, ymax]).nice().range([H - m.b, m.t]), exp = d3.sum(wsel, w => w.expected) / 4;
    let s = "";
    y.ticks(4).forEach(v => { s += xline(m.l, y(v), W - m.r, y(v), XP.faint); s += xtext(m.l - 6, y(v) + 3, xnum(v), { anchor: "end", size: 9 }); });
    const x0 = x(win[0]) - 3, x1 = x(win[1]) + x.bandwidth() + 3;
    s += `<rect x="${xr(x0)}" y="${m.t - 6}" width="${xr(x1 - x0)}" height="${H - m.b - m.t + 6}" rx="6" fill="${XP.accent}" fill-opacity=".08" stroke="${XP.accent}" stroke-opacity=".5"/>`;
    d3.stack().keys(types)(per).forEach(layer => layer.forEach((d, i) => { const h = y(d[0]) - y(d[1]); if (h > 0) s += xrect(x(i), y(d[1]), x.bandwidth(), h, col[layer.key], { rx: 1 }); }));
    s += xline(m.l, y(exp), W - m.r + 4, y(exp), XP.ink3, { dash: "3 4" }) + xtext(W - m.r + 8, y(exp) + 3, `${t("wUsual")} ${xnum(exp, 1)}`, { size: 9 });
    s += xline(m.l, H - m.b, W - m.r, H - m.b, XP.line);
    d3.range(0, WD.weeks, 8).forEach(k => { s += xtext(x(k) + x.bandwidth() / 2, H - 6, xshort(new Date(new Date(WD.start).getTime() + k * 6048e5).toISOString().slice(0, 10)), { anchor: "middle", size: 9 }); });
    const lab = `${from} – ${to} · ${t("weeks", { n: nW })}`, lw = lab.length * 5.4, lx = Math.max(m.l + lw / 2, Math.min(W - m.r - lw / 2, (x0 + x1) / 2));
    s += xtext(lx, m.t - 11, lab, { anchor: "middle", fill: XP.accent, weight: 600, size: 10 });
    const totals = types.map(tp => `${tp} ${fmt(d3.sum(per, o => o[tp]))}`).join(" · ");
    const rows = d3.range(win[0], win[1] + 1).map(k => [xe(wkDate(k)), ...types.map(tp => fmt(per[k][tp])), `<b>${fmt(d3.sum(types, tp => per[k][tp]))}</b>`, xnum(exp, 1)]);
    sections.push(xsec({ q: xt("xWhen"), big: `${fmt(casesIn({ ward, fp: null, win }).length)} <span class="xbigsub">${xe(t("wCases"))}</span>`,
      sub: xe(xt("typeTotals", { list: totals })), fig: xsvg(W, H, s, xt("xWhen")), legend: xlegend([...types.map(tp => [col[tp], tp, "bar"]), [XP.ink3, t("wUsual"), "dash"]]),
      table: xtable([[xt("weekOf"), 0, "nw"], ...types.map(tp => [tp, 1]), [xt("total"), 1], [xt("usual"), 1]], rows), fn: xt("whenFn") }));
  }
  // 2 · where: the schematic map, then every ward with its numbers, then the shared-patient links
  {
    const W = 600, H = 400, counts = Object.fromEntries(WD.wards.map(w => [w.code, casesIn({ ward: w.code, fp, win }).length]));
    const vmax = d3.max(WD.wards, w => d3.sum(w.volume)), r = d3.scaleSqrt().domain([0, vmax]).range([14, 46]);
    const lmax = d3.max(WD.links, l => l.n), lw = d3.scaleSqrt().domain([0, lmax]).range([0, 6]);
    const near = new Set(ward ? WD.links.filter(l => l.a === ward || l.b === ward).sort((a, b) => b.n - a.n).slice(0, 3).flatMap(l => [l.a, l.b]) : []);
    const mid = d3.interpolate(XP.band, XP.accent)(.45);
    const heat = w => fp ? (counts[w.code] ? XP.accent : XP.band) : counts[w.code] < MIN_CASES ? XP.band : (z => z > 2 ? XP.accent : z > 1 ? mid : XP.band)(winZ(w, counts[w.code], win));
    let s = xrect(120, 52, 360, 312, "none", { rx: 28, stroke: XP.line, dash: "2 5" }) + xtext(300, 44, t("wHospital"), { anchor: "middle", size: 11 }) + xtext(62, 30, t("wCentres"), { anchor: "middle", size: 11 });
    WD.links.forEach(l => { const on = ward && (l.a === ward || l.b === ward);
      s += xline(PLACE[l.a][0], PLACE[l.a][1], PLACE[l.b][0], PLACE[l.b][1], on ? XP.ink : XP.ink3, { w: xr(lw(l.n)), op: !ward ? .16 : on ? .45 : .05, cap: "round" }); });
    WD.wards.forEach(w => { const [cx, cy] = PLACE[w.code], rr = r(d3.sum(w.volume)), h = heat(w), dim = ward && !near.has(w.code) && w.code !== ward;
      s += `<g${dim ? ' opacity=".4"' : ""}>` + xcirc(cx, cy, rr, h, { stroke: w.code === ward ? XP.ink : XP.line, sw: w.code === ward ? 2.5 : 1 });
      s += xtext(cx, cy + 5, fmt(counts[w.code]), { anchor: "middle", size: 15, weight: 600, fill: h === XP.accent ? "#fff" : counts[w.code] < MIN_CASES ? XP.ink3 : XP.ink });
      s += xtext(cx, cy + rr + 14, w.code, { anchor: "middle", size: 11, weight: 600, fill: XP.ink2 }) + "</g>"; });
    const rows = [...zs].sort((a, b) => b.wz - a.wz).map(w => { const n = counts[w.code], flagged = !fp && n >= MIN_CASES && w.wz > 2;
      return [`<b>${xe(w.code)}</b>`, xe(wardName(w.code)), fmt(d3.sum(w.volume)), `<b>${fmt(n)}</b>`, xnum(w.ew, 1), xnum(w.wz, 1),
        fp ? "" : flagged ? `<span class="acc">${xt("above")}</span>` : n < MIN_CASES ? `<span class="mute">${xt("tooFew")}</span>` : w.wz > 1 ? `${xt("within")} (z > 1)` : xt("within")]; });
    const links = [...WD.links].sort((a, b) => b.n - a.n).map(l => `<li><span>${xe(l.a)} – ${xe(l.b)}</span><b>${fmt(l.n)}</b></li>`).join("");
    const aboveW = fp ? [] : zs.filter(w => counts[w.code] >= MIN_CASES && w.wz > 2).map(w => w.code);
    sections.push(xsec({ q: xt("xWhere"), big: xe(fp ? `${fmt(d3.sum(Object.values(counts)))} ${t("wCases")}` : aboveW.length ? t("bWardsBig", { w: aboveW.join(", ") }) : zs.every(w => w.n < MIN_CASES) ? t("wFew") : t("wCalm")),
      fig: xsvg(W, H, s, xt("xWhere"), "map"),
      legend: xlegend([[XP.accent, xt("above")], [mid, "z > 1"], [XP.band, xt("within") + " / " + xt("tooFew")]]) + `<p class="fn">${xe(xt("mapFn"))}</p>`,
      table: xtable([[xt("ward")], [xt("name")], [xt("samplesSent"), 1], [xt("inWindow"), 1], [xt("usualWindow"), 1], [xt("z"), 1], [xt("reading")]], rows),
      extra: `<div class="xkeep"><h3 class="xh3">${xe(xt("shared"))}</h3><ul class="xlinks">${links}</ul><p class="fn">${xe(xt("sharedFn"))}</p></div>` }));
  }
  // 3 · what: every pattern in the window, spelled out, then every case
  {
    const list = casesIn({ ward, fp: null, win }), groups = d3.groups(list, c => c.fp + c.short).sort((a, b) => b[1].length - a[1].length);
    const names = WD.drugs.map(d => drugName(d));
    const strip = f => { let s = ""; WD.drugs.forEach((d, i) => { s += xrect(i * 9, 2, 7, 7, f[i] === "R" ? XP.accent : f[i] === "S" ? "#9a9ba0" : XP.faint, { rx: 1.5 }); }); return xsvg(WD.drugs.length * 9, 11, s, "pattern", "inl strip"); };
    const rows = groups.map(([key, cs]) => { const f = cs[0].fp, R = names.filter((_, i) => f[i] === "R"), Sx = names.filter((_, i) => f[i] === "S"), ds = cs.map(c => c.date).sort();
      return [`<b><i>${xe(cs[0].short)}</i></b> ${xe(cs[0].flags.join(" "))}${key === fp ? ` <span class="acc">●</span>` : ""}${xsmall(strip(f))}`, `<b>${fmt(cs.length)}</b>`,
        xe([...new Set(cs.map(c => c.ward))].join(", ")), `${xe(xshort(ds[0]))}${ds.length > 1 ? ` – ${xe(xshort(ds[ds.length - 1]))}` : ""}`,
        R.length ? xe(R.join(", ")) : `<span class="mute">${xt("none")}</span>`, Sx.length ? `<span class="mute">${xe(Sx.join(", "))}</span>` : `<span class="mute">${xt("none")}</span>`]; });
    const cases = [...list].sort((a, b) => a.date.localeCompare(b.date) || a.ward.localeCompare(b.ward)).map(c => [xe(niceDate(c.date)), `<b>${xe(c.ward)}</b>`, `<i>${xe(c.short)}</i>`, xe(c.flags.join(", ")),
      c.hday ? xe(t("wDay", { d: c.hday })) : `<span class="mute">${xt("early")}</span>`, xe(specName(c.spec)), `<span class="mute">${xe(c.id)}</span>`]);
    sections.push(xsec({ q: xt("xWhat"), big: groups.length ? xe(xt("patterns", { n: groups.length })) : xe(t("wNone")),
      sub: groups.length ? `${xe(t("wPatterns"))}: ${groups.filter(([, cs]) => new Set(cs.map(c => c.ward)).size > 1).length}` : "",
      legend: groups.length ? xlegend([[XP.accent, "R"], ["#9a9ba0", "S"], [XP.faint, "–"]].map(([c, l]) => [c, l, "sq"])) + `<p class="fn">${xe(names.join(" · "))}</p>` : "",
      table: xtable([[t("wPatterns")], [xt("cases"), 1], [xt("wardsCol")], [xt("dates"), 0, "nw"], [xt("resistantTo")], [xt("susceptibleTo")]], rows, "fpt") +
        (cases.length ? `<h3 class="xh3">${xe(xt("allCases"))}</h3>` + xtable([[xt("sampled"), 0, "nw"], [xt("ward"), 0, "nw"], [xt("organism"), 0, "nw"], [xt("resistance")], [xt("stay")], [xt("sample")], [xt("caseId"), 0, "nw"]], cases) : ""),
      fn: xt("whatFn") }));
  }
  return { title: t("wardsTitle"), asof: WD.asof, lead, sections, scope };
}

// ---------- doctor: will it work here? ----------
async function xDoctor() {
  const sections = [], wardObj = META.wards.find(w => w.code === F.ward);
  const spec = k => xt(k) || k;
  let lead;
  if (PT) { const cur = PT.history[0], age = new Date(META.last).getFullYear() - +PT.birth_year;
    lead = t("sentencePt", { who: t("ptWho", { sex: PT.sex === "M" ? t("man") : t("woman"), age }), spec: specName(cur.spec), date: niceDate(cur.date),
      lab: F.org ? t("labNamed", { org: `<b><i>${xe(F.org)}</i></b>` }) : t("labWaiting"), ward: wardObj ? wardName(wardObj.code) : t("anyWard") });
  } else lead = t("sentence", { sex: F.sex === "M" ? t("man") : t("woman"), age: F.age === "65+" ? t("over65") : F.age === "<65" ? t("under65") : t("anyAge"),
      spec: specName(F.spec), org: F.org ? t("sentenceOrg", { org: `<b><i>${xe(F.org)}</i></b>` }) : "", ward: wardObj ? wardName(wardObj.code) : t("anyWard") });
  const scope = `<dt>${xt("patient")}</dt><dd>${PT ? `${xe(PT.id)} · ${PT.sex === "M" ? xe(t("Man")) : xe(t("Woman"))}, ${new Date(META.last).getFullYear() - +PT.birth_year}` : xe(xt("typical"))}</dd>` +
    `<dt>${xe(t("ward"))}</dt><dd>${wardObj ? `${xe(wardObj.code)} · ${xe(wardName(wardObj.code))}` : xe(t("allWards"))}</dd>`;
  const NAMES = { count: t("sigCount"), rate: t("sigRate"), drift: t("sigDrift"), new: t("sigNew") };
  const signals = [...AB.signals.map(a => `<li><i style="--c:${XP.accent}"></i>${xe(`${NAMES[a.type] || "Signal"}: ${a.target}${a.ward !== "ALL" ? " · " + a.ward : ""} · ${t("since")} ${niceDate(a.from)}`)}</li>`),
    ...AB.gaps.map(a => `<li><i style="--c:${XP.amber}"></i>${xe(t("missing", { ward: a.ward, d: niceDate(a.from) }))}</li>`)];
  const before = code => { if (!PT) return null; for (const h of PT.history.slice(1)) for (const i of h.isolates) if (i.resisted.includes(code)) return `${i.short}, ${niceDate(h.date)}`; return null; };
  // 1 · every drug: share killed with its interval, the last four weeks, and the 80% line
  if (AB.drugs.length) {
    const W = 680, rh = 34, top = 20, H = top + AB.drugs.length * rh + 22, x = d3.scaleLinear().domain([0, 1]).range([186, W - 116]);
    let s = "";
    [0, .2, .4, .6, .8, 1].forEach(v => { s += xline(x(v), top - 4, x(v), H - 20, v === .8 ? XP.accent : XP.faint, v === .8 ? { dash: "3 3" } : {}); s += xtext(x(v), H - 6, xpct(v), { anchor: "middle", size: 9, fill: v === .8 ? XP.accent : XP.ink3 }); });
    AB.drugs.forEach((d, i) => {
      const y = top + i * rh, yr = d.year, rc = d.recent, low = Math.round(yr.share * 100) < 80, sel = d.code === F.drug;
      s += xtext(0, y + 12, cap(drugName(d.code, d.name)), { fill: sel ? XP.accent : XP.ink, weight: 600, size: 11 });
      s += xtext(0, y + 25, `${spec(d.spectrum)} · ${d.source === "ward" ? xt("basisWard") : xt("basisAll")}`, { size: 9 });
      s += xrect(x(0), y + 10, x(1) - x(0), 6, XP.band, { rx: 3 }) + xrect(x(yr.ci[0]), y + 9, Math.max(2, x(yr.ci[1]) - x(yr.ci[0])), 8, "#d3d0c7", { rx: 4 });
      s += xcirc(x(yr.share), y + 13, 5.5, low ? XP.accent : XP.ink);
      if (rc.n) { const tx = x(rc.share); s += `<path d="M${xr(tx - 4.5)},${y - 1} L${xr(tx + 4.5)},${y - 1} L${xr(tx)},${y + 6} Z" fill="${rc.n < 30 ? XP.grey : XP.cool}"/>`; }
      s += xtext(W - 56, y + 17, xpct(yr.share), { anchor: "end", size: 14, weight: 600, fill: low ? XP.accent : XP.ink });
      s += xtext(W, y + 16, `${fmt(yr.s)}/${fmt(yr.n)}`, { anchor: "end", size: 9 });
    });
    const rows = AB.drugs.map(d => { const yr = d.year, rc = d.recent, b = before(d.code), notes = [d.changed ? `<span class="acc">${xt("changedNote", { weeks: AB.recent_weeks || 4 })}</span>` : "", b ? `<span class="acc">${xe(t("survivedBefore"))} · ${xe(b)}</span>` : ""].filter(Boolean).join("<br>");
      return [`<b${d.code === F.drug ? ' class="acc"' : ""}>${xe(cap(drugName(d.code, d.name)))}</b>${xsmall(xe(spec(d.spectrum)))}`, xe(d.source === "ward" ? xt("basisWard") : xt("basisAll") + (AB.ward ? ` (${xt("wardOnly", { n: d.ward_n ?? 0 })})` : "")),
        `${fmt(yr.s)} ${xe(t("of"))} ${fmt(yr.n)}`, `<b${Math.round(yr.share * 100) < 80 ? ' class="acc"' : ""}>${xpct(yr.share)}</b>`, `${xpct(yr.ci[0])}–${xpct(yr.ci[1])}`,
        rc.n ? `${fmt(rc.s)} ${xe(t("of"))} ${fmt(rc.n)} · ${xpct(rc.share)}${rc.n < 30 ? xsmall(xe(t("tooFew").replace(/^,\s*/, ""))) : ""}` : `<span class="mute">${xe(t("noTests"))}</span>`, notes]; });
    sections.push(xsec({ q: xt("drugsQ"), big: "", sub: xe(xt("cohort", { y: fmt(AB.n_year), r: fmt(AB.n_recent), weeks: AB.recent_weeks || 4 })), fig: xsvg(W, H, s, xt("drugsQ")),
      legend: xlegend([[XP.ink, t("legKilled")], ["#d3d0c7", xt("ci"), "bar"], [XP.cool, Profile.recentLabel(AB.recent_weeks || 4), "tri"], [XP.accent, "80%", "dash"]]),
      table: xtable([[xt("drug")], [xt("basis"), 0, "nw"], [xt("killed12"), 1], ["%", 1], [xt("ci"), 1], [Profile.recentLabel(AB.recent_weeks || 4), 1], [xt("note")]], rows), fn: xt("drugsFn", { weeks: AB.recent_weeks || 4 }) }));
  } else sections.push(xsec({ q: xt("drugsQ"), big: xe(t("tooFewGroup")) }));
  // 2 · the selected drug in full: the sentence, its months, who survived it, and colleagues' notes
  const d = AB.drugs.find(x => x.code === F.drug);
  if (d) {
    const yr = d.year, rc = d.recent, dn = drugName(d.code, d.name), where = d.source === "ward" ? wardName(AB.ward) : t("allWards") + (AB.ward ? ` (${t("onlyTested", { n: d.ward_n, ward: AB.ward })})` : "");
    const asof = new Date(AB.asof + "T00:00"), months = d3.range(12).map(i => { const dt = new Date(asof.getFullYear(), asof.getMonth() - 11 + i, 1); return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}`; });
    const pts = d.monthly.map(([n, s], i) => ({ i, n, s, v: n ? s / n : null }));
    const W = 680, H = 160, m = { l: 36, r: 10, t: 10, b: 34 }, x = d3.scaleLinear().domain([0, 11]).range([m.l + 14, W - m.r - 14]);
    const lo = Math.min(.5, (d3.min(pts, p => p.v ?? 1)) - .05), y = d3.scaleLinear().domain([Math.max(0, Math.floor(lo * 10) / 10), 1]).range([H - m.b, m.t]);
    const rr = d3.scaleSqrt().domain([0, d3.max(pts, p => p.n) || 1]).range([1.5, 5.5]);
    let s = "";
    y.ticks(5).forEach(v => { s += xline(m.l, y(v), W - m.r, y(v), XP.faint); s += xtext(m.l - 6, y(v) + 3, xpct(v), { anchor: "end", size: 9 }); });
    s += xline(m.l, y(.8), W - m.r, y(.8), XP.accent, { dash: "3 4", op: .7 });
    s += `<path d="${d3.line().defined(p => p.v != null).x(p => xr(x(p.i))).y(p => xr(y(p.v))).curve(d3.curveLinear)(pts)}" fill="none" stroke="${XP.ink}" stroke-width="1.5"/>`;
    pts.filter(p => p.v != null).forEach(p => { s += xcirc(x(p.i), y(p.v), rr(p.n), p.v < .8 ? XP.accent : XP.ink); });
    months.forEach((mo, i) => { s += xtext(x(i), H - 17, xmonth(mo), { anchor: "middle", size: 9 }); if (i === 0 || mo.endsWith("-01")) s += xtext(x(i), H - 5, mo.slice(0, 4), { anchor: "middle", size: 8.5 }); });
    const mrows = [[xe(xt("tested")), ...pts.map(p => fmt(p.n))], [xe(xt("killed")), ...pts.map(p => fmt(p.s))], [xe(xt("share")), ...pts.map(p => p.n ? `<b>${xpct(p.v)}</b>` : "–")]];
    const mt = `<table class="months"><thead><tr><th>${xe(xt("month"))}</th>${months.map((mo, i) => `<th class="n">${xe(xmonth(mo))}${i === 0 || mo.endsWith("-01") ? `<small>${mo.slice(0, 4)}</small>` : ""}</th>`).join("")}</tr></thead><tbody>${mrows.map(r => `<tr>${r.map((c, i) => `<td${i ? ' class="n"' : ""}>${c}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
    let kn = [];
    try { kn = await api(`/api/app/knowledge?ward=${F.ward}&drug=${d.code}`); } catch {}
    const b = before(d.code);
    const extra = mt +
      (yr.resisted_by.length ? `<p>${xe(t("survivedMost"))} ${yr.resisted_by.map(([o, n]) => `<b><i>${xe(o)}</i></b> ${fmt(n)}${NATURAL[d.code]?.includes(o) ? ` <span class="mute">${xe(t("always"))}</span>` : ""}`).join(" · ")}</p>` : "") +
      (b ? `<p class="acc">${xe(t("ptSurvived", { drug: dn, when: b }))}</p>` : "") +
      (kn.length ? `<h3 class="xh3">${xe(t("colleagues"))}</h3><ul class="xnotes">${kn.map(r => `<li>${xe(shareText({ ...r.fields, ward: F.ward, sample: F.spec }))}${xsmall(`${xe(t("deid"))} · ${xe(r.fields.month)}`)}</li>`).join("")}</ul>` : "") +
      `<p class="fn">${xe(t("caveat"))}</p>`;
    sections.push(xsec({ q: `${xt("selected")} · ${cap(dn)}`, big: `<span class="${Math.round(yr.share * 100) < 80 ? "acc" : ""}">${xpct(yr.share)}</span> <span class="xbigsub">${xpct(yr.ci[0])}–${xpct(yr.ci[1])} (95%)</span>`,
      sub: `${t("killedSentence", { s: fmt(yr.s), n: fmt(yr.n), drug: xe(dn), where: xe(where) })} ${xe(t("last4"))} ${rc.n ? `<b>${fmt(rc.s)} ${xe(t("of"))} ${fmt(rc.n)}</b> (${xpct(rc.share)})${rc.n < 30 ? xe(t("tooFew")) : ""}${d.changed ? `. <b class="acc">${xe(t("differs"))}</b>` : "."}` : xe(t("noTests"))}`,
      fig: xsvg(W, H, s, dn), extra, fn: xt("monthlyFn") }));
  }
  // 3 · what usually grows here
  if (AB.organisms.length) {
    const os = AB.organisms, W = 680, rh = 22, H = os.length * rh + 4, mx = d3.max(os, o => o.share), x = d3.scaleLinear().domain([0, mx]).range([0, W - 300]);
    let s = "";
    os.forEach((o, i) => { const y = i * rh, sel = F.org === o.name;
      s += xtext(0, y + 14, o.name, { fill: sel ? XP.accent : XP.ink, weight: sel ? 600 : null, size: 10.5 });
      s += xrect(200, y + 5, x(o.share), 11, sel ? XP.accent : XP.grey, { rx: 2 });
      s += xtext(200 + x(o.share) + 6, y + 14, `${xpct(o.share)} · ${fmt(o.n)}`, { size: 9.5, fill: XP.ink2 }); });
    sections.push(xsec({ q: t("grows"), sub: xe(xt("growsSub", { n: fmt(AB.n_year) })), fig: xsvg(W, H, s, t("grows")) }));
  }
  // 4 · this patient's samples, every one
  if (PT) {
    const rows = PT.history.map(h => [xe(niceDate(h.date)), `<b>${xe(h.ward)}</b>`, xe(specName(h.spec)), xe(t("st_" + h.status)),
      h.isolates.length ? h.isolates.map(i => `<i>${xe(i.short)}</i>${i.flags.length ? ` <span class="acc">${xe(i.flags.join(" "))}</span>` : ""}`).join("<br>") : `<span class="mute">${xe(h.status === "waiting" ? t("waitingLab") : t("noGrowth"))}</span>`,
      h.isolates.length ? h.isolates.map(i => i.resisted.length ? xe(i.resisted.map(c => drugName(c)).join(", ")) : `<span class="mute">${xe(t("killedAll"))}</span>`).join("<br>") : ""]);
    sections.push(xsec({ q: xt("hist"), table: xtable([[xt("sampled"), 0, "nw"], [xt("ward"), 0, "nw"], [xt("sample"), 0, "nw"], [xt("status")], [xt("organism"), 0, "nw"], [xt("survivedCol")]], rows) }));
  }
  if (signals.length) sections.unshift(`<section class="xs"><h2 class="xq">${xe(xt("signals"))}</h2><ul class="xsig">${signals.join("")}</ul></section>`);
  return { title: t("navDoctor"), asof: AB.asof, lead, sections, scope };
}

// ---------- the document ----------
const XCSS = `@page { size: A4; margin: 14mm 14mm 15mm; }
:root { color-scheme: light; }
* { box-sizing: border-box; }
html, body { background: ${XP.paper}; }
body { margin: 0; color: ${XP.ink}; font: 400 9.5pt/1.45 Inter, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; -webkit-print-color-adjust: exact; print-color-adjust: exact; font-variant-numeric: tabular-nums; -webkit-font-smoothing: antialiased; }
main { max-width: 182mm; margin: 0 auto; padding: 14mm 0 18mm; }
@media screen and (max-width: 760px) { main { padding: 24px 16px 40px; } }
@media print { main { max-width: none; padding: 0; } }
.xmark { display: flex; align-items: center; gap: 3px; font: 600 10pt "Inter Tight", Inter, sans-serif; color: ${XP.ink}; }
.xmark i { width: 7px; height: 7px; border-radius: 50%; background: ${XP.ink}; } .xmark i:nth-child(2) { background: ${XP.accent}; transform: translateY(-3px); } .xmark i:nth-child(3) { background: ${XP.ink3}; }
.xmark b { margin-left: 7px; font-weight: 600; }
header.xh { padding-bottom: 12px; margin-bottom: 6px; border-bottom: 1px solid ${XP.line}; }
h1 { margin: 10px 0 6px; font: 600 25pt/1.05 "Inter Tight", Inter, sans-serif; letter-spacing: -.03em; }
.lead { margin: 0 0 12px; font-size: 11pt; line-height: 1.4; color: ${XP.ink2}; max-width: 160mm; } .lead b { color: ${XP.ink}; font-weight: 600; }
dl.meta { display: grid; grid-template-columns: max-content 1fr; gap: 2px 14px; margin: 0; font-size: 8.5pt; }
dl.meta dt { color: ${XP.ink3}; } dl.meta dd { margin: 0; color: ${XP.ink2}; }
section.xs { padding: 16px 0 4px; border-top: 1px solid ${XP.line}; }
header.xh + section.xs { border-top: 0; }
.xkeep { break-inside: avoid; page-break-inside: avoid; }
h2.xq { margin: 0; font: 600 7.5pt/1.3 Inter, sans-serif; letter-spacing: .12em; text-transform: uppercase; color: ${XP.ink3}; break-after: avoid; }
.xbig { margin: 5px 0 2px; font: 600 17pt/1.2 "Inter Tight", Inter, sans-serif; letter-spacing: -.02em; break-after: avoid; } .xbig b { font-weight: 600; }
.xbigsub { font: 400 10pt Inter, sans-serif; letter-spacing: 0; color: ${XP.ink3}; }
.xsub { margin: 3px 0 8px; font-size: 9pt; color: ${XP.ink2}; } .xsub b { color: ${XP.ink}; }
h3.xh3 { margin: 14px 0 4px; font: 600 8.5pt Inter, sans-serif; color: ${XP.ink2}; break-after: avoid; }
figure { margin: 10px 0 4px; } figure svg { display: block; width: 100%; height: auto; overflow: visible; } figure svg.map { max-width: 150mm; margin: 0 auto; }
svg.inl { display: block; height: auto; } svg.strip { margin-top: 3px; }
.xleg { display: flex; flex-wrap: wrap; gap: 3px 14px; margin: 4px 0 6px; font-size: 8pt; color: ${XP.ink2}; }
.xleg span { display: inline-flex; align-items: center; gap: 5px; }
.xleg i { display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: var(--c); }
.xleg i.open { background: none; border: 1.6px solid var(--c); } .xleg i.bar { width: 12px; height: 7px; border-radius: 2px; } .xleg i.sq { border-radius: 2px; }
.xleg i.dash { width: 14px; height: 0; border-radius: 0; background: none; border-top: 1.5px dashed var(--c); }
.xleg i.tick { width: 12px; height: 0; border-radius: 0; background: none; border-top: 1.5px solid var(--c); }
.xleg i.box { width: 10px; height: 10px; border-radius: 2px; background: none; border: 1.2px dashed var(--c); }
.xleg i.tri { width: 0; height: 0; border-radius: 0; background: none; border-left: 4.5px solid transparent; border-right: 4.5px solid transparent; border-top: 7px solid var(--c); }
table { width: 100%; border-collapse: collapse; margin: 8px 0 2px; font-size: 8.5pt; line-height: 1.35; }
thead { display: table-header-group; }
th { text-align: left; vertical-align: bottom; font-weight: 600; font-size: 7.5pt; color: ${XP.ink3}; padding: 4px 8px 4px 0; border-bottom: 1px solid ${XP.line}; }
td { vertical-align: top; padding: 4px 8px 4px 0; border-bottom: 1px solid ${XP.faint}; overflow-wrap: anywhere; }
th:last-child, td:last-child { padding-right: 0; }
tr { break-inside: avoid; page-break-inside: avoid; }
.n { text-align: right; white-space: nowrap; } .nw { white-space: nowrap; }
td small { display: block; font-size: 7.5pt; color: ${XP.ink3}; }
table.cl td:last-child, table.cl th:last-child { width: 184px; } table.tr td:last-child, table.tr th:last-child { width: 204px; }
table.fpt td:nth-child(1) { width: 25%; } table.fpt td:nth-child(3) { width: 11%; } table.fpt td:nth-child(4) { width: 15%; }
th small { display: block; font-weight: 400; }
table.months { table-layout: fixed; } table.months th:first-child { width: 64px; } table.months td, table.months th { padding-right: 4px; }
td b.acc, .acc { color: ${XP.accent}; } .amb { color: ${XP.amber}; font-weight: 600; } .mute { color: ${XP.ink3}; }
.st { font-weight: 600; font-size: 7.5pt; letter-spacing: .06em; text-transform: uppercase; }
.fn { break-before: avoid; page-break-before: avoid; margin: 6px 0 0; font-size: 7.5pt; line-height: 1.4; color: ${XP.ink3}; max-width: 170mm; }
p { margin: 6px 0; }
ul.xnotes, ul.xsig { list-style: none; margin: 6px 0; padding: 0; }
ul.xnotes li { padding: 5px 0; border-top: 1px solid ${XP.faint}; font-size: 9pt; } ul.xnotes li small { display: block; color: ${XP.ink3}; font-size: 7.5pt; }
ul.xsig li { display: flex; align-items: center; gap: 8px; padding: 2px 0; font-size: 9pt; } ul.xsig i { width: 7px; height: 7px; border-radius: 50%; background: var(--c); flex-shrink: 0; }
ul.xlinks { list-style: none; margin: 4px 0 0; padding: 0; columns: 4; column-gap: 18px; font-size: 8.5pt; }
ul.xlinks li { display: flex; justify-content: space-between; gap: 8px; padding: 2px 0; border-bottom: 1px solid ${XP.faint}; break-inside: avoid; } ul.xlinks b { font-weight: 600; }
footer.xf { margin-top: 18px; padding-top: 8px; border-top: 1px solid ${XP.line}; font-size: 7.5pt; line-height: 1.45; color: ${XP.ink3}; break-inside: avoid; }`;

async function exportDoc(name) {
  const build = { brief: () => BR && xBrief(), wards: () => WD && xWards(), doctor: () => AB && xDoctor() }[name];
  const o = build && await build(); if (!o) return null;
  const today = (CLOCK && CLOCK.today) || META.last, live = CLOCK && CLOCK.today > CLOCK.data_end;
  const src = live ? xt("srcFeed", { d: niceDate(today), e: niceDate(CLOCK.data_end) }) : xt("srcData", { d: niceDate(o.asof) });
  const caveat = t("exportCaveat", { src: live ? t("liveFeed") : t("dataUpTo", { d: niceDate(o.asof) }) });
  const title = o.title.replace(/\.$/, ""), file = `mindline-${name}-${o.asof}-${LANG}`;
  const html = `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${xe(`Mindline · ${title} · ${niceDate(o.asof)}`)}</title>
<link href="${window.MindlineStatic.base}vendor/fonts-21ae04cfd7.css" rel="stylesheet">
<style>${XCSS}</style></head>
<body><main>
<header class="xh"><div class="xmark"><i></i><i></i><i></i><b>Mindline</b></div><h1>${xe(title)}</h1>${o.lead ? `<p class="lead">${o.lead}</p>` : ""}
<dl class="meta"><dt>${xt("asOf")}</dt><dd>${xe(longDate(o.asof))}</dd><dt>${xt("source")}</dt><dd>${xe(src)}</dd>${o.scope}<dt>${xt("exportedAt")}</dt><dd>${xe(new Date().toLocaleString(loc(), { dateStyle: "medium", timeStyle: "short" }))}</dd></dl></header>
${o.sections.join("\n")}
<footer class="xf">${xe(caveat)}</footer>
</main></body></html>`;
  return { html, file };
}
// PDF: the same document, printed from a frame the size of an A4 page; the browser's dialog saves it as a PDF
async function printDoc({ html, file }) {
  document.querySelectorAll("iframe.mlprint").forEach(f => f.remove());
  const f = document.createElement("iframe"); f.className = "mlprint"; f.setAttribute("aria-hidden", "true"); f.tabIndex = -1;
  f.style.cssText = "position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0;";
  document.body.append(f);
  const d = f.contentDocument; d.open(); d.write(html); d.close();
  await new Promise(r => { if (d.readyState === "complete") r(); else f.addEventListener("load", r, { once: true }); setTimeout(r, 1500); });
  try { await Promise.race([d.fonts.ready, new Promise(r => setTimeout(r, 1500))]); } catch {}
  const old = document.title; document.title = file; d.title = file;
  f.contentWindow.focus(); f.contentWindow.print(); document.title = old;
}
async function exportView(kind, name) {
  const doc = await exportDoc(name);
  if (!doc) return;                                           // the view's data has not arrived yet
  if (kind === "pdf") return printDoc(doc);
  const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([doc.html], { type: "text/html" })); a.download = doc.file + ".html"; document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
// Ctrl/Cmd+P on a dashboard prints the export document, not the interactive screen
addEventListener("keydown", e => {
  if (!(e.ctrlKey || e.metaKey) || e.altKey || e.key.toLowerCase() !== "p" || !["brief", "wards", "doctor"].includes(VIEW) || $("app").hidden) return;
  e.preventDefault(); exportView("pdf", VIEW);
});

// ---------- one Insight / answer graph, with its current selection ----------
let graphExportNumber = 0;
function graphExportMenu() {
  const id = 'graph-export-' + ++graphExportNumber;
  return `<div class="graph-export"><button type="button" class="graph-export-trigger" aria-label="Export graph" title="Export graph" aria-haspopup="menu" aria-expanded="false" aria-controls="${id}">${EXPORT_ICON}</button><div class="graph-export-menu" id="${id}" role="menu" aria-label="Export graph as" hidden><button type="button" role="menuitem" tabindex="-1" data-graph-export="pdf">PDF</button><button type="button" role="menuitem" tabindex="-1" data-graph-export="html">HTML</button></div><span class="graph-export-status" role="status"></span></div>`;
}
function closeGraphExportMenus(restoreFocus = false) {
  document.querySelectorAll('.graph-export-trigger[aria-expanded="true"]').forEach(trigger => {
    trigger.setAttribute('aria-expanded', 'false');
    trigger.parentElement.querySelector('.graph-export-menu').hidden = true;
    if (restoreFocus) trigger.focus();
  });
}
function openGraphExportMenu(trigger, last = false) {
  closeGraphExportMenus();
  trigger.setAttribute('aria-expanded', 'true');
  const menu = trigger.parentElement.querySelector('.graph-export-menu');
  menu.hidden = false;
  const items = menu.querySelectorAll('[role="menuitem"]');
  items[last ? items.length - 1 : 0].focus();
}
document.addEventListener('click', event => {
  const trigger = event.target.closest('.graph-export-trigger');
  if (trigger) {
    if (trigger.getAttribute('aria-expanded') === 'true') closeGraphExportMenus();
    else openGraphExportMenu(trigger);
    return;
  }
  const action = event.target.closest('[data-graph-export]');
  if (action) {
    const controls = action.closest('.graph-export');
    const graph = action.closest('.ins-q[data-id], .ans-viz');
    closeGraphExportMenus(true);
    if (graph) exportGraph(action.dataset.graphExport, graph, controls);
    return;
  }
  if (!event.target.closest('.graph-export')) closeGraphExportMenus();
});
document.addEventListener('keydown', event => {
  const controls = event.target.closest('.graph-export');
  if (!controls) return;
  const trigger = controls.querySelector('.graph-export-trigger');
  if (event.key === 'Escape') { event.preventDefault(); closeGraphExportMenus(true); return; }
  if (event.key === 'Tab') { closeGraphExportMenus(); return; }
  if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
  event.preventDefault();
  if (trigger.getAttribute('aria-expanded') !== 'true') return openGraphExportMenu(trigger, event.key === 'ArrowUp' || event.key === 'End');
  const items = Array.from(controls.querySelectorAll('[role="menuitem"]'));
  const current = items.indexOf(document.activeElement);
  const index = event.key === 'Home' ? 0 : event.key === 'End' ? items.length - 1 : (current + (event.key === 'ArrowUp' ? -1 : 1) + items.length) % items.length;
  items[index].focus();
});

function graphPlain(markup) {
  const template = document.createElement('template');
  template.innerHTML = String(markup || '').replace(/<br\s*\/?\s*>/gi, ' · ');
  return template.content.textContent.trim().replace(/\s+/g, ' ');
}
function graphExportColours() {
  const ctx = document.createElement('canvas').getContext('2d');
  const canonical = value => { ctx.fillStyle = '#010203'; ctx.fillStyle = value; return ctx.fillStyle; };
  const palette = { '--ink': '#17181c', '--ink-2': '#4a4c52', '--ink-3': '#70727a', '--paper': '#ffffff', '--sheet': '#ffffff',
    '--panel': '#f4f3ef', '--line': '#dedbd4', '--accent': '#ef4630', '--cool': '#2f8f86', '--selection': '#345fc5', '--organism': '#956000' };
  const root = getComputedStyle(document.documentElement), replacements = new Map();
  Object.entries(palette).forEach(([key, value]) => {
    const original = root.getPropertyValue(key).trim();
    if (original) replacements.set(canonical(original), value);
  });
  return value => value === 'none' || value === 'transparent' || value.startsWith('url(') ? value : replacements.get(canonical(value)) || value;
}
function cloneGraphForExport(source, colour) {
  const clone = source.cloneNode(true);
  const originals = [source, ...source.querySelectorAll('*')];
  const copies = [clone, ...clone.querySelectorAll('*')];
  originals.forEach((original, index) => {
    const copy = copies[index];
    for (const attr of Array.from(copy.attributes)) {
      if (/^(on|data-)/i.test(attr.name) || ['id', 'tabindex', 'role', 'style', 'href', 'xlink:href'].includes(attr.name)) copy.removeAttribute(attr.name);
    }
    if (original.namespaceURI !== 'http://www.w3.org/2000/svg') return;
    const style = getComputedStyle(original);
    for (const prop of ['fill', 'stroke', 'stroke-width', 'stroke-dasharray', 'stroke-dashoffset', 'stroke-linecap', 'stroke-linejoin', 'fill-opacity', 'stroke-opacity', 'opacity', 'font-size', 'font-weight', 'font-style', 'text-anchor', 'dominant-baseline', 'letter-spacing']) {
      const value = style.getPropertyValue(prop);
      if (value) copy.style.setProperty(prop, prop === 'fill' || prop === 'stroke' ? colour(value) : value);
    }
    copy.style.fontFamily = 'Arial, Helvetica, sans-serif';
    if (copy.tagName.toLowerCase() === 'svg') {
      copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
      copy.removeAttribute('width'); copy.removeAttribute('height');
    }
  });
  clone.querySelectorAll('script,style,iframe,foreignObject,image,use,.chips,.graph-export,.ans-scroll-hint').forEach(node => node.remove());
  clone.querySelectorAll('button,a,input,select').forEach(node => {
    const span = document.createElement('span'); span.textContent = node.textContent; node.replaceWith(span);
  });
  return clone.outerHTML;
}

async function settleGraphForExport(graph) {
  // Lazy Insights normally draw when scrolled into view. Export also works if
  // invoked before that observer runs, without copying an empty chart.
  if (graph.matches('.ins-q[data-id]') && !graph.querySelector('svg')) {
    const item = insItem(graph.dataset.id);
    if (item) { graph.dataset.drawn = '1'; IR[item.id].draw(item); }
  }
  // D3 transitions are not Web Animations. Wait for stable vector geometry,
  // including staggered starts, rather than freezing halfway through a reveal.
  let previous = '', stable = 0;
  for (let tick = 0; tick < 40; tick++) {
    if (!graph.isConnected) throw new Error('The graph was closed. Open it again to export.');
    const current = Array.from(graph.querySelectorAll('svg')).map(svg => svg.outerHTML).join('');
    stable = current === previous ? stable + 1 : 0; previous = current;
    if (tick >= 7 && stable >= 3) return;
    await new Promise(resolve => setTimeout(resolve, 120));
  }
}

const XGRAPH_CSS = `
:root { --organism: #956000; } .organism-entity { color: #956000 !important; fill: #956000 !important; }
.xgraph-viz { margin: 20px 0; } .xgraph-viz svg { display: block; width: 100%; height: auto; overflow: visible; }
.ins-bento { display: block; } .ins-main { margin-bottom: 20px; }
.ins-side { display: grid; grid-template-columns: 1fr 1fr; gap: 16px 28px; }
.bx { break-inside: avoid; } .bx.w { grid-column: 1 / -1; } .bx > .k, .bx > .v, .bx > .s { display: block; }
.bx .k { color: #70727a; font-size: 9pt; margin-bottom: 5px; } .bx .v { font-size: 20pt; font-weight: 600; }
.bx .v small { font-size: 11pt; } .bx .s { color: #4a4c52; font-size: 9pt; line-height: 1.45; margin-top: 5px; }
.bx .spark { margin-top: 8px; } .acc { color: #ef4630; } .xgraph-reading { font-size: 11pt; line-height: 1.5; }
.xgraph-method { font-size: 9pt; line-height: 1.5; } .xgraph-details { margin-top: 24px; }
.xgraph-details summary { cursor: pointer; font-weight: 600; font-size: 10pt; } .xgraph-details td { padding: 7px 0; }
.i-interpret { grid-column: 1 / -1; break-inside: avoid; } .i-interpret h4 { margin: 10px 0 6px; font-size: 10pt; }
.i-interpret p, .i-chart-key { color: #4a4c52; font-size: 9pt; line-height: 1.5; margin: 8px 0; }
.i-interpret .i-ci { max-width: 440px; margin: 8px 0; } .i-observed { border-bottom: 1px solid #dedbd4; padding-bottom: 12px; }
@media print { .xgraph-viz { break-inside: auto; } .xgraph-viz svg { break-inside: avoid; } .xgraph-details { display: none; } }
`;

async function buildGraphExport(graph) {
  await settleGraphForExport(graph);
  const inAnswer = graph.closest('#ans'), id = graph.dataset.id;
  const item = id ? insItem(id) : null, renderer = id ? IR[id] : null;
  const custom = graph._graphExport;
  const asof = inAnswer?.dataset.asof || (typeof INS !== 'undefined' && INS?.asof) || CLOCK?.today || META.last;
  const title = renderer ? ti('q_' + id) : custom?.title || 'Graph';
  const context = renderer && item ? graphPlain(renderer.meta(item)) : graphPlain(graph.querySelector('svg text')?.textContent || '');
  const reading = renderer && item ? graphPlain(renderer.answer(item)) : '';
  const how = renderer && item ? graphPlain(renderer.how(item)) : 'This graph shows the saved answer’s laboratory figures, for the population and period labelled above.';
  const selection = Array.from(graph.querySelectorAll('.ichip.on')).map(node => node.textContent.trim()).filter(Boolean);
  const question = inAnswer?.querySelector('.ans-q')?.textContent || '';
  const region = graph.querySelector('.ins-bento, .ans-chart');
  if (!region) throw new Error('This graph is not ready yet. Please try again.');
  const markup = cloneGraphForExport(region, graphExportColours());
  const details = [...new Set(Array.from(region.querySelectorAll('[data-tip]')).map(node => graphPlain(node.getAttribute('data-tip'))).filter(Boolean))];
  let body = `<header class="xh"><div class="xmark"><i></i><i></i><i></i><b>Mindline</b></div><h1>${xe(title)}</h1><p class="lead">${xe(context)}</p>
    <dl class="meta"><dt>Data up to</dt><dd>${xe(longDate(asof))}</dd><dt>Source</dt><dd>Synthetic Tyks demo data and simulated lab feed, as available on that date</dd>${question ? `<dt>Question</dt><dd>${xe(question)}</dd>` : ''}${selection.length ? `<dt>Selected</dt><dd>${xe(selection.join(' · '))}</dd>` : ''}<dt>Exported</dt><dd>${xe(new Date().toLocaleString(loc(), {dateStyle: 'medium', timeStyle: 'short'}))}</dd></dl></header>
    ${reading ? `<p class="xgraph-reading">${xe(reading)}</p>` : ''}<div class="xgraph-viz">${markup}</div><section class="xgraph-method"><h2>How to read this graph</h2><p>${xe(how)}</p></section>
    ${details.length ? `<details class="xgraph-details"><summary>Point details · ${details.length} entries</summary><p>Values available when hovering over this graph in the app.</p><table><tbody>${details.map(detail => `<tr><td>${xe(detail)}</td></tr>`).join('')}</tbody></table></details>` : ''}
    <footer class="xf">A snapshot of the graph and its selection at export time. Laboratory results are not a treatment recommendation or a probability of cure. The HTML file includes expandable point details; the PDF contains the graph, selection and explanation.</footer>`;
  if (window.OrganismText) body = OrganismText.html(body);
  const file = `mindline-${id || custom?.kind || 'graph'}-${asof}-${LANG}`;
  const html = `<!doctype html><html lang="${LANG}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${xe(title)} · Mindline</title><style>${XCSS}\n${XGRAPH_CSS}</style></head><body><main>${body}</main></body></html>`;
  return {html, file};
}
async function exportGraph(kind, graph, controls) {
  const trigger = controls.querySelector('.graph-export-trigger'), status = controls.querySelector('.graph-export-status');
  trigger.disabled = true; status.textContent = 'Preparing graph…';
  try {
    const doc = await buildGraphExport(graph);
    if (kind === 'pdf') { status.textContent = 'Choose “Save as PDF” in the print dialog.'; await printDoc(doc); }
    else {
      const url = URL.createObjectURL(new Blob([doc.html], {type: 'text/html'}));
      const link = document.createElement('a'); link.href = url; link.download = doc.file + '.html'; document.body.append(link); link.click(); link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000); status.textContent = 'HTML downloaded.';
    }
    setTimeout(() => { if (status.isConnected) status.textContent = ''; }, 6000);
  } catch (error) { status.textContent = error.message || 'Could not export this graph. Please try again.'; }
  finally { trigger.disabled = false; }
}
