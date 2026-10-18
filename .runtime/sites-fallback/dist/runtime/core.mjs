// Pure JavaScript equivalents of the Python data helpers. All dates use UTC.
export const DAY = 86400000,
  HOUR = 3600000;
export const date = (s) =>
  typeof s === "number"
    ? s
    : Date.parse(s.length === 10 ? s + "T00:00:00Z" : s.replace(/Z?$/, "Z"));
export const iso = (d) => new Date(d).toISOString().slice(0, 10);
export const stamp = (d) => new Date(d).toISOString().slice(0, 16);
export const dayOf = (d) => Math.floor(d / DAY) * DAY;
export const add = (d, n) => d + n * DAY;
export const days = (a, b) => Math.floor((a - b) / DAY);
export const round = (n, k = 0) => {
  const p = 10 ** k,
    v = n * p,
    f = Math.floor(v);
  return (
    (Math.abs(v - f - 0.5) < 1e-10
      ? f + (f % 2 !== 0 ? 1 : 0)
      : Math.round(v)) / p
  );
};
export const sum = (xs, f = (x) => x) => xs.reduce((s, x) => s + f(x), 0);
export const median = (xs) => {
  const a = [...xs].sort((a, b) => a - b),
    k = Math.floor(a.length / 2);
  return a.length ? (a.length % 2 ? a[k] : (a[k - 1] + a[k]) / 2) : 0;
};
export const count = (xs, f = (x) => x) => {
  const o = {};
  for (const x of xs) {
    const k = f(x);
    o[k] = (o[k] || 0) + 1;
  }
  return o;
};
export const group = (xs, f) => {
  const o = {};
  for (const x of xs) (o[f(x)] ||= []).push(x);
  return o;
};
export const common = (o) => Object.entries(o).sort((a, b) => b[1] - a[1]);
export const range = (n) => Array.from({ length: Math.max(0, n) }, (_, i) => i);
export const short = (o) => o.split(" ")[0][0] + ". " + o.split(" ").at(-1);
export const FLAGS = ["esbl", "mrsa", "vre", "cpe"];
export const ORDER = [
  "NIT",
  "MEC",
  "TMP",
  "AMP",
  "CLI",
  "CXM",
  "CIP",
  "CRO",
  "CAZ",
  "VAN",
  "TZP",
  "MEM",
];
export const SPECTRUM = Object.fromEntries(
  ORDER.map((d) => [
    d,
    ["NIT", "MEC", "TMP", "AMP", "CLI"].includes(d)
      ? "narrow"
      : d === "CXM"
        ? "moderate"
        : ["VAN", "MEM"].includes(d)
          ? "reserve"
          : "broad",
  ]),
);
export const key = (...parts) => JSON.stringify(parts);
export function unpack(p) {
  return p.rows.map((row) =>
    Object.fromEntries(p.columns.map((c, i) => [c, row[i]])),
  );
}
export function source(p) {
  const s = { ...p };
  s.cultures = unpack(p.cultures).map((c) => ({
    ...c,
    _date: date(c.sample_date),
  }));
  s.isolates = group(unpack(p.isolates), (i) => i.culture_id);
  s.sus = group(unpack(p.sus), (i) => i.isolate_id);
  for (const [t, k] of [
    ["patients", "patient_id"],
    ["wards", "ward_code"],
    ["antibiotics", "antibiotic_code"],
  ])
    s[t] = Object.fromEntries(unpack(p[t]).map((x) => [x[k], x]));
  s.start = date(p.start);
  s.end = date(p.end);
  s.by_ward = group(s.cultures, (c) => c.ward_code);
  s.by_ward_day = count(s.cultures, (c) => key(c.ward_code, c._date));
  s.resistant_dates = {};
  for (const c of s.cultures)
    if (
      (s.isolates[c.culture_id] || []).some((i) =>
        FLAGS.some((f) => i[f] === "1"),
      )
    )
      (s.resistant_dates[c.patient_id] ||= []).push(c._date);
  return s;
}
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = k / n,
    d = 1 + (z * z) / n,
    c = p + (z * z) / (2 * n),
    r = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return [round((c - r) / d, 3), round((c + r) / d, 3)];
}
// Seeded PRNG: stable across JS engines; intentionally independent of CPython's seed stream.
export class Random {
  constructor(seed = 7) {
    this.state = Number(seed) >>> 0;
  }
  random() {
    let t = (this.state += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  int(a, b) {
    return a + Math.floor(this.random() * (b - a + 1));
  }
  choice(a) {
    if (!a.length) throw Error("No matching template");
    return a[this.int(0, a.length - 1)];
  }
  weighted(a, w) {
    let t = this.random() * sum(w);
    for (let i = 0; i < a.length; i++) {
      t -= w[i];
      if (t < 0) return a[i];
    }
    return a.at(-1);
  }
  normal(mu = 0, sd = 1) {
    return (
      mu +
      sd *
        Math.sqrt(-2 * Math.log(Math.max(this.random(), 1e-15))) *
        Math.cos(2 * Math.PI * this.random())
    );
  }
  poisson(lam) {
    let p = 1,
      k = 0,
      L = Math.exp(-lam);
    do {
      p *= this.random();
      if (p <= L) return k;
      k++;
    } while (true);
  }
  gamma(a) {
    if (a < 1) return this.gamma(a + 1) * this.random() ** (1 / a);
    const d = a - 1 / 3,
      c = 1 / Math.sqrt(9 * d);
    for (;;) {
      let x = this.normal(),
        v = (1 + c * x) ** 3;
      if (v <= 0) continue;
      let u = this.random();
      if (
        u < 1 - 0.0331 * x ** 4 ||
        Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))
      )
        return d * v;
    }
  }
  beta(a, b) {
    let x = this.gamma(a);
    return x / (x + this.gamma(b));
  }
  sample(a, n) {
    const out = [...a];
    for (let i = 0; i < n; i++) {
      const j = this.int(i, out.length - 1);
      [out[i], out[j]] = [out[j], out[i]];
    }
    return out.slice(0, n);
  }
}
export function csv(cols, rows, sep = ",") {
  const cell = (x) => {
    let s = String(x ?? "");
    return s.includes(sep) || /["\r\n]/.test(s)
      ? '"' + s.replaceAll('"', '""') + '"'
      : s;
  };
  return (
    [cols, ...rows.map((r) => cols.map((c) => r[c] ?? ""))]
      .map((r) => r.map(cell).join(sep))
      .join("\n") + "\n"
  );
}
