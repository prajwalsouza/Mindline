"""Doctor narration, simulated: what a doctor might say about a patient, parsed into facts, and split into two graphs.

  patient record   identifiable; everything about this patient; kept separate and never part of the dataset
  ward knowledge   de-identified; only facts that generalise (decision in context, reason type, if-then rules, ward observations)

Both are MOCK stores shaped like Rhypple's Rhydux V2 tables (node_headers, node_text, parent_edges, tag_memberships,
field_values, time_events), held in memory. New shared contributions also go to the sanitized local store in knowledge.py
for the admin overview and survive restarts. Patient free text remains in the separate memory-only patient store.
Nothing here writes to a real Rhypple database.
"""
import json, random, re, sqlite3, threading, time, uuid
from datetime import date

from feedsim import data

# ---------- vocabulary the parser recognises (English and Finnish names) ----------
DRUGS = {"NIT": ["nitrofurantoin", "nitrofurantoiini"], "MEC": ["mecillinam", "pivmecillinam", "mesillinaami"], "TMP": ["trimethoprim", "trimetopriimi"],
         "AMP": ["ampicillin", "amoxicillin", "ampisilliini"], "CXM": ["cefuroxime", "kefuroksiimi"], "CIP": ["ciprofloxacin", "cipro", "siprofloksasiini"],
         "CRO": ["ceftriaxone", "keftriaksoni"], "CAZ": ["ceftazidime"], "TZP": ["piperacillin-tazobactam", "pip-taz", "tazobactam"], "MEM": ["meropenem"],
         "VAN": ["vancomycin", "vankomysiini"], "CLI": ["clindamycin", "klindamysiini"]}
DRUG_NAME = {"NIT": "nitrofurantoin", "MEC": "mecillinam", "TMP": "trimethoprim", "AMP": "ampicillin", "CXM": "cefuroxime", "CIP": "ciprofloxacin",
             "CRO": "ceftriaxone", "CAZ": "ceftazidime", "TZP": "piperacillin-tazobactam", "MEM": "meropenem", "VAN": "vancomycin", "CLI": "clindamycin"}
ORGS = {"Escherichia coli": ["e. coli", "e.coli", "escherichia coli", "coli"], "Klebsiella pneumoniae": ["klebsiella pneumoniae", "k. pneumoniae", "klebsiella"],
        "Proteus mirabilis": ["proteus"], "Enterococcus faecalis": ["enterococcus", "e. faecalis"], "Staphylococcus aureus": ["s. aureus", "staph aureus", "staphylococcus"],
        "Pseudomonas aeruginosa": ["pseudomonas"], "Citrobacter freundii": ["citrobacter"]}
FLAGS = {"ESBL": ["esbl"], "MRSA": ["mrsa"], "VRE": ["vre"], "CPE": ["cpe", "carbapenemase"]}
CONDITIONS = {"cystitis": ["cystitis", "simple uti", "lower uti", "bladder infection"], "pyelonephritis": ["pyelonephritis", "kidney infection", "upper uti"],
              "urosepsis": ["urosepsis", "sepsis"], "colonisation": ["colonisation", "colonization", "asymptomatic bacteriuria", "contaminant"],
              "wound infection": ["wound infection", "cellulitis"], "recurrent UTI": ["recurrent", "third uti", "again this year"]}
CONDITIONS["urinary tract infection"] = ["urinary tract infection", "virtsatieinfekti", "urinvägsinfektion"]
SYMPTOMS = {"fever": ["fever", "febrile", "kuume"], "flank pain": ["flank pain", "loin pain"], "dysuria": ["dysuria", "burning", "pain passing urine"],
            "confusion": ["confused", "confusion"], "catheter": ["catheter", "katetri"]}
DECISION = [("switch", r"\b(switch|change|swap|vaihda|vaihdan|byter|byta)\w*"),
            ("start", r"\b(start|begin|give|prescrib|put (?:him|her|them) on|going with|go with|aloita|aloitan|aloitetaan|annetaan|börjar|sätter in)\w*"),
            ("avoid", r"\b(avoid|decided against|not use|no |won'?t use|steer clear|vältän|välttää|ei |undviker|inte |inget )\w*"),
            ("stop", r"\b(stop|discontinu|lopeta|lopetan|avslutar|slutar)\w*"), ("wait", r"\b(wait|hold off|no antibiotics|odotetaan|odotan|väntar)\b")]
REASON_TYPES = [("allergy", r"allerg"), ("earlier resistance", r"\b(resistant|resistance|resisted|survived|failed|resistentti|resistent)\b"),
                ("ward pattern", r"\b(ward|cluster|lately|outbreak|osastolla|avdelningen)\b"),
                ("kidney function", r"\b(kidney function|egfr|renal|munuais|njur)\w*"), ("tolerated before", r"\b(tolerated|sietänyt|tålt)\b")]
REASON_TYPES.append(("reported local results", r"local (?:lab|results)|works? for most|tehoaa.*useimm|paikalli.*tulo[sk]|fungerar.*flest|lokala.*resultat"))
SHORT = lambda o: o.split()[0][0] + ". " + o.split()[-1]

# drug names straight from the dataset (English and Finnish columns), plus Swedish and brand names used in Finland
try:
    import locale_names
    for _code, _words in locale_names.drug_vocabulary().items():
        if _code in DRUGS: DRUGS[_code] = sorted(set(DRUGS[_code]) | set(_words), key=len, reverse=True)
except Exception:
    pass
ORGS["Escherichia coli"] += ["kolibakteeri"]
CONDITIONS["cystitis"] += ["rakkotulehdu", "blåskatarr"]   # Finnish stems
CONDITIONS["pyelonephritis"] += ["pyelonefriitti", "munuaisaltaan tulehdus", "njurbäckeninflammation"]
CONDITIONS["colonisation"] += ["kolonisaatio", "kolonisation"]
SYMPTOMS["fever"] += ["feber"]
SYMPTOMS["flank pain"] += ["kylkikip", "flanksmärt"]
SYMPTOMS["dysuria"] += ["kirvely", "sveda"]

# Controlled multilingual demo concepts. These are recognisable handover themes,
# not a general clinical language model or a claim that the statements are true.
PRACTICES = {
    "family_baseline": {
        "question": "What changed from the person's usual baseline?",
        "condition": "Assessing a change from the usual baseline",
        "action": "Ask someone who knows the usual routine",
        "reason": "A relative may notice a change from the usual routine",
        "theme": r"confus|baseline|usual routine|sekav|tavalli|förvirr|vanliga rutin",
        "person": r"daughter|relative|family|tyttär|omais|dotter|anhörig",
        "rationale": r"know|notice|usual|tuntee|huomasi|tavalli|känner|märkte|vanliga",
    },
    "followup_understanding": {
        "question": "Does the person understand the follow-up plan?",
        "condition": "Checking understanding of a follow-up plan",
        "action": "Check the person's understanding of the plan",
        "reason": "Nodding may not show understanding of the follow-up plan",
        "theme": r"follow.up|jatkosuunnitel|uppföljningsplan",
        "person": r"underst|explain|own words|ymmär|nyökk|förstod|förstå|nicka",
        "rationale": r"nod|asked|nyökk|kysyi|nicka|frågade",
    },
    "medication_routine": {
        "question": "What makes taking medication difficult?",
        "condition": "Discussing difficulty taking medication",
        "action": "Ask how the medication schedule fits daily life",
        "reason": "Work schedules may make taking doses difficult",
        "theme": r"medication|doses|lääkkee|annos|medicin|doser",
        "person": r"shift|schedule|work|työvuoro|arbetspass|schema",
        "rationale": r"miss|clash|shift|schedule|jäänee|väliin|työvuoro|missade|krock|arbetspass",
    },
    "hearing_access": {
        "question": "Can the person hear the instructions?",
        "condition": "Checking access to spoken instructions",
        "action": "Check hearing support and reduce background noise",
        "reason": "Background noise may make spoken instructions hard to hear",
        "theme": r"hear|kuul|hör",
        "person": r"noise|quiet|melu|rauhalli|buller|tyst",
        "reason_terms": [r"miss|hard|difficult|vaike|jää|svår|miss", r"noise|melu|buller"],
    },
    "language_support": {
        "question": "Is shared language sufficient for this conversation?",
        "condition": "Checking understanding across languages",
        "action": "Arrange language support for the conversation",
        "reason": "Important details may remain unclear without shared language",
        "theme": r"interpret|language|tulk|kieli|tolk|språk",
        "person": r"understand|detail|unclear|ymmär|yksityisk|epäsel|förstå|detalj|oklar",
        "reason_terms": [r"unclear|miss|epäsel|oklar|miss", r"language|detail|kiel|yksityisk|språk|detalj"],
    },
    "home_support": {
        "question": "Who is responsible for support at home?",
        "condition": "Coordinating support after returning home",
        "action": "Confirm who will provide support at home",
        "reason": "Unclear responsibilities may leave a support task uncovered",
        "theme": r"home|koti|koto|hemma|hemmet",
        "person": r"support|responsib|help|tue|tuki|vastuu|apu|stöd|ansvar|hjälp",
        "reason_terms": [r"thought|assum|unclear|luul|epäsel|trodde|oklar", r"another|someone|responsib|toinen|jonkun|vastuu|annan|ansvar"],
    },
    "drink_access": {
        "question": "Can the person reach drinks without help?",
        "condition": "Checking practical access to drinks",
        "action": "Check whether drinks are within reach",
        "reason": "The position of the cup may make drinking difficult",
        "theme": r"drink|cup|juom|kuppi|muki|dryck|kopp|glas",
        "person": r"reach|position|ulotu|sijo|ylety|räck|placering|nå",
        "reason_terms": [r"difficult|hard|vaike|svårt", r"reach|cup|position|ulotu|kuppi|muki|sijo|räck|kopp|glas|nå"],
    },
    "pain_language": {
        "question": "What wording helps the person describe pain?",
        "condition": "Clarifying the words used to describe pain",
        "action": "Ask which words describe the person's pain",
        "reason": "Different meanings of pain words may obscure the person's account",
        "theme": r"pain|kipu|kivu|smärt",
        "person": r"word|describ|sanat|sano|kuva|ord|beskriv",
        "reason_terms": [r"different|unclear|eri|epäsel|olika|oklar", r"word|meaning|san|merkity|ord|betyde"],
    },
}


def note_language(text, requested=None):
    if requested in ("en", "fi", "sv"):
        return requested
    if re.search(r"\b(koska|kysy|tarkista|aloitan|potilas|jos)\b", text.lower()): return "fi"
    if re.search(r"\b(eftersom|fråga|kontrollera|patienten|byter|om)\b", text.lower()): return "sv"
    return "en"


def _find(text, table):
    t = text.lower(); out = []
    for key, words in table.items():
        for w in words:
            # longer words may carry an ending (Finnish and Swedish inflect: nitrofurantoiini-n, meropeneemi-in)
            tail = r"[a-zäöå]*" if len(w) >= 5 else r"(?![a-zäöå])"
            m = re.search(r"(?<![a-zäöå])" + re.escape(w) + tail, t)
            if m: out.append((m.start(), m.end(), key)); break
    return out


NEGATION = r"\b(?:no|not|never|cannot|ei|eivät|eikä|älä|inte|ingen|inget|inga|aldrig)\b|n['’]t\b"
TRIGGER_LABELS = {
    **{"resistance:" + code: code + " in the stated condition" for code in FLAGS},
    **{"symptom:" + code: code.capitalize() + " in the stated condition" for code in SYMPTOMS},
    **{"condition:" + code: code.capitalize() + " in the stated condition" for code in CONDITIONS},
}


def _conditional_trigger(observation):
    """Recognize a single theme in the IF clause; never borrow from THEN/WHY.

    Negated, compound and unsupported conditions stay unrecognized rather than
    being flattened into a different clinical condition.
    """
    match = re.search(r"\b(?:if|jos|om)\b", observation, re.IGNORECASE)
    if not match: return None
    clause = observation[match.end():].lower()
    clause = re.split(r",|;|\b(?:then|i['’]?(?:d|ll)|i would|i will|we would|we will|vaihdan|vaihda|aloitan|aloitetaan|byter|börjar|sätter)\b", clause, maxsplit=1)[0]
    if re.search(NEGATION, clause) or re.search(r"\b(?:and|or|ja|tai|och|eller)\b", clause): return None
    found = []
    for kind, table in (("resistance", FLAGS), ("symptom", SYMPTOMS), ("condition", CONDITIONS)):
        found.extend(kind + ":" + code for _, _, code in _find(clause, table))
    return found[0] if len(found) == 1 else None


def _practice_reason(practice, reasoning):
    if not practice or not reasoning or re.search(NEGATION, reasoning.lower()): return False
    low = reasoning.lower()
    if practice == "family_baseline":
        return bool((re.search(r"know|tuntee|känner", low) and re.search(r"usual|routine|baseline|tavalli|arjen|vanliga|rutin", low)) or
                    (re.search(r"notice|huomasi|märkte", low) and re.search(r"change|muuto|förändr", low)))
    if practice == "followup_understanding":
        return bool(re.search(r"nod|nyökk|nicka", low) and re.search(r"ask|question|kysyi|frågade", low))
    if practice == "medication_routine":
        return bool(re.search(r"miss|clash|difficult|jäänee|väliin|vaike|missade|missas|krock|svårt", low) and
                    re.search(r"shift|schedule|work|työvuoro|arbetspass|schema", low))
    return all(re.search(term, low) for term in PRACTICES[practice].get("reason_terms", [])) if PRACTICES[practice].get("reason_terms") else False


def parse(text, lang=None):
    """Sentence by sentence: what kind of statement it is, and what it mentions."""
    facts = []; language = note_language(text, lang)
    # split into sentences, but not after an initial like "E." in "E. coli"
    for sent in [s.strip() for s in re.split(r"(?<=[.!?])(?<![A-Z]\.)\s+", text.strip()) if s.strip()]:
        low = sent.lower()
        ents = [{"type": "drug", "code": k, "label": DRUG_NAME[k], "span": [a, b]} for a, b, k in _find(sent, DRUGS)]
        ents += [{"type": "organism", "code": k, "label": SHORT(k), "span": [a, b]} for a, b, k in _find(sent, ORGS)]
        ents += [{"type": "resistance", "code": k, "label": k, "span": [a, b]} for a, b, k in _find(sent, FLAGS)]
        ents += [{"type": "condition", "code": k, "label": k, "span": [a, b]} for a, b, k in _find(sent, CONDITIONS)]
        ents += [{"type": "symptom", "code": k, "label": k, "span": [a, b]} for a, b, k in _find(sent, SYMPTOMS)]
        reasons = [r for r, rx in REASON_TYPES if re.search(rx, low)]
        decision = next((d for d, rx in DECISION if re.search(rx, low)), None)
        if re.search(r"(?:^|[,;:])\s*(if|jos|om)\b", low) or re.search(r"\bif\b.+\b(i['’]?(?:d|ll)|i would|i will|we would|we will|then)\b", low): kind = "if-then"
        elif decision: kind = "decision"
        elif any(e["type"] in ("condition", "symptom") for e in ents) or re.search(r"\b(looks like|probably|likely|could be|seems|näyttää|todennäköisesti|ser ut|troligen)\b", low): kind = "impression"
        elif reasons: kind = "reason"
        else: kind = "note"
        drugs = [e for e in ents if e["type"] == "drug"]
        # A transparent demo extraction, not an LLM or a causal inference.
        # Preserve the actual wording; never fill a missing rationale from entities.
        why = re.search(r"\b(?:because|koska|eftersom)\b\s+", sent, re.IGNORECASE)
        observation = sent[:why.start()].rstrip(" ,;") if why and why.start() > 0 else sent
        reasoning = sent[why.end():].strip() if why and why.start() > 0 else None
        # A stated cause can precede its consequence ("... so I decided ...").
        consequence = re.search(r"[,;]?\s+\b(?:so|joten|så)\b\s+", sent, re.IGNORECASE)
        if not reasoning and consequence and decision:
            reasoning = sent[:consequence.start()].strip(" ,;")
            observation = sent[consequence.end():].strip()
        if why and why.start() == 0:
            reasoning = sent[why.end():].strip()
        # Resolve the action and its drug from the action clause, never WHY.
        # Entity spans for the patient record still cover the complete sentence.
        decision = next((d for d, rx in DECISION if re.search(rx, observation.lower())), None)
        action_drugs = sorted(_find(observation, DRUGS))
        if kind != "if-then" and decision: kind = "decision"
        practice = next((key for key, rule in PRACTICES.items() if re.search(rule["theme"], low) and re.search(rule["person"], low)), None)
        practice_reason = _practice_reason(practice, reasoning)
        shared_reasons = [r for r, rx in REASON_TYPES if reasoning and not re.search(NEGATION, reasoning.lower()) and re.search(rx, reasoning.lower())]
        if "earlier resistance" in shared_reasons and not re.search(r"earlier|prior|previous|history|aiempi|aiemmin|tidigare", reasoning.lower()):
            shared_reasons[shared_reasons.index("earlier resistance")] = "reported resistance"
        negated_action = bool(re.search(r"(?:\b(?:not|never|do not|älä|en|ei)\b|n['’]t\b)\s+(?:\w+\s+){0,2}(?:ask|check|confirm|arrange|review|keep|discuss|use|switch|start|avoid|stop|give|kysy|tarkista|varmista|järjestä|vaihd|aloit)\w*|\b(?:fråga|kontrollera|bekräfta|ordna|byter|börjar)\s+inte\b", observation.lower()))
        if negated_action: practice = None
        uncertainty = "conditional" if kind == "if-then" else "uncertain" if re.search(r"\b(think|suspect|probably|possible|possibly|might|could|may|epäilen|todennäköisesti|voi|mahdollinen|tror|misstänker|kanske|troligen|kan)\b", low) else "reported"
        statement_mode = "if_then" if kind == "if-then" else "thinks" if re.match(r"\s*(?:i (?:think|suspect)|maybe|perhaps|epäilen|arvelen|jag (?:tror|misstänker))\b", observation.lower()) else "decided"
        facts.append({"text": sent, "kind": kind, "observation": observation, "reasoning": reasoning,
                      "decision": decision if kind in ("decision", "if-then") else None,
                      "drug": (action_drugs[-1][2] if decision in ("start", "switch") else action_drugs[0][2]) if action_drugs else None,
                      "reasons": reasons, "entities": sorted(ents, key=lambda e: e["span"][0]),
                      "language": language, "practice": practice, "practice_reason": practice_reason, "uncertainty": uncertainty,
                      "shared_reasons": shared_reasons, "share_action": not negated_action,
                      "statement_mode": statement_mode,
                      "trigger": _conditional_trigger(observation) if kind == "if-then" else None})
    return facts


# ---------- what a doctor might say, made up from the patient's own data ----------
SIM_FI = {"open": ["Näyttää rakkotulehdukselta, {org}.", "Kirvelyä kolme päivää, ei kuumetta, todennäköisesti alempi virtsatieinfektio.", "Kuumetta ja kylkikipua, voi olla pyelonefriitti."],
          "prev": "{org} oli resistentti lääkkeelle {drug} {month}, joten vältän sitä.", "start": ["Aloitan {drug}n.", "Aloitetaan {drug} toistaiseksi."],
          "end": ["Jos tulee ESBL, vaihdan meropeneemiin.", "Osastolla on ollut viime aikoina enemmän ESBL:ää.", "Allerginen penisilliinille, ei ampisilliinia."]}
SIM_SV = {"open": ["Ser ut som en urinvägsinfektion, {org}.", "Sveda i tre dagar, ingen feber, troligen en nedre urinvägsinfektion.", "Feber och flanksmärta, kan vara njurbäckeninflammation."],
          "prev": "{org} var resistent mot {drug} i {month}, så jag undviker det.", "start": ["Jag börjar med {drug}.", "Vi sätter in {drug} tills vidare."],
          "end": ["Om det blir ESBL byter jag till meropenem.", "Avdelningen har haft mer ESBL på sistone.", "Allergisk mot penicillin, så inget ampicillin."]}


def simulate(pt, antibiogram, rng=None, lang="en"):
    rng = rng or random.Random()
    if lang in ("fi", "sv"):
        import locale_names
        T = SIM_FI if lang == "fi" else SIM_SV; dn = lambda c: locale_names.names()["drugs"][c][lang]
        cur = pt["history"][0]; org = SHORT(cur["isolates"][0]["organism"]) if cur["isolates"] else "?"
        good = [d for d in antibiogram["drugs"] if d["year"]["share"] and d["year"]["share"] >= .85]
        pick = (good[0] if good else antibiogram["drugs"][0])["code"] if antibiogram["drugs"] else "NIT"
        lines = [rng.choice(T["open"]).format(org=org)]
        prev = next(((h, i, d) for h in pt["history"][1:] for i in h["isolates"] for d in i["resisted"] if d in DRUG_NAME), None)
        if prev: lines.append(T["prev"].format(org=SHORT(prev[1]["organism"]), drug=dn(prev[2]), month=prev[0]["date"][:7]))
        lines.append(rng.choice(T["start"]).format(drug=dn(pick))); lines.append(rng.choice(T["end"]))
        return [lines[0]] + rng.sample(lines[1:], k=min(len(lines) - 1, rng.choice([1, 2])))
    cur = pt["history"][0]; spec = cur["spec"]; org = cur["isolates"][0]["organism"] if cur["isolates"] else None
    she = "she" if pt["sex"] == "F" else "he"; her = "her" if pt["sex"] == "F" else "his"
    prev = next(((h, i, d) for h in pt["history"][1:] for i in h["isolates"] for d in i["resisted"] if d in DRUG_NAME), None)
    good = [d for d in antibiogram["drugs"] if d["year"]["share"] and d["year"]["share"] >= .85]
    pick = (good[0] if good else antibiogram["drugs"][0])["code"] if antibiogram["drugs"] else "NIT"
    lines = []
    if spec == "urine":
        lines.append(rng.choice([f"Looks like a simple cystitis, {SHORT(org) if org else 'waiting for the culture'}.",
                                 f"Dysuria for three days, no fever, probably a lower UTI.",
                                 f"Fever and flank pain, could be pyelonephritis, so I'm careful with the narrow ones."]))
    elif spec == "blood":
        lines.append(rng.choice(["Febrile and a bit confused, I'm treating this as possible urosepsis.", "Blood cultures sent, fever since last night."]))
    else:
        lines.append(rng.choice(["Red and warm around the wound, looks like a wound infection.", "Probably colonisation rather than infection, the wound looks clean."]))
    if prev:
        h, i, d = prev
        lines.append(f"{her.capitalize()} {SHORT(i['organism'])} was resistant to {DRUG_NAME.get(d, d)} in {date.fromisoformat(h['date']).strftime('%B %Y')}, so I'll avoid {DRUG_NAME.get(d, d)}.")
    lines.append(rng.choice([f"I'll start {DRUG_NAME[pick]}, {she} tolerated it before.", f"Going with {DRUG_NAME[pick]} for now.",
                             f"Starting {DRUG_NAME[pick]} while we wait for the sensitivities."]))
    lines.append(rng.choice([f"If it turns out to be ESBL I'd switch to meropenem.", "The ward has had more ESBL lately, so I'm watching this one.",
                             f"Allergic to penicillin, so no ampicillin.", f"If {she} still has fever in two days I'd switch to ceftriaxone."]))
    keep = [lines[0]] + rng.sample(lines[1:], k=min(len(lines) - 1, rng.choice([1, 2])))
    return keep


# ---------- de-identification: what may leave the patient record ----------
def deidentify(facts, pt, ctx):
    """Keep only what generalises. Patient ID, exact age, exact dates and the free text never leave the patient record."""
    age = date.fromisoformat(ctx["asof"]).year - int(pt["birth_year"])
    context = {"ward": ctx["ward"], "sample": pt["history"][0]["spec"], "sex": pt["sex"], "age_band": "65+" if age >= 65 else "under 65",
               "organism": ctx.get("org") or None, "month": ctx["asof"][:7]}
    out = []
    for f in facts:
        provenance = {"language": ctx.get("lang") or f.get("language", "en"), "uncertainty": f.get("uncertainty", "reported"), "has_reason": bool(f.get("reasoning")),
                      "organism": next((e["code"] for e in f["entities"] if e["type"] == "organism"), None) or context["organism"]}
        if f.get("practice"):
            out.append({"kind": "handover practice", "practice": f["practice"], "practice_reason": bool(f.get("practice_reason")),
                        "statement_mode": f.get("statement_mode", "decided"), "trigger": f.get("trigger"), **context, **provenance})
        elif f["kind"] in ("decision", "if-then") and f["drug"] and f.get("share_action", True):
            out.append({"kind": f["kind"], "decision": f["decision"], "drug": f["drug"], "reasons": [r for r in f.get("shared_reasons", []) if r != "allergy"], "trigger": f.get("trigger"),
                        "condition": next((e["code"] for e in f["entities"] if e["type"] == "condition"), None),
                        "resistance": next((e["code"] for e in f["entities"] if e["type"] == "resistance"), None), **context, **provenance})
        elif f["kind"] in ("note", "reason", "impression") and "ward pattern" in f["reasons"]:
            out.append({"kind": "ward observation", "resistance": next((e["code"] for e in f["entities"] if e["type"] == "resistance"), None), **context, **provenance})
        elif f["kind"] == "impression" and not re.search(NEGATION, f["observation"].lower()):
            condition = next((e["code"] for e in f["entities"] if e["type"] == "condition"), None)
            if condition:
                out.append({"kind": "clinical impression", "condition": condition, "reasons": [r for r in f.get("shared_reasons", []) if r != "allergy"], **context, **provenance})
        elif f["kind"] == "reason" and f.get("reasoning") and not re.search(NEGATION, f["reasoning"].lower()):
            reasons = [r for r in f.get("shared_reasons", []) if r != "allergy"]
            if reasons:
                out.append({"kind": "stated rationale", "reasons": reasons, "drug": f.get("drug"), **context, **provenance})
    removed = [f"patient ID {pt['id']}", f"age {age} → {context['age_band']}", f"date → {context['month']}", "the spoken words themselves"]
    if any("allergy" in f["reasons"] for f in facts): removed.append("allergy (kept on the patient only)")
    return out, removed


# ---------- two mock stores shaped like Rhydux V2 ----------
SCHEMA = """
CREATE TABLE node_headers (node_id TEXT PRIMARY KEY, node_type TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL);
CREATE TABLE node_text (node_id TEXT PRIMARY KEY, source_field TEXT NOT NULL, text_content TEXT NOT NULL);
CREATE TABLE parent_edges (child_id TEXT PRIMARY KEY, parent_id TEXT, rank TEXT NOT NULL);
CREATE TABLE tag_memberships (node_id TEXT NOT NULL, tag_id TEXT NOT NULL, membership_source TEXT NOT NULL DEFAULT 'direct', ordinal INTEGER NOT NULL DEFAULT 0, PRIMARY KEY (node_id, tag_id));
CREATE TABLE field_values (value_node_id TEXT PRIMARY KEY, node_id TEXT NOT NULL, field_id TEXT NOT NULL, ordinal INTEGER NOT NULL DEFAULT 0, value_type TEXT NOT NULL, value_text TEXT, value_json TEXT);
CREATE TABLE time_events (event_id TEXT PRIMARY KEY, started_at INTEGER, event_state TEXT NOT NULL DEFAULT 'completed');
"""


class MockGraph:
    """A tiny in-memory Rhydux V2 look-alike. Tags are nodes in a tree; facts are field values; nothing persists to disk."""
    def __init__(self, name):
        self.name = name; self.db = sqlite3.connect(":memory:", check_same_thread=False); self.db.executescript(SCHEMA); self.lock = threading.Lock()
        self.tags = {}

    def _node(self, ntype, text=None, field="text"):
        nid = uuid.uuid4().hex[:12]; now = int(time.time() * 1000)
        self.db.execute("INSERT INTO node_headers VALUES (?,?,?,?)", (nid, ntype, now, now))
        if text is not None: self.db.execute("INSERT INTO node_text VALUES (?,?,?)", (nid, field, text))
        return nid

    def tag(self, path):
        """A tag path like ('Drug', 'narrow', 'nitrofurantoin'); parents are created once, linked by parent_edges."""
        parent = None
        for k in range(1, len(path) + 1):
            key = path[:k]
            if key not in self.tags:
                nid = self._node("tag", key[-1], "label"); self.db.execute("INSERT INTO parent_edges VALUES (?,?,?)", (nid, parent, str(len(self.tags))))
                self.tags[key] = nid
            parent = self.tags[key]
        return parent

    def add(self, ntype, text, tags, fields, when=None):
        with self.lock:
            nid = self._node(ntype, text)
            for k, t in enumerate(dict.fromkeys(tags)): self.db.execute("INSERT OR IGNORE INTO tag_memberships VALUES (?,?,?,?)", (nid, self.tag(t), "direct", k))
            for k, (f, v) in enumerate(fields.items()):
                if v in (None, [], ""): continue
                fid = self.tag(("Field", f)); vid = self._node("value")
                self.db.execute("INSERT INTO field_values VALUES (?,?,?,?,?,?,?)", (vid, nid, fid, k, "json" if isinstance(v, (list, dict)) else "text",
                                                                                   None if isinstance(v, (list, dict)) else str(v), json.dumps(v) if isinstance(v, (list, dict)) else None))
            if when: self.db.execute("INSERT INTO time_events VALUES (?,?,?)", (nid, when, "completed"))
            self.db.commit()
            return nid

    def find(self, tag_paths, limit=20):
        """Nodes carrying every given tag (or a descendant of it), newest first."""
        with self.lock:
            ids = None
            for path in tag_paths:
                tid = self.tags.get(tuple(path))
                if not tid: return []
                rows = self.db.execute("""WITH RECURSIVE sub(id) AS (SELECT ? UNION ALL SELECT e.child_id FROM parent_edges e JOIN sub ON e.parent_id = sub.id)
                                          SELECT node_id FROM tag_memberships WHERE tag_id IN (SELECT id FROM sub)""", (tid,)).fetchall()
                s = {r[0] for r in rows}; ids = s if ids is None else ids & s
            if not ids: return []
            out = []
            for nid, ntype, created in self.db.execute(f"SELECT node_id, node_type, created_at FROM node_headers WHERE node_id IN ({','.join('?' * len(ids))}) ORDER BY created_at DESC LIMIT ?", (*ids, limit)):
                text = self.db.execute("SELECT text_content FROM node_text WHERE node_id = ?", (nid,)).fetchone()
                fields = {}
                for fid, vt, vtext, vjson in self.db.execute("SELECT field_id, value_type, value_text, value_json FROM field_values WHERE node_id = ? ORDER BY ordinal", (nid,)):
                    label = self.db.execute("SELECT text_content FROM node_text WHERE node_id = ?", (fid,)).fetchone()[0]
                    fields[label] = json.loads(vjson) if vt == "json" else vtext
                out.append({"id": nid, "type": ntype, "created_at": created, "text": text[0] if text else None, "fields": fields})
            return out

    def counts(self):
        with self.lock:
            return {t: self.db.execute(f"SELECT COUNT(*) FROM {t}").fetchone()[0] for t in ("node_headers", "tag_memberships", "field_values", "parent_edges")}


PATIENT_GRAPH = MockGraph("patient record (mock, identifiable, kept separate)")
KNOWLEDGE_GRAPH = MockGraph("ward knowledge (mock, de-identified)")
SPECTRUM = {"NIT": "narrow", "MEC": "narrow", "TMP": "narrow", "AMP": "narrow", "CLI": "narrow", "CXM": "moderate", "CIP": "broad", "CRO": "broad",
            "CAZ": "broad", "TZP": "broad", "VAN": "reserve", "MEM": "reserve"}
ORG_GROUP = lambda o: "Enterobacterales" if o.split()[0] in ("Escherichia", "Klebsiella", "Proteus", "Citrobacter", "Enterobacter") else "Gram-positive" if o.split()[0] in ("Staphylococcus", "Enterococcus") else "Other"


def commit(pt, facts, shared, ctx, author):
    """Write the parsed narration: every fact to the patient record; only the de-identified ones to ward knowledge."""
    # Persist only the controlled shared representation. No patient identifier,
    # author, exact date or original sentence is passed into this store.
    contribution = None
    if shared:
        import knowledge
        contribution = knowledge.record(shared)
    now = int(time.time() * 1000); n_p = n_k = 0
    for f in facts:
        tags = [("Patient", pt["id"]), ("Kind", f["kind"]), ("Ward", ctx["ward"])]
        for e in f["entities"]:
            if e["type"] == "drug": tags.append(("Drug", SPECTRUM.get(e["code"], "other"), e["label"]))
            elif e["type"] == "organism": tags.append(("Organism", ORG_GROUP(e["code"]), e["label"]))
            else: tags.append((e["type"].capitalize(), e["label"]))
        PATIENT_GRAPH.add("narration", f["text"], tags, {"kind": f["kind"], "observation": f.get("observation"), "reasoning": f.get("reasoning"), "decision": f["decision"], "drug": f["drug"], "reasons": f["reasons"], "author": author, "sample_date": pt["history"][0]["date"]}, now); n_p += 1
    for k in shared:
        tags = [("Kind", k["kind"]), ("Ward", k["ward"]), ("Sample", k["sample"])]
        if k.get("drug"): tags.append(("Drug", SPECTRUM.get(k["drug"], "other"), DRUG_NAME[k["drug"]]))
        if k.get("organism"): tags.append(("Organism", ORG_GROUP(k["organism"]), SHORT(k["organism"])))
        if k.get("resistance"): tags.append(("Resistance", k["resistance"]))
        KNOWLEDGE_GRAPH.add("knowledge", None, tags, {key: v for key, v in k.items() if key not in ("ward", "sample")}, now); n_k += 1
    return {"patient_record": n_p, "ward_knowledge": n_k, "contribution": contribution, "stores": {"patient": PATIENT_GRAPH.counts(), "knowledge": KNOWLEDGE_GRAPH.counts()}}
