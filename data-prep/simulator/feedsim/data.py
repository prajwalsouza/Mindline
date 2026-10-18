"""Load the three sources the simulator uses, once.

Tyks synthetic dataset  the records to replay, and the ward/season patterns new cases are resampled from
MIMIC-IV demo           how long results take (per specimen and stage), and what hour samples/results happen
Stanford ARMD           how long before a culture a returning patient's earlier resistance was; expected-resistant pairs
"""
import csv, json, math
from collections import defaultdict
from datetime import date
from functools import lru_cache
from pathlib import Path

PREP = Path(__file__).resolve().parents[2]            # data-prep/
REPO = PREP.parent
TYKS = REPO / "data" / "synthetic_microbiology_dataset"
OUT = PREP / "outputs"

CULTURE_COLS = ["culture_id", "patient_id", "age_years", "sample_date", "iso_year", "iso_week", "ward_code", "ward_fi", "ward_en",
                "ward_type", "institution", "admission_date", "specimen", "specimen_fi", "result", "n_isolates"]
ISOLATE_COLS = ["isolate_id", "culture_id", "isolate_no", "organism", "quantity", "esbl", "mrsa", "vre", "cpe"]
SUS_COLS = ["isolate_id", "culture_id", "organism", "antibiotic", "antibiotic_code", "antibiotic_fi", "result", "guideline"]
FLAGS = ["esbl", "mrsa", "vre", "cpe"]


def _read(name):
    with open(TYKS / name, encoding="utf-8", newline="") as fh:
        return list(csv.DictReader(fh))


@lru_cache(maxsize=1)
def source():
    cultures = _read("cultures.csv")
    for c in cultures: c["_date"] = date.fromisoformat(c["sample_date"])
    cultures.sort(key=lambda c: (c["_date"], c["culture_id"]))
    isolates = defaultdict(list)
    for i in _read("isolates.csv"): isolates[i["culture_id"]].append(i)
    sus = defaultdict(list)
    for s in _read("susceptibility.csv"): sus[s["isolate_id"]].append(s)
    patients = {p["patient_id"]: p for p in _read("patients.csv")}
    wards = {w["ward_code"]: w for w in _read("wards.csv")}
    antibiotics = {a["antibiotic_code"]: a for a in _read("antibiotics.csv")}

    by_ward_day = defaultdict(int)          # (ward, date) -> cultures sampled that day
    by_ward = defaultdict(list)             # ward -> cultures, date order
    last_seen = {}                          # patient -> last sample date, to measure how often patients return
    returning = 0
    resistant_dates = defaultdict(list)     # patient -> dates of cultures with a resistant phenotype flag
    for c in cultures:
        by_ward_day[(c["ward_code"], c["_date"])] += 1
        by_ward[c["ward_code"]].append(c)
        prev = last_seen.get(c["patient_id"])
        if prev and (c["_date"] - prev).days <= 365: returning += 1
        last_seen[c["patient_id"]] = c["_date"]
        if any(i[f] == "1" for i in isolates[c["culture_id"]] for f in FLAGS): resistant_dates[c["patient_id"]].append(c["_date"])
    return {
        "cultures": cultures, "isolates": isolates, "sus": sus, "patients": patients, "wards": wards, "antibiotics": antibiotics,
        "by_ward_day": by_ward_day, "by_ward": by_ward, "resistant_dates": resistant_dates,
        "start": cultures[0]["_date"], "end": cultures[-1]["_date"],
        "return_share": returning / len(cultures),
        "counts": {"patients": len(patients), "cultures": len(cultures), "isolates": sum(map(len, isolates.values())),
                   "susceptibility": sum(map(len, sus.values()))},
    }


@lru_cache(maxsize=1)
def mimic():
    return json.loads((OUT / "mimic_delay_params.json").read_text())


@lru_cache(maxsize=1)
def armd():
    return json.loads((OUT / "armd_params.json").read_text())


def sources_summary():
    """What each source is and exactly what the simulator takes from it (shown on the Sources panel)."""
    s, m, a = source(), mimic(), armd()
    mess = json.loads((OUT / "mimic_mess.json").read_text())
    med = lambda k: math.exp(m[k]["log_mean"])   # median of a lognormal
    return [
        {"id": "tyks", "name": "Tyks synthetic dataset", "kind": "Given by Tyks × Mylab",
         "facts": [f'{s["counts"]["cultures"]:,} cultures', f'{s["counts"]["isolates"]:,} isolates', f'{s["counts"]["susceptibility"]:,} S/R results',
                   f'{s["start"]:%d %b %Y} – {s["end"]:%d %b %Y}'],
         "uses": ["Records to replay as if they were arriving now",
                  "Ward, weekday and season patterns for brand-new cases",
                  "Templates for injected outbreaks and first-ever cases",
                  f'Returning patients: {s["return_share"]:.0%} of cultures come from a patient seen in the last year']},
        {"id": "mimic", "name": "MIMIC-IV demo", "kind": "Real US hospital · open licence",
         "facts": [f'{mess["rows"]:,} result rows', f'{mess["specimens"]:,} specimens', f'{mess["specimens whose results became available at more than one time (staged)"]} arrived in stages'],
         "uses": [f'Time to result per specimen and stage (urine S/R ≈ {med("urine|3 susceptibility"):.0f} h, blood no-growth ≈ {med("blood|1 no growth / test only"):.0f} h)',
                  "Hour of day samples are taken", "Hour of day the lab releases results (mostly 07–16)"]},
        {"id": "armd", "name": "Stanford ARMD", "kind": "Real US health system · Dryad",
         "facts": [f'{a["resistance_rows"]:,} earlier-resistance rows', f'{a["cultures_with_earlier_resistance"]:,} cultures with resistance history'],
         "uses": [f'When a returning patient with resistance comes back (median {a["return_gap_days"]["median"]} days)',
                  f'{len(a["intrinsic_pairs"])} expected-resistant organism–drug pairs, to inject implausible "S" results']},
    ]


@lru_cache(maxsize=32)
def trend(drug, organism="Escherichia coli", specimen="urine"):
    """Resistance trend in the supplied data: least-squares slope of the monthly resistant share, in points per year.
    The simulator uses it so the 'slow drift' event can simply continue what the data already shows."""
    src = source(); months = defaultdict(lambda: [0, 0])
    for c in src["cultures"]:
        if c["specimen"] != specimen: continue
        for i in src["isolates"][c["culture_id"]]:
            if i["organism"] != organism: continue
            for s in src["sus"][i["isolate_id"]]:
                if s["antibiotic_code"] == drug:
                    m = months[(c["_date"].year, c["_date"].month)]; m[0] += 1; m[1] += s["result"] == "R"
    pts = [((y - 2023) + (mo - .5) / 12, r / n) for (y, mo), (n, r) in sorted(months.items()) if n >= 20]
    if len(pts) < 6: return {"slope": 0.0, "last_share": 0.0, "months": len(pts)}
    mx = sum(p[0] for p in pts) / len(pts); my = sum(p[1] for p in pts) / len(pts)
    slope = sum((x - mx) * (y - my) for x, y in pts) / sum((x - mx) ** 2 for x, _ in pts)
    return {"slope": round(slope * 100, 2), "last_share": round(sum(p[1] for p in pts[-12:]) / len(pts[-12:]), 3), "months": len(pts)}
