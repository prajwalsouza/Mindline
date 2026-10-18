"""The live feed behind the app: a movable "today", and the lab data known on that day.

Known on a day = the supplied Tyks data (it ends 27 Sep 2026) plus every result the simulated feed has delivered by the
end of that day, at its latest revision: late results, pending ones, corrections and cancellations included.
The feed is a feed-simulator run that starts the day after the data ends, with anomalies placed early so playing a few
weeks shows something worth catching.
"""
import bisect, threading
from collections import ChainMap, defaultdict
from datetime import date, datetime, timedelta

from feedsim import data
from feedsim.generate import generate
from feedsim.scenarios import default_recipe


def demo_recipe():
    src = data.source(); start = src["end"] + timedelta(days=1)
    r = default_recipe("demo", start=str(start), end=str(start + timedelta(days=120)), seed=11)
    sc = r["scenarios"]
    # place the events early in the feed: an outbreak in week 2, an outage, a rate shift, a first CPE a month in
    if "G1" in sc: sc["G1"].update(day=10, days=24, ward="ICU", flag="mrsa", n=11)
    if "A4" in sc: sc["A4"].update(day=5, days=5, ward="PHC-S")
    if "A2" in sc: sc["A2"].update(day=16, days=5, late_days=8, ward="PHC-N")
    if "G6" in sc: sc["G6"].update(day=20, days=28, ward="ED")
    if "G3" in sc: sc["G3"].update(day=33, ward="MED-B")
    if "D1" in sc: sc["D1"].update(day=95)
    return r


class LiveFeed:
    def __init__(self):
        self.lock = threading.Lock()
        self.run = None; self.today = None; self._cache = {}

    def ensure(self):
        if self.run is None:
            self.use(generate(demo_recipe()))

    def use(self, run):
        """Make a simulator run the app's feed (the admin's current run, or the default demo run)."""
        with self.lock:
            self.run = run; self.today = data.source()["end"]; self._cache = {}
            self.known_at = [d["known_at"] for d in run.deliveries]
            self.first = run.start.date(); self.last = (run.end - timedelta(days=1)).date()

    def set_today(self, day):
        self.ensure()
        with self.lock:
            self.today = max(data.source()["end"], min(self.last, day))
        return self.today

    def view(self, day=None):
        """A source-like dict (cultures, isolates, sus, patients, start, end) for what is known at the end of `day`."""
        self.ensure()
        day = day or self.today
        if day <= data.source()["end"]: return dict(data.source(), end=day)
        if day in self._cache: return self._cache[day]
        src, run = data.source(), self.run
        upto = bisect.bisect_right(self.known_at, datetime.combine(day, datetime.max.time()))
        state = {}
        for d in run.deliveries[:upto]:
            k = (d["table"], d["key"]); cur = state.get(k)
            if cur is None or d["revision"] >= cur["revision"]: state[k] = d
        sex = {c[0]["culture_id"]: c[0].get("_tsex") for c in run.cases}
        cultures, iso, sus, patients = [], defaultdict(list), defaultdict(list), {}
        for (table, key), d in state.items():
            if d["op"] == "cancel": continue
            r = dict(d["row"])
            if table == "cultures":
                r["_date"] = date.fromisoformat(r["sample_date"]); r["_status"] = d["status"]; r["_feed"] = True
                cultures.append(r)
                if r["patient_id"] not in src["patients"]:
                    patients[r["patient_id"]] = {"patient_id": r["patient_id"], "sex": sex.get(r["culture_id"]) or "F",
                                                 "birth_year": str(r["_date"].year - int(r["age_years"])), "home_area": ""}
            elif table == "isolates":
                for f in data.FLAGS: r[f] = r.get(f) or "0"
                iso[r["culture_id"]].append(r)
            else:
                sus[r["isolate_id"]].append(r)
        cultures.sort(key=lambda c: (c["_date"], c["culture_id"]))
        view = dict(src, cultures=src["cultures"] + [c for c in cultures if c["_date"] > src["end"]],
                    isolates=ChainMap(dict(iso), src["isolates"]), sus=ChainMap(dict(sus), src["sus"]), patients=ChainMap(patients, src["patients"]), end=day)
        view["_new"] = sum(1 for d in run.deliveries[:upto] if d["known_at"].date() == day and d["kind"] in ("susceptibility", "culture received"))
        if len(self._cache) > 40: self._cache.clear()
        self._cache[day] = view
        return view

    def status(self):
        self.ensure()
        v = self.view()
        return {"today": str(self.today), "data_end": str(data.source()["end"]), "first": str(self.first), "last": str(self.last),
                "new_today": v.get("_new", 0), "truth": [t for t in self.run.truth_list if t.get("start") and t["start"] <= str(self.today)]}


FEED = LiveFeed()
