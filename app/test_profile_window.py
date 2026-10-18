"""The profile's comparison window changes recent data, not the annual baseline."""
import sys
import unittest
from pathlib import Path
from datetime import date
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'data-prep' / 'simulator'))
import evidence


class ProfileWindowTests(unittest.TestCase):
    def test_window_changes_recent_cohort_only(self):
        for weeks in (2, 4, 8, 12):
            with self.subTest(weeks=weeks), patch.object(evidence, 'SRC', return_value={'end': date(2026, 9, 27)}), \
                 patch.object(evidence, 'ORDER', []), patch.object(evidence, 'ALERTS', []), \
                 patch.object(evidence, 'cohort', return_value=[]) as cohort:
                result = evidence.antibiogram(ward='URO', recent_weeks=weeks)
                self.assertEqual([call.args[1] for call in cohort.call_args_list], [365, 365, weeks * 7, 365])
                self.assertEqual(result['recent_weeks'], weeks)

    def test_rejects_unsupported_windows(self):
        for weeks in (0, -2, 3, 53, 'invalid'):
            with self.subTest(weeks=weeks), self.assertRaises(ValueError):
                evidence.antibiogram(recent_weeks=weeks)


if __name__ == '__main__':
    unittest.main()
