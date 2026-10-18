"""Overview data must preserve date boundaries and hide unreleased lab results."""
import sys
import unittest
from datetime import date, timedelta
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "data-prep" / "simulator"))
import overview


class OverviewTests(unittest.TestCase):
    def setUp(self):
        self.today = date(2026, 9, 27)
        self.src = {
            "start": date(2025, 1, 1), "end": self.today, "cultures": [], "isolates": {}, "sus": {},
            "patients": {"P1": {"sex": "M"}}, "wards": {"URO": {"ward_en": "Urology"}},
            "antibiotics": {"TMP": {"antibiotic": "trimethoprim"}},
        }

    def sample(self, key, days_ago, result="positive", **extra):
        self.src["cultures"].append({"culture_id": key, "patient_id": "P1", "age_years": "72",
                                     "ward_code": "URO", "specimen": "urine", "result": result,
                                     "_date": self.today - timedelta(days=days_ago), **extra})
        self.src["isolates"][key] = [{"isolate_id": "I" + key, "organism": "Escherichia coli", "esbl": "1"}]
        self.src["sus"]["I" + key] = [{"antibiotic_code": "TMP", "result": "R"}]

    def test_inclusive_365_day_window_excludes_future_and_old_samples(self):
        for key, days in [("old", 365), ("first", 364), ("today", 0), ("future", -1)]:
            self.sample(key, days)
        result = overview.overview(src=self.src)
        self.assertEqual([r["id"] for r in result["records"]], ["first", "today"])
        self.assertEqual(result["start"], "2025-09-28")
        self.assertEqual(result["total_records"], 2)
        self.assertFalse(result["truncated"])

    def test_historical_pending_samples_do_not_expose_future_tests(self):
        self.sample("waiting", 0)
        self.sample("identified", 1)
        self.sample("final", 3)
        waiting, identified, final = overview.overview(src=self.src)["records"]
        self.assertEqual(waiting["organisms"], [])
        self.assertEqual(identified["organisms"], ["Escherichia coli"])
        for row in [waiting, identified]:
            self.assertEqual(row["drugs"], [])
            self.assertEqual(row["flags"], [])
            self.assertIsNone(row["resistant"])
        self.assertEqual(final["drugs"][0]["name"], "trimethoprim")
        self.assertIn("extended-spectrum", final["flags"][0])
        self.assertEqual(final["ward_name"], "Urology")
        self.assertEqual(final["age"], 72)

    def test_feed_stage_overrides_sample_age_and_snapshot_never_uses_global_source(self):
        self.sample("received", 14, _feed=True, _status="received")
        self.sample("identified", 14, _feed=True, _status="organism")
        self.sample("final", 0, _feed=True, _status="final")
        result = overview.overview(src=self.src)
        self.assertEqual([r["status"] for r in result["records"]], ["waiting", "organism_known", "final"])
        self.assertEqual(result["summary"]["pending"], 2)
        self.assertEqual(result["summary"]["resistant"], 1)
        self.assertEqual(result["summary"]["patients"], 1)
        self.assertEqual(result["wards"][0]["samples"], 3)

    def test_negative_and_mixed_are_not_untested_susceptible_results(self):
        self.sample("negative", 5, result="negative")
        self.sample("mixed", 5, result="mixed_growth")
        result = overview.overview(src=self.src)
        for row in result["records"]:
            self.assertIsNone(row["resistant"])
            self.assertEqual(row["organisms"], [])
            self.assertEqual(row["drugs"], [])
        self.assertEqual(result["summary"]["tested"], 0)
        self.assertEqual(result["summary"]["negative"], 1)
        self.assertEqual(result["summary"]["mixed"], 1)


if __name__ == "__main__":
    unittest.main()
