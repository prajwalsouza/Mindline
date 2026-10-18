"""Ensure event matching does not credit unrelated or not-yet-observable signals."""
import sys
import unittest
from datetime import date
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'data-prep' / 'simulator'))
import detection_eval as de


class MatchingTests(unittest.TestCase):
    def setUp(self):
        self.event = dict(ward='URO', organism='E. coli', flag='ESBL', start=date(2025, 6, 1), end=date(2025, 6, 30),
                          floor=date(2025, 6, 4), until=date(2025, 7, 28), detectors=['cluster'], **{'from': date(2025, 6, 1)})
        self.alert = dict(day=date(2025, 6, 4), detector='cluster', key='pattern|2025-06-01', organism='E. coli', flag='ESBL',
                          wards=['URO'], ward_case_dates={'URO': ['2025-06-04']})

    def test_no_credit_before_first_observable_case(self):
        self.assertFalse(de.matches(self.event, dict(self.alert, day=date(2025, 6, 3))))

    def test_requires_matching_organism_and_event_ward_case(self):
        self.assertTrue(de.matches(self.event, self.alert))
        self.assertFalse(de.matches(self.event, dict(self.alert, organism='K. pneumoniae')))
        self.assertFalse(de.matches(self.event, dict(self.alert, ward_case_dates={'URO': ['2025-05-30']})))

    def test_growth_update_can_match_an_existing_episode(self):
        early = dict(self.alert, day=date(2025, 5, 30), ward_case_dates={'URO': ['2025-05-30']})
        alerts = [early, self.alert]
        episodes = de.episodes(alerts)
        self.assertEqual(len(episodes), 1)
        self.assertEqual(episodes[0]['followups'], 1)
        self.assertEqual(dict(de.score([self.event], episodes, alerts)), {})
        self.assertEqual(self.event['result']['cluster']['delay_from_floor'], 0)

    def test_same_pattern_in_new_chain_is_new_episode(self):
        next_chain = dict(self.alert, key='pattern|2025-06-20', day=date(2025, 6, 23))
        self.assertEqual(len(de.episodes([self.alert, next_chain])), 2)


if __name__ == '__main__':
    unittest.main()
