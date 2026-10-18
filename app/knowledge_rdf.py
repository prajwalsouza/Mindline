"""Local RDF projection of sanitized knowledge, queried with allowlisted SPARQL.

The JSON knowledge store remains canonical. RDF resources represent attributed
reports and their controlled tags, not clinical recommendations or proven facts.
No remote graph, Wikidata mapping, arbitrary SPARQL, or language model is used.
Standards: https://www.w3.org/TR/rdf11-concepts/
           https://www.w3.org/TR/sparql11-query/
           https://www.w3.org/TR/skos-reference/
"""
import hashlib
import json
import re
import threading
from pathlib import Path
from urllib.parse import quote

import rdflib
from rdflib import Graph, Literal, Namespace, RDF, RDFS, URIRef, XSD
from rdflib.namespace import SKOS, PROV

ML = Namespace("urn:mindline:vocab:")
RESOURCE = "urn:mindline:"
LOCK = threading.RLock()
_CACHE = {}
PREFIXES = """PREFIX ml: <urn:mindline:vocab:>
PREFIX skos: <http://www.w3.org/2004/02/skos/core#>
PREFIX prov: <http://www.w3.org/ns/prov#>
"""
COMMON = """  ?statement a ml:SourcedObservation ; ml:entryId ?entry_id ;
    ml:sourceKind ?source ; ml:language ?language ; ml:wardCode ?ward ; ml:month ?month .
  FILTER (!BOUND(?filter_source) || ?source = ?filter_source)
  FILTER (!BOUND(?filter_language) || ?language = ?filter_language)
  FILTER (!BOUND(?filter_ward) || ?ward = ?filter_ward)
  FILTER (!BOUND(?filter_month_from) || STR(?month) >= STR(?filter_month_from))
  FILTER (!BOUND(?filter_month_to) || STR(?month) <= STR(?filter_month_to))
"""


def _col(key, label, kind=None):
    return {"key": key, "label": label, **({"type": kind} if kind else {})}


TEMPLATES = {
    "understanding_reasons": {
        "label": "What reasons were recorded for checking understanding?",
        "description": "Follow each recorded action to its stated reason and source contribution.",
        "columns": [_col("action", "Recorded action"), _col("reason", "Reason given"), _col("language", "Language"),
                    _col("ward", "Ward"), _col("month", "Month"), _col("source", "Source")],
        "body": """SELECT DISTINCT ?entry_id ?note_id ?concept_id ?action ?reason ?language ?ward ?month ?source
WHERE {
""" + COMMON + """  ?statement ml:recordedAction ?action ; ml:statedReason ?reason ;
    ml:actionConcept ?concept ; prov:wasDerivedFrom ?note .
  ?concept ml:conceptId ?concept_id . ?note ml:noteId ?note_id .
  FILTER (CONTAINS(LCASE(STR(?action)), "understanding"))
}
ORDER BY DESC(?month) ?entry_id
LIMIT 200""",
        "explanation": "These are reasons stated in contributions, not proof that the action works. Illustrations and contributions kept during the demo are labeled separately."
    },
    "across_languages": {
        "label": "Which concepts recur across languages?",
        "description": "Find shared controlled concepts mentioned in at least two languages.",
        "columns": [_col("concept", "Shared concept"), _col("kind", "Tag group"), _col("languages", "Languages"),
                    _col("contributions", "Contributions", "number"), _col("occurrences", "Mentions", "number")],
        "body": """SELECT ?concept_id ?concept ?kind
  (GROUP_CONCAT(DISTINCT ?language; separator=", ") AS ?languages)
  (COUNT(DISTINCT ?note) AS ?contributions) (COUNT(DISTINCT ?statement) AS ?occurrences)
WHERE {
""" + COMMON + """  ?statement ml:mentionsConcept ?tag ; prov:wasDerivedFrom ?note .
  ?tag a skos:Concept ; ml:conceptId ?concept_id ; skos:prefLabel ?concept ; ml:kind ?kind .
  FILTER (?kind != "ward")
}
GROUP BY ?concept_id ?concept ?kind
HAVING (COUNT(DISTINCT ?language) >= 2)
ORDER BY DESC(?contributions) ?concept
LIMIT 200""",
        "explanation": "English, Finnish and Swedish phrases are normalized by the demo parser to controlled concept IDs. Repetition measures mentions, not agreement or independent evidence."
    },
    "over_time": {
        "label": "How did contributions accumulate over time?",
        "description": "Count distinct anonymous contributions and their extracted statements by month.",
        "columns": [_col("month", "Month"), _col("contributions", "Contributions", "number"),
                    _col("statements", "Extracted statements", "number"), _col("illustrative", "Illustrative statements", "number"),
                    _col("committed", "Kept during demo", "number")],
        "body": """SELECT ?month (COUNT(DISTINCT ?note) AS ?contributions)
  (COUNT(DISTINCT ?statement) AS ?statements)
  (SUM(IF(?source = "illustrative", 1, 0)) AS ?illustrative)
  (SUM(IF(?source = "committed", 1, 0)) AS ?committed)
WHERE {
""" + COMMON + """  ?statement prov:wasDerivedFrom ?note .
}
GROUP BY ?month
ORDER BY ?month
LIMIT 200""",
        "explanation": "Month is the reporting period stored in the sanitized contribution. Prewritten illustrations are distinguished from contributions kept during this demo. One contribution may contain several statements."
    },
    "conditional_statements": {
        "label": "Which if–then statements include a reason?",
        "description": "Inspect conditions, proposed actions and stated reasons together with their source.",
        "columns": [_col("condition", "If"), _col("action", "Recorded then"), _col("reason", "Because"),
                    _col("language", "Language"), _col("ward", "Ward"), _col("month", "Month"), _col("source", "Source")],
        "body": """SELECT DISTINCT ?entry_id ?note_id ?concept_id ?condition ?action ?reason ?language ?ward ?month ?source
WHERE {
""" + COMMON + """  ?statement a ml:ConditionalStatement ; ml:recordedCondition ?condition ;
    ml:recordedAction ?action ; ml:statedReason ?reason ; ml:actionConcept ?concept ; prov:wasDerivedFrom ?note .
  ?concept ml:conceptId ?concept_id . ?note ml:noteId ?note_id .
}
ORDER BY DESC(?month) ?entry_id
LIMIT 200""",
        "explanation": "If–then statements remain attributed reports with their conditions intact. The graph does not execute them or turn them into treatment recommendations."
    }
}


def _uri(kind, identifier):
    return URIRef(RESOURCE + kind + ":" + quote(str(identifier), safe="-_."))


def build_graph(snapshot):
    """Project only known fields from an already-sanitized dashboard snapshot."""
    graph = Graph()
    for name, namespace in (("ml", ML), ("skos", SKOS), ("prov", PROV), ("rdf", RDF), ("rdfs", RDFS), ("xsd", XSD)):
        graph.bind(name, namespace)
    scheme = _uri("scheme", "clinical-handover-tags")
    graph.add((scheme, RDF.type, SKOS.ConceptScheme))
    graph.add((scheme, SKOS.prefLabel, Literal("Controlled tags extracted from reported handover knowledge", lang="en")))
    graph.add((ML.SourcedObservation, RDFS.comment, Literal("An attributed report; not an established clinical fact or recommendation.", lang="en")))
    node_map = {}
    for node in snapshot.get("nodes", []):
        identifier, kind = str(node["id"]), str(node["type"])
        concept, group = _uri("concept", identifier), _uri("tag-group", kind)
        node_map[identifier] = (concept, kind)
        graph.add((group, RDF.type, SKOS.Concept))
        graph.add((group, SKOS.prefLabel, Literal(kind.title(), lang="en")))
        graph.add((group, SKOS.topConceptOf, scheme))
        graph.add((scheme, SKOS.hasTopConcept, group))
        graph.add((group, SKOS.inScheme, scheme))
        graph.add((concept, RDF.type, SKOS.Concept))
        graph.add((concept, SKOS.inScheme, scheme))
        graph.add((concept, SKOS.broader, group))
        graph.add((concept, SKOS.prefLabel, Literal(node["label"], lang="en")))
        graph.add((concept, ML.conceptId, Literal(identifier)))
        graph.add((concept, ML.kind, Literal(kind)))
        if node.get("description"):
            graph.add((concept, SKOS.scopeNote, Literal(node["description"], lang="en")))
    entry_map = {}
    for entry in snapshot.get("entries", []):
        statement, note = _uri("statement", entry["id"]), _uri("contribution", entry["note_id"])
        entry_map[entry["id"]] = statement
        graph.add((statement, RDF.type, ML.SourcedObservation))
        if entry.get("conditional") is True:
            graph.add((statement, RDF.type, ML.ConditionalStatement))
        # A contribution may carry both a thought and a stated rationale.
        # Conditional proposals remain distinct from actions already decided.
        types = entry.get("statement_types") or ([entry["statement_type"]] if entry.get("statement_type") else [])
        kind_classes = {"thinks": ML.ReportedThought, "because": ML.StatedRationale,
                        "decided": ML.RecordedDecision, "if_then": ML.ConditionalStatement}
        for kind in types:
            if kind not in kind_classes or (kind == "decided" and entry.get("conditional")): continue
            graph.add((statement, ML.statementKind, Literal(kind)))
            graph.add((statement, RDF.type, kind_classes[kind]))
        if entry.get("statement_type") in kind_classes:
            graph.add((statement, ML.primaryStatementKind, Literal(entry["statement_type"])))
        graph.add((statement, ML.conditional, Literal(entry.get("conditional") is True)))
        graph.add((statement, ML.entryId, Literal(entry["id"])))
        graph.add((statement, PROV.wasDerivedFrom, note))
        graph.add((note, RDF.type, PROV.Entity))
        graph.add((note, ML.noteId, Literal(entry["note_id"])))
        for key, predicate in (("language", ML.language), ("month", ML.month), ("ward", ML.wardCode),
                               ("source", ML.sourceKind), ("uncertainty", ML.uncertainty)):
            if key in entry:
                graph.add((statement, predicate, Literal(entry[key])))
        for key, predicate in (("if", ML.recordedCondition), ("then", ML.recordedAction), ("why", ML.statedReason)):
            if entry.get(key):
                graph.add((statement, predicate, Literal(entry[key], lang="en")))
        for key, predicate in (("thinks", ML.reportedThought), ("because", ML.statedBecause), ("decided", ML.recordedDecision)):
            if entry.get(key) and not (key == "decided" and entry.get("conditional")):
                graph.add((statement, predicate, Literal(entry[key], lang="en")))
        # Original text exists only for explicitly prewritten illustrations.
        # User-authored/private note text is never copied into the RDF store.
        if entry.get("source") == "illustrative" and entry.get("source_text"):
            graph.add((note, ML.illustrativeText, Literal(entry["source_text"], lang=entry.get("language", "en"))))
        for identifier in entry.get("concept_ids", []):
            if identifier not in node_map: continue
            concept, kind = node_map[identifier]
            graph.add((statement, ML.mentionsConcept, concept))
            if kind in ("condition", "action", "reason"):
                graph.add((statement, ML[kind + "Concept"], concept))
    # Reify aggregate graph links. Merely recording this relation does not assert
    # that a condition clinically implies an action or that a rationale is true.
    for edge in snapshot.get("edges", []):
        if edge["source"] not in node_map or edge["target"] not in node_map: continue
        claim = _uri("relation", edge["id"])
        graph.add((claim, RDF.type, RDF.Statement))
        graph.add((claim, RDF.type, ML.RecordedAssociation))
        graph.add((claim, RDF.subject, node_map[edge["source"]][0]))
        graph.add((claim, RDF.predicate, ML.recordedAssociation))
        graph.add((claim, RDF.object, node_map[edge["target"]][0]))
        graph.add((claim, RDFS.label, Literal(edge["label"], lang="en")))
        for identifier in edge.get("entry_ids", []):
            if identifier in entry_map:
                graph.add((claim, PROV.wasDerivedFrom, entry_map[identifier]))
    return graph


def _path(store):
    if store is not None: return Path(store)
    import knowledge
    return knowledge.STORE.with_suffix(".ttl")


def sync(snapshot, store=None):
    """Atomically persist RDF from supplied data, without calling dashboard()."""
    path = _path(store)
    payload = {key: snapshot.get(key, []) for key in ("nodes", "edges", "entries")}
    digest = hashlib.sha256(json.dumps(payload, ensure_ascii=False, sort_keys=True).encode("utf-8")).hexdigest()
    key = str(path.resolve())
    with LOCK:
        cached = _CACHE.get(key)
        if not cached or cached[0] != digest or not path.exists():
            graph = build_graph(payload)
            path.parent.mkdir(parents=True, exist_ok=True)
            temporary = path.with_suffix(path.suffix + ".tmp")
            temporary.write_text(graph.serialize(format="turtle"), encoding="utf-8")
            temporary.replace(path)
            # Bound cache size; temporary fixture stores must not grow it forever.
            if len(_CACHE) >= 8: _CACHE.clear()
            _CACHE[key] = (digest, graph)
        graph = _CACHE[key][1]
        return {"engine": "RDFLib " + rdflib.__version__, "triples": len(graph), "entries": len(payload["entries"]),
                "storage": "Local RDF store", "format": "Turtle"}


def questions():
    return {"questions": [{"id": key, "label": value["label"], "description": value["description"]} for key, value in TEMPLATES.items()],
            "mode": "Predefined questions compiled to local SPARQL SELECT queries"}


def _bindings(filters, snapshot):
    if filters is None: return {}
    if not isinstance(filters, dict): raise ValueError("Filters must be an object")
    allowed = {"source", "language", "ward", "month_from", "month_to"}
    if set(filters) - allowed: raise ValueError("Unsupported knowledge query filter")
    values = {key: value for key, value in filters.items() if value not in (None, "", "all")}
    for key, value in values.items():
        if not isinstance(value, str): raise ValueError("Filter values must be text")
        if key == "source" and value not in ("illustrative", "committed"): raise ValueError("Unknown contribution source")
        if key == "language" and value not in ("en", "fi", "sv"): raise ValueError("Unknown contribution language")
        if key == "ward" and value not in {entry["ward"] for entry in snapshot.get("entries", [])}: raise ValueError("Unknown ward")
        if key.startswith("month_") and not re.fullmatch(r"20\d\d-(?:0[1-9]|1[0-2])", value): raise ValueError("Month must be YYYY-MM")
    if values.get("month_from", "") > values.get("month_to", "9999-99"): raise ValueError("Start month must not be after end month")
    return {"filter_" + key: Literal(value) for key, value in values.items()}


def query(question, filters=None, snapshot=None, store=None):
    """Execute only a built-in SELECT query. Values are RDF-bound, never spliced."""
    if not isinstance(question, str) or question not in TEMPLATES:
        raise ValueError("Choose one of the available knowledge questions")
    if snapshot is None:
        import knowledge
        snapshot = knowledge.dashboard()
    bindings = _bindings(filters, snapshot)
    template = TEMPLATES[question]
    sparql = PREFIXES + template["body"]
    with LOCK:
        meta = sync(snapshot, store=store)
        graph = _CACHE[str(_path(store).resolve())][1]
        result = graph.query(sparql, initBindings=bindings)
        rows = []
        for row in result:
            values = {}
            for key, value in row.asdict().items():
                native = value.toPython()
                values[str(key)] = native if isinstance(native, (str, int, float, bool)) else str(value)
            rows.append(values)
    return {"question": {"id": question, "label": template["label"]}, "columns": template["columns"], "rows": rows,
            "sparql": sparql, "bindings": {key: str(value) for key, value in bindings.items()}, "explanation": template["explanation"],
            "meta": {**meta, "returned": len(rows), "limit": 200, "query_mode": "Allowlisted local SELECT"}}
