"""Measure how long real microbiology results take to become available, from the open MIMIC-IV demo.

Reads  data-prep/external/mimic-iv-demo/microbiologyevents.csv.gz  (download with fetch.py first)
Writes data-prep/outputs/mimic_delays.csv        delay quantiles per specimen group and result stage
       data-prep/outputs/mimic_delay_params.json  lognormal parameters the feed simulator can draw from
       data-prep/outputs/mimic_mess.json           counts of real-world messiness seen in the table

Delay = storetime (when the result was available, last known update) minus charttime (sample time).
MIMIC keeps only the LAST update per row, so these are time-to-final, not time-to-first-preliminary.
"""
import csv, gzip, json, math, statistics
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "external" / "mimic-iv-demo" / "microbiologyevents.csv.gz"
OUT = ROOT / "outputs"; OUT.mkdir(exist_ok=True)

# map MIMIC specimen labels onto the three specimen types in the Tyks dataset, plus screening
GROUP = {"URINE": "urine", "BLOOD CULTURE": "blood", "SWAB": "wound", "TISSUE": "wound", "ABSCESS": "wound",
         "FLUID RECEIVED IN BLOOD CULTURE BOTTLES": "blood", "MRSA SCREEN": "screening"}
ts = lambda s: datetime.fromisoformat(s) if s else None

rows = list(csv.DictReader(gzip.open(SRC, "rt", encoding="utf-8")))

def stage(r):
    if r["ab_name"]: return "3 susceptibility"
    if r["org_name"]: return "2 organism"
    return "1 no growth / test only"

delays = defaultdict(list)   # (group, stage) -> hours
weekday = defaultdict(list)  # sample weekday -> hours (all groups)
sample_hour, release_hour = Counter(), Counter()   # when in the day samples are taken, and when results are released
per_specimen = defaultdict(set)
mess = Counter()
for r in rows:
    g = GROUP.get(r["spec_type_desc"], "other")
    if not r["charttime"]: mess["sample has a date but no time"] += 1
    if not r["storetime"]: mess["result has no availability time"] += 1; continue
    t0 = ts(r["charttime"]) or ts(r["chartdate"]); t1 = ts(r["storetime"])
    h = (t1 - t0).total_seconds() / 3600
    if h < 0: mess["result available before the sample was taken"] += 1; continue
    delays[(g, stage(r))].append(h); delays[("all", stage(r))].append(h)
    weekday[t0.strftime("%a")].append(h)
    if r["charttime"]: sample_hour[t0.hour] += 1
    release_hour[t1.hour] += 1
    per_specimen[r["micro_specimen_id"]].add(r["storetime"])
    if r["interpretation"] == "I": mess["interpretation I (susceptible, increased exposure)"] += 1
    if r["ab_name"] and not r["interpretation"]: mess["antibiotic row without an interpretation"] += 1
    if r["dilution_comparison"].strip() in ("<=", ">="): mess["MIC censored (<= or >=)"] += 1
mess["specimens"] = len(per_specimen)
mess["specimens whose results became available at more than one time (staged)"] = sum(len(v) > 1 for v in per_specimen.values())
mess["rows"] = len(rows)

def q(xs, p): xs = sorted(xs); return xs[min(len(xs) - 1, int(p * len(xs)))]
table, params = [], {}
for (g, s), xs in sorted(delays.items()):
    if len(xs) < 10: continue
    logs = [math.log(max(x, .5)) for x in xs]
    row = {"specimen": g, "stage": s, "n": len(xs), "p10_h": round(q(xs, .1), 1), "median_h": round(q(xs, .5), 1),
           "p90_h": round(q(xs, .9), 1), "max_h": round(max(xs), 1),
           "within_1d": round(sum(x <= 24 for x in xs) / len(xs), 2), "within_3d": round(sum(x <= 72 for x in xs) / len(xs), 2),
           "within_7d": round(sum(x <= 168 for x in xs) / len(xs), 2)}
    table.append(row)
    params[f"{g}|{s}"] = {"n": len(xs), "log_mean": round(statistics.mean(logs), 3), "log_sd": round(statistics.pstdev(logs), 3)}

with open(OUT / "mimic_delays.csv", "w", newline="", encoding="utf-8") as fh:
    w = csv.DictWriter(fh, fieldnames=list(table[0])); w.writeheader(); w.writerows(table)
norm = lambda c: [round(c[h] / sum(c.values()), 4) for h in range(24)]
params["_sample_hour_share"] = norm(sample_hour)
params["_release_hour_share"] = norm(release_hour)
params["_weekday_median_h"] = {d: round(statistics.median(v), 1) for d, v in weekday.items() if len(v) >= 10}
(OUT / "mimic_delay_params.json").write_text(json.dumps(params, indent=2))
(OUT / "mimic_mess.json").write_text(json.dumps(dict(mess), indent=2))

for r in table: print(r)
print(json.dumps(params["_weekday_median_h"])); print(json.dumps(dict(mess), indent=1))
