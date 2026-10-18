"""Names of drugs, wards and samples in English, Finnish and Swedish.

English and Finnish come straight from the dataset (antibiotics.csv, wards.csv, cultures.csv specimen_fi).
Swedish is not in the dataset, so it is added here. Brand names common in Finland help the narration parser.
"""
from feedsim import data

SV_DRUGS = {"AMP": "ampicillin", "MEC": "mecillinam", "TZP": "piperacillin-tazobaktam", "FOX": "cefoxitin", "CXM": "cefuroxim", "CRO": "ceftriaxon",
            "CAZ": "ceftazidim", "MEM": "meropenem", "CIP": "ciprofloxacin", "TMP": "trimetoprim", "NIT": "nitrofurantoin", "VAN": "vankomycin", "CLI": "klindamycin"}
BRANDS = {"NIT": ["furadantin"], "MEC": ["selexid", "pivmecillinam"], "TMP": ["trimopan"], "CXM": ["zinacef"], "CIP": ["ciproxin", "cipro"],
          "CRO": ["rocephalin"], "TZP": ["tazocin", "pip-taz", "piptaz"], "MEM": ["meronem"], "AMP": ["amoxicillin", "amoksisilliini"], "CLI": ["dalacin"]}
SV_WARDS = {"ED": "Akutmottagning", "MED-A": "Internmedicin A", "MED-B": "Internmedicin B", "SURG": "Kirurgi", "URO": "Urologi", "ICU": "Intensivvård",
            "GER": "Geriatrik", "PHC-N": "Hälsostation Norr", "PHC-S": "Hälsostation Söder"}
SPECIMENS = {"urine": {"en": "urine", "fi": "virtsa", "sv": "urin"}, "blood": {"en": "blood", "fi": "veri", "sv": "blod"}, "wound": {"en": "wound", "fi": "haava", "sv": "sår"}}


def names():
    src = data.source()
    drugs = {c: {"en": a["antibiotic"], "fi": a["antibiotic_fi"], "sv": SV_DRUGS.get(c, a["antibiotic"])} for c, a in src["antibiotics"].items()}
    wards = {c: {"en": w["ward_en"], "fi": w["ward_fi"], "sv": SV_WARDS.get(c, w["ward_en"])} for c, w in src["wards"].items()}
    return {"drugs": drugs, "wards": wards, "specimens": SPECIMENS}


def drug_vocabulary():
    """Every way a drug may be written or said: English, Finnish (from the dataset), Swedish, codes and common brand names."""
    out = {}
    for code, n in names()["drugs"].items():
        words = {n["en"].split(" (")[0], n["fi"].split(" (")[0], n["sv"], code.lower()} | set(BRANDS.get(code, []))
        out[code] = sorted(words, key=len, reverse=True)
    return out
