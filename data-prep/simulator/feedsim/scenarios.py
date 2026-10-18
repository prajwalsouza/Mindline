"""The case types and faults the simulator can generate, and the ready-made presets.

Codes follow data-prep/INCOMING-DATA-SCENARIOS.md. Each scenario says which generating mechanism it uses,
so a new scenario is usually a new combination of parameters rather than new code.
"""
from datetime import date, timedelta

# code: (label, mechanism, group, what it does, default params)
CATALOGUE = {
    "A1": ("Staged results", "delay", "Timing", "Culture received, organism a day or two later, S/R after that. Always on.", {}),
    "A2": ("Late backfill", "delay", "Timing", "One ward's results for a few days arrive a week late, all at once.", {"ward": "PHC-N", "day": 30, "days": 5, "late_days": 9}),
    "A3": ("Out of order", "reordering", "Timing", "A culture's own row arrives after its organism row (an orphan for a while).", {"rate": 0.01}),
    "A4": ("Feed outage", "delay", "Timing", "Nothing arrives from one ward for some days, then a burst.", {"ward": "PHC-S", "day": 45, "days": 4}),
    "A6": ("Duplicate batch", "duplication", "Timing", "The lab system resends an hourly batch.", {"rate": 0.02}),
    "B1": ("S/R corrected", "revision", "Revisions", "A result is first reported wrong (S↔R), then corrected 1–5 days later.", {"rate": 0.004}),
    "B2": ("Organism re-identified", "revision", "Revisions", "A preliminary organism name is later corrected (e.g. K. oxytoca → K. pneumoniae).", {"rate": 0.02}),
    "B5": ("Culture cancelled", "revision", "Revisions", "A mislabelled culture is delivered, then cancelled 1–3 days later.", {"rate": 0.005}),
    "C9": ("Wrong ward (valid code)", "valid-but-wrong", "Identity", "A culture is filed under another real ward. No check can catch it.", {"rate": 0.005}),
    "D1": ("Breakpoint change", "regime", "Structure", "A new EUCAST version from a date; some results for one drug flip S→R with no biological change.", {"day": 153, "drug": "CIP", "flip": 0.08, "label": "EUCAST 2027"}),
    "D2": ("New drug on the panel", "vocabulary", "Structure", "Temocillin starts being reported for Enterobacterales; the code is unknown to the lookup.", {"day": 120}),
    "D7": ("New specimen type", "vocabulary", "Structure", "Screening swabs appear (comes with F1).", {}),
    "D9": ("Broken file format", "vocabulary", "Structure", "One day's files arrive semicolon-separated (Finnish Excel style).", {"day": 70}),
    "E3": ("Biologically implausible", "content", "Content", "An expected-resistant pair (ARMD rules, e.g. Klebsiella–ampicillin) is reported S.", {"rate": 0.01}),
    "F1": ("Screening starts", "regime", "Practice", "A ward starts MRSA admission screening: many more cultures, a few more carriers.", {"ward": "SURG", "day": 100, "per_day": 6}),
    "G1": ("Outbreak", "real event", "Real events", "A cluster of cases sharing one resistance pattern on one ward.", {"ward": "ICU", "flag": "mrsa", "n": 12, "day": 80, "days": 30}),
    "G2": ("Slow drift", "real event", "Real events", "Resistance to one drug creeps up by extra points per year, on top of the trend already in the data.", {"drug": "TMP", "extra": 6}),
    "G6": ("Rate shift, same volume", "real event", "Real events", "On one ward the resistant share of a drug jumps while the number of cases stays normal.", {"ward": "ED", "drug": "CIP", "rise": 25, "day": 60, "days": 42}),
    "G7": ("Pseudo-outbreak", "look-alike", "Real events", "A contaminated lab batch: identical Pseudomonas results on several unrelated wards within days.", {"n": 9, "wards": 5, "day": 110, "days": 4}),
    "G3": ("First-ever CPE", "real event", "Real events", "One carbapenemase-producing Klebsiella: a single case is the signal.", {"ward": "MED-B", "day": 130}),
    "N": ("New cases after the data ends", "resampling", "New cases", "Brand-new cultures resampled from the same ward, weekday and season a year earlier, then moved along each drug's measured trend so they don't lag a year behind.", {}),
}

PRESETS = {
    "clean": {"label": "Clean", "about": "Only staged results. When everything is final it must equal the source exactly.", "on": ["A1"]},
    "realistic": {"label": "Realistic", "about": "What a normal feed looks like: delays, a few corrections, one outage, one late backfill, a breakpoint change, new cases.",
                  "on": ["A1", "A2", "A3", "A4", "A6", "B1", "B2", "D1", "E3", "N"]},
    "nasty": {"label": "Nasty", "about": "Every kind of trouble at once, at higher rates. Nothing should crash or be silently wrong.",
              "on": ["A1", "A2", "A3", "A4", "A6", "B1", "B2", "B5", "C9", "D1", "D2", "D7", "D9", "E3", "F1", "N"],
              "params": {"A3": {"rate": 0.04}, "A6": {"rate": 0.06}, "B1": {"rate": 0.02}, "B2": {"rate": 0.06}, "B5": {"rate": 0.02}, "C9": {"rate": 0.02}, "E3": {"rate": 0.04}}},
    "quiet": {"label": "Quiet", "about": "Realistic faults but no real events: anything a detector flags here is a false alarm.",
              "on": ["A1", "A2", "A3", "A4", "A6", "B1", "B2", "D1", "E3", "N"]},
    "demo": {"label": "Live demo", "about": "Realistic, plus one of each anomaly to catch: an outbreak, a slow drift, a rate shift and a first-ever CPE.",
             "on": ["A1", "A2", "A3", "A4", "A6", "B1", "B2", "D1", "E3", "N", "G1", "G2", "G3", "G6"]},
}


def default_recipe(preset="demo", start="2026-08-01", end="2027-01-31", seed=7):
    p = PRESETS[preset]
    return {"preset": preset, "start": start, "end": end, "seed": seed,
            "scenarios": {code: {**CATALOGUE[code][4], **p.get("params", {}).get(code, {})} for code in p["on"]}}


def catalogue_json():
    return [{"code": c, "label": v[0], "mechanism": v[1], "group": v[2], "about": v[3], "params": v[4]} for c, v in CATALOGUE.items()]


def day_to_date(recipe, day):
    """Scenario dates are given as days after the simulation start, so presets work for any window."""
    return date.fromisoformat(recipe["start"]) + timedelta(days=int(day))
