# Counting and interpretation rules

These conventions describe the supplied dataset and current application. They are explicit development choices, not a universal clinical surveillance standard.

## Cohort and time first

Store all source records. At query time, state the sample-date window and population first. Then choose the appropriate counting unit and repeat-isolate policy. Do not mark a single globally first isolate as the only usable record: the first in a 28-day window can differ from the first in a 12-month window.

The doctor cohort in `app/evidence.py` applies its window, specimen, ward, age, sex and organism filters before selecting the first isolate per **patient + organism + specimen** in that filtered population. Pooled and ward cohorts are calculated separately. Insights use the question-specific windows and strata in `app/insights.py`. Keep that population/filter order explicit; selecting first across all locations and then filtering a ward would produce a different cohort.

All sites includes hospital and primary care. A hospital-only cohort must explicitly filter `institution = 'hospital'`; do not call all-site pooling hospital-wide.

## Match denominator to question

| Question | Required unit |
| --- | --- |
| Did recorded sampling drop? | All cultures, including negative and mixed growth |
| How many selected phenotype cases occurred? | First isolates under a declared window/species/specimen policy; use patient-based case policy if that is the agreed question |
| What share of selected tested isolates were R? | Reported S/R tests for that drug among selected isolates |
| What is culture-level documented coverage? | All isolates within each selected positive culture; do not select one organism and ignore another |

Retain counts when samples are small. The doctor annual view requires at least 30 pooled drug-specific tests and routine testing coverage; it uses ward data only when the ward also has at least 30 tests. Recent-window counts can be shown with an explicit small-sample explanation. Insights have question-specific gates. None of these thresholds guarantees a reliable estimate or establishes a clinical decision boundary.

Missing drug results remain unknown. The culture-level coverage calculation separates all-isolates-S, any-isolate-R, and unknown, rather than recoding absent tests to R. This describes laboratory evidence in a selected cultured population, not probability of clinical cure.

## Preserve the limits

- The supplied history has sample dates but no result-release timestamps. The live simulator explicitly adds staged availability. Moving the Data clock hand filters sample dates within the current snapshot; it does not reconstruct historical lab releases.
- Day 3+ after admission is a timing proxy; it is not adjudicated hospital acquisition.
- Samples from multiple wards do not establish transfers, overlapping stays or transmission direction.
- A shared resistance pattern is a phenotype similarity, not a shared strain or gene result.
- Keep EUCAST version visible. Matching year labels does not establish unchanged breakpoints across years.
- A zero-volume week means no records for that ward/week. Distinguish this from confirmed outage and from zero infections.
- Compare partial calendar years using matched periods, or label them partial. Do not silently annualize counts.

## Where logic lives

`app/evidence.py`, `app/insights.py`, `app/overview.py` and `app/feed.py` implement the active calculations. Their browser counterparts live in `static-site/runtime/` and are checked against Python reference fixtures. `app/detection_eval.py` evaluates simulated detection behavior. Earlier pipeline/notebook experiments are outside this product repository.

Injected scenario labels are evaluation inputs, not detector features. Repeated illustrative clinician statements are counts of mentions, not consensus, independent evidence or verified treatment rules.
