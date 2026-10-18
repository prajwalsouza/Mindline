import { short, SPECTRUM, Random } from "./core.mjs";
const escape = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const match = (rx, text) => new RegExp(rx, "iu").test(text || "");
function find(text, table) {
  const out = [];
  for (const [code, words] of Object.entries(table || {}))
    for (const word of words) {
      const m = new RegExp(
        "(?<![a-zäöå])" +
          escape(word) +
          (word.length >= 5 ? "[a-zäöå]*" : "(?![a-zäöå])"),
        "iu",
      ).exec(text);
      if (m) {
        out.push({ code, span: [m.index, m.index + m[0].length] });
        break;
      }
    }
  return out.sort((a, b) => a.span[0] - b.span[0]);
}
function practiceReason(key, why, v) {
  if (!key || !why || match(v.NEGATION, why)) return false;
  if (key === "family_baseline")
    return (
      (match("know|tuntee|känner", why) &&
        match("usual|routine|baseline|tavalli|arjen|vanliga|rutin", why)) ||
      (match("notice|huomasi|märkte", why) &&
        match("change|muuto|förändr", why))
    );
  if (key === "followup_understanding")
    return (
      match("nod|nyökk|nicka", why) && match("ask|question|kysyi|frågade", why)
    );
  if (key === "medication_routine")
    return (
      match(
        "miss|clash|difficult|jäänee|väliin|vaike|missade|missas|krock|svårt",
        why,
      ) && match("shift|schedule|work|työvuoro|arbetspass|schema", why)
    );
  return (
    !!v.PRACTICES[key].reason_terms?.length &&
    v.PRACTICES[key].reason_terms.every((rx) => match(rx, why))
  );
}
function trigger(observation, v) {
  const m = /\b(?:if|jos|om)\b/i.exec(observation);
  if (!m) return null;
  const clause = observation
    .slice(m.index + m[0].length)
    .split(
      /,|;|\b(?:then|i['’]?(?:d|ll)|i would|i will|we would|we will|vaihdan|vaihda|aloitan|aloitetaan|byter|börjar|sätter)\b/i,
    )[0];
  if (
    match(v.NEGATION, clause) ||
    /\b(?:and|or|ja|tai|och|eller)\b/i.test(clause)
  )
    return null;
  const found = [
    ["resistance", "FLAGS"],
    ["symptom", "SYMPTOMS"],
    ["condition", "CONDITIONS"],
  ].flatMap(([kind, table]) =>
    find(clause, v[table]).map((e) => kind + ":" + e.code),
  );
  return found.length === 1 ? found[0] : null;
}
export function parse(text, v, lang = null) {
  if (typeof text !== "string") throw Error("Note must be text");
  const language = ["en", "fi", "sv"].includes(lang)
    ? lang
    : match("\\b(koska|kysy|tarkista|aloitan|potilas|jos)\\b", text)
      ? "fi"
      : match("\\b(eftersom|fråga|kontrollera|patienten|byter|om)\\b", text)
        ? "sv"
        : "en";
  return text
    .trim()
    .split(/(?<=[.!?])(?<![A-Z]\.)\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((sent) => {
      const entities = [
        ["DRUGS", "drug"],
        ["ORGS", "organism"],
        ["FLAGS", "resistance"],
        ["CONDITIONS", "condition"],
        ["SYMPTOMS", "symptom"],
      ]
        .flatMap(([table, type]) =>
          find(sent, v[table]).map((e) => ({
            ...e,
            type,
            label:
              type === "drug"
                ? v.DRUG_NAME[e.code]
                : type === "organism"
                  ? short(e.code)
                  : e.code,
          })),
        )
        .sort((a, b) => a.span[0] - b.span[0]);
      const reasons = v.REASON_TYPES.filter(([r, rx]) => match(rx, sent)).map(
        ([r]) => r,
      );
      let decision = v.DECISION.find(([d, rx]) => match(rx, sent))?.[0] || null;
      let kind =
        /(?:^|[,;:])\s*(if|jos|om)\b/i.test(sent) ||
        /\bif\b.+\b(i['’]?(?:d|ll)|i would|i will|we would|we will|then)\b/i.test(
          sent,
        )
          ? "if-then"
          : decision
            ? "decision"
            : entities.some((e) => ["condition", "symptom"].includes(e.type)) ||
                /\b(looks like|probably|likely|could be|seems|näyttää|todennäköisesti|ser ut|troligen)\b/i.test(
                  sent,
                )
              ? "impression"
              : reasons.length
                ? "reason"
                : "note";
      const why = /\b(?:because|koska|eftersom)\b\s+/i.exec(sent);
      let observation =
        why?.index > 0 ? sent.slice(0, why.index).replace(/[ ,;]+$/, "") : sent;
      let reasoning =
        why?.index > 0 ? sent.slice(why.index + why[0].length).trim() : null;
      const consequence = /[,;]?\s+\b(?:so|joten|så)\b\s+/i.exec(sent);
      if (!reasoning && consequence && decision) {
        reasoning = sent.slice(0, consequence.index).trim();
        observation = sent
          .slice(consequence.index + consequence[0].length)
          .trim();
      }
      if (why?.index === 0) reasoning = sent.slice(why[0].length).trim();
      decision =
        v.DECISION.find(([d, rx]) => match(rx, observation))?.[0] || null;
      if (kind !== "if-then" && decision) kind = "decision";
      const drugs = find(observation, v.DRUGS);
      let practice =
        Object.entries(v.PRACTICES || {}).find(
          ([key, r]) => match(r.theme, sent) && match(r.person, sent),
        )?.[0] || null;
      const negated =
        /(?:\b(?:not|never|do not|älä|en|ei)\b|n['’]t\b)\s+(?:\w+\s+){0,2}(?:ask|check|confirm|arrange|review|keep|discuss|use|switch|start|avoid|stop|give|kysy|tarkista|varmista|järjestä|vaihd|aloit)\w*|\b(?:fråga|kontrollera|bekräfta|ordna|byter|börjar)\s+inte\b/iu.test(
          observation,
        );
      if (negated) practice = null;
      const shared_reasons = v.REASON_TYPES.filter(
        ([r, rx]) =>
          reasoning && !match(v.NEGATION, reasoning) && match(rx, reasoning),
      ).map(([r]) =>
        r === "earlier resistance" &&
        !/earlier|prior|previous|history|aiempi|aiemmin|tidigare/i.test(
          reasoning,
        )
          ? "reported resistance"
          : r,
      );
      return {
        text: sent,
        kind,
        observation,
        reasoning,
        decision: ["decision", "if-then"].includes(kind) ? decision : null,
        drug: drugs.length
          ? (decision === "start" || decision === "switch"
              ? drugs.at(-1)
              : drugs[0]
            ).code
          : null,
        reasons,
        entities,
        language,
        practice,
        practice_reason: practiceReason(practice, reasoning, v),
        shared_reasons,
        share_action: !negated,
        statement_mode:
          kind === "if-then"
            ? "if_then"
            : /^\s*(?:i (?:think|suspect)|maybe|perhaps|epäilen|arvelen|jag (?:tror|misstänker))\b/i.test(
                  observation,
                )
              ? "thinks"
              : "decided",
        uncertainty:
          kind === "if-then"
            ? "conditional"
            : /\b(think|suspect|probably|possible|possibly|might|could|may|epäilen|todennäköisesti|voi|mahdollinen|tror|misstänker|kanske|troligen|kan)\b/i.test(
                  sent,
                )
              ? "uncertain"
              : "reported",
        trigger: kind === "if-then" ? trigger(observation, v) : null,
      };
    });
}
export function deidentify(facts, pt, ctx, v = {}) {
  const age = +ctx.asof.slice(0, 4) - Number(pt.birth_year),
    context = {
      ward: ctx.ward,
      sample: pt.history[0].spec,
      sex: pt.sex,
      age_band: age >= 65 ? "65+" : "under 65",
      organism: ctx.org || null,
      month: ctx.asof.slice(0, 7),
    },
    shared = [];
  for (const f of facts) {
    const provenance = {
      language: ctx.lang || f.language || "en",
      uncertainty: f.uncertainty || "reported",
      has_reason: !!f.reasoning,
      organism:
        f.entities.find((e) => e.type === "organism")?.code || context.organism,
    };
    let row = null;
    const reasons = (f.shared_reasons || []).filter((r) => r !== "allergy");
    if (f.practice)
      row = {
        kind: "handover practice",
        practice: f.practice,
        practice_reason: f.practice_reason,
        statement_mode: f.statement_mode,
        trigger: f.trigger,
      };
    else if (
      ["decision", "if-then"].includes(f.kind) &&
      f.drug &&
      f.decision &&
      f.share_action
    )
      row = {
        kind: f.kind,
        decision: f.decision,
        drug: f.drug,
        reasons,
        trigger: f.trigger,
        condition: f.entities.find((e) => e.type === "condition")?.code || null,
        resistance:
          f.entities.find((e) => e.type === "resistance")?.code || null,
      };
    else if (
      ["note", "reason", "impression"].includes(f.kind) &&
      f.reasons.includes("ward pattern")
    )
      row = {
        kind: "ward observation",
        resistance:
          f.entities.find((e) => e.type === "resistance")?.code || null,
      };
    else if (
      f.kind === "impression" &&
      !match(v.NEGATION || "\\b(?:no|not|inte|ei)\\b", f.observation)
    ) {
      const condition = f.entities.find((e) => e.type === "condition")?.code;
      if (condition) row = { kind: "clinical impression", condition, reasons };
    } else if (
      f.kind === "reason" &&
      f.reasoning &&
      reasons.length &&
      !match(v.NEGATION || "\\b(?:no|not|inte|ei)\\b", f.reasoning)
    )
      row = { kind: "stated rationale", reasons, drug: f.drug };
    if (row) shared.push({ ...row, ...context, ...provenance });
  }
  return {
    shared,
    removed: [
      `patient ID ${pt.id}`,
      `age ${age} → ${context.age_band}`,
      `date → ${context.month}`,
      "the spoken words themselves",
      ...(facts.some((f) => f.reasons.includes("allergy"))
        ? ["allergy (kept on the patient only)"]
        : []),
    ],
  };
}
export class Notes {
  constructor(v, state = {}) {
    this.v = v;
    this.state = {
      patient: state.patient || [],
      knowledge: state.knowledge || [],
      contributions: state.contributions || [],
    };
  }
  find(which, paths, limit = 20) {
    return this.state[which]
      .filter((n) =>
        paths.every((p) => n.tags.some((t) => p.every((v, i) => t[i] === v))),
      )
      .slice()
      .reverse()
      .slice(0, limit)
      .map(({ tags, ...n }) => n);
  }
  add(which, type, text, tags, fields) {
    const clean = Object.fromEntries(
      Object.entries(fields)
        .filter(
          ([k, v]) =>
            v !== null &&
            v !== undefined &&
            v !== "" &&
            (!Array.isArray(v) || v.length),
        )
        .map(([k, v]) => [k, typeof v === "object" ? v : String(v)]),
    );
    this.state[which].push({
      id: crypto.randomUUID(),
      type,
      text,
      tags,
      fields: clean,
      created_at: Date.now(),
    });
  }
  counts(which) {
    const ns = this.state[which],
      tags = new Set();
    for (const n of ns)
      for (const p of n.tags)
        for (let i = 1; i <= p.length; i++)
          tags.add(JSON.stringify(p.slice(0, i)));
    const fields = ns.reduce((s, n) => s + Object.keys(n.fields).length, 0);
    return {
      node_headers: ns.length + tags.size + fields,
      tag_memberships: ns.reduce((s, n) => s + n.tags.length, 0),
      field_values: fields,
      parent_edges: tags.size,
    };
  }
  commit(pt, facts, shared, ctx, author = "Doctor") {
    for (const f of facts) {
      const tags = [
        ["Patient", pt.id],
        ["Kind", f.kind],
        ["Ward", ctx.ward],
      ];
      for (const e of f.entities)
        tags.push(
          e.type === "drug"
            ? ["Drug", SPECTRUM[e.code] || "other", e.label]
            : [e.type[0].toUpperCase() + e.type.slice(1), e.label],
        );
      this.add("patient", "narration", f.text, tags, {
        kind: f.kind,
        observation: f.observation,
        reasoning: f.reasoning,
        decision: f.decision,
        drug: f.drug,
        reasons: f.reasons,
        author,
        sample_date: pt.history[0].date,
      });
    }
    const contribution = shared.length
      ? "note-" + crypto.randomUUID().replaceAll("-", "").slice(0, 16)
      : null;
    shared.forEach((row, index) =>
      this.state.contributions.push({
        id: contribution + "-" + (index + 1),
        note_id: contribution,
        shared: structuredClone(row),
      }),
    );
    for (const k of shared) {
      const tags = [
        ["Kind", k.kind],
        ["Ward", k.ward],
        ["Sample", k.sample],
      ];
      if (k.drug)
        tags.push([
          "Drug",
          SPECTRUM[k.drug] || "other",
          this.v.DRUG_NAME[k.drug],
        ]);
      if (k.resistance) tags.push(["Resistance", k.resistance]);
      const { ward, sample, ...fields } = k;
      this.add("knowledge", "knowledge", null, tags, fields);
    }
    return {
      contribution,
      patient_record: facts.length,
      ward_knowledge: shared.length,
      stores: {
        patient: this.counts("patient"),
        knowledge: this.counts("knowledge"),
      },
    };
  }
}
export function simulate(pt, ab, src, lang = "en") {
  const rng = new Random(Date.now()),
    pick =
      ab.drugs.find((d) => d.year.share >= 0.85)?.code ||
      ab.drugs[0]?.code ||
      "NIT",
    cur = pt.history[0],
    org = cur.isolates[0]?.organism,
    prev = pt.history
      .slice(1)
      .flatMap((h) =>
        h.isolates.flatMap((i) =>
          i.resisted
            .filter((d) => src.vocabulary.DRUG_NAME[d])
            .map((d) => [h, i, d]),
        ),
      )[0];
  let lines = [];
  if (["fi", "sv"].includes(lang)) {
    const T = src.vocabulary[lang === "fi" ? "SIM_FI" : "SIM_SV"],
      format = (s) =>
        s
          .replaceAll("{org}", org ? short(org) : "?")
          .replaceAll("{drug}", src.names.drugs[pick][lang]);
    lines.push(format(rng.choice(T.open)));
    if (prev)
      lines.push(
        T.prev
          .replace("{org}", short(prev[1].organism))
          .replace("{drug}", src.names.drugs[prev[2]][lang])
          .replace("{month}", prev[0].date.slice(0, 7)),
      );
    lines.push(format(rng.choice(T.start)), rng.choice(T.end));
  } else {
    lines.push(
      cur.spec === "urine"
        ? `Looks like a simple cystitis, ${org ? short(org) : "waiting for the culture"}.`
        : cur.spec === "blood"
          ? "Blood cultures sent, fever since last night."
          : "Red and warm around the wound, looks like a wound infection.",
    );
    if (prev)
      lines.push(
        `Earlier ${short(prev[1].organism)} was resistant to ${src.vocabulary.DRUG_NAME[prev[2]]}, so I will avoid it.`,
      );
    lines.push(
      `Going with ${src.vocabulary.DRUG_NAME[pick]} for now.`,
      "If it turns out to be ESBL I'd switch to meropenem.",
    );
  }
  return [
    lines[0],
    ...rng.sample(
      lines.slice(1),
      Math.min(lines.length - 1, rng.choice([1, 2])),
    ),
  ];
}
