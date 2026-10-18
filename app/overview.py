"""Searchable sample-level overview of the synthetic data known on a given day.

Unlike the antibiogram, this view shows every sample, including repeat samples,
negative results and samples still in the lab. It is not a treatment estimate.
"""
from collections import Counter
from datetime import date, timedelta

from feed import FEED


FLAG_NAMES = {
    "esbl": "ESBL: extended-spectrum beta-lactamase detected",
    "mrsa": "MRSA: meticillin-resistant Staphylococcus aureus",
    "vre": "VRE: vancomycin-resistant enterococci",
    "cpe": "CPE: carbapenemase-producing Enterobacterales",
}
STATUS_NAMES = {
    "waiting": "Waiting for the lab",
    "organism_known": "Bacteria identified; antibiotic results pending",
    "final": "Lab results available",
    "negative": "No bacteria grew",
    "mixed": "Mixed bacterial growth",
}


def _stage(culture, asof):
    """Use delivered feed stages, or the app's historical lab-delay convention.

    The supplied historical table contains final results only. Its most recent
    samples are staged like the patient view: identification after one day and
    antibiotic results after three days; negative/mixed results after two days.
    No global source access is used, so an explicit snapshot stays consistent.
    """
    result = culture.get("result", "")
    if culture.get("_feed"):
        if culture.get("_status") == "received":
            return "waiting"
        if result == "negative":
            return "negative"
        if result == "mixed_growth":
            return "mixed"
        return "final" if culture.get("_status") == "final" else "organism_known"
    age = (asof - culture["_date"]).days
    if result in ("negative", "mixed_growth"):
        return ("negative" if result == "negative" else "mixed") if age >= 2 else "waiting"
    return "waiting" if age < 1 else "organism_known" if age < 3 else "final"


def overview(asof=None, days=365, src=None):
    """Return all samples in the inclusive date window; no sampling or truncation."""
    if isinstance(asof, str):
        asof = date.fromisoformat(asof)
    src = src if src is not None else FEED.view(asof)
    # An injected snapshot cannot know results after its own end date.
    asof = min(asof or src["end"], src["end"])
    days = int(days)
    if not 1 <= days <= 365:
        raise ValueError("Overview window must be between 1 and 365 days")
    start = max(src["start"], asof - timedelta(days=days - 1))
    wards = [{"code": code, "name": ward["ward_en"]} for code, ward in src["wards"].items()]
    ward_names = {w["code"]: w["name"] for w in wards}
    records, patients, counts, ward_counts = [], set(), Counter(), Counter()
    for culture in src["cultures"]:
        if not start <= culture["_date"] <= asof:
            continue
        status = _stage(culture, asof)
        organisms, drugs, flags = [], [], []
        if status in ("organism_known", "final"):
            for isolate in src["isolates"].get(culture["culture_id"], []):
                organism = isolate["organism"]
                if organism not in organisms:
                    organisms.append(organism)
                if status != "final":
                    continue
                for flag, label in FLAG_NAMES.items():
                    if isolate.get(flag) == "1" and label not in flags:
                        flags.append(label)
                for susceptibility in src["sus"].get(isolate["isolate_id"], []):
                    result = susceptibility.get("result")
                    if result not in ("S", "I", "R"):
                        continue
                    code = susceptibility["antibiotic_code"]
                    name = src["antibiotics"].get(code, {}).get("antibiotic") or susceptibility.get("antibiotic") or code
                    drugs.append({"code": code, "name": name, "result": result, "organism": organism})
        resistant = any(d["result"] == "R" for d in drugs) if drugs else None
        patient = src["patients"].get(culture["patient_id"], {})
        age = culture.get("age_years")
        row = {
            "id": culture["culture_id"], "label": "Sample " + culture["culture_id"],
            "date": str(culture["_date"]), "ward": culture["ward_code"],
            "ward_name": ward_names.get(culture["ward_code"], culture.get("ward_en") or culture["ward_code"]),
            "specimen": culture["specimen"], "age": int(age) if age not in (None, "") else None,
            "sex": patient.get("sex", ""), "organism": "; ".join(organisms), "organisms": organisms,
            "status": status, "status_label": STATUS_NAMES[status],
            "resistant": resistant, "drugs": drugs, "flags": flags,
        }
        records.append(row)
        patients.add(culture["patient_id"])
        counts[status] += 1
        counts["resistant"] += resistant is True
        counts["tested"] += bool(drugs)
        ward_counts[culture["ward_code"]] += 1
    for ward in wards:
        ward["samples"] = ward_counts[ward["code"]]
    return {
        "asof": str(asof), "start": str(start), "end": str(asof), "days": days,
        "source": "Tyks synthetic demo data and simulated lab feed", "synthetic": True,
        "counting": "Every sample is shown, including repeat samples from the same patient. Each dot is one sample.",
        "visibility": "Only results available by the selected day are shown. Recent historical samples use simulated lab delays.",
        "resistance_definition": "At least one reported antibiotic test found resistance. Untested or pending samples are not counted as having no resistance.",
        "records": records, "wards": wards, "total_records": len(records), "truncated": False,
        "summary": {"samples": len(records), "patients": len(patients), "resistant": counts["resistant"],
                    "tested": counts["tested"], "pending": counts["waiting"] + counts["organism_known"],
                    "negative": counts["negative"], "mixed": counts["mixed"], "final": counts["final"]},
    }
