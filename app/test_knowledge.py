"""Shared concepts must be multilingual, attributable and separate from patient text."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data-prep" / "simulator"))
import knowledge
import narrative


class KnowledgeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(); self.addCleanup(self.temp.cleanup)
        self.store = Path(self.temp.name) / "knowledge.json"
        change = patch.object(knowledge, "STORE", self.store); change.start(); self.addCleanup(change.stop)
        self.patient = {"id": "PRIVATE-PATIENT-123", "birth_year": "1950", "sex": "F", "history": [{"date": "2026-09-20", "spec": "urine"}]}
        self.context = {"ward": "URO", "asof": "2026-09-27"}

    def shared(self, text, language="en"):
        return narrative.deidentify(narrative.parse(text, language), self.patient, {**self.context, "lang": language})[0]

    def test_multilingual_seed_is_one_concept_with_occurrence_provenance(self):
        before = narrative.PATIENT_GRAPH.counts()
        view = knowledge.dashboard()
        family = next(n for n in view["nodes"] if n["label"] == narrative.PRACTICES["family_baseline"]["action"])
        entries = [e for e in view["entries"] if e["id"] in family["entry_ids"]]
        self.assertEqual({e["language"] for e in entries}, {"en", "fi", "sv"})
        self.assertEqual(family["count"], 12)
        self.assertEqual(view["summary"]["illustrative"], len(knowledge.SEED_NOTES))
        self.assertEqual(knowledge.dashboard()["summary"]["illustrative"], len(knowledge.SEED_NOTES))
        self.assertEqual(narrative.PATIENT_GRAPH.counts(), before)
        self.assertTrue(all(e["demo"] and e["source_text"] for e in view["entries"]))
        self.assertEqual(len(view["options"]["months"]), 12)
        self.assertIn("not confidence", view["meta"]["interpretation"])

    def test_commit_persists_generalization_without_patient_words(self):
        text = "Ask the daughter Anna Secret about confusion, because she knows the usual routine at 123 Private Street."
        facts = narrative.parse(text)
        shared = self.shared(text)
        result = narrative.commit(self.patient, facts, shared, self.context, "Dr Private Name")
        view = knowledge.dashboard(); exported = json.dumps(view)
        persisted = self.store.read_text(encoding="utf-8")
        for secret in ("PRIVATE-PATIENT-123", "Anna Secret", "123 Private Street", "Dr Private Name", text, "2026-09-27"):
            self.assertNotIn(secret, exported)
            self.assertNotIn(secret, persisted)
        actual = [e for e in view["entries"] if e["source"] == "committed"]
        self.assertEqual(len(actual), 1)
        self.assertEqual(actual[0]["note_id"], result["contribution"])
        self.assertEqual(actual[0]["month"], "2026-09")
        self.assertFalse(actual[0]["demo"])
        self.assertNotIn("source_text", actual[0])
        record = narrative.PATIENT_GRAPH.find([("Patient", self.patient["id"])])[0]
        self.assertEqual(record["text"], text)
        # The read path reloads the file, rather than relying on a memory-only graph.
        self.assertEqual(knowledge._load()["entries"][-1]["note_id"], result["contribution"])

    def test_no_rationale_is_invented_and_uncertainty_remains(self):
        knowledge.record(self.shared("Ask the daughter about possible confusion and the usual routine."))
        actual = [e for e in knowledge.dashboard()["entries"] if e["source"] == "committed"][0]
        self.assertEqual(actual["why"], "")
        self.assertEqual(actual["uncertainty"], "uncertain")
        self.assertIn("No explicit rationale", actual["summary"])

    def test_if_then_does_not_become_an_unconditional_fact(self):
        knowledge.record(self.shared("If ESBL is reported, I would switch to meropenem because earlier resistance was reported."))
        actual = [e for e in knowledge.dashboard()["entries"] if e["source"] == "committed"][0]
        self.assertEqual(actual["uncertainty"], "conditional")
        self.assertEqual(actual["if"], "ESBL in the stated condition")
        self.assertEqual(actual["then"], "Switch to meropenem")
        self.assertEqual(actual["why"], "Earlier resistance was reported")

    def test_store_accepts_only_controlled_fields_and_provenance(self):
        row = self.shared("Ask about medication and work shifts, because doses were missed.")[0]
        row.update(text="PRIVATE WORDS", patient_id="PRIVATE-ID", author="PRIVATE-DOCTOR", organism="PRIVATE ORGANISM", language="PRIVATE LANG")
        knowledge.record([row])
        text = self.store.read_text(encoding="utf-8")
        self.assertNotIn("PRIVATE", text)
        self.assertIsNone(knowledge.record([{**row, "ward": "PRIVATE WARD"}]))

    def test_optout_keeps_note_only_in_patient_record(self):
        facts = narrative.parse("Ask the daughter about confusion, because she knows the usual routine.")
        result = narrative.commit(self.patient, facts, [], self.context, "Doctor")
        self.assertIsNone(result["contribution"])
        self.assertFalse(self.store.exists())

    def test_reason_is_matched_only_inside_the_explicit_why_clause(self):
        text = "Earlier resistance was reported, so I will switch to meropenem because the conversation is over."
        knowledge.record(self.shared(text))
        actual = [e for e in knowledge.dashboard()["entries"] if e["source"] == "committed"][0]
        self.assertEqual(actual["why"], "")
        for text, language in [
            ("Ask about medication and work shifts, because the schedule was not a difficulty.", "en"),
            ("Kysy lääkkeen ottamisesta ja työvuoroista, koska annoksia ei jäänyt väliin työvuorojen vuoksi.", "fi"),
            ("Fråga om medicinen och arbetspassen, eftersom schemat inte gjorde det svårt att ta doser.", "sv"),
            ("Ask about medication and work shifts, because the patient mentioned their daughter.", "en"),
        ]:
            with self.subTest(text=text):
                rows = self.shared(text, language)
                self.assertTrue(rows)
                self.assertFalse(rows[0]["practice_reason"])

    def test_conditional_theme_comes_only_from_the_if_clause(self):
        examples = [
            ("If fever persists, I would switch to meropenem because ESBL was reported.", "Fever in the stated condition"),
            ("If the callback happens, I would switch to meropenem because ESBL was reported.", "Condition not generalized"),
            ("If fever does not settle, I would switch to meropenem because ESBL was reported.", "Condition not generalized"),
            ("If fever and ESBL are reported, I would switch to meropenem.", "Condition not generalized"),
        ]
        for text, expected in examples:
            with self.subTest(text=text):
                contribution = knowledge.record(self.shared(text))
                entry = next(e for e in knowledge.dashboard()["entries"] if e["note_id"] == contribution)
                self.assertEqual(entry["if"], expected)
                self.assertTrue(entry["conditional"])

    def test_negated_actions_are_not_published_as_positive_actions(self):
        for text, language in [
            ("Do not ask the daughter about confusion, because she knows the usual routine.", "en"),
            ("I would not switch to meropenem because earlier resistance was reported.", "en"),
            ("Älä kysy tyttäreltä sekavuudesta, koska hän tuntee tavallisen arjen.", "fi"),
            ("Fråga inte dottern om förvirring, eftersom hon känner vanliga rutiner.", "sv"),
        ]:
            with self.subTest(text=text):
                self.assertEqual(self.shared(text, language), [])

    def test_seed_upgrade_preserves_contributions_and_month_order(self):
        text = "Ask the daughter about confusion, because she knows the usual routine."
        first = knowledge.record(self.shared(text))
        self.context["asof"] = "2026-10-18"
        second = knowledge.record(self.shared(text))
        document = json.loads(self.store.read_text(encoding="utf-8"))
        document["seed_version"] = 1
        self.store.write_text(json.dumps(document), encoding="utf-8")
        view = knowledge.dashboard()
        actual = [e for e in view["entries"] if e["source"] == "committed"]
        self.assertEqual([e["note_id"] for e in actual], [second, first])
        self.assertEqual([e["month"] for e in actual], ["2026-10", "2026-09"])
        self.assertEqual(view["summary"]["illustrative"], len(knowledge.SEED_NOTES))
        self.assertEqual(knowledge.dashboard()["summary"]["committed"], 2)

    def test_statement_tree_preserves_thought_reason_decision_and_conditional(self):
        view = knowledge.dashboard()
        self.assertEqual([branch["id"] for branch in view["statement_tree"]],
                         ["statement-thinks", "statement-because", "statement-decided", "statement-if_then"])
        by_id = {entry["id"]: entry for entry in view["entries"]}
        for branch in view["statement_tree"]:
            self.assertTrue(branch["count"])
            self.assertEqual(branch["count"], len(set(branch["entry_ids"])))
            expected = branch["id"].removeprefix("statement-")
            self.assertTrue(all(expected in by_id[ident]["statement_types"] for ident in branch["entry_ids"]))
        conditional = [entry for entry in view["entries"] if entry["conditional"]]
        self.assertTrue(conditional)
        self.assertTrue(all("decided" not in entry["statement_types"] and entry["decided"] == "" for entry in conditional))
        thoughts = [entry for entry in view["entries"] if entry["statement_type"] == "thinks"]
        self.assertEqual({entry["language"] for entry in thoughts}, {"en", "fi", "sv"})
        self.assertTrue(all(entry["uncertainty"] == "uncertain" for entry in thoughts))
        self.assertTrue(self.store.with_suffix(".ttl").exists())

    def test_current_resistance_is_not_relabelled_as_earlier_resistance(self):
        contribution = knowledge.record(self.shared("I will switch to meropenem because the current isolate is resistant."))
        entry = next(e for e in knowledge.dashboard()["entries"] if e["note_id"] == contribution)
        self.assertEqual(entry["why"], "Resistance was reported")

    def test_all_eight_mock_themes_have_reasons_in_each_language(self):
        for practice, translations in knowledge.PRACTICE_EXAMPLES.items():
            for language, text in translations.items():
                with self.subTest(practice=practice, language=language):
                    shared = self.shared(text, language)
                    self.assertEqual(shared[0]["practice"], practice)
                    self.assertTrue(shared[0]["practice_reason"])

    def test_practice_condition_and_thought_are_not_unconditional_decisions(self):
        for text, expected in [
            ("If confusion returns, ask the daughter about the usual routine because she knows the baseline.", "if_then"),
            ("I think asking the daughter about confusion might help because she knows the usual routine.", "thinks"),
            ("For the next clinician, if fever persists, I'll start ceftriaxone.", "if_then"),
        ]:
            with self.subTest(text=text):
                contribution = knowledge.record(self.shared(text))
                entry = next(e for e in knowledge.dashboard()["entries"] if e["note_id"] == contribution)
                self.assertEqual(entry["statement_type"], expected)
                self.assertNotIn("decided", entry["statement_types"])
                self.assertEqual(entry["decided"], "")
                self.assertEqual(entry["conditional"], expected == "if_then")

    def test_check_negation_and_reason_drug_do_not_reverse_the_action(self):
        self.assertEqual(self.shared("Do not check whether the patient understood the follow-up plan, because they nodded but later asked when to return."), [])
        shared = self.shared("I'll start nitrofurantoin because earlier Escherichia coli survived ampicillin.")
        self.assertEqual(shared[0]["drug"], "NIT")
        contribution = knowledge.record(shared)
        entry = next(e for e in knowledge.dashboard()["entries"] if e["note_id"] == contribution)
        self.assertEqual(entry["decided"], "Start nitrofurantoin")
        self.assertEqual(entry["why"], "Earlier resistance was reported")


if __name__ == "__main__":
    unittest.main()
