"""Everything the dashboard reads from a generated run: time bins (for plots and the live stream), tables, CSV and the feed zip."""
import bisect, csv, io, json, zipfile
from collections import Counter, defaultdict
from datetime import timedelta

from . import data

SIZES = {"hour": timedelta(hours=1), "day": timedelta(days=1), "week": timedelta(days=7)}
NOTABLE = lambda d: d["origin"] != "replayed" and d["origin"] != "new" or any(t not in ("A1", "N") for t in d["tags"])
iso = lambda t: t.strftime("%Y-%m-%dT%H:%M")


def describe(d):
    r, k = d["row"], d["kind"]
    w = d["ward"]
    if k == "culture received": return f'{w} · {r["specimen"]} culture {d["key"]} received'
    if k == "culture result": return f'{w} · {d["key"]} {r["result"].replace("_", " ")}'
    if k == "organism identified": return f'{w} · {r["organism"]} (preliminary)'
    if k == "organism corrected": return f'{w} · organism corrected to {r["organism"]}'
    if k == "isolate final": return f'{w} · {r["organism"]} final' + "".join(f' · {f.upper()}' for f in data.FLAGS if r.get(f) == "1")
    if k == "susceptibility": return f'{w} · {r["organism"].split()[0][0]}. {r["organism"].split()[-1]} {r["antibiotic_code"]} {r["result"]}'
    if k == "susceptibility corrected": return f'{w} · {r["antibiotic_code"]} corrected to {r["result"]}'
    if k == "culture cancelled": return f'{w} · culture {d["key"]} cancelled'
    if k == "duplicate": return f'{w} · duplicate of seq {d.get("seq", "")}'
    return k


class Views:
    def __init__(self, run):
        self.run = run
        self.start, self.end = run.start, run.end
        span = defaultdict(lambda: [None, None])      # culture -> first and last time anything about it arrived
        for d in run.deliveries:
            if d["kind"] in ("duplicate", "susceptibility corrected", "culture cancelled"): continue
            cid = d["row"]["culture_id"]; s = span[cid]
            s[0] = d["known_at"] if s[0] is None else min(s[0], d["known_at"]); s[1] = d["known_at"] if s[1] is None else max(s[1], d["known_at"])
        self.opened = sorted(v[0] for v in span.values())
        self.closed = sorted(max(v[1], run.complete_at.get(cid, v[1])) for cid, v in span.items())   # finishing after the window still counts as waiting
        self._bins = {}

    def backlog(self, t):
        return bisect.bisect_right(self.opened, t) - bisect.bisect_right(self.closed, t)

    def bins(self, size):
        if size in self._bins: return self._bins[size]
        step = SIZES[size]; n = int((self.end - self.start) / step) + 1
        out = [{"i": i, "t": iso(self.start + i * step), "kinds": Counter(), "origin": Counter(), "tags": Counter(), "wards": Counter(),
                "points": [], "ticker": [], "rows": 0} for i in range(n)]
        cap = {"hour": 12, "day": 40, "week": 120}[size]
        for d in self.run.deliveries:
            b = out[int((d["known_at"] - self.start) / step)]
            b["rows"] += 1; b["kinds"][d["kind"]] += 1; b["origin"][d["origin"]] += 1; b["wards"][d["ward"]] += 1
            for t in d["tags"]:
                if t not in ("A1",): b["tags"][t] += 1
            note = NOTABLE(d)
            if d["kind"] in ("susceptibility", "culture result", "susceptibility corrected", "organism corrected", "culture cancelled") and (note or len(b["points"]) < cap):
                if len(b["points"]) < cap * 2:
                    b["points"].append([iso(d["event_at"]), iso(d["known_at"]), d["kind"], d["origin"], next((t for t in d["tags"] if t not in ("A1", "N")), ""), d["ward"]])
            if note and len(b["ticker"]) < 6: b["ticker"].append([iso(d["known_at"]), describe(d), next((t for t in d["tags"] if t not in ("A1", "N")), d["origin"])])
        for i, b in enumerate(out):
            b["backlog"] = self.backlog(self.start + (i + 1) * step)
        self._bins[size] = out
        return out

    def ordinary_ticker(self, size):
        """A few ordinary deliveries per bin, so the live ticker shows normal traffic as well as the notable rows."""
        step = SIZES[size]; per = defaultdict(list)
        for d in self.run.deliveries:
            i = int((d["known_at"] - self.start) / step)
            if len(per[i]) < 3 and not NOTABLE(d): per[i].append([iso(d["known_at"]), describe(d), d["origin"]])
        return per

    def delays(self):
        """Hours from sample to S/R arriving, per specimen, for the generated stream."""
        hist = defaultdict(lambda: [0] * 21)
        for d in self.run.deliveries:
            if d["kind"] == "susceptibility" and d["revision"] == 1 and not ({"A2", "A4"} & set(d["tags"])):
                h = (d["known_at"] - d["event_at"]).total_seconds() / 3600
                hist[d["row"].get("organism") and self.spec_of(d)][min(20, int(h // 12))] += 1
        with open(data.OUT / "mimic_delays.csv", encoding="utf-8") as fh:
            med = {r["specimen"]: float(r["median_h"]) for r in csv.DictReader(fh) if r["stage"] == "3 susceptibility"}
        return {"bin_hours": 12, "hist": hist, "mimic_median_h": {s: med[s] for s in ("urine", "blood", "wound") if s in med}}

    def spec_of(self, d):
        if not hasattr(self, "_spec"):
            self._spec = {c[0]["culture_id"]: c[0]["specimen"] for c in self.run.cases}
        return self._spec.get(d["row"]["culture_id"], "other")

    # ---------- tables ----------
    def table(self, name, f):
        run = self.run
        if name == "deliveries":
            cols = ["seq", "batch_id", "received_at", "kind", "table", "key", "op", "revision", "status", "origin", "tags", "ward", "sample_date",
                    "organism", "antibiotic_code", "result"]
            def rows():
                for d in run.deliveries:
                    r = d["row"]
                    yield {"seq": d["seq"], "batch_id": d["batch_id"], "received_at": iso(d["known_at"]), "kind": d["kind"], "table": d["table"], "key": d["key"],
                           "op": d["op"], "revision": d["revision"], "status": d["status"], "origin": d["origin"], "tags": " ".join(t for t in d["tags"] if t != "A1"),
                           "ward": d["ward"], "sample_date": d["event_at"].date().isoformat(), "organism": r.get("organism", ""),
                           "antibiotic_code": r.get("antibiotic_code", ""), "result": r.get("result", "")}
        elif name in ("cultures", "isolates", "susceptibility"):
            base = {"cultures": data.CULTURE_COLS, "isolates": data.ISOLATE_COLS, "susceptibility": data.SUS_COLS}[name]
            cols = base + ["origin", "status", "revision", "tags"]
            wards = {c[0]["culture_id"]: c[0]["ward_code"] for c in run.cases}
            def rows():
                for r in run.final[name]:
                    yield dict(r, ward=r.get("ward_code") or wards.get(r["culture_id"], ""))
        elif name == "truth":
            cols = ["code", "label", "group", "mechanism", "count", "ward", "start", "end"]
            rows = lambda: iter(run.truth_list)
        elif name == "batches":
            cols = ["batch_id", "rows", "cultures", "isolates", "susceptibility", "duplicates", "tags"]
            def rows():
                g = defaultdict(lambda: Counter())
                for d in run.deliveries:
                    c = g[d["batch_id"]]; c["rows"] += 1; c[d["table"]] += 1
                    if d["kind"] == "duplicate": c["duplicates"] += 1
                    for t in d["tags"]:
                        if t != "A1": c["tag:" + t] += 1
                for b, c in g.items():
                    yield {"batch_id": b, **{k: c.get(k, 0) for k in ("rows", "cultures", "isolates", "susceptibility", "duplicates")},
                           "tags": " ".join(f'{k[4:]}×{v}' for k, v in c.items() if k.startswith("tag:"))}
        elif name == "checks":
            cols = ["check", "ok", "detail"]; rows = lambda: iter(run.check_results)
        else:
            raise KeyError(name)

        def keep(r):
            if f.get("origin") and r.get("origin") != f["origin"]: return False
            if f.get("tag") and f["tag"] not in str(r.get("tags", "")).split() and r.get("code") != f["tag"]: return False
            if f.get("kind") and r.get("kind") != f["kind"]: return False
            if f.get("ward") and r.get("ward", r.get("ward_code")) != f["ward"]: return False
            if f.get("q") and f["q"].lower() not in " ".join(str(v) for v in r.values()).lower(): return False
            return True
        return cols, (r for r in rows() if keep(r))

    def page(self, name, f, offset, limit):
        cols, it = self.table(name, f)
        rows, total = [], 0
        for r in it:
            if offset <= total < offset + limit: rows.append([r.get(c, "") for c in cols])
            total += 1
        return {"columns": cols, "rows": rows, "total": total}

    def csv(self, name, f):
        cols, it = self.table(name, f)
        buf = io.StringIO(); w = csv.writer(buf, lineterminator="\n")
        w.writerow([f"# SIMULATED feed data, not real lab results. Recipe: {json.dumps(self.run.recipe)}"])
        w.writerow(cols)
        for r in it: w.writerow([r.get(c, "") for c in cols])
        return buf.getvalue()

    def feed_zip(self):
        """The feed as a lab system would drop it: one folder per day, one CSV per table, a manifest, plus the truth file."""
        run, mem = self.run, io.BytesIO()
        by_day = defaultdict(lambda: defaultdict(list))
        for d in run.deliveries: by_day[d["known_at"].date().isoformat()][d["table"]].append(d)
        cols = {"cultures": data.CULTURE_COLS, "isolates": data.ISOLATE_COLS, "susceptibility": data.SUS_COLS}
        with zipfile.ZipFile(mem, "w", zipfile.ZIP_DEFLATED) as z:
            z.writestr("README.txt", "SIMULATED incoming lab feed generated from the Tyks synthetic dataset.\n"
                       "Each day folder holds what the lab system sent that day. Extra columns: batch_id, received_at, op, revision, status.\n"
                       "truth.json lists every injected fault and event. A receiving tool must not read it; only evaluation does.\n")
            z.writestr("recipe.json", json.dumps(run.recipe, indent=2))
            z.writestr("truth.json", json.dumps(run.truth_list, indent=2, default=str))
            z.writestr("checks.json", json.dumps(run.check_results, indent=2))
            for day, tables in sorted(by_day.items()):
                sep = ";" if run.batch_format.get(day) == "semicolon" else ","
                manifest = {"day": day, "format": "semicolon" if sep == ";" else "comma", "files": {}}
                for t, ds in tables.items():
                    buf = io.StringIO(); w = csv.writer(buf, delimiter=sep, lineterminator="\n")
                    w.writerow(["batch_id", "received_at", "op", "revision", "status"] + cols[t])
                    for d in ds: w.writerow([d["batch_id"], iso(d["known_at"]), d["op"], d["revision"], d["status"]] + [d["row"].get(c, "") for c in cols[t]])
                    z.writestr(f"feed/{day}/{t}.csv", buf.getvalue()); manifest["files"][f"{t}.csv"] = len(ds)
                z.writestr(f"feed/{day}/manifest.json", json.dumps(manifest, indent=2))
        return mem.getvalue()

    def summary(self):
        run = self.run
        return {"recipe": run.recipe, "start": iso(self.start), "end": iso(self.end), "deliveries": len(run.deliveries),
                "cases": Counter(c[3] for c in run.cases), "final": {k: len(v) for k, v in run.final.items()},
                "kinds": Counter(d["kind"] for d in run.deliveries), "truth": run.truth_list, "checks": run.check_results,
                "wards": sorted(data.source()["wards"]), "contrib": self.contrib()}

    def contrib(self):
        """How much each source shaped this run, in the units it was used."""
        run, cases = self.run, Counter(c[3] for c in self.run.cases)
        staged = sum(1 for d in run.deliveries if d["kind"] != "duplicate")
        return [
            {"source": "tyks", "label": "Replayed cases", "n": cases["replayed"], "unit": "cases"},
            {"source": "tyks", "label": "New cases", "n": cases["new"], "unit": "cases"},
            {"source": "tyks", "label": "Events added", "n": cases["injected"], "unit": "cases"},
            {"source": "mimic", "label": "Arrival times", "n": staged, "unit": "deliveries"},
            {"source": "armd", "label": "Returning patients", "n": run.stats["returning_armd"], "unit": "cases"},
            {"source": "armd", "label": "Odd results added", "n": run.truth.get("E3", {}).get("count", 0), "unit": "results"},
        ]
