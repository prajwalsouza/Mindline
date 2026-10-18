# Mindline

The product: sign in, then dashboards for doctors and the hygiene team. The admin area (the data generator) runs on the same server.

```bash
python -m pip install -r app/requirements.txt
python app/server.py 8800
```

Open http://localhost:8800/. The admin area is at http://localhost:8800/admin/. Everything uses synthetic data.

## Sign in

- Two demo accounts: `doctor@mindline.demo` and `hygiene@mindline.demo`.
- Click one: the choices step aside, the password types itself in, and you're signed in. Demo only; there's no real password.
- Behind it, a lazy-loaded three.js scene (`static/scene3d/`): a glass testing lab on a riverbank, with planting, a green roof and architectural lighting. The parts stream in one by one. The sun/moon button switches theme, and the scene doesn't crossfade: the sun sets behind the hills, the lights come on one by one, and the moon rises (the reverse for light). Without WebGL, the petri dish is shown instead: click to drop an antibiotic (susceptible bacteria die, resistant ones multiply), double-click for a fresh dish.
- **Watch the film** opens the demo (below). A small **Admin** switch sits in the bottom corner.

## The film

`/demo/` is a 1½-minute, click-driven film about Mindline on synthetic data. Click, → or space moves on, ← goes back, P pauses, and links like `/demo/#doctor/2` jump to a build. The story and script are in [demo/STORY.md](demo/STORY.md).
- The data is a snapshot of this server's own API, recorded day by day while the simulated feed rolls through Oct–Nov 2026: `python app/demo/snapshot.py` writes `static/demo/data.json` and puts the feed clock back where it was.
- One pool of dots carries through the film: lab results, then drug rows, then cases on the wards, then the logo. Words, drug rows and the day strip are interactive and never advance the film.

## Shell, shared by all roles

- **Collapsible icon rail.** Each role sees only its own views.
- **Profile & settings**, opened directly from the top profile or the sidebar profile entry:
  - **Your profile:** name, role, email, home ward, and a 2-, 4-, 8-, or 12-week preference. Changes save locally per demo account. Sign out lives here.
  - For doctors, the week preference controls the recent antibiotic comparison and its exports; the 12-month reference stays visible. For hygiene staff, it sets the initial Ward overview window.
  - **Theme:** Quiet Light, Matte Dark, Neo-brutal, Print.
  - **Language:** English, Suomi, Svenska. Drug, ward and sample names come from the dataset's own Finnish columns; Swedish names are added in `locale_names.py`.
  - **Resistance types** remain in the hygiene profile alongside ward and week preferences.

## Today: the live feed

The simulation toolbar starts collapsed behind a small chevron at the right edge. Expand it to access the date, playback, calendar and reset controls. Collapsing it pauses playback and closes the calendar; admin and settings views keep it hidden.

A small floating clock sits bottom left: **Today**, then **previous day**, **next day**, **play** (a day every 1.6 seconds) and **back to where the data ends**. The Morning brief, the doctor view, the Ward overview and Insights all recompute as the day moves.

- What the app knows on a day is the supplied Tyks data (it ends 27 Sep 2026) plus every result the simulated feed has delivered by then, at its latest revision. Late, pending and corrected results are all included (`feed.py`).
- The default feed is a feed-simulator run that starts on 28 Sep 2026, with an ICU MRSA outbreak, an outage, a late batch, a sudden rise and a first-ever CPE placed in the first weeks.
- Both dashboards recompute in place as days arrive. Feed patients show their real lab stage. Resistance only counts once the lab confirms it, so an outbreak shows up a few days after it starts, as it would in reality.

## Doctor: Will it work here?

- **Patient-centred.** The ward comes from the account, and the sentence at the top says who the page is for.
- **Corner icons** (bottom right). Each opens a glass sidebar:
  - **Patients:** recent samples on the ward. Picking one fills in sex, age and sample, and uses the organism once the lab has named it.
  - **Who and where:** ward, sex, age, sample.
  - **Patient record:** history, plus **Add note** and a microphone shortcut (below).
- **Drug list.** 12 months of results as dots, the recent window (4 weeks by default) as a triangle, and hospital-wide data when a ward has fewer than 30 tested. Drugs this patient's bacteria survived before are marked.
- **Beside the list:**
  - this patient's earlier samples
  - what usually grows here
  - the evidence card, which includes de-identified knowledge from colleagues

## Patient notes: focused capture and a demo reasoning parser

- **Add note** opens a clean, full-screen patient canvas. The patient ID and ward remain visible; the dashboard is outside the active focus area.
- The prompt is: **What should the next clinician know about this patient, and why?** The word “why” has no special visual emphasis.
- Type, or click **Start dictation** to play an animated waveform while a fictional note appears word by word. This is entirely simulated: no microphone permission, recording, audio, or speech service. Stop pauses the simulation; restarting continues the remaining words.
- Dictation cycles through three editable fictional responses: a change from baseline, handover understanding, and barriers to following a plan. It appends to existing text. **Discard** clears an unwanted draft.
- **Enter** or the small **checkmark** keeps a note directly; there is no review step. Shift+Enter adds a line. The saved note stays on the same canvas with its stated reason highlighted inline (`because`, `koska`, `eftersom`). The prompt itself stays plain. Extraction is deterministic demo logic, **not an LLM**; implicit and cross-sentence interpretation remains future work.
- Keeping a note stores its facts, stated rationale and author against the patient selected when capture opened. Recognized controlled concepts also contribute to the sanitized local ward-knowledge store; original patient sentences stay separate. The prescribing selection is unchanged.
- Back/Escape keeps a draft for that patient in page memory. Reload warns about unsaved drafts; drafts do not survive reloading. Saved demo records reset when the server restarts.
- English, Finnish and Swedish capture copy and demo responses are included. Layout adapts to phone screens and respects reduced motion.

Run the focused parser/storage checks with `python -m unittest discover -s app -p test_note_reasoning.py -v`.

### Existing simulation API and graph stores

- The legacy `/api/app/narrate/simulate` API remains available for generated examples; the note interface uses the curated examples above.
- `narrative.py` parses them into:
  - **kinds:** thinks, decided, if-then, because
  - **mentions:** drugs, organisms, conditions, symptoms, resistance types

  It recognises English, Finnish and Swedish names (including inflected Finnish), codes and Finnish brand names. Its vocabulary is taken from the dataset.
- **Two stores, kept apart:**
  - a **patient record**: identifiable, everything said
  - **ward knowledge**: de-identified; only decisions and if-then rules in context, with age banded, dates reduced to the month, and no ID or free text
- These legacy stores are **in-memory mock stores** with the Rhydux V2 table shapes (tags as a tree, facts as field values). Nothing is written to a real Rhypple database. The separate admin knowledge store below persists sanitized contributions across restarts; patient records remain in memory.

## Hygiene team: Morning brief (opens first)

Only what changed since yesterday. At the top, quiet by default (details on hover):

- **This morning, in one sentence:** the two things that matter most today, then how many results arrived and how many were late or corrected.
- **A week of context:** new resistant cases, wards above their usual, results arrived, and late or corrected results, each with a bar per day for the last 7 days (today in the accent).
- **As it arrived today** (live feed): every delivery of the day on a 24-hour line in four lanes: samples received, organism named, susceptibility, corrected or duplicate. Late results are in the accent; while the clock plays they drop in by the hour.
- **Incidents, last 3 days:** wards crossing or leaving their own normal, clusters starting, growing or ending, first-ever resistance types on a ward, wards that sent no samples, late batches and corrections. Clicking one with a ward opens the Ward overview on it. Computed from what was known each day; the simulator's own labels are never used.

Then one card per question, each opening its evidence:

- **New resistant cases since yesterday:** one dot per case on its ward; filled dots were sampled on day 3 or later of the stay.
- **Clusters:** new, growing, stable or over, with a 60-day dot timeline, days since the last case and the wards involved. Clicking one opens the ward overview filtered to that pattern.
- **Wards against their own normal:** the last 4 weeks against each ward's usual band. Coloured only with 3 or more cases.
- **Slow trends:** two years of resistant share for key organism–drug pairs, with EUCAST version changes dashed.
- **Data health:** samples per ward per day for 14 days. Empty days that should have had samples are marked; results still pending and late batches are counted.
- **From colleagues:** de-identified ward knowledge.

The question behind each element is in [VIEWS.md](VIEWS.md).

## Export

The Morning brief, the Ward overview and the doctor view each have **HTML** and **PDF** export, next to the title.
Each Insights graph, including graphs in Ask answers, has an export icon that opens a **PDF / HTML** menu. Exports include that graph's current selection, explanatory context and snapshot date.
- **HTML** is one self-contained file: styles and inline vector SVG charts, with the date, the data source and the counting caveats.
- **PDF** uses an A4 print layout: choose "Save as PDF" in the print dialog, and the graphics stay vector.

## Hygiene team: Ward overview

Three linked views. Hovering one previews the change in the others; clicking filters.

- **Map.** A schematic hospital: wards inside, health centres outside.
  - Size: how many samples a ward sends.
  - Colour: how far the ward sits above its own normal for the window shown.
  - Lines: patients the two wards share. Picking a ward highlights its closest neighbours.
- **Timeline.** 52 weeks of new resistant cases by type, for the selected ward or all wards, against the ward's usual level. Drag across weeks to choose the window.
- **Shared patterns.** Cases in the window grouped by organism and resistance fingerprint. Hovering a pattern rings every ward where it appears and shows its weeks; clicking filters everything to it.

Counting is in `evidence.py`: the first resistant isolate per patient and type, with each ward's normal taken from its own previous year.

## Data (doctor and hygiene team)

The Data tab, last in both dashboard menus, restores the circular hospital clock: one ring per ward, time clockwise, and one dot per sample. `/api/app/overview` includes every sample from the past 365 days, including repeats, negative/mixed results, and samples still awaiting the lab. It is a different counting unit from the antibiogram's first-isolate-per-patient cohorts.

Search and ward/result filters update the clock, counts, and readable sample list together. Select a dot or list row for full ward, specimen, age-at-sampling, organism and antibiotic-result details. Red indicates at least one reported resistant test; pending or untested results are distinct from no reported resistance. The local clock hand filters sample dates; lab results remain those available on the global simulation date, stated on the page. It does not replay historical result availability when moved backwards.

Shared semantic colors: blue for planned drugs; teal for wards; plum for time controls; ochre for organism names, including prose/SVG/tooltips and both interactive demos; red for resistance. `static/entities.js` applies the organism-name rule to dynamically rendered text. `static/overview.js` and `overview.py` implement the circular view.

## Insights (doctor and hygiene team)

**Ask in Insights** accepts questions and searches seven saved GPT-6 Luna examples. Answers reveal text and interactive charts in sequence; the demo defaults to cache-only operation. Admin → **Answers** manages saved answers and can stop live generation. See [ASK.md](ASK.md) for live mode, regeneration, snapshot dates and limitations.

A scrolling page of fixed questions, one below the other, grouped and reachable from a floating menu at the top. Each question is answered from the data known on the clock's day, and appears only when the data can answer it (`insights.py`, `static/insights.js`).

- **Every answer:** the question, one sentence, a main chart, and two or three borderless cards that pick or preview what the chart shows. The time window, the cohort and **How we know** appear when you hover the question; values appear when you hover a row, dot or cell. On touch screens they stay visible.
- **How sure:** *Clear* (holds after correcting for the number of comparisons), *Possible, could be chance*, or *No clear change*. No p-values on screen.
- **Hygiene team:** which drugs are losing ground (adjusted for sex, age group and ward); more resistant results or just more samples (an exact split of the change); is any ward unusual for itself (Poisson against its own past year); is a quiet week a real zero; are results arriving late (live feed only); are these cases more than chance (pattern rarity and a scan test); does resistance to one drug still predict another.
- **Doctor:** does who the patient is change the odds; before the lab names the organism, how often does it work; is the last month a better guide than the year (a rolling back-test); if it's resistant to one drug, what else fails (suggesting the narrowest drug that still usually works); what colleagues start for cases like this (only with 3 or more shared decisions).
- Standard library only; the whole page computes in about a second and recomputes with the feed. The questions and their methods are listed in [VIEWS.md](VIEWS.md).

## Admin: generate data

Detection delay and unmatched-alert rates are measured by `python app/detection_eval.py --quick`.
The generated [DETECTION.md](DETECTION.md) reports detected and missed events, matching rules and limitations.
The underlying results are in [detection.json](static/demo/detection.json); unmatched alerts are not proven clinical false positives.

`/admin/` opens the same shell with **Generate data** (the feed simulator from `data-prep/simulator`, shown inside), **Answers**, **Knowledge Graph**, and **Settings**. The simulator follows the shell's theme. Its Advanced mode shows the six stages as floating tabs at the bottom.

## Admin: Knowledge Graph

The primary view is a searchable tag tree. It preserves the **Thinks / Because / Decided / If → Then** structure from “Mindline listens,” alongside common concepts, organisms, medicines and ward context. Selecting tags reveals the source statements and their reasoning. Connections are available as a secondary view.

The demo includes over 100 clearly labelled illustrative statements across 12 months and English, Finnish and Swedish. Counts show mentions and contributions, not clinical agreement or evidence that an action works. Prewritten illustrations can display their original wording. Notes kept in the patient interface contribute only recognized, controlled concepts: patient identifiers, names and original free text are excluded from the shared store. The deterministic multilingual parser is a demonstration, not a general-purpose LLM extractor.

`app/.runtime/knowledge.json` is the canonical local store; `app/.runtime/knowledge.ttl` is its synchronized RDF projection. Both are ignored by Git. Restarting preserves shared contributions. Existing private notes are not retrospectively imported. RDF uses local identifiers, SKOS concepts, attributed statements and provenance; conditional proposals are kept distinct from recorded decisions. There are no claimed Wikidata mappings.

**Demonstrate a question** runs one of four predefined English questions as a real local SPARQL SELECT query using RDFLib. Results can be filtered by contribution source, language, ward and reporting month. The interface can reveal the query for the demo. This is a template demonstration, not arbitrary natural-language translation or a remote SPARQL service. RDF is stored locally rather than offered as an export button.

- `GET /api/app/knowledge/graph`: tag tree, concepts, statements and provenance.
- `GET /api/app/knowledge/questions`: supported question templates.
- `POST /api/app/knowledge/query`: `{ "question": "over_time", "filters": { "language": "fi" } }`.
