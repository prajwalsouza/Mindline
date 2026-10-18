import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { initKnowledge, Knowledge } from "../runtime/knowledge.mjs";
import { Notes, parse, deidentify } from "../runtime/notes.mjs";
import { source } from "../runtime/core.mjs";
import assert from "node:assert/strict";
await initKnowledge(
  readFileSync(
    new URL("../runtime/vendor/oxigraph/web_bg.wasm", import.meta.url),
  ),
);
const payload = JSON.parse(
  gunzipSync(
    readFileSync(new URL("../dist/data/source.json.gz", import.meta.url)),
  ),
);
const src = source(payload),
  v = src.vocabulary,
  notes = new Notes(v),
  kg = new Knowledge(src, notes);
const base = kg.dashboard();
assert.equal(base.summary.illustrative, 109);
assert.equal(base.summary.committed, 0);
assert.equal(base.statement_tree.length, 4);
assert.ok(base.meta.rdf.triples > 4000);
for (const { id } of kg.questions().questions) {
  const r = kg.query(id);
  assert.ok(r.rows.length > 0, id);
  assert.match(r.sparql, /SELECT/);
  assert.equal(r.meta.engine, "Oxigraph 0.5.11 (WebAssembly)");
}
assert.throws(() => kg.query("SELECT * WHERE {?s ?p ?o}"));
assert.throws(() => kg.query("over_time", { month_from: "2026-99" }));
assert.throws(() => kg.query("over_time", { source: "unknown" }));
assert.deepEqual(kg.query("over_time", { source: "committed" }).rows, []);
const pt = {
    id: "private-id",
    birth_year: 1950,
    sex: "F",
    history: [{ spec: "urine", date: "2026-09-27" }],
  },
  ctx = { ward: "URO", asof: "2026-09-27", lang: "en" };
const extract = (text) => {
  const facts = parse(text, v);
  return { facts, ...deidentify(facts, pt, ctx, v) };
};
let x = extract(
  "I'll start nitrofurantoin because earlier Escherichia coli survived ampicillin.",
);
assert.equal(x.shared[0].drug, "NIT");
x = extract(
  "Do not check whether the patient understood the follow-up plan, because they nodded but later asked when to return.",
);
assert.equal(x.shared.length, 0);
x = extract(
  "For the next clinician, if fever persists, I will start ceftriaxone.",
);
assert.equal(x.shared[0].kind, "if-then");
assert.equal(x.shared[0].trigger, "symptom:fever");
x = extract(
  "If confusion returns, ask the daughter about the usual routine because she knows the baseline.",
);
assert.equal(x.shared[0].statement_mode, "if_then");
notes.commit(pt, x.facts, x.shared, ctx, "PRIVATE AUTHOR");
x = extract(
  "I think asking the daughter about confusion might help because she knows the usual routine.",
);
assert.equal(x.shared[0].statement_mode, "thinks");
notes.commit(pt, x.facts, x.shared, ctx);
x = extract("Ask the daughter about confusion.");
assert.equal(x.shared[0].practice_reason, false);
x = extract("If fever and confusion persist, I will start ceftriaxone.");
assert.equal(x.shared[0].trigger, null);
x = extract(
  "Ask the daughter about a change in confusion, because she knows the usual routine and noticed the change.",
);
notes.commit(pt, x.facts, x.shared, ctx);
for (const e of src.knowledge.entries) {
  const facts = parse(e.source_text, v, e.language),
    result = deidentify(facts, pt, { ...ctx, lang: e.language }, v);
  assert.ok(
    result.shared.length,
    "Missing shared extraction: " + e.source_text,
  );
}
const after = kg.dashboard();
assert.equal(after.summary.committed, 3);
const kept = after.entries.filter((e) => e.source === "committed");
assert.ok(kept.some((e) => e.conditional && !e.decided));
assert.ok(kept.some((e) => e.statement_type === "thinks" && !e.decided));
assert.ok(!JSON.stringify(kept).includes("private-id"));
assert.ok(!JSON.stringify(kept).includes("PRIVATE AUTHOR"));
assert.ok(kept.every((e) => !("source_text" in e)));
const restored = new Knowledge(src, new Notes(v, structuredClone(notes.state)));
assert.equal(restored.dashboard().summary.committed, 3);
const result = restored.query("over_time", { source: "committed" });
assert.equal(result.rows[0].committed, 3);
assert.equal(
  restored.query("conditional_statements", { source: "committed" }).rows.length,
  1,
);
console.log(
  "Knowledge static tests passed: 109 multilingual examples, four live SPARQL queries, persistence, privacy, integrity and filter validation.",
);
