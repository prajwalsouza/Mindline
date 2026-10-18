"""A local, inspectable pseudo graph of sanitized demo knowledge contributions.

Only controlled concepts are persisted. Patient notes, authors, identifiers and
exact dates never enter this file or its API. Repeated mentions are occurrences,
not independent clinical evidence. No LLM, graph database or real patient store
is used here.
"""
import hashlib
import json
import re
import threading
import uuid
from collections import Counter
from functools import lru_cache
from pathlib import Path

from feedsim import data
import narrative

STORE = Path(__file__).resolve().parent / ".runtime" / "knowledge.json"
LOCK = threading.RLock()
LANGUAGES = {"en": "English", "fi": "Finnish", "sv": "Swedish"}
REASONS = {"earlier resistance": "Earlier resistance was reported", "reported resistance": "Resistance was reported", "ward pattern": "A ward pattern was reported",
           "kidney function": "Kidney function was considered", "tolerated before": "Earlier tolerance was reported",
           "reported local results": "Local laboratory results were cited"}
DECISIONS = {"start": "Start", "switch": "Switch to", "avoid": "Avoid", "stop": "Stop", "wait": "Wait before using"}

# Explicitly illustrative narration, stored only as generalized concepts.
# Repetition demonstrates concept normalization across languages, not consensus.
SEED_NOTES = [
    ("en", "2026-06", "URO", "Ask the daughter about a change in confusion, because she knows the usual routine and noticed the change."),
    ("fi", "2026-07", "GER", "Kysy tyttäreltä sekavuuden muutoksesta, koska hän tuntee potilaan tavallisen arjen ja huomasi muutoksen ensimmäisenä."),
    ("sv", "2026-09", "MED-A", "Fråga dottern om förändrad förvirring, eftersom hon känner patientens vanliga rutiner och märkte förändringen först."),
    ("en", "2026-07", "URO", "Check whether the patient understood the follow-up plan, because they nodded but later asked when to return."),
    ("fi", "2026-08", "MED-A", "Tarkista, ymmärsikö potilas jatkosuunnitelman, koska hän nyökkäsi mutta kysyi myöhemmin, milloin pitäisi palata."),
    ("sv", "2026-09", "GER", "Kontrollera att patienten förstod uppföljningsplanen, eftersom patienten nickade men senare frågade när nästa besök skulle ske."),
    ("en", "2026-06", "MED-A", "Ask what made taking the medication difficult, because doses were missed when the schedule clashed with work shifts."),
    ("fi", "2026-08", "URO", "Kysy, mikä vaikeutti aiemman lääkkeen ottamista, koska annosten kerrottiin jääneen väliin työvuorojen vuoksi."),
    ("sv", "2026-09", "GER", "Fråga vad som gjorde det svårt att ta medicinen, eftersom doser missades när schemat krockade med arbetspassen."),
    ("en", "2026-07", "URO", "If ESBL is reported, I would switch to meropenem because earlier resistance was reported."),
    ("fi", "2026-08", "MED-A", "Jos tulee ESBL, vaihdan meropeneemiin koska aiempi näyte oli resistentti."),
    ("sv", "2026-09", "GER", "Om det blir ESBL byter jag till meropenem eftersom bakterien tidigare var resistent."),
]

# Twenty-four prewritten examples, expanded into clearly marked mock handovers
# across twelve months. They are illustrative variations, not independent proof.
PRACTICE_EXAMPLES = {
    "family_baseline": dict(zip(LANGUAGES, [row[3] for row in SEED_NOTES[0:3]])),
    "followup_understanding": dict(zip(LANGUAGES, [row[3] for row in SEED_NOTES[3:6]])),
    "medication_routine": dict(zip(LANGUAGES, [row[3] for row in SEED_NOTES[6:9]])),
    "hearing_access": {
        "en": "Check hearing support and find a quiet place, because spoken instructions were hard to hear over background noise.",
        "fi": "Tarkista kuulon tuki ja etsi rauhallinen paikka, koska ohjeita oli vaikea kuulla taustamelussa.",
        "sv": "Kontrollera hörselstödet och hitta en tyst plats, eftersom instruktionerna var svåra att höra med bakgrundsbuller.",
    },
    "language_support": {
        "en": "Arrange an interpreter to check understanding, because important details remained unclear across languages.",
        "fi": "Järjestä tulkki ymmärtämisen tarkistamiseen, koska tärkeitä yksityiskohtia jäi epäselväksi kielten välillä.",
        "sv": "Ordna en tolk för att kontrollera förståelsen, eftersom viktiga detaljer blev oklara mellan språken.",
    },
    "home_support": {
        "en": "Confirm who will provide support at home, because each relative thought another person was responsible.",
        "fi": "Varmista kotona tarvittavan tuen vastuut, koska jokainen omainen luuli toisen olevan vastuussa.",
        "sv": "Bekräfta vem som ger stöd hemma, eftersom varje anhörig trodde att en annan person hade ansvaret.",
    },
    "drink_access": {
        "en": "Check whether the drink is within reach, because the position of the cup made drinking difficult.",
        "fi": "Tarkista, onko juoma ulottuvilla, koska kupin sijoittelu teki juomisesta vaikeaa.",
        "sv": "Kontrollera om drycken är inom räckhåll, eftersom koppens placering gjorde det svårt att dricka.",
    },
    "pain_language": {
        "en": "Ask which words describe the pain, because the same words had different meanings during the conversation.",
        "fi": "Kysy, mitkä sanat kuvaavat kipua, koska samoilla sanoilla oli eri merkityksiä keskustelussa.",
        "sv": "Fråga vilka ord som beskriver smärtan, eftersom samma ord hade olika betydelser under samtalet.",
    },
}
MOCK_OPENINGS = {
    "en": ["For the next clinician, ", "At handover, ", "For the next discussion, ", "Before the next conversation, "],
    "fi": ["Seuraavalle ammattilaiselle: ", "Hoidon siirrossa: ", "Seuraavaa keskustelua varten: ", "Ennen seuraavaa tapaamista: "],
    "sv": ["Till nästa kliniker: ", "Vid överlämningen: ", "Inför nästa samtal: ", "Före nästa möte: "],
}


def _expanded_mock_notes():
    wards = ["URO", "GER", "MED-A", "MED-B", "ED", "SURG", "ICU", "PHC-N", "PHC-S"]
    notes = []
    for theme_index, translations in enumerate(PRACTICE_EXAMPLES.values()):
        for quarter in range(4):
            for language_index, (language, text) in enumerate(translations.items()):
                month_index = 2025 * 12 + 9 + quarter * 3 + language_index
                month = f"{month_index // 12:04d}-{month_index % 12 + 1:02d}"
                ward = wards[(theme_index * 2 + quarter + language_index) % len(wards)]
                notes.append((language, month, ward, MOCK_OPENINGS[language][quarter] + text[0].lower() + text[1:]))
    notes.extend(SEED_NOTES[9:12])
    notes.append(("en", "2026-09", "ED", "If fever persists, I would switch to ceftriaxone because earlier resistance was reported."))
    return notes


SEED_NOTES = _expanded_mock_notes()
SEED_NOTES += [
    ("en", "2026-08", "URO", "I think this is a urinary tract infection with Escherichia coli."),
    ("fi", "2026-08", "MED-A", "Epäilen virtsatieinfektiota, Escherichia coli on mainittu."),
    ("sv", "2026-09", "GER", "Jag tror att det är en urinvägsinfektion med Escherichia coli."),
    ("en", "2026-08", "URO", "Because earlier Escherichia coli survived ampicillin."),
    ("fi", "2026-08", "MED-A", "Koska aiempi Escherichia coli oli resistentti ampisilliinille."),
    ("sv", "2026-09", "GER", "Eftersom Escherichia coli tidigare var resistent mot ampicillin."),
    ("en", "2026-08", "URO", "I'll start nitrofurantoin because local laboratory results were considered."),
    ("fi", "2026-08", "MED-A", "Aloitan nitrofurantoiinin koska paikalliset laboratoriotulokset tukevat valintaa."),
    ("sv", "2026-09", "GER", "Jag börjar med nitrofurantoin eftersom lokala laboratorieresultat beaktades."),
]
STATEMENT_LABELS = {"thinks": "THINKS", "because": "BECAUSE", "decided": "DECIDED", "if_then": "IF → THEN"}


@lru_cache(maxsize=1)
def _organisms():
    return {i["organism"] for rows in data.source()["isolates"].values() for i in rows}


def _safe(shared):
    """Explicit field/value whitelist, never a general text redaction heuristic."""
    if not isinstance(shared, dict): return None
    wards = data.source()["wards"]
    ward, month = shared.get("ward"), shared.get("month", "")
    if ward not in wards or not isinstance(month, str) or not re.fullmatch(r"20\d\d-(?:0[1-9]|1[0-2])", month): return None
    out = {"ward": ward, "month": month, "language": shared.get("language") if shared.get("language") in LANGUAGES else "en",
           "uncertainty": shared.get("uncertainty") if shared.get("uncertainty") in ("reported", "uncertain", "conditional") else "reported",
           "has_reason": shared.get("has_reason") is True}
    for key, allowed in {"sample": ("urine", "blood", "wound"), "age_band": ("65+", "under 65"), "sex": ("M", "F")}.items():
        if shared.get(key) in allowed: out[key] = shared[key]
    organism = shared.get("organism")
    if organism in _organisms(): out["organism"] = organism
    if shared.get("practice") in narrative.PRACTICES:
        out.update(kind="handover practice", practice=shared["practice"], practice_reason=shared.get("practice_reason") is True)
        out["statement_mode"] = shared.get("statement_mode") if shared.get("statement_mode") in ("thinks", "decided", "if_then") else "decided"
        if shared.get("trigger") in narrative.TRIGGER_LABELS: out["trigger"] = shared["trigger"]
    elif shared.get("kind") in ("decision", "if-then") and shared.get("drug") in narrative.DRUG_NAME and shared.get("decision") in DECISIONS:
        out.update(kind=shared["kind"], drug=shared["drug"], decision=shared["decision"], has_reason=shared.get("has_reason") is True)
        out["reasons"] = sorted({r for r in shared.get("reasons", []) if r in REASONS})
        if shared.get("trigger") in narrative.TRIGGER_LABELS: out["trigger"] = shared["trigger"]
        if shared.get("condition") in narrative.CONDITIONS: out["condition"] = shared["condition"]
        if shared.get("resistance") in narrative.FLAGS: out["resistance"] = shared["resistance"]
    elif shared.get("kind") == "ward observation":
        out["kind"] = "ward observation"
        if shared.get("resistance") in narrative.FLAGS: out["resistance"] = shared["resistance"]
    elif shared.get("kind") == "clinical impression" and shared.get("condition") in narrative.CONDITIONS:
        out.update(kind="clinical impression", condition=shared["condition"], reasons=sorted({r for r in shared.get("reasons", []) if r in REASONS}))
    elif shared.get("kind") == "stated rationale":
        reasons = sorted({r for r in shared.get("reasons", []) if r in REASONS})
        if not reasons: return None
        out.update(kind="stated rationale", reasons=reasons)
        if shared.get("drug") in narrative.DRUG_NAME: out["drug"] = shared["drug"]
    else: return None
    return out


def _seed():
    entries = []
    for number, (language, month, ward, text) in enumerate(SEED_NOTES, 1):
        # Temporary context for de-identification only; never commit a fake patient.
        facts = narrative.parse(text, language)
        context = {"ward": ward, "asof": month + "-15", "lang": language}
        patient = {"id": "illustration-only", "birth_year": "1950", "sex": "F", "history": [{"spec": "urine"}]}
        shared, _ = narrative.deidentify(facts, patient, context)
        for item, row in enumerate(shared):
            safe = _safe(row)
            if safe:
                # Illustrations have no demographic claim or fabricated patient row.
                for key in ("sex", "age_band", "sample"): safe.pop(key, None)
                entries.append({"id": f"demo-{number:02d}-{item + 1}", "note_id": f"demo-note-{number:02d}",
                                "source": "illustrative", "demo": True, "shared": safe})
    return {"version": 1, "seed_version": 4, "entries": entries}


def _write(document):
    STORE.parent.mkdir(parents=True, exist_ok=True)
    temporary = STORE.with_suffix(".tmp")
    temporary.write_text(json.dumps(document, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(STORE)


def _load():
    if not STORE.exists():
        document = _seed(); _write(document); return document
    document = json.loads(STORE.read_text(encoding="utf-8"))
    if document.get("version") != 1 or not isinstance(document.get("entries"), list):
        raise ValueError("The local knowledge store has an unsupported format; its contents were preserved")
    if document.get("seed_version", 0) < 4:
        # Re-extract only our illustrative examples after a parser correction.
        # Actual contributions are retained; no private notes are re-read.
        actual = [entry for entry in document["entries"] if entry.get("source") != "illustrative"]
        document = _seed(); document["entries"].extend(actual); _write(document)
    return document


def record(shared):
    """Append one anonymous contribution; the only argument is generalized facts."""
    safe = [row for item in shared if (row := _safe(item))]
    if not safe: return None
    note_id = "note-" + uuid.uuid4().hex[:16]
    with LOCK:
        document = _load()
        for index, row in enumerate(safe, 1):
            document["entries"].append({"id": f"{note_id}-{index}", "note_id": note_id, "source": "committed", "demo": False, "shared": row})
        _write(document)
    dashboard()  # refresh the derived RDF store after the durable contribution
    return note_id


def _node_id(kind, key):
    return kind + "-" + hashlib.sha256((kind + "|" + key).encode()).hexdigest()[:12]


def dashboard():
    """An inspectable graph, with occurrence provenance on every node and edge."""
    with LOCK: stored = list(_load()["entries"])
    wards = data.source()["wards"]
    nodes, edges, entries = {}, {}, []
    for record_ in stored:
        shared = _safe(record_.get("shared"))
        if not shared: continue
        entry_id = record_.get("id", "")
        note_id = record_.get("note_id", "")
        # Persisted provenance is generated here, never accepted as patient input.
        if not re.fullmatch(r"(?:demo-\d{2,3}-\d+|note-[0-9a-f]{16}-\d+)", entry_id): continue
        if not re.fullmatch(r"(?:demo-note-\d{2,3}|note-[0-9a-f]{16})", note_id): continue
        source = "illustrative" if record_.get("source") == "illustrative" else "committed"
        concept_ids, edge_ids = [], []

        def node(kind, key, label, description=""):
            ident = "statement-" + key if kind == "statement" else _node_id(kind, key)
            if ident not in nodes:
                nodes[ident] = {"id": ident, "label": label, "type": kind, "description": description or label, "entry_ids": []}
            if entry_id not in nodes[ident]["entry_ids"]: nodes[ident]["entry_ids"].append(entry_id)
            if ident not in concept_ids: concept_ids.append(ident)
            return ident

        def edge(left, right, label):
            ident = "edge-" + hashlib.sha256((left + "|" + label + "|" + right).encode()).hexdigest()[:12]
            if ident not in edges: edges[ident] = {"id": ident, "source": left, "target": right, "label": label, "entry_ids": []}
            if entry_id not in edges[ident]["entry_ids"]: edges[ident]["entry_ids"].append(entry_id)
            edge_ids.append(ident)

        practice = narrative.PRACTICES.get(shared.get("practice"))
        if practice:
            when, then = practice["condition"], practice["action"]
            why = practice["reason"] if shared.get("practice_reason") else ""
            key = shared["practice"]
            if shared.get("statement_mode") == "if_then":
                when = narrative.TRIGGER_LABELS.get(shared.get("trigger"), "Condition not generalized")
                key += ":if:" + (shared.get("trigger") or "unrecognized")
        elif shared["kind"] in ("decision", "if-then"):
            when = (narrative.TRIGGER_LABELS.get(shared.get("trigger"), "Condition not generalized") if shared["kind"] == "if-then"
                    else shared.get("condition") or "Drug decision in the recorded context")
            then = DECISIONS[shared["decision"]] + " " + narrative.DRUG_NAME[shared["drug"]]
            why = "; ".join(REASONS[r] for r in shared.get("reasons", [])) if shared.get("has_reason") else ""
            key = when
        elif shared["kind"] == "clinical impression":
            when = "Considering " + shared["condition"]
            then = "Clinical impression recorded"
            why = "; ".join(REASONS[r] for r in shared.get("reasons", [])) if shared.get("has_reason") else ""
            key = shared["condition"]
        elif shared["kind"] == "stated rationale":
            when, then = "A stated rationale was recorded", "Reason recorded for the next clinician"
            why = "; ".join(REASONS[r] for r in shared["reasons"])
            key = "stated_rationale"
        else:
            when, then, why, key = "A ward pattern was mentioned", "Review the reported ward pattern", "", "ward_pattern"
        condition_node = node("condition", key, when)
        action_node = node("action", then, then, "Action described in a note; not a recommendation or validated rule.")
        edge(condition_node, action_node, "recorded action")
        if practice:
            question_node = node("question", shared["practice"], practice["question"], "An organizing question for this handover theme; not a verbatim patient question.")
            edge(condition_node, question_node, "framed by")
        if why:
            # Keep separate reason concepts for drug decisions as well.
            reason_labels = [why] if practice else [REASONS[r] for r in shared.get("reasons", [])]
            for reason in reason_labels:
                reason_node = node("reason", reason, reason, "Generalized stated rationale, not a proven cause.")
                edge(action_node, reason_node, "because")
        ward_node = node("ward", shared["ward"], wards[shared["ward"]]["ward_en"])
        edge(action_node, ward_node, "reported on")
        for kind, key_, label in [("drug", shared.get("drug"), narrative.DRUG_NAME.get(shared.get("drug"))),
                                  ("organism", shared.get("organism"), shared.get("organism")),
                                  ("resistance", shared.get("resistance"), shared.get("resistance"))]:
            if key_:
                entity_node = node(kind, key_, label)
                edge(action_node, entity_node, "mentions")
        primary = (shared.get("statement_mode", "decided") if practice else "thinks" if shared["kind"] in ("clinical impression", "ward observation") else "because" if shared["kind"] == "stated rationale"
                   else "if_then" if shared["kind"] == "if-then" else "decided")
        statement_types = [primary] + (["because"] if why and primary != "because" else [])
        for statement in statement_types:
            statement_node = node("statement", statement, STATEMENT_LABELS[statement], "Type of an attributed statement, not a verified clinical fact.")
            edge(action_node, statement_node, "recorded as")
        entry = {"id": entry_id, "note_id": note_id, "language": shared["language"], "month": shared["month"],
                        "ward": shared["ward"], "ward_name": wards[shared["ward"]]["ward_en"], "source": source, "demo": source == "illustrative",
                        "summary": f"{when}. {then}." + (f" Reason given: {why}." if why else " Stated rationale not generalized." if shared.get("has_reason") else " No explicit rationale captured."),
                        "if": when, "then": then, "why": why, "uncertainty": shared["uncertainty"], "conditional": primary == "if_then",
                        "statement_type": primary, "statement_types": statement_types,
                        "thinks": when if primary == "thinks" else "", "because": why, "decided": then if primary == "decided" else "",
                        "reason_status": "generalized" if why else "not_generalized" if shared.get("has_reason") else "not_stated",
                        "concept_ids": concept_ids, "tags": concept_ids, "edge_ids": edge_ids}
        if source == "illustrative":
            number = int(note_id.rsplit("-", 1)[-1])
            if 1 <= number <= len(SEED_NOTES): entry["source_text"] = SEED_NOTES[number - 1][3]
        entries.append(entry)
    for group in (nodes, edges):
        for row in group.values(): row["count"] = len(row["entry_ids"])
    entries.sort(key=lambda row: (row["month"], row["id"]), reverse=True)
    counts = Counter(row["source"] for row in entries)
    groups = [("question", "Questions"), ("condition", "Context"), ("action", "Actions"), ("reason", "Reasons and reported effects"),
              ("drug", "Medicines"), ("organism", "Bacteria"), ("ward", "Wards"), ("resistance", "Resistance terms")]
    tree = []
    for kind, label in groups:
        children = sorted((dict(row, children=[]) for row in nodes.values() if row["type"] == kind), key=lambda row: row["label"])
        provenance = sorted({entry for child in children for entry in child["entry_ids"]})
        tree.append({"id": "tags-" + kind, "label": label, "type": kind, "count": len(provenance), "entry_ids": provenance, "children": children})
    statement_tree = []
    for statement, label in STATEMENT_LABELS.items():
        provenance = {entry["id"] for entry in entries if statement in entry["statement_types"]}
        children = []
        for group in tree:
            leaves = []
            for leaf in group["children"]:
                linked = sorted(provenance.intersection(leaf["entry_ids"]))
                if linked: leaves.append(dict(leaf, count=len(linked), entry_ids=linked))
            if leaves:
                linked = sorted({entry for leaf in leaves for entry in leaf["entry_ids"]})
                children.append(dict(group, id="statement-" + statement + "-" + group["type"], count=len(linked), entry_ids=linked, children=leaves))
        statement_tree.append({"id": "statement-" + statement, "label": label, "type": "statement", "count": len(provenance), "entry_ids": sorted(provenance), "children": children})
    result = {"nodes": list(nodes.values()), "edges": list(edges.values()), "entries": entries, "tag_tree": tree, "statement_tree": statement_tree,
            "options": {"languages": [{"code": code, "label": label} for code, label in LANGUAGES.items()],
                        "wards": [{"code": code, "name": ward["ward_en"]} for code, ward in wards.items()],
                        "months": sorted({row["month"] for row in entries})},
            "summary": {"entries": len(entries), "contributions": len({row["note_id"] for row in entries}), "nodes": len(nodes), "edges": len(edges),
                        "illustrative": counts["illustrative"], "committed": counts["committed"], "languages": len({row["language"] for row in entries}),
                        "with_reason": sum(bool(row["why"]) for row in entries)},
            "meta": {"extraction": "Demo rule-based extraction", "storage": "Local sanitized demo store",
                     "normalization": "English, Finnish and Swedish phrases map to the same controlled concepts. Labels are shown in English.",
                     "limits": "Unsupported, negated or compound conditions are not generalized. Unrecognized or negated rationale clauses are not filled in from other parts of the note.",
                     "privacy": "No patient names, identifiers, authors, original patient sentences or exact dates are included. Dates are grouped by month. Only prewritten illustrative notes include their mock source text.",
                     "history": "New shared contributions persist locally across restarts. Older private notes and the earlier memory-only graph are not imported retrospectively.",
                     "interpretation": "These are generalized reports, not established clinical facts or treatment recommendations. Counts are mentions, not confidence or independent evidence.",
                     "seeds": "109 illustrative contributions across 12 months are prewritten variations, clearly separated from notes kept during this demo. Repetition is for exploration, not evidence of agreement."}}
    import knowledge_rdf
    result["meta"]["rdf"] = knowledge_rdf.sync(result, store=STORE.with_suffix(".ttl"))
    return result
