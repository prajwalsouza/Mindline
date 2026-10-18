# Data dictionary

This dictionary describes the supplied synthetic dataset, not a general hospital data contract. [Source documentation](synthetic_microbiology_dataset/README.md) remains authoritative for its generation assumptions. The product reads these CSVs through `data-prep/simulator/feedsim/data.py`. Earlier experimental SQLite schemas/catalogs are not included or needed here.

## Source tables

### `patients` — one row per synthetic patient

| Column | Type | Meaning |
| --- | --- | --- |
| `patient_id` | text, primary key | Synthetic person identifier; keep as text |
| `sex` | text | Source categories F/M; no other categories supplied |
| `birth_year` | integer | Year only; not a date of birth |
| `home_area` | text | Synthetic area label; not coordinates or real geography |

Age at sampling is supplied separately in `cultures.age_years`. Do not replace it with current year minus birth year.

### `wards` — one row per sample-location code

| Column | Type | Meaning |
| --- | --- | --- |
| `ward_code` | text, primary key | Nine source locations, including primary-care sites |
| `ward_fi`, `ward_en` | text | Finnish and English display labels |
| `ward_type` | text | `in` / `out`, the supplied inpatient/outpatient classification |
| `institution` | text | `hospital` / `primary_care` |

These are lookup records. They do not supply ward geometry, bed capacity, patient-days or a contact graph.

### `antibiotics` — one row per source antibiotic code

| Column | Type | Meaning |
| --- | --- | --- |
| `antibiotic_code` | text, primary key | Supplied WHONET-style identifier; e.g. NIT |
| `antibiotic`, `antibiotic_fi` | text | English and Finnish labels |
| `class` | text | Supplied grouping, retained as provided |
| `reported_for` | text | `all` or `urine`; not evidence every eligible isolate was tested |

FOX is a screening entry in this dictionary, not a treatment recommendation.

### `cultures` — one row per submitted culture

| Column | Type | Meaning |
| --- | --- | --- |
| `culture_id` | text, primary key | Culture/sample identifier |
| `patient_id` | text, foreign key | Parent patient |
| `age_years` | integer | Supplied age at sampling, 0–120 |
| `sample_date` | ISO date text | Sample date, not result arrival/availability |
| `iso_year`, `iso_week` | integer | ISO week calendar; validated against sample date |
| `ward_code` | text, foreign key | Location attached to this sample |
| `ward_fi`, `ward_en`, `ward_type`, `institution` | text | Repeated location metadata, checked against `wards` |
| `admission_date` | nullable ISO date text | Supplied admission date; required for `in`, absent for source outpatients |
| `specimen` | text | `urine`, `blood`, `wound` |
| `specimen_fi` | text | Source Finnish specimen label |
| `result` | text | `positive`, `negative`, `mixed_growth` |
| `n_isolates` | integer | 0–2; validated against actual child records |

Keep negative and mixed-growth cultures for sampling denominators. Multiple cultures do not establish distinct infections or admissions.

### `isolates` — one row per cultured organism

| Column | Type | Meaning |
| --- | --- | --- |
| `isolate_id` | text, primary key | Isolate identifier |
| `culture_id` | text, foreign key | Parent culture |
| `isolate_no` | integer | 1 or 2; unique within a culture |
| `organism` | text | Supplied Latin species name |
| `quantity` | nullable text | Mixed source conventions: urine quantity strings, wound plus signs; not one numeric unit |
| `esbl`, `mrsa`, `vre`, `cpe` | integer | Source phenotype flags 0/1, not measured genes or confirmed transmission |

Do not convert missing quantity to zero. Do not treat repeated isolates as duplicates to delete.

### `susceptibility` — one row per reported isolate–antibiotic result

| Column | Type | Meaning |
| --- | --- | --- |
| `isolate_id`, `antibiotic_code` | text, composite primary key | Defines one reported test |
| `culture_id` | text, foreign key | Repeated culture link, checked against parent isolate |
| `organism` | text | Repeated organism label, checked against parent isolate |
| `antibiotic`, `antibiotic_fi` | text | Repeated labels, checked against antibiotic lookup |
| `result` | text | S or R only; no I, MIC or zone values supplied |
| `guideline` | text | Supplied EUCAST year label; year agreement is checked, breakpoint comparability is not established |

An absent isolate–drug row means **no reported result in this file**. It does not establish susceptible, resistant, not tested or intrinsically resistant. Distinguish those causes only when more source information is available.

## Earlier analysis naming conventions

The following names describe derived fields used during earlier analysis. They are useful definitions, not tables or views shipped by this product repository. The active APIs compute their own documented cohorts directly from source records.

| Field | Definition |
| --- | --- |
| `culture_result` | Renamed `cultures.result` to avoid confusion with S/R |
| `susceptibility_result` | Renamed `susceptibility.result` |
| `antibiotic_class` | Renamed antibiotic lookup `class` |
| `hospital_day` | For inpatients, sample date − admission date + 1; otherwise NULL |
| `sample_timing` | `outpatient`, `inpatient_day_1_2`, `inpatient_day_3_plus`, or `unknown` |
| `week_start`, `week_end` | Monday–Sunday calendar boundaries |
| `culture_count` | Number of submitted cultures recorded for ward/week, including zero |
| `positive_culture_count` | Number of those culture records with source result positive |
| `within_dataset_date_bounds` | 1 if the entire week falls within the file's observed minimum/maximum sample dates; does **not** prove feed completeness |

## Not supplied

Diagnoses, antibiotics actually prescribed, doses, clinical outcomes, result arrival timestamps, complete admissions/transfers, patient-days, screening indications, genes, sequencing and expert review decisions. These need separate sources or explicit future application records; they must not be manufactured from these tables.
