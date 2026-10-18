# Questions → display elements

How Mindline's views are planned: start from the questions people actually ask (from our company notes and the design brief), give each question **one display element**, then compose views from those elements. Every element is a card that can appear in more than one view and is exported the same way everywhere.

Rules that apply to every element:
- **Counts, not percentages, when numbers are small.** A share is shown only with at least 30 tested; a ward is coloured or called unusual only with at least 3 cases.
- **Show, don't tell.** Observed against expected, with n and the comparison named; never "you should".
- **Real change, look-alike and data problem are kept apart.**
- **Every number links to its evidence** (a click opens the view it came from, filtered).

## Hygiene team

| Question (from the brief) | Display element | Data | Where |
| --- | --- | --- | --- |
| Which new ESBL, MRSA, VRE or CPE cases appeared since yesterday, and where? Which were acquired in hospital? | **New-case strip**: one dot per case on its ward; filled = sampled day 3 or later of the stay, hollow = earlier or outpatient | Resistant first isolates confirmed since yesterday; admission date for the day of stay | Morning brief |
| Is a cluster growing, stable or over? How many days since the last case? | **Cluster rows**: status word, 60-day dot timeline, days since last case, wards involved | Cases sharing organism and resistance fingerprint, 3 or more within 14-day gaps | Morning brief, Ward overview |
| Which wards differ from their own normal, and since when? | **Normal-range bars**: this period's count against the ward's own usual band | First resistant isolate per patient and type; each ward's previous year | Morning brief, Ward overview |
| Are these cases linked? | **Shared patterns**: fingerprint strip, cases as dots, wards listed | Organism + S/R pattern | Ward overview |
| Which wards share patients? | **Ward map**: size = samples, colour = above normal (3+ cases), lines = shared patients | Patients sampled on more than one ward | Ward overview |
| Slow trends that crossed a threshold | **Trend lines**: 24 months of resistant share for key organism–drug pairs, EUCAST version changes marked | First isolates; guideline column | Morning brief |
| Is a drop real, or a data gap? | **Data health**: samples per ward per day against usual, gaps and late batches marked, pending results | Culture volume; delivery times from the feed | Morning brief |
| What do colleagues know? | **Notes list**, de-identified | Ward knowledge graph | Morning brief, doctor evidence card |
| When? | **Time strip** with a window you drag, resize, or preview by hovering | All of the above, by week | Ward overview |

## Doctor

| Question | Display element | Where |
| --- | --- | --- |
| Will this drug likely work for a patient like this, on my ward? | **Dot rows**: 12 months as 20 dots, last 4 weeks as a marker, hospital-wide fallback named | Will it work here? |
| What has this patient grown before, and what did it survive? | **Patient history list**, drugs it survived marked on the drug rows | Will it work here? |
| What usually grows here? | **Organism bubbles**, click to narrow the drugs | Will it work here? |
| What do colleagues know about this drug here? | **Notes list**, de-identified | Evidence card |

## Exports

Every view has **Export → HTML** (one self-contained file: styles, fonts and vector SVG graphics inside) and **Export → PDF** (a print layout on A4; save as PDF from the print dialog, graphics stay vector). Exports carry the date, the data source ("simulated feed" or "Tyks data") and the counting caveats.

## Insights

Fixed questions, chosen in advance; each is shown only when the data can answer it. Time windows are stated on every answer.

| Who | Question | Analysis | Window |
| --- | --- | --- | --- |
| Hygiene | Which drugs are losing ground? | Urinary E. coli, first isolate per patient; direct standardisation over sex × age group × ward; 95% interval; Benjamini–Hochberg across drugs | This year against two years ago (or last year) |
| Hygiene | More resistant results, or just more samples? | Exact split of the count change into sampling volume and resistant share; two-proportion test on the share | Last year against this year |
| Hygiene | Is any ward unusual for itself? | Poisson tail and 95% range against the ward's own previous 48 weeks; BH across wards; the app's flag (≥3 cases, well above normal) kept as the headline rule | Last 4 weeks |
| Hygiene | Is a quiet week a real zero? | All cultures per ward-week against the median of the 26 weeks before; Poisson lower tail below 1 in 1,000 | Last 52 weeks |
| Hygiene | Are results arriving late? | Days from sample to result per ward: median, 90th percentile, late batches (live feed only) | Last 4 weeks |
| Hygiene | Are these cases more than chance? | Pattern rarity among the organism's isolates; Monte Carlo scan test (1,999 reshuffles) of the busiest 4 weeks | Last 52 weeks |
| Hygiene | Does resistance to one drug still predict another? | Established rules (OR ≥ 1.5, interval above 1, 10–90% conditional failure); ratio of odds ratios; BH across all rules | Earlier period against the last year |
| Doctor | Does who the patient is change the odds? | Commonest organism for the sample; women vs men and under 65 vs 65+, each standardised for the other factors and ward; BH; ≥2 points to be clear | Last two years |
| Doctor | Before the lab names the organism, how often does it work? | First positive culture per patient: works for all organisms / fails for one / not tested; by organism once known | Last year |
| Doctor | Is the last month a better guide than the year? | Rolling back-test: log loss of predicting each 4-week window from the year before vs the 4 weeks before | 13 four-week windows |
| Doctor | If it's resistant to one drug, what else fails? | Conditional resistance for every pair (≥20 each way); suggestion = narrowest drug still working ≥85% | Last year |
| Doctor | What do colleagues start for cases like this? | De-identified decisions from narrated notes against the drug's local susceptibility | Last year, ≥3 decisions |
