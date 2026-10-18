"""Download the open external datasets into data-prep/external/ and record where they came from.

Run from anywhere:  python data-prep/scripts/fetch.py
Downloads stay out of Git (see .gitignore); data-prep/outputs/sources.json records URL, size, SHA-256 and date.
"""
import hashlib, json, urllib.request
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
MIMIC = "https://physionet.org/files/mimic-iv-demo/2.2/"
FILES = {
    "mimic-iv-demo/microbiologyevents.csv.gz": MIMIC + "hosp/microbiologyevents.csv.gz",
    "mimic-iv-demo/transfers.csv.gz": MIMIC + "hosp/transfers.csv.gz",
    "mimic-iv-demo/admissions.csv.gz": MIMIC + "hosp/admissions.csv.gz",
    "mimic-iv-demo/patients.csv.gz": MIMIC + "hosp/patients.csv.gz",
    "mimic-iv-demo/LICENSE.txt": MIMIC + "LICENSE.txt",
}

sources = []
for rel, url in FILES.items():
    dest = ROOT / "external" / rel
    dest.parent.mkdir(parents=True, exist_ok=True)
    if not dest.exists():
        urllib.request.urlretrieve(url, dest)
    data = dest.read_bytes()
    sources.append({"file": rel, "url": url, "bytes": len(data), "sha256": hashlib.sha256(data).hexdigest(),
                    "checked": datetime.now(timezone.utc).isoformat(timespec="seconds"),
                    "licence": "Open Data Commons Open Database License v1.0 (MIMIC-IV demo 2.2)"})
    print(f"{rel}  {len(data):,} bytes")

(ROOT / "outputs").mkdir(exist_ok=True)
(ROOT / "outputs" / "sources.json").write_text(json.dumps(sources, indent=2))
