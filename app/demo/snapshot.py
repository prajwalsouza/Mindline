"""Snapshot the real Mindline API for the demo, so the film plays the same every time.

    python app/demo/snapshot.py [http://localhost:8800]

It moves the simulated feed's "today" through Oct–Nov 2026 to record the Morning brief day by day,
then puts the clock back exactly where it found it. Output: app/static/demo/data.json.
"""
import json, sys, urllib.request
from datetime import date, timedelta
from pathlib import Path

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8800").rstrip("/")
OUT = Path(__file__).resolve().parents[1] / "static" / "demo" / "data.json"
START, MORNING, END = date(2026, 9, 28), date(2026, 11, 1), date(2026, 11, 3)
WARD = "URO"   # the doctor's ward


def get(p):
    with urllib.request.urlopen(BASE + p, timeout=60) as r: return json.load(r)


def post(p, body):
    req = urllib.request.Request(BASE + p, json.dumps(body).encode(), {"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=60) as r: return json.load(r)


def slim_brief(b):
    """Only what the film draws."""
    return {"today": b["today"], "new_cases": b["new_cases"], "clusters": b["clusters"], "wards": [w["code"] for w in b["wards"]],
            "all_wards": [{k: w[k] for k in ("code", "recent", "expected", "z")} for w in b["all_wards"]],
            "health": [{"ward": h["ward"], "days": h["days"], "missing_days": h["missing_days"], "pending": h["pending"]} for h in b["health"]],
            "late": b["late"]}


def main():
    was = get("/api/app/clock")["today"]
    days = {}
    try:
        d = START
        while d <= END:
            post("/api/app/clock", {"action": "set", "day": d.isoformat()})
            days[d.isoformat()] = slim_brief(get("/api/app/brief"))
            print(d, len(days[d.isoformat()]["new_cases"]), "new", days[d.isoformat()]["wards"], flush=True)
            d += timedelta(days=1)
        post("/api/app/clock", {"action": "set", "day": MORNING.isoformat()})
        morning = get("/api/app/brief")
        wards = get(f"/api/app/wards?asof={MORNING}")
        before = get(f"/api/app/wards?asof={START - timedelta(days=1)}")
        # the doctor: a patient on the ward still waiting for the lab, whose bacteria survived a drug before
        pick = None
        for p in get(f"/api/app/patients?ward={WARD}&asof={MORNING}"):
            if p["status"] not in ("waiting", "organism known"): continue
            pt = get(f"/api/app/patient?id={p['id']}&asof={MORNING}")
            old = [(h, i) for h in pt["history"][1:] for i in h["isolates"] if i["resisted"]]
            if old: pick = (p, pt, old); break
        p, pt, old = pick
        ab = get(f"/api/app/antibiogram?ward={WARD}&sex={p['sex']}&spec={p['spec']}&asof={MORNING}")
        ab_icu = get(f"/api/app/antibiogram?ward=ICU&spec=blood&asof={MORNING}")
        h, iso = old[0]
        plan = next((d["code"] for d in ab["drugs"] if d["code"] in iso["resisted"]), ab["drugs"][0]["code"])
        pd = next(d for d in ab["drugs"] if d["code"] == plan)
        alt = next(d for d in ab["drugs"] if d["code"] not in iso["resisted"] and d["year"]["share"] >= .85)
        text = (f"I think this is a urinary tract infection. "
                f"Her {iso['short']} survived {pd['name']} in {h['date'][:7]}, so I decided against it. "
                f"Decided to start {alt['name']} because it still works for most patients here. "
                f"If the culture shows ESBL, switch to a carbapenem.")
        parsed = post("/api/app/narrate/parse", {"patient": p["id"], "ward": WARD, "text": text})
    finally:
        post("/api/app/clock", {"action": "set", "day": was})
        print("clock back at", get("/api/app/clock")["today"])
    meta = get("/api/app/meta")
    OUT.write_text(json.dumps({
        "meta": {"wards": meta["wards"], "first": meta["first"], "names": meta["names"]},
        "start": START.isoformat(), "morning": MORNING.isoformat(), "days": days,
        "brief": {k: morning[k] for k in ("today", "trends", "versions", "notes", "types")},
        "wards": wards, "wards_before": {k: before[k] for k in ("asof", "start", "wards")},
        "doctor": {"ward": WARD, "patient": p, "record": pt, "plan": plan, "alt": alt["code"], "antibiogram": ab, "icu": ab_icu,
                   "text": text, "parsed": parsed},
    }, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")
    print("wrote", OUT, OUT.stat().st_size // 1024, "KB")


if __name__ == "__main__":
    main()
