"""Feed simulator server: generates simulated incoming lab data and streams it live.

    python data-prep/simulator/server.py 8790        then open http://localhost:8790/

Standard library only. This generation component is meant to become part of the main server later.
"""
import json, sys, time, uuid
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from urllib.parse import parse_qs, urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent))
from feedsim import data                                       # noqa: E402
from feedsim.generate import generate                          # noqa: E402
from feedsim.scenarios import PRESETS, catalogue_json, default_recipe   # noqa: E402
from feedsim.views import Views                                # noqa: E402

STATIC = Path(__file__).resolve().parent / "static"
RUNS = {}     # run id -> Views (last few kept in memory)


def weekly():
    """Cultures per week in the supplied data, for the timeline the window is chosen on."""
    from collections import Counter
    from datetime import timedelta
    src = data.source(); c = Counter()
    for x in src["cultures"]: c[x["_date"] - timedelta(days=x["_date"].weekday())] += 1
    return [[str(k), v] for k, v in sorted(c.items())]


def make_run(recipe):
    v = Views(generate(recipe))
    rid = uuid.uuid4().hex[:8]
    RUNS[rid] = v
    while len(RUNS) > 6: RUNS.pop(next(iter(RUNS)))
    return rid, v


class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=str(STATIC), **k)

    def log_message(self, fmt, *args): pass

    def end_headers(self):
        self.send_header("Cache-Control", "no-store"); super().end_headers()

    def reply(self, body, ctype="application/json", status=200, filename=None):
        if not isinstance(body, (bytes, str)): body = json.dumps(body, default=str)
        if isinstance(body, str): body = body.encode("utf-8")
        self.send_response(status); self.send_header("Content-Type", ctype); self.send_header("Content-Length", str(len(body)))
        if filename: self.send_header("Content-Disposition", f'attachment; filename="{filename}"')
        self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        u = urlparse(self.path); q = {k: v[0] for k, v in parse_qs(u.query).items()}; p = u.path.strip("/").split("/")
        if p[0] != "api": return super().do_GET()
        try:
            if p[1] == "meta":
                src = data.source()
                return self.reply({"sources": data.sources_summary(), "catalogue": catalogue_json(), "wards": sorted(src["wards"]),
                                   "presets": {k: {"label": v["label"], "about": v["about"], "recipe": default_recipe(k)} for k, v in PRESETS.items()},
                                   "source_range": [str(src["start"]), str(src["end"])], "weekly": weekly(),
                                   "drugs": sorted(src["antibiotics"]), "trends": {d: data.trend(d) for d in ("TMP", "CIP", "AMP", "CRO", "NIT")}})
            v = RUNS.get(p[2]) if len(p) > 2 else None
            if v is None: return self.reply({"error": "unknown run; generate again"}, status=404)
            what = p[3]
            if what == "bins": return self.reply(v.bins(q.get("size", "day")))
            if what == "delays": return self.reply(v.delays())
            if what == "table": return self.reply(v.page(p[4], q, int(q.get("offset", 0)), int(q.get("limit", 50))))
            if what == "csv": return self.reply(v.csv(p[4], q), "text/csv; charset=utf-8", filename=f"simulated-{p[4]}-{p[2]}.csv")
            if what == "feed.zip": return self.reply(v.feed_zip(), "application/zip", filename=f"simulated-feed-{p[2]}.zip")
            if what == "live": return self.live(v, q.get("size", "day"), float(q.get("rate", 4)), int(q.get("from", 0)))
            return self.reply({"error": "not found"}, status=404)
        except Exception as e:   # keep the server up; show the problem in the page
            return self.reply({"error": f"{type(e).__name__}: {e}"}, status=500)

    def do_POST(self):
        if urlparse(self.path).path.strip("/") != "api/runs": return self.reply({"error": "not found"}, status=404)
        recipe = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        try:
            t = time.time(); rid, v = make_run(recipe)
            return self.reply({"id": rid, "seconds": round(time.time() - t, 2), **v.summary()})
        except Exception as e:
            return self.reply({"error": f"{type(e).__name__}: {e}"}, status=400)

    def live(self, v, size, rate, start):
        """Server-sent events: one time bin at a time, as if the feed were arriving now."""
        self.send_response(200); self.send_header("Content-Type", "text/event-stream"); self.send_header("Connection", "keep-alive"); self.end_headers()
        bins, extra = v.bins(size), v.ordinary_ticker(size)
        try:
            for b in bins[start:]:
                msg = dict(b, ticker=b["ticker"] + extra.get(b["i"], [])[: max(0, 6 - len(b["ticker"]))])
                self.wfile.write(f"data: {json.dumps(msg)}\n\n".encode()); self.wfile.flush()
                time.sleep(1 / max(.2, min(rate, 60)))
            self.wfile.write(b"event: done\ndata: {}\n\n"); self.wfile.flush()
        except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
            pass


if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8790
    data.source(); data.mimic(); data.armd()
    print(f"Feed simulator on http://localhost:{port}/")
    ThreadingHTTPServer(("127.0.0.1", port), Handler).serve_forever()
