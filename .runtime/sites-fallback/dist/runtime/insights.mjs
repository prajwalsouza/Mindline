import {
  DAY,
  date,
  iso,
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
  key,
  wilson,
  Random,
} from "./core.mjs";
import { wardsOverview, overview, clusters } from "./evidence.mjs";
const YEAR = 364,
  ageBand = (a) => (a >= 65 ? "65+" : "<65");
// erfc approximation with maximum absolute error below 1.5e-7.
export function pTwo(z) {
  const x = Math.abs(z) / Math.SQRT2,
    t = 1 / (1 + 0.3275911 * x);
  return Math.min(
    1,
    ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) *
      t +
      0.254829592) *
      t *
      Math.exp(-x * x),
  );
}
export function bh(ps) {
  const order = ps.map((_, i) => i).sort((a, b) => ps[a] - ps[b]),
    q = ps.map(() => 1);
  let run = 1;
  for (let r = order.length; r > 0; r--) {
    const i = order[r - 1];
    run = Math.min(run, (ps[i] * ps.length) / r);
    q[i] = Math.min(1, run);
  }
  return q;
}
export function poisCDF(k, lam) {
  if (k < 0) return 0;
  let term = Math.exp(-lam),
    s = term;
  for (let i = 1; i <= k; i++) {
    term *= lam / i;
    s += term;
  }
  return Math.min(1, s);
}
const poisSF = (k, l) => (k <= 0 ? 1 : Math.max(0, 1 - poisCDF(k - 1, l)));
function poisRange(l) {
  let a = 0;
  while (poisCDF(a, l) < 0.025) a++;
  let b = a;
  while (poisCDF(b, l) < 0.975) b++;
  return [a, b];
}
const sure = (q, p, ok = true) =>
  q < 0.05 && ok ? "clear" : p < 0.05 && ok ? "possible" : "none";
const adjust = (out, ok = () => true) => {
  bh(out.map((x) => x.p)).forEach((q, i) => {
    out[i].q = q;
    out[i].sure = sure(q, out[i].p, ok(out[i]));
  });
  return out;
};
export function records(src) {
  const out = [];
  for (const c of src.cultures) {
    if (c._date > src.end) continue;
    for (const i of src.isolates[c.culture_id] || [])
      out.push({
        d: c._date,
        pid: c.patient_id,
        cid: c.culture_id,
        ward: c.ward_code,
        sex: src.patients[c.patient_id]?.sex || "F",
        age: +c.age_years || 0,
        spec: c.specimen,
        org: i.organism,
        res: Object.fromEntries(
          (src.sus[i.isolate_id] || []).map((s) => [
            s.antibiotic_code,
            s.result,
          ]),
        ),
        flags: FLAGS.filter((f) => i[f] === "1").map((f) => f.toUpperCase()),
      });
  }
  return out;
}
export function first(recs, lo, hi, spec = null, org = null, ward = null) {
  const out = [],
    seen = new Set();
  for (const r of recs) {
    if (
      r.d <= lo ||
      r.d > hi ||
      (spec && r.spec !== spec) ||
      (org && r.org !== org) ||
      (ward && r.ward !== ward)
    )
      continue;
    const k = key(r.pid, r.org, r.spec);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
const tested = (rs, d) => rs.filter((r) => ["S", "R"].includes(r.res[d]));
const nr = (rs, d) => {
  const t = tested(rs, d);
  return [t.length, t.filter((r) => r.res[d] === "R").length];
};
const window = (lo, hi) => ({
  from: iso(add(lo, 1)),
  to: iso(hi),
  days: days(hi, lo),
});
export function standardised(a, b, drug, kfn) {
  const s = [{}, {}];
  [a, b].forEach((rows, g) => {
    for (const r of tested(rows, drug)) {
      const k = kfn(r);
      s[g][k] ||= [0, 0];
      s[g][k][0]++;
      s[g][k][1] += Number(r.res[drug] === "R");
    }
  });
  const strata = Object.keys(s[0]).filter((k) => s[1][k]),
    N = sum(strata, (k) => s[0][k][0] + s[1][k][0]);
  if (!N) return null;
  const adj = [0, 0],
    vari = [0, 0];
  for (const k of strata) {
    const w = (s[0][k][0] + s[1][k][0]) / N;
    for (let g = 0; g < 2; g++) {
      const [n, r] = s[g][k],
        p = r / n,
        pv = (r + 0.5) / (n + 1);
      adj[g] += w * p;
      vari[g] += (w * w * pv * (1 - pv)) / n;
    }
  }
  const diff = adj[1] - adj[0],
    se = Math.sqrt(vari[0] + vari[1]) || 1e-9,
    n0 = sum(Object.values(s[0]), (x) => x[0]),
    r0 = sum(Object.values(s[0]), (x) => x[1]),
    n1 = sum(Object.values(s[1]), (x) => x[0]),
    r1 = sum(Object.values(s[1]), (x) => x[1]);
  return {
    n0,
    r0,
    n1,
    r1,
    raw0: n0 ? r0 / n0 : null,
    raw1: n1 ? r1 / n1 : null,
    adj0: adj[0],
    adj1: adj[1],
    diff,
    ci: [diff - 1.96 * se, diff + 1.96 * se],
    p: pTwo(diff / se),
    kept: N / Math.max(1, n0 + n1),
  };
}
function losing(recs, asof, start) {
  const org = "Escherichia coli",
    spec = "urine",
    years = [2, 1, 0]
      .map((k) => [add(asof, -YEAR * (k + 1)), add(asof, -YEAR * k)])
      .filter((y) => y[0] >= add(start, -1));
  if (years.length < 2) return null;
  const rows = years.map(([lo, hi]) => first(recs, lo, hi, spec, org)),
    out = [];
  for (const drug of ORDER) {
    const cs = rows.map((r) => nr(r, drug));
    if (Math.min(...cs.map((x) => x[0])) < 30) continue;
    const st = standardised(rows[0], rows.at(-1), drug, (r) =>
      key(r.sex, ageBand(r.age), r.ward),
    );
    if (!st) continue;
    const months = {};
    for (const rs of rows)
      for (const r of tested(rs, drug)) {
        const m = iso(r.d).slice(0, 7);
        months[m] ||= [0, 0];
        months[m][0]++;
        months[m][1] += Number(r.res[drug] === "R");
      }
    out.push({
      drug,
      years: cs.map(([n, r]) => ({ n, r, share: r / n, ci: wilson(r, n) })),
      ...st,
      monthly: Object.keys(months)
        .sort()
        .map((m) => ({ m, n: months[m][0], r: months[m][1] })),
    });
  }
  if (out.length < 2) return null;
  adjust(out, (x) => Math.abs(x.diff) >= 0.01);
  out.sort((a, b) => b.diff - a.diff);
  return {
    id: "losing",
    org: short(org),
    spec,
    windows: years.map((y) => window(...y)),
    drugs: out,
  };
}
function volume(recs, asof, start) {
  const org = "Escherichia coli",
    spec = "urine",
    y0 = [add(asof, -2 * YEAR), add(asof, -YEAR)],
    y1 = [add(asof, -YEAR), asof];
  if (y0[0] < add(start, -1)) return null;
  const a = first(recs, ...y0, spec, org),
    b = first(recs, ...y1, spec, org),
    out = [];
  for (const drug of ORDER) {
    const [n0, r0] = nr(a, drug),
      [n1, r1] = nr(b, drug);
    if (Math.min(n0, n1) < 30 || r0 + r1 < 20) continue;
    const p0 = r0 / n0,
      p1 = r1 / n1,
      pp = (r0 + r1) / (n0 + n1),
      z =
        (p1 - p0) /
        Math.sqrt(Math.max(1e-12, pp * (1 - pp) * (1 / n0 + 1 / n1)));
    out.push({
      drug,
      n0,
      r0,
      n1,
      r1,
      p0,
      p1,
      volume: ((n1 - n0) * (p0 + p1)) / 2,
      share: ((p1 - p0) * (n0 + n1)) / 2,
      p: pTwo(z),
    });
  }
  if (!out.length || Math.max(...out.map((x) => Math.abs(x.r1 - x.r0))) < 5)
    return null;
  adjust(out);
  out.sort((a, b) => Math.abs(b.r1 - b.r0) - Math.abs(a.r1 - a.r0));
  return {
    id: "volume",
    org: short(org),
    spec,
    windows: [window(...y0), window(...y1)],
    drugs: out.slice(0, 6),
  };
}
function unusual(feed, asof) {
  const wo = overview(feed, asof),
    lo = add(asof, -28),
    types = {};
  for (const c of wo.cases)
    if (date(c.date) > lo) {
      types[c.ward] ||= {};
      types[c.ward][c.flags[0]] = (types[c.ward][c.flags[0]] || 0) + 1;
    }
  const wards = wo.wards.map((w) => {
    const lam = Math.max(w.expected, 0.25);
    return {
      ward: w.code,
      name: w.name,
      n: w.recent,
      expected: w.expected,
      range: poisRange(lam),
      flagged: w.recent >= 3 && w.z > 2,
      p: poisSF(w.recent, lam),
      weekly: w.weekly,
      types: types[w.code] || {},
    };
  });
  if (!wards.some((w) => w.n >= 3)) return null;
  adjust(wards, (w) => w.n >= 3);
  for (const w of wards) w.years = w.p > 0 ? round(1 / (w.p * 13), 1) : null;
  wards.sort(
    (a, b) =>
      Number(a.sure !== "clear") - Number(b.sure !== "clear") ||
      Number(!a.flagged) - Number(!b.flagged) ||
      a.p - b.p,
  );
  return {
    id: "unusual",
    windows: [window(lo, asof), window(add(asof, -393), lo)],
    wards,
  };
}
function quiet(src, asof) {
  let weeks = 52;
  const lo = add(asof, -7 * 78),
    vol = count(
      src.cultures.filter((c) => c._date > lo && c._date <= asof),
      (c) => key(c.ward_code, Math.floor(days(asof, c._date) / 7)),
    );
  if (days(asof, src.start) < 7 * 78)
    weeks = Math.max(8, Math.floor(days(asof, src.start) / 7) - 26);
  const rows = [],
    gaps = [];
  for (const ward of Object.keys(src.wards)) {
    const cells = [];
    for (let k = weeks - 1; k >= 0; k--) {
      const usual = median(
          range(26).map((j) => vol[key(ward, k + j + 1)] || 0),
        ),
        n = vol[key(ward, k)] || 0,
        p = usual >= 10 ? poisCDF(n, usual) : 1,
        cell = { k, end: iso(add(asof, -7 * k)), n, usual, gap: p < 0.001 };
      cells.push(cell);
      if (cell.gap) gaps.push({ ward, ...cell, p });
    }
    rows.push({ ward, cells });
  }
  if (!gaps.length) return null;
  gaps.sort(
    (a, b) =>
      a.n / Math.max(a.usual, 1) - b.n / Math.max(b.usual, 1) ||
      (a.end < b.end ? -1 : 1),
  );
  return {
    id: "quiet",
    windows: [window(add(asof, -7 * weeks), asof)],
    weeks,
    rows,
    gaps,
  };
}
function late(feed, asof) {
  if (asof <= feed.src.end) return null;
  const lo = add(asof, -28),
    per = {},
    batches = {};
  for (const d of feed.run.deliveries) {
    const k = date(iso(d.known_at));
    if (k <= lo || k > asof || d.kind !== "susceptibility") continue;
    const v = (d.known_at - d.event_at) / DAY;
    (per[d.ward] ||= []).push(v);
    if (v > 10) {
      const key_ = key(d.ward, iso(k));
      batches[key_] = (batches[key_] || 0) + 1;
    }
  }
  const all = Object.values(per).flat();
  if (all.length < 30) return null;
  const wards = Object.entries(per)
    .map(([ward, v]) => ({
      ward,
      n: v.length,
      median: median(v),
      p90: [...v].sort((a, b) => a - b)[
        Math.min(v.length - 1, Math.floor(0.9 * v.length))
      ],
      late: v.filter((x) => x > 7).length / v.length,
      sample: new Random(7)
        .sample(v, Math.min(60, v.length))
        .sort((a, b) => a - b),
    }))
    .sort((a, b) => b.p90 - a.p90);
  return {
    id: "late",
    windows: [window(lo, asof)],
    median: median(all),
    after7: all.filter((x) => x > 7).length / all.length,
    n: all.length,
    wards,
    batches: common(batches)
      .slice(0, 5)
      .filter((x) => x[1] >= 5)
      .map(([k, n]) => {
        const [ward, day] = JSON.parse(k);
        return { ward, day, n };
      }),
  };
}
function linked(feed, recs, asof) {
  const wo = overview(feed, asof),
    cls = clusters(wo.cases, asof)
      .filter((c) => c.status !== "over")
      .slice(0, 3);
  if (!cls.length) return null;
  const year = first(recs, add(asof, -YEAR), asof),
    rng = new Random(11),
    out = [];
  const densest = (ds) => {
    let best = 0,
      j = 0;
    for (let i = 0; i < ds.length; i++) {
      while (ds[i] - ds[j] >= 28) j++;
      best = Math.max(best, i - j + 1);
    }
    return best;
  };
  for (const cl of cls) {
    const org = year.find((r) => short(r.org) === cl.organism)?.org,
      drugs = ORDER.map((d, i) => [d, cl.fp[i]]).filter((x) =>
        ["S", "R"].includes(x[1]),
      ),
      pool = year.filter(
        (r) =>
          r.org === org && drugs.every(([d]) => ["S", "R"].includes(r.res[d])),
      ),
      match = pool.filter((r) => drugs.every(([d, ch]) => r.res[d] === ch)),
      same = wo.cases
        .filter(
          (c) =>
            c.fp + c.short === cl.key &&
            key(c.flags) === key(cl.flags) &&
            date(c.date) > add(asof, -YEAR),
        )
        .sort((a, b) => (a.date < b.date ? -1 : 1)),
      ds = same.map((c) => days(asof, date(c.date))).sort((a, b) => a - b),
      obs = densest(ds),
      k = ds.length;
    let hits = 0;
    for (let j = 0; j < 1999; j++)
      if (
        densest(
          range(k)
            .map(() => rng.int(0, YEAR - 1))
            .sort((a, b) => a - b),
        ) >= obs
      )
        hits++;
    const p = (1 + hits) / 2000;
    let j = 0,
      best = [0, 0];
    for (let i = 0; i < ds.length; i++) {
      while (ds[i] - ds[j] >= 28) j++;
      if (i - j + 1 > best[1] - best[0]) best = [j, i + 1];
    }
    const weekly = range(52).map(() => 0);
    for (const r of year)
      if (r.org === org)
        weekly[Math.min(51, Math.floor(days(asof, r.d) / 7))]++;
    out.push({
      organism: cl.organism,
      flags: cl.flags,
      status: cl.status,
      fp: cl.fp,
      since: cl.since,
      n: k,
      in28: obs,
      p,
      sure: sure(p, p),
      pool: pool.length,
      match: match.length,
      wards: common(count(same, (c) => c.ward)),
      hospital: same.filter((c) => c.hday >= 3).length,
      cases: same.map((c) => ({ date: c.date, ward: c.ward, hday: c.hday })),
      dense: ds.length
        ? [iso(add(asof, -ds[best[1] - 1])), iso(add(asof, -ds[best[0]]))]
        : null,
      background: weekly.reverse(),
      drugs: drugs.map((x) => x[0]),
    });
  }
  return {
    id: "linked",
    windows: [window(add(asof, -YEAR), asof)],
    clusters: out,
  };
}
function rules(recs, asof, start) {
  const org = "Escherichia coli",
    spec = "urine",
    now = [add(asof, -YEAR), asof],
    lo = Math.max(add(start, -1), add(asof, -3 * YEAR));
  if (days(now[0], lo) < 180) return null;
  const before = [lo, now[0]],
    A = first(recs, ...before, spec, org),
    B = first(recs, ...now, spec, org),
    pairs = [];
  const table = (rows, a, b) => {
      const t = [
        [0, 0],
        [0, 0],
      ];
      for (const r of rows) {
        const x = r.res[a],
          y = r.res[b];
        if (["S", "R"].includes(x) && ["S", "R"].includes(y))
          t[Number(x === "R")][Number(y === "R")]++;
      }
      return t;
    },
    lor = (t) => {
      const [a, b, c, d] = t.flat().map((v) => v + 0.5);
      return [Math.log((a * d) / (b * c)), 1 / a + 1 / b + 1 / c + 1 / d];
    },
    cond = (t) => [t[1][1] / sum(t[1]), t[0][1] / sum(t[0])];
  for (let i = 0; i < ORDER.length; i++)
    for (const y of ORDER.slice(0, i)) {
      const x = ORDER[i],
        t0 = table(A, x, y),
        t1 = table(B, x, y);
      if (Math.min(sum(t0[1]), sum(t0[0]), sum(t1[1]), sum(t1[0])) < 30)
        continue;
      const [l0, v0] = lor(t0),
        [l1, v1] = lor(t1),
        c0 = cond(t0);
      if (
        l0 - 1.96 * Math.sqrt(v0) <= 0 ||
        Math.exp(l0) < 1.5 ||
        c0[0] < 0.1 ||
        c0[0] >= 0.9
      )
        continue;
      const pack = (l, v, t) => ({
        or: Math.exp(l),
        ci: [
          Math.exp(l - 1.96 * Math.sqrt(v)),
          Math.exp(l + 1.96 * Math.sqrt(v)),
        ],
        cond: cond(t),
        n: [sum(t[1]), sum(t[0])],
      });
      pairs.push({
        a: x,
        b: y,
        before: pack(l0, v0, t0),
        now: pack(l1, v1, t1),
        p: pTwo((l1 - l0) / Math.sqrt(v0 + v1)),
      });
    }
  if (!pairs.length) return null;
  bh(pairs.map((x) => x.p)).forEach((q, i) => {
    pairs[i].q = q;
    pairs[i].state =
      q >= 0.05 ? "holds" : pairs[i].now.ci[0] > 1 ? "weaker" : "gone";
  });
  const ord = { gone: 0, weaker: 1, holds: 2 };
  pairs.sort((a, b) => ord[a.state] - ord[b.state] || a.q - b.q);
  return {
    id: "rules",
    org: short(org),
    spec,
    windows: [window(...before), window(...now)],
    pairs: pairs.slice(0, 6),
    n_rules: pairs.length,
  };
}
function who(recs, asof, spec, start) {
  const lo = Math.max(add(start, -1), add(asof, -2 * YEAR));
  let rows = first(recs, lo, asof, spec);
  if (!rows.length) return null;
  const org = common(count(rows, (r) => r.org))[0][0];
  rows = rows.filter((r) => r.org === org);
  const dims = {};
  for (const [dim, split, kfn, labels] of [
    [
      "sex",
      (r) => r.sex === "M",
      (r) => key(ageBand(r.age), r.ward),
      ["F", "M"],
    ],
    ["age", (r) => r.age >= 65, (r) => key(r.sex, r.ward), ["<65", "65+"]],
  ]) {
    const a = rows.filter((r) => !split(r)),
      b = rows.filter(split),
      out = [];
    for (const drug of ORDER) {
      if (Math.min(nr(a, drug)[0], nr(b, drug)[0]) < 30) continue;
      const st = standardised(a, b, drug, kfn);
      if (st) out.push({ drug, ...st });
    }
    adjust(out, (x) => Math.abs(x.diff) >= 0.02);
    if (out.length) dims[dim] = { labels, drugs: out };
  }
  return Object.keys(dims).length
    ? { id: "who", org: short(org), spec, windows: [window(lo, asof)], dims }
    : null;
}
function unknown(src, asof, spec, ward) {
  const lo = add(asof, -YEAR);
  function cultures(w) {
    const seen = new Set(),
      out = [];
    for (const c of src.cultures) {
      if (
        c._date <= lo ||
        c._date > asof ||
        c.specimen !== spec ||
        c.result !== "positive" ||
        (w && c.ward_code !== w) ||
        seen.has(c.patient_id)
      )
        continue;
      const is = src.isolates[c.culture_id] || [];
      if (!is.length) continue;
      seen.add(c.patient_id);
      out.push(
        is.map((i) => [
          i.organism,
          Object.fromEntries(
            (src.sus[i.isolate_id] || []).map((s) => [
              s.antibiotic_code,
              s.result,
            ]),
          ),
        ]),
      );
    }
    return out;
  }
  let cs = cultures(ward),
    scope = "ward";
  if (cs.length < 200) {
    cs = cultures(null);
    scope = "hospital";
  }
  if (cs.length < 60) return null;
  const orgs = count(cs.flat(), (i) => i[0]),
    drugs = [];
  for (const drug of ORDER) {
    let works = 0,
      fails = 0,
      untested = 0;
    for (const c of cs) {
      const rs = c.map((i) => i[1][drug]);
      if (rs.includes("R")) fails++;
      else if (rs.every((x) => x === "S")) works++;
      else untested++;
    }
    if (works + fails < Math.max(30, 0.3 * cs.length)) continue;
    const by_org = {};
    for (const [o] of common(orgs).slice(0, 6)) {
      const t = cs
        .flat()
        .filter(([oo, res]) => oo === o && ["S", "R"].includes(res[drug]))
        .map((x) => x[1][drug]);
      if (t.length >= 20)
        by_org[short(o)] = {
          n: t.length,
          works: t.filter((x) => x === "S").length / t.length,
        };
    }
    drugs.push({ drug, n: cs.length, works, fails, untested, by_org });
  }
  if (!drugs.length) return null;
  const never = drugs
    .flatMap((d) =>
      Object.entries(d.by_org)
        .filter(([o, v]) => v.works <= 0.05)
        .map(([org, v]) => ({ org, drug: d.drug, n: v.n })),
    )
    .sort((a, b) => b.n - a.n)
    .slice(0, 4);
  return {
    id: "unknown",
    spec,
    scope,
    ward,
    windows: [window(lo, asof)],
    n: cs.length,
    organisms: common(orgs)
      .slice(0, 6)
      .map(([o, n]) => ({
        org: short(o),
        n,
        share: n / sum(Object.values(orgs)),
      })),
    drugs,
    never,
  };
}
function guide(recs, asof, spec, ward) {
  const ends = range(13)
      .reverse()
      .map((k) => add(asof, -28 * k)),
    cache = new Map(),
    rows = (lo, hi) => {
      const k = key(lo, hi);
      if (!cache.has(k)) cache.set(k, first(recs, lo, hi, spec, null, ward));
      return cache.get(k);
    },
    yn = rows(add(asof, -YEAR), asof),
    wins = [];
  for (const drug of ORDER) {
    if (nr(yn, drug)[0] < 30) continue;
    let ll_y = 0,
      ll_m = 0,
      m = 0,
      series = [];
    for (const e of ends) {
      const test = tested(rows(add(e, -28), e), drug),
        [ny, ry] = nr(rows(add(e, -28 - YEAR), add(e, -28)), drug),
        [nm, rm] = nr(rows(add(e, -56), add(e, -28)), drug),
        py = (ry + 1) / (ny + 2),
        pm = (rm + 1) / (nm + 2);
      for (const r of test) {
        const y = r.res[drug] === "R";
        ll_y -= Math.log(y ? py : 1 - py);
        ll_m -= Math.log(y ? pm : 1 - pm);
        m++;
      }
      series.push({
        end: iso(e),
        n: test.length,
        r: test.filter((r) => r.res[drug] === "R").length,
        year: py,
        month: pm,
      });
    }
    if (m < 30) continue;
    const [n, r] = nr(yn, drug),
      [n4, r4] = nr(rows(add(asof, -28), asof), drug),
      p = r / n;
    wins.push({
      drug,
      ll_year: ll_y / m,
      ll_month: ll_m / m,
      year_better: ll_y < ll_m,
      tested: m,
      series,
      year: { n, r, share: p, ci: wilson(r, n) },
      month: { n: n4, r: r4 },
      steady: (r4 + 40 * p) / (n4 + 40),
    });
  }
  return wins.length < 2
    ? null
    : {
        id: "guide",
        spec,
        ward,
        windows: [window(add(ends[0], -28), asof)],
        drugs: wins,
        year_wins: wins.filter((w) => w.year_better).length,
      };
}
function fails(recs, asof, spec) {
  const rows = first(recs, add(asof, -YEAR), asof, spec),
    prev = first(recs, add(asof, -2 * YEAR), add(asof, -YEAR), spec),
    drugs = ORDER.filter(
      (d) => nr(rows, d)[0] >= Math.max(60, 0.3 * rows.length),
    );
  if (drugs.length < 3) return null;
  const cond = (rr, a, b) => {
      const fa = rr.filter(
          (r) => r.res[a] === "R" && ["S", "R"].includes(r.res[b]),
        ),
        wa = rr.filter(
          (r) => r.res[a] === "S" && ["S", "R"].includes(r.res[b]),
        );
      return [
        fa.length,
        fa.filter((r) => r.res[b] === "R").length,
        wa.length,
        wa.filter((r) => r.res[b] === "R").length,
      ];
    },
    cells = [];
  for (const a of drugs)
    for (const b of drugs) {
      if (a === b) continue;
      const [nf, rf, nw, rw] = cond(rows, a, b);
      if (nf < 20 || nw < 20) continue;
      const pf = rf / nf,
        pw = rw / nw,
        pp = (rf + rw) / (nf + nw),
        z =
          (pf - pw) /
          Math.sqrt(Math.max(1e-12, pp * (1 - pp) * (1 / nf + 1 / nw))),
        [pnf, prf] = cond(prev, a, b);
      cells.push({
        a,
        b,
        if_fails: pf,
        if_works: pw,
        n_fails: nf,
        n_works: nw,
        ci: wilson(rf, nf),
        p: pTwo(z),
        before: pnf >= 20 ? prf / pnf : null,
      });
    }
  if (!cells.length) return null;
  adjust(cells, (x) => x.if_fails - x.if_works >= 0.05);
  return {
    id: "fails",
    spec,
    windows: [window(add(asof, -YEAR), asof)],
    drugs,
    cells,
  };
}
function colleagues(notes, recs, asof, spec, ward) {
  const ns = notes.filter((n) => n.fields.kind === "decision" && n.fields.drug);
  if (ns.length < 3) return null;
  const rows = first(recs, add(asof, -YEAR), asof, spec, null, ward),
    by = count(ns, (n) => n.fields.drug);
  return {
    id: "colleagues",
    ward,
    windows: [window(add(asof, -YEAR), asof)],
    n: ns.length,
    drugs: common(by).map(([drug, decisions]) => {
      const [n, r] = nr(rows, drug);
      return { drug, decisions, n, works: n >= 30 ? (n - r) / n : null };
    }),
    months: common(count(ns, (n) => n.fields.month || "")),
  };
}
export function insights(feed, q = {}, notes = []) {
  const role = q.role === "doctor" ? "doctor" : "hygiene",
    src = feed.view(q.asof ? date(q.asof) : feed.today),
    asof = src.end,
    start = src.start,
    recs = records(src),
    ward = q.ward || "URO",
    spec = q.spec || "urine",
    items =
      role === "doctor"
        ? [
            who(recs, asof, spec, start),
            unknown(src, asof, spec, ward),
            guide(recs, asof, spec, ward),
            fails(recs, asof, spec),
            colleagues(notes, recs, asof, spec, ward),
          ]
        : [
            losing(recs, asof, start),
            volume(recs, asof, start),
            unusual(feed, asof),
            quiet(src, asof),
            late(feed, asof),
            linked(feed, recs, asof),
            rules(recs, asof, start),
          ],
    found = Object.fromEntries(items.filter(Boolean).map((x) => [x.id, x])),
    groups =
      role === "doctor"
        ? [
            ["patient", ["who", "unknown", "guide"]],
            ["fails", ["fails"]],
            ["colleagues", ["colleagues"]],
          ]
        : [
            ["rising", ["losing", "volume", "unusual"]],
            ["trust", ["quiet", "late"]],
            ["linked", ["linked"]],
            ["rules", ["rules"]],
          ];
  return {
    role,
    asof: iso(asof),
    source: asof > feed.src.end ? "feed" : "data",
    ward,
    spec,
    groups: groups
      .map(([id, ids]) => ({
        id,
        items: ids.map((i) => found[i]).filter(Boolean),
      }))
      .filter((g) => g.items.length),
  };
}
