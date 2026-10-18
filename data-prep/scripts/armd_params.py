"""Turn the Stanford ARMD files into two small inputs for the feed simulator.

Reads  data-prep/external/armd/microbiology_cultures_microbial_resistance.csv  (one row per earlier resistant result)
       data-prep/external/armd/implied_susceptibility_rules.csv
Writes data-prep/outputs/armd_params.json
  return_gap_days   How many days before a culture the same patient's earlier resistant result was (closest one).
                    The simulator uses it to decide when a returning patient with resistance comes back.
  intrinsic_pairs   Organism–drug pairs the rules mark "Resistant" (expected resistant), mapped to the Tyks codes.
                    The simulator uses them to inject biologically implausible "S" results (scenario E3).
"""
import csv, json
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
ARMD = ROOT / "external" / "armd"

closest = defaultdict(lambda: 10 ** 9)   # culture order -> days back to the closest earlier resistant result
rows = 0
with open(ARMD / "microbiology_cultures_microbial_resistance.csv", encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        rows += 1
        try: d = int(float(r["resistant_time_to_culturetime"]))
        except ValueError: continue
        if d >= 0: closest[r["order_proc_id_coded"]] = min(closest[r["order_proc_id_coded"]], d)
gaps = sorted(closest.values())
q = lambda p: gaps[min(len(gaps) - 1, int(p * len(gaps)))]
edges = [0, 7, 30, 90, 180, 365, 730, 1825, 10 ** 9]
hist = [sum(edges[i] <= g < edges[i + 1] for g in gaps) / len(gaps) for i in range(len(edges) - 1)]

# ARMD organism labels -> organisms in the Tyks dataset; ARMD drug names -> Tyks codes on the panel
ORG = {"CITROBACTER": ["Citrobacter freundii"], "KLEBSIELLA": ["Klebsiella pneumoniae", "Klebsiella oxytoca"],
       "Pseudomonas aeruginosa": ["Pseudomonas aeruginosa"]}
DRUG = {"Ampicillin": "AMP", "Ceftriaxone": "CRO"}
pairs = []
with open(ARMD / "implied_susceptibility_rules.csv", encoding="utf-8") as fh:
    for r in csv.DictReader(fh):
        if r["Rule"] == "Resistant" and r["Organism"] in ORG and r["Antibiotic"] in DRUG:
            pairs += [{"organism": o, "drug": DRUG[r["Antibiotic"]], "source_rule": f'{r["Organism"]} – {r["Antibiotic"]}: Resistant'} for o in ORG[r["Organism"]]]

out = {"source": "Stanford ARMD (Dryad doi:10.5061/dryad.jq2bvq8kp, v2025-10-22)", "resistance_rows": rows,
       "cultures_with_earlier_resistance": len(gaps),
       "return_gap_days": {"p10": q(.1), "p25": q(.25), "median": q(.5), "p75": q(.75), "p90": q(.9),
                           "bins": [{"from": edges[i], "to": edges[i + 1] if edges[i + 1] < 10 ** 9 else None, "share": round(h, 4)} for i, h in enumerate(hist)]},
       "intrinsic_pairs": pairs}
(ROOT / "outputs" / "armd_params.json").write_text(json.dumps(out, indent=2))
print(json.dumps(out, indent=1))
