# Data sources and third-party notices

This product repository is private. Its clinical screens display supplied synthetic records and simulated deliveries, not records from a real hospital. External research datasets contribute small calibration summaries to the simulator; their patient-level files are not included.

## Supplied synthetic microbiology dataset

The six CSVs under `data/synthetic_microbiology_dataset/` contain 10,000 synthetic patients, 46,792 cultures, 24,571 isolates and 172,381 reported susceptibility tests, covering 2 October 2023–27 September 2026. Their accompanying [supplier README](../data/synthetic_microbiology_dataset/README.md) describes reproducible generation with seed 2026 and states that no real patient or hospital is represented.

Project preparation notes attribute the supplied challenge dataset to Tyks and Mylab. The supplier README describes approximate calibration to THL Finres 2023, expected resistance patterns from EUCAST, and a surveillance-style schema. Those references do not make the generated rows clinical measurements or validation evidence.

No explicit redistribution license accompanies these supplied CSVs in this repository. Preserve the supplier notice and private access; do not infer an open-data license from the synthetic nature of the records. No public release permission is established here.

The source provides age at sampling, sex, ward, specimen, organism and reported S/R tests. It does not provide treatment outcomes, full medication histories, MIC values, inhibition zones or an I category. Notes and clinical context added for the demonstration are separate illustrative content. [Counting rules](../data/COUNTING_RULES.md) and the [data dictionary](../data/DATA_DICTIONARY.md) explain the source fields and units.

## MIMIC-IV Clinical Database Demo 2.2

The simulator uses aggregate delay and data-quality parameters derived during preparation from the open 100-patient MIMIC-IV demo. The included files are `data-prep/outputs/mimic_delay_params.json`, `mimic_delays.csv` and `mimic_mess.json`. Downloaded microbiology, admissions, transfers and patient tables are excluded. `data-prep/outputs/sources.json` records their download URLs, hashes, sizes and source license.

Citation: Johnson, A., Bulgarelli, L., Pollard, T., Horng, S., Celi, L. A., and Mark, R. (2023). *MIMIC-IV Clinical Database Demo*, version 2.2. PhysioNet. [doi:10.13026/dp1f-ex47](https://doi.org/10.13026/dp1f-ex47).

The [official release page](https://physionet.org/content/mimic-iv-demo/2.2/) identifies the license as [Open Data Commons Open Database License v1.0](https://opendatacommons.org/licenses/odbl/1-0/). The [upstream license notice](../static-site/vendor/licenses/MIMIC-IV-demo-2.2-LICENSE.txt) is retained with vendored notices. This provenance remains applicable to derived preparation outputs; no alternative license is assigned here. The source is one US hospital and uses shifted dates. Its delay summaries shape a demonstration feed and are not Finnish operational benchmarks.

PhysioNet platform citation: Pollard, T., Moody, B. E., Lehman, L., et al. (2026). *PhysioNet as a global platform for biomedical research*. Nature Health. [doi:10.1038/s44360-026-00096-z](https://doi.org/10.1038/s44360-026-00096-z).

## Stanford Antibiotic Resistance Microbiology Dataset

`data-prep/outputs/armd_params.json` contains aggregate return-gap summaries and expected-resistant pairs extracted from the ARMD files named in `data-prep/scripts/armd_params.py`. No ARMD patient-level table is included or needed to run Mindline.

Citation: Nateghi Haredasht, F., Amrollahi, F., Maddali, M., et al. (2025). *Antibiotic Resistance Microbiology Dataset (ARMD): A resource for antimicrobial resistance from EHRs*. Dryad. [doi:10.5061/dryad.jq2bvq8kp](https://doi.org/10.5061/dryad.jq2bvq8kp).

The bundled summary identifies the 22 October 2025 release. Dryad's [dataset metadata API](https://datadryad.org/api/v2/datasets/doi%3A10.5061%2Fdryad.jq2bvq8kp) identifies that release as CC0-1.0; the [source record](https://datadryad.org/dataset/doi:10.5061/dryad.jq2bvq8kp) supplies authorship, version history and methodology. Return-gap measurements characterize earlier resistant results in that cohort, not the chance that a present patient's treatment will succeed.

## Demonstration content

The knowledge seeds are prewritten multilingual examples, explicitly labeled illustrative. Repeated examples across months are a demonstration of concept grouping, not independent clinical evidence. Patient notes entered while trying the app are runtime state and are excluded from packaged source. Saved Ask answers and film snapshots were generated from this project's aggregate synthetic-data APIs; their dates remain snapshots rather than continuously current findings.

The original film and revised film live under `app/static/demo/` and `app/static/demo-v2/`. Their scripts remain in the repository. Music and final recording attribution belong alongside the selected presentation assets; data-source credits must not imply that external institutions endorse the product.

## Software and fonts

| Component | Used for | Notice |
| --- | --- | --- |
| D3 7.9.0 | Charts | ISC; [`D3-LICENSE`](../static-site/vendor/D3-LICENSE) |
| Three.js 0.170.0 | Optional sign-in scene | MIT; [`three/LICENSE`](../static-site/vendor/three/LICENSE) |
| Inter | Typography | SIL OFL 1.1; [`inter-OFL.txt`](../static-site/vendor/licenses/inter-OFL.txt) |
| Inter Tight | Typography | SIL OFL 1.1; [`intertight-OFL.txt`](../static-site/vendor/licenses/intertight-OFL.txt) |
| Space Grotesk | Film typography | SIL OFL 1.1; [`spacegrotesk-OFL.txt`](../static-site/vendor/licenses/spacegrotesk-OFL.txt) |
| Fraunces | Film typography | SIL OFL 1.1; [`fraunces-OFL.txt`](../static-site/vendor/licenses/fraunces-OFL.txt) |
| RDFLib | Python RDF/SPARQL engine | Installed through `app/requirements.txt`; preserve the installed distribution's license |
| Oxigraph | Static browser RDF/SPARQL engine | Bundled WebAssembly distribution and notices under `static-site/runtime/vendor/oxigraph/` |

Font notices were retrieved from the corresponding family directories in the [official Google Fonts repository](https://github.com/google/fonts/tree/main/ofl). Vendored asset origins are recorded in `static-site/vendor/manifest.json`. The static build copies vendor notices into its distribution.

The project's private status does not replace or alter third-party terms. This document records what is included and where it came from; it does not assign a blanket license to the project or its inputs.
