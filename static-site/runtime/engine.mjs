import {
  source,
  date,
  iso,
  add,
  DAY,
  count,
  range,
  key,
  SPECTRUM,
} from "./core.mjs";
import { generate, demoRecipe } from "./generate.mjs";
import {
  Feed,
  antibiogram,
  patients,
  patient,
  wardsOverview,
  brief,
  calendar,
} from "./evidence.mjs";
import { insights } from "./insights.mjs";
import { Views } from "./views.mjs";
import { Notes, parse, deidentify, simulate } from "./notes.mjs";
import { Knowledge } from "./knowledge.mjs";
import { sampleOverview } from "./overview.mjs";
const norm = (q) =>
  q
    .toLowerCase()
    .replace(/[^a-z0-9äöå ]+/g, "")
    .trim()
    .split(/\s+/)
    .join(" ");
export class Engine {
  constructor(payload, state = {}) {
    this.src = source(payload);
    this.state = {
      ...state,
      recipes: state.recipes || {},
      forgotten: state.forgotten || [],
      asked: state.asked || {},
    };
    this.notes = new Notes(this.src.vocabulary, state.notes);
    this.knowledge = new Knowledge(this.src, this.notes);
    this.runs = new Map();
    const recipe = state.feedRecipe || demoRecipe(this.src);
    this.feed = new Feed(this.src, generate(this.src, recipe));
    if (state.today) this.feed.set(date(state.today));
    this.answers = this.src.answers;
  }
  snapshot() {
    return {
      ...this.state,
      notes: this.notes.state,
      feedRecipe: this.feed.run.recipe,
      today: iso(this.feed.today),
    };
  }
  getRun(id) {
    if (!this.runs.has(id)) {
      if (!this.state.recipes[id]) throw Error("Unknown run; generate again");
      this.runs.set(id, new Views(generate(this.src, this.state.recipes[id])));
    }
    return this.runs.get(id);
  }
  visibleAnswers() {
    return Object.entries(this.answers).filter(
      ([k]) => !this.state.forgotten.includes(k),
    );
  }
  suggest(q) {
    const words = norm(q).split(" ").filter(Boolean);
    return this.visibleAnswers()
      .map(([k, v]) => ({ ...v, asked: this.state.asked[k] ?? v.asked ?? 1 }))
      .sort((a, b) => b.asked - a.asked || (a.q < b.q ? -1 : 1))
      .filter((r) =>
        words.every((w) =>
          norm(r.q)
            .split(" ")
            .some((t) => t.startsWith(w)),
        ),
      )
      .slice(0, 6)
      .map((r) => r.q);
  }
  request(path, method = "GET", body = {}) {
    const u = new URL(path, "https://mindline.local"),
      q = Object.fromEntries(u.searchParams),
      p = u.pathname;
    if (p === "/api/app/login") {
      const role =
        body.email === "doctor@mindline.demo"
          ? "doctor"
          : body.email === "hygiene@mindline.demo"
            ? "hygiene"
            : null;
      if (!role) throw Error("Unknown demo account");
      return {
        ok: true,
        email: body.email,
        role,
        name: role === "doctor" ? "Dr. Demo" : "Hygiene team",
        ward: "URO",
      };
    }
    if (p === "/api/meta") {
      const s = this.src,
        weekly = count(s.cultures, (c) => {
          const d = new Date(c._date),
            weekDay = (d.getUTCDay() + 6) % 7;
          return iso(add(c._date, -weekDay));
        });
      return {
        sources: s.sources,
        catalogue: s.catalogue,
        wards: Object.keys(s.wards).sort(),
        presets: s.presets,
        source_range: [iso(s.start), iso(s.end)],
        weekly: Object.entries(weekly).sort((a, b) => (a[0] < b[0] ? -1 : 1)),
        drugs: Object.keys(s.antibiotics).sort(),
        trends: Object.fromEntries(
          ["TMP", "CIP", "AMP", "CRO", "NIT"].map((d) => [d, s.trends[d]]),
        ),
      };
    }
    if (p === "/api/runs" && method === "POST") {
      const start = performance.now(),
        r = generate(this.src, body),
        v = new Views(r),
        id = crypto.randomUUID().slice(0, 8);
      this.runs.set(id, v);
      this.state.recipes[id] = r.recipe;
      while (Object.keys(this.state.recipes).length > 6) {
        const old = Object.keys(this.state.recipes)[0];
        delete this.state.recipes[old];
        this.runs.delete(old);
      }
      return {
        id,
        seconds: Math.round((performance.now() - start) / 10) / 100,
        ...v.summary(),
      };
    }
    if (p.startsWith("/api/runs/")) {
      const [, api, runs, id, what, name] = p.split("/"),
        v = this.getRun(id);
      if (what === "bins") return v.bins(q.size);
      if (what === "live") return v.live(q.size);
      if (what === "delays") return v.delays();
      if (what === "table") return v.page(name, q);
      if (what === "csv")
        return {
          download: v.csv(name, q),
          type: "text/csv;charset=utf-8",
          filename: `simulated-${name}-${id}.csv`,
        };
      if (what === "feed.zip")
        return {
          download: v.zip(),
          type: "application/zip",
          filename: `simulated-feed-${id}.zip`,
        };
    }
    if (p === "/api/app/clock") {
      if (method === "POST") {
        if (body.action === "next")
          this.feed.set(add(this.feed.today, Number(body.days ?? 1)));
        else if (body.action === "prev")
          this.feed.set(add(this.feed.today, -Number(body.days ?? 1)));
        else if (body.action === "reset") this.feed.set(this.src.end);
        else if (body.action === "set") this.feed.set(date(body.day));
        else if (body.action === "use")
          this.feed.use(this.getRun(body.run).run);
      }
      return this.feed.status();
    }
    if (p === "/api/app/calendar") return calendar(this.feed);
    if (p === "/api/app/meta")
      return {
        wards: Object.values(this.src.wards).map((w) => ({
          code: w.ward_code,
          name: w.ward_en,
          names: this.src.names.wards[w.ward_code],
          type: w.ward_type,
        })),
        first: iso(this.src.start),
        last: iso(this.feed.today),
        specimens: ["urine", "blood", "wound"],
        names: this.src.names,
      };
    if (p === "/api/app/knowledge/graph") return this.knowledge.dashboard();
    if (p === "/api/app/knowledge/questions") return this.knowledge.questions();
    if (p === "/api/app/knowledge/query")
      return this.knowledge.query(body.question, body.filters);
    const src = this.feed.view(q.asof ? date(q.asof) : this.feed.today);
    if (p === "/api/app/overview") return sampleOverview(src, q);
    if (p === "/api/app/patients") return patients(src, q.ward || "URO");
    if (p === "/api/app/patient") return patient(src, q.id);
    if (p === "/api/app/antibiogram")
      return antibiogram(
        src,
        Object.fromEntries(Object.entries(q).filter(([k, v]) => v !== "")),
      );
    if (p === "/api/app/wards") {
      let types = (q.types || "esbl,mrsa,vre,cpe")
        .toLowerCase()
        .split(",")
        .filter((t) => ["esbl", "mrsa", "vre", "cpe"].includes(t));
      return wardsOverview(src, types.length ? types : undefined);
    }
    if (p === "/api/app/brief")
      return brief(this.feed, this.notes.find("knowledge", [["Kind"]], 6));
    if (p === "/api/app/insights")
      return insights(
        this.feed,
        q,
        this.notes.find("knowledge", [["Ward", q.ward || "URO"]], 500),
      );
    if (p === "/api/app/record")
      return this.notes.find("patient", [["Patient", q.id]]);
    if (p === "/api/app/knowledge") {
      const paths = [["Ward", q.ward || "URO"]];
      if (q.drug)
        paths.push([
          "Drug",
          SPECTRUM[q.drug] || "other",
          this.src.vocabulary.DRUG_NAME[q.drug],
        ]);
      return this.notes.find("knowledge", paths);
    }
    if (p.startsWith("/api/app/narrate/")) {
      const pt = patient(src, body.patient),
        ctx = {
          asof: iso(this.feed.today),
          ward: body.ward || "URO",
          org: body.org || null,
          lang: body.lang || null,
        };
      if (p.endsWith("/simulate"))
        return {
          lines: simulate(
            pt,
            antibiogram(src, {
              ward: ctx.ward,
              sex: pt.sex,
              spec: pt.history[0].spec,
              org: ctx.org,
            }),
            src,
            body.lang,
          ),
        };
      const facts = parse(body.text || "", this.src.vocabulary, body.lang),
        { shared, removed } = deidentify(facts, pt, ctx, this.src.vocabulary);
      if (p.endsWith("/parse")) return { facts, shared, removed };
      if (p.endsWith("/commit"))
        return this.notes.commit(
          pt,
          facts,
          body.share === false ? [] : shared,
          ctx,
          body.author,
        );
    }
    if (p === "/api/app/ask/suggest") return { q: this.suggest(q.q || "") };
    if (p === "/api/app/ask") {
      const question = String(body.q || "")
          .trim()
          .slice(0, 300),
        k = norm(question),
        hit = this.state.forgotten.includes(k) ? null : this.answers[k];
      if (!question) throw Error("Enter a question.");
      if (hit) {
        this.state.asked[k] = (this.state.asked[k] ?? hit.asked ?? 1) + 1;
        return {
          status: "done",
          cached: true,
          q: hit.q,
          blocks: hit.blocks,
          asof: hit.asof,
        };
      }
      return {
        status: "nocache",
        q: question,
        suggest: this.suggest(question).length
          ? this.suggest(question)
          : this.suggest(""),
      };
    }
    if (p === "/api/app/ask/forget") {
      if (!this.state.forgotten.includes(body.key))
        this.state.forgotten.push(body.key);
      return { ok: true };
    }
    if (p === "/api/app/ask/jobs")
      return {
        model: "saved examples",
        mode: "cache",
        codex: false,
        jobs: [],
        cache: this.visibleAnswers()
          .map(([key, r]) => ({
            key,
            q: r.q,
            model: r.model,
            asof: r.asof,
            at: r.at,
            asked: this.state.asked[key] ?? r.asked ?? 1,
            seconds: r.seconds,
          }))
          .sort((a, b) => (b.at || "").localeCompare(a.at || "")),
      };
    if (p === "/api/app/ask/job" || p === "/api/app/ask/stop")
      throw Error("No live generation jobs on the static site.");
    throw Error("Unknown local operation: " + p);
  }
}
