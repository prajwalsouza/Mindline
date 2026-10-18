"""Insights: fixed questions per role, each answered with a stated time window, a gate, and the statistics behind it.

Every insight is a question chosen in advance (no fishing for significant subsets). It is returned only when the data
can answer it: shares need at least 30 tested, a ward is never called unusual below 3 cases, and a change is called
"clear" only when its interval excludes no change after correcting for the number of comparisons in that question.
Everything is computed from the data known on the app's current "today", so it moves with the live feed.

Counting: first isolate per patient, organism and specimen, selected separately inside each window, before subgrouping.
Statistics, all in the standard library:
- direct standardisation over sex x age group x ward ("comparing like with like"), Wald intervals on the difference
- two-proportion and log-odds-ratio z tests; Benjamini-Hochberg across the comparisons inside one question
- Poisson tail probabilities and 95% ranges against each ward's own previous year
- a Monte Carlo scan test for how tightly cases bunch in time
- a rolling back-test: does last year or last month better predict the next month's results?
"""
import math, random, statistics
from collections import Counter, defaultdict
from datetime import timedelta

from feedsim import data
from feed import FEED
import evidence

ORDER, SHORT, wilson = evidence.ORDER, evidence.SHORT, evidence.wilson
WEEK, YEAR = 7, 364


# ---------------------------------------------------------------- small statistics
def norm_sf(z): return .5 * math.erfc(z / math.sqrt(2))
def p_two(z): return min(1.0, 2 * norm_sf(abs(z)))


def bh(ps):
    """Benjamini-Hochberg adjusted p-values, same order as given."""
    m = len(ps); order = sorted(range(m), key=lambda i: ps[i]); q = [1.0] * m; run = 1.0
    for rank, i in reversed(list(enumerate(order, 1))):
        run = min(run, ps[i] * m / rank); q[i] = min(1.0, run)
    return q


def pois_cdf(k, lam):
    """P(X <= k) for X ~ Poisson(lam)."""
    if k < 0: return 0.0
    term = s = math.exp(-lam)
    for i in range(1, k + 1): term *= lam / i; s += term
    return min(1.0, s)


def pois_sf(k, lam): return 1.0 if k <= 0 else max(0.0, 1 - pois_cdf(k - 1, lam))


def pois_range(lam, lo=.025, hi=.975):
    a = 0
    while pois_cdf(a, lam) < lo: a += 1
    b = a
    while pois_cdf(b, lam) < hi: b += 1
    return [a, b]


def sure(q, p, effect_ok=True):
    """Plain words for how sure: clear (corrected), possible (uncorrected only), or no clear change."""
    if q < .05 and effect_ok: return "clear"
    if p < .05 and effect_ok: return "possible"
    return "none"


def age_band(a): return "65+" if a >= 65 else "<65"


# ---------------------------------------------------------------- the records, indexed once per data view
_CACHE = {}


def records(src):
    """One record per isolate, in date order: date, patient, ward, sex, age, specimen, organism, results, flags."""
    key = (id(src), src["end"])
    if key in _CACHE: return _CACHE[key]
    out = []
    for c in src["cultures"]:
        if c["_date"] > src["end"]: continue
        p = src["patients"].get(c["patient_id"]) or {}
        for i in src["isolates"].get(c["culture_id"], []):
            res = {s["antibiotic_code"]: s["result"] for s in src["sus"].get(i["isolate_id"], [])}
            out.append({"d": c["_date"], "pid": c["patient_id"], "cid": c["culture_id"], "ward": c["ward_code"], "sex": p.get("sex", "F"),
                        "age": int(c["age_years"] or 0), "spec": c["specimen"], "org": i["organism"], "res": res,
                        "flags": [f.upper() for f in data.FLAGS if i.get(f) == "1"]})
    _CACHE.clear(); _CACHE[key] = out
    return out


def first(recs, lo, hi, spec=None, org=None, ward=None):
    """First isolate per patient, organism and specimen inside (lo, hi]."""
    seen, out = set(), []
    for r in recs:
        if r["d"] <= lo or r["d"] > hi: continue
        if spec and r["spec"] != spec: continue
        if org and r["org"] != org: continue
        if ward and r["ward"] != ward: continue
        k = (r["pid"], r["org"], r["spec"])
        if k in seen: continue
        seen.add(k); out.append(r)
    return out


def tested(rows, drug): return [r for r in rows if r["res"].get(drug) in ("S", "R")]
def nr(rows, drug):
    t = tested(rows, drug); return len(t), sum(1 for r in t if r["res"][drug] == "R")


def window(lo, hi): return {"from": str(lo + timedelta(days=1)), "to": str(hi), "days": (hi - lo).days}


# ---------------------------------------------------------------- comparing like with like
def standardised(rows0, rows1, drug, key):
    """Resistant share in two groups, standardised to their combined mix over `key` strata. Returns raw and adjusted
    shares, the adjusted difference (1 minus 0) with a 95% interval, and a two-sided p-value."""
    s0, s1 = defaultdict(lambda: [0, 0]), defaultdict(lambda: [0, 0])
    for rows, s in ((rows0, s0), (rows1, s1)):
        for r in tested(rows, drug):
            k = key(r); s[k][0] += 1; s[k][1] += r["res"][drug] == "R"
    strata = [k for k in s0 if k in s1]
    N = sum(s0[k][0] + s1[k][0] for k in strata)
    if not N: return None
    adj, var = [0.0, 0.0], [0.0, 0.0]
    for k in strata:
        w = (s0[k][0] + s1[k][0]) / N
        for g, s in enumerate((s0, s1)):
            n, r = s[k]; p = r / n; pv = (r + .5) / (n + 1)
            adj[g] += w * p; var[g] += w * w * pv * (1 - pv) / n
    d = adj[1] - adj[0]; se = math.sqrt(var[0] + var[1]) or 1e-9
    n0, r0 = sum(v[0] for v in s0.values()), sum(v[1] for v in s0.values()); n1, r1 = sum(v[0] for v in s1.values()), sum(v[1] for v in s1.values())
    return {"n0": n0, "r0": r0, "n1": n1, "r1": r1, "raw0": r0 / n0 if n0 else None, "raw1": r1 / n1 if n1 else None,
            "adj0": adj[0], "adj1": adj[1], "diff": d, "ci": [d - 1.96 * se, d + 1.96 * se], "p": p_two(d / se),
            "kept": N / max(1, n0 + n1)}


def mix_key(r): return (r["sex"], age_band(r["age"]), r["ward"])


# ================================================================ hygiene team
def drugs_losing_ground(recs, asof, start):
    """Which drugs are losing ground? Urinary E. coli, this year against two years ago (or last year if the data is
    shorter), adjusted for the sex, age-group and ward mix. One comparison per routinely tested drug, BH-corrected."""
    org, spec = "Escherichia coli", "urine"
    ends = [asof - timedelta(days=YEAR * k) for k in (2, 1, 0)]
    years = [(e - timedelta(days=YEAR), e) for e in ends]
    years = [y for y in years if y[0] >= start - timedelta(days=1)]
    if len(years) < 2: return None
    rows = [first(recs, lo, hi, spec, org) for lo, hi in years]
    out = []
    for drug in ORDER:
        counts = [nr(r, drug) for r in rows]
        if min(n for n, _ in counts) < 30: continue
        st = standardised(rows[0], rows[-1], drug, mix_key)
        if not st: continue
        # resistant share by month across the whole span, first isolate per patient within each year window
        months = defaultdict(lambda: [0, 0])
        for rr in rows:
            for r in tested(rr, drug): m = r["d"].strftime("%Y-%m"); months[m][0] += 1; months[m][1] += r["res"][drug] == "R"
        out.append({"drug": drug, "years": [{"n": n, "r": k, "share": k / n, "ci": wilson(k, n)} for n, k in counts], **st,
                    "monthly": [{"m": m, "n": v[0], "r": v[1]} for m, v in sorted(months.items())]})
    if len(out) < 2: return None
    for x, q in zip(out, bh([x["p"] for x in out])): x["q"] = q; x["sure"] = sure(q, x["p"], abs(x["diff"]) >= .01)
    out.sort(key=lambda x: -x["diff"])
    return {"id": "losing", "org": SHORT(org), "spec": spec, "windows": [window(lo, hi) for lo, hi in years], "drugs": out}


def cases_or_samples(recs, asof, start):
    """More resistant results, or just more samples? Last year against this year: the change in resistant results split
    exactly into a sampling-volume part and a resistance-share part, plus a test of the share change itself."""
    org, spec = "Escherichia coli", "urine"
    y1, y0 = (asof - timedelta(days=2 * YEAR), asof - timedelta(days=YEAR)), (asof - timedelta(days=YEAR), asof)
    if y1[0] < start - timedelta(days=1): return None
    a, b = first(recs, *y1, spec, org), first(recs, *y0, spec, org)
    out = []
    for drug in ORDER:
        (n0, r0), (n1, r1) = nr(a, drug), nr(b, drug)
        if min(n0, n1) < 30: continue
        p0, p1 = r0 / n0, r1 / n1; pp = (r0 + r1) / (n0 + n1)
        z = (p1 - p0) / math.sqrt(max(1e-12, pp * (1 - pp) * (1 / n0 + 1 / n1)))
        out.append({"drug": drug, "n0": n0, "r0": r0, "n1": n1, "r1": r1, "p0": p0, "p1": p1,
                    "volume": (n1 - n0) * (p0 + p1) / 2, "share": (p1 - p0) * (n0 + n1) / 2, "p": p_two(z)})
    out = [x for x in out if x["r0"] + x["r1"] >= 20]
    if not out or max(abs(x["r1"] - x["r0"]) for x in out) < 5: return None
    for x, q in zip(out, bh([x["p"] for x in out])): x["q"] = q; x["sure"] = sure(q, x["p"])
    out.sort(key=lambda x: -abs(x["r1"] - x["r0"]))
    return {"id": "volume", "org": SHORT(org), "spec": spec, "windows": [window(*y1), window(*y0)], "drugs": out[:6]}


def unusual_wards(asof):
    """Is any ward unusual for itself? New resistant cases (ESBL, MRSA, VRE, CPE; first per patient and type) in the
    last 4 weeks against the ward's own previous 48 weeks: Poisson tail, 95% expected range, BH across wards."""
    wo = evidence.wards_overview(str(asof))
    recent_lo = asof - timedelta(days=28)
    types = defaultdict(Counter)
    for c in wo["cases"]:
        if c["date"] > str(recent_lo): types[c["ward"]][c["flags"][0]] += 1
    wards = []
    for w in wo["wards"]:
        lam = max(w["expected"], .25)
        wards.append({"ward": w["code"], "name": w["name"], "n": w["recent"], "expected": w["expected"], "range": pois_range(lam),
                      "flagged": w["recent"] >= 3 and w["z"] > 2,          # the app's own rule (Morning brief, Ward overview)
                      "p": pois_sf(w["recent"], lam), "weekly": w["weekly"], "types": dict(types[w["code"]])})
    if not any(w["n"] >= 3 for w in wards): return None
    for w, q in zip(wards, bh([w["p"] for w in wards])):
        w["q"] = q; w["sure"] = sure(q, w["p"], w["n"] >= 3)
        w["years"] = round(1 / (w["p"] * 13), 1) if w["p"] > 0 else None     # 13 four-week periods a year
    wards.sort(key=lambda w: (w["sure"] != "clear", not w["flagged"], w["p"]))
    return {"id": "unusual", "windows": [window(recent_lo, asof), window(asof - timedelta(days=365 + 28), recent_lo)], "wards": wards}


def quiet_weeks(src, asof):
    """Is a quiet week a real zero? Cultures of any kind per ward per week over the last year, against the ward's median
    of the 26 weeks before each week. A week is a gap when that few would be very unlikely (Poisson, below 1 in 1,000)."""
    weeks = 52
    lo = asof - timedelta(days=WEEK * (weeks + 26))
    vol = defaultdict(Counter)
    for c in src["cultures"]:
        d = c["_date"]
        if d <= lo or d > asof: continue
        vol[c["ward_code"]][(asof - d).days // WEEK] += 1        # 0 = the week ending today
    if (asof - src["start"]).days < WEEK * (weeks + 26): weeks = max(8, (asof - src["start"]).days // WEEK - 26)
    rows, gaps = [], []
    for w in src["wards"]:
        cells = []
        for k in range(weeks - 1, -1, -1):
            base = [vol[w][k + j] for j in range(1, 27)]
            usual = statistics.median(base); n = vol[w][k]
            p = pois_cdf(n, usual) if usual >= 10 else 1.0
            cell = {"k": k, "end": str(asof - timedelta(days=WEEK * k)), "n": n, "usual": usual, "gap": p < .001}
            cells.append(cell)
            if cell["gap"]: gaps.append({"ward": w, **cell, "p": p})
        rows.append({"ward": w, "cells": cells})
    if not gaps: return None
    gaps.sort(key=lambda g: (g["n"] / max(g["usual"], 1), g["end"]))
    return {"id": "quiet", "windows": [window(asof - timedelta(days=WEEK * weeks), asof)], "weeks": weeks, "rows": rows, "gaps": gaps}


def late_results(asof):
    """Are results arriving late? From the live feed only: days from sample to result for every susceptibility result
    delivered in the last 4 weeks, per ward; late batches are results more than 10 days after the sample."""
    if not FEED.run or asof <= data.source()["end"]: return None
    lo = asof - timedelta(days=28)
    per = defaultdict(list); batches = Counter()
    for d in FEED.run.deliveries:
        k = d["known_at"].date()
        if k <= lo or k > asof or d["kind"] != "susceptibility": continue
        days = (d["known_at"] - d["event_at"]).total_seconds() / 86400
        per[d["ward"]].append(days)
        if days > 10: batches[(d["ward"], str(k))] += 1
    if sum(len(v) for v in per.values()) < 30: return None
    def q(v, p): v = sorted(v); return v[min(len(v) - 1, int(p * len(v)))]
    wards = [{"ward": w, "n": len(v), "median": statistics.median(v), "p90": q(v, .9), "late": sum(1 for x in v if x > 7) / len(v),
              "sample": sorted(random.Random(7).sample(v, min(60, len(v))))} for w, v in per.items()]
    allv = [x for v in per.values() for x in v]
    wards.sort(key=lambda w: -w["p90"])
    return {"id": "late", "windows": [window(lo, asof)], "median": statistics.median(allv), "after7": sum(1 for x in allv if x > 7) / len(allv),
            "n": len(allv), "wards": wards, "batches": [{"ward": w, "day": d, "n": n} for (w, d), n in batches.most_common(5) if n >= 5]}


def linked_cases(recs, asof):
    """Is this cluster more than chance? For each active cluster: how rare its resistance pattern is among the year's
    isolates of that organism, and a Monte Carlo scan test of how tightly its cases bunch in time within the year."""
    wo = evidence.wards_overview(str(asof))
    clusters = [c for c in evidence._clusters(wo["cases"], asof) if c["status"] != "over"][:3]
    if not clusters: return None
    year = first(recs, asof - timedelta(days=YEAR), asof)
    rng = random.Random(11); out = []
    for cl in clusters:
        org = next((r["org"] for r in year if SHORT(r["org"]) == cl["organism"]), None)
        drugs = [(code, ch) for code, ch in zip(ORDER, cl["fp"]) if ch in "SR"]
        pool = [r for r in year if r["org"] == org and all(r["res"].get(code) in ("S", "R") for code, _ in drugs)]
        match = [r for r in pool if all(r["res"][code] == ch for code, ch in drugs)]
        same = sorted((c for c in wo["cases"] if c["fp"] + c["short"] == cl["key"] and tuple(c["flags"]) == tuple(cl["flags"])
                       and c["date"] > str(asof - timedelta(days=YEAR))), key=lambda c: c["date"])
        days = sorted((asof - __import__("datetime").date.fromisoformat(c["date"])).days for c in same)
        def densest(ds):
            best, j = 0, 0
            for i in range(len(ds)):
                while ds[i] - ds[j] >= 28: j += 1
                best = max(best, i - j + 1)
            return best
        obs = densest(days); k = len(days); sims = 1999
        hits = sum(1 for _ in range(sims) if densest(sorted(rng.randrange(YEAR) for _ in range(k))) >= obs)
        p = (1 + hits) / (1 + sims)
        # the densest 28 days, as dates, for the chart
        j = 0; best = (0, 0)
        for i in range(len(days)):
            while days[i] - days[j] >= 28: j += 1
            if i - j + 1 > best[1] - best[0]: best = (j, i + 1)
        dense = [str(asof - timedelta(days=days[best[1] - 1])), str(asof - timedelta(days=days[best[0]]))] if days else None
        weekly = [0] * 52
        for r in year:
            if r["org"] == org: weekly[min(51, (asof - r["d"]).days // WEEK)] += 1
        out.append({"organism": cl["organism"], "flags": cl["flags"], "status": cl["status"], "fp": cl["fp"], "since": cl["since"],
                    "n": k, "in28": obs, "p": p, "sure": sure(p, p), "pool": len(pool), "match": len(match),
                    "wards": Counter(c["ward"] for c in same).most_common(), "hospital": sum(1 for c in same if (c["hday"] or 0) >= 3),
                    "cases": [{"date": c["date"], "ward": c["ward"], "hday": c["hday"]} for c in same], "dense": dense,
                    "background": weekly[::-1], "drugs": [code for code, _ in drugs]})
    return {"id": "linked", "windows": [window(asof - timedelta(days=YEAR), asof)], "clusters": out}


def rules_still_hold(recs, asof, start):
    """Do our rules still hold? Pairs of drugs whose resistance went together in the earlier period (odds ratio at least
    1.5, interval above 1): is the link still there in the last year? Ratio of odds ratios, BH across pairs."""
    org, spec = "Escherichia coli", "urine"
    now = (asof - timedelta(days=YEAR), asof)
    lo = max(start - timedelta(days=1), asof - timedelta(days=3 * YEAR))
    if (now[0] - lo).days < 180: return None
    before = (lo, now[0])
    A, B = first(recs, *before, spec, org), first(recs, *now, spec, org)
    def table(rows, a, b):
        t = [[0, 0], [0, 0]]
        for r in rows:
            x, y = r["res"].get(a), r["res"].get(b)
            if x in ("S", "R") and y in ("S", "R"): t[x == "R"][y == "R"] += 1
        return t
    def lor(t):
        (a, b), (c, d) = [[v + .5 for v in row] for row in t]
        return math.log(a * d / (b * c)), 1 / a + 1 / b + 1 / c + 1 / d
    pairs = []
    for i, x in enumerate(ORDER):
        for y in ORDER[:i]:                      # x is the broader drug: "if x fails, does y fail too?"
            t0, t1 = table(A, x, y), table(B, x, y)
            if min(sum(t0[1]), sum(t0[0]), sum(t1[1]), sum(t1[0])) < 30: continue
            l0, v0 = lor(t0); l1, v1 = lor(t1)
            cond = lambda t: [t[1][1] / sum(t[1]), t[0][1] / sum(t[0])]     # P(y fails | x fails), P(y fails | x works)
            c0 = cond(t0)
            # an established rule: a clear link before (odds ratio at least 1.5, interval above 1) that mattered (y failed in 10%+ when x failed),
            # and not simply the same drug class failing together almost always (y failed in under 90% when x failed)
            if l0 - 1.96 * math.sqrt(v0) <= 0 or math.exp(l0) < 1.5 or not .1 <= c0[0] < .9: continue
            z = (l1 - l0) / math.sqrt(v0 + v1)
            pairs.append({"a": x, "b": y, "before": {"or": math.exp(l0), "ci": [math.exp(l0 - 1.96 * math.sqrt(v0)), math.exp(l0 + 1.96 * math.sqrt(v0))], "cond": cond(t0), "n": [sum(t0[1]), sum(t0[0])]},
                          "now": {"or": math.exp(l1), "ci": [math.exp(l1 - 1.96 * math.sqrt(v1)), math.exp(l1 + 1.96 * math.sqrt(v1))], "cond": cond(t1), "n": [sum(t1[1]), sum(t1[0])]},
                          "p": p_two(z)})
    if not pairs: return None
    for p, q in zip(pairs, bh([p["p"] for p in pairs])):         # corrected across every established rule, not just the ones shown
        p["q"] = q; still = p["now"]["ci"][0] > 1
        p["state"] = "holds" if q >= .05 else ("weaker" if still else "gone")
    pairs.sort(key=lambda p: ({"gone": 0, "weaker": 1, "holds": 2}[p["state"]], p["q"]))
    n_rules = len(pairs); pairs = pairs[:6]
    return {"id": "rules", "org": SHORT(org), "spec": spec, "windows": [window(*before), window(*now)], "pairs": pairs, "n_rules": n_rules}


# ================================================================ doctor
def who_changes_odds(recs, asof, spec, start):
    """Does who the patient is change the odds? Two years of first isolates of the commonest organism for this sample,
    women against men (standardised for age group and ward) and 65+ against under 65 (standardised for sex and ward)."""
    lo = max(start - timedelta(days=1), asof - timedelta(days=2 * YEAR))
    rows = first(recs, lo, asof, spec)
    if not rows: return None
    org = Counter(r["org"] for r in rows).most_common(1)[0][0]
    rows = [r for r in rows if r["org"] == org]
    dims = {}
    for dim, split, key, labels in (("sex", lambda r: r["sex"] == "M", lambda r: (age_band(r["age"]), r["ward"]), ["F", "M"]),
                                    ("age", lambda r: r["age"] >= 65, lambda r: (r["sex"], r["ward"]), ["<65", "65+"])):
        g0, g1 = [r for r in rows if not split(r)], [r for r in rows if split(r)]
        out = []
        for drug in ORDER:
            if min(nr(g0, drug)[0], nr(g1, drug)[0]) < 30: continue
            st = standardised(g0, g1, drug, key)
            if st: out.append({"drug": drug, **st})
        for x, q in zip(out, bh([x["p"] for x in out])): x["q"] = q; x["sure"] = sure(q, x["p"], abs(x["diff"]) >= .02)
        if out: dims[dim] = {"labels": labels, "drugs": out}
    if not dims: return None
    return {"id": "who", "org": SHORT(org), "spec": spec, "windows": [window(lo, asof)], "dims": dims}


def before_the_lab(src, asof, spec, ward):
    """Before the lab names the organism, how often does it work? The first positive culture per patient in the last
    year: works for every organism grown, fails for at least one, or not tested for some. Ward if it has 200 cultures."""
    lo = asof - timedelta(days=YEAR)
    def cultures(w):
        seen, out = set(), []
        for c in src["cultures"]:
            if c["_date"] <= lo or c["_date"] > asof or c["specimen"] != spec or c["result"] != "positive": continue
            if w and c["ward_code"] != w: continue
            if c["patient_id"] in seen: continue
            isos = src["isolates"].get(c["culture_id"], [])
            if not isos: continue
            seen.add(c["patient_id"])
            out.append([(i["organism"], {s["antibiotic_code"]: s["result"] for s in src["sus"].get(i["isolate_id"], [])}) for i in isos])
        return out
    cs = cultures(ward); scope = "ward"
    if len(cs) < 200: cs = cultures(None); scope = "hospital"
    if len(cs) < 60: return None
    orgs = Counter(o for c in cs for o, _ in c)
    drugs = []
    for drug in ORDER:
        works = fails = untested = 0
        for c in cs:
            rs = [res.get(drug) for _, res in c]
            if "R" in rs: fails += 1
            elif all(x == "S" for x in rs): works += 1
            else: untested += 1
        if works + fails < max(30, .3 * len(cs)): continue
        by_org = {}
        for o, k in orgs.most_common(6):
            t = [res[drug] for c in cs for oo, res in c if oo == o and res.get(drug) in ("S", "R")]
            if len(t) >= 20: by_org[SHORT(o)] = {"n": len(t), "works": sum(1 for x in t if x == "S") / len(t)}
        drugs.append({"drug": drug, "n": len(cs), "works": works, "fails": fails, "untested": untested, "by_org": by_org})
    if not drugs: return None
    never = sorted([{"org": o, "drug": d["drug"], "n": v["n"]} for d in drugs for o, v in d["by_org"].items() if v["works"] <= .05],
                   key=lambda x: -x["n"])[:4]
    return {"id": "unknown", "spec": spec, "scope": scope, "ward": ward, "windows": [window(lo, asof)], "n": len(cs),
            "organisms": [{"org": SHORT(o), "n": k, "share": k / sum(orgs.values())} for o, k in orgs.most_common(6)], "drugs": drugs, "never": never}


def year_or_month(recs, asof, spec, ward):
    """Is the last month a better guide than the year? A rolling back-test over the last 13 four-week windows: each
    window's results predicted from the 52 weeks before it, or from the 4 weeks before it. Lower log loss wins."""
    def rate(rows, drug, prior=1):
        n, r = nr(rows, drug); return (r + prior) / (n + 2 * prior), n, r
    wins = []
    ends = [asof - timedelta(days=28 * k) for k in range(12, -1, -1)]
    cache = {}
    def rows(lo, hi):
        if (lo, hi) not in cache: cache[(lo, hi)] = first(recs, lo, hi, spec, None, ward)
        return cache[(lo, hi)]
    year_now = rows(asof - timedelta(days=YEAR), asof)
    for drug in ORDER:
        if nr(year_now, drug)[0] < 30: continue
        ll_y = ll_m = 0.0; m = 0; series = []
        for e in ends:
            test = tested(rows(e - timedelta(days=28), e), drug)
            py, ny, ry = rate(rows(e - timedelta(days=28 + YEAR), e - timedelta(days=28)), drug)
            pm, nm, rm = rate(rows(e - timedelta(days=56), e - timedelta(days=28)), drug)
            for r in test:
                y = r["res"][drug] == "R"
                ll_y -= math.log(py if y else 1 - py); ll_m -= math.log(pm if y else 1 - pm); m += 1
            series.append({"end": str(e), "n": len(test), "r": sum(1 for r in test if r["res"][drug] == "R"), "year": py, "month": pm})
        if m < 30: continue
        n, r = nr(year_now, drug); n4, r4 = nr(rows(asof - timedelta(days=28), asof), drug)
        p = r / n; steady = (r4 + 40 * p) / (n4 + 40)          # the last 4 weeks, steadied with the year (prior strength 40)
        wins.append({"drug": drug, "ll_year": ll_y / m, "ll_month": ll_m / m, "year_better": ll_y < ll_m, "tested": m, "series": series,
                     "year": {"n": n, "r": r, "share": p, "ci": wilson(r, n)}, "month": {"n": n4, "r": r4}, "steady": steady})
    if len(wins) < 2: return None
    return {"id": "guide", "spec": spec, "ward": ward, "windows": [window(ends[0] - timedelta(days=28), asof)],
            "drugs": wins, "year_wins": sum(1 for w in wins if w["year_better"])}


def what_else_fails(recs, asof, spec):
    """If it's resistant to one drug, what else fails? All organisms in this sample type, first isolates in the last
    year: for each drug A and each other drug B, how often B fails when A fails, against when A works."""
    rows = first(recs, asof - timedelta(days=YEAR), asof, spec)
    prev = first(recs, asof - timedelta(days=2 * YEAR), asof - timedelta(days=YEAR), spec)
    drugs = [d for d in ORDER if nr(rows, d)[0] >= max(60, .3 * len(rows))]
    if len(drugs) < 3: return None
    def cond(rr, a, b):
        fa = [r for r in rr if r["res"].get(a) == "R" and r["res"].get(b) in ("S", "R")]
        wa = [r for r in rr if r["res"].get(a) == "S" and r["res"].get(b) in ("S", "R")]
        return len(fa), sum(1 for r in fa if r["res"][b] == "R"), len(wa), sum(1 for r in wa if r["res"][b] == "R")
    cells = []
    for a in drugs:
        for b in drugs:
            if a == b: continue
            nf, rf, nw, rw = cond(rows, a, b)
            if nf < 20 or nw < 20: continue
            pf, pw = rf / nf, rw / nw; pp = (rf + rw) / (nf + nw)
            z = (pf - pw) / math.sqrt(max(1e-12, pp * (1 - pp) * (1 / nf + 1 / nw)))
            pnf, prf, _, _ = cond(prev, a, b)
            cells.append({"a": a, "b": b, "if_fails": pf, "if_works": pw, "n_fails": nf, "n_works": nw, "ci": wilson(rf, nf), "p": p_two(z),
                          "before": prf / pnf if pnf >= 20 else None})
    if not cells: return None
    for c, q in zip(cells, bh([c["p"] for c in cells])): c["q"] = q; c["sure"] = sure(q, c["p"], c["if_fails"] - c["if_works"] >= .05)
    return {"id": "fails", "spec": spec, "windows": [window(asof - timedelta(days=YEAR), asof)], "drugs": drugs, "cells": cells}


def colleagues(ward, spec, recs, asof):
    """What do colleagues start for cases like this? De-identified decisions on this ward from narrated notes, each set
    against how often that drug worked here over the last year. Shown only once there are at least 3 decisions."""
    import narrative
    kg = narrative.KNOWLEDGE_GRAPH
    if ("Ward", ward) not in kg.tags: return None
    notes = [n for n in kg.find([("Ward", ward)], limit=500) if (n.get("fields") or {}).get("kind") == "decision" and (n.get("fields") or {}).get("drug")]
    if len(notes) < 3: return None
    rows = first(recs, asof - timedelta(days=YEAR), asof, spec, None, ward)
    by = Counter(n["fields"]["drug"] for n in notes)
    out = []
    for drug, k in by.most_common():
        n, r = nr(rows, drug)
        out.append({"drug": drug, "decisions": k, "n": n, "works": (n - r) / n if n >= 30 else None})
    return {"id": "colleagues", "ward": ward, "windows": [window(asof - timedelta(days=YEAR), asof)], "n": len(notes), "drugs": out,
            "months": Counter(n["fields"].get("month", "") for n in notes).most_common()}


# ================================================================ assembly
GROUPS = {
    "hygiene": [("rising", ["losing", "volume", "unusual"]), ("trust", ["quiet", "late"]), ("linked", ["linked"]), ("rules", ["rules"])],
    "doctor": [("patient", ["who", "unknown", "guide"]), ("fails", ["fails"]), ("colleagues", ["colleagues"])],
}


def insights(role, asof=None, ward="URO", spec="urine"):
    src = FEED.view() if not asof else FEED.view(__import__("datetime").date.fromisoformat(asof))
    asof = src["end"]; start = src["start"]; recs = records(src)
    def safe(f, *a):
        try: return f(*a)
        except Exception as e:                       # one failing question never takes the page down
            return {"id": f.__name__, "error": str(e)}
    if role == "doctor":
        found = {x["id"]: x for x in [safe(who_changes_odds, recs, asof, spec, start), safe(before_the_lab, src, asof, spec, ward),
                                      safe(year_or_month, recs, asof, spec, ward), safe(what_else_fails, recs, asof, spec),
                                      safe(colleagues, ward, spec, recs, asof)] if x and "error" not in x}
    else:
        role = "hygiene"
        found = {x["id"]: x for x in [safe(drugs_losing_ground, recs, asof, start), safe(cases_or_samples, recs, asof, start), safe(unusual_wards, asof),
                                      safe(quiet_weeks, src, asof), safe(late_results, asof), safe(linked_cases, recs, asof),
                                      safe(rules_still_hold, recs, asof, start)] if x and "error" not in x}
    groups = [{"id": g, "items": [found[i] for i in ids if i in found]} for g, ids in GROUPS[role]]
    return {"role": role, "asof": str(asof), "source": "feed" if asof > data.source()["end"] else "data", "ward": ward, "spec": spec,
            "groups": [g for g in groups if g["items"]]}
