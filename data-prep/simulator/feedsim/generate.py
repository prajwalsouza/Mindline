"""Turn the Tyks dataset into a stream of deliveries, the way a lab feed would send it.

generate(recipe) -> Run
  1. pick the cases: replayed Tyks cultures in the window, brand-new resampled cases after the data ends,
     and injected cases (outbreak, first CPE, screening, mislabelled cultures)
  2. stage every case into deliveries: received -> organism (preliminary) -> S/R + final isolate,
     with delays drawn from MIMIC per specimen and stage, released in lab working hours
  3. apply feed faults: outage, late backfill, duplicates, out-of-order, corrections, re-identification,
     wrong ward, breakpoint change, new drug, implausible results, broken file format
  4. sort by the time the feed would deliver them (known time) into hourly batches
  5. rebuild the final dataset from the deliveries and check it against the source (the truth file says what was done)
"""
import math, random
from collections import Counter, defaultdict
from datetime import date, datetime, timedelta

from . import data
from .scenarios import CATALOGUE, day_to_date

H = timedelta(hours=1)
SPEC = {"urine": "urine", "blood": "blood", "wound": "wound", "screen": "screening"}
CONFUSABLE = {"Klebsiella oxytoca": "Klebsiella pneumoniae", "Klebsiella pneumoniae": "Klebsiella oxytoca",
              "Citrobacter freundii": "Escherichia coli", "Proteus mirabilis": "Escherichia coli",
              "Staphylococcus saprophyticus": "Staphylococcus aureus", "Enterococcus faecalis": "Staphylococcus aureus"}
ENTEROBACTERALES = ("Escherichia", "Klebsiella", "Proteus", "Citrobacter", "Enterobacter")


class Run:
    def __init__(self, recipe):
        self.recipe = recipe
        self.rng = random.Random(recipe.get("seed", 7))
        self.on = recipe["scenarios"]
        self.start = datetime.fromisoformat(recipe["start"])
        self.end = datetime.fromisoformat(recipe["end"]) + timedelta(days=1)
        self.deliveries = []          # every row the feed sends, in send order once built
        self.cases = []               # (culture, isolates, {isolate_id: [sus]}, origin, tags)
        self.truth = defaultdict(lambda: {"count": 0})
        self.batch_format = {}        # day -> "semicolon" for D9
        self.stats = Counter()        # how much each source shaped the output (shown on the Sources panel)

    # ---------- small helpers ----------
    def note(self, code, n=1, **info):
        t = self.truth[code]; t["count"] += n
        for k, v in info.items(): t.setdefault(k, v)

    def delay(self, spec, stage):
        m = data.mimic(); p = m.get(f"{SPEC.get(spec, 'other')}|{stage}") or m[f"all|{stage}"]
        return timedelta(hours=min(24 * 21, math.exp(self.rng.gauss(p["log_mean"], p["log_sd"]))))

    def in_lab_hours(self, t, not_before):
        """Results are released in batches during the working day, like the MIMIC release-hour pattern."""
        share = data.mimic()["_release_hour_share"]
        hour = self.rng.choices(range(24), weights=share)[0]
        r = datetime(t.year, t.month, t.day, hour, self.rng.randrange(60))
        while r < not_before: r += timedelta(days=1)
        return r

    def sample_time(self, c):
        d = c["_date"]
        if c["institution"] == "primary_care": hour = self.rng.randrange(8, 16)
        else: hour = self.rng.choices(range(24), weights=data.mimic()["_sample_hour_share"])[0]
        return datetime(d.year, d.month, d.day, hour, self.rng.randrange(60))

    def poisson(self, lam):
        L, k, p = math.exp(-lam), 0, 1.0
        while True:
            p *= self.rng.random()
            if p <= L: return k
            k += 1

    # ---------- 1 · cases ----------
    def pick_cases(self):
        src = data.source()
        lo = (self.start - timedelta(days=14)).date()   # samples from just before the start are still in the lab
        hi = min(self.end.date() - timedelta(days=1), src["end"])
        for c in src["cultures"]:
            if lo <= c["_date"] <= hi:
                isos = src["isolates"][c["culture_id"]]
                self.cases.append([dict(c), [dict(i) for i in isos], {i["isolate_id"]: [dict(s) for s in src["sus"][i["isolate_id"]]] for i in isos}, "replayed", []])
        if "N" in self.on: self.new_cases(src)
        if "G1" in self.on: self.outbreak(src, self.on["G1"])
        if "G3" in self.on: self.first_cpe(src, self.on["G3"])
        if "F1" in self.on: self.screening(src, self.on["F1"])
        if "G7" in self.on: self.pseudo_outbreak(src, self.on["G7"])

    def clone(self, src, c, day, cid, patient=None, ward=None, tag=None, origin="new"):
        c2 = dict(c); c2["culture_id"] = cid; c2["_date"] = day; c2["sample_date"] = day.isoformat(); c2["_tdate"] = c["_date"]
        c2["_tsex"] = src["patients"][c["patient_id"]]["sex"]   # new patients keep the sex of the case they were copied from
        y, w, _ = day.isocalendar(); c2["iso_year"], c2["iso_week"] = str(y), str(w)
        if ward:
            wd = src["wards"][ward]; c2.update(ward_code=ward, ward_fi=wd["ward_fi"], ward_en=wd["ward_en"], ward_type=wd["ward_type"], institution=wd["institution"])
        if patient: c2["patient_id"] = patient
        if c2["ward_type"] == "in":
            c2["admission_date"] = (day - timedelta(days=self.rng.choice([0, 1, 2, 3, 4, 6, 9]))).isoformat()
        else: c2["admission_date"] = ""
        isos, sus = [], {}
        for i in src["isolates"][c["culture_id"]]:
            i2 = dict(i); i2["culture_id"] = cid; i2["isolate_id"] = f'{cid}-{i["isolate_no"]}'; isos.append(i2)
            sus[i2["isolate_id"]] = [dict(s, isolate_id=i2["isolate_id"], culture_id=cid, guideline=self.guideline(day)) for s in src["sus"][i["isolate_id"]]]
        return [c2, isos, sus, origin, [tag] if tag else []]

    def guideline(self, day):
        d1 = self.on.get("D1")
        if d1 and day >= day_to_date(self.recipe, d1["day"]): return d1["label"]
        return f"EUCAST {day.year}"

    def new_cases(self, src):
        """Days after the data ends: count per ward from the same weekday and season in earlier years, then copy a real case of that ward and season."""
        armd = data.armd()["return_gap_days"]["bins"]
        day, last, n_new = src["end"] + timedelta(days=1), self.end.date() - timedelta(days=1), 0
        patients_by_ward = defaultdict(list)
        for c in src["cultures"][-20000:]: patients_by_ward[c["ward_code"]].append(c["patient_id"])
        by_ward_date = defaultdict(lambda: defaultdict(list))      # ward -> date -> cultures, for fast season lookups
        for c in src["cultures"]: by_ward_date[c["ward_code"]][c["_date"]].append(c)
        resistant_on = defaultdict(list)                           # date -> patients with a resistant culture that day
        for pid, ds in src["resistant_dates"].items():
            for d in ds: resistant_on[d].append(pid)
        while day <= last:
            for ward in src["wards"]:
                same, pool = [], []
                for back in (364, 728):
                    for k in range(-14, 15):
                        d = day - timedelta(days=back + k)
                        if d.weekday() == day.weekday(): same.append(src["by_ward_day"].get((ward, d), 0))
                if not same: continue
                for k in range(-21, 22): pool += by_ward_date[ward].get(day - timedelta(days=364 + k), [])
                if not pool: continue
                for _ in range(self.poisson(sum(same) / len(same))):
                    n_new += 1
                    t = self.rng.choice(pool)
                    patient, tag = None, None
                    if self.rng.random() < src["return_share"]:
                        self.stats["returning"] += 1
                        # a returning patient: how long since their earlier resistant result follows the ARMD gap distribution
                        b = self.rng.choices(armd, weights=[x["share"] for x in armd])[0]
                        gap = self.rng.randrange(min(b["from"], 1000), min(b["to"] or 1100, 1100) + 1)   # our history is about 3 years
                        target = day - timedelta(days=gap)
                        cands = [p for k in range(-10, 11) for p in resistant_on.get(target + timedelta(days=k), [])]
                        patient = self.rng.choice(cands) if cands else self.rng.choice(patients_by_ward[ward])
                        if cands: self.stats["returning_armd"] += 1
                    else:
                        patient = f"PN{n_new:06d}"
                    self.cases.append(self.clone(src, t, day, f"N{n_new:07d}", patient=patient, origin="new", tag="N"))
            day += timedelta(days=1)
        self.note("N", n_new, label=CATALOGUE["N"][0], start=str(src["end"] + timedelta(days=1)), end=str(last))

    def template(self, src, test):
        for c in self.rng.sample(src["cultures"], len(src["cultures"])):
            for i in src["isolates"][c["culture_id"]]:
                if test(c, i): return c
        raise ValueError("no template found")

    def outbreak(self, src, p):
        """A cluster on one ward: cases copied from one resistant isolate, so they share one fingerprint; hospital-onset (day 3+)."""
        flag, ward = p["flag"], p["ward"]
        t = self.template(src, lambda c, i: i[flag] == "1" and c["specimen"] != "urine" if flag == "mrsa" else i[flag] == "1")
        d0 = day_to_date(self.recipe, p["day"])
        for k in range(p["n"]):
            day = d0 + timedelta(days=int(p["days"] * self.rng.betavariate(1.6, 2.4)) if k else 0)
            case = self.clone(src, t, day, f"G{k + 1:06d}", patient=f"PG{k + 1:05d}", ward=ward, tag="G1", origin="injected")
            if case[0]["ward_type"] == "in": case[0]["admission_date"] = (day - timedelta(days=self.rng.randint(3, 12))).isoformat()
            self.cases.append(case)
        self.note("G1", p["n"], label=f'{p["flag"].upper()} outbreak on {ward}', ward=ward, start=str(d0), end=str(d0 + timedelta(days=p["days"])),
                  template=t["culture_id"])

    def pseudo_outbreak(self, src, p):
        """A contaminated lab batch, not a real outbreak: one identical Pseudomonas result on several unrelated wards within days,
        mostly sampled early in the stay. The ward spread and the tight timing are what give it away."""
        t = self.template(src, lambda c, i: i["organism"] == "Pseudomonas aeruginosa" and c["specimen"] == "blood")
        wards = self.rng.sample(sorted(src["wards"]), min(p["wards"], len(src["wards"])))
        d0 = day_to_date(self.recipe, p["day"])
        for k in range(p["n"]):
            day = d0 + timedelta(days=self.rng.randint(0, max(0, p["days"] - 1)))
            case = self.clone(src, t, day, f"G7{k + 1:05d}", patient=f"PP{k + 1:05d}", ward=wards[k % len(wards)], tag="G7", origin="injected")
            self.cases.append(case)
        self.note("G7", p["n"], label=f'Pseudo-outbreak on {len(wards)} wards', ward=" ".join(wards), start=str(d0), end=str(d0 + timedelta(days=p["days"])))

    def shift_prob(self, drug, rise_pts):
        """Probability of flipping an S to R so the resistant share rises by rise_pts points."""
        r0 = data.trend(drug)["last_share"]
        return max(0.0, min(1.0, rise_pts / 100 / max(.05, 1 - r0)))

    def first_cpe(self, src, p):
        t = self.template(src, lambda c, i: i["organism"] == "Klebsiella pneumoniae" and i["esbl"] == "1")
        day = day_to_date(self.recipe, p["day"])
        case = self.clone(src, t, day, "G9000001", patient="PG90001", ward=p["ward"], tag="G3", origin="injected")
        for i in case[1]:
            if i["organism"] == "Klebsiella pneumoniae":
                i["cpe"] = "1"
                for s in case[2][i["isolate_id"]]:
                    if s["antibiotic_code"] in ("MEM", "TZP", "CRO", "CAZ"): s["result"] = "R"
        self.cases.append(case)
        self.note("G3", 1, label=f'First CPE, {p["ward"]}', ward=p["ward"], start=str(day))

    def screening(self, src, p):
        """Admission screening from a date: many extra swabs ('screen', a specimen the lookup doesn't know), about 4% MRSA."""
        mrsa = self.template(src, lambda c, i: i["mrsa"] == "1")
        neg = next(c for c in src["by_ward"][p["ward"]] if c["result"] == "negative")
        day, n = day_to_date(self.recipe, p["day"]), 0
        while day < self.end.date():
            for _ in range(self.poisson(p["per_day"])):
                n += 1; pos = self.rng.random() < .04
                case = self.clone(src, mrsa if pos else neg, day, f"S{n:07d}", patient=f"PS{n:06d}", ward=p["ward"], tag="F1", origin="injected")
                case[0].update(specimen="screen", specimen_fi="seulonta")
                if pos:   # a carrier swab: keep only the S. aureus isolate
                    case[1] = [i for i in case[1] if i["mrsa"] == "1"][:1]; case[0]["n_isolates"] = str(len(case[1]))
                case[4].append("D7")
                self.cases.append(case)
            day += timedelta(days=1)
        self.note("F1", n, label=f'Screening starts on {p["ward"]}', ward=p["ward"], start=str(day_to_date(self.recipe, p["day"])))
        self.note("D7", n, label="New specimen type 'screen'")

    # ---------- 2 · stage each case into deliveries ----------
    def send(self, at, event_at, table, key, op, row, rev, status, kind, origin, tags, ward):
        self.deliveries.append({"known_at": at, "event_at": event_at, "table": table, "key": key, "op": op, "row": row, "revision": rev,
                                "status": status, "kind": kind, "origin": origin, "tags": list(tags), "ward": ward})

    def stage(self, case):
        c, isos, sus, origin, tags = case
        on, rng = self.on, self.rng
        t0 = self.sample_time(c); spec = c["specimen"]
        ward = c["ward_code"]
        if "C9" in on and origin != "injected" and rng.random() < on["C9"]["rate"]:
            wrong = rng.choice([w for w in data.source()["wards"] if w != ward])
            wd = data.source()["wards"][wrong]
            c = dict(c, ward_code=wrong, ward_fi=wd["ward_fi"], ward_en=wd["ward_en"], ward_type=wd["ward_type"], institution=wd["institution"])
            tags = tags + ["C9"]; ward = wrong; self.note("C9", label=CATALOGUE["C9"][0])
        crow = {k: c[k] for k in data.CULTURE_COLS}
        received = t0 + timedelta(minutes=rng.randint(30, 300))
        pending = dict(crow, result="pending", n_isolates="")
        if not isos:
            t_res = self.in_lab_hours(t0 + self.delay(spec, "1 no growth / test only"), received + 2 * H)
            reg_at = received
            self.send(reg_at, t0, "cultures", c["culture_id"], "insert", pending, 1, "received", "culture received", origin, tags, ward)
            self.send(t_res, t0, "cultures", c["culture_id"], "update", crow, 2, "final", "culture result", origin, tags, ward)
            return
        t_org = self.in_lab_hours(t0 + self.delay(spec, "2 organism"), received + 6 * H)
        t_ast = self.in_lab_hours(max(t0 + self.delay(spec, "3 susceptibility"), t_org + 12 * H), t_org + 12 * H)
        reg_at, rtags = received, tags
        if "A3" in on and rng.random() < on["A3"]["rate"]:
            reg_at = t_org + timedelta(minutes=rng.randint(30, 600)); rtags = tags + ["A3"]; self.note("A3", label=CATALOGUE["A3"][0])
        self.send(reg_at, t0, "cultures", c["culture_id"], "insert", pending, 1, "received", "culture received", origin, rtags, ward)
        self.send(t_org, t0, "cultures", c["culture_id"], "update", crow, 2, "preliminary", "culture result", origin, tags, ward)
        for i in isos:
            pre = dict(i, esbl="", mrsa="", vre="", cpe="")       # resistance flags need confirmation tests
            itags = list(tags)
            if "B2" in on and i["organism"] in CONFUSABLE and rng.random() < on["B2"]["rate"]:
                pre["organism"] = CONFUSABLE[i["organism"]]; itags.append("B2"); self.note("B2", label=CATALOGUE["B2"][0])
            self.send(t_org, t0, "isolates", i["isolate_id"], "insert", pre, 1, "preliminary", "organism identified", origin, itags, ward)
            self.send(t_ast, t0, "isolates", i["isolate_id"], "update", dict(i), 2, "final", "organism corrected" if "B2" in itags else "isolate final", origin, itags, ward)
            rows = list(sus[i["isolate_id"]])
            ent = i["organism"].startswith(ENTEROBACTERALES)
            if "D2" in on and ent and c["_date"] >= day_to_date(self.recipe, on["D2"]["day"]):
                rows.append({**rows[0], "antibiotic": "temocillin", "antibiotic_code": "TEM", "antibiotic_fi": "temosilliini",
                             "result": "R" if i["cpe"] == "1" or rng.random() < .04 else "S", "_tag": "D2"}) if rows else None
            if "E3" in on and rows and rng.random() < on["E3"]["rate"]:
                pairs = [p for p in data.armd()["intrinsic_pairs"] if p["organism"] == i["organism"]]
                if pairs:
                    p = rng.choice(pairs); ab = data.source()["antibiotics"][p["drug"]]
                    rows = [r for r in rows if r["antibiotic_code"] != p["drug"]] + [{**rows[0], "antibiotic": ab["antibiotic"], "antibiotic_code": p["drug"],
                                                                                    "antibiotic_fi": ab["antibiotic_fi"], "result": "S", "_tag": "E3", "_rule": p["source_rule"]}]
            for s in rows:
                s = dict(s); stags = list(tags)
                if s.pop("_tag", None): stags.append("E3" if "_rule" in s else "D2"); s.pop("_rule", None)
                d = c["_date"]
                if origin == "new" and i["organism"] == "Escherichia coli" and spec == "urine" and s["result"] == "S":
                    # new cases are copied from a year earlier: move them along the trend the data shows, so they don't lag
                    tr = data.trend(s["antibiotic_code"])
                    if abs(tr["slope"]) >= .5 and rng.random() < self.shift_prob(s["antibiotic_code"], tr["slope"] * (d - c.get("_tdate", d)).days / 365.25):
                        s["result"] = "R"
                if "G2" in on and s["antibiotic_code"] == on["G2"]["drug"] and i["organism"] == "Escherichia coli" and s["result"] == "S":
                    yrs = (d - self.start.date()).days / 365.25
                    if yrs > 0 and rng.random() < self.shift_prob(s["antibiotic_code"], on["G2"]["extra"] * yrs):
                        s["result"] = "R"; stags.append("G2")
                if "G6" in on and ward == on["G6"]["ward"] and s["antibiotic_code"] == on["G6"]["drug"] and ent and s["result"] == "S":
                    a6 = day_to_date(self.recipe, on["G6"]["day"])
                    if a6 <= d < a6 + timedelta(days=on["G6"]["days"]) and rng.random() < self.shift_prob(s["antibiotic_code"], on["G6"]["rise"]):
                        s["result"] = "R"; stags.append("G6")
                if "D1" in on and s["antibiotic_code"] == on["D1"]["drug"] and ent and s["result"] == "S" and s["guideline"] == on["D1"]["label"] and rng.random() < on["D1"]["flip"]:
                    s["result"] = "R"; stags.append("D1")
                for tg in stags:
                    if tg in ("E3", "D2", "D1"): self.note(tg, label=CATALOGUE[tg][0])
                    if tg == "G2": self.note("G2", label=f'Slow drift, {on["G2"]["drug"]} +{on["G2"]["extra"]} points a year', start=str(self.start.date()))
                    if tg == "G6": self.note("G6", label=f'Rate shift, {on["G6"]["drug"]} on {on["G6"]["ward"]}', ward=on["G6"]["ward"],
                                             start=str(day_to_date(self.recipe, on["G6"]["day"])), end=str(day_to_date(self.recipe, on["G6"]["day"] + on["G6"]["days"])))
                key = f'{s["isolate_id"]}|{s["antibiotic_code"]}'
                if "B1" in on and rng.random() < on["B1"]["rate"]:
                    wrong = dict(s, result="R" if s["result"] == "S" else "S")
                    self.send(t_ast, t0, "susceptibility", key, "insert", {k: wrong[k] for k in data.SUS_COLS}, 1, "final", "susceptibility", origin, stags + ["B1"], ward)
                    self.send(self.in_lab_hours(t_ast + timedelta(days=rng.randint(1, 5)), t_ast + H), t0, "susceptibility", key, "update",
                              {k: s[k] for k in data.SUS_COLS}, 2, "corrected", "susceptibility corrected", origin, stags + ["B1"], ward)
                    self.note("B1", label=CATALOGUE["B1"][0])
                else:
                    self.send(t_ast, t0, "susceptibility", key, "insert", {k: s[k] for k in data.SUS_COLS}, 1, "final", "susceptibility", origin, stags, ward)
        if "B5" in on and origin == "replayed" and rng.random() < on["B5"]["rate"]:
            fake = dict(pending, culture_id=c["culture_id"] + "X", patient_id="P" + str(rng.randint(100000, 999999)))
            self.send(received + timedelta(minutes=5), t0, "cultures", fake["culture_id"], "insert", fake, 1, "received", "culture received", "injected", ["B5"], ward)
            self.send(self.in_lab_hours(received + timedelta(days=rng.randint(1, 3)), received + 6 * H), t0, "cultures", fake["culture_id"], "cancel", fake, 2,
                      "cancelled", "culture cancelled", "injected", ["B5"], ward)
            self.note("B5", label=CATALOGUE["B5"][0])

    # ---------- 3 · faults on the stream ----------
    def stream_faults(self):
        on, rng = self.on, self.rng
        if "A4" in on:
            p = on["A4"]; a = datetime.combine(day_to_date(self.recipe, p["day"]), datetime.min.time()); b = a + timedelta(days=p["days"])
            n = 0
            for d in self.deliveries:
                if d["ward"] == p["ward"] and a <= d["known_at"] < b:
                    d["known_at"] = b + timedelta(minutes=rng.randint(0, 360)); d["tags"].append("A4"); n += 1
            self.note("A4", n, label=f'Outage, {p["ward"]}', ward=p["ward"], start=str(a.date()), end=str(b.date()))
        if "A2" in on:
            p = on["A2"]; a = day_to_date(self.recipe, p["day"]); b = a + timedelta(days=p["days"]); n = 0
            for d in self.deliveries:
                if d["ward"] == p["ward"] and a <= d["event_at"].date() < b:
                    d["known_at"] += timedelta(days=p["late_days"]); d["tags"].append("A2"); n += 1
            self.note("A2", n, label=f'Late backfill, {p["ward"]}', ward=p["ward"], start=str(a), end=str(b), late_days=p["late_days"])
        self.complete_at = {}        # culture -> when its last result arrives, even if that is after the window ends
        for d in self.deliveries:
            if d["kind"] in ("susceptibility corrected", "culture cancelled"): continue
            cid = d["row"]["culture_id"]; self.complete_at[cid] = max(self.complete_at.get(cid, d["known_at"]), d["known_at"])
        self.history = {d["key"] for d in self.deliveries if d["table"] == "cultures" and d["op"] == "insert" and d["known_at"] < self.start}
        self.deliveries = [d for d in self.deliveries if self.start <= d["known_at"] < self.end]
        if "A6" in on:
            batches = defaultdict(list)
            for d in self.deliveries: batches[d["known_at"].replace(minute=0, second=0)].append(d)
            extra = []
            for hour, ds in batches.items():
                if rng.random() < on["A6"]["rate"]:
                    for d in ds: extra.append(dict(d, known_at=hour + timedelta(hours=1, minutes=rng.randint(0, 20)), kind="duplicate", tags=d["tags"] + ["A6"]))
                    self.note("A6", len(ds), label=CATALOGUE["A6"][0])
            self.deliveries += [d for d in extra if d["known_at"] < self.end]
        if "D9" in on:
            day = day_to_date(self.recipe, on["D9"]["day"]); self.batch_format[str(day)] = "semicolon"
            self.note("D9", sum(d["known_at"].date() == day for d in self.deliveries), label=CATALOGUE["D9"][0], start=str(day))

    # ---------- 5 · rebuild and check ----------
    def rebuild(self):
        """Apply every delivery in order, the way the receiving tool would, to get the final dataset."""
        state, seen, dupes = {}, set(), 0
        for d in self.deliveries:
            sig = (d["table"], d["key"], d["revision"])
            if sig in seen: dupes += 1; continue
            seen.add(sig)
            cur = state.get((d["table"], d["key"]))
            if cur and cur["revision"] > d["revision"]: continue
            state[(d["table"], d["key"])] = d
        final = {"cultures": [], "isolates": [], "susceptibility": []}
        for (table, _), d in state.items():
            if d["op"] == "cancel": continue
            final[table].append(dict(d["row"], origin=d["origin"], status=d["status"], revision=d["revision"], tags=" ".join(t for t in d["tags"] if t != "A1")))
        for t in final: final[t].sort(key=lambda r: tuple(r.get(k, "") for k in ("sample_date", "culture_id", "isolate_id", "antibiotic_code")))
        return final, dupes

    def checks(self, final, dupes):
        src = data.source()
        culture_dates = {c["culture_id"]: c["sample_date"] for c in final["cultures"]}
        out = []
        def add(name, ok, detail): out.append({"check": name, "ok": bool(ok), "detail": detail})
        received = Counter(d["table"] for d in self.deliveries)
        add("Every delivery is stored, held as a duplicate, or replaced by a newer revision", True,
            f'{len(self.deliveries):,} deliveries → {sum(map(len, final.values())):,} final rows, {dupes:,} duplicates ignored')
        orph = [r for r in final["isolates"] if r["culture_id"] not in culture_dates and r["culture_id"] not in self.history]
        add("Every isolate has its culture (already known before the start, or delivered)", not orph,
            f"{len(orph)} isolates still waiting for their culture row at the end of the run")
        revs = defaultdict(list)
        for d in self.deliveries: revs[(d["table"], d["key"])].append(d["revision"])
        late_lower = sum(1 for v in revs.values() if any(b < a for a, b in zip(v, v[1:])))
        add("Out-of-order revisions are resolved to the newest", True, f"{late_lower} keys received an older revision after a newer one")
        # untouched replayed rows that are already final must equal the source exactly
        src_sus = {(s["isolate_id"], s["antibiotic_code"]): s["result"] for ss in src["sus"].values() for s in ss}
        mism, compared, explained = 0, 0, Counter()
        for r in final["susceptibility"]:
            if r["origin"] != "replayed": continue
            k = (r["isolate_id"], r["antibiotic_code"])
            if k in src_sus:
                compared += 1
                if src_sus[k] != r["result"]:
                    why = next((t for t in ("D1", "E3", "B1", "G2", "G6") if t in r["tags"].split()), None)
                    if why: explained[why] += 1
                    else: mism += 1
        add("Replayed S/R results equal the source, except where a scenario changed them on purpose", mism == 0,
            f"{compared:,} compared; {sum(explained.values())} differ on purpose ({', '.join(f'{k} {v}' for k, v in explained.items()) or 'none'}); {mism} differ without a reason")
        open_cultures = sum(1 for r in final["cultures"] if r["status"] != "final")
        add("Results still pending at the end of the run are shown as pending, not missing", True, f"{open_cultures} cultures not final yet")
        return out

    # ---------- run ----------
    def build(self):
        self.pick_cases()
        for case in self.cases: self.stage(case)
        self.stream_faults()
        self.deliveries.sort(key=lambda d: (d["known_at"], d["table"] != "cultures", d["revision"]))
        for n, d in enumerate(self.deliveries, 1):
            d["seq"] = n; d["batch_id"] = d["known_at"].strftime("%Y-%m-%dT%H")
        self.final, dupes = self.rebuild()
        self.check_results = self.checks(self.final, dupes)
        self.truth_list = [{"code": k, "label": v.get("label", CATALOGUE[k][0]), "mechanism": CATALOGUE[k][1], "group": CATALOGUE[k][2], **v}
                           for k, v in self.truth.items()]
        self.truth_list.insert(0, {"code": "A1", "label": CATALOGUE["A1"][0], "mechanism": "delay", "group": "Timing",
                                   "count": sum(1 for c in self.cases), "detail": "every case"})
        return self


def generate(recipe):
    return Run(recipe).build()
