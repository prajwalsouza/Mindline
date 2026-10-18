import { initKnowledge } from "./knowledge.mjs";
import { Engine } from "./engine.mjs";
const dbName = "mindline-static:" + new URL("../", import.meta.url).pathname;
let db = null,
  engine = null,
  queue = Promise.resolve();
async function database() {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(dbName, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}
async function read() {
  return new Promise((resolve, reject) => {
    const r = db.transaction("state").objectStore("state").get("app");
    r.onsuccess = () => resolve(r.result || {});
    r.onerror = () => reject(r.error);
  });
}
async function save() {
  if (!db) return;
  return new Promise((resolve, reject) => {
    const t = db.transaction("state", "readwrite");
    t.objectStore("state").put(engine.snapshot(), "app");
    t.oncomplete = resolve;
    t.onerror = () => reject(t.error);
  });
}
async function init() {
  let state = {};
  try {
    db = await database();
    state = await read();
  } catch (e) {
    postMessage({
      warning:
        "Browser storage is unavailable. Changes will last only in this tab.",
    });
  }
  const response = await fetch(
    new URL("../data/source.json.gz", import.meta.url),
  );
  if (!response.ok)
    throw Error("Could not load bundled data (" + response.status + ").");
  if (typeof DecompressionStream === "undefined")
    throw Error(
      "This site needs a current browser with gzip decompression support.",
    );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const stream = new Blob([bytes]).stream();
  const payload = await new Response(
    bytes[0] === 0x1f && bytes[1] === 0x8b
      ? stream.pipeThrough(new DecompressionStream("gzip"))
      : stream,
  ).json();
  await initKnowledge();
  engine = new Engine(payload, state);
}
self.onmessage = ({ data: m }) => {
  queue = queue.then(async () => {
    try {
      if (!engine) await init();
      const result = engine.request(m.path, m.method, m.body);
      if (m.method === "POST")
        try {
          await save();
        } catch (e) {
          postMessage({
            warning:
              "Browser storage is full or disabled. This change is available in this tab but could not be saved.",
          });
        }
      postMessage({ id: m.id, result });
    } catch (e) {
      postMessage({ id: m.id, error: e.message });
    }
  });
};
