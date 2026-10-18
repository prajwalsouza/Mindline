import { iso, date, add, days } from "./core.mjs";
const FLAGS = {
  esbl: "ESBL: extended-spectrum beta-lactamase detected",
  mrsa: "MRSA: meticillin-resistant Staphylococcus aureus",
  vre: "VRE: vancomycin-resistant enterococci",
  cpe: "CPE: carbapenemase-producing Enterobacterales",
};
const STATUS = {
  waiting: "Waiting for the lab",
  organism_known: "Bacteria identified; antibiotic results pending",
  final: "Lab results available",
  negative: "No bacteria grew",
  mixed: "Mixed bacterial growth",
};
function stage(c, asof) {
  if (c._feed) {
    if (c._status === "received") return "waiting";
    if (c.result === "negative") return "negative";
    if (c.result === "mixed_growth") return "mixed";
    return c._status === "final" ? "final" : "organism_known";
  }
  const age = days(asof, c._date);
  if (["negative", "mixed_growth"].includes(c.result))
    return age >= 2
      ? c.result === "negative"
        ? "negative"
        : "mixed"
      : "waiting";
  return age < 1 ? "waiting" : age < 3 ? "organism_known" : "final";
}
export function sampleOverview(src, q = {}) {
  const asof = Math.min(q.asof ? date(q.asof) : src.end, src.end),
    span = Number(q.days || 365);
  if (!Number.isInteger(span) || span < 1 || span > 365)
    throw Error("Overview window must be between 1 and 365 days");
  const start = Math.max(src.start, add(asof, 1 - span)),
    wards = Object.entries(src.wards).map(([code, w]) => ({
      code,
      name: w.ward_en,
    })),
    names = Object.fromEntries(wards.map((w) => [w.code, w.name])),
    records = [],
    patients = new Set(),
    counts = {},
    wc = {};
  for (const c of src.cultures) {
    if (c._date < start || c._date > asof) continue;
    const status = stage(c, asof),
      organisms = [],
      drugs = [],
      flags = [];
    if (["organism_known", "final"].includes(status))
      for (const i of src.isolates[c.culture_id] || []) {
        if (!organisms.includes(i.organism)) organisms.push(i.organism);
        if (status !== "final") continue;
        for (const [flag, label] of Object.entries(FLAGS))
          if (i[flag] === "1" && !flags.includes(label)) flags.push(label);
        for (const s of src.sus[i.isolate_id] || [])
          if (["S", "I", "R"].includes(s.result))
            drugs.push({
              code: s.antibiotic_code,
              name:
                src.antibiotics[s.antibiotic_code]?.antibiotic ||
                s.antibiotic ||
                s.antibiotic_code,
              result: s.result,
              organism: i.organism,
            });
      }
    const resistant = drugs.length ? drugs.some((d) => d.result === "R") : null;
    records.push({
      id: c.culture_id,
      label: "Sample " + c.culture_id,
      date: iso(c._date),
      ward: c.ward_code,
      ward_name: names[c.ward_code] || c.ward_en || c.ward_code,
      specimen: c.specimen,
      age:
        c.age_years != null && c.age_years !== "" ? Number(c.age_years) : null,
      sex: src.patients[c.patient_id]?.sex || "",
      organism: organisms.join("; "),
      organisms,
      status,
      status_label: STATUS[status],
      resistant,
      drugs,
      flags,
    });
    patients.add(c.patient_id);
    counts[status] = (counts[status] || 0) + 1;
    counts.resistant = (counts.resistant || 0) + Number(resistant === true);
    counts.tested = (counts.tested || 0) + Number(drugs.length > 0);
    wc[c.ward_code] = (wc[c.ward_code] || 0) + 1;
  }
  for (const w of wards) w.samples = wc[w.code] || 0;
  return {
    asof: iso(asof),
    start: iso(start),
    end: iso(asof),
    days: span,
    source: "Tyks synthetic demo data and simulated lab feed",
    synthetic: true,
    counting:
      "Every sample is shown, including repeat samples from the same patient. Each dot is one sample.",
    visibility:
      "Only results available by the selected day are shown. Recent historical samples use simulated lab delays.",
    resistance_definition:
      "At least one reported antibiotic test found resistance. Untested or pending samples are not counted as having no resistance.",
    records,
    wards,
    total_records: records.length,
    truncated: false,
    summary: {
      samples: records.length,
      patients: patients.size,
      resistant: counts.resistant || 0,
      tested: counts.tested || 0,
      pending: (counts.waiting || 0) + (counts.organism_known || 0),
      negative: counts.negative || 0,
      mixed: counts.mixed || 0,
      final: counts.final || 0,
    },
  };
}
