import fs from "node:fs";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import { Engine } from "../runtime/engine.mjs";
import { generate } from "../runtime/generate.mjs";
import { calendar, Feed } from "../runtime/evidence.mjs";
import { Views } from "../runtime/views.mjs";
import { date, iso, add, DAY } from "../runtime/core.mjs";
const payload = JSON.parse(
  zlib.gunzipSync(
    fs.readFileSync(new URL("../dist/data/source.json.gz", import.meta.url)),
  ),
);
const e = new Engine(payload),
  s = e.src;
const r = {
  ...structuredClone(s.presets.clean.recipe),
  start: "2026-08-01",
  end: "2026-09-27",
  seed: 42,
};
const a = generate(s, r),
  b = generate(s, r);
assert.deepEqual(
  a.deliveries,
  b.deliveries,
  "same seed must reproduce all rows",
);
assert.ok(
  a.check_results.every((c) => c.ok),
  "clean replay checks",
);
assert.ok(a.final.susceptibility.length > 1000);
const all = Object.fromEntries(
  s.catalogue.map((c) => [c.code, { ...c.params }]),
);
for (const p of Object.values(all)) if ("day" in p) p.day = 4;
for (const code of ["A3", "A6", "B1", "B2", "B5", "C9", "E3"])
  all[code].rate = 0.3;
const stress = generate(s, {
  start: "2026-09-20",
  end: "2026-11-05",
  seed: 13,
  scenarios: all,
});
for (const code of [
  "A1",
  "A2",
  "A3",
  "A4",
  "A6",
  "B1",
  "B2",
  "B5",
  "C9",
  "D1",
  "D2",
  "D7",
  "D9",
  "E3",
  "F1",
  "G1",
  "G2",
  "G3",
  "G6",
  "G7",
  "N",
])
  assert.ok(
    stress.truth_list.some((t) => t.code === code && t.count > 0),
    "scenario exercised: " + code,
  );
for (let i = 1; i < stress.deliveries.length; i++)
  assert.ok(stress.deliveries[i].known_at >= stress.deliveries[i - 1].known_at);
assert.ok(
  stress.deliveries.every(
    (d) => d.known_at >= stress.start && d.known_at < stress.end,
  ),
);
assert.ok(
  stress.check_results.find((c) => c.check.startsWith("Replayed S/R")).ok,
);
const v = new Views(stress),
  table = v.page("deliveries", { ward: "ICU", limit: 17 });
assert.equal(table.rows.length, 17);
assert.ok(table.rows.every((r) => r[table.columns.indexOf("ward")] === "ICU"));
fs.writeFileSync(new URL("feed-test.zip", import.meta.url), v.zip());
const feed = new Feed(s, stress);
feed.set(date("2026-10-18"));
const view = feed.view();
assert.ok(view.cultures.every((c) => c._date <= view.end));
const cal = calendar(feed);
assert.ok(cal.ready);
assert.equal(cal.days.length, 47);
assert.ok(cal.days.some((d) => d.level === "notable"));
const run = e.request("/api/runs", "POST", {
  ...r,
  end: "2026-10-05",
  scenarios: { A1: {}, N: {} },
});
e.request("/api/app/clock", "POST", { action: "use", run: run.id });
e.request("/api/app/clock", "POST", { action: "set", day: "2026-10-02" });
const pt = e.request("/api/app/patients?ward=URO")[0];
assert.ok(pt);
e.request("/api/app/narrate/commit", "POST", {
  patient: pt.id,
  ward: "URO",
  text: "Ask about their routine, because the daughter noticed a change.",
  share: false,
  author: "Static test",
});
const record = e.request("/api/app/record?id=" + pt.id);
assert.equal(record[0].fields.reasoning, "the daughter noticed a change.");
assert.equal(e.request("/api/app/knowledge?ward=URO").length, 0);
const suggestions = e.request("/api/app/ask/suggest").q;
assert.ok(suggestions.length >= 6);
const answer = e.request("/api/app/ask", "POST", { q: suggestions[0] });
assert.equal(answer.status, "done");
assert.ok(answer.blocks.length);
assert.equal(
  e.request("/api/app/ask", "POST", {
    q: "a question not present in the cache",
  }).status,
  "nocache",
);
const restored = new Engine(payload, e.snapshot());
assert.equal(restored.feed.status().today, "2026-10-02");
assert.deepEqual(restored.request("/api/app/record?id=" + pt.id), record);
assert.deepEqual(
  restored.getRun(run.id).summary().final,
  e.getRun(run.id).summary().final,
);
console.log(
  "PASS: deterministic generation, all 21 scenarios, replay integrity, feed state, calendar, table filters, ZIP generation, saved answers, isolated notes, and restored state.",
);
