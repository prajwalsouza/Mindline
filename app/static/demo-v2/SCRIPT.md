# Mindline — Version 2

**Capturing the fingerprints of wisdom**

A 106-second visual essay. Original instrumental music. No voiceover.

The writing follows a question, notices an omission, then tests what that omission means. The short lines below are the film's script; the accompanying pictures do part of the telling. The aim is curiosity and a change in perspective, without borrowing a presenter's catchphrases or performance.

## 00:00–00:06 · Where does a doctor's decision begin?

A page carries a recommendation.
A person carries the years around it.

*A guideline sits on the left. Lines arrive from a conversation and a remembered patient. They meet at a decision.*

## 00:06–00:15 · A guideline is read. A mindline is formed.

In two English practices, researchers found knowledge being made and remade through experience and trusted colleagues.

*Reading, colleagues, patients and experience become four threads. Each continues through the point where they meet. The word “mindline” appears beneath it.*

## 00:15–00:22 · The choice is recorded. The reason can disappear.

Years of experience may fit into one decision.
The record may keep only the decision.

*“I changed the plan because the last culture was resistant.” Beside it, an abbreviated record keeps “Plan changed”. The space for the reason is empty.*

## 00:22–00:29 · AI can read what survives.

It can learn from recorded history and new results.
A reason never recorded is still missing evidence.

*The recorded observations become a field of marks. A separate, empty space asks: “Why this time?”*

## 00:29–00:34 · Mindline

Capturing the fingerprints of wisdom.

Local laboratory evidence, with a place for the reasoning around it.

*The threads become a fingerprint. The name appears for the first time.*

## 00:34–00:41 · Results arrive in pieces.

A sample. An organism. A susceptibility result.
Corrections update the same record.

*Three streams join into a linked history: what was sampled, what was reported, and when it became known. There were 15,473 samples in the year used by this snapshot.*

## 00:41–00:50 · Does the familiar answer still fit?

Look at the year. Then the recent results.
Keep the size of the evidence in view.

*Two drugs, one explicit comparison population. Nitrofurantoin: 333 of 367 reported susceptible over the year; 13 of 14 recently. Ampicillin: 196 of 345 over the year; 6 of 14 recently. The window changes while the denominator stays visible. These are laboratory results, not a treatment recommendation.*

## 00:50–00:58 · Keep the because.

A result tells us what was found.
A note can keep what made someone reconsider.

*“I revisited the plan because her last culture was resistant.” The explanation is highlighted and kept beside the patient and author. This is the current patient-linked capture flow. The film does not imply that the note is automatically shared with colleagues.*

## 00:58–01:07 · Nine cases. Is that unusual here?

The hygiene team sees each ward against its own history.
The ICU now deserves a closer look.

*Nine wards. The ICU has nine resistant cases over four weeks, against about 1.5 expected. Selecting another ward changes the comparison. Counts cover the tracked resistance types; they are not all labelled MRSA.*

## 01:07–01:14 · Sometimes the change is in the delivery.

A late batch can look like a sudden change.
Sampling time and arrival time tell different stories.

*An illustrative arrival chart is quiet, then rises. Twenty-two late results arrived together at the southern health centre. The schematic bars explain the mechanism; they do not pretend to be a daily measurement series.*

## 01:14–01:22 · A question can become a view.

Ask in ordinary language.
The answer brings the relevant chart and its evidence with it.

*“Is last month a better guide than last year?” becomes a comparison. For nitrofurantoin in Urology urine samples, the earlier year did slightly better: average log loss 0.350 versus 0.371, over 580 tests. This is a scripted replay of the new Ask capability, using actual computed results. The model selects supported chart types and explains the supplied facts; it does not invent the measurements.*

## 01:22–01:30 · Let the next month answer.

Estimate from earlier results.
Reveal the next four weeks.
Repeat, and see which history holds up.

*Thirteen historical windows. Two estimates are drawn from earlier data; held-out results appear as dots. Prediction becomes something that can be checked. This comparison concerns laboratory resistance in synthetic data, not patient outcomes or validated clinical performance.*

## 01:30–01:40 · What if the pattern changed tomorrow?

Resample past cases. Model when results arrive.
Add a cluster, a gap, or a correction—and watch the system respond.

*A historical stream branches into test scenarios. The generator uses fixed Python functions: data-informed arrival rates and delays, resampled linked records, and deliberately configured disruptions. A seed makes a test repeatable. The animated branches illustrate generation; they are not outbreak forecasts.*

## 01:40–01:46 · Mindline

Capturing the fingerprints of wisdom.

Keep the evidence. Keep the reasoning.
Leave the next person more to work with.

*The threads return to the fingerprint. The composition holds long enough to read.*

## Evidence and editorial boundaries

- The opening draws on [Gabbay and le May's 2004 ethnography](https://www.bmj.com/content/329/7473/1013), also indexed by [PubMed](https://pubmed.ncbi.nlm.nih.gov/15514347/). Its setting was two English general practices. We did not conduct this fieldwork. The film avoids the universal claim that doctors do not use guidelines.
- AI's access to recorded information is a product-design premise, not a claim that models cannot use new inputs or that every explanation faithfully captures tacit knowledge.
- The doctor and ward numbers derive from the original demo's frozen synthetic API outputs. The V2 baseline corrects the historical 337-day divisor to 365 days. V1 is untouched.
- The prediction snapshot comes from `/api/app/insights?role=doctor&asof=2026-09-27&ward=URO&spec=urine`. The current implementation is in `app/insights.py`, `best_window`. The comparison uses Laplace-smoothed earlier proportions and tests them against each following four-week window. Log loss measures the probability assigned to the outcomes observed.
- Generated answers and generated test data have different roles. The Ask feature arranges explanations and existing charts. The event simulator creates synthetic records for testing. Neither is described as generating new clinical evidence.
- The HTML is a presentation, with local illustrative interactions. “Keep this note” changes presentation state only. All data, fonts and music are local; the film makes no backend requests or AI calls.

Music: an original instrumental score synthesized for Mindline; no sampled commercial recordings. Fonts: Manrope and Literata, distributed under the SIL Open Font License; notices are in `assets/`.
