"""Real SPARQL must query local sourced observations without implying clinical truth."""
import sys
import tempfile
import unittest
from pathlib import Path
from rdflib import Graph, Literal, RDF
from rdflib.namespace import SKOS, PROV

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data-prep" / "simulator"))
import knowledge_rdf as rdf


def fixture():
    nodes = [
        {"id": "condition-1", "type": "condition", "label": "Checking understanding of a follow-up plan"},
        {"id": "action-1", "type": "action", "label": "Check the person's understanding of the plan"},
        {"id": "reason-1", "type": "reason", "label": "Nodding may not show understanding"},
    ]
    entries = []
    for i, (language, month, source) in enumerate([("en", "2026-08", "illustrative"), ("fi", "2026-09", "illustrative"), ("sv", "2026-09", "committed")], 1):
        entries.append({"id": "entry-" + str(i), "note_id": "note-" + str(i), "language": language, "month": month,
                        "ward": "URO", "source": source, "if": nodes[0]["label"], "then": nodes[1]["label"],
                        "why": nodes[2]["label"] if i != 3 else "", "conditional": i == 2,
                        "uncertainty": "conditional" if i == 2 else "reported", "concept_ids": [n["id"] for n in nodes],
                        "source_text": "Safe prewritten illustration" if source == "illustrative" else "PRIVATE ORIGINAL TEXT"})
    return {"nodes": nodes, "entries": entries, "edges": [{"id": "edge-1", "source": "condition-1", "target": "action-1",
              "label": "recorded action", "entry_ids": [e["id"] for e in entries]}]}


class KnowledgeRdfTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = Path(self.temp.name) / "knowledge.ttl"
        self.snapshot = fixture()

    def query(self, question, filters=None):
        return rdf.query(question, filters, snapshot=self.snapshot, store=self.store)

    def test_persistent_rdf_preserves_conditional_source_and_never_asserts_relation(self):
        meta = rdf.sync(self.snapshot, store=self.store)
        graph = Graph().parse(self.store, format="turtle")
        self.assertEqual(len(graph), meta["triples"])
        statement = rdf._uri("statement", "entry-2")
        self.assertIn((statement, RDF.type, rdf.ML.ConditionalStatement), graph)
        self.assertIn((statement, PROV.wasDerivedFrom, rdf._uri("contribution", "note-2")), graph)
        condition, action = rdf._uri("concept", "condition-1"), rdf._uri("concept", "action-1")
        self.assertNotIn((condition, rdf.ML.recordedAssociation, action), graph)
        self.assertIn((rdf._uri("relation", "edge-1"), RDF.subject, condition), graph)
        self.assertTrue(list(graph.triples((action, SKOS.broader, None))))
        text = self.store.read_text(encoding="utf-8")
        self.assertNotIn("PRIVATE ORIGINAL TEXT", text)
        self.assertNotIn("wikidata", text.lower())
        self.assertIn("Safe prewritten illustration", text)

    def test_real_sparql_returns_reasons_and_preserves_missing_reason(self):
        answer = self.query("understanding_reasons")
        self.assertEqual({row["entry_id"] for row in answer["rows"]}, {"entry-1", "entry-2"})
        self.assertIn("SELECT DISTINCT", answer["sparql"])
        self.assertTrue(all(row["concept_id"] == "action-1" for row in answer["rows"]))
        self.assertEqual(len(self.query("conditional_statements")["rows"]), 1)

    def test_aggregate_queries_match_contributions_and_languages(self):
        answer = self.query("across_languages")
        self.assertEqual(len(answer["rows"]), 3)
        for row in answer["rows"]:
            self.assertEqual(set(row["languages"].split(", ")), {"en", "fi", "sv"})
            self.assertEqual(row["contributions"], 3)
        months = {row["month"]: row for row in self.query("over_time")["rows"]}
        self.assertEqual(months["2026-09"]["statements"], 2)
        self.assertEqual(months["2026-09"]["illustrative"], 1)
        self.assertEqual(months["2026-09"]["committed"], 1)

    def test_filters_are_bound_and_arbitrary_query_or_filter_is_rejected(self):
        answer = self.query("over_time", {"source": "committed", "month_from": "2026-09"})
        self.assertEqual(answer["rows"][0]["contributions"], 1)
        self.assertEqual(answer["bindings"]["filter_source"], "committed")
        self.assertEqual(self.query("understanding_reasons", {"language": "fi"})["rows"][0]["entry_id"], "entry-2")
        self.assertEqual(self.query("across_languages", {"language": "fi"})["rows"], [])
        for question in ("SELECT * WHERE {?s ?p ?o}", "SERVICE <https://example.org>", None):
            with self.assertRaises(ValueError): self.query(question)
        for filters in ({"query": "anything"}, {"ward": 'URO" } SERVICE'}, {"month_from": "2026-99"}, {"source": "unknown"}, {"month_from": "2026-10", "month_to": "2026-01"}):
            with self.assertRaises(ValueError): self.query("over_time", filters)

    def test_statement_types_keep_thought_rationale_decision_and_condition_distinct(self):
        entry = self.snapshot["entries"][1]
        entry.update(statement_types=["thinks", "because", "if_then", "decided"], statement_type="if_then",
                     thinks="A change was suspected", because=entry["why"], decided="Not an actual decision")
        graph = rdf.build_graph(self.snapshot)
        statement = rdf._uri("statement", entry["id"])
        for kind in (rdf.ML.ReportedThought, rdf.ML.StatedRationale, rdf.ML.ConditionalStatement):
            self.assertIn((statement, RDF.type, kind), graph)
        self.assertNotIn((statement, RDF.type, rdf.ML.RecordedDecision), graph)
        self.assertFalse(list(graph.triples((statement, rdf.ML.recordedDecision, None))))
        self.assertIn((statement, rdf.ML.statementKind, Literal("thinks")), graph)

    def test_sync_rebuilds_when_canonical_snapshot_changes(self):
        first = rdf.sync(self.snapshot, store=self.store)
        self.snapshot["entries"] = self.snapshot["entries"][:1]
        second = rdf.sync(self.snapshot, store=self.store)
        self.assertLess(second["triples"], first["triples"])
        graph = Graph().parse(self.store, format="turtle")
        self.assertFalse(list(graph.triples((rdf._uri("statement", "entry-2"), None, None))))
        self.assertEqual(self.query("across_languages")["rows"], [])


if __name__ == "__main__": unittest.main()
