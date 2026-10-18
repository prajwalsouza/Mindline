# Mindline — the film

About two minutes, at `/demo/`. Click-driven like a keynote (→, space or a click for the next build), or press play and it runs by itself. No sign-in. Parts of it are live: hover the recognised words, pick a drug, scrub the days, type a question or tap one and the answer rebuilds.

Numbers come from the app's own API, snapshotted day by day while the simulated lab feed rolls from 28 Sep to 3 Nov 2026 (`app/demo/snapshot.py` → `app/static/demo/data.json`). The Ask scene uses the app's seven saved answers (`app/answers/ask_cache.json` → `app/static/demo/ask.json`). The three-year trimethoprim figures and the empty December week are computed from the supplied synthetic dataset. Everything is synthetic data.

**The one idea.** Tyks asked for up-to-date results from the doctor's own ward instead of a yearly hospital table. Mindline gives that, and keeps what the ward knows beside it. Two people use it from the same evidence: the doctor, in seconds, and the hygiene team, every morning.

**Rules.**
- At most three things on screen: a drawing, a line of type, a caption.
- Paper, one ink, one accent. The real interface appears simplified, only when it is the moment.
- The same dots carry through the film: lab results, wards, drug rows, cases, concepts, the logo.
- Don't explain what the audience knows (outbreaks, pharmacology). Show what the interface does for them.
- Humble claims: lab susceptibility is not cure; a shared pattern is not proven transmission; a repeated note is a mention, not proof; model sentences are checked.

---

### 1 · Mindline · 16 s
1. *Mindline.* — "Antibiotic resistance, ward by ward, as it happens."
2. *Today: one report a year, for the whole hospital.* — the year's samples as one block.
3. *Mindline: your ward, the last four weeks, against its year.* — the block splits into nine wards by volume; each ward's last four weeks light up. "What Tyks asked for: up-to-date results from the doctor's own ward."

### 2 · What the ward knows · 17 s
1. *And what the ward knows, as it is said.* A doctor's narration arrives word by word, then drugs, bacteria, decisions and if-then rules are picked out (English, Finnish or Swedish).
2. *Kept twice, and kept apart.* Every word stays in the patient record; only the de-identified decision goes to ward knowledge. What was left behind is struck through.

### 3 · Two users · 6 s
*Two people use it, from the same evidence.* The doctor: one patient, a few seconds, "Will it work here?" The hygiene team: every ward, every morning, "What changed, and is it real?"

### 4 · The doctor · 26 s
1. *Will it work here?* Woman, 65+, urine, Urology, result still in the lab. Four drugs as 20 dots each.
2. *This ward's year, and its last four weeks.* The four-week marker, as a count while numbers are small.
3. *And what came before.* "Her E. coli survived it · Aug 2026" on ampicillin; a colleague on this ward started nitrofurantoin in recent weeks (de-identified).
4. *One look, a few seconds.* Nitrofurantoin becomes the plan; the others quieten. "No ranking, no advice. Pick any drug."

### 5 · The hygiene team · 32 s
1. *What changed since yesterday?* Cases land on their wards day by day. 18 Oct: ICU at three cases, within its usual range, nothing coloured.
2. *Each ward against its own normal.* By 1 Nov: "ICU: 10 new cases in four weeks, usually about 2." One MRSA pattern also seen in the ED. One click opens the cases behind it.
3. *Arrived together, not sampled together.* Health centre South: an outage, then 22 late results at once, shown as a delivery problem, never as resistance.
4. *And slow drifts, each year too small to notice.* E. coli in urine, resistant to trimethoprim, first isolate per patient per year: 16.4% (415 of 2,528) → 18.7% (484 of 2,593) → 19.9% (506 of 2,538). On Urology the doctor's trimethoprim row sits at 81%, just above the 80% line.

### 6 · Ask · 19 s (live)
1. *Or the team simply asks.* A question types itself into a glass search bar; the app's catalogue of fourteen charts appears; the model picks one ("Quiet or missing").
2. *Built from parts we trust.* The answer as a bento grid: the model's sentence, the picked chart filled with the data, a second sentence, and follow-up questions. Viewers can tap any of the seven saved questions or type their own. "Approved views only, so even a small model stays within the evidence."

### 7 · Knowledge graph · 15 s
1. *Said in three languages, on three wards.* The same if-then rule in English, Finnish and Swedish converges into one concept: "If ESBL → switch to meropenem".
2. *Over time, what the wards know adds up.* A quiet constellation of concepts (the drawing is schematic; the counts are real): 110 illustrative notes, 63 concepts, 3 languages, de-identified. "Next: bring a rule back when its result arrives."

### 8 · Close · 9 s
*Mindline.* "Your ward, the last four weeks, against its year. Updated with every result, read in seconds. What the lab knows, and what the ward knows." **Open the app** · **Watch again**.

---

### How it maps to the challenge

| Judged on | Where |
| --- | --- |
| Understanding of the challenge | 1 (yearly hospital table vs the ward's last four weeks), 2 (knowledge that lives in people), 5.3 (late data) |
| Suitability | 1, 4: four weeks against the year, filtered to the patient and ward; continuously updated |
| Usability | 3, 4, 6: one question per view, answers in seconds, ask in plain words |
| Detecting deviations and anomalies | 5: each ward against its own normal, small numbers never coloured, look-alikes and slow drifts kept apart |
