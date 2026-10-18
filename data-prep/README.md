# Feed simulation and optional calibration

Mindline includes a synthetic lab-feed simulator. It replays the supplied CSV records and generates later samples with staged release, corrections, duplicates, outages and deliberately injected scenarios. The product server mounts its admin interface at `/admin/sim/`; it can also run separately:

```powershell
python data-prep/simulator/server.py 8790
```

The main product starts with `python app/server.py 8800`. Neither launch requires downloading MIMIC-IV, ARMD or any other external patient-level file.

## Included runtime inputs

- `../data/synthetic_microbiology_dataset/`: source records and templates for synthetic samples.
- `outputs/mimic_delay_params.json`, `mimic_delays.csv`, `mimic_mess.json`: aggregate delay and messiness measurements from the open MIMIC-IV demo.
- `outputs/armd_params.json`: aggregate earlier-resistance intervals and selected expected-resistant pairs from ARMD.
- `outputs/sources.json`: original MIMIC download metadata and hashes.

The generator package lives in `simulator/feedsim/`: `data.py` loads those local inputs, `scenarios.py` defines recipes, `generate.py` creates deliveries, and `views.py` produces readable tables/charts. Scenario labels are deliberately separate from detector inputs. See [incoming-data scenarios](INCOMING-DATA-SCENARIOS.md) for the original design catalogue.

These calibrations demonstrate plausible delay sizes and fault patterns. They do not establish a Finnish lab benchmark. MIMIC demo data is a small US cohort with shifted dates; its update times do not reveal every preliminary state. ARMD return-gap summaries concern earlier resistant results and do not establish treatment outcomes.

## Optional rebuilding of calibration summaries

These scripts are preparation tools, not application startup steps:

```powershell
python data-prep/scripts/fetch.py
python data-prep/scripts/mimic_delays.py
```

`fetch.py` downloads the open MIMIC-IV demo files into ignored `external/mimic-iv-demo/`; `mimic_delays.py` rebuilds the small aggregate outputs. `scripts/armd_params.py` separately expects `microbiology_cultures_microbial_resistance.csv` and `implied_susceptibility_rules.csv` under ignored `external/armd/`. Those ARMD files are not bundled or automatically downloaded.

Read [data sources and licenses](../docs/DATA-SOURCES.md) before acquiring or redistributing source data. Keep external patient-level research files outside version control. No full MIMIC-IV account or credentials are required for the included product demo.
