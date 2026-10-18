import {
  DAY,
  HOUR,
  iso,
  stamp,
  range,
  count,
  group,
  sum,
  FLAGS,
  short,
  csv,
} from "./core.mjs";
const sizes = { hour: HOUR, day: DAY, week: 7 * DAY },
  notable = (d) =>
    !["replayed", "new"].includes(d.origin) ||
    d.tags.some((t) => !["A1", "N"].includes(t));
function describe(d) {
  const r = d.row,
    w = d.ward;
  switch (d.kind) {
    case "culture received":
      return `${w} · ${r.specimen} culture ${d.key} received`;
    case "culture result":
      return `${w} · ${d.key} ${r.result.replaceAll("_", " ")}`;
    case "organism identified":
      return `${w} · ${r.organism} (preliminary)`;
    case "organism corrected":
      return `${w} · organism corrected to ${r.organism}`;
    case "isolate final":
      return (
        `${w} · ${r.organism} final` +
        FLAGS.filter((f) => r[f] === "1")
          .map((f) => " · " + f.toUpperCase())
          .join("")
      );
    case "susceptibility":
      return `${w} · ${short(r.organism)} ${r.antibiotic_code} ${r.result}`;
    case "susceptibility corrected":
      return `${w} · ${r.antibiotic_code} corrected to ${r.result}`;
    case "culture cancelled":
      return `${w} · culture ${d.key} cancelled`;
    case "duplicate":
      return `${w} · duplicate of seq ${d.seq}`;
    default:
      return d.kind;
  }
}
const bisect = (xs, t) => {
  let lo = 0,
    hi = xs.length;
  while (lo < hi) {
    const m = (lo + hi) >>> 1;
    if (xs[m] <= t) lo = m + 1;
    else hi = m;
  }
  return lo;
};
export class Views {
  constructor(run) {
    this.run = run;
    this.cache = {};
    const span = {};
    for (const d of run.deliveries) {
      if (
        ["duplicate", "susceptibility corrected", "culture cancelled"].includes(
          d.kind,
        )
      )
        continue;
      const k = d.row.culture_id,
        s = (span[k] ||= [d.known_at, d.known_at]);
      s[0] = Math.min(s[0], d.known_at);
      s[1] = Math.max(s[1], d.known_at);
    }
    this.opened = Object.values(span)
      .map((s) => s[0])
      .sort((a, b) => a - b);
    this.closed = Object.entries(span)
      .map(([cid, s]) => Math.max(s[1], run.complete_at[cid] || s[1]))
      .sort((a, b) => a - b);
  }
  bins(size = "day") {
    if (this.cache[size]) return this.cache[size];
    const step = sizes[size];
    if (!step) throw Error("Unknown bin size");
    const r = this.run,
      n = Math.floor((r.end - r.start) / step) + 1,
      out = range(n).map((i) => ({
        i,
        t: stamp(r.start + i * step),
        kinds: {},
        origin: {},
        tags: {},
        wards: {},
        points: [],
        ticker: [],
        rows: 0,
      })),
      cap = { hour: 12, day: 40, week: 120 }[size];
    for (const d of r.deliveries) {
      const b = out[Math.floor((d.known_at - r.start) / step)];
      b.rows++;
      for (const [k, v] of [
        ["kinds", d.kind],
        ["origin", d.origin],
        ["wards", d.ward],
      ])
        b[k][v] = (b[k][v] || 0) + 1;
      for (const t of d.tags) if (t !== "A1") b.tags[t] = (b.tags[t] || 0) + 1;
      const note = notable(d),
        tag = d.tags.find((t) => !["A1", "N"].includes(t)) || "";
      if (
        [
          "susceptibility",
          "culture result",
          "susceptibility corrected",
          "organism corrected",
          "culture cancelled",
        ].includes(d.kind) &&
        (note || b.points.length < cap) &&
        b.points.length < cap * 2
      )
        b.points.push([
          stamp(d.event_at),
          stamp(d.known_at),
          d.kind,
          d.origin,
          tag,
          d.ward,
        ]);
      if (note && b.ticker.length < 6)
        b.ticker.push([stamp(d.known_at), describe(d), tag || d.origin]);
    }
    for (const b of out) {
      const t = r.start + (b.i + 1) * step;
      b.backlog = bisect(this.opened, t) - bisect(this.closed, t);
    }
    this.cache[size] = out;
    return out;
  }
  live(size = "day") {
    const bins = structuredClone(this.bins(size)),
      extra = {};
    for (const d of this.run.deliveries) {
      const i = Math.floor((d.known_at - this.run.start) / sizes[size]);
      extra[i] ||= [];
      if (extra[i].length < 3 && !notable(d))
        extra[i].push([stamp(d.known_at), describe(d), d.origin]);
    }
    for (const b of bins)
      b.ticker.push(
        ...(extra[b.i] || []).slice(0, Math.max(0, 6 - b.ticker.length)),
      );
    return bins;
  }
  delays() {
    const spec = Object.fromEntries(
        this.run.cases.map((c) => [c[0].culture_id, c[0].specimen]),
      ),
      hist = {};
    for (const d of this.run.deliveries)
      if (
        d.kind === "susceptibility" &&
        d.revision === 1 &&
        !d.tags.some((t) => ["A2", "A4"].includes(t))
      ) {
        const s = spec[d.row.culture_id] || "other";
        hist[s] ||= range(21).map(() => 0);
        hist[s][
          Math.min(20, Math.floor((d.known_at - d.event_at) / HOUR / 12))
        ]++;
      }
    return {
      bin_hours: 12,
      hist,
      mimic_median_h: Object.fromEntries(
        ["urine", "blood", "wound"]
          .filter((s) => s in this.run.src.medians)
          .map((s) => [s, this.run.src.medians[s]]),
      ),
    };
  }
  table(name, f = {}) {
    const r = this.run;
    let cols, rows;
    if (name === "deliveries") {
      cols = [
        "seq",
        "batch_id",
        "received_at",
        "kind",
        "table",
        "key",
        "op",
        "revision",
        "status",
        "origin",
        "tags",
        "ward",
        "sample_date",
        "organism",
        "antibiotic_code",
        "result",
      ];
      rows = r.deliveries.map((d) => ({
        ...d,
        received_at: stamp(d.known_at),
        tags: d.tags.filter((t) => t !== "A1").join(" "),
        sample_date: iso(d.event_at),
        organism: d.row.organism || "",
        antibiotic_code: d.row.antibiotic_code || "",
        result: d.row.result || "",
      }));
    } else if (["cultures", "isolates", "susceptibility"].includes(name)) {
      cols = [...r.src.columns[name], "origin", "status", "revision", "tags"];
      const wards = Object.fromEntries(
        r.cases.map((c) => [c[0].culture_id, c[0].ward_code]),
      );
      rows = r.final[name].map((x) => ({
        ...x,
        ward: x.ward_code || wards[x.culture_id] || "",
      }));
    } else if (name === "truth") {
      cols = [
        "code",
        "label",
        "group",
        "mechanism",
        "count",
        "ward",
        "start",
        "end",
      ];
      rows = r.truth_list;
    } else if (name === "checks") {
      cols = ["check", "ok", "detail"];
      rows = r.check_results;
    } else if (name === "batches") {
      cols = [
        "batch_id",
        "rows",
        "cultures",
        "isolates",
        "susceptibility",
        "duplicates",
        "tags",
      ];
      rows = Object.entries(group(r.deliveries, (d) => d.batch_id)).map(
        ([batch_id, ds]) => ({
          batch_id,
          rows: ds.length,
          cultures: ds.filter((d) => d.table === "cultures").length,
          isolates: ds.filter((d) => d.table === "isolates").length,
          susceptibility: ds.filter((d) => d.table === "susceptibility").length,
          duplicates: ds.filter((d) => d.kind === "duplicate").length,
          tags: Object.entries(
            count(ds.flatMap((d) => d.tags.filter((t) => t !== "A1"))),
          )
            .map(([t, n]) => `${t}×${n}`)
            .join(" "),
        }),
      );
    } else throw Error("Unknown table");
    rows = rows.filter(
      (x) =>
        (!f.origin || x.origin === f.origin) &&
        (!f.tag ||
          String(x.tags || "")
            .split(" ")
            .includes(f.tag) ||
          x.code === f.tag) &&
        (!f.kind || x.kind === f.kind) &&
        (!f.ward || (x.ward || x.ward_code) === f.ward) &&
        (!f.q ||
          Object.values(x).join(" ").toLowerCase().includes(f.q.toLowerCase())),
    );
    return { cols, rows };
  }
  page(name, f) {
    const { cols, rows } = this.table(name, f),
      offset = Number(f.offset || 0),
      limit = Number(f.limit || 50);
    return {
      columns: cols,
      rows: rows
        .slice(offset, offset + limit)
        .map((r) => cols.map((c) => r[c] ?? "")),
      total: rows.length,
    };
  }
  csv(name, f) {
    const { cols, rows } = this.table(name, f);
    return (
      '"# SIMULATED feed data, not real lab results. Recipe: ' +
      JSON.stringify(this.run.recipe).replaceAll('"', '""') +
      '"\n' +
      csv(cols, rows)
    );
  }
  summary() {
    const r = this.run,
      cases = count(r.cases, (c) => c[3]);
    return {
      recipe: r.recipe,
      start: stamp(r.start),
      end: stamp(r.end),
      deliveries: r.deliveries.length,
      cases,
      final: Object.fromEntries(
        Object.entries(r.final).map(([k, v]) => [k, v.length]),
      ),
      kinds: count(r.deliveries, (d) => d.kind),
      truth: r.truth_list,
      checks: r.check_results,
      wards: Object.keys(r.src.wards).sort(),
      contrib: [
        {
          source: "tyks",
          label: "Replayed cases",
          n: cases.replayed || 0,
          unit: "cases",
        },
        {
          source: "tyks",
          label: "New cases",
          n: cases.new || 0,
          unit: "cases",
        },
        {
          source: "tyks",
          label: "Events added",
          n: cases.injected || 0,
          unit: "cases",
        },
        {
          source: "mimic",
          label: "Arrival times",
          n: r.deliveries.filter((d) => d.kind !== "duplicate").length,
          unit: "deliveries",
        },
        {
          source: "armd",
          label: "Returning patients",
          n: r.stats.returning_armd || 0,
          unit: "cases",
        },
        {
          source: "armd",
          label: "Odd results added",
          n: r.truth.E3?.count || 0,
          unit: "results",
        },
      ],
    };
  }
  zip() {
    const r = this.run,
      files = {
        "README.txt":
          "SIMULATED incoming lab feed generated from the Tyks synthetic dataset.\nEach day contains the delivered rows; truth.json is for evaluation only.\n",
        "recipe.json": JSON.stringify(r.recipe, null, 2),
        "truth.json": JSON.stringify(r.truth_list, null, 2),
        "checks.json": JSON.stringify(r.check_results, null, 2),
      };
    for (const [day, ds] of Object.entries(
      group(r.deliveries, (d) => iso(d.known_at)),
    )) {
      const sep = r.batch_format[day] === "semicolon" ? ";" : ",",
        manifest = {
          day,
          format: sep === ";" ? "semicolon" : "comma",
          files: {},
        };
      for (const [t, rows] of Object.entries(group(ds, (d) => d.table))) {
        const cols = [
          "batch_id",
          "received_at",
          "op",
          "revision",
          "status",
          ...r.src.columns[t],
        ];
        files[`feed/${day}/${t}.csv`] = csv(
          cols,
          rows.map((d) => ({
            ...d.row,
            batch_id: d.batch_id,
            received_at: stamp(d.known_at),
            op: d.op,
            revision: d.revision,
            status: d.status,
          })),
          sep,
        );
        manifest.files[t + ".csv"] = rows.length;
      }
      files[`feed/${day}/manifest.json`] = JSON.stringify(manifest, null, 2);
    }
    return zipStore(files);
  }
}
// ZIP (stored entries) avoids a runtime dependency and is readable by standard unzip tools.
export function zipStore(files) {
  const enc = new TextEncoder(),
    parts = [],
    central = [];
  let offset = 0;
  const table = range(256).map((n) => {
    for (let j = 0; j < 8; j++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
    return n >>> 0;
  });
  const crc = (bytes) => {
    let c = 0xffffffff;
    for (const b of bytes) c = table[(c ^ b) & 255] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  function header(size) {
    const a = new Uint8Array(size);
    return [a, new DataView(a.buffer)];
  }
  for (const [filename, text] of Object.entries(files)) {
    const name = enc.encode(filename),
      bytes = enc.encode(text),
      c = crc(bytes),
      [h, v] = header(30);
    v.setUint32(0, 0x04034b50, true);
    v.setUint16(4, 20, true);
    v.setUint16(6, 0x800, true);
    v.setUint32(14, c, true);
    v.setUint32(18, bytes.length, true);
    v.setUint32(22, bytes.length, true);
    v.setUint16(26, name.length, true);
    parts.push(h, name, bytes);
    const [ch, cv] = header(46);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint16(8, 0x800, true);
    cv.setUint32(16, c, true);
    cv.setUint32(20, bytes.length, true);
    cv.setUint32(24, bytes.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    central.push(ch, name);
    offset += 30 + name.length + bytes.length;
  }
  const centralSize = sum(central, (p) => p.length),
    [end, ev] = header(22);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, central.length / 2, true);
  ev.setUint16(10, central.length / 2, true);
  ev.setUint32(12, centralSize, true);
  ev.setUint32(16, offset, true);
  const out = new Uint8Array(offset + centralSize + 22);
  let p = 0;
  for (const a of [...parts, ...central, end]) {
    out.set(a, p);
    p += a.length;
  }
  return out;
}
