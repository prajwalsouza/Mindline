# Detection evaluation

Measured on the supplied synthetic history and the default simulated feed (seed 11). These are prototype replay results, not clinical validation.

Run `python app/detection_eval.py --quick` to reproduce the required event/alert evaluation. Omit `--quick` to also measure weekly historical antibiogram markers (slower).

## Event detection

Delay is measured from the scenario start and from the first observable lab result. Historical results are assumed available on their sample date because arrival timestamps are absent.

### Simulated live feed (demo run, seed 11)

2026-09-28 to 2027-01-26; 155.6 ward-weeks.

| Event | Detector | First flag | Days from start | Days from first observable result |
|---|---|---|---:|---:|
| MRSA outbreak on ICU | Ward above usual | 2026-10-20 | 12 | 6 |
| MRSA outbreak on ICU | Poisson/BH clear | 2026-10-24 | 16 | 10 |
| MRSA outbreak on ICU | Cluster | 2026-10-18 | 10 | 4 |
| MRSA outbreak on ICU | Antibiogram change | 2026-10-30 | 22 | 16 |
| First CPE, MED-B | First type | Not detected | — | — |
| First CPE, MED-B | Ward above usual | Not detected | — | — |
| First CPE, MED-B | Poisson/BH clear | Not detected | — | — |
| First CPE, MED-B | Cluster | Not detected | — | — |
| Rate shift, CIP on ED | Antibiogram change | 2026-11-10 | 23 | 17 |
| Outage, PHC-S | Data gap | 2026-10-03 | 0 | 0 |
| Outage, PHC-S | Late batch | Not detected | — | — |
| Late backfill, PHC-N | Data gap | 2026-10-14 | 0 | 0 |
| Late backfill, PHC-N | Late batch | 2026-10-26 | 12 | 12 |

| Detector | Unmatched episodes | Per 100 ward-weeks |
|---|---:|---:|
| Ward above usual | 1 | 0.64 |
| Poisson/BH clear | 0 | 0.0 |
| Cluster | 4 | 2.57 |
| First type | 0 | 0.0 |
| Data gap | 3 | 1.93 |
| Late batch | 16 | 10.28 |
| Antibiogram change | 42 | 27.0 |

Not evaluated: A1: every result is staged; not an event; N: the background cases; not an event; B1: a data-quality fault handled by the import checks, not by a surveillance detector; A3: a data-quality fault handled by the import checks, not by a surveillance detector; B2: a data-quality fault handled by the import checks, not by a surveillance detector; E3: a data-quality fault handled by the import checks, not by a surveillance detector; G2: hospital-wide drift; only 8 results flipped in 4 months, below what any detector here is built to see; D1: a data-quality fault handled by the import checks, not by a surveillance detector; A6: a data-quality fault handled by the import checks, not by a surveillance detector.

### Supplied history (data/, synthetic)

2024-10-29 to 2026-09-27; 898.7 ward-weeks.

| Event | Detector | First flag | Days from start | Days from first observable result |
|---|---|---|---:|---:|
| ESBL E. coli outbreak on Urology (Jun 2025) | Ward above usual | 2025-06-04 | 3 | 0 |
| ESBL E. coli outbreak on Urology (Jun 2025) | Poisson/BH clear | 2025-06-07 | 6 | 3 |
| ESBL E. coli outbreak on Urology (Jun 2025) | Cluster | 2025-06-04 | 3 | 0 |
| MRSA outbreak on ICU (Mar 2026) | Ward above usual | 2026-03-07 | 6 | 4 |
| MRSA outbreak on ICU (Mar 2026) | Poisson/BH clear | 2026-03-09 | 8 | 6 |
| MRSA outbreak on ICU (Mar 2026) | Cluster | 2026-03-07 | 6 | 4 |
| Data-feed outage, Health centre South (week of 8 Dec 2025) | Data gap | 2025-12-08 | 0 | 0 |

| Detector | Unmatched episodes | Per 100 ward-weeks |
|---|---:|---:|
| Ward above usual | 23 | 2.56 |
| Poisson/BH clear | 3 | 0.33 |
| Cluster | 23 | 2.56 |
| First type | 5 | 0.56 |
| Data gap | 13 | 1.45 |

Not evaluated: H-TMP: slow hospital-wide drift; none of these detectors is a trend test (the brief's trend line is descriptive).

## Interpretation and limitations

- **Unmatched is not the same as false.** The supplied history contains documented planted outbreaks, a sampling outage and a slow drift. Other real-looking changes are not exhaustively labelled. The JSON field `false_alerts` retains the original evaluator name; the report calls these unmatched episodes.
- The history spans three years, but scoring begins after 393 days needed for the full baseline. Do not quote this as three complete scored years.
- Matching is temporal attribution, not causal proof: same ward and event window; clusters additionally require matching organism, resistance type and an event-window case on that ward. Ward and antibiogram alerts cannot identify which individual scenario caused them. No detection is credited before the first observable result.
- Episodes: each ward/Poisson/antibiogram crossing; a cluster fingerprint, type and chain start (growth is a follow-up); gap/late runs separated by at most three days. An episode is matched if any update meets the event rule. Exposure is days / 7 × nine wards. Repeated overlapping windows are not independent.
- The two ward criteria are deliberately reported separately: the dashboard's simple threshold and the stricter Poisson test corrected across wards. A lower unmatched-alert rate alone does not establish a better detector; compare delays and misses too.
- **The planted first CPE is missed.** The incident path keeps only the first resistance flag on a multi-flag case; CPE can be obscured by ESBL. This evaluation does not change detector logic or disguise that failure.
- A single CPE need not trigger a three-case cluster or ward-count threshold. The first-type detector is the relevant test for it. A permanent outage need not produce late arrivals.
- Historical cluster attribution is approximate because per-case planted-event labels are absent. Previously circulating patterns may grow during a documented outbreak. Historical lab timing is optimistic; feed timing uses actual simulated deliveries.
- One synthetic run, one seed, fixed thresholds, no prospective or clinical validation. More seeds, an independent test set, and adjudicated event labels are needed before deployment.

Full event matching, individual alerts and exclusions: [detection.json](static/demo/detection.json).
