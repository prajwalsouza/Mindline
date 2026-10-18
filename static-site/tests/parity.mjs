import fs from "node:fs";
import zlib from "node:zlib";
import assert from "node:assert/strict";
import { Engine } from "../runtime/engine.mjs";
import { Views } from "../runtime/views.mjs";
import { parse } from "../runtime/notes.mjs";
import { date } from "../runtime/core.mjs";
const payload = JSON.parse(
  zlib.gunzipSync(
    fs.readFileSync(new URL("../dist/data/source.json.gz", import.meta.url)),
  ),
);
const refs = JSON.parse(
  fs.readFileSync(new URL("./reference.json", import.meta.url)),
);
console.time("engine");
const engine = new Engine(payload);
console.timeEnd("engine");
const run = {
  ...refs.run,
  src: engine.src,
  history: new Set(refs.run.history),
};
engine.feed.use(run);
engine.runs.set("reference", new Views(run));
let assertions = 0,
  failures = [];
function compare(a, b, path = "") {
  // Monte Carlo sampling uses a different documented seeded PRNG. Validate its
  // bounds separately; all deterministic inputs/counts must still match.
  if (path.includes("/sample/") || /\/clusters\/\d+\/(p|sure)$/.test(path))
    return;
  assertions++;
  if (typeof b === "number" && typeof a === "number") {
    if (Math.abs(a - b) > Math.max(2e-6, Math.abs(b) * 1e-7))
      throw Error(`${path}: ${a} != ${b}`);
    return;
  }
  if (b === null || typeof b !== "object") {
    assert.equal(a, b, path);
    return;
  }
  if (Array.isArray(b)) {
    assert.ok(Array.isArray(a), path);
    assert.equal(a.length, b.length, path + " length");
    b.forEach((v, i) => compare(a[i], v, path + "/" + i));
    return;
  }
  assert.ok(a && typeof a === "object", path);
  assert.deepEqual(
    Object.keys(a).sort(),
    Object.keys(b).sort(),
    path + " keys",
  );
  for (const k of Object.keys(b)) compare(a[k], b[k], path + "/" + k);
}
for (const f of refs.fixtures) {
  engine.feed.set(date(f.day));
  try {
    compare(engine.request(f.path), f.expected, f.path);
  } catch (e) {
    failures.push(e.message);
    console.error(e.message.slice(0, 900));
  }
}
for (const f of refs.notes) {
  try {
    compare(parse(f.text, payload.vocabulary), f.expected, "note:" + f.text);
  } catch (e) {
    failures.push(e.message);
    console.error(e.message);
  }
}
console.log(
  `${refs.fixtures.length} API fixtures, ${refs.notes.length} notes, ${assertions} comparisons, ${failures.length} failures`,
);
if (failures.length) process.exitCode = 1;
