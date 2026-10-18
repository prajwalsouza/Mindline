"""Regression checks for preserving a clinician's stated rationale in demo notes."""
import unittest
import sys
from pathlib import Path
sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'data-prep' / 'simulator'))
import narrative


class NoteReasoningTests(unittest.TestCase):
    def test_explicit_reason_keeps_original_words(self):
        text = 'Ask about their routine, because the daughter noticed a change.'
        fact = narrative.parse(text)[0]
        self.assertEqual(fact['text'], text)
        self.assertEqual(fact['observation'], 'Ask about their routine')
        self.assertEqual(fact['reasoning'], 'the daughter noticed a change.')

    def test_no_reason_is_invented(self):
        fact = narrative.parse('Confusion noted today.')[0]
        self.assertIsNone(fact['reasoning'])
        self.assertEqual(fact['observation'], fact['text'])

    def test_languages_and_abbreviations(self):
        for text, expected in [
            ('Kysy tyttäreltä, koska hän tuntee potilaan.', 'hän tuntee potilaan.'),
            ('Fråga dottern, eftersom hon känner patienten.', 'hon känner patienten.'),
            ('Review E. coli results, because the earlier result differed.', 'the earlier result differed.'),
        ]:
            with self.subTest(text=text):
                facts = narrative.parse(text)
                self.assertEqual(len(facts), 1)
                self.assertEqual(facts[0]['reasoning'], expected)

    def test_patient_record_preserves_reason_and_isolation(self):
        pt = {'id': 'NOTE-TEST', 'history': [{'date': '2026-10-18'}]}
        facts = narrative.parse('Ask about the plan, because the patient had a question.')
        before = narrative.KNOWLEDGE_GRAPH.counts()
        narrative.commit(pt, facts, [], {'ward': 'URO'}, 'Demo clinician')
        rows = narrative.PATIENT_GRAPH.find([('Patient', 'NOTE-TEST')])
        self.assertEqual(rows[0]['fields']['reasoning'], 'the patient had a question.')
        self.assertEqual(rows[0]['fields']['author'], 'Demo clinician')
        self.assertEqual(narrative.PATIENT_GRAPH.find([('Patient', 'OTHER')]), [])
        self.assertEqual(narrative.KNOWLEDGE_GRAPH.counts(), before)


if __name__ == '__main__':
    unittest.main()
