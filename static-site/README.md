# Mindline static edition

The complete browser application, admin simulator and both demo films are in `dist/`. Upload the **contents of dist**, or extract `mindline-static.zip`, into a static site's publish directory. No Python runtime, application server, serverless functions, external CDN assets or API keys are needed at runtime. Root and subfolder hosting are supported.

Entrypoints (relative to the published directory):

- `./` — application, including doctor and hygiene views, Overview, insights, patients, wards, calendar and notes.
- `admin/` — administration, simulator and saved answer library.
- `admin/sim/` — standalone simulator with all 21 scenarios, tables, playback and CSV/ZIP exports. Use **Use this feed in dashboards** to apply a generated run.
- `demo/` and `demo-v2/` — both existing demo films, with bundled assets.

Calculations run in native JavaScript in a browser worker. The packaged source data is compressed; the worker loads it locally from the static host. Existing API-shaped UI calls are handled inside the browser, with no backend API requests.

## Build and preview

From the repository root:

```powershell
python static-site/build.py
python -m http.server 18973 --directory static-site/dist
```

Open `http://localhost:18973/`. Python is only a development/build tool; any ordinary HTTP(S) static host can serve the resulting files. Opening `index.html` with `file://` is not supported. Use a modern browser supporting module workers, IndexedDB and DecompressionStream. Ensure the host serves `.mjs` as JavaScript and includes the `.gz` data file.

Vendored dependencies are already included. To refresh the pinned libraries/fonts, run `python static-site/vendor.py` before rebuilding (requires internet access). Preserve the included dependency licenses. The build reads the existing application's data and assets; changes to those inputs require rebuilding.

To make a fresh upload archive:

```powershell
python -c "import shutil; shutil.make_archive('static-site/mindline-static', 'zip', 'static-site/dist')"
```

## Browser-only behavior

- Generated feed recipes, notes and clock state persist in IndexedDB for this browser and site path. They are not shared across users, devices or browser profiles. Clearing site storage resets them. Storage failures display a warning.
- The existing demo sign-in is a role selector, not authentication. Files and bundled data on a public static host are public.
- Seven saved AI answers are bundled. Generating fresh AI answers requires a service and is unavailable in this static edition. The saved answers and scripted films remain snapshots when the active feed changes.
- The JavaScript simulator is repeatable for a given seed and uses the original simulation rules, but its random number generator differs from Python's. Identical seeds therefore do not produce byte-identical Python and JavaScript datasets. Monte Carlo samples can also differ; deterministic calculations are compared using identical input feeds.
- The existing Python application remains separate. Static implementation source is in `runtime/`; generated upload files are in `dist/`.

## Verification

```powershell
python static-site/tests/reference.py
node static-site/tests/parity.mjs
node static-site/tests/integration.mjs
python static-site/tests/package.py
```

The parity suite compares 65 Python API fixtures and six note cases, including Overview, across 1,842,111 comparisons. Numerical comparisons allow small floating-point tolerances; random sample values are excluded from exact matching. Integration checks cover all 21 scenarios, repeatability, replay integrity, feed/clock state, calendar, table filters, export contents, saved answers and restored browser state. Package checks verify local asset references and entrypoints. Browser checks exercised doctor/admin views, feed generation/application, Overview and both demo films under a hosted subfolder.
