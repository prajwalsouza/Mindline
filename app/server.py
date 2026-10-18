"""Mindline app server: login, dashboards, and the admin feed simulator, on one port.

    python app/server.py 8800        then open http://localhost:8800/

  /            the app (login, then dashboards)
  /admin/      the feed simulator (generates new data in real time)
  /api/...     data for both
Install app/requirements.txt for local RDF queries. Demo sign-in: no real accounts or passwords.
"""
import json, sys
from pathlib import Path
from urllib.parse import parse_qs, urlparse

HERE = Path(__file__).resolve().parent
SIM = HERE.parent / "data-prep" / "simulator"
sys.path.insert(0, str(SIM)); sys.path.insert(0, str(HERE))
import importlib.util                # the simulator's server module (its API and pages), loaded by path
_spec = importlib.util.spec_from_file_location("simserver", SIM / "server.py"); simserver = importlib.util.module_from_spec(_spec); _spec.loader.exec_module(simserver)
import evidence                     # noqa: E402
import insights                     # noqa: E402  the Insights tab: questions, time windows, statistics
import ask                          # noqa: E402  free questions, answered by a local model with the app's own charts
import overview                     # noqa: E402  searchable sample-level hospital clock
import narrative                    # noqa: E402  mock patient record and ward knowledge (never the real Rhypple store)
import knowledge                    # noqa: E402  persisted de-identified demo contributions and graph
import knowledge_rdf                # noqa: E402  local RDF projection and predefined SPARQL questions
from feed import FEED               # noqa: E402  the movable "today" and the data known on it
from datetime import date, timedelta
import random

APP_STATIC, SIM_STATIC = HERE / "static", SIM / "static"
DEMO = {"doctor": {"email": "doctor@mindline.demo", "name": "Dr. Demo", "role": "doctor", "ward": "URO"},
        "hygiene": {"email": "hygiene@mindline.demo", "name": "Hygiene team", "role": "hygiene"}}


class Handler(simserver.Handler):
    def translate_path(self, path):
        # /admin/sim/... is the feed simulator page (shown inside the admin shell); /admin/... is the app itself in admin mode
        p = urlparse(path).path
        if p.startswith("/admin/sim"):
            self.directory = str(SIM_STATIC); rest = p[len("/admin/sim"):] or "/"; return super().translate_path(rest)
        if p.startswith("/admin/"):
            self.directory = str(APP_STATIC); return super().translate_path(p[len("/admin"):])
        self.directory = str(APP_STATIC); return super().translate_path(path)

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}
        if u.path in ("/admin", "/admin/sim"):
            self.send_response(301); self.send_header("Location", u.path + "/"); self.end_headers(); return
        try:
            if u.path == "/api/app/meta": return self.reply(evidence.meta())
            if u.path == "/api/app/overview": return self.reply(overview.overview())
            if u.path == "/api/app/knowledge/graph": return self.reply(knowledge.dashboard())
            if u.path == "/api/app/knowledge/questions": return self.reply(knowledge_rdf.questions())
            if u.path == "/api/app/clock": return self.reply(FEED.status())
            if u.path == "/api/app/calendar": return self.reply(evidence.calendar())   # every feed day: notable, active or quiet
            if u.path == "/api/app/ask/suggest": return self.reply({"q": ask.suggest(q.get("q", ""))})
            if u.path == "/api/app/ask/job": return self.reply(ask.job(q.get("id", "")))
            if u.path == "/api/app/ask/jobs": return self.reply(ask.jobs())          # admin: running answers and the cache
            if u.path == "/api/app/brief": return self.reply(evidence.brief())
            if u.path == "/api/app/patients": return self.reply(evidence.patients(q.get("ward", "URO"), q.get("asof") or None))
            if u.path == "/api/app/patient": return self.reply(evidence.patient(q["id"], q.get("asof") or None))
            if u.path == "/api/app/record":     # this patient's narrated notes, from the separate mock patient record
                return self.reply(narrative.PATIENT_GRAPH.find([("Patient", q["id"])]))
            if u.path == "/api/app/knowledge":  # de-identified ward knowledge about a drug on a ward
                paths = [("Ward", q.get("ward") or "URO")]
                if q.get("drug"):
                    paths.append(("Drug", narrative.SPECTRUM.get(q["drug"], "other"), narrative.DRUG_NAME.get(q["drug"], q["drug"])))
                return self.reply(narrative.KNOWLEDGE_GRAPH.find(paths))
            if u.path == "/api/app/wards":
                types = tuple(t for t in (q.get("types") or "esbl,mrsa,vre,cpe").lower().split(",") if t in ("esbl", "mrsa", "vre", "cpe"))
                return self.reply(evidence.wards_overview(q.get("asof") or None, types or ("esbl", "mrsa", "vre", "cpe")))
            if u.path == "/api/app/insights":   # fixed questions per role, answered from the data known today, only when the data can
                return self.reply(insights.insights(q.get("role", "hygiene"), q.get("asof") or None, q.get("ward") or "URO", q.get("spec") or "urine"))
            if u.path == "/api/app/antibiogram":
                return self.reply(evidence.antibiogram(ward=q.get("ward") or None, sex=q.get("sex") or None, age=q.get("age") or None,
                                                       spec=q.get("spec", "urine"), org=q.get("org") or None, asof=q.get("asof") or None, recent_weeks=q.get("recent_weeks", 4)))
        except Exception as e:
            return self.reply({"error": f"{type(e).__name__}: {e}"}, status=500)
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if path == "/api/app/knowledge/query":
            try:
                body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
                if not isinstance(body, dict): raise ValueError("Request must be an object")
                return self.reply(knowledge_rdf.query(body.get("question"), body.get("filters")))
            except (ValueError, TypeError) as e:
                return self.reply({"error": str(e)}, status=400)
            except Exception as e:
                return self.reply({"error": f"{type(e).__name__}: {e}"}, status=500)
        if path == "/api/app/clock":   # next day, a given day, back to where the data ends, or use an admin run as the feed
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}"); a = body.get("action")
            FEED.ensure()
            if a == "next": FEED.set_today(FEED.today + timedelta(days=int(body.get("days", 1))))
            if a == "prev": FEED.set_today(FEED.today - timedelta(days=int(body.get("days", 1))))   # never before the data ends
            elif a == "reset": FEED.set_today(evidence.data.source()["end"])
            elif a == "set": FEED.set_today(date.fromisoformat(body["day"]))
            elif a == "use" and body.get("run") in simserver.RUNS: FEED.use(simserver.RUNS[body["run"]].run)
            return self.reply(FEED.status())
        if path.startswith("/api/app/narrate/"):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            try:
                pt = evidence.patient(body["patient"]); ctx = {"asof": FEED.status()["today"], "ward": body.get("ward") or "URO", "org": body.get("org") or None, "lang": body.get("lang")}
                if path.endswith("/simulate"):   # two or three things a doctor might say about this patient
                    ab = evidence.antibiogram(ward=ctx["ward"], sex=pt["sex"], spec=pt["history"][0]["spec"], org=ctx["org"])
                    return self.reply({"lines": narrative.simulate(pt, ab, random.Random(), body.get("lang", "en"))})
                facts = narrative.parse(body.get("text", ""), lang=body.get("lang"))
                shared, removed = narrative.deidentify(facts, pt, ctx)
                if path.endswith("/parse"): return self.reply({"facts": facts, "shared": shared, "removed": removed})
                if path.endswith("/commit"): return self.reply(narrative.commit(pt, facts, shared if body.get("share", True) else [], ctx, body.get("author", "Doctor")))
            except Exception as e:
                return self.reply({"error": f"{type(e).__name__}: {e}"}, status=400)
        if path.startswith("/api/app/ask"):   # ask a question; stop a running answer; forget a cached one
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            if path == "/api/app/ask": return self.reply(ask.ask(body.get("q", ""), live=body.get("live", True)))
            if path == "/api/app/ask/stop": return self.reply(ask.stop(body.get("id", "")))
            if path == "/api/app/ask/forget": ask.forget(body.get("key", "")); return self.reply({"ok": True})
        if path == "/api/app/login":
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
            acct = next((a for a in DEMO.values() if a["email"] == body.get("email")), None)
            if not acct: return self.reply({"error": "Unknown demo account"}, status=401)
            return self.reply({"ok": True, **acct})
        return super().do_POST()


if __name__ == "__main__":
    from http.server import ThreadingHTTPServer
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8800
    simserver.data.source(); simserver.data.mimic(); simserver.data.armd()
    FEED.ensure()   # the default live feed: a demo run starting the day after the data ends
    print(f"Mindline on http://localhost:{port}/  ·  admin at /admin/")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
