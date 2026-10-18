// Sanitized knowledge projection and real local SPARQL. No patient text is used here.
import initOxigraph, * as ox from "./vendor/oxigraph/web.mjs";
export async function initKnowledge(wasm) {
  await initOxigraph(wasm ? { module_or_path: wasm } : undefined);
}
const TYPES = {
  thinks: "THINKS",
  because: "BECAUSE",
  decided: "DECIDED",
  if_then: "IF → THEN",
};
const GROUPS = [
  ["question", "Questions"],
  ["condition", "Context"],
  ["action", "Actions"],
  ["reason", "Reasons and reported effects"],
  ["drug", "Medicines"],
  ["organism", "Bacteria"],
  ["ward", "Wards"],
  ["resistance", "Resistance terms"],
];
const unique = (xs) => [...new Set(xs)];
const ML = "urn:mindline:vocab:",
  RDF = "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
  SKOS = "http://www.w3.org/2004/02/skos/core#",
  PROV = "http://www.w3.org/ns/prov#";
const uri = (kind, id) => "urn:mindline:" + kind + ":" + encodeURIComponent(id);
const ident = (kind, label) => kind + "-local-" + encodeURIComponent(label);
export class Knowledge {
  constructor(src, notes) {
    this.src = src;
    this.notes = notes;
    this.cache = null;
  }
  dashboard() {
    const records = this.notes.state.contributions || [],
      signature = JSON.stringify(records);
    if (this.cache?.signature === signature) return this.cache.snapshot;
    const seed = structuredClone(this.src.knowledge);
    if (!seed)
      throw Error("Bundled knowledge examples are missing. Rebuild this site.");
    const nodes = new Map(seed.nodes.map((n) => [n.id, n])),
      edges = new Map(seed.edges.map((e) => [e.id, e])),
      entries = seed.entries;
    const vocab = this.src.vocabulary,
      labels = this.src.knowledge_labels;
    const byLabel = new Map(
      seed.nodes.map((n) => [n.type + "|" + n.label, n.id]),
    );
    for (const record of records) {
      const s = record.shared;
      if (
        !s ||
        !this.src.wards[s.ward] ||
        !["en", "fi", "sv"].includes(s.language) ||
        !/^20\d\d-(0[1-9]|1[0-2])$/.test(s.month) ||
        !/^note-[a-f0-9]{16}-\d+$/.test(record.id)
      )
        continue;
      const practice = vocab.PRACTICES[s.practice],
        reasons = (s.reasons || []).filter((r) => labels.reasons[r]);
      let when,
        then,
        why = "",
        primary;
      if (practice) {
        when =
          s.statement_mode === "if_then"
            ? vocab.TRIGGER_LABELS[s.trigger] || "Condition not generalized"
            : practice.condition;
        then = practice.action;
        why = s.practice_reason ? practice.reason : "";
        primary = TYPES[s.statement_mode] ? s.statement_mode : "decided";
      } else if (
        ["decision", "if-then"].includes(s.kind) &&
        labels.decisions[s.decision] &&
        vocab.DRUG_NAME[s.drug]
      ) {
        when =
          s.kind === "if-then"
            ? vocab.TRIGGER_LABELS[s.trigger] || "Condition not generalized"
            : vocab.CONDITIONS[s.condition]
              ? s.condition
              : "Drug decision in the recorded context";
        then = labels.decisions[s.decision] + " " + vocab.DRUG_NAME[s.drug];
        why = s.has_reason
          ? reasons.map((r) => labels.reasons[r]).join("; ")
          : "";
        primary = s.kind === "if-then" ? "if_then" : "decided";
      } else if (
        s.kind === "clinical impression" &&
        vocab.CONDITIONS[s.condition]
      ) {
        when = "Considering " + s.condition;
        then = "Clinical impression recorded";
        why = s.has_reason
          ? reasons.map((r) => labels.reasons[r]).join("; ")
          : "";
        primary = "thinks";
      } else if (s.kind === "stated rationale" && reasons.length) {
        when = "A stated rationale was recorded";
        then = "Reason recorded for the next clinician";
        why = reasons.map((r) => labels.reasons[r]).join("; ");
        primary = "because";
      } else if (s.kind === "ward observation") {
        when = "A ward pattern was mentioned";
        then = "Review the reported ward pattern";
        primary = "thinks";
      } else continue;
      const concept_ids = [],
        edge_ids = [];
      const node = (type, label, key = label) => {
        const id =
          type === "statement"
            ? "statement-" + key
            : byLabel.get(type + "|" + label) || ident(type, key);
        if (!nodes.has(id)) {
          nodes.set(id, { id, label, type, description: label, entry_ids: [] });
          byLabel.set(type + "|" + label, id);
        }
        const n = nodes.get(id);
        n.entry_ids = unique([...n.entry_ids, record.id]);
        concept_ids.push(id);
        return id;
      };
      const edge = (source, target, label) => {
        const id =
          seed.edges.find(
            (e) =>
              e.source === source && e.target === target && e.label === label,
          )?.id || ident("edge", [source, label, target].join("|"));
        if (!edges.has(id))
          edges.set(id, { id, source, target, label, entry_ids: [] });
        const e = edges.get(id);
        e.entry_ids = unique([...e.entry_ids, record.id]);
        edge_ids.push(id);
      };
      const c = node("condition", when),
        a = node("action", then);
      edge(c, a, "recorded action");
      if (practice) edge(c, node("question", practice.question), "framed by");
      if (why)
        for (const r of practice
          ? [why]
          : reasons.map((r) => labels.reasons[r]))
          edge(a, node("reason", r), "because");
      const ward_name = this.src.wards[s.ward].ward_en;
      edge(a, node("ward", ward_name), "reported on");
      for (const [type, label] of [
        ["drug", vocab.DRUG_NAME[s.drug]],
        ["organism", vocab.ORGS[s.organism] ? s.organism : null],
        ["resistance", vocab.FLAGS[s.resistance] ? s.resistance : null],
      ])
        if (label) edge(a, node(type, label), "mentions");
      const statement_types = unique([primary, ...(why ? ["because"] : [])]);
      for (const kind of statement_types)
        edge(a, node("statement", TYPES[kind], kind), "recorded as");
      entries.push({
        id: record.id,
        note_id: record.note_id,
        language: s.language,
        month: s.month,
        ward: s.ward,
        ward_name,
        source: "committed",
        demo: false,
        summary:
          `${when}. ${then}.` +
          (why
            ? ` Reason given: ${why}.`
            : s.has_reason
              ? " Stated rationale not generalized."
              : " No explicit rationale captured."),
        if: when,
        then,
        why,
        uncertainty: ["reported", "conditional", "uncertain"].includes(
          s.uncertainty,
        )
          ? s.uncertainty
          : "reported",
        conditional: primary === "if_then",
        statement_type: primary,
        statement_types,
        thinks: primary === "thinks" ? when : "",
        because: why,
        decided: primary === "decided" ? then : "",
        reason_status: why
          ? "generalized"
          : s.has_reason
            ? "not_generalized"
            : "not_stated",
        concept_ids: unique(concept_ids),
        tags: unique(concept_ids),
        edge_ids: unique(edge_ids),
      });
    }
    const ns = [...nodes.values()],
      es = [...edges.values()];
    for (const n of [...ns, ...es]) n.count = n.entry_ids.length;
    entries.sort(
      (a, b) => b.month.localeCompare(a.month) || b.id.localeCompare(a.id),
    );
    const tag_tree = GROUPS.map(([type, label]) => {
      const children = ns
        .filter((n) => n.type === type)
        .map((n) => ({ ...n, children: [] }))
        .sort((a, b) => a.label.localeCompare(b.label));
      const entry_ids = unique(children.flatMap((n) => n.entry_ids));
      return {
        id: "tags-" + type,
        type,
        label,
        children,
        entry_ids,
        count: entry_ids.length,
      };
    });
    const statement_tree = Object.entries(TYPES).map(([kind, label]) => {
      const entry_ids = entries
          .filter((e) => e.statement_types.includes(kind))
          .map((e) => e.id),
        set = new Set(entry_ids);
      const children = tag_tree
        .map((g) => {
          const leaves = g.children
            .map((n) => {
              const ids = n.entry_ids.filter((id) => set.has(id));
              return { ...n, entry_ids: ids, count: ids.length };
            })
            .filter((n) => n.count);
          const ids = unique(leaves.flatMap((n) => n.entry_ids));
          return {
            ...g,
            id: "statement-" + kind + "-" + g.type,
            entry_ids: ids,
            count: ids.length,
            children: leaves,
          };
        })
        .filter((g) => g.count);
      return {
        id: "statement-" + kind,
        type: "statement",
        label,
        entry_ids,
        count: entry_ids.length,
        children,
      };
    });
    const snapshot = {
      ...seed,
      nodes: ns,
      edges: es,
      entries,
      tag_tree,
      statement_tree,
      options: {
        ...seed.options,
        months: unique(entries.map((e) => e.month)).sort(),
      },
      summary: {
        entries: entries.length,
        contributions: unique(entries.map((e) => e.note_id)).length,
        nodes: ns.length,
        edges: es.length,
        illustrative: entries.filter((e) => e.source === "illustrative").length,
        committed: entries.filter((e) => e.source === "committed").length,
        languages: unique(entries.map((e) => e.language)).length,
        with_reason: entries.filter((e) => e.why).length,
      },
      meta: {
        ...seed.meta,
        storage: "Sanitized browser store (IndexedDB)",
        history:
          "Contributions kept in this browser persist locally. Private note text is excluded from the shared graph.",
      },
    };
    const store = buildRDF(snapshot);
    snapshot.meta.rdf = {
      engine: "Oxigraph 0.5.11 (WebAssembly)",
      triples: store.size,
      entries: entries.length,
      storage: "Local browser RDF store",
      format: "RDF/JS",
    };
    this.cache?.store.free();
    this.cache = { signature, snapshot, store };
    return snapshot;
  }
  questions() {
    return {
      questions: Object.entries(this.src.knowledge_queries.templates).map(
        ([id, t]) => ({ id, label: t.label, description: t.description }),
      ),
      mode: "Predefined questions executed as local SPARQL SELECT queries",
    };
  }
  query(question, filters = {}) {
    const template = this.src.knowledge_queries.templates[question];
    if (!template)
      throw Error("Choose one of the available knowledge questions");
    const snapshot = this.dashboard();
    if (!filters || typeof filters !== "object" || Array.isArray(filters))
      throw Error("Filters must be an object");
    const bindings = {};
    for (const [k, v] of Object.entries(filters)) {
      if (!["source", "language", "ward", "month_from", "month_to"].includes(k))
        throw Error("Unsupported knowledge query filter");
      if (v == null || v === "" || v === "all") continue;
      if (typeof v !== "string") throw Error("Filter values must be text");
      if (k === "source" && !["illustrative", "committed"].includes(v))
        throw Error("Unknown contribution source");
      if (k === "language" && !["en", "fi", "sv"].includes(v))
        throw Error("Unknown contribution language");
      if (k === "ward" && !snapshot.options.wards.some((w) => w.code === v))
        throw Error("Unknown ward");
      if (k.startsWith("month_") && !/^20\d\d-(0[1-9]|1[0-2])$/.test(v))
        throw Error("Month must be YYYY-MM");
      bindings["filter_" + k] = v;
    }
    if (
      (bindings.filter_month_from || "") >
      (bindings.filter_month_to || "9999-99")
    )
      throw Error("Start month must not be after end month");
    // Only validated literals enter VALUES; question text itself is never executable.
    const values = Object.entries(bindings)
      .map(
        ([key, value]) => `VALUES ?${key} { ${ox.literal(value).toString()} }`,
      )
      .join("\n");
    const sparql =
      this.src.knowledge_queries.prefixes +
      template.body.replace("WHERE {", "WHERE {\n" + values);
    const rows = this.cache.store
      .query(sparql)
      .map((binding) =>
        Object.fromEntries(
          [...binding].map(([k, t]) => [
            k,
            /integer|decimal|double/.test(t.datatype?.value || "")
              ? Number(t.value)
              : t.value,
          ]),
        ),
      );
    return {
      question: { id: question, label: template.label },
      columns: template.columns,
      rows,
      sparql,
      bindings,
      explanation: template.explanation,
      meta: {
        ...snapshot.meta.rdf,
        returned: rows.length,
        limit: 200,
        query_mode: "Allowlisted local SELECT",
      },
    };
  }
}
export function buildRDF(snapshot) {
  const store = new ox.Store(),
    nn = ox.namedNode;
  const add = (s, p, o, iri = false) =>
    store.add(ox.quad(nn(s), nn(p), iri ? nn(o) : ox.literal(String(o))));
  const nodeMap = new Map(snapshot.nodes.map((n) => [n.id, n]));
  for (const n of snapshot.nodes) {
    const s = uri("concept", n.id);
    add(s, RDF + "type", SKOS + "Concept", true);
    add(s, ML + "conceptId", n.id);
    add(s, SKOS + "prefLabel", n.label);
    add(s, ML + "kind", n.type);
    add(s, SKOS + "broader", uri("tag-group", n.type), true);
  }
  for (const e of snapshot.entries) {
    const s = uri("statement", e.id),
      note = uri("contribution", e.note_id);
    add(s, RDF + "type", ML + "SourcedObservation", true);
    add(s, ML + "entryId", e.id);
    add(s, PROV + "wasDerivedFrom", note, true);
    add(note, ML + "noteId", e.note_id);
    add(note, RDF + "type", PROV + "Entity", true);
    const classes = {
      thinks: "ReportedThought",
      because: "StatedRationale",
      decided: "RecordedDecision",
      if_then: "ConditionalStatement",
    };
    for (const kind of e.statement_types || [])
      if (classes[kind] && !(kind === "decided" && e.conditional)) {
        add(s, RDF + "type", ML + classes[kind], true);
        add(s, ML + "statementKind", kind);
      }
    if (e.conditional) add(s, RDF + "type", ML + "ConditionalStatement", true);
    for (const [key, predicate] of [
      ["language", "language"],
      ["month", "month"],
      ["ward", "wardCode"],
      ["source", "sourceKind"],
      ["uncertainty", "uncertainty"],
      ["if", "recordedCondition"],
      ["then", "recordedAction"],
      ["why", "statedReason"],
      ["thinks", "reportedThought"],
      ["because", "statedBecause"],
      ["decided", "recordedDecision"],
    ])
      if (e[key] && !(key === "decided" && e.conditional))
        add(s, ML + predicate, e[key]);
    if (e.source === "illustrative" && e.source_text)
      add(note, ML + "illustrativeText", e.source_text);
    for (const id of e.concept_ids) {
      const n = nodeMap.get(id);
      if (!n) continue;
      add(s, ML + "mentionsConcept", uri("concept", id), true);
      if (["action", "condition", "reason"].includes(n.type))
        add(s, ML + n.type + "Concept", uri("concept", id), true);
    }
  }
  for (const e of snapshot.edges) {
    const s = uri("relation", e.id);
    add(s, RDF + "type", RDF + "Statement", true);
    add(s, RDF + "subject", uri("concept", e.source), true);
    add(s, RDF + "predicate", ML + "recordedAssociation", true);
    add(s, RDF + "object", uri("concept", e.target), true);
    for (const id of e.entry_ids)
      add(s, PROV + "wasDerivedFrom", uri("statement", id), true);
  }
  return store;
}
