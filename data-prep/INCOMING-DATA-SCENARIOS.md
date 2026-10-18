# Incoming data: what can arrive, what can go wrong, how we simulate it

18 October 2026. The challenge asks for a **continuously updated** tool. The supplied dataset is one finished, clean extract covering 2 Oct 2023 – 27 Sep 2026. This document plans how new data arrives after that, how it can go wrong, how the tool reconciles it, and how we mock it so we can build and test against it now.

## 1. What a delivery probably looks like

We don't know Mylab's export format yet. **Working assumption:** every day (or every few hours) the lab system drops a **batch of new and changed rows** in the same six-table CSV shape, plus a small manifest.

```
incoming/2026-10-05T06-00/
  manifest.json        batch_id, created_at, source, row counts, file hashes, schema version
  cultures.csv         new or changed cultures
  isolates.csv         new or changed isolates
  susceptibility.csv   new or changed results
  patients.csv         new or changed patients (rare)
```

In a real lab system the underlying messages are usually HL7 v2 result messages or FHIR resources, sent one result at a time. Whatever the transport, we convert it into these batches, so the rest of the tool sees one shape.

The supplied CSVs lack four things a live feed needs. The mock feed adds them as columns:

| Added column | Why |
| --- | --- |
| `batch_id`, `received_at` | When we learned it: the **known time**, as opposed to the sample date (the **event time**) |
| `status` | `preliminary`, `final`, `corrected`, `cancelled` |
| `revision` | 1, 2, 3… for the same key, so corrections are versions, not overwrites |
| `reported_at` | When the lab released this version |

**Ask the mentors:** Which format and how often? Are preliminary results included? How are corrections and cancellations signalled? Do patient IDs ever merge?

## 2. Everything that can go wrong (or change)

Each scenario has a code so the simulator can switch it on. **Class** says how the tool should respond:
- **Block**: reject the whole batch and keep the last good state.
- **Quarantine**: hold the affected rows out of statistics and show them as held.
- **Accept + flag**: use the rows, but mark the affected charts.
- **Signal**: real change, which is exactly what the detectors exist for.

### A. Timing: right data, wrong moment

| Code | Scenario | Example | Class |
| --- | --- | --- | --- |
| A1 | **Staged results** | Culture on day 0, organism on day 1–2, S/R on day 2–3 | Normal. Recent days show as pending, not as a drop. |
| A2 | **Late arrival / backfill** | A health centre's results from three weeks ago arrive today | Accept + flag. Recompute past weeks, and say that the past changed. |
| A3 | **Out of order** | A susceptibility row arrives before its isolate row | Quarantine until the parent arrives, with a timeout |
| A4 | **Feed outage** | No rows from PHC-S for 6 days, then a burst | Accept + flag. "Missing", never "quiet". The burst is not a spike. |
| A5 | **Partial batch** | Cultures delivered, the isolates file missing | Block (manifest counts do not match) |
| A6 | **Duplicate delivery** | The same batch sent twice, or overlapping batches | Idempotent: same key and same content is a no-op |
| A7 | **Weekend and holiday rhythm** | Very few samples processed at midsummer or Christmas | Normal. The baseline must expect it. |
| A8 | **Clock problems** | Timestamp time zones, daylight-saving shifts, a sample date in the future | Quarantine dates in the future or before 2000 |

### B. Revisions: the lab changes its mind

| Code | Scenario | Example | Class |
| --- | --- | --- | --- |
| B1 | **Result corrected** | Ciprofloxacin S → R after a repeat test | Accept as revision 2; keep history; recount affected windows |
| B2 | **Organism re-identified** | *E. coli* → *Klebsiella pneumoniae* | Revision. The first-isolate selection can change, so re-derive that patient's episode. |
| B3 | **Second organism added later** | `n_isolates` 1 → 2 a day later | Revision. Mismatched counts are allowed only while preliminary. |
| B4 | **Resistance flag confirmed later** | ESBL flag 0 → 1 after a confirmation test | Revision. Matters for cluster counts. |
| B5 | **Culture cancelled** | Wrong patient labelled, sample withdrawn | Remove from statistics, keep in history, show who and when |
| B6 | **Results suppressed by cascade reporting** | Broad-spectrum drugs reported only when narrow ones fail | Accept + flag. Missing results are not missing at random. |
| B7 | **Erasure request** | Records must be removed for a legal reason | Remove everywhere, including derived aggregates; log only the fact |

### C. Identity: who and where

| Code | Scenario | Example | Class |
| --- | --- | --- | --- |
| C1 | **Patient merge** | Two IDs turn out to be one person | Re-derive first isolates for the merged patient; repeats appear |
| C2 | **Temporary ID** | Unidentified emergency patient later given a real ID | Same as a merge |
| C3 | **Demographic correction** | Sex or birth year corrected | Revision; re-derive cohorts |
| C4 | **Key collision / reuse** | A new culture arrives with an existing `culture_id` but different content | Quarantine. Never overwrite silently. |
| C5 | **Ward attribution** | Patient moved; the sample is filed under the requesting ward, not the current one | Accept. Document the rule; ask the mentors which ward applies. |

### D. Structure: the shape or vocabulary changes

| Code | Scenario | Example | Class |
| --- | --- | --- | --- |
| D1 | **New EUCAST version mid-stream** | `EUCAST 2027` appears in January | Accept + flag. Mark the date on every time chart; warn about trends that cross it. |
| D2 | **New antibiotic on the panel** | Temocillin starts being reported | Accept; unknown code → add to lookup with a "new" mark; no rate until 30 isolates |
| D3 | **Antibiotic dropped from the panel** | Cefuroxime no longer reported | Accept + flag. Not a fall to zero. |
| D4 | **New or renamed organism** | *Enterobacter aerogenes* → *Klebsiella aerogenes*, or WHONET codes (`eco`) instead of Latin names | Quarantine unknown names until mapped; keep a mapping table |
| D5 | **New ward / ward merge** | MED-A and MED-B merge; a new health centre joins | Accept + flag. The catchment changes, so the baseline breaks. |
| D6 | **New result values** | `I` (susceptible, increased exposure), MIC numbers, `NT` (not tested) | Quarantine until the counting rule is decided. `I` must not silently become S or R. |
| D7 | **New specimen type** | `sputum`, `screening swab` | Accept; keep out of clinical rates until decided |
| D8 | **Schema change** | Added, renamed or reordered column | Block unknown required changes; accept known optional additions |
| D9 | **File format** | Semicolon delimiter and decimal comma (Finnish Excel), Latin-1 encoding breaking `ä`, a byte-order mark, a missing header | Block with a clear message; never guess silently |

### E. Content quality: values that cannot be right

| Code | Scenario | Example | Class |
| --- | --- | --- | --- |
| E1 | **Orphans** | Isolate whose culture never arrives | Quarantine (see A3) |
| E2 | **Impossible values** | Age 140, `n_isolates` 5, unknown `result` value | Quarantine row |
| E3 | **Biologically implausible** | MRSA flag on *E. coli*; vancomycin reported for *E. coli*; *Proteus*–nitrofurantoin reported S | Accept + flag for lab review (EUCAST expected-resistant rules; the biology pilot already found 517 *Citrobacter*–cefuroxime cases) |
| E4 | **Contradictory repeats** | A susceptibility row's organism differs from its isolate's organism | Quarantine |
| E5 | **Test records leak in** | Patient "TESTI", ward "LAB-QC" | Quarantine; keep a known-test-ID list |
| E6 | **Free-text identifiers** | A personal identity code typed into a comment field | Block the field; never store it |

### F. Practice changes: the data is valid, but its meaning changed

These are the dangerous ones. Every check passes, yet the numbers shift for non-biological reasons.

| Code | Scenario | What it looks like | Class |
| --- | --- | --- | --- |
| F1 | **Screening programme starts** | Many more cultures on one ward and more carriers found, while infections are unchanged | Accept + flag. Needs a note; the change breakdown should show "more samples". |
| F2 | **Sampling policy change** | Urine cultures only after a failed first treatment → resistance looks higher | Accept + flag. Patient mix changed, not bacteria. |
| F3 | **New analyser or method** | A step change in S/R for one drug on one date across all wards | Signal, but with "all wards at once" as the clue |
| F4 | **Breakpoint change** | Same bacteria, new cut-off → more R | See D1 |
| F5 | **Volume shock** | An epidemic of something else, ward closure | Accept + flag. Rates are fine; counts mislead. |

### G. Real events: what the tool exists to find

| Code | Scenario | Example |
| --- | --- | --- |
| G1 | Outbreak | 12 MRSA in the ICU in 5 weeks, one resistance pattern |
| G2 | Slow drift | Trimethoprim resistance creeping up 1–2 points a year (the supplied data shows +1.8 a year) |
| G3 | First appearance | The first-ever CPE in the hospital: one case is the signal |
| G4 | Cross-species spread | ESBL in *E. coli*, then *Klebsiella*, on the same ward (plasmid) |
| G5 | Community import | Rise in outpatients and at admission, not on day 3 or later |
| G6 | Rate shift, same volume | On one ward the resistant share of one drug jumps while case numbers stay normal (simulated) |
| G7 | Pseudo-outbreak (look-alike) | A contaminated lab batch: identical results on unrelated wards within days, not a real outbreak (simulated) |

G2 (slow drift) is simulated as extra points per year on top of the trend measured in the data. New cases after the data ends follow each drug's measured trend automatically, so they don't lag a year behind the cases they were copied from.

**The core difficulty:** A2, A4, B6, D1, D3, D5 and F1–F5 all *look like* G1–G5. The tool must keep "the data changed" separate from "the bacteria changed", and show which is more likely.

## 3. How the tool reconciles incoming data

1. **Land everything raw, append-only.** Every batch is stored as received, with `batch_id` and `received_at`. Nothing is edited in place.
2. **Validate in tiers.** Batch-level (manifest, format, schema) → row-level (types, ranges, keys) → cross-row (parents, contradictions) → biology (expected-resistant rules). Each rule names its class: block, quarantine, or accept + flag.
3. **Upsert by natural key with versions.** `(culture_id)`, `(isolate_id)`, `(isolate_id, antibiotic_code)`. A changed row becomes a new revision; the old one stays.
4. **Keep two clocks.** Event time (sample date) and known time (received). Any view can be asked "as known on date X", which is how replay and honest backtests work.
5. **Map vocabularies explicitly.** Organism, antibiotic, ward and guideline mapping tables, versioned. An unknown value waits in quarantine until someone maps it.
6. **Recompute only what changed.** A batch touches some ward-weeks; recompute those windows, their first-isolate episodes and their detectors. Record what moved: "3 past weeks revised".
7. **Nowcast the open window.** Learn the usual delay from sample to final result. Show recent weeks as observed plus expected-still-to-come, with a range.
8. **Surface data health to users.** Pending results, held rows, outages, revisions, new codes and breakpoint changes appear on every chart and in every export. They never quietly disappear into the numbers.
9. **Never invent.** No imputing results, no guessing ward moves, no filling gaps with zeros.

## 4. The mock feed: yes, and build it from the real dataset

**Recommendation: don't invent a new mock dataset. Turn the supplied one into a feed.** The supplied data is already realistic and calibrated to Finres. What it lacks is *time of knowing* and *mess*. A mock built on it keeps every count comparable with our existing analysis.

### How it works

1. **Split at a cutoff.** Everything sampled before the cutoff (for example week 104, Sept 2025) is the starting history. Everything after becomes the future stream.
2. **Stage each record.** For each future culture, draw delays from simple distributions:
   - culture row at day 0–1
   - organism at +1–2 days, preliminary
   - S/R at +2–4 days
   - final shortly after

   Blood is faster and wound cultures slower.
3. **Emit daily batches** in the folder shape above, with a manifest and the added columns.
4. **Inject scenarios** from section 2 by code, each with a seed, start date and strength. Examples:
   - `A4 ward=PHC-N days=6`
   - `B1 rate=0.5%`
   - `D1 date=2026-01-01`
   - `D9 delimiter=;`
5. **Write the truth separately.** A `truth.json` per stream lists every injected fault and event with its dates. The tool never reads it; only the evaluation does.
6. **Extend beyond Sept 2026 later.** To run past the end of the data, resample patient histories by ward and season, then apply the same staging and faults. That comes after the replay works.

### Streams to generate

| Stream | Contents | Use |
| --- | --- | --- |
| `clean` | Staging only (A1) | Baseline; the tool must match the static analysis once everything is final |
| `realistic` | A1, A2, A6, A7, B1–B4 at low rates, one A4 outage, one D1 breakpoint change | Demo default |
| `nasty` | Every class at least once, including D9 format errors and C1 merges | Robustness test: nothing crashes, nothing silently wrong |
| `quiet` | Real events removed, faults kept | Count false alarms honestly |
| `live-demo` | `realistic` plus an injected G1 or G3 that we trigger during the pitch | Shows detection within days, on an event nobody tuned for |

### Pass criteria

- After the last batch of `clean`, the counts equal the static dataset's counts exactly.
- Every injected fault in `nasty` is either blocked, quarantined or flagged. None is silently absorbed.
- The planted outbreaks are found within N days of the first case, and `quiet` produces at most the declared number of false alarms.
- Any view can be rebuilt "as known on date X" and gives the same answer twice.

## 5. Open questions

1. What format does the Mylab export use, and how often does it arrive?
2. Are preliminary results available to us, or only final ones?
3. How are corrections, cancellations and patient merges signalled?
4. Which ward owns a sample when a patient moves?
5. Is cascade reporting used at Tyks? (It changes what "not tested" means.)
6. Will `I` results and MIC values appear in the real feed?
