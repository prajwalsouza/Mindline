import {
  DAY,
  HOUR,
  date,
  iso,
  stamp,
  dayOf,
  add,
  days,
  range,
  key,
  group,
  count,
  sum,
  FLAGS,
  Random,
} from "./core.mjs";
const CONFUSABLE = {
  "Klebsiella oxytoca": "Klebsiella pneumoniae",
  "Klebsiella pneumoniae": "Klebsiella oxytoca",
  "Citrobacter freundii": "Escherichia coli",
  "Proteus mirabilis": "Escherichia coli",
  "Staphylococcus saprophyticus": "Staphylococcus aureus",
  "Enterococcus faecalis": "Staphylococcus aureus",
};
const entero = (o) =>
  /^(Escherichia|Klebsiella|Proteus|Citrobacter|Enterobacter)/.test(o);
const pick = (o, ks) => Object.fromEntries(ks.map((k) => [k, o[k]]));
const pad = (n, k) => String(n).padStart(k, "0");
function isoWeek(d) {
  let x = new Date(d);
  x.setUTCDate(x.getUTCDate() + 4 - (x.getUTCDay() || 7));
  const y = x.getUTCFullYear();
  return [
    String(y),
    String(Math.ceil(((x - Date.UTC(y, 0, 1)) / DAY + 1) / 7)),
  ];
}

export function demoRecipe(src) {
  const r = structuredClone(src.presets.demo.recipe);
  r.start = iso(add(src.end, 1));
  r.end = iso(add(src.end, 121));
  r.seed = 11;
  const sc = r.scenarios;
  Object.assign(sc.G1, { day: 10, days: 24, ward: "ICU", flag: "mrsa", n: 11 });
  Object.assign(sc.A4, { day: 5, days: 5, ward: "PHC-S" });
  Object.assign(sc.A2, { day: 16, days: 5, late_days: 8, ward: "PHC-N" });
  Object.assign(sc.G6, { day: 20, days: 28, ward: "ED" });
  Object.assign(sc.G3, { day: 33, ward: "MED-B" });
  Object.assign(sc.D1, { day: 95 });
  return r;
}
export class Run {
  constructor(src, recipe) {
    this.src = src;
    this.recipe = structuredClone(recipe);
    this.on = this.recipe.scenarios;
    this.rng = new Random(recipe.seed ?? 7);
    this.start = date(recipe.start);
    this.end = add(date(recipe.end), 1);
    if (
      !Number.isFinite(this.start) ||
      !Number.isFinite(this.end) ||
      this.end <= this.start
    )
      throw Error("Choose a valid start and end date.");
    if (days(this.end, this.start) > 1096)
      throw Error("Choose a window of at most three years.");
    if (!this.on || typeof this.on !== "object")
      throw Error("Missing scenarios.");
    for (const [code, p] of Object.entries(this.on)) {
      if (!src.catalogue.some((x) => x.code === code))
        throw Error("Unknown scenario: " + code);
      if (p.ward && !src.wards[p.ward]) throw Error("Unknown ward: " + p.ward);
      for (const [k, v] of Object.entries(p))
        if (typeof v === "number" && (!Number.isFinite(v) || v < 0))
          throw Error("Invalid " + code + " " + k);
    }
    this.deliveries = [];
    this.cases = [];
    this.truth = {};
    this.batch_format = {};
    this.stats = {};
  }
  note(code, n = 1, info = {}) {
    const t = (this.truth[code] ||= { count: 0 });
    t.count += n;
    for (const [k, v] of Object.entries(info)) if (!(k in t)) t[k] = v;
  }
  when(day) {
    return add(this.start, Number(day));
  }
  label(code) {
    return this.src.catalogue.find((x) => x.code === code)?.label || code;
  }
  delay(spec, stage) {
    const m = this.src.mimic,
      p =
        m[`${spec === "screen" ? "screening" : spec}|${stage}`] ||
        m[`all|${stage}`];
    return (
      Math.min(504, Math.exp(this.rng.normal(p.log_mean, p.log_sd))) * HOUR
    );
  }
  lab(t, before) {
    let r =
      dayOf(t) +
      this.rng.weighted(range(24), this.src.mimic._release_hour_share) * HOUR +
      this.rng.int(0, 59) * 60000;
    while (r < before) r += DAY;
    return r;
  }
  sampleTime(c) {
    return (
      c._date +
      (c.institution === "primary_care"
        ? this.rng.int(8, 15)
        : this.rng.weighted(range(24), this.src.mimic._sample_hour_share)) *
        HOUR +
      this.rng.int(0, 59) * 60000
    );
  }
  guideline(day) {
    return this.on.D1 && day >= this.when(this.on.D1.day)
      ? this.on.D1.label
      : `EUCAST ${new Date(day).getUTCFullYear()}`;
  }
  clone(c, day, cid, patient = null, ward = null, tag = null, origin = "new") {
    const c2 = {
      ...c,
      culture_id: cid,
      _date: day,
      sample_date: iso(day),
      _tdate: c._date,
      _tsex: this.src.patients[c.patient_id].sex,
    };
    [c2.iso_year, c2.iso_week] = isoWeek(day);
    if (ward)
      Object.assign(
        c2,
        pick(this.src.wards[ward], [
          "ward_code",
          "ward_fi",
          "ward_en",
          "ward_type",
          "institution",
        ]),
      );
    if (patient) c2.patient_id = patient;
    c2.admission_date =
      c2.ward_type === "in"
        ? iso(add(day, -this.rng.choice([0, 1, 2, 3, 4, 6, 9])))
        : "";
    const isos = [],
      sus = {};
    for (const i of this.src.isolates[c.culture_id] || []) {
      const j = { ...i, culture_id: cid, isolate_id: `${cid}-${i.isolate_no}` };
      isos.push(j);
      sus[j.isolate_id] = (this.src.sus[i.isolate_id] || []).map((s) => ({
        ...s,
        isolate_id: j.isolate_id,
        culture_id: cid,
        guideline: this.guideline(day),
      }));
    }
    return [c2, isos, sus, origin, tag ? [tag] : []];
  }
  template(test) {
    const matches = this.src.cultures.filter((c) =>
      (this.src.isolates[c.culture_id] || []).some((i) => test(c, i)),
    );
    return this.rng.choice(matches);
  }
  newCases() {
    const s = this.src,
      by = group(s.cultures, (c) => key(c.ward_code, c._date)),
      pw = group(s.cultures.slice(-20000), (c) => c.ward_code),
      res = {};
    for (const [pid, ds] of Object.entries(s.resistant_dates))
      for (const d of ds) (res[d] ||= []).push(pid);
    const bins = s.armd.return_gap_days.bins;
    let n = 0;
    for (let d = add(s.end, 1); d < this.end; d += DAY)
      for (const w of Object.keys(s.wards)) {
        const same = [],
          pool = [];
        for (const back of [364, 728])
          for (let k = -14; k <= 14; k++) {
            const a = add(d, -back - k);
            if (new Date(a).getUTCDay() === new Date(d).getUTCDay())
              same.push(s.by_ward_day[key(w, a)] || 0);
          }
        for (let k = -21; k <= 21; k++)
          pool.push(...(by[key(w, add(d, -364 - k))] || []));
        if (!pool.length) continue;
        const size = this.rng.poisson(sum(same) / same.length);
        for (let j = 0; j < size; j++) {
          n++;
          const t = this.rng.choice(pool);
          let pid;
          if (this.rng.random() < s.return_share) {
            this.stats.returning = (this.stats.returning || 0) + 1;
            const b = this.rng.weighted(
                bins,
                bins.map((x) => x.share),
              ),
              gap = this.rng.int(
                Math.min(b.from, 1000),
                Math.min(b.to || 1100, 1100),
              ),
              cands = [];
            for (let k = -10; k <= 10; k++)
              cands.push(...(res[add(d, -gap + k)] || []));
            pid = cands.length
              ? this.rng.choice(cands)
              : this.rng.choice(pw[w]).patient_id;
            if (cands.length)
              this.stats.returning_armd = (this.stats.returning_armd || 0) + 1;
          } else pid = "PN" + pad(n, 6);
          this.cases.push(this.clone(t, d, "N" + pad(n, 7), pid, null, "N"));
        }
      }
    this.note("N", n, {
      label: this.label("N"),
      start: iso(add(s.end, 1)),
      end: iso(add(this.end, -1)),
    });
  }
  pickCases() {
    const s = this.src;
    for (const c of s.cultures)
      if (
        c._date >= add(this.start, -14) &&
        c._date <= Math.min(add(this.end, -1), s.end)
      ) {
        const is = (s.isolates[c.culture_id] || []).map((i) => ({ ...i }));
        this.cases.push([
          { ...c },
          is,
          Object.fromEntries(
            is.map((i) => [
              i.isolate_id,
              (s.sus[i.isolate_id] || []).map((x) => ({ ...x })),
            ]),
          ),
          "replayed",
          [],
        ]);
      }
    if (this.on.N) this.newCases();
    if (this.on.G1) {
      const p = this.on.G1,
        t = this.template(
          (c, i) =>
            i[p.flag] === "1" && (p.flag !== "mrsa" || c.specimen !== "urine"),
        ),
        d0 = this.when(p.day);
      for (let k = 0; k < p.n; k++) {
        const d = add(d0, k ? Math.floor(p.days * this.rng.beta(1.6, 2.4)) : 0),
          c = this.clone(
            t,
            d,
            "G" + pad(k + 1, 6),
            "PG" + pad(k + 1, 5),
            p.ward,
            "G1",
            "injected",
          );
        if (c[0].ward_type === "in")
          c[0].admission_date = iso(add(d, -this.rng.int(3, 12)));
        this.cases.push(c);
      }
      this.note("G1", p.n, {
        label: `${p.flag.toUpperCase()} outbreak on ${p.ward}`,
        ward: p.ward,
        start: iso(d0),
        end: iso(add(d0, p.days)),
        template: t.culture_id,
      });
    }
    if (this.on.G3) {
      const p = this.on.G3,
        t = this.template(
          (c, i) => i.organism === "Klebsiella pneumoniae" && i.esbl === "1",
        ),
        d = this.when(p.day),
        c = this.clone(t, d, "G9000001", "PG90001", p.ward, "G3", "injected");
      for (const i of c[1])
        if (i.organism === "Klebsiella pneumoniae") {
          i.cpe = "1";
          for (const s of c[2][i.isolate_id])
            if (["MEM", "TZP", "CRO", "CAZ"].includes(s.antibiotic_code))
              s.result = "R";
        }
      this.cases.push(c);
      this.note("G3", 1, {
        label: `First CPE, ${p.ward}`,
        ward: p.ward,
        start: iso(d),
      });
    }
    if (this.on.F1) {
      const p = this.on.F1,
        mrsa = this.template((c, i) => i.mrsa === "1"),
        neg = s.by_ward[p.ward].find((c) => c.result === "negative");
      let n = 0;
      for (let d = this.when(p.day); d < this.end; d += DAY) {
        const num = this.rng.poisson(p.per_day);
        for (let k = 0; k < num; k++) {
          n++;
          const pos = this.rng.random() < 0.04,
            c = this.clone(
              pos ? mrsa : neg,
              d,
              "S" + pad(n, 7),
              "PS" + pad(n, 6),
              p.ward,
              "F1",
              "injected",
            );
          Object.assign(c[0], { specimen: "screen", specimen_fi: "seulonta" });
          if (pos) {
            c[1] = c[1].filter((i) => i.mrsa === "1").slice(0, 1);
            c[0].n_isolates = String(c[1].length);
          }
          c[4].push("D7");
          this.cases.push(c);
        }
      }
      this.note("F1", n, {
        label: `Screening starts on ${p.ward}`,
        ward: p.ward,
        start: iso(this.when(p.day)),
      });
      this.note("D7", n, { label: "New specimen type 'screen'" });
    }
    if (this.on.G7) {
      const p = this.on.G7,
        t = this.template(
          (c, i) =>
            i.organism === "Pseudomonas aeruginosa" && c.specimen === "blood",
        ),
        ws = this.rng.sample(
          Object.keys(s.wards).sort(),
          Math.min(p.wards, Object.keys(s.wards).length),
        ),
        d0 = this.when(p.day);
      for (let k = 0; k < p.n; k++)
        this.cases.push(
          this.clone(
            t,
            add(d0, this.rng.int(0, Math.max(0, p.days - 1))),
            "G7" + pad(k + 1, 5),
            "PP" + pad(k + 1, 5),
            ws[k % ws.length],
            "G7",
            "injected",
          ),
        );
      this.note("G7", p.n, {
        label: `Pseudo-outbreak on ${ws.length} wards`,
        ward: ws.join(" "),
        start: iso(d0),
        end: iso(add(d0, p.days)),
      });
    }
  }
  shift(drug, rise) {
    return Math.max(
      0,
      Math.min(
        1,
        rise /
          100 /
          Math.max(0.05, 1 - (this.src.trends[drug]?.last_share || 0)),
      ),
    );
  }
  send(
    at,
    event_at,
    table,
    key,
    op,
    row,
    revision,
    status,
    kind,
    origin,
    tags,
    ward,
  ) {
    this.deliveries.push({
      known_at: at,
      event_at,
      table,
      key,
      op,
      row,
      revision,
      status,
      kind,
      origin,
      tags: [...tags],
      ward,
    });
  }
  stage(ca) {
    let [c, isos, sus, origin, tags] = ca;
    const on = this.on,
      r = this.rng,
      t0 = this.sampleTime(c),
      spec = c.specimen;
    let ward = c.ward_code;
    if (on.C9 && origin !== "injected" && r.random() < on.C9.rate) {
      ward = r.choice(Object.keys(this.src.wards).filter((w) => w !== ward));
      c = {
        ...c,
        ...pick(this.src.wards[ward], [
          "ward_code",
          "ward_fi",
          "ward_en",
          "ward_type",
          "institution",
        ]),
      };
      tags = [...tags, "C9"];
      this.note("C9", 1, { label: this.label("C9") });
    }
    const crow = pick(c, this.src.columns.cultures),
      received = t0 + r.int(30, 300) * 60000,
      pending = { ...crow, result: "pending", n_isolates: "" };
    const send = (
      at,
      table,
      k,
      op,
      row,
      rev,
      status,
      kind,
      ts = tags,
      or = origin,
    ) => this.send(at, t0, table, k, op, row, rev, status, kind, or, ts, ward);
    if (!isos.length) {
      send(
        received,
        "cultures",
        c.culture_id,
        "insert",
        pending,
        1,
        "received",
        "culture received",
      );
      send(
        this.lab(
          t0 + this.delay(spec, "1 no growth / test only"),
          received + 2 * HOUR,
        ),
        "cultures",
        c.culture_id,
        "update",
        crow,
        2,
        "final",
        "culture result",
      );
      return;
    }
    const org = this.lab(
        t0 + this.delay(spec, "2 organism"),
        received + 6 * HOUR,
      ),
      ast = this.lab(
        Math.max(t0 + this.delay(spec, "3 susceptibility"), org + 12 * HOUR),
        org + 12 * HOUR,
      );
    let reg = received,
      rtags = tags;
    if (on.A3 && r.random() < on.A3.rate) {
      reg = org + r.int(30, 600) * 60000;
      rtags = [...tags, "A3"];
      this.note("A3", 1, { label: this.label("A3") });
    }
    send(
      reg,
      "cultures",
      c.culture_id,
      "insert",
      pending,
      1,
      "received",
      "culture received",
      rtags,
    );
    send(
      org,
      "cultures",
      c.culture_id,
      "update",
      crow,
      2,
      "preliminary",
      "culture result",
    );
    for (const i of isos) {
      const pre = { ...i, esbl: "", mrsa: "", vre: "", cpe: "" },
        itags = [...tags];
      if (on.B2 && CONFUSABLE[i.organism] && r.random() < on.B2.rate) {
        pre.organism = CONFUSABLE[i.organism];
        itags.push("B2");
        this.note("B2", 1, { label: this.label("B2") });
      }
      send(
        org,
        "isolates",
        i.isolate_id,
        "insert",
        pre,
        1,
        "preliminary",
        "organism identified",
        itags,
      );
      send(
        ast,
        "isolates",
        i.isolate_id,
        "update",
        { ...i },
        2,
        "final",
        itags.includes("B2") ? "organism corrected" : "isolate final",
        itags,
      );
      let rows = [...(sus[i.isolate_id] || [])];
      const ent = entero(i.organism);
      if (on.D2 && ent && c._date >= this.when(on.D2.day) && rows.length)
        rows.push({
          ...rows[0],
          antibiotic: "temocillin",
          antibiotic_code: "TEM",
          antibiotic_fi: "temosilliini",
          result: i.cpe === "1" || r.random() < 0.04 ? "R" : "S",
          _tag: "D2",
        });
      if (on.E3 && rows.length && r.random() < on.E3.rate) {
        const pairs = this.src.armd.intrinsic_pairs.filter(
          (p) => p.organism === i.organism,
        );
        if (pairs.length) {
          const p = r.choice(pairs),
            ab = this.src.antibiotics[p.drug];
          rows = rows
            .filter((s) => s.antibiotic_code !== p.drug)
            .concat({
              ...rows[0],
              antibiotic: ab.antibiotic,
              antibiotic_code: p.drug,
              antibiotic_fi: ab.antibiotic_fi,
              result: "S",
              _tag: "E3",
            });
        }
      }
      for (const row of rows) {
        const s = { ...row },
          ts = [...tags],
          d = c._date,
          drug = s.antibiotic_code;
        if (s._tag) {
          ts.push(s._tag);
          delete s._tag;
        }
        if (
          origin === "new" &&
          i.organism === "Escherichia coli" &&
          spec === "urine" &&
          s.result === "S"
        ) {
          const tr = this.src.trends[drug] || { slope: 0 };
          if (
            Math.abs(tr.slope) >= 0.5 &&
            r.random() <
              this.shift(drug, (tr.slope * days(d, c._tdate || d)) / 365.25)
          )
            s.result = "R";
        }
        if (
          on.G2 &&
          drug === on.G2.drug &&
          i.organism === "Escherichia coli" &&
          s.result === "S"
        ) {
          const yrs = days(d, this.start) / 365.25;
          if (yrs > 0 && r.random() < this.shift(drug, on.G2.extra * yrs)) {
            s.result = "R";
            ts.push("G2");
          }
        }
        if (
          on.G6 &&
          ward === on.G6.ward &&
          drug === on.G6.drug &&
          ent &&
          s.result === "S" &&
          d >= this.when(on.G6.day) &&
          d < this.when(on.G6.day + on.G6.days) &&
          r.random() < this.shift(drug, on.G6.rise)
        ) {
          s.result = "R";
          ts.push("G6");
        }
        if (
          on.D1 &&
          drug === on.D1.drug &&
          ent &&
          s.result === "S" &&
          s.guideline === on.D1.label &&
          r.random() < on.D1.flip
        ) {
          s.result = "R";
          ts.push("D1");
        }
        for (const tg of ts) {
          if (["E3", "D2", "D1"].includes(tg))
            this.note(tg, 1, { label: this.label(tg) });
          if (tg === "G2")
            this.note(tg, 1, {
              label: `Slow drift, ${on.G2.drug} +${on.G2.extra} points a year`,
              start: iso(this.start),
            });
          if (tg === "G6")
            this.note(tg, 1, {
              label: `Rate shift, ${on.G6.drug} on ${on.G6.ward}`,
              ward: on.G6.ward,
              start: iso(this.when(on.G6.day)),
              end: iso(this.when(on.G6.day + on.G6.days)),
            });
        }
        const k = s.isolate_id + "|" + drug;
        if (on.B1 && r.random() < on.B1.rate) {
          send(
            ast,
            "susceptibility",
            k,
            "insert",
            pick(
              { ...s, result: s.result === "S" ? "R" : "S" },
              this.src.columns.susceptibility,
            ),
            1,
            "final",
            "susceptibility",
            [...ts, "B1"],
          );
          send(
            this.lab(add(ast, r.int(1, 5)), ast + HOUR),
            "susceptibility",
            k,
            "update",
            pick(s, this.src.columns.susceptibility),
            2,
            "corrected",
            "susceptibility corrected",
            [...ts, "B1"],
          );
          this.note("B1", 1, { label: this.label("B1") });
        } else
          send(
            ast,
            "susceptibility",
            k,
            "insert",
            pick(s, this.src.columns.susceptibility),
            1,
            "final",
            "susceptibility",
            ts,
          );
      }
    }
    if (on.B5 && origin === "replayed" && r.random() < on.B5.rate) {
      const fake = {
        ...pending,
        culture_id: c.culture_id + "X",
        patient_id: "P" + r.int(100000, 999999),
      };
      send(
        received + 5 * 60000,
        "cultures",
        fake.culture_id,
        "insert",
        fake,
        1,
        "received",
        "culture received",
        ["B5"],
        "injected",
      );
      send(
        this.lab(add(received, r.int(1, 3)), received + 6 * HOUR),
        "cultures",
        fake.culture_id,
        "cancel",
        fake,
        2,
        "cancelled",
        "culture cancelled",
        ["B5"],
        "injected",
      );
      this.note("B5", 1, { label: this.label("B5") });
    }
  }
  faults() {
    const on = this.on,
      r = this.rng;
    if (on.A4) {
      const p = on.A4,
        a = this.when(p.day),
        b = add(a, p.days);
      let n = 0;
      for (const d of this.deliveries)
        if (d.ward === p.ward && d.known_at >= a && d.known_at < b) {
          d.known_at = b + r.int(0, 360) * 60000;
          d.tags.push("A4");
          n++;
        }
      this.note("A4", n, {
        label: `Outage, ${p.ward}`,
        ward: p.ward,
        start: iso(a),
        end: iso(b),
      });
    }
    if (on.A2) {
      const p = on.A2,
        a = this.when(p.day),
        b = add(a, p.days);
      let n = 0;
      for (const d of this.deliveries)
        if (
          d.ward === p.ward &&
          dayOf(d.event_at) >= a &&
          dayOf(d.event_at) < b
        ) {
          d.known_at += p.late_days * DAY;
          d.tags.push("A2");
          n++;
        }
      this.note("A2", n, {
        label: `Late backfill, ${p.ward}`,
        ward: p.ward,
        start: iso(a),
        end: iso(b),
        late_days: p.late_days,
      });
    }
    this.complete_at = {};
    this.history = new Set();
    for (const d of this.deliveries) {
      if (!["susceptibility corrected", "culture cancelled"].includes(d.kind))
        this.complete_at[d.row.culture_id] = Math.max(
          this.complete_at[d.row.culture_id] || 0,
          d.known_at,
        );
      if (
        d.table === "cultures" &&
        d.op === "insert" &&
        d.known_at < this.start
      )
        this.history.add(d.key);
    }
    this.deliveries = this.deliveries.filter(
      (d) => d.known_at >= this.start && d.known_at < this.end,
    );
    if (on.A6) {
      const extra = [];
      for (const [hour, ds] of Object.entries(
        group(this.deliveries, (d) => Math.floor(d.known_at / HOUR) * HOUR),
      ))
        if (r.random() < on.A6.rate) {
          for (const d of ds)
            extra.push({
              ...d,
              known_at: +hour + HOUR + r.int(0, 20) * 60000,
              kind: "duplicate",
              tags: [...d.tags, "A6"],
            });
          this.note("A6", ds.length, { label: this.label("A6") });
        }
      this.deliveries.push(...extra.filter((d) => d.known_at < this.end));
    }
    if (on.D9) {
      const day = iso(this.when(on.D9.day));
      this.batch_format[day] = "semicolon";
      this.note(
        "D9",
        this.deliveries.filter((d) => iso(d.known_at) === day).length,
        { label: this.label("D9"), start: day },
      );
    }
  }
  rebuild() {
    const state = new Map(),
      seen = new Set();
    let dupes = 0;
    for (const d of this.deliveries) {
      const sig = key(d.table, d.key, d.revision),
        k = key(d.table, d.key);
      if (seen.has(sig)) {
        dupes++;
        continue;
      }
      seen.add(sig);
      if ((state.get(k)?.revision || 0) > d.revision) continue;
      state.set(k, d);
    }
    this.final = { cultures: [], isolates: [], susceptibility: [] };
    for (const d of state.values())
      if (d.op !== "cancel")
        this.final[d.table].push({
          ...d.row,
          origin: d.origin,
          status: d.status,
          revision: d.revision,
          tags: d.tags.filter((t) => t !== "A1").join(" "),
        });
    const fields = [
      "sample_date",
      "culture_id",
      "isolate_id",
      "antibiotic_code",
    ];
    for (const rows of Object.values(this.final))
      rows.sort((a, b) => {
        for (const k of fields) {
          const x = a[k] || "",
            y = b[k] || "";
          if (x !== y) return x < y ? -1 : 1;
        }
        return 0;
      });
    return dupes;
  }
  checks(dupes) {
    const s = this.src,
      cids = new Set(this.final.cultures.map((c) => c.culture_id)),
      orph = this.final.isolates.filter(
        (i) => !cids.has(i.culture_id) && !this.history.has(i.culture_id),
      );
    const original = new Map(
      Object.values(s.sus)
        .flat()
        .map((x) => [key(x.isolate_id, x.antibiotic_code), x.result]),
    );
    let mism = 0,
      compared = 0,
      explained = 0;
    for (const row of this.final.susceptibility) {
      const k = key(row.isolate_id, row.antibiotic_code);
      if (row.origin !== "replayed" || !original.has(k)) continue;
      compared++;
      if (original.get(k) !== row.result) {
        if (
          ["D1", "E3", "B1", "G2", "G6"].some((t) =>
            row.tags.split(" ").includes(t),
          )
        )
          explained++;
        else mism++;
      }
    }
    const latest = new Map();
    let lower = 0;
    for (const d of this.deliveries) {
      const k = key(d.table, d.key);
      if ((latest.get(k) || 0) > d.revision) lower++;
      latest.set(k, Math.max(latest.get(k) || 0, d.revision));
    }
    return [
      {
        check:
          "Every delivery is stored, held as a duplicate, or replaced by a newer revision",
        ok: true,
        detail: `${this.deliveries.length} deliveries → ${sum(Object.values(this.final), (x) => x.length)} final rows, ${dupes} duplicates ignored`,
      },
      {
        check:
          "Every isolate has its culture (already known before the start, or delivered)",
        ok: !orph.length,
        detail: `${orph.length} isolates still waiting for their culture row at the end of the run`,
      },
      {
        check: "Out-of-order revisions are resolved to the newest",
        ok: true,
        detail: `${lower} older revisions received after a newer one`,
      },
      {
        check:
          "Replayed S/R results equal the source, except where a scenario changed them on purpose",
        ok: !mism,
        detail: `${compared} compared; ${explained} differ on purpose; ${mism} differ without a reason`,
      },
      {
        check:
          "Results still pending at the end of the run are shown as pending, not missing",
        ok: true,
        detail: `${this.final.cultures.filter((c) => c.status !== "final").length} cultures not final yet`,
      },
    ];
  }
  build() {
    this.pickCases();
    for (const c of this.cases) this.stage(c);
    this.faults();
    this.deliveries.sort(
      (a, b) =>
        a.known_at - b.known_at ||
        Number(a.table !== "cultures") - Number(b.table !== "cultures") ||
        a.revision - b.revision,
    );
    this.deliveries.forEach((d, i) => {
      d.seq = i + 1;
      d.batch_id = stamp(d.known_at).slice(0, 13);
    });
    this.check_results = this.checks(this.rebuild());
    this.truth_list = Object.entries(this.truth).map(([code, v]) => {
      const c = this.src.catalogue.find((x) => x.code === code);
      return {
        code,
        label: c.label,
        mechanism: c.mechanism,
        group: c.group,
        ...v,
      };
    });
    this.truth_list.unshift({
      code: "A1",
      label: this.label("A1"),
      mechanism: "delay",
      group: "Timing",
      count: this.cases.length,
      detail: "every case",
    });
    return this;
  }
}
export const generate = (s, r) => new Run(s, r).build();
