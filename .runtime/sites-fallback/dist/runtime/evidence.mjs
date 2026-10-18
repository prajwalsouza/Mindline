import {
  DAY,
  date,
  iso,
  dayOf,
  add,
  days,
  round,
  sum,
  median,
  count,
  group,
  common,
  range,
  short,
  FLAGS,
  ORDER,
  SPECTRUM,
  key,
  wilson,
} from "./core.mjs";
export class Feed {
  constructor(src, run) {
    this.src = src;
    this.use(run);
  }
  use(run) {
    this.run = run;
    this.today = this.src.end;
    this.first = run.start;
    this.last = add(run.end, -1);
    this.cache = new Map();
    this.overviews = new Map();
    this.calendarCache = null;
    this.byDay = group(run.deliveries, (d) => iso(d.known_at));
    this.sex = Object.fromEntries(
      run.cases.map((c) => [c[0].culture_id, c[0]._tsex]),
    );
  }
  set(day) {
    if (!Number.isFinite(day)) throw Error("Invalid date");
    this.today = Math.max(this.src.end, Math.min(this.last, day));
  }
  view(day = this.today) {
    const src = this.src;
    if (day <= src.end) return { ...src, end: day };
    if (this.cache.has(day)) return this.cache.get(day);
    const state = new Map();
    for (const d of this.run.deliveries) {
      if (dayOf(d.known_at) > day) break;
      const k = key(d.table, d.key);
      if (!state.has(k) || d.revision >= state.get(k).revision) state.set(k, d);
    }
    const cultures = [],
      is = {},
      sus = {},
      patients = {};
    for (const d of state.values()) {
      if (d.op === "cancel") continue;
      const r = { ...d.row };
      if (d.table === "cultures") {
        Object.assign(r, {
          _date: date(r.sample_date),
          _status: d.status,
          _feed: true,
        });
        cultures.push(r);
        if (!src.patients[r.patient_id])
          patients[r.patient_id] = {
            patient_id: r.patient_id,
            sex: this.sex[r.culture_id] || "F",
            birth_year: String(
              new Date(r._date).getUTCFullYear() - Number(r.age_years),
            ),
            home_area: "",
          };
      } else if (d.table === "isolates") {
        for (const f of FLAGS) r[f] ||= "0";
        (is[r.culture_id] ||= []).push(r);
      } else (sus[r.isolate_id] ||= []).push(r);
    }
    cultures.sort(
      (a, b) => a._date - b._date || (a.culture_id < b.culture_id ? -1 : 1),
    );
    const v = {
      ...src,
      cultures: src.cultures.concat(cultures.filter((c) => c._date > src.end)),
      isolates: { ...src.isolates, ...is },
      sus: { ...src.sus, ...sus },
      patients: { ...src.patients, ...patients },
      end: day,
      _new: this.deliveries(day).filter((d) =>
        ["susceptibility", "culture received"].includes(d.kind),
      ).length,
    };
    if (this.cache.size > 16) this.cache.clear();
    this.cache.set(day, v);
    return v;
  }
  deliveries(d) {
    return d > this.src.end ? this.byDay[iso(d)] || [] : [];
  }
  status() {
    return {
      today: iso(this.today),
      data_end: iso(this.src.end),
      first: iso(this.first),
      last: iso(this.last),
      new_today: this.view()._new || 0,
      truth: this.run.truth_list.filter(
        (t) => t.start && t.start <= iso(this.today),
      ),
    };
  }
}
export function cohort(
  src,
  asof,
  span,
  { ward = null, sex = null, age = null, spec = "urine", org = null } = {},
) {
  const seen = new Set(),
    out = [];
  for (const c of src.cultures) {
    if (c._date <= add(asof, -span)) continue;
    if (c._date > asof) break;
    if (
      c.specimen !== spec ||
      (ward && c.ward_code !== ward) ||
      (age === "<65" && +c.age_years >= 65) ||
      (age === "65+" && +c.age_years < 65) ||
      (sex && src.patients[c.patient_id]?.sex !== sex)
    )
      continue;
    for (const i of src.isolates[c.culture_id] || []) {
      if (org && i.organism !== org) continue;
      const k = key(c.patient_id, i.organism, c.specimen);
      if (seen.has(k)) continue;
      seen.add(k);
      out.push([c, i]);
    }
  }
  return out;
}
function tally(src, rows, drug) {
  let n = 0,
    r = 0,
    by = {};
  for (const [c, i] of rows)
    for (const s of src.sus[i.isolate_id] || [])
      if (s.antibiotic_code === drug) {
        n++;
        if (s.result === "R") {
          r++;
          by[i.organism] = (by[i.organism] || 0) + 1;
        }
      }
  return {
    n,
    s: n - r,
    share: n ? round((n - r) / n, 4) : null,
    ci: wilson(n - r, n),
    resisted_by: common(by)
      .slice(0, 4)
      .map(([o, k]) => [short(o), k]),
  };
}
function monthly(src, rows, drug, asof) {
  const m = {},
    dt = new Date(asof);
  for (const [c, i] of rows) {
    const d = new Date(c._date),
      k =
        (dt.getUTCFullYear() - d.getUTCFullYear()) * 12 +
        dt.getUTCMonth() -
        d.getUTCMonth();
    for (const s of src.sus[i.isolate_id] || [])
      if (s.antibiotic_code === drug) {
        m[k] ||= [0, 0];
        m[k][0]++;
        m[k][1] += Number(s.result === "S");
      }
  }
  return range(12)
    .reverse()
    .map((k) => m[k] || [0, 0]);
}
export function antibiogram(src, q = {}) {
  const { ward = null, sex = null, age = null, spec = "urine", org = null } = q,
    asof = q.asof ? date(q.asof) : src.end,
    recent_weeks = Number(q.recent_weeks || 4);
  if (![2, 4, 8, 12].includes(recent_weeks))
    throw Error("Recent window must be 2, 4, 8 or 12 weeks");
  const yw = ward
      ? cohort(src, asof, 365, { ward, sex, age, spec, org })
      : null,
    ya = cohort(src, asof, 365, { sex, age, spec, org }),
    recent = cohort(src, asof, recent_weeks * 7, { ward, sex, age, spec, org }),
    drugs = [];
  for (const code of ORDER) {
    const ab = src.antibiotics[code];
    if (!["all", spec].includes(ab.reported_for)) continue;
    const all = tally(src, ya, code);
    if (all.n < 30 || all.n < 0.3 * ya.length) continue;
    const wy = yw ? tally(src, yw, code) : null,
      use = wy && wy.n >= 30,
      ann = use ? wy : all,
      rc = tally(src, recent, code),
      z = rc.n
        ? Math.abs(rc.share - ann.share) /
          Math.sqrt(Math.max(1e-4, ann.share * (1 - ann.share)) / rc.n)
        : 0;
    drugs.push({
      code,
      name: ab.antibiotic,
      spectrum: SPECTRUM[code],
      year: ann,
      recent: rc,
      source: use ? "ward" : "hospital",
      ward_n: wy ? wy.n : null,
      changed: rc.n >= 10 && z > 2.5,
      monthly: monthly(src, use ? yw : ya, code, asof),
    });
  }
  const orgs = count(
      cohort(src, asof, 365, { ward, sex, age, spec }),
      (r) => r[1].organism,
    ),
    total = sum(Object.values(orgs)) || 1;
  return {
    asof: iso(asof),
    ward,
    sex,
    age,
    spec,
    org,
    n_year: (yw || ya).length,
    n_recent: recent.length,
    recent_weeks,
    organisms: common(orgs)
      .slice(0, 8)
      .map(([name, n]) => ({
        name,
        short: short(name),
        n,
        share: round(n / total, 3),
      })),
    drugs,
    signals: src.alerts.filter(
      (a) =>
        (!ward || [ward, "ALL"].includes(a.ward)) &&
        a.type !== "gap" &&
        date(a.from) <= asof &&
        date(a.to) >= add(asof, -56),
    ),
    gaps: src.alerts.filter(
      (a) =>
        a.type === "gap" &&
        (!ward || a.ward === ward) &&
        date(a.from) <= asof &&
        date(a.to) >= add(asof, -28),
    ),
  };
}
function status(src, c, asof) {
  if (c._feed) {
    if (c._status === "received") return "waiting";
    if (["negative", "mixed_growth"].includes(c.result)) return "no growth";
    return c._status === "final" &&
      (src.isolates[c.culture_id] || []).every((i) => i.esbl !== "")
      ? "final"
      : "organism known";
  }
  const age = days(asof, c._date);
  return c.result !== "positive"
    ? age >= 2
      ? "no growth"
      : "waiting"
    : age < 1
      ? "waiting"
      : age < 3
        ? "organism known"
        : "final";
}
export function patients(src, ward = "URO", asof = src.end) {
  const seen = new Set(),
    out = [];
  for (let j = src.cultures.length - 1; j >= 0; j--) {
    const c = src.cultures[j];
    if (c._date > asof) continue;
    if (c._date <= add(asof, -10)) break;
    if (
      c.ward_code !== ward ||
      seen.has(c.patient_id) ||
      !["urine", "blood", "wound"].includes(c.specimen)
    )
      continue;
    seen.add(c.patient_id);
    const st = status(src, c, asof),
      is = src.isolates[c.culture_id] || [];
    out.push({
      id: c.patient_id,
      sex: src.patients[c.patient_id].sex,
      age: +c.age_years,
      spec: c.specimen,
      date: c.sample_date,
      status: st,
      organisms: ["organism known", "final"].includes(st)
        ? is.map((i) => i.organism)
        : [],
      flags:
        st === "final"
          ? is.flatMap((i) =>
              FLAGS.filter((f) => i[f] === "1").map((f) => f.toUpperCase()),
            )
          : [],
    });
    if (out.length >= 14) break;
  }
  const rank = { waiting: 0, "organism known": 1, final: 2, "no growth": 3 };
  return out.sort(
    (a, b) =>
      rank[a.status] - rank[b.status] ||
      (a.date > b.date ? -1 : a.date < b.date ? 1 : 0),
  );
}
export function patient(src, pid, asof = src.end) {
  if (!src.patients[pid]) throw Error("Unknown patient");
  const history = [];
  for (const c of src.cultures) {
    if (c.patient_id !== pid || c._date > asof) continue;
    const st = status(src, c, asof),
      is = [];
    if (["final", "organism known"].includes(st))
      for (const i of src.isolates[c.culture_id] || [])
        is.push({
          organism: i.organism,
          short: short(i.organism),
          flags:
            st === "final"
              ? FLAGS.filter((f) => i[f] === "1").map((f) => f.toUpperCase())
              : [],
          resisted:
            st === "final"
              ? (src.sus[i.isolate_id] || [])
                  .filter((s) => s.result === "R")
                  .map((s) => s.antibiotic_code)
              : [],
        });
    history.push({
      date: c.sample_date,
      ward: c.ward_code,
      spec: c.specimen,
      result: c.result,
      status: st,
      isolates: is,
    });
  }
  return {
    id: pid,
    sex: src.patients[pid].sex,
    birth_year: src.patients[pid].birth_year,
    history: history.reverse(),
  };
}
export function wardsOverview(src, types = FLAGS) {
  const asof = src.end,
    lo = add(asof, -729),
    start = add(asof, -364),
    seen = new Set(),
    cases = [],
    pw = {},
    vol = {};
  for (const c of src.cultures) {
    const d = c._date;
    if (d <= lo || d > asof) continue;
    if (d > add(asof, -365)) (pw[c.patient_id] ||= new Set()).add(c.ward_code);
    if (d > start) {
      vol[c.ward_code] ||= range(52).map(() => 0);
      vol[c.ward_code][Math.min(51, Math.floor(days(d, start) / 7))]++;
    }
    for (const i of src.isolates[c.culture_id] || []) {
      const fs = types.filter((f) => i[f] === "1");
      if (!fs.length) continue;
      const k = key(c.patient_id, fs);
      if (seen.has(k)) continue;
      seen.add(k);
      const ss = Object.fromEntries(
          (src.sus[i.isolate_id] || []).map((s) => [
            s.antibiotic_code,
            s.result,
          ]),
        ),
        fp = ORDER.map((d) => (["S", "R"].includes(ss[d]) ? ss[d] : ".")).join(
          "",
        );
      cases.push({
        id: "C" + c.culture_id.slice(-6),
        ward: c.ward_code,
        date: c.sample_date,
        flags: fs.map((f) => f.toUpperCase()),
        organism: i.organism,
        short: short(i.organism),
        fp,
        hday: c.admission_date ? days(d, date(c.admission_date)) + 1 : null,
        spec: c.specimen,
      });
    }
  }
  const wards = Object.entries(src.wards).map(([code, w]) => {
    const mine = cases.filter((c) => c.ward === code),
      recent = mine.filter((c) => date(c.date) > add(asof, -28)).length,
      base = mine.filter(
        (c) => date(c.date) > add(asof, -393) && date(c.date) <= add(asof, -28),
      ),
      expected = (base.length / 365) * 28,
      z = (recent - expected) / Math.sqrt(Math.max(expected, 0.5)),
      weekly = range(52).map(() => 0);
    for (const c of mine)
      if (date(c.date) > start)
        weekly[Math.min(51, Math.floor(days(date(c.date), start) / 7))]++;
    return {
      code,
      name: w.ward_en,
      type: w.ward_type,
      institution: w.institution,
      recent,
      expected: round(expected, 2),
      z: round(z, 2),
      weekly,
      volume: vol[code] || range(52).map(() => 0),
    };
  });
  const links = {};
  for (const ws of Object.values(pw)) {
    const a = [...ws].sort();
    for (let i = 0; i < a.length; i++)
      for (let j = i + 1; j < a.length; j++) {
        const k = key(a[i], a[j]);
        links[k] = (links[k] || 0) + 1;
      }
  }
  return {
    asof: iso(asof),
    start: iso(start),
    weeks: 52,
    types: types.map((t) => t.toUpperCase()),
    drugs: ORDER,
    wards,
    links: Object.entries(links).map(([k, n]) => {
      const [a, b] = JSON.parse(k);
      return { a, b, n };
    }),
    cases: cases.filter((c) => date(c.date) > start),
    signals: src.alerts.filter(
      (a) => date(a.to) > start && date(a.from) <= asof,
    ),
  };
}
export function overview(feed, d) {
  if (!feed.overviews.has(d)) {
    if (feed.overviews.size > 150) feed.overviews.clear();
    feed.overviews.set(d, wardsOverview(feed.view(d)));
  }
  return feed.overviews.get(d);
}
export function clusters(cases, today) {
  const out = [];
  for (const cs of Object.values(
    group(cases, (c) => key(c.short, c.fp, c.flags)),
  )) {
    cs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
    let chain = [cs[0]],
      chains = [];
    for (const c of cs.slice(1)) {
      if (days(date(c.date), date(chain.at(-1).date)) <= 14) chain.push(c);
      else {
        chains.push(chain);
        chain = [c];
      }
    }
    chains.push(chain);
    for (const ch of chains) {
      if (ch.length < 3) continue;
      const first = date(ch[0].date),
        last = date(ch.at(-1).date),
        since = days(today, last);
      if (since > 60) continue;
      const recent = ch.filter((c) => days(today, date(c.date)) <= 14).length,
        before = ch.filter(
          (c) =>
            days(today, date(c.date)) > 14 && days(today, date(c.date)) <= 28,
        ).length,
        status =
          since > 28
            ? "over"
            : days(today, first) <= 14
              ? "new"
              : recent > before
                ? "growing"
                : "stable",
        daily = range(60).map(() => 0);
      for (const c of ch) {
        const k = 59 - days(today, date(c.date));
        if (k >= 0 && k < 60) daily[k]++;
      }
      out.push({
        organism: ch[0].short,
        flags: ch[0].flags,
        fp: ch[0].fp,
        key: ch[0].fp + ch[0].short,
        n: ch.length,
        first: iso(first),
        last: iso(last),
        since,
        status,
        wards: [...new Set(ch.map((c) => c.ward))],
        daily,
        hospital: ch.filter((c) => c.hday >= 3).length,
      });
    }
  }
  const order = { new: 0, growing: 1, stable: 2, over: 3 };
  return out.sort((a, b) => order[a.status] - order[b.status] || b.n - a.n);
}
export function shareSeries(src, org, spec, drug, today, months = 24) {
  const m = {},
    seen = new Set();
  for (const c of src.cultures) {
    if (
      c._date <= add(today, -months * 31) ||
      c._date > today ||
      (spec && c.specimen !== spec)
    )
      continue;
    for (const i of src.isolates[c.culture_id] || []) {
      if (i.organism !== org) continue;
      const mo = c.sample_date.slice(0, 7),
        k = key(c.patient_id, mo);
      if (seen.has(k)) continue;
      seen.add(k);
      for (const s of src.sus[i.isolate_id] || [])
        if (s.antibiotic_code === drug) {
          m[mo] ||= [0, 0];
          m[mo][0]++;
          m[mo][1] += Number(s.result === "R");
        }
    }
  }
  const d = new Date(today);
  return range(months)
    .reverse()
    .map((k) => {
      const month = new Date(
          Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - k, 1),
        )
          .toISOString()
          .slice(0, 7),
        [n, r] = m[month] || [0, 0];
      return { month, n, r };
    });
}
const hot = (w) => w.recent >= 3 && w.z > 2,
  caseKey = (c) => key(c.id, c.flags);
export function index(src, today, since) {
  const first = {},
    cbd = {};
  for (const c of src.cultures) {
    if (c._date > today) continue;
    const k = key(c.ward_code, c._date);
    if (c._date >= since) cbd[k] = (cbd[k] || 0) + 1;
    for (const i of src.isolates[c.culture_id] || [])
      for (const f of FLAGS)
        if (i[f] === "1")
          first[key(c.ward_code, f.toUpperCase())] ??= c.sample_date;
  }
  return { first, cbd };
}
export function incidents(feed, day, idx) {
  const now = overview(feed, day),
    before = overview(feed, add(day, -1)),
    out = [],
    old = new Set(before.cases.map(caseKey)),
    fresh = now.cases.filter((c) => !old.has(caseKey(c))),
    ds = feed.deliveries(day);
  for (const [k, n] of common(count(fresh, (c) => key(c.ward, c.flags[0])))) {
    const [ward, flag] = JSON.parse(k),
      first = fresh.some(
        (c) =>
          c.ward === ward &&
          c.flags[0] === flag &&
          idx.first[key(ward, flag)] === c.date,
      );
    out.push({ day: iso(day), kind: first ? "first" : "case", ward, flag, n });
  }
  const hb = Object.fromEntries(before.wards.map((w) => [w.code, hot(w)]));
  for (const w of now.wards) {
    if (hot(w) && !hb[w.code])
      out.push({
        day: iso(day),
        kind: "above",
        ward: w.code,
        n: w.recent,
        expected: round(w.expected, 1),
      });
    if (!hot(w) && hb[w.code])
      out.push({ day: iso(day), kind: "calm", ward: w.code, n: w.recent });
  }
  const cb = Object.fromEntries(
    clusters(before.cases, add(day, -1)).map((c) => [
      c.key + c.flags.join("|"),
      c,
    ]),
  );
  for (const c of clusters(now.cases, day)) {
    const p = cb[c.key + c.flags.join("|")],
      item = {
        day: iso(day),
        organism: c.organism,
        flag: c.flags[0],
        wards: c.wards,
        n: c.n,
      };
    if (!p && c.status !== "over") out.push({ ...item, kind: "cluster" });
    else if (p && c.n > p.n && c.status !== "over")
      out.push({ ...item, kind: "grew", was: p.n });
    else if (p && c.status === "over" && p.status !== "over")
      out.push({ ...item, kind: "ended" });
  }
  for (const w of now.wards) {
    const usual = median(
      [1, 2, 3, 4].map((j) => idx.cbd[key(w.code, add(day, -7 * j))] || 0),
    );
    if (usual >= 5 && !idx.cbd[key(w.code, day)])
      out.push({ day: iso(day), kind: "gap", ward: w.code, usual });
  }
  for (const [ward, n] of common(
    count(
      ds.filter(
        (d) => d.kind === "susceptibility" && days(d.known_at, d.event_at) > 10,
      ),
      (d) => d.ward,
    ),
  ))
    if (n >= 5) out.push({ day: iso(day), kind: "late", ward, n });
  const fixed = count(
    ds.filter((d) =>
      ["susceptibility corrected", "organism corrected"].includes(d.kind),
    ),
    (d) => d.ward,
  );
  if (Object.keys(fixed).length)
    out.push({
      day: iso(day),
      kind: "fixed",
      n: sum(Object.values(fixed)),
      wards: common(fixed).map((x) => x[0]),
    });
  const order = {
    first: 0,
    above: 1,
    cluster: 2,
    grew: 3,
    case: 4,
    gap: 5,
    late: 6,
    fixed: 7,
    calm: 8,
    ended: 9,
  };
  return out.sort((a, b) => order[a.kind] - order[b.kind]);
}
const TREND = [
  ["Escherichia coli", "urine", "TMP"],
  ["Escherichia coli", "urine", "CIP"],
  ["Escherichia coli", "urine", "CRO"],
  ["Klebsiella pneumoniae", null, "CRO"],
  ["Staphylococcus aureus", null, "FOX"],
];
export function brief(feed, notes = []) {
  const today = feed.today,
    src = feed.view(),
    yday = add(today, -1),
    now = overview(feed, today),
    before = overview(feed, yday),
    old = new Set(before.cases.map(caseKey)),
    new_cases = now.cases.filter((c) => !old.has(caseKey(c))),
    trends = [];
  for (const [org, spec, drug] of TREND) {
    const series = shareSeries(src, org, spec, drug, today),
      a = series.slice(-12),
      b = series.slice(0, 12),
      n1 = sum(a, (x) => x.n),
      r1 = sum(a, (x) => x.r),
      n0 = sum(b, (x) => x.n),
      r0 = sum(b, (x) => x.r);
    if (n1 < 30 || n0 < 30) continue;
    const p1 = r1 / n1,
      p0 = r0 / n0,
      pp = (r1 + r0) / (n1 + n0),
      z =
        (p1 - p0) /
        Math.sqrt(Math.max(1e-9, pp * (1 - pp) * (1 / n1 + 1 / n0)));
    trends.push({
      organism: short(org),
      spec,
      drug,
      series,
      now: round(p1, 4),
      before: round(p0, 4),
      n_now: n1,
      n_before: n0,
      z: round(z, 2),
      crossed: Math.abs(z) > 2 && Math.abs(p1 - p0) >= 0.02,
    });
  }
  const fs = {};
  for (const c of src.cultures)
    if (days(today, c._date) <= 400 && c._date <= today)
      for (const i of src.isolates[c.culture_id] || [])
        for (const s of (src.sus[i.isolate_id] || []).slice(0, 1)) {
          const m = c.sample_date.slice(0, 7);
          if (!fs[s.guideline] || m < fs[s.guideline]) fs[s.guideline] = m;
        }
  const versions = Object.entries(fs)
    .sort((a, b) => (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0))
    .slice(1)
    .map(([version, from]) => ({ version, from }));
  const by = count(
      src.cultures.filter(
        (c) => days(today, c._date) >= 0 && days(today, c._date) <= 41,
      ),
      (c) => key(c.ward_code, c._date),
    ),
    health = Object.keys(src.wards).map((ward) => {
      const ds = range(14)
        .reverse()
        .map((k) => {
          const d = add(today, -k);
          return {
            day: iso(d),
            n: by[key(ward, d)] || 0,
            usual: median(
              [1, 2, 3, 4].map((j) => by[key(ward, add(d, -7 * j))] || 0),
            ),
          };
        });
      return {
        ward,
        days: ds,
        missing_days: ds.slice(-7).filter((d) => d.n === 0 && d.usual >= 2)
          .length,
        pending: src.cultures
          .slice(-4000)
          .filter(
            (c) => c.ward_code === ward && c._feed && c._status === "received",
          ).length,
      };
    }),
    late = count(
      feed
        .deliveries(today)
        .filter(
          (d) =>
            d.kind === "susceptibility" && days(today, dayOf(d.event_at)) > 10,
        ),
      (d) => d.ward,
    );
  const idx = index(src, today, add(today, -40)),
    pulse = range(7)
      .reverse()
      .map((k) => {
        const d = add(today, -k),
          n = overview(feed, d),
          b = overview(feed, add(d, -1)),
          old = new Set(b.cases.map(caseKey)),
          ds = feed.deliveries(d);
        return {
          day: iso(d),
          new: n.cases.filter((c) => !old.has(caseKey(c))).length,
          above: n.wards.filter(hot).length,
          arrived: ds.length || null,
          issues: ds.length
            ? ds.filter(
                (x) =>
                  [
                    "susceptibility corrected",
                    "organism corrected",
                    "duplicate",
                  ].includes(x.kind) ||
                  (x.kind === "susceptibility" &&
                    days(x.known_at, x.event_at) > 10),
              ).length
            : null,
        };
      });
  const lane = {
      "culture received": "received",
      "culture result": "organism",
      "organism identified": "organism",
      "isolate final": "susceptibility",
      susceptibility: "susceptibility",
      "susceptibility corrected": "fixed",
      "organism corrected": "fixed",
      duplicate: "fixed",
    },
    arrivals = feed
      .deliveries(today)
      .map((d) => [
        round((d.known_at - dayOf(d.known_at)) / 3600000, 2),
        lane[d.kind] || "fixed",
        d.ward,
        round((d.known_at - d.event_at) / DAY, 1),
      ]);
  return {
    today: iso(today),
    yesterday: iso(yday),
    source: today > feed.src.end ? "feed" : "data",
    new_cases,
    clusters: clusters(now.cases, today),
    wards: now.wards.filter(hot).sort((a, b) => b.z - a.z),
    trends,
    versions,
    health,
    late,
    notes,
    types: now.types,
    all_wards: now.wards,
    pulse,
    arrivals,
    incidents: [0, 1, 2].flatMap((k) => incidents(feed, add(today, -k), idx)),
  };
}
export function calendar(feed) {
  if (!feed.calendarCache) {
    const idx = index(feed.view(feed.last), feed.last, add(feed.first, -35)),
      out = [];
    for (let d = feed.first; d <= feed.last; d += DAY) {
      const ds = feed.byDay[iso(d)] || [],
        inc = incidents(feed, d, idx),
        resistant = ds.filter(
          (x) =>
            x.kind === "isolate final" && FLAGS.some((f) => x.row[f] === "1"),
        ).length,
        late = ds.filter(
          (x) =>
            x.kind === "susceptibility" && days(x.known_at, x.event_at) > 10,
        ).length;
      out.push({
        day: iso(d),
        level: inc.some(
          (i) =>
            ["above", "first", "cluster", "grew", "gap", "late"].includes(
              i.kind,
            ) &&
            (i.kind !== "late" || i.n >= 20),
        )
          ? "notable"
          : inc.length
            ? "active"
            : "quiet",
        arrived: ds.length,
        resistant,
        late,
        incidents: inc.slice(0, 4),
      });
    }
    feed.calendarCache = out;
  }
  return {
    first: iso(feed.first),
    last: iso(feed.last),
    today: iso(feed.today),
    data_end: iso(feed.src.end),
    ready: true,
    days: feed.calendarCache,
  };
}
