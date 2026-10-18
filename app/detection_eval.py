"""How well do Mindline's detectors find real events? Measured, not demonstrated.

    python app/detection_eval.py              full run, writes the JSON results and app/DETECTION.md
    python app/detection_eval.py --quick      skips historical antibiogram snapshots (about 10 minutes locally)

Two replays, both day by day, each day seeing only the data known at the end of that day:
- the simulated live feed (feed.FEED, the app's demo run), scored against its ground truth FEED.run.truth_list;
- the supplied history (data/, Oct 2023 - Sep 2026), scored against the four events its brief documents
  (Antibiotic-Efficacy-Indicator-Design-Brief.md, section 3). Alerts matching none of those documented events are counted as unmatched, not established clinical false positives.

The detectors are the app's own, called unchanged from evidence.py and insights.py:
- ward      a ward crosses "above its usual": >= 3 new resistant cases in 4 weeks and z > 2 against its own previous 48 weeks
            (evidence._incidents kind "above", the Morning brief and Ward overview rule)
- poisson   the same counts, Poisson tail against the ward's own year, Benjamini-Hochberg across wards, "clear" only
            (insights.unusual_wards)
- cluster   same organism, resistance types and fingerprint, >= 3 cases with <= 14-day gaps, newly formed or grown
            (evidence._clusters via evidence._incidents kinds "cluster" / "grew")
- first     first-ever resistance type on a ward (evidence._incidents kind "first")
- gap       a ward that usually sends >= 5 samples a day sent none (evidence._incidents kind "gap")
- late      >= 5 susceptibility results on a ward arrived more than 10 days after sampling (evidence._incidents kind "late")
- abg       the doctor's antibiogram marks a drug "changed" (recent 4 weeks vs year, z > 2.5, >= 10 tested;
            evidence.antibiogram), per ward x specimen (urine, blood, wound)
"""
import argparse, json, sys, time
from collections import defaultdict
from datetime import date, timedelta
from pathlib import Path

HERE = Path(__file__).resolve().parent
SIM = HERE.parent / "data-prep" / "simulator"
sys.path.insert(0, str(SIM)); sys.path.insert(0, str(HERE))
from feedsim import data          # noqa: E402
from feed import FEED             # noqa: E402
import evidence, insights         # noqa: E402

OUT = HERE / "static" / "demo" / "detection.json"
SPECS = ("urine", "blood", "wound")
DETECTORS = ["ward", "poisson", "cluster", "first", "gap", "late", "abg"]
MERGE_DAYS = 3                     # gap or late alerts on one ward this close together are one episode (spans a weekend)
BASELINE_DAYS = 365 + 28           # the ward rule needs a full baseline year before its first 4-week window


# ---------------------------------------------------------------- the data known on a day
def trimmed(v, day, days=366):
    """The same view with only the cultures the antibiogram can look at (it never reads further back than a year)."""
    cs, lo = v["cultures"], day - timedelta(days=days)
    a, b = 0, len(cs)
    while a < b:                                   # cultures are in date order
        m = (a + b) // 2
        if cs[m]["_date"] < lo: a = m + 1
        else: b = m
    return dict(v, cultures=cs[a:])


def antibiogram_changes(v, day, wards):
    """(ward, spec, drug, direction) for every drug the antibiogram marks changed on that day."""
    tv = trimmed(v, day)
    out = set()
    for w in wards:
        for s in SPECS:
            for x in evidence.antibiogram(ward=w, spec=s, asof=str(day), src=tv)["drugs"]:
                if x["changed"]: out.add((w, s, x["code"], "up" if x["recent"]["share"] < x["year"]["share"] else "down"))
    return out



def poisson_clear(ov):
    """Wards insights.unusual_wards calls 'clear' (BH-corrected Poisson tail, >= 3 cases), from the same overview."""
    ws = ov["wards"]
    if not any(w["recent"] >= 3 for w in ws): return set()
    ps = [insights.pois_sf(w["recent"], max(w["expected"], .25)) for w in ws]
    return {w["code"] for w, p, q in zip(ws, ps, insights.bh(ps)) if insights.sure(q, p, w["recent"] >= 3) == "clear"}


# ---------------------------------------------------------------- one replay
def replay(days, view, abg_daily_wards=(), abg_every=None, all_wards=()):
    """Every alert the detectors raise, day by day. Returns (alerts, snapshots); an alert is a dict with day, detector,
    ward and what identifies it; snapshots are the antibiogram's changed markers on every `abg_every`-th day."""
    ovc = {}
    def ov(d):
        if d not in ovc: ovc[d] = evidence.wards_overview(str(d), src=view(d))
        return ovc[d]
    alerts, snapshots = [], {}
    prev_pois = poisson_clear(ov(days[0] - timedelta(days=1)))
    prev_abg = antibiogram_changes(view(days[0] - timedelta(days=1)), days[0] - timedelta(days=1), abg_daily_wards) if abg_daily_wards else set()
    t0 = time.time()
    for n, d in enumerate(days):
        v = view(d)
        first_flag, cbd = evidence._index(v, d, d - timedelta(days=40))
        clusters = evidence._clusters(ov(d)["cases"], d)
        for i in evidence._incidents(d, first_flag, cbd, ov):
            k = i["kind"]
            if k == "above": alerts.append({"day": d, "detector": "ward", "ward": i["ward"], "n": i["n"], "expected": i["expected"]})
            elif k == "first": alerts.append({"day": d, "detector": "first", "ward": i["ward"], "flag": i["flag"]})
            elif k == "gap": alerts.append({"day": d, "detector": "gap", "ward": i["ward"], "usual": i["usual"]})
            elif k == "late": alerts.append({"day": d, "detector": "late", "ward": i["ward"], "n": i["n"]})
            elif k in ("cluster", "grew"):
                c = next(c for c in clusters if c["organism"] == i["organism"] and c["flags"][0] == i["flag"] and c["wards"] == i["wards"] and c["n"] == i["n"])
                alerts.append({"day": d, "detector": "cluster", "kind": k, "key": c["key"] + "|" + "|".join(c["flags"]) + "|" + c["first"],
                               "ward_case_dates": {w: sorted({x["date"] for x in ov(d)["cases"] if x["ward"] == w and x["short"] == c["organism"] and x["fp"] == c["fp"] and x["flags"] == c["flags"] and c["first"] <= x["date"] <= c["last"]}) for w in c["wards"]}, "organism": i["organism"],
                               "flag": i["flag"], "wards": i["wards"], "ward": i["wards"][0], "n": i["n"]})
        now = poisson_clear(ov(d))
        for w in sorted(now - prev_pois): alerts.append({"day": d, "detector": "poisson", "ward": w})
        prev_pois = now
        if abg_daily_wards:
            now = antibiogram_changes(v, d, abg_daily_wards)
            for w, s, drug, dirn in sorted(now - prev_abg): alerts.append({"day": d, "detector": "abg", "ward": w, "spec": s, "drug": drug, "dir": dirn})
            prev_abg = now
        if abg_every and n % abg_every == 0: snapshots[d] = antibiogram_changes(v, d, all_wards)
        for k in [k for k in ovc if k < d - timedelta(days=1)]: del ovc[k]
        if n % 30 == 29: print(f"  {d}  {n + 1}/{len(days)} days, {time.time() - t0:.0f}s", flush=True)
    return alerts, snapshots


def episodes(alerts):
    """Group alerts into episodes, the unit a person would count as 'one alert': a ward crossing above its usual, a new
    cluster (later growth of the same cluster is a follow-up), a first-ever type, or a run of gap/late days on one ward."""
    out, last, seen = [], {}, {}
    for a in sorted(alerts, key=lambda a: a["day"]):
        if a["detector"] == "cluster":
            if a["key"] in seen: seen[a["key"]]["followups"] += 1; seen[a["key"]]["updates"].append(a); continue
            e = dict(a, followups=0, updates=[a]); seen[a["key"]] = e; out.append(e)
        elif a["detector"] in ("gap", "late"):
            k = (a["detector"], a["ward"]); p = last.get(k)
            if p and (a["day"] - p["last"]).days <= MERGE_DAYS: p["last"] = a["day"]; p["days"] += 1; p["updates"].append(a); continue
            e = dict(a, last=a["day"], days=1, updates=[a]); last[k] = e; out.append(e)
        else:
            out.append(dict(a))
    return out


# ---------------------------------------------------------------- ground truth and matching
def matches(ev, a):
    """Does alert `a` belong to event `ev`? Same ward (and resistance type / drug where the event has one), the right
    kind of detector for the event's mechanism, inside the event's window."""
    if a["detector"] not in ev["detectors"] or not (max(ev["from"], ev["floor"]) <= a["day"] <= ev["until"]): return False
    if a["detector"] == "cluster":
        return (ev["ward"] in a["wards"] and a["flag"] == ev["flag"] and (not ev.get("organism") or a["organism"] == ev["organism"])
                and any(str(ev["start"]) <= d <= str(ev["end"]) for d in a.get("ward_case_dates", {}).get(ev["ward"], [])))
    if a["detector"] == "first": return a["ward"] == ev["ward"] and a["flag"] == ev["flag"]
    if a["detector"] == "abg": return a["ward"] == ev["ward"] and a["dir"] == "up" and (not ev.get("drug") or a["drug"] == ev["drug"])
    return a["ward"] == ev["ward"]


def feed_events(run):
    """The feed's ground truth, with the earliest day each event could be seen in the lab results (the fairer floor)."""
    known = defaultdict(list)
    for d in run.deliveries:
        for t in d["tags"]:
            if t in ("G1", "G3") and d["kind"] == "isolate final": known[t].append(d["known_at"].date())
            if t == "G6" and d["kind"] in ("susceptibility", "susceptibility corrected"): known[t].append(d["known_at"].date())
    out, skipped = [], []
    for t in run.truth_list:
        c = t["code"]; start = date.fromisoformat(t["start"]) if t.get("start") else None
        end = date.fromisoformat(t["end"]) if t.get("end") else start
        ev = {"code": c, "label": t["label"], "ward": t.get("ward"), "start": start, "end": end, "count": t.get("count")}
        if c == "G1":
            ks = sorted(known[c]); flag = t["label"].split()[0].upper()
            ev.update(flag=flag, organism="S. aureus", detectors=["ward", "poisson", "cluster", "abg"], until=end + timedelta(days=28),
                      floor=ks[0], floor_what="first outbreak case's resistance result reported", third=ks[2] if len(ks) > 2 else None)
        elif c == "G3":
            ev.update(flag="CPE", detectors=["first", "ward", "poisson", "cluster"], until=start + timedelta(days=28),
                      floor=min(known[c]), floor_what="the CPE result reported")
        elif c == "G6":
            ev.update(drug="CIP", detectors=["abg"], until=end + timedelta(days=28),
                      floor=min(known[c]), floor_what="first shifted CIP result reported")
        elif c in ("A4", "A2"):
            ev.update(detectors=["gap", "late"], until=end + timedelta(days=t.get("late_days", 0) + 3),
                      floor=start, floor_what="first affected day")
        else:
            why = {"G2": f"hospital-wide drift; only {t.get('count')} results flipped in 4 months, below what any detector here is built to see",
                   "A1": "every result is staged; not an event", "N": "the background cases; not an event"}.get(
                c, "a data-quality fault handled by the import checks, not by a surveillance detector")
            skipped.append({"code": c, "label": t["label"], "count": t.get("count"), "why": why}); continue
        ev["from"] = start
        out.append(ev)
    return out, skipped


def history_events(src):
    """The four events documented in the brief (month-level windows). The outbreak 'floor' is the first and third case of
    that type on that ward inside the window, by sample date: the history has no arrival times, so the replay sees
    results on the day of sampling (an optimistic ~3 days ahead of a real lab)."""
    def cases(ward, flag, lo, hi):
        out = []
        for c in src["cultures"]:
            if c["ward_code"] == ward and lo <= c["_date"] <= hi and any(i[flag] == "1" for i in src["isolates"][c["culture_id"]]): out.append(c["_date"])
        return sorted(out)
    out = []
    for code, label, ward, flag, lo, hi in [("H-URO", "ESBL E. coli outbreak on Urology (Jun 2025)", "URO", "esbl", date(2025, 6, 1), date(2025, 6, 30)),
                                            ("H-ICU", "MRSA outbreak on ICU (Mar 2026)", "ICU", "mrsa", date(2026, 3, 1), date(2026, 3, 31))]:
        cs = cases(ward, flag, lo, hi)
        out.append({"code": code, "label": label, "ward": ward, "flag": flag.upper(), "organism": "E. coli" if flag == "esbl" else "S. aureus", "start": lo, "end": hi, "count": len(cs), "from": lo,
                    "until": hi + timedelta(days=28), "detectors": ["ward", "poisson", "cluster"],
                    "floor": cs[0], "third": cs[2] if len(cs) > 2 else None, "floor_what": "first case in the window (sample date)"})
    lo, hi = date(2025, 12, 8), date(2025, 12, 14)
    out.append({"code": "H-GAP", "label": "Data-feed outage, Health centre South (week of 8 Dec 2025)", "ward": "PHC-S", "start": lo, "end": hi,
                "from": lo, "until": hi + timedelta(days=3), "detectors": ["gap"], "floor": lo, "floor_what": "first affected day"})
    skipped = [{"code": "H-TMP", "label": "E. coli trimethoprim drift 15% -> 20% over 3 years", "why": "slow hospital-wide drift; none of these detectors is a trend test (the brief's trend line is descriptive)"}]
    return out, skipped


def score(events, eps, alerts):
    """Per event and detector: first matching alert and its delays. Per detector: episodes matching no event."""
    for ev in events:
        ev["result"] = {}
        for det in ev["detectors"]:
            hit = next((a for a in sorted(alerts, key=lambda a: a["day"]) if a["detector"] == det and matches(ev, a)), None)
            r = {"detected": bool(hit)}
            if hit:
                r.update(day=str(hit["day"]), delay_from_start=(hit["day"] - ev["start"]).days, delay_from_floor=(hit["day"] - ev["floor"]).days)
                if ev.get("third"): r["delay_from_third_case"] = (hit["day"] - ev["third"]).days
                r["alert"] = {k: v for k, v in hit.items() if k not in ("day", "detector", "key")}
            ev["result"][det] = r
    false = defaultdict(list)
    for e in eps:
        if not any(matches(ev, a) for ev in events for a in e.get("updates", [e])): false[e["detector"]].append(e)
    return false


def snapshot_rate(snaps, explained, n_wards):
    """Antibiogram as a state, not an event: in how many ward-weeks does a doctor opening that ward see a 'changed' marker
    that no documented event explains?"""
    n = hits = markers = 0
    for d, ch in snaps.items():
        wards = defaultdict(list)
        for x in ch:
            if not explained(d, x): wards[x[0]].append(x)
        n += n_wards; hits += len(wards); markers += sum(len(v) for v in wards.values())
    return {"ward_weeks": n, "with_unexplained_marker": hits, "share": round(hits / n, 3) if n else None, "markers": markers,
            "markers_per_ward_week": round(markers / n, 2) if n else None}


# ---------------------------------------------------------------- report
def jsonable(x):
    if isinstance(x, dict): return {k: jsonable(v) for k, v in x.items()}
    if isinstance(x, (list, tuple, set)): return [jsonable(v) for v in x]
    if isinstance(x, date): return str(x)
    return x


def section(name, days, events, skipped, alerts, snaps, explained, n_wards):
    eps = episodes(alerts)
    false = score(events, eps, alerts)
    ww = len(days) / 7 * n_wards
    rates = {det: {"false_alerts": len(false.get(det, [])), "per_100_ward_weeks": round(100 * len(false.get(det, [])) / ww, 2),
                   "matched_episodes": sum(1 for e in eps if e["detector"] == det) - len(false.get(det, []))} for det in DETECTORS}
    return {"name": name, "first": str(days[0]), "last": str(days[-1]), "days": len(days), "wards": n_wards, "ward_weeks": round(ww, 1),
            "events": events, "not_evaluated": skipped, "false_alert_rates": rates,
            "false_alerts": {det: v for det, v in false.items()}, "alerts": alerts, "abg_snapshots": snapshot_rate(snaps, explained, n_wards) if snaps else None}


def write_report(out):
    lines = ["# Detection evaluation", "", "Measured on the supplied synthetic history and the default simulated feed (seed 11). These are prototype replay results, not clinical validation.", "",
             "Run `python app/detection_eval.py --quick` to reproduce the required event/alert evaluation. Omit `--quick` to also measure weekly historical antibiogram markers (slower).",
             "", "## Event detection", "", "Delay is measured from the scenario start and from the first observable lab result. Historical results are assumed available on their sample date because arrival timestamps are absent.", ""]
    names = {"ward": "Ward above usual", "poisson": "Poisson/BH clear", "cluster": "Cluster", "first": "First type", "gap": "Data gap", "late": "Late batch", "abg": "Antibiogram change"}
    for key in ("feed", "history"):
        s = out[key]
        lines += [f"### {s['name']}", "", f"{s['first']} to {s['last']}; {s['ward_weeks']} ward-weeks.", "",
                  "| Event | Detector | First flag | Days from start | Days from first observable result |", "|---|---|---|---:|---:|"]
        for e in s["events"]:
            for det, r in e["result"].items():
                lines.append(f"| {e['label']} | {names[det]} | {r.get('day', 'Not detected')} | {r.get('delay_from_start', '—')} | {r.get('delay_from_floor', '—')} |")
        lines += ["", "| Detector | Unmatched episodes | Per 100 ward-weeks |", "|---|---:|---:|"]
        for det, r in s["false_alert_rates"].items():
            if r is not None: lines.append(f"| {names[det]} | {r['false_alerts']} | {r['per_100_ward_weeks']} |")
        lines += ["", "Not evaluated: " + "; ".join(f"{e['code']}: {e['why']}" for e in s['not_evaluated']) + ".", ""]
    lines += ["## Interpretation and limitations", "",
              "- **Unmatched is not the same as false.** The supplied history contains documented planted outbreaks, a sampling outage and a slow drift. Other real-looking changes are not exhaustively labelled. The JSON field `false_alerts` retains the original evaluator name; the report calls these unmatched episodes.",
              "- The history spans three years, but scoring begins after 393 days needed for the full baseline. Do not quote this as three complete scored years.",
              "- Matching is temporal attribution, not causal proof: same ward and event window; clusters additionally require matching organism, resistance type and an event-window case on that ward. Ward and antibiogram alerts cannot identify which individual scenario caused them. No detection is credited before the first observable result.",
              "- Episodes: each ward/Poisson/antibiogram crossing; a cluster fingerprint, type and chain start (growth is a follow-up); gap/late runs separated by at most three days. An episode is matched if any update meets the event rule. Exposure is days / 7 × nine wards. Repeated overlapping windows are not independent.",
              "- The two ward criteria are deliberately reported separately: the dashboard's simple threshold and the stricter Poisson test corrected across wards. A lower unmatched-alert rate alone does not establish a better detector; compare delays and misses too.",
              "- **The planted first CPE is missed.** The incident path keeps only the first resistance flag on a multi-flag case; CPE can be obscured by ESBL. This evaluation does not change detector logic or disguise that failure.",
              "- A single CPE need not trigger a three-case cluster or ward-count threshold. The first-type detector is the relevant test for it. A permanent outage need not produce late arrivals.",
              "- Historical cluster attribution is approximate because per-case planted-event labels are absent. Previously circulating patterns may grow during a documented outbreak. Historical lab timing is optimistic; feed timing uses actual simulated deliveries.",
              "- One synthetic run, one seed, fixed thresholds, no prospective or clinical validation. More seeds, an independent test set, and adjudicated event labels are needed before deployment.",
              "", "Full event matching, individual alerts and exclusions: [detection.json](static/demo/detection.json).", ""]
    (HERE / "DETECTION.md").write_text("\n".join(lines), encoding="utf-8")


def main():
    ap = argparse.ArgumentParser(); ap.add_argument("--quick", action="store_true", help="skip antibiogram snapshots over the history")
    args = ap.parse_args()
    t0 = time.time()
    FEED.ensure(); run = FEED.run; src = data.source(); wards = list(src["wards"])

    print(f"feed replay {FEED.first} .. {FEED.last}")
    fdays = [FEED.first + timedelta(days=k) for k in range((FEED.last - FEED.first).days + 1)]
    fev, fskip = feed_events(run)
    # the antibiogram is slow (27 tables a day), so it runs daily on every ward and specimen only in the feed
    falerts, fsnaps = replay(fdays, evidence._view, abg_daily_wards=wards, abg_every=7, all_wards=wards)
    g6 = next((e for e in fev if e["code"] == "G6"), None)
    def f_explained(d, x):
        return any(x[0] == e["ward"] and x[3] == "up" and e["from"] <= d <= e["until"] and (not e.get("drug") or x[2] == e["drug"])
                   for e in fev if "abg" in e["detectors"])
    feed = section("Simulated live feed (demo run, seed 11)", fdays, fev, fskip, falerts, fsnaps, f_explained, len(wards))

    hfirst = src["start"] + timedelta(days=BASELINE_DAYS)
    print(f"history replay {hfirst} .. {src['end']}")
    hdays = [hfirst + timedelta(days=k) for k in range((src["end"] - hfirst).days + 1)]
    hev, hskip = history_events(src)
    halerts, hsnaps = replay(hdays, evidence._view, abg_every=None if args.quick else 7, all_wards=wards)
    def h_explained(d, x):
        return any(x[0] == e["ward"] and x[3] == "up" and e["from"] <= d <= e["until"] for e in hev if e.get("flag"))
    hist = section("Supplied history (data/, synthetic)", hdays, hev, hskip, halerts, hsnaps, h_explained, len(wards))
    # the history has no daily antibiogram replay (too slow), so its abg row comes from weekly snapshots only
    hist["false_alert_rates"]["abg"] = None
    hist["false_alert_rates"]["late"] = None       # no arrival times in the history: the late detector cannot run

    out = {"generated": str(date.today()), "seconds": round(time.time() - t0), "command": "python app/detection_eval.py" + (" --quick" if args.quick else ""),
           "matching": {"window": "an alert matches an event when it is on the event's ward (and resistance type, or drug for a rate shift), "
                                  "from a detector meant for that mechanism, between the event's start and 28 days after its end "
                                  "(3 days after for data faults, plus the backfill delay)",
                        "episodes": f"ward/poisson/abg: each crossing into the flagged state; cluster: each new cluster (growth is a follow-up); "
                                    f"gap/late: runs on one ward with gaps of <= {MERGE_DAYS} days",
                        "denominator": "days / 7 x 9 wards (clusters and first-ever types are counted against the same ward-weeks)",
                        "history_baseline": f"the history is replayed from {hfirst}: the ward rule needs {BASELINE_DAYS} days of baseline"},
           "feed": feed, "history": hist}
    out["matching"]["qualification"] = "Unmatched alerts are not proven false positives. Cluster matches require the organism and a case sampled on the event ward within its documented window. No match before the first observable case. Episodes count as matched if any update matches."
    OUT.write_text(json.dumps(jsonable(out), indent=1, default=str), encoding="utf-8")
    write_report(jsonable(out))
    print(f"wrote {OUT.relative_to(HERE.parent)} in {time.time() - t0:.0f}s")
    for s in (feed, hist):
        print(f"\n{s['name']}: {s['first']} .. {s['last']}, {s['ward_weeks']} ward-weeks")
        for e in s["events"]:
            res = ", ".join(f"{d} {r['delay_from_start']}d (floor {r['delay_from_floor']}d)" if r["detected"] else f"{d} missed" for d, r in e["result"].items())
            print(f"  {e['code']:6} {e['label'][:44]:44} {res}")
        print("  unmatched episodes per 100 ward-weeks: " + ", ".join(f"{d} {r['per_100_ward_weeks']} ({r['false_alerts']})" for d, r in s["false_alert_rates"].items() if r))
        if s["abg_snapshots"]: print("  antibiogram snapshots:", s["abg_snapshots"])


if __name__ == "__main__":
    main()
