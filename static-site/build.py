"""Build the isolated static distribution. Python is used only at build time.

Run: python static-site/build.py
Upload static-site/dist/ to any static host (root or subdirectory).
"""
import csv
import gzip
import json
import re
import shutil
import sys
import tempfile
from pathlib import Path

HERE = Path(__file__).resolve().parent
ROOT = HERE.parent
DIST = HERE / 'dist'
sys.path[:0] = [str(ROOT / 'app'), str(ROOT / 'data-prep/simulator')]
from feedsim import data
from feedsim.scenarios import catalogue_json, PRESETS, default_recipe
import evidence, locale_names, narrative
import knowledge, knowledge_rdf


def illustrative_knowledge():
    """Build only checked-in demo examples, never a developer's local notes."""
    previous = knowledge.STORE
    try:
        with tempfile.TemporaryDirectory(prefix='mindline-static-seed-') as temporary:
            knowledge.STORE = Path(temporary) / 'knowledge.json'
            snapshot = knowledge.dashboard()
            assert snapshot['entries'] and all(row['source'] == 'illustrative' for row in snapshot['entries'])
            return snapshot
    finally:
        knowledge.STORE = previous


def main():
    DIST.mkdir(exist_ok=True)
    shutil.copytree(ROOT / 'app/static', DIST, dirs_exist_ok=True)
    shutil.copytree(ROOT / 'data-prep/simulator/static', DIST / 'admin/sim', dirs_exist_ok=True)
    shutil.copytree(HERE / 'runtime', DIST / 'runtime', dirs_exist_ok=True)
    vendors = json.loads((HERE / 'vendor/manifest.json').read_text(encoding='utf-8')) if (HERE / 'vendor/manifest.json').exists() else {}
    if vendors: shutil.copytree(HERE / 'vendor', DIST / 'vendor', dirs_exist_ok=True)
    # Admin shares the application shell; its relative assets resolve through <base>.
    (DIST / 'admin/index.html').write_text((DIST / 'index.html').read_text(encoding='utf-8'), encoding='utf-8')
    for p in DIST.rglob('*'):
        if p.suffix not in ('.html', '.js', '.css') or any(k in p.relative_to(DIST).parts for k in ('runtime','vendor')):
            continue
        text = p.read_text(encoding='utf-8')
        text = text.replace("location.assign('/')", 'location.assign(window.MindlineStatic.base)')
        prefix = '../' * (len(p.relative_to(DIST).parts) - 1)
        if p == DIST / 'admin/index.html': prefix = ''
        for url, local in vendors.items():
            # Import-map targets must be URL-like (./, ../ or /), not bare
            # specifiers such as vendor/three/three.module.js.
            text = text.replace(url, ((prefix or './') if p.suffix == '.html' else '${window.MindlineStatic.base}') + local)
        text = re.sub(r'<link[^>]+rel="preconnect"[^>]*>', '', text)
        if p.suffix == '.html':
            root = '../' * (len(p.relative_to(DIST).parts) - 1)
            # Base is per page; no rewrite rules or SPA fallback required.
            base = '../' if p == DIST / 'admin/index.html' else './'
            text = text.replace('<head>', '<head>\n  <base href="' + base + '">\n  <script src="' + ('' if p == DIST / 'admin/index.html' else root) + 'runtime/bridge.js"></script>')
            text = text.replace('href="/admin/', 'href="' + root + 'admin/').replace('href="/demo', 'href="' + root + 'demo')
            text = text.replace('href="/"', 'href="' + root + '"')
            if p == DIST / 'admin/index.html':
                text = text.replace('href="../admin/', 'href="admin/').replace('href="../demo', 'href="demo')
        if p.name == 'app.js':
            text = text.replace('import("/scene3d/index.js")', 'import(window.MindlineStatic.base + "scene3d/index.js")')
            text = text.replace('location.pathname.startsWith("/admin")', 'window.MindlineStatic.isAdmin')
            text = text.replace('href="/admin/"', 'href="${window.MindlineStatic.base}admin/"')
            text = text.replace('href="/"', 'href="${window.MindlineStatic.base}"')
            text = text.replace('src="/admin/sim/?embed=1"', 'src="${window.MindlineStatic.base}admin/sim/?embed=1"')
            text = text.replace('on this demo server', 'in this browser').replace('esittelypalvelimen', 'tämän selaimen')
            if p == DIST / 'admin/sim/app.js':
                text = text.replace('const c = RUN.cases;', '''const c = RUN.cases;
    let useFeed = document.getElementById('static-use-feed');
    if (!useFeed) { useFeed = document.createElement('button'); useFeed.id = 'static-use-feed'; useFeed.type = 'button'; useFeed.textContent = 'Use this feed in dashboards'; document.getElementById('status').after(useFeed); }
    useFeed.onclick = async () => { useFeed.disabled = true; try { await api('/api/app/clock', { method: 'POST', body: JSON.stringify({action:'use', run:RUN.id}) }); useFeed.textContent = 'Feed ready · open dashboards'; } catch(e) { useFeed.textContent = e.message; } finally { useFeed.disabled = false; } };
''')
        p.write_text(text, encoding='utf-8')
    src = data.source()
    # Column-oriented rows avoid repeating field names hundreds of thousands of times.
    def packed(rows):
        rows = list(rows)
        cols = [k for k in rows[0] if not k.startswith('_')] if rows else []
        return {'columns': cols, 'rows': [[r.get(k, '') for k in cols] for r in rows]}
    payload = {k: packed(src[k].values() if isinstance(src[k], dict) else src[k]) for k in ('cultures', 'patients', 'wards', 'antibiotics')}
    payload['isolates'] = packed(i for rows in src['isolates'].values() for i in rows)
    payload['sus'] = packed(s for rows in src['sus'].values() for s in rows)
    payload.update(start=str(src['start']), end=str(src['end']), return_share=src['return_share'], counts=src['counts'],
                   names=locale_names.names(), alerts=evidence.ALERTS, mimic=data.mimic(), armd=data.armd(), sources=data.sources_summary(),
                   catalogue=catalogue_json(), presets={k: {**v, 'recipe': default_recipe(k)} for k, v in PRESETS.items()},
                   trends={k: data.trend(k) for k in src['antibiotics']},
                   columns={'cultures': data.CULTURE_COLS, 'isolates': data.ISOLATE_COLS, 'susceptibility': data.SUS_COLS},
                   vocabulary={k: getattr(narrative, k) for k in ('DRUGS', 'DRUG_NAME', 'ORGS', 'FLAGS', 'CONDITIONS', 'SYMPTOMS', 'DECISION', 'REASON_TYPES', 'SIM_FI', 'SIM_SV', 'PRACTICES', 'TRIGGER_LABELS', 'NEGATION')},
                   knowledge=illustrative_knowledge(),
                   knowledge_queries={'templates': knowledge_rdf.TEMPLATES, 'prefixes': knowledge_rdf.PREFIXES},
                   knowledge_labels={'reasons': knowledge.REASONS, 'decisions': knowledge.DECISIONS})
    demo_summary = json.dumps(payload['knowledge']['summary'], ensure_ascii=False, separators=(',', ':'))
    for directory in (ROOT / 'app/static/demo', DIST / 'demo'):
        (directory / 'knowledge-summary.json').write_text(demo_summary, encoding='utf-8')
    with open(data.OUT / 'mimic_delays.csv', encoding='utf-8') as f:
        payload['medians'] = {r['specimen']: float(r['median_h']) for r in csv.DictReader(f) if r['stage'] == '3 susceptibility'}
    answers = ROOT / 'app/answers/ask_cache.json'
    payload['answers'] = json.loads(answers.read_text(encoding='utf-8')) if answers.exists() else {}
    blob = json.dumps(payload, ensure_ascii=False, separators=(',', ':'), default=str).encode('utf-8')
    (DIST / 'data').mkdir(exist_ok=True)
    (DIST / 'data/source.json.gz').write_bytes(gzip.compress(blob, mtime=0))
    # No secrets, Python, private configuration, or executable backend in dist.
    (DIST / '.nojekyll').write_text('')
    print(f'Built {DIST}: source {len(blob):,} bytes, gzip {(DIST / "data/source.json.gz").stat().st_size:,} bytes')


if __name__ == '__main__':
    main()
