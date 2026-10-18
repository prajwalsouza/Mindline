"""Evidence for the dashboards, computed from the lab data with the counting rules the challenge asks for.

- first isolate per patient, organism and specimen in each period
- a rate is shown for a ward only with at least 30 tested isolates; otherwise the hospital-wide number is used and the page says so
- the last 4 weeks are shown beside the last 12 months; the 4 weeks replace the 12 months only when they differ clearly
"""
import json, math, statistics
from collections import Counter, defaultdict
from datetime import date, timedelta
from pathlib import Path

from feedsim import data
from feed import FEED

SRC = lambda: FEED.view()   # the data known on the app's current "today"

REPO = Path(__file__).resolve().parents[1]
ORDER = ["NIT", "MEC", "TMP", "AMP", "CLI", "CXM", "CIP", "CRO", "CAZ", "VAN", "TZP", "MEM"]      # narrowest first
SPECTRUM = {"NIT": "narrow", "MEC": "narrow", "TMP": "narrow", "AMP": "narrow", "CLI": "narrow", "CXM": "moderate",
            "CIP": "broad", "CRO": "broad", "CAZ": "broad", "TZP": "broad", "VAN": "reserve", "MEM": "reserve"}
SHORT = lambda o: o.split()[0][0] + ". " + o.split()[-1]


def wilson(k, n, z=1.96):
    if not n: return [0, 0]
    p = k / n; d = 1 + z * z / n; c = p + z * z / (2 * n); r = z * math.sqrt(p * (1 - p) / n + z * z / (4 * n * n))
    return [round((c - r) / d, 3), round((c + r) / d, 3)]


def _alerts():
    """Bundled detector signals on the supplied data, with their dates."""
    p = Path(__file__).resolve().parent / "data" / "alerts.json"
    if not p.exists(): return []
    D = json.loads(p.read_text(encoding="utf-8")); start = date.fromisoformat(D["meta"]["start"])
    out = []
    for a in D["alerts"]:
        out.append({**a, "from": str(start + timedelta(weeks=a["start"])), "to": str(start + timedelta(weeks=a["end"] + 1))})
    return out
ALERTS = _alerts()


def meta():
    import locale_names
    src = SRC(); nm = locale_names.names()
    return {"wards": [{"code": w["ward_code"], "name": w["ward_en"], "names": nm["wards"][w["ward_code"]], "type": w["ward_type"]} for w in src["wards"].values()],
            "first": str(src["start"]), "last": str(src["end"]), "specimens": ["urine", "blood", "wound"], "names": nm}


def cohort(asof, days, ward=None, sex=None, age=None, spec="urine", org=None, src=None):
    """First isolates in (asof - days, asof] for patients like this. Returns [(culture, isolate)]."""
    src = src if src is not None else SRC(); lo = asof - timedelta(days=days)
    seen, out = set(), []
    for c in src["cultures"]:
        d = c["_date"]
        if d <= lo: continue
        if d > asof: break
        if c["specimen"] != spec or (ward and c["ward_code"] != ward): continue
        if age == "<65" and int(c["age_years"]) >= 65: continue
        if age == "65+" and int(c["age_years"]) < 65: continue
        if sex and src["patients"][c["patient_id"]]["sex"] != sex: continue
        for i in src["isolates"][c["culture_id"]]:
            if org and i["organism"] != org: continue
            key = (c["patient_id"], i["organism"], c["specimen"])
            if key in seen: continue
            seen.add(key); out.append((c, i))
    return out


def tally(rows, drug, src=None):
    src = src if src is not None else SRC(); n = r = 0; by_org = Counter()
    for c, i in rows:
        for s in src["sus"][i["isolate_id"]]:
            if s["antibiotic_code"] == drug:
                n += 1
                if s["result"] == "R": r += 1; by_org[i["organism"]] += 1
    return {"n": n, "s": n - r, "share": round((n - r) / n, 4) if n else None, "ci": wilson(n - r, n), "resisted_by": [[SHORT(o), k] for o, k in by_org.most_common(4)]}


def monthly(rows, drug, asof, src=None):
    """Susceptible share per month over the 12 months, for a sparkline."""
    src = src if src is not None else SRC(); m = defaultdict(lambda: [0, 0])
    for c, i in rows:
        k = (asof.year - c["_date"].year) * 12 + asof.month - c["_date"].month
        for s in src["sus"][i["isolate_id"]]:
            if s["antibiotic_code"] == drug: m[k][0] += 1; m[k][1] += s["result"] == "S"
    return [[m[k][0], m[k][1]] for k in range(11, -1, -1)]


def antibiogram(ward=None, sex=None, age=None, spec="urine", org=None, asof=None, recent_weeks=4, src=None):
    recent_weeks = int(recent_weeks)
    if recent_weeks not in (2, 4, 8, 12):
        raise ValueError("Recent window must be 2, 4, 8 or 12 weeks")
    src = src if src is not None else (FEED.view(date.fromisoformat(asof)) if asof else SRC()); asof = date.fromisoformat(asof) if asof else src["end"]
    year_w = cohort(asof, 365, ward, sex, age, spec, org, src=src) if ward else None
    year_all = cohort(asof, 365, None, sex, age, spec, org, src=src)
    recent = cohort(asof, recent_weeks * 7, ward, sex, age, spec, org, src=src)
    drugs = []
    for code in ORDER:
        ab = src["antibiotics"][code]
        if ab["reported_for"] not in ("all", spec): continue
        all_ = tally(year_all, code, src)
        if all_["n"] < 30 or all_["n"] < .3 * len(year_all): continue        # not routinely tested for this kind of patient
        wy = tally(year_w, code, src) if year_w is not None else None
        use_ward = wy is not None and wy["n"] >= 30
        ann = wy if use_ward else all_
        rc = tally(recent, code, src)
        z = abs(rc["share"] - ann["share"]) / math.sqrt(max(1e-4, ann["share"] * (1 - ann["share"])) / rc["n"]) if rc["n"] else 0
        rows_for_trend = year_w if use_ward else year_all
        drugs.append({"code": code, "name": ab["antibiotic"], "spectrum": SPECTRUM.get(code, ""), "year": ann, "recent": rc,
                      "source": "ward" if use_ward else "hospital", "ward_n": wy["n"] if wy else None,
                      "changed": bool(rc["n"] >= 10 and z > 2.5), "monthly": monthly(rows_for_trend, code, asof, src)})
    base = year_w if ward else year_all
    orgs = Counter(i["organism"] for _, i in (cohort(asof, 365, ward, sex, age, spec, src=src) if ward else cohort(asof, 365, None, sex, age, spec, src=src)))
    total = sum(orgs.values()) or 1
    signals = [a for a in ALERTS if (not ward or a["ward"] in (ward, "ALL")) and a["type"] != "gap"
               and date.fromisoformat(a["from"]) <= asof and date.fromisoformat(a["to"]) >= asof - timedelta(days=56)]
    gaps = [a for a in ALERTS if a["type"] == "gap" and (not ward or a["ward"] == ward)
            and date.fromisoformat(a["from"]) <= asof and date.fromisoformat(a["to"]) >= asof - timedelta(days=28)]
    return {"asof": str(asof), "ward": ward, "sex": sex, "age": age, "spec": spec, "org": org,
            "n_year": len(base), "n_recent": len(recent), "recent_weeks": recent_weeks,
            "organisms": [{"name": o, "short": SHORT(o), "n": n, "share": round(n / total, 3)} for o, n in orgs.most_common(8)],
            "drugs": drugs, "signals": signals, "gaps": gaps}


def _status(c, asof):
    """Where a sample is in the lab, as of asof. Feed samples carry their real stage; the supplied data has only final results,
    so its recent samples are shown as they would be mid-process, using the delays measured in MIMIC (organism ~1.5 days, S/R ~3 days)."""
    if c.get("_feed"):
        st = c["_status"]
        if st == "received": return "waiting"
        if c["result"] in ("negative", "mixed_growth"): return "no growth"
        return "final" if st == "final" and all(i.get("esbl") != "" for i in SRC()["isolates"][c["culture_id"]]) else "organism known"
    age = (asof - c["_date"]).days
    if c["result"] != "positive": return "no growth" if age >= 2 else "waiting"
    return "waiting" if age < 1 else "organism known" if age < 3 else "final"


def patients(ward, asof=None, days=10, limit=14):
    """Recent samples on a ward: the doctor's patient list."""
    src = SRC(); asof = date.fromisoformat(asof) if asof else src["end"]; lo = asof - timedelta(days=days)
    seen, out = set(), []
    for c in reversed(src["cultures"]):
        if c["_date"] > asof: continue
        if c["_date"] <= lo: break
        if c["ward_code"] != ward or c["patient_id"] in seen or c["specimen"] not in ("urine", "blood", "wound"): continue
        seen.add(c["patient_id"]); p = src["patients"][c["patient_id"]]; st = _status(c, asof)
        isos = src["isolates"][c["culture_id"]]
        out.append({"id": c["patient_id"], "sex": p["sex"], "age": int(c["age_years"]), "spec": c["specimen"], "date": c["sample_date"],
                    "status": st, "organisms": [i["organism"] for i in isos] if st in ("organism known", "final") else [],
                    "flags": [f.upper() for i in isos for f in data.FLAGS if i[f] == "1"] if st == "final" else []})
        if len(out) >= limit: break
    # samples still in the lab first, then finished ones; newest first within each
    rank = {"waiting": 0, "organism known": 1, "final": 2, "no growth": 3}
    return sorted(out, key=lambda x: (rank[x["status"]], [-ord(ch) for ch in x["date"]]))


def patient(pid, asof=None):
    """One patient's earlier cultures and what their bacteria resisted."""
    src = SRC(); asof = date.fromisoformat(asof) if asof else src["end"]
    hist = []
    for c in src["cultures"]:
        if c["patient_id"] != pid or c["_date"] > asof: continue
        st = _status(c, asof)
        isos = []
        for i in src["isolates"][c["culture_id"]]:
            show = st == "final" or (st == "organism known")
            if not show: continue
            res = [s["antibiotic_code"] for s in src["sus"][i["isolate_id"]] if s["result"] == "R"] if st == "final" else []
            isos.append({"organism": i["organism"], "short": SHORT(i["organism"]), "flags": [f.upper() for f in data.FLAGS if i[f] == "1"] if st == "final" else [], "resisted": res})
        hist.append({"date": c["sample_date"], "ward": c["ward_code"], "spec": c["specimen"], "result": c["result"], "status": st, "isolates": isos})
    p = src["patients"][pid]
    return {"id": pid, "sex": p["sex"], "birth_year": p["birth_year"], "history": hist[::-1]}


def wards_overview(asof=None, types=("esbl", "mrsa", "vre", "cpe"), src=None):
    """The hygiene team's view: per ward, new resistant cases against that ward's own normal; wards linked by shared patients;
    and every resistant case of the last year with its resistance fingerprint, so the page can filter by time and pattern."""
    src = src if src is not None else (FEED.view(date.fromisoformat(asof)) if asof else SRC()); asof = date.fromisoformat(asof) if asof else src["end"]
    lo = asof - timedelta(days=365 + 364)          # a year of cases plus a year before it for the baseline
    weeks = 52; start = asof - timedelta(weeks=weeks)
    seen, cases = set(), []
    patient_wards = defaultdict(set)
    vol = defaultdict(lambda: [0] * weeks)
    for c in src["cultures"]:
        d = c["_date"]
        if d <= lo or d > asof: continue
        if d > asof - timedelta(days=365): patient_wards[c["patient_id"]].add(c["ward_code"])
        if d > start:
            vol[c["ward_code"]][min(weeks - 1, (d - start).days // 7)] += 1
        for i in src["isolates"][c["culture_id"]]:
            flags = [f for f in types if i[f] == "1"]
            if not flags: continue
            key = (c["patient_id"], tuple(flags))
            if key in seen: continue                 # first resistant isolate per patient and type
            seen.add(key)
            sr = "".join({"S": "S", "R": "R"}.get(next((s["result"] for s in src["sus"][i["isolate_id"]] if s["antibiotic_code"] == code), "."), ".") for code in ORDER)
            adm = c.get("admission_date") or ""
            hday = (d - date.fromisoformat(adm)).days + 1 if adm else None
            cases.append({"id": "C" + c["culture_id"][-6:], "ward": c["ward_code"], "date": c["sample_date"], "flags": [f.upper() for f in flags],
                          "organism": i["organism"], "short": SHORT(i["organism"]), "fp": sr, "hday": hday, "spec": c["specimen"]})
    wards = []
    for code, w in src["wards"].items():
        mine = [x for x in cases if x["ward"] == code]
        recent = sum(1 for x in mine if date.fromisoformat(x["date"]) > asof - timedelta(days=28))
        base = [x for x in mine if asof - timedelta(days=365 + 28) < date.fromisoformat(x["date"]) <= asof - timedelta(days=28)]
        expected = len(base) / 365 * 28                      # preceding 365 days, excluding the latest 28 days
        z = (recent - expected) / math.sqrt(max(expected, .5))
        weekly = [0] * weeks
        for x in mine:
            dd = date.fromisoformat(x["date"])
            if dd > start: weekly[min(weeks - 1, (dd - start).days // 7)] += 1
        wards.append({"code": code, "name": w["ward_en"], "type": w["ward_type"], "institution": w["institution"], "recent": recent,
                      "expected": round(expected, 2), "z": round(z, 2), "weekly": weekly, "volume": vol[code]})
    links = Counter()
    for ws in patient_wards.values():
        ws = sorted(ws)
        for a in range(len(ws)):
            for b in range(a + 1, len(ws)): links[(ws[a], ws[b])] += 1
    recent_cases = [x for x in cases if date.fromisoformat(x["date"]) > start]
    return {"asof": str(asof), "start": str(start), "weeks": weeks, "types": [t.upper() for t in types], "drugs": ORDER, "wards": wards,
            "links": [{"a": a, "b": b, "n": n} for (a, b), n in links.items()], "cases": recent_cases,
            "signals": [a for a in ALERTS if date.fromisoformat(a["to"]) > start and date.fromisoformat(a["from"]) <= asof]}


# ---------- the morning brief: only what changed, each line with its evidence ----------
TREND_PAIRS = [("Escherichia coli", "urine", "TMP"), ("Escherichia coli", "urine", "CIP"), ("Escherichia coli", "urine", "CRO"),
               ("Klebsiella pneumoniae", None, "CRO"), ("Staphylococcus aureus", None, "FOX")]


def _clusters(cases, today):
    """Cases sharing organism and fingerprint, linked when each follows the previous within 14 days; 3 or more is a cluster."""
    out = []
    groups = defaultdict(list)
    for c in cases: groups[(c["short"], c["fp"], tuple(c["flags"]))].append(c)
    for (short, fp, flags), cs in groups.items():
        cs = sorted(cs, key=lambda c: c["date"]); run = [cs[0]]; chains = []
        for c in cs[1:]:
            if (date.fromisoformat(c["date"]) - date.fromisoformat(run[-1]["date"])).days <= 14: run.append(c)
            else: chains.append(run); run = [c]
        chains.append(run)
        for ch in chains:
            if len(ch) < 3: continue
            first, last = date.fromisoformat(ch[0]["date"]), date.fromisoformat(ch[-1]["date"])
            since = (today - last).days
            if since > 60: continue
            recent = sum(1 for c in ch if (today - date.fromisoformat(c["date"])).days <= 14)
            before = sum(1 for c in ch if 14 < (today - date.fromisoformat(c["date"])).days <= 28)
            status = "over" if since > 28 else "new" if (today - first).days <= 14 else "growing" if recent > before else "stable"
            daily = [0] * 60
            for c in ch:
                k = 59 - (today - date.fromisoformat(c["date"])).days
                if 0 <= k < 60: daily[k] += 1
            wards = []
            for c in ch:
                if c["ward"] not in wards: wards.append(c["ward"])
            out.append({"organism": short, "flags": list(flags), "fp": fp, "key": fp + short, "n": len(ch), "first": str(first), "last": str(last),
                        "since": since, "status": status, "wards": wards, "daily": daily, "hospital": sum(1 for c in ch if (c["hday"] or 0) >= 3)})
    order = {"new": 0, "growing": 1, "stable": 2, "over": 3}
    return sorted(out, key=lambda c: (order[c["status"]], -c["n"]))


def _share_series(src, org, spec, drug, today, months=24):
    """Resistant share by month, first isolate per patient and month."""
    m = defaultdict(lambda: [0, 0]); seen = set(); lo = today - timedelta(days=months * 31)
    for c in src["cultures"]:
        d = c["_date"]
        if d <= lo or d > today or (spec and c["specimen"] != spec): continue
        for i in src["isolates"][c["culture_id"]]:
            if i["organism"] != org: continue
            key = (c["patient_id"], d.year, d.month)
            if key in seen: continue
            seen.add(key)
            for s in src["sus"][i["isolate_id"]]:
                if s["antibiotic_code"] == drug: m[(d.year, d.month)][0] += 1; m[(d.year, d.month)][1] += s["result"] == "R"
    out = []
    for k in range(months - 1, -1, -1):
        y, mo = today.year, today.month - k
        while mo <= 0: y -= 1; mo += 12
        n, r = m[(y, mo)]; out.append({"month": f"{y}-{mo:02d}", "n": n, "r": r})
    return out


def brief(today=None):
    """What changed since yesterday, for the hygiene team. Counts, not percentages, unless n is large enough."""
    import narrative
    src = FEED.view(date.fromisoformat(today)) if today else SRC(); today = date.fromisoformat(today) if today else src["end"]; yday = today - timedelta(days=1)
    now = wards_overview(str(today), src=src)
    ysrc = FEED.view(yday) if yday > data.source()["end"] else dict(data.source(), end=yday)
    before = wards_overview(str(yday), src=ysrc)
    old = {(c["id"], tuple(c["flags"])) for c in before["cases"]}
    new_cases = [c for c in now["cases"] if (c["id"], tuple(c["flags"])) not in old]
    clusters = _clusters(now["cases"], today)
    wards = sorted([w for w in now["wards"] if w["recent"] >= 3 and w["z"] > 2], key=lambda w: -w["z"])
    trends = []
    for org, spec, drug in TREND_PAIRS:
        ser = _share_series(src, org, spec, drug, today)
        a, b = ser[-12:], ser[:12]
        n1, r1 = sum(x["n"] for x in a), sum(x["r"] for x in a); n0, r0 = sum(x["n"] for x in b), sum(x["r"] for x in b)
        if n1 < 30 or n0 < 30: continue
        p1, p0 = r1 / n1, r0 / n0; pp = (r1 + r0) / (n1 + n0)
        z = (p1 - p0) / math.sqrt(max(1e-9, pp * (1 - pp) * (1 / n1 + 1 / n0)))
        trends.append({"organism": SHORT(org), "spec": spec, "drug": drug, "series": ser, "now": round(p1, 4), "before": round(p0, 4),
                       "n_now": n1, "n_before": n0, "z": round(z, 2), "crossed": abs(z) > 2 and abs(p1 - p0) >= .02})
    # EUCAST versions seen in the last 13 months, and when each one started
    first_seen = {}
    for c in src["cultures"]:
        if (today - c["_date"]).days > 400 or c["_date"] > today: continue
        for i in src["isolates"][c["culture_id"]]:
            for s in src["sus"][i["isolate_id"]][:1]:
                m = c["_date"].strftime("%Y-%m"); first_seen[s["guideline"]] = min(first_seen.get(s["guideline"], m), m)
    versions = [{"version": g, "from": m} for g, m in sorted(first_seen.items(), key=lambda x: x[1])][1:]
    # data health: samples per ward per day over 14 days against the same weekday in the 4 weeks before; empty days are missing, not quiet
    by_day = Counter((c["ward_code"], c["_date"]) for c in src["cultures"] if 0 <= (today - c["_date"]).days <= 13 + 28)
    health = []
    for w in src["wards"]:
        days = []
        for k in range(13, -1, -1):
            d = today - timedelta(days=k)
            usual = statistics.median([by_day[(w, d - timedelta(weeks=j))] for j in (1, 2, 3, 4)])
            days.append({"day": str(d), "n": by_day[(w, d)], "usual": usual})
        gap = sum(1 for x in days[-7:] if x["n"] == 0 and x["usual"] >= 2)
        pending = sum(1 for c in src["cultures"][-4000:] if c["ward_code"] == w and c.get("_feed") and c.get("_status") == "received")
        health.append({"ward": w, "days": days, "missing_days": gap, "pending": pending})
    late = Counter()
    if FEED.run and today > data.source()["end"]:
        for d in FEED.run.deliveries:
            if d["known_at"].date() == today and d["kind"] == "susceptibility" and (today - d["event_at"].date()).days > 10: late[d["ward"]] += 1
    notes = narrative.KNOWLEDGE_GRAPH.find([("Kind",)], limit=6) if ("Kind",) in narrative.KNOWLEDGE_GRAPH.tags else []
    return {"today": str(today), "yesterday": str(yday), "source": "feed" if today > data.source()["end"] else "data",
            "new_cases": new_cases, "clusters": clusters, "wards": wards, "trends": trends, "versions": versions, "health": health,
            "late": dict(late), "notes": notes, "types": now["types"], "all_wards": now["wards"], **_morning(src, today)}


# ---------- this morning in context: the last 7 days, today's arrivals as they came, and incidents of the last 3 days ----------
_OVC = {}


def _view(day):
    return FEED.view(day) if day > data.source()["end"] else dict(data.source(), end=day)


def _ov(day):
    """The ward overview as known at the end of `day`, cached while the feed plays forward."""
    k = (day, id(FEED.run))
    if k not in _OVC:
        if len(_OVC) > 24: _OVC.clear()
        _OVC[k] = wards_overview(str(day), src=_view(day))
    return _OVC[k]


def _hot(w): return w["recent"] >= 3 and w["z"] > 2


def _deliveries(day):
    """What the simulated feed delivered during `day` (empty for the supplied data)."""
    if not FEED.run or day <= data.source()["end"]: return []
    return [d for d in FEED.run.deliveries if d["known_at"].date() == day]


LANE = {"culture received": "received", "culture result": "organism", "organism identified": "organism", "isolate final": "susceptibility",
        "susceptibility": "susceptibility", "susceptibility corrected": "fixed", "organism corrected": "fixed", "duplicate": "fixed"}


def _incidents(day, first_flag, cultures_by_day, ov=None):
    """What happened on `day`, as short structured items: new cases by ward and type, wards crossing or leaving their own normal,
    clusters starting, growing or ending, first-ever resistance types on a ward, missing samples, late batches and corrections."""
    ov = ov or _ov
    now, before = ov(day), ov(day - timedelta(days=1))
    out = []
    old = {(c["id"], tuple(c["flags"])) for c in before["cases"]}
    new = [c for c in now["cases"] if (c["id"], tuple(c["flags"])) not in old]
    for (ward, flag), cs in sorted(Counter((c["ward"], c["flags"][0]) for c in new).items(), key=lambda x: -x[1]):
        first = any(first_flag.get((ward, flag)) == c["date"] for c in new if c["ward"] == ward and c["flags"][0] == flag)
        out.append({"day": str(day), "kind": "first" if first else "case", "ward": ward, "flag": flag, "n": cs})
    hb = {w["code"]: _hot(w) for w in before["wards"]}
    for w in now["wards"]:
        if _hot(w) and not hb.get(w["code"]): out.append({"day": str(day), "kind": "above", "ward": w["code"], "n": w["recent"], "expected": round(w["expected"], 1)})
        if not _hot(w) and hb.get(w["code"]): out.append({"day": str(day), "kind": "calm", "ward": w["code"], "n": w["recent"]})
    cb = {c["key"] + "|".join(c["flags"]): c for c in _clusters(before["cases"], day - timedelta(days=1))}
    for c in _clusters(now["cases"], day):
        k = c["key"] + "|".join(c["flags"]); p = cb.get(k)
        item = {"day": str(day), "organism": c["organism"], "flag": c["flags"][0], "wards": c["wards"], "n": c["n"]}
        if p is None and c["status"] != "over": out.append({**item, "kind": "cluster"})
        elif p and c["n"] > p["n"] and c["status"] != "over": out.append({**item, "kind": "grew", "was": p["n"]})
        elif p and c["status"] == "over" and p["status"] != "over": out.append({**item, "kind": "ended"})
    for w in now["wards"]:                          # a ward that usually sends samples sent none that day
        usual = statistics.median([cultures_by_day[(w["code"], day - timedelta(weeks=j))] for j in (1, 2, 3, 4)])
        if usual >= 5 and cultures_by_day[(w["code"], day)] == 0: out.append({"day": str(day), "kind": "gap", "ward": w["code"], "usual": usual})
    ds = _deliveries(day)
    late = Counter(d["ward"] for d in ds if d["kind"] == "susceptibility" and (d["known_at"] - d["event_at"]).days > 10)
    for ward, n in late.most_common():
        if n >= 5: out.append({"day": str(day), "kind": "late", "ward": ward, "n": n})
    fixed = Counter(d["ward"] for d in ds if d["kind"] in ("susceptibility corrected", "organism corrected"))
    if fixed: out.append({"day": str(day), "kind": "fixed", "n": sum(fixed.values()), "wards": [w for w, _ in fixed.most_common()]})
    order = {"first": 0, "above": 1, "cluster": 2, "grew": 3, "case": 4, "gap": 5, "late": 6, "fixed": 7, "calm": 8, "ended": 9}
    return sorted(out, key=lambda i: order[i["kind"]])


def _index(src, today, since):
    """The first date each resistance type was ever seen on each ward, and samples per ward per day from `since`."""
    first_flag, cultures_by_day = {}, Counter()
    for c in src["cultures"]:
        if c["_date"] > today: continue
        if c["_date"] >= since: cultures_by_day[(c["ward_code"], c["_date"])] += 1
        for i in src["isolates"].get(c["culture_id"], []):
            for f in data.FLAGS:
                if i.get(f) == "1": first_flag.setdefault((c["ward_code"], f.upper()), c["sample_date"])
    return first_flag, cultures_by_day


def _morning(src, today):
    days = [today - timedelta(days=k) for k in range(6, -1, -1)]
    first_flag, cultures_by_day = _index(src, today, today - timedelta(days=40))
    pulse = []
    for d in days:
        now, before = _ov(d), _ov(d - timedelta(days=1))
        old = {(c["id"], tuple(c["flags"])) for c in before["cases"]}
        ds = _deliveries(d)
        pulse.append({"day": str(d), "new": sum(1 for c in now["cases"] if (c["id"], tuple(c["flags"])) not in old),
                      "above": sum(1 for w in now["wards"] if _hot(w)),
                      "arrived": len(ds) if ds else None,
                      "issues": sum(1 for x in ds if x["kind"] in ("susceptibility corrected", "organism corrected", "duplicate")
                                    or (x["kind"] == "susceptibility" and (x["known_at"] - x["event_at"]).days > 10)) if ds else None})
    arrivals = [[round(d["known_at"].hour + d["known_at"].minute / 60, 2), LANE.get(d["kind"], "fixed"), d["ward"],
                 round((d["known_at"] - d["event_at"]).total_seconds() / 86400, 1)] for d in _deliveries(today)]
    incidents = [i for k in (0, 1, 2) for i in _incidents(today - timedelta(days=k), first_flag, cultures_by_day)]
    return {"pulse": pulse, "arrivals": arrivals, "incidents": incidents}


# ---------- the calendar: every feed day marked notable, active or quiet, from the same incidents as the brief ----------
NOTABLE = {"above", "first", "cluster", "grew", "gap", "late"}
_CAL, _CAL_BUSY = {}, set()


def _calendar_build(key):
    """Incidents for every feed day, in order; runs once per feed run in a background thread (about 15 seconds)."""
    import threading
    try:
        first, last = FEED.first, FEED.last
        src = _view(last)
        first_flag, cbd = _index(src, last, first - timedelta(days=35))
        cache = {}
        def ov(d):
            if d not in cache: cache[d] = wards_overview(str(d), src=_view(d))
            return cache[d]
        out, d = {}, first
        while d <= last:
            out[str(d)] = _incidents(d, first_flag, cbd, ov)
            for k in [k for k in cache if k < d - timedelta(days=1)]: del cache[k]
            d += timedelta(days=1)
        _CAL[key] = out
    finally:
        _CAL_BUSY.discard(key)


def calendar():
    """Every day of the feed: how much arrived, and whether something happened (notable), only routine results (active), or
    nothing (quiet). Uses the brief's incidents once they are built; until then a quick estimate from the day's deliveries."""
    import threading
    FEED.ensure()
    key = id(FEED.run)
    if key not in _CAL and key not in _CAL_BUSY:
        _CAL_BUSY.add(key); threading.Thread(target=_calendar_build, args=(key,), daemon=True).start()
    built = _CAL.get(key)
    per = defaultdict(Counter)
    for d in FEED.run.deliveries:
        k = str(d["known_at"].date()); per[k]["arrived"] += 1
        if d["kind"] == "isolate final" and any(d["row"].get(f) == "1" for f in data.FLAGS): per[k]["resistant"] += 1
        if d["kind"] == "susceptibility" and (d["known_at"] - d["event_at"]).days > 10: per[k]["late"] += 1
    days, d = [], FEED.first
    while d <= FEED.last:
        k = str(d); c = per[k]
        if built is not None:
            inc = built.get(k, [])
            level = "notable" if any(i["kind"] in NOTABLE and (i["kind"] != "late" or i["n"] >= 20) for i in inc) else "active" if inc else "quiet"
        else:
            inc = []
            level = "notable" if c["resistant"] >= 3 or c["late"] >= 10 else "active" if c["resistant"] or c["late"] else "quiet"
        days.append({"day": k, "level": level, "arrived": c["arrived"], "resistant": c["resistant"], "late": c["late"], "incidents": inc[:4]})
        d += timedelta(days=1)
    return {"first": str(FEED.first), "last": str(FEED.last), "today": str(FEED.today), "data_end": str(data.source()["end"]),
            "ready": built is not None, "days": days}
