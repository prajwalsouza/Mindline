// Mindline: sign in, then dashboards. Demo only: the two accounts sign in with a pretend password.
const $ = id => document.getElementById(id);
const css = v => getComputedStyle(document.documentElement).getPropertyValue(v).trim();
const fmt = n => (+n).toLocaleString(typeof loc === "function" ? loc() : "en-GB");
const pct = v => Math.round(v * 100) + "%";
const api = (p, opt) => fetch(p, { cache: "no-store", ...opt }).then(async r => { const j = await r.json(); if (!r.ok || j.error) throw new Error(j.error || r.statusText); return j; });
const store = { get: (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } }, set: (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} } };
const niceDate = s => new Date(s + "T00:00").toLocaleDateString(typeof loc === "function" ? loc() : "en-GB", { day: "numeric", month: "short", year: "numeric" });

// ---------- language: English, Finnish, Swedish ----------
const LOCALE = { en: "en-GB", fi: "fi-FI", sv: "sv-FI" };
let LANG = store.get("rl-lang", "en");
const I18N = {
  en: {
    signIn: "Sign in.", doctor: "Doctor", hygiene: "Hygiene team", email: "Email", password: "Password", signInBtn: "Sign in", another: "Choose another account", useDemo: "Use one of the demo accounts.", toDark: "Switch to dark theme", toLight: "Switch to light theme", watchFilm: "Watch the film", filmLen: "1½ min",
    navGen: "Generate data", navGenSub: "Simulated lab feed, in real time", backApp: "Dashboards", backAppSub: "Sign in as doctor or hygiene team",
    navDoctor: "Will it work here?", navDoctorSub: "Antibiotics for a patient like this", navWards: "Ward overview", navWardsSub: "What changed, ward by ward", navInsights: "Insights", navInsightsSub: "Questions, answered from the data", next: "next",
    dashboards: "Dashboards", you: "You", settings: "Settings", settingsSub: "Theme and language", admin: "Admin", adminSub: "Feed simulator", signOut: "Sign out",
    dataUpTo: "Tyks data up to {d}", woman: "woman", man: "man", Woman: "Woman", Man: "Man", anyAge: "any age", under65: "under 65", over65: "65 or older",
    sentence: "For a {sex} of {age}, with a {spec} sample{org}, on {ward}.", sentenceOrg: " growing {org}",
    sentencePt: "For {who}, {spec} sample from {date}{lab}. On {ward}.", ptWho: "a {sex} of {age}", labNamed: "; the lab has named {org}", labWaiting: "; still waiting for the lab",
    anyWard: "any ward", allWards: "all wards", thisWard: "this ward", wardHas: "ward has {n}",
    legKilled: "killed by the drug", legSurvived: "survived it", leg4: "last 4 weeks", legDot: "each dot is 5% of the last 12 months",
    changed: "changed", survivedBefore: "survived it before", tooFewGroup: "Too few tested samples for this patient group. Try all wards or any age.", of: "of", wk4: "4 wk",
    killedSentence: "<b>{s} of {n}</b> lab tests showed no resistance to {drug} in the past 12 months ({where}).", onlyTested: "only {n} tested on {ward}",
    last4: "Last 4 weeks:", tooFew: ", too few to rely on", differs: "That is clearly different from the year.", noTests: "no tests.",
    survivedMost: "Survived it most often:", always: "(always does)", ptSurvived: "A previous sample from this patient was resistant to {drug} ({when}).",
    caveat: "Lab results, not a promise of cure. First sample per patient and organism counted once.", colleagues: "From colleagues on this ward", deid: "de-identified",
    grows: "What usually grows here", growsHint: "Click an organism if the lab has already named it.", growsShowing: "Showing drugs for {org}. Click it again for all.",
    monthsAgo: "12 months ago", now: "now", ptBefore: "This patient before", noEarlier: "No earlier samples.", noGrowth: "no growth", killedAll: "killed by everything tested", survived: "survived",
    sigCount: "More cases than usual", sigRate: "Resistance rising", sigDrift: "Slowly rising", sigNew: "New on this ward", since: "since", missing: "Missing data on {ward}, week of {d}",
    dPatients: "Patients", dWho: "Who and where", dRecord: "Patient record", typical: "Typical patient", nobody: "no one in particular", pickFirst: "Pick a patient first.", choosePt: "Choose a patient",
    yourPatients: "Your patients on {ward}", showMore: "Show more", setByPatient: "Set by the patient you picked. Changing these switches back to a typical patient.",
    ward: "Ward", sex: "Sex", age: "Age", sample: "Sample", any: "Any", all: "All",
    st_waiting: "waiting", "st_organism known": "organism named", st_final: "final", "st_no growth": "no growth", sampleFrom: "sample from",
    mock: "Simulation. Notes stay in a mock patient record in this browser and never reach Rhypple.", narrate: "Narrate", narrateSub: "simulated: what a doctor might say about this patient",
    record: "Record", justNow: "just now", sampleK: "Sample", on: "on", waitingLab: "waiting for the lab",
    prRecord: "Patient record", prRecordSub: "identifiable · stays separate", prKnow: "Ward knowledge", prKnowSub: "de-identified", nothingGen: "Nothing here generalises beyond this patient.",
    addMock: "Add to mock record", discard: "Discard", added: "Added to the mock record.", again: "Narrate again",
    k_impression: "Thinks", k_decision: "Decided", "k_if-then": "If, then", k_reason: "Because", k_note: "Noted", "k_ward observation": "Ward",
    settingsTitle: "Settings.", settingsIntro: "Pick how the app looks and which language it speaks. Remembered on this device.", theme: "Theme", language: "Language",
    wardsTitle: "Ward overview.",
    navBrief: "Morning brief", navBriefSub: "What changed since yesterday", briefTitle: "Morning brief.", sinceYesterday: "since yesterday",
    bNewQ: "New resistant cases since yesterday", bNewBig: "{n} new", bNewNone: "None since yesterday", bNewSub: "{h} sampled on day 3 or later of the stay (filled dots).", bOutpatient: "outpatient or early",
    bClusterQ: "Clusters", bClusterBig: "{n} active", bClusterNone: "No active cluster", cl_new: "new", cl_growing: "growing", cl_stable: "stable", cl_over: "over",
    bClusterLine: "{n} cases · last {d} days ago · {w}",
    bWardsQ: "Wards against their own normal", bWardsBig: "Above normal: {w}", bWardsNone: "All near normal", bWardsSub: "Last 4 weeks. Band: the ward's usual range. Coloured only with 3 or more cases.",
    bTrendsQ: "Slow trends", bTrendsBig: "{n} crossed a threshold", bTrendsNone: "No clear change", bTrendsSub: "Resistant share, last 12 months against the 12 before. Dashed: a new EUCAST version.", bYearAgo: "a year before",
    bHealthQ: "Data health", bHealthGaps: "Missing days: {w}", bHealthLate: "Late results: {w}", bHealthOk: "Complete", bHealthSub: "Samples per day, last 14 days. Dashed: a day with nothing where something was expected.",
    bVersion: "Breakpoints: {v} since {m}.", bPending: "{n} pending", bLate: "{n} late",
    bNotesQ: "From colleagues", bNotesBig: "{n} notes", bNotesNone: "No new notes",
    exportCaveat: "Mindline · {src} · synthetic data. First isolate per patient; counts below 3 are never called unusual; susceptibility is lab evidence, not a promise of cure.", exported: "exported",
    today: "Today", newResults: "+{n} results", nextDay: "Next day", prevDay: "Previous day", nextNotable: "Next notable day", calendar: "Calendar", play: "Play the days", pause: "Pause", backToData: "Back to where the data ends", liveFeed: "Live feed (simulated)",
    qWhen: "When? Drag the window, drag its edges, click a week, or use ← →.", qWhere: "Where? Click a ward to focus it and the wards it shares patients with.",
    qWhat: "What? Cases with the same organism and resistance pattern. Click one to follow it.", wFew: "Too few cases in this window to call any ward unusual.",
    wMapLegend: "Size: samples sent. Colour: above the ward's usual level, shown only with 3 or more cases. Ring: wards with the chosen pattern. Lines: shared patients.",
    preview: "preview", planning: "Plan: {drug}.",
    wCases: "new resistant cases in this window", wMost: "{ward} is furthest above its normal: {n} new cases against about {e} usually.", wCalm: "Every ward is close to its own normal.",
    wHospital: "Hospital", wCentres: "Health centres", wUsual: "usual", wPatterns: "Shared patterns", wDay: "day {d} of stay", wNone: "No resistant cases in this window.",
    hygDefaults: "Ward overview defaults", hygTypes: "Resistance types to watch", hygWindow: "Window shown first", hygHome: "Ward to open on", weeks: "{n} weeks", none: "None",
  },
  fi: {
    signIn: "Kirjaudu.", doctor: "Lääkäri", hygiene: "Hygieniatiimi", email: "Sähköposti", password: "Salasana", signInBtn: "Kirjaudu", another: "Valitse toinen tili", useDemo: "Käytä jotakin esittelytiliä.", toDark: "Vaihda tummaan teemaan", toLight: "Vaihda vaaleaan teemaan", watchFilm: "Katso elokuva", filmLen: "1½ min",
    navGen: "Luo dataa", navGenSub: "Simuloitu laboratoriosyöte reaaliajassa", backApp: "Näkymät", backAppSub: "Kirjaudu lääkärinä tai hygieniatiiminä",
    navDoctor: "Tehoaako täällä?", navDoctorSub: "Antibiootit tällaiselle potilaalle", navWards: "Osastokatsaus", navWardsSub: "Mikä muuttui, osasto kerrallaan", navInsights: "Oivallukset", navInsightsSub: "Kysymykset, vastattuna datasta", next: "tulossa",
    dashboards: "Näkymät", you: "Sinä", settings: "Asetukset", settingsSub: "Teema ja kieli", admin: "Ylläpito", adminSub: "Syötteen simulaattori", signOut: "Kirjaudu ulos",
    dataUpTo: "Tyksin data {d} asti", woman: "nainen", man: "mies", Woman: "Nainen", Man: "Mies", anyAge: "kaikki iät", under65: "alle 65", over65: "65 tai yli",
    sentence: "Potilas: {sex}, {age}, {spec}näyte{org}, {ward}.", sentenceOrg: ", kasvaa {org}",
    sentencePt: "Potilas: {who}, {spec}näyte {date}{lab}. {ward}.", ptWho: "{sex}, {age} v", labNamed: "; laboratorio on tunnistanut {org}", labWaiting: "; odotetaan laboratoriota",
    anyWard: "kaikki osastot", allWards: "kaikki osastot", thisWard: "tämä osasto", wardHas: "osastolla {n}",
    legKilled: "lääke tehosi", legSurvived: "bakteeri selvisi", leg4: "viimeiset 4 viikkoa", legDot: "jokainen piste on 5 % viimeisistä 12 kuukaudesta",
    changed: "muuttunut", survivedBefore: "selvisi aiemmin", tooFewGroup: "Liian vähän testattuja näytteitä tälle ryhmälle. Kokeile kaikkia osastoja tai ikiä.", of: "/", wk4: "4 vk",
    killedSentence: "<b>{s}/{n}</b> samankaltaisen potilaan bakteereista kuoli lääkkeeseen {drug} viimeisen 12 kuukauden aikana ({where}).", onlyTested: "vain {n} testattu osastolla {ward}",
    last4: "Viimeiset 4 viikkoa:", tooFew: ", liian vähän luotettavaksi", differs: "Selvästi eri kuin koko vuonna.", noTests: "ei testejä.",
    survivedMost: "Useimmin selvisi:", always: "(aina)", ptSurvived: "Tämän potilaan aiempi näyte oli resistentti lääkkeelle {drug} ({when}).",
    caveat: "Laboratoriotulos, ei lupaus paranemisesta. Potilaan ensimmäinen näyte kustakin mikrobista lasketaan kerran.", colleagues: "Kollegoilta tällä osastolla", deid: "tunnisteeton",
    grows: "Mitä täällä yleensä kasvaa", growsHint: "Valitse mikrobi, jos laboratorio on jo tunnistanut sen.", growsShowing: "Näytetään lääkkeet mikrobille {org}. Paina uudelleen kaikille.",
    monthsAgo: "12 kk sitten", now: "nyt", ptBefore: "Tämä potilas aiemmin", noEarlier: "Ei aiempia näytteitä.", noGrowth: "ei kasvua", killedAll: "herkkä kaikille testatuille", survived: "selvisi",
    sigCount: "Tavallista enemmän tapauksia", sigRate: "Resistenssi kasvaa", sigDrift: "Hitaasti kasvava", sigNew: "Uusi tällä osastolla", since: "alkaen", missing: "Puuttuvaa dataa: {ward}, viikko {d}",
    dPatients: "Potilaat", dWho: "Kuka ja missä", dRecord: "Potilaskertomus", typical: "Tyypillinen potilas", nobody: "ei ketään tiettyä", pickFirst: "Valitse ensin potilas.", choosePt: "Valitse potilas",
    yourPatients: "Potilaasi: {ward}", showMore: "Näytä lisää", setByPatient: "Valitun potilaan mukaan. Muutos palauttaa tyypilliseen potilaaseen.",
    ward: "Osasto", sex: "Sukupuoli", age: "Ikä", sample: "Näyte", any: "Kaikki", all: "Kaikki",
    st_waiting: "odottaa", "st_organism known": "mikrobi tunnistettu", st_final: "valmis", "st_no growth": "ei kasvua", sampleFrom: "näyte",
    mock: "Simulaatio. Merkinnät jäävät tämän selaimen harjoituskertomukseen eivätkä koskaan päädy Rhyppleen.", narrate: "Sanele", narrateSub: "simuloitu: mitä lääkäri voisi sanoa tästä potilaasta",
    record: "Kertomus", justNow: "juuri nyt", sampleK: "Näyte", on: "osastolla", waitingLab: "odottaa laboratoriota",
    prRecord: "Potilaskertomus", prRecordSub: "tunnistettava · pidetään erillään", prKnow: "Osaston tieto", prKnowSub: "tunnisteeton", nothingGen: "Mikään tästä ei yleisty muihin potilaisiin.",
    addMock: "Lisää harjoituskertomukseen", discard: "Hylkää", added: "Lisätty harjoituskertomukseen.", again: "Sanele uudelleen",
    k_impression: "Arvio", k_decision: "Päätös", "k_if-then": "Jos, niin", k_reason: "Koska", k_note: "Huomio", "k_ward observation": "Osasto",
    settingsTitle: "Asetukset.", settingsIntro: "Valitse sovelluksen ulkoasu ja kieli. Muistetaan tällä laitteella.", theme: "Teema", language: "Kieli",
    wardsTitle: "Osastokatsaus.",
    navBrief: "Aamukatsaus", navBriefSub: "Mikä muuttui eilisestä", briefTitle: "Aamukatsaus.", sinceYesterday: "eilisestä",
    bNewQ: "Uudet resistentit tapaukset eilisestä", bNewBig: "{n} uutta", bNewNone: "Ei uusia eilisestä", bNewSub: "{h} näytteenotto hoitopäivänä 3 tai myöhemmin (täytetyt pisteet).", bOutpatient: "avohoito tai varhainen",
    bClusterQ: "Rypäät", bClusterBig: "{n} aktiivista", bClusterNone: "Ei aktiivisia rypäitä", cl_new: "uusi", cl_growing: "kasvaa", cl_stable: "vakaa", cl_over: "ohi",
    bClusterLine: "{n} tapausta · viimeisin {d} päivää sitten · {w}",
    bWardsQ: "Osastot omaan tasoonsa nähden", bWardsBig: "Yli tavallisen: {w}", bWardsNone: "Kaikki lähellä tavallista", bWardsSub: "Viimeiset 4 viikkoa. Nauha: osaston tavallinen vaihtelu. Väri vain, kun tapauksia on vähintään 3.",
    bTrendsQ: "Hitaat trendit", bTrendsBig: "{n} ylitti rajan", bTrendsNone: "Ei selvää muutosta", bTrendsSub: "Resistenttien osuus, viimeiset 12 kk edellisiin 12 kk:een verrattuna. Katkoviiva: uusi EUCAST-versio.", bYearAgo: "vuotta aiemmin",
    bHealthQ: "Datan kunto", bHealthGaps: "Puuttuvia päiviä: {w}", bHealthLate: "Myöhässä: {w}", bHealthOk: "Kattava", bHealthSub: "Näytteet päivittäin, 14 päivää. Katkoviiva: päivä ilman näytteitä, vaikka niitä odotettiin.",
    bVersion: "Raja-arvot: {v} alkaen {m}.", bPending: "{n} odottaa", bLate: "{n} myöhässä",
    bNotesQ: "Kollegoilta", bNotesBig: "{n} merkintää", bNotesNone: "Ei uusia merkintöjä",
    exportCaveat: "Mindline · {src} · synteettinen data. Ensimmäinen isolaatti potilasta kohden; alle 3 tapausta ei koskaan tulkita poikkeamaksi; herkkyys on laboratoriotulos, ei lupaus paranemisesta.", exported: "viety",
    today: "Tänään", newResults: "+{n} tulosta", nextDay: "Seuraava päivä", prevDay: "Edellinen päivä", nextNotable: "Seuraava merkittävä päivä", calendar: "Kalenteri", play: "Toista päiviä", pause: "Tauko", backToData: "Takaisin datan loppuun", liveFeed: "Live-syöte (simuloitu)",
    qWhen: "Milloin? Vedä ikkunaa, vedä sen reunoja, valitse viikko tai käytä ← →.", qWhere: "Missä? Valitse osasto nähdäksesi sen ja osastot, joilla on samoja potilaita.",
    qWhat: "Mitä? Tapaukset, joilla on sama mikrobi ja resistenssiprofiili. Valitse yksi seurataksesi sitä.", wFew: "Liian vähän tapauksia, jotta minkään osaston voisi sanoa poikkeavan.",
    wMapLegend: "Koko: lähetetyt näytteet. Väri: yli osaston tavallisen tason, vain kun tapauksia on vähintään 3. Rengas: osastot, joilla valittu kuvio. Viivat: yhteiset potilaat.",
    preview: "esikatselu", planning: "Suunnitelma: {drug}.",
    wCases: "uutta resistenttiä tapausta tällä aikavälillä", wMost: "{ward} on eniten yli tavallisen: {n} uutta tapausta, tavallisesti noin {e}.", wCalm: "Kaikki osastot ovat lähellä tavallista tasoaan.",
    wHospital: "Sairaala", wCentres: "Terveysasemat", wUsual: "tavallinen", wPatterns: "Yhteiset profiilit", wDay: "hoitopäivä {d}", wNone: "Ei resistenttejä tapauksia tällä aikavälillä.",
    hygDefaults: "Osastokatsauksen oletukset", hygTypes: "Seurattavat resistenssityypit", hygWindow: "Oletusaikaväli", hygHome: "Avattava osasto", weeks: "{n} viikkoa", none: "Ei mitään",
  },
  sv: {
    signIn: "Logga in.", doctor: "Läkare", hygiene: "Hygienteam", email: "E-post", password: "Lösenord", signInBtn: "Logga in", another: "Välj ett annat konto", useDemo: "Använd ett av demokontona.", toDark: "Byt till mörkt tema", toLight: "Byt till ljust tema", watchFilm: "Se filmen", filmLen: "1½ min",
    navGen: "Generera data", navGenSub: "Simulerat labbflöde i realtid", backApp: "Vyer", backAppSub: "Logga in som läkare eller hygienteam",
    navDoctor: "Fungerar det här?", navDoctorSub: "Antibiotika för en sådan patient", navWards: "Avdelningsöversikt", navWardsSub: "Vad som ändrats, avdelning för avdelning", navInsights: "Insikter", navInsightsSub: "Frågor, besvarade med data", next: "kommer",
    dashboards: "Vyer", you: "Du", settings: "Inställningar", settingsSub: "Tema och språk", admin: "Admin", adminSub: "Flödessimulator", signOut: "Logga ut",
    dataUpTo: "Tyks data till {d}", woman: "kvinna", man: "man", Woman: "Kvinna", Man: "Man", anyAge: "alla åldrar", under65: "under 65", over65: "65 eller äldre",
    sentence: "För en {sex}, {age}, med {spec}prov{org}, på {ward}.", sentenceOrg: " som växer {org}",
    sentencePt: "För {who}, {spec}prov från {date}{lab}. På {ward}.", ptWho: "en {sex} på {age} år", labNamed: "; labbet har identifierat {org}", labWaiting: "; väntar på labbet",
    anyWard: "alla avdelningar", allWards: "alla avdelningar", thisWard: "denna avdelning", wardHas: "avdelningen har {n}",
    legKilled: "läkemedlet verkade", legSurvived: "bakterien överlevde", leg4: "senaste 4 veckorna", legDot: "varje prick är 5 % av de senaste 12 månaderna",
    changed: "ändrad", survivedBefore: "överlevde förut", tooFewGroup: "För få testade prov för den här gruppen. Prova alla avdelningar eller åldrar.", of: "av", wk4: "4 v",
    killedSentence: "<b>{s} av {n}</b> liknande patienters bakterier dödades av {drug} under de senaste 12 månaderna, på {where}.", onlyTested: "bara {n} testade på {ward}",
    last4: "Senaste 4 veckorna:", tooFew: ", för få för att lita på", differs: "Tydligt annorlunda än under året.", noTests: "inga tester.",
    survivedMost: "Överlevde oftast:", always: "(alltid)", ptSurvived: "Ett tidigare prov från patienten var resistent mot {drug} ({when}).",
    caveat: "Laboratoriesvar, inget löfte om bot. Första provet per patient och mikrob räknas en gång.", colleagues: "Från kollegor på avdelningen", deid: "avidentifierad",
    grows: "Vad som brukar växa här", growsHint: "Välj en mikrob om labbet redan har identifierat den.", growsShowing: "Visar läkemedel för {org}. Klicka igen för alla.",
    monthsAgo: "för 12 mån sedan", now: "nu", ptBefore: "Patienten tidigare", noEarlier: "Inga tidigare prov.", noGrowth: "ingen växt", killedAll: "känslig för allt testat", survived: "överlevde",
    sigCount: "Fler fall än vanligt", sigRate: "Resistensen ökar", sigDrift: "Ökar långsamt", sigNew: "Nytt på avdelningen", since: "sedan", missing: "Data saknas på {ward}, veckan {d}",
    dPatients: "Patienter", dWho: "Vem och var", dRecord: "Patientjournal", typical: "Typisk patient", nobody: "ingen särskild", pickFirst: "Välj först en patient.", choosePt: "Välj patient",
    yourPatients: "Dina patienter på {ward}", showMore: "Visa fler", setByPatient: "Satt av den valda patienten. Ändringar går tillbaka till en typisk patient.",
    ward: "Avdelning", sex: "Kön", age: "Ålder", sample: "Prov", any: "Alla", all: "Alla",
    st_waiting: "väntar", "st_organism known": "mikrob identifierad", st_final: "klar", "st_no growth": "ingen växt", sampleFrom: "prov",
    mock: "Simulering. Anteckningarna stannar i en övningsjournal på demoservern och når aldrig Rhypple.", narrate: "Diktera", narrateSub: "simulerat: vad en läkare kan säga om patienten",
    record: "Journal", justNow: "just nu", sampleK: "Prov", on: "på", waitingLab: "väntar på labbet",
    prRecord: "Patientjournal", prRecordSub: "identifierbar · hålls separat", prKnow: "Avdelningens kunskap", prKnowSub: "avidentifierad", nothingGen: "Inget här gäller utöver den här patienten.",
    addMock: "Lägg till i övningsjournalen", discard: "Kasta", added: "Tillagt i övningsjournalen.", again: "Diktera igen",
    k_impression: "Bedömning", k_decision: "Beslut", "k_if-then": "Om, så", k_reason: "Eftersom", k_note: "Notering", "k_ward observation": "Avdelning",
    settingsTitle: "Inställningar.", settingsIntro: "Välj hur appen ser ut och vilket språk den talar. Sparas på den här enheten.", theme: "Tema", language: "Språk",
    wardsTitle: "Avdelningsöversikt.",
    navBrief: "Morgonöversikt", navBriefSub: "Vad som ändrats sedan i går", briefTitle: "Morgonöversikt.", sinceYesterday: "sedan i går",
    bNewQ: "Nya resistenta fall sedan i går", bNewBig: "{n} nya", bNewNone: "Inga sedan i går", bNewSub: "{h} provtagna vårddag 3 eller senare (fyllda prickar).", bOutpatient: "öppenvård eller tidigt",
    bClusterQ: "Kluster", bClusterBig: "{n} aktiva", bClusterNone: "Inga aktiva kluster", cl_new: "nytt", cl_growing: "växer", cl_stable: "stabilt", cl_over: "över",
    bClusterLine: "{n} fall · senast för {d} dagar sedan · {w}",
    bWardsQ: "Avdelningar mot sin egen normalnivå", bWardsBig: "Över normalt: {w}", bWardsNone: "Alla nära normalt", bWardsSub: "Senaste 4 veckorna. Bandet: avdelningens vanliga spridning. Färg bara vid minst 3 fall.",
    bTrendsQ: "Långsamma trender", bTrendsBig: "{n} passerade en gräns", bTrendsNone: "Ingen tydlig förändring", bTrendsSub: "Resistent andel, senaste 12 månaderna mot de 12 före. Streckat: en ny EUCAST-version.", bYearAgo: "ett år tidigare",
    bHealthQ: "Datakvalitet", bHealthGaps: "Saknade dagar: {w}", bHealthLate: "Sena svar: {w}", bHealthOk: "Komplett", bHealthSub: "Prov per dag, senaste 14 dagarna. Streckat: en dag utan prov när prov väntades.",
    bVersion: "Brytpunkter: {v} sedan {m}.", bPending: "{n} väntar", bLate: "{n} sena",
    bNotesQ: "Från kollegor", bNotesBig: "{n} anteckningar", bNotesNone: "Inga nya anteckningar",
    exportCaveat: "Mindline · {src} · syntetiska data. Första isolat per patient; färre än 3 fall kallas aldrig avvikande; känslighet är laboratoriesvar, inget löfte om bot.", exported: "exporterad",
    today: "Idag", newResults: "+{n} svar", nextDay: "Nästa dag", prevDay: "Föregående dag", nextNotable: "Nästa betydelsefulla dag", calendar: "Kalender", play: "Spela dagarna", pause: "Paus", backToData: "Tillbaka till datans slut", liveFeed: "Liveflöde (simulerat)",
    qWhen: "När? Dra fönstret, dra i kanterna, klicka på en vecka eller använd ← →.", qWhere: "Var? Klicka på en avdelning för att se den och avdelningarna den delar patienter med.",
    qWhat: "Vad? Fall med samma mikrob och resistensmönster. Klicka på ett för att följa det.", wFew: "För få fall i perioden för att kalla någon avdelning avvikande.",
    wMapLegend: "Storlek: skickade prov. Färg: över avdelningens normala nivå, visas bara vid minst 3 fall. Ring: avdelningar med valt mönster. Linjer: gemensamma patienter.",
    preview: "förhandsvisning", planning: "Plan: {drug}.",
    wCases: "nya resistenta fall i perioden", wMost: "{ward} ligger mest över det normala: {n} nya fall mot vanligen cirka {e}.", wCalm: "Alla avdelningar ligger nära sin normala nivå.",
    wHospital: "Sjukhuset", wCentres: "Hälsostationer", wUsual: "normalt", wPatterns: "Gemensamma mönster", wDay: "vårddag {d}", wNone: "Inga resistenta fall i perioden.",
    hygDefaults: "Standardval för avdelningsöversikten", hygTypes: "Resistenstyper att följa", hygWindow: "Period som visas först", hygHome: "Avdelning att öppna", weeks: "{n} veckor", none: "Ingen",
  },
};
const t = (k, v = {}) => String(I18N[LANG]?.[k] ?? I18N.en[k] ?? k).replace(/\{(\w+)\}/g, (_, x) => v[x] ?? "");
const loc = () => LOCALE[LANG] || "en-GB";
const drugName = (code, fallback) => (META && META.names && META.names.drugs[code] ? META.names.drugs[code][LANG] || META.names.drugs[code].en : fallback || code).replace(/ \(.*\)$/, "");
const wardName = code => { const w = META && META.wards.find(x => x.code === code); return w ? (w.names?.[LANG] || w.name) : code; };
const specName = s => (META && META.names && META.names.specimens[s] ? META.names.specimens[s][LANG] : s);
function setLang(l) { LANG = l; store.set("rl-lang", l); document.documentElement.lang = l; applyStaticText(); if (VIEW) { renderNav(); render(); renderDock(); } }
function applyStaticText() {
  const set = (sel, txt) => { const el = document.querySelector(sel); if (el) el.textContent = txt; };
  set(".lg-body h1", t("signIn")); set('[data-acct=doctor] b', t("doctor")); set('[data-acct=hygiene] b', t("hygiene"));
  set('.fld:nth-of-type(1) span', t("email")); set('.fld:nth-of-type(2) span', t("password")); set("#signin span", t("signInBtn")); set("#lgback", t("another")); set("#lgwatch span", t("watchFilm")); set("#lgwatch small", t("filmLen"));
  themeBtnLabel();
}

// ---------- themes ----------
const THEMES = [
  { id: "quiet-light", name: "Quiet Light", about: "Calm paper, one red accent", pv: ["#fbfaf7", "#17181c", "#ff4f3a", "#a3a4aa"] },
  { id: "matte-dark", name: "Matte Dark", about: "The same, for dark rooms", pv: ["#111214", "#ecebe6", "#ff6a50", "#5f5f62"] },
  { id: "neo-brutal", name: "Neo-brutal", about: "Thick outlines, hard shadows, loud colour", pv: ["#fff4dc", "#111111", "#ff5a36", "#ffc93c"] },
  { id: "print", name: "Print", about: "Warm paper, pastels and a serif", pv: ["#f5efe4", "#2e2a33", "#e07a5f", "#81b29a"] },
];
function setTheme(t) {
  // switch every colour in the same frame: no element may animate from the old theme's colour
  const root = document.documentElement; root.classList.add("theming"); void root.offsetWidth;
  requestAnimationFrame(() => requestAnimationFrame(() => root.classList.remove("theming")));
  root.dataset.theme = t; store.set("rl-theme", t); try { localStorage.setItem("rl-theme", t); } catch {} if (dish) dish.recolor(); if (VIEW) render(); }

// ---------- sign in: a petri dish you can play with ----------
let dish = null;
function makeDish(canvas) {
  const ctx = canvas.getContext("2d"); let W = 0, H = 0, R = 0, cx = 0, cy = 0, dots = [], discs = [], mouse = { x: -1e4, y: -1e4 }, col = {};
  const recolor = () => { col = { s: css("--ink-3"), r: css("--accent"), line: css("--line"), ink: css("--ink"), disc: css("--sheet") }; };
  function seed() {
    dots = []; discs = [];
    const colonies = Array.from({ length: 9 }, () => { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * R * .72; return [cx + Math.cos(a) * d, cy + Math.sin(a) * d, 26 + Math.random() * 40]; });
    colonies.forEach(([x, y, s], k) => { const n = 30 + Math.floor(Math.random() * 30); for (let i = 0; i < n; i++) { const a = Math.random() * 6.283, d = Math.sqrt(Math.random()) * s;
      dots.push({ hx: x + Math.cos(a) * d, hy: y + Math.sin(a) * d, x: cx, y: cy, vx: 0, vy: 0, res: Math.random() < (k === 3 ? .5 : .05), a: 0, r: 2.6 + Math.random() * 1.6, dying: 0, born: performance.now() + Math.random() * 900 }); } });
  }
  function size() { const r = canvas.getBoundingClientRect(), dpr = devicePixelRatio || 1; W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); R = Math.min(W, H) * .4; cx = W / 2; cy = H / 2 - 10; seed(); }
  function frame(now) {
    ctx.clearRect(0, 0, W, H);
    ctx.strokeStyle = col.line; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, R + 14, 0, 6.283); ctx.stroke();
    ctx.globalAlpha = .5; ctx.beginPath(); ctx.arc(cx, cy, R + 22, 0, 6.283); ctx.stroke(); ctx.globalAlpha = 1;
    for (const dc of discs) {
      const k = Math.min(1, (now - dc.t) / 900), rr = 8 + k * dc.R;
      ctx.globalAlpha = .12 * (1 - k * .4); ctx.fillStyle = col.r; ctx.beginPath(); ctx.arc(dc.x, dc.y, rr, 0, 6.283); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = col.r; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.arc(dc.x, dc.y, rr, 0, 6.283); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = col.disc; ctx.strokeStyle = col.ink; ctx.beginPath(); ctx.arc(dc.x, dc.y, 9, 0, 6.283); ctx.fill(); ctx.stroke();
    }
    for (const d of dots) {
      if (now < d.born) continue;
      const dx = d.x - mouse.x, dy = d.y - mouse.y, dd = dx * dx + dy * dy;
      if (dd < 4900 && dd > 1) { const f = (1 - Math.sqrt(dd) / 70) * 1.6; d.vx += dx / Math.sqrt(dd) * f; d.vy += dy / Math.sqrt(dd) * f; }
      d.vx += (d.hx - d.x) * .02 + (Math.random() - .5) * .3; d.vy += (d.hy - d.y) * .02 + (Math.random() - .5) * .3; d.vx *= .86; d.vy *= .86; d.x += d.vx; d.y += d.vy;
      if (d.dying) d.a = Math.max(0, d.a - .03); else d.a = Math.min(1, d.a + .05);
      if (d.a <= 0 && d.dying) continue;
      ctx.globalAlpha = d.a * (d.res ? 1 : .8); ctx.fillStyle = d.res ? col.r : col.s;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r * (d.dying ? d.a : 1), 0, 6.283); ctx.fill();
    }
    ctx.globalAlpha = 1; dots = dots.filter(d => !(d.dying && d.a <= 0));
    requestAnimationFrame(frame);
  }
  canvas.addEventListener("pointermove", e => { const r = canvas.getBoundingClientRect(); mouse = { x: e.clientX - r.left, y: e.clientY - r.top }; });
  canvas.addEventListener("pointerleave", () => { mouse = { x: -1e4, y: -1e4 }; });
  canvas.addEventListener("click", e => {
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top, Rk = 90;
    discs.push({ x, y, t: performance.now(), R: Rk });
    let killed = 0, survived = 0;
    setTimeout(() => {
      dots.forEach(d => { if (!d.dying && Math.hypot(d.x - x, d.y - y) < Rk) { if (d.res) survived++; else { d.dying = 1; killed++; } } });
      setTimeout(() => { // the survivors take over the space
        const surv = dots.filter(d => d.res && Math.hypot(d.x - x, d.y - y) < Rk);
        surv.forEach(s => { for (let k = 0; k < 2 && dots.length < 1100; k++) dots.push({ hx: s.hx + (Math.random() - .5) * 26, hy: s.hy + (Math.random() - .5) * 26, x: s.x, y: s.y, vx: 0, vy: 0, res: true, a: 0, r: s.r, dying: 0, born: performance.now() + k * 240 }); });
      }, 700);
    }, 500);
  });
  canvas.addEventListener("dblclick", seed);
  recolor(); let lastW = 0, lastH = 0;
  new ResizeObserver(() => { const r = canvas.getBoundingClientRect(); if (r.width && (Math.abs(r.width - lastW) > 2 || Math.abs(r.height - lastH) > 2)) { lastW = r.width; lastH = r.height; size(); } }).observe(canvas);
  requestAnimationFrame(frame);
  return { recolor };
}

// ---------- sign in flow ----------
const ACCTS = { doctor: "doctor@mindline.demo", hygiene: "hygiene@mindline.demo" };
let typing = false;
async function typeInto(el, text, ms = 28) { el.value = ""; el.focus(); for (const ch of text) { el.value += ch; await new Promise(r => setTimeout(r, ms + Math.random() * 30)); } }
async function quickSignIn(acct) {
  if (typing) return; typing = true;
  // the two choices step aside; only who you are and the password typing in remain
  const body = document.querySelector(".lg-body"); body.classList.add("chosen");
  $("whoLine").innerHTML = `<i class="av">${acct === "doctor" ? "D" : "H"}</i><span><b>${acct === "doctor" ? t("doctor") : t("hygiene")}</b><em>${ACCTS[acct]}</em></span>`;
  await new Promise(r => setTimeout(r, 320));
  const form = $("lgform"); form.hidden = false; form.classList.add("appear"); await new Promise(r => setTimeout(r, 420));
  $("email").value = ACCTS[acct];   // the account is already known; only the password types in
  await typeInto($("password"), "demo-password", 26);
  $("signin").classList.add("pressing"); await new Promise(r => setTimeout(r, 260)); $("signin").classList.remove("pressing");
  typing = false; signIn();
}
async function signIn() {
  $("lgerr").textContent = "";
  try {
    const s = await api("/api/app/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: $("email").value.trim() }) });
    store.set("rl-session", s);
    $("login").classList.add("leaving"); setTimeout(() => { dropLoginScene(); enterApp(s); }, 450);
  } catch (e) { $("lgerr").textContent = t("useDemo"); }
}
document.querySelectorAll(".acct").forEach(b => b.addEventListener("click", () => quickSignIn(b.dataset.acct)));
$("lgform").addEventListener("submit", e => { e.preventDefault(); signIn(); });
// the login visual: a glass testing lab on a riverbank (scene3d/, three.js), loaded only when the login is shown.
// It is the full-bleed background; the sign-in floats over it. Without WebGL, the petri dish is drawn instead.
let login3d = null, login3dState = "idle";
function loadLoginScene() {
  if (login3dState !== "idle") return; login3dState = "loading";
  const right = document.querySelector(".lg-right"), page = $("login");
  const fallback = () => { login3dState = "dish"; page.classList.remove("scene-page"); right.classList.remove("scene-host", "scene-waiting"); right.classList.add("dish-on"); dish = dish || makeDish($("dish")); };
  const probe = document.createElement("canvas");
  if (!("IntersectionObserver" in window) || !(probe.getContext("webgl2") || probe.getContext("webgl"))) return fallback();
  page.classList.add("scene-page"); right.classList.add("scene-host", "scene-waiting");
  // where the lab sits: right of the sign-in on wide screens, across the top on narrow ones
  const framing = (w, h) => {
    if (innerWidth > 960) { const r = document.querySelector(".lg-body").getBoundingClientRect(); return { x0: Math.min(.5, (r.right + 24) / w), x1: .99, y0: .16, y1: 1.02 }; }
    const top = Math.min(h * .5, 480); return { x0: 0, x1: 1, y0: 96 / h, y1: (top - 24) / h };
  };
  // the page shimmers until every part has streamed in (or a slow part times out), then the scene fades in
  let revealed = false;
  const reveal = () => { if (!revealed) { revealed = true; right.classList.remove("scene-waiting"); } };
  const start = () => import(window.MindlineStatic.base + "scene3d/index.js").then(m => {
    if (login3dState !== "loading") return;   // signed in while it loaded
    login3d = m.mount(right, { background: true, framing, onReady: () => setTimeout(reveal, 7000), onProgress: (n, total) => { if (n >= total) setTimeout(reveal, 900); } });
    if (login3d) login3dState = "on"; else fallback();
  }).catch(err => { console.warn("3D login scene unavailable", err); if (login3dState === "loading") fallback(); });
  (window.requestIdleCallback || (f => setTimeout(f, 60)))(start, { timeout: 700 });
}
function dropLoginScene() { if (login3d) login3d.destroy(); login3d = null; login3dState = "gone"; }
function themeBtnLabel() { const b = $("lgtheme"); if (!b) return; const l = t(document.documentElement.dataset.theme === "matte-dark" ? "toLight" : "toDark"); b.setAttribute("aria-label", l); b.title = l; }
$("lgtheme").addEventListener("click", () => { setTheme(document.documentElement.dataset.theme === "matte-dark" ? "quiet-light" : "matte-dark"); themeBtnLabel(); });
$("lgback").addEventListener("click", () => { if (typing) return; document.querySelector(".lg-body").classList.remove("chosen"); $("lgform").hidden = true; $("email").value = $("password").value = ""; });

// ---------- app shell ----------
let SESSION = null, VIEW = null, META = null;
const NAV = () => [
  { id: "generate", title: t("navGen"), sub: t("navGenSub"), roles: ["admin"] },
  { id: "answers", title: "Answers", sub: "Questions asked; stop the model", roles: ["admin"] },
  { id: "knowledge", title: "Knowledge Graph", sub: "What clinicians have learned, connected", roles: ["admin"] },
  { id: "doctor", title: t("navDoctor"), sub: t("navDoctorSub"), roles: ["doctor"] },
  { id: "brief", title: t("navBrief"), sub: t("navBriefSub"), roles: ["hygiene"] },
  { id: "wards", title: t("navWards"), sub: t("navWardsSub"), roles: ["hygiene"] },
  { id: "insights", title: t("navInsights"), sub: t("navInsightsSub"), roles: ["doctor", "hygiene"] },
  { id: "overview", title: "Data", sub: ({ en: "Explore the hospital's lab results", fi: "Tutki sairaalan laboratoriotuloksia", sv: "Utforska sjukhusets laboratorieresultat" })[LANG], roles: ["doctor", "hygiene"] },
];
async function enterApp(s) {
  SESSION = Profile.restore(s); $("login").hidden = true; $("app").hidden = false;
  $("who").onclick = () => Profile.open();
  setRail(store.get("rl-rail", false));
  META = META || await api("/api/app/meta");
  $("asof").textContent = t("dataUpTo", { d: niceDate(META.last) });
  await loadClock();
  const home = s.role === "admin" ? "generate" : s.role === "doctor" ? "doctor" : "brief", saved = store.get(s.role === "admin" ? "rl-admin-view" : "rl-view", null);
  go(saved === "settings" || NAV().some(n => n.id === saved && n.roles.includes(s.role)) ? saved : home);
}
const ICON = {
  overview: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><path d="M12 3v9l5 3"/></svg>',
  doctor: '<svg viewBox="0 0 24 24"><rect x="3" y="9" width="18" height="6" rx="3"/><path d="M12 9v6"/></svg>',
  brief: '<svg viewBox="0 0 24 24"><path d="M5 4h14v16H5z"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  wards: '<svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
  generate: '<svg viewBox="0 0 24 24"><path d="M4 18h3l3-9 4 12 3-7h3"/></svg>',
  insights: '<svg viewBox="0 0 24 24"><path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/></svg>',
  answers: '<svg viewBox="0 0 24 24"><path d="M5 5h14v10H9l-4 4z"/><path d="M9 9h6M9 12h4"/></svg>',
  knowledge: '<svg viewBox="0 0 24 24"><circle cx="5" cy="6" r="2.5"/><circle cx="18" cy="5" r="2.5"/><circle cx="12" cy="18" r="2.5"/><path d="m7.5 6 8-.7M6.3 8.2l4.4 7.5m6.2-8.3-3.8 8.3"/></svg>',
  back: '<svg viewBox="0 0 24 24"><path d="M10 6l-6 6 6 6M4 12h16"/></svg>',
  settings: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  admin: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  out: '<svg viewBox="0 0 24 24"><path d="M15 4h4v16h-4M10 8l-4 4 4 4M6 12h10"/></svg>',
};
function renderNav() {
  Profile.renderHeader();
  const SHORT = { doctor: "Drugs", wards: "Wards", settings: "Settings" };
  const item = (id, title, sub, extra = "") => `<button class="ri" data-go="${id}" title="${title}" aria-label="${title}" aria-current="${VIEW === id ? "page" : "false"}">${ICON[id]}<span>${title}${extra}<small>${sub}</small></span></button>`;
  $("sidenav").innerHTML = `<h4>${t("dashboards")}</h4>` + NAV().filter(n => n.roles.includes(SESSION.role)).map(n => item(n.id, n.title, n.sub, n.soon ? `<i class="soon">${t("next")}</i>` : "")).join("") +
    (SESSION.role === "admin" ? `<h4>${t("you")}</h4>` + item("settings", t("settings"), t("settingsSub")) : "");
  if (SESSION.role === "admin") { $("railfoot").innerHTML = `<a class="ri" href="${window.MindlineStatic.base}" title="${t("backApp")}" aria-label="${t("backApp")}">${ICON.back}<span>${t("backApp")}<small>${t("backAppSub")}</small></span></a>`; return; }
  $("railfoot").innerHTML = `<a class="ri" href="${window.MindlineStatic.base}admin/" title="${t("admin")} · ${t("adminSub")}" aria-label="${t("admin")}">${ICON.admin}<span>${t("admin")}<small>${t("adminSub")}</small></span></a>
    ${Profile.sidebar()}`;
}
const setRail = open => { $("app").classList.toggle("open", open); $("burger").setAttribute("aria-expanded", open); store.set("rl-rail", open); };
$("burger").addEventListener("click", () => setRail(!$("app").classList.contains("open")));
$("side").addEventListener("click", e => { if (e.target.closest("[data-profile]")) return Profile.open(); const b = e.target.closest("[data-go]"); if (b) go(b.dataset.go); });
function go(view) { if (typeof resetAnswer === "function") resetAnswer(); VIEW = view; store.set(SESSION.role === "admin" ? "rl-admin-view" : "rl-view", view); renderNav(); if (DOCK) openDock(DOCK); $("dock").hidden = view !== "doctor"; render(); }
function render() {
  $('clockpill').hidden = SESSION.role === 'admin' || VIEW === 'settings';
  $("bartitle").textContent = { overview: "Data", knowledge: "Knowledge Graph", doctor: t("navDoctor"), wards: t("navWards"), settings: Profile.text("title"), generate: t("navGen"), brief: t("navBrief"), insights: t("navInsights"), answers: "Answers" }[VIEW];
  $("page").classList.toggle("full", VIEW === "generate");
  if ($("insmenu")) $("insmenu").hidden = VIEW !== "insights";
  if (typeof syncFilterButton === "function") syncFilterButton();
  ({ overview: () => renderOverview(), knowledge: () => renderKnowledge(), doctor: renderDoctor, wards: renderWards, settings: renderSettings, generate: renderGenerate, brief: renderBrief, insights: () => renderInsights(), answers: () => renderAnswersAdmin() })[VIEW]();
}

// ---------- doctor: will it work here? ----------
const F = Object.assign({ ward: "URO", sex: "F", age: "", spec: "urine", org: "", drug: "", patient: "", windowWeeks: 4 }, store.get("rl-doctor", {}));
let AB = null, PT = null, PLIST = [], loading = false;
const saveF = () => store.set("rl-doctor", F);
const STATUS = { waiting: "waiting", "organism known": "organism named", final: "final", "no growth": "no growth" };
async function renderDoctor() {
  const p = $("page");
  if (SESSION.ward && !F.wardSet) { F.ward = SESSION.ward; F.wardSet = true; saveF(); }
  p.innerHTML = `<div class="dhead brief-head"><div><h1>${t("navDoctor")}</h1><p id="dsum"></p></div>${exportBar("doctor")}</div>
    <div class="banner" id="dbanner"></div>
    <div class="dgrid"><div><div id="drug-key" class="drug-key"></div><div class="drugs" id="drugs"></div></div>
    <div class="aside"><div id="phist"></div><div class="grows"><h3 id="grows-title"></h3><p class="grows-context" id="grows-context"></p><div id="grows"></div></div><div id="evcard"></div></div></div>`;
  renderSentence(); renderDock();
  if (SESSION.role === "doctor") loadPatients();
  if (F.patient) await pickPatient(F.patient, true); else await loadDoctor();
}
// the sentence says who this is for; tapping a word opens the matching control in the dock
function renderSentence() {
  const ward = META.wards.find(w => w.code === F.ward), w = (k, text) => k === "org" ? `<a class="word organism-link" href="#grows" data-show-organism aria-controls="grows">${text}</a>` : `<button class="word" data-open="who">${text}</button>`;
  if (PT) {
    const cur = PT.history[0], age = new Date(META.last).getFullYear() - +PT.birth_year;
    $("dsum").innerHTML = t("sentencePt", { who: `<button class="word" data-open="patients">${t("ptWho", { sex: PT.sex === "M" ? t("man") : t("woman"), age })}</button>`, spec: specName(cur.spec), date: niceDate(cur.date),
      lab: F.org ? t("labNamed", { org: w("org", F.org) }) : t("labWaiting"), ward: w("ward", ward ? wardName(ward.code) : t("anyWard")) });
  } else $("dsum").innerHTML = t("sentence", { sex: w("sex", F.sex === "M" ? t("man") : t("woman")), age: w("age", F.age === "65+" ? t("over65") : F.age === "<65" ? t("under65") : t("anyAge")),
      spec: w("spec", specName(F.spec)), org: F.org ? t("sentenceOrg", { org: w("org", F.org) }) : "", ward: w("ward", ward ? wardName(ward.code) : t("anyWard")) });
  if (F.plan && META.names) $("dsum").insertAdjacentHTML("beforeend", " " + t("planning", { drug: `<b class="planw">${drugName(F.plan)}</b>` }) + ` <button type="button" class="clear-plan" data-clear-plan>${({ en: "Clear selection", fi: "Poista valinta", sv: "Rensa val" })[LANG]}</button>`);
  renderDock();
}
$("page").addEventListener("click", e => {
  if (VIEW !== "doctor") return;
  if (e.target.closest("[data-show-organism]")) {
    e.preventDefault();
    const bubble = [...document.querySelectorAll("#grows .bub")].find(b => b.dataset.organism === F.org);
    const chart = $("grows");
    if (chart) chart.scrollIntoView({ behavior: reduceMotion() ? "auto" : "smooth", block: "center" });
    if (bubble) bubble.focus({ preventScroll: true });
    return;
  }
  const w = e.target.closest(".word[data-open]"); if (w) return openDock(w.dataset.open);
  const r = e.target.closest(".drow");
  if (e.target.closest("[data-clear-plan]")) { F.drug = ""; F.plan = ""; saveF(); markPlan(); renderSentence(); renderEvidence(); return; }
  if (r) { const c = r.dataset.drug, clear = F.plan === c; F.drug = clear ? "" : c; F.plan = clear ? "" : c; saveF(); markPlan(); renderSentence(); renderEvidence(); }
});
// the plan: the drug the doctor intends to give. It keeps full strength; the alternatives stay visible but quieter
const planNow = () => AB && AB.drugs.some(d => d.code === F.plan) ? F.plan : "";
function markPlan() {
  const plan = planNow();
  document.querySelectorAll(".drow").forEach(x => { x.classList.toggle("sel", x.dataset.drug === F.drug); x.classList.toggle("plan", x.dataset.drug === plan); x.classList.toggle("alt", !!plan && x.dataset.drug !== plan); x.setAttribute("aria-pressed", String(x.dataset.drug === plan)); const label = x.querySelector(".plan-label"); if (label) label.hidden = x.dataset.drug !== plan; });
}
// on a phone the evidence opens right under the chosen row; on wider screens it sits beside the list
const NARROW = matchMedia("(max-width: 700px)");
function parkEvidence() { const ev = $("evcard"), aside = document.querySelector(".dgrid .aside"); if (ev && aside && ev.parentElement !== aside) aside.append(ev); }
function placeEvidence() {
  const ev = $("evcard"), sel = document.querySelector(".drow.sel");
  if (!ev) return;
  if (NARROW.matches && sel) sel.after(ev); else parkEvidence();
}
NARROW.addEventListener("change", () => { if (VIEW === "doctor") placeEvidence(); });

// ---------- the patient record: history and focused note capture ----------
const KIND_LABEL = new Proxy({}, { get: (_, k) => t("k_" + String(k)) });
let REC = [];   // the patient's notes from the mock store
async function loadRecord() {
  const patient = PT?.id;
  const rows = patient ? await api(`/api/app/record?id=${encodeURIComponent(patient)}`) : [];
  if (PT?.id === patient) REC = rows;
}
function recordPanel() {
  if (!PT) return `<h3>${t("dRecord")}</h3><p class="muted">${t("pickFirst")}</p><button class="chip" data-open-dock="patients">${t("choosePt")}</button>`;
  const age = new Date(META.last).getFullYear() - +PT.birth_year;
  const items = [
    ...REC.map(n => ({ at: n.created_at, html: `<span class="kind">${KIND_LABEL[n.fields.kind || "note"]}</span>${esc(n.text || "")}` , who: n.fields.author })),
    ...PT.history.map(h => ({ at: Date.parse(h.date), html: `<span class="kind quiet">${t("sampleK")}</span>${specName(h.spec)} · ${h.ward}${h.isolates.length ? " · " + h.isolates.map(i => `<b>${i.short}</b>${i.resisted.length ? ` ${t("survived")} ${i.resisted.filter(d => d !== "FOX").join(", ")}` : ""}`).join(" · ") : h.status === "waiting" ? " · " + t("waitingLab") : " · " + t("noGrowth")}`, date: h.date })),
  ].sort((a, b) => b.at - a.at);
  return `<h3>${PT.sex === "M" ? t("Man") : t("Woman")}, ${age} · ${PT.id}</h3>
    <p class="mock">${t("mock")}</p>
    <div id="narr">${narrationHtml()}</div>
    <h4 class="sub">${t("record")}</h4>
    <ol class="record">${items.map(it => `<li><time>${it.date ? niceDate(it.date) : t("justNow")}</time><span>${it.html}</span></li>`).join("")}</ol>`;
}
function narrationHtml() { return NoteCapture.entry(); }
const esc = s => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const DNAME = c => drugName(c);
function shareText(k) {
  const who = `${k.sex === "M" ? "man" : "woman"} ${k.age_band}, ${k.sample}${k.organism ? `, ${k.organism.split(" ").map((x, i) => i ? x : x[0] + ".").join(" ")}` : ""}, ${k.ward}, ${k.month}`;
  if (k.kind === "ward observation") return `${k.resistance || "resistance"} noticed more often · ${k.ward}, ${k.month}`;
  return `${k.kind === "if-then" ? `if ${k.resistance || "worse"}, ` : ""}${k.decision} ${DNAME(k.drug)}${k.reasons.length ? ` (${k.reasons.join(", ")})` : ""} · ${who}`;
}
function narrate() { return NoteCapture.open(); }
// the evidence card shows what colleagues have shared about this drug on this ward (de-identified)
async function loadKnowledge(code) {
  const el = $("kn"); if (!el) return;
  const rows = await api(`/api/app/knowledge?ward=${F.ward}&drug=${code}`);
  el.innerHTML = rows.length ? `<h4 class="sub">${t("colleagues")}</h4><ul class="notes">${rows.slice(0, 4).map(r => `<li>${shareText({ ...r.fields, ward: F.ward, sample: F.spec })}<small>${t("deid")} · ${r.fields.month}</small></li>`).join("")}</ul>` : "";
}

// ---------- the dock: rounded icons at the bottom that hold the extra controls ----------
const DICON = {
  patients: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="3.6"/><path d="M5 20c.8-3.8 3.6-6 7-6s6.2 2.2 7 6"/></svg>',
  who: '<svg viewBox="0 0 24 24"><path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2.2"/><circle cx="8" cy="17" r="2.2"/></svg>',
  organism: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><circle cx="12" cy="12" r="1" /><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3M6 6l2.1 2.1M15.9 15.9L18 18M6 18l2.1-2.1M15.9 8.1L18 6"/></svg>',
  record: '<svg viewBox="0 0 24 24"><path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h4"/></svg>',
  history: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/></svg>',
};
let DOCK = null;   // which panel is open
function dockItems() {
  const ward = META.wards.find(w => w.code === F.ward);
  const sel = PLIST.find(p => p.id === F.patient), waiting = PLIST.filter(p => p.status === "waiting").length;
  const items = [];
  if (SESSION.role === "doctor") items.push({ id: "patients", label: t("dPatients"), value: sel ? `${sel.sex === "M" ? t("Man") : t("Woman")}, ${sel.age}` : t("typical"), badge: waiting });
  items.push({ id: "who", label: t("dWho"), value: `${F.sex === "M" ? t("Man") : t("Woman")} · ${F.age || t("anyAge")} · ${specName(F.spec)} · ${ward ? F.ward : t("allWards")}` });
  if (SESSION.role === "doctor") items.push({ id: "record", label: t("dRecord"), value: PT ? `${REC.length}` : t("pickFirst") });
  return items;
}
function renderDock() {
  const d = $("dock"); if (!d || !META || !RECIPE_OK()) return;
  d.hidden = VIEW !== "doctor";
  d.innerHTML = dockItems().map(it => `<button class="di ${DOCK === it.id ? "on" : ""}" data-dock="${it.id}" aria-label="${it.label}">
      <span class="ic">${DICON[it.id]}${it.badge ? `<i class="badge">${it.badge}</i>` : ""}</span>
      <span class="tx"><b>${it.label}</b><small>${it.value}</small></span></button>`).join("");
}
const RECIPE_OK = () => true;
function openDock(id) {
  DOCK = DOCK === id ? null : id; renderDock();
  const panel = $("dockpanel");
  if (!DOCK) { panel.classList.remove("open"); setTimeout(() => { if (!DOCK) panel.hidden = true; }, 450); return; }
  const fresh = panel.hidden; panel.hidden = false; if (fresh) { void panel.offsetWidth; } panel.classList.add("open");
  if (DOCK === "patients") { panel.innerHTML = `<h3>${t("yourPatients", { ward: wardName(F.ward) })}</h3><ul class="plist" id="prow"></ul><button class="more" id="pmore" hidden>${t("showMore")}</button>`; drawPatients(); }
  if (DOCK === "who") panel.innerHTML = whoPanel();
  if (DOCK === "record") { panel.innerHTML = recordPanel(); if (PT) loadRecord().then(() => { if (DOCK === "record") panel.innerHTML = `<button class="pclose" data-close aria-label="Close">×</button>` + recordPanel(); }); }
  panel.insertAdjacentHTML("afterbegin", `<button class="pclose" data-close aria-label="Close">×</button>`);
}
function notesPanel() {
  const notes = store.get("rl-notes", []).filter(n => !n.ward || n.ward === F.ward).slice(0, 6);
  return `<h3>Notes on ${(META.wards.find(w => w.code === F.ward) || {}).name || "this ward"}</h3>
    <div class="note-form"><textarea id="dnote" placeholder="What do you see, what did you do, and why?"></textarea><div class="chips"><button class="chip on" id="dnotesave">Save note</button></div></div>
    ${notes.length ? `<ul class="notes">${notes.map(n => `<li>${n.text}<small>${n.author} · ${n.drug || "general"} · ${new Date(n.at).toLocaleDateString("en-GB")}</small></li>`).join("")}</ul>` : ""}`;
}
function whoPanel() {
  const row = (label, key, opts) => `<div class="prow2"><span>${label}</span><div class="chips">${opts.map(([v, t]) => `<button class="chip ${String(F[key]) === String(v) ? "on" : ""}" data-set="${key}" data-v="${v}">${t}</button>`).join("")}</div></div>`;
  return `<h3>${t("dWho")}</h3>${PT ? `<p class="muted" style="margin:0 0 10px">${t("setByPatient")}</p>` : ""}` +
    row(t("ward"), "ward", [["", t("all")], ...META.wards.map(w => [w.code, w.code])]) + row(t("sex"), "sex", [["F", t("Woman")], ["M", t("Man")]]) +
    row(t("age"), "age", [["", t("any")], ["<65", t("under65")], ["65+", "65+"]]) + row(t("sample"), "spec", ["urine", "blood", "wound"].map(s => [s, cap(specName(s))]));
}
$("dock").addEventListener("click", e => { const b = e.target.closest("[data-dock]"); if (b) openDock(b.dataset.dock); });
$("dockpanel").addEventListener("click", e => {
  if (e.target.closest("[data-close]")) return openDock(DOCK);
  if (e.target.closest("[data-narrate]")) return narrate();
  const od = e.target.closest("[data-open-dock]"); if (od) { openDock(DOCK); return openDock(od.dataset.openDock); }
  if (e.target.id === "pmore") { PSHOW += 3; return drawPatients(); }
  if (e.target.id === "dnotesave") { const t = $("dnote").value.trim(); if (!t) return; const all = store.get("rl-notes", []);
    all.unshift({ text: t, drug: F.drug, ward: F.ward, author: SESSION.name, at: Date.now() }); store.set("rl-notes", all); $("dockpanel").innerHTML = `<button class="pclose" data-close aria-label="Close">×</button>` + notesPanel(); renderDock(); renderEvidence(); return; }
  const pp = e.target.closest("[data-patient]"); if (pp) return pickPatient(pp.dataset.patient === F.patient ? "" : pp.dataset.patient);
  const s = e.target.closest("[data-set]");
  if (s) {
    const k = s.dataset.set; F[k] = s.dataset.v;
    if (k === "spec") F.org = "";
    if (PT || k === "ward") { F.patient = ""; PT = null; }
    saveF(); renderSentence(); $("dockpanel").innerHTML = `<button class="pclose" data-close aria-label="Close">×</button>` + whoPanel();
    if (k === "ward" && SESSION.role === "doctor") loadPatients();
    return loadDoctor();
  }
});
document.addEventListener("pointerdown", e => { if (DOCK && !e.target.closest("#dock, #dockpanel, .word")) openDock(DOCK); });
addEventListener("keydown", e => { if (e.key === "Escape" && DOCK) openDock(DOCK); });

// the patient list: recent samples on my ward, the ones still in the lab first
let PSHOW = 3;
async function loadPatients() {
  PLIST = await api(`/api/app/patients?ward=${F.ward || "URO"}`); PSHOW = 3;
  drawPatients(); renderDock();
}
function drawPatients() {
  if (!$("prow")) return;
  const dot = st => st === "waiting" ? css("--amber") : st === "organism known" ? css("--cool") : css("--ink-3");
  const org = p => p.organisms.length ? p.organisms.map(o => o.split(" ").map((x, i) => i ? x : x[0] + ".").join(" ")).join(", ") : "";
  const shown = PLIST.slice(0, PSHOW); const sel = PLIST.find(p => p.id === F.patient); if (sel && !shown.includes(sel)) shown.push(sel);
  $("prow").innerHTML = `<li class="${!F.patient ? "on" : ""}" data-patient=""><b>${t("typical")}</b><span class="st">${t("nobody")}</span></li>` + shown.map(p =>
    `<li class="${F.patient === p.id ? "on" : ""}" data-patient="${p.id}"><b>${p.sex === "M" ? t("Man") : t("Woman")}, ${p.age}</b><span class="st"><i style="background:${dot(p.status)}"></i>${t("st_" + p.status)}</span>
      <div class="more-info">${p.id} · ${specName(p.spec)} · ${niceDate(p.date)}${org(p) ? ` · ${org(p)}` : ""}${p.flags.length ? ` · <em>${p.flags.join(" ")}</em>` : ""}</div></li>`).join("");
  $("pmore").hidden = PSHOW >= PLIST.length;
}
let pickSeq = 0, loadSeq = 0;   // only the latest click wins when responses come back out of order
async function pickPatient(id, quiet) {
  const my = ++pickSeq;
  F.patient = id; F.plan = ""; saveF(); REC = [];
  if (!id) { PT = null; F.org = ""; saveF(); drawPatients(); renderSentence(); drawHistory(); return loadDoctor(); }
  const pt = await api(`/api/app/patient?id=${id}`);
  if (my !== pickSeq) return;
  PT = pt;
  const cur = PT.history[0], age = new Date(META.last).getFullYear() - +PT.birth_year;
  F.sex = PT.sex; F.age = age >= 65 ? "65+" : "<65"; F.spec = cur.spec;
  F.org = cur.isolates[0] ? cur.isolates[0].organism : "";
  saveF(); drawPatients(); renderSentence(); drawHistory(); await loadDoctor();
}
// this patient's earlier samples, newest first: what grew, and what it survived
function drawHistory() {
  if (!$("phist")) return;
  if (!PT) { $("phist").innerHTML = ""; return; }
  const past = PT.history.slice(1, 8);
  $("phist").innerHTML = `<div class="hist"><h3>${t("ptBefore")}</h3>${past.length ? `<ol>${past.map(h => `<li><time>${niceDate(h.date)}</time><span>${h.ward} · ${specName(h.spec)}${h.isolates.length ? h.isolates.map(i =>
      ` · <b>${i.short}</b>${i.flags.length ? ` <em class="flag">${i.flags.join(" ")}</em>` : ""}${i.resisted.length ? `<small>${t("survived")} ${i.resisted.join(", ")}</small>` : `<small>${t("killedAll")}</small>`}`).join("") : " · " + t("noGrowth")}</span></li>`).join("")}</ol>`
    : `<p class="muted">${t("noEarlier")}</p>`}</div>`;
}
// drugs this patient's bacteria survived before, with when
function resistedBefore(code) {
  if (!PT) return null;
  for (const h of PT.history.slice(1)) for (const i of h.isolates) if (i.resisted.includes(code)) return `${i.short}, ${niceDate(h.date)}`;
  return null;
}
async function loadDoctor() {
  loading = true;
  $("drugs").innerHTML = Array.from({ length: 7 }, () => `<div class="skel" style="height:40px;margin:8px 0"></div>`).join("");
  const q = new URLSearchParams({ ward: F.ward, sex: F.sex, age: F.age, spec: F.spec, org: F.org, recent_weeks: F.windowWeeks }), my = ++loadSeq;
  let ab; try { ab = await api(`/api/app/antibiogram?${q}`); } catch (e) { $("drugs").innerHTML = `<p class="muted">${e.message}</p>`; return; }
  if (my !== loadSeq || VIEW !== "doctor") return; AB = ab;
  loading = false;
  if (planNow()) F.drug = F.plan;
  if (!AB.drugs.find(d => d.code === F.drug)) F.drug = "";
  drawDrugs(); drawGrows(); renderEvidence(); drawBanner(); renderDock(); drawHistory();
}
function drawBanner() {
  const NAMES = { count: t("sigCount"), rate: t("sigRate"), drift: t("sigDrift"), new: t("sigNew") };
  const items = [...AB.signals.map(a => [css("--accent"), `${NAMES[a.type] || "Signal"}: ${a.target}${a.ward !== "ALL" ? " · " + a.ward : ""} · ${t("since")} ${niceDate(a.from)}`]),
    ...AB.gaps.map(a => [css("--amber"), t("missing", { ward: a.ward, d: niceDate(a.from) })])];
  $("dbanner").innerHTML = items.map(([c, t]) => `<span style="--c:${c}"><i></i>${t}</span>`).join("");
}
function drawDrugs() {
  parkEvidence();
  if (!AB.drugs.length) { $("drugs").innerHTML = `<p class="muted">${t("tooFewGroup")}</p>`; return; }
  const plan = planNow();
  const keyCopy = {
    en: { title: "Lab results over the past 12 months", no: "No resistance found", yes: "Resistance found", dots: "Each dot represents about 5% of tests, not one patient.", recent: "Triangle: recent results", count: "with no resistance", planned: "Planned" },
    fi: { title: "Laboratoriotulokset viimeisten 12 kuukauden ajalta", no: "Ei resistenssiä", yes: "Resistenssi todettu", dots: "Yksi piste vastaa noin 5 % testeistä, ei yhtä potilasta.", recent: "Kolmio: viimeaikaiset tulokset", count: "ilman resistenssiä", planned: "Suunniteltu" },
    sv: { title: "Laboratorieresultat under de senaste 12 månaderna", no: "Ingen resistens påvisad", yes: "Resistens påvisad", dots: "Varje prick motsvarar cirka 5 % av testerna, inte en patient.", recent: "Triangel: senaste resultaten", count: "utan resistens", planned: "Planerat" },
  }[LANG];
  $("drug-key").innerHTML = `<p>${keyCopy.title}</p><div class="legend"><span><i style="background:var(--ink)"></i>${keyCopy.no}</span><span><i style="background:var(--accent)"></i>${keyCopy.yes}</span></div><p class="key-detail">${keyCopy.dots}<br>${keyCopy.recent} · ${Profile.recentLabel(AB.recent_weeks || 4)}</p>`;
  $("drugs").innerHTML = AB.drugs.map((d, k) => {
    const main = d.year, sN = Math.round(main.share * 20);
    const dots = Array.from({ length: 20 }, (_, i) => `<i class="${i < sN ? "s" : "r"}" style="left:${i * 5}%;transition-delay:${i * 18}ms"></i>`).join("");
    const r = d.recent, few = r.n < 30;
    const mark = r.n ? `<span class="mark4 ${few ? "few" : ""}" style="left:calc(${(r.share * 100).toFixed(1)}% - 0px)" title="${Profile.recentLabel(AB.recent_weeks || 4)}: ${r.s} of ${r.n}"></span>` : "";
    const src = d.source === "ward" ? wardName(AB.ward) : t("allWards");
    const rowCopy = {
      en: { source: "Lab results", prior: "Previously resistant in this patient", fallback: "Too few ward results; using hospital data" },
      fi: { source: "Laboratoriotulokset", prior: "Aiempi resistentti löydös tällä potilaalla", fallback: "Liian vähän osaston tuloksia; käytössä sairaalan tiedot" },
      sv: { source: "Laboratorieresultat", prior: "Tidigare resistent fynd hos patienten", fallback: "För få resultat på avdelningen; sjukhusets data används" },
    }[LANG] || { source: "Lab results", prior: "Previously resistant in this patient", fallback: "Too few ward results; using hospital data" };
    const previous = resistedBefore(d.code);
    return `<button class="drow ${d.code === F.drug ? "sel" : ""} ${plan === d.code ? "plan" : plan ? "alt" : ""}" data-drug="${d.code}" aria-pressed="${plan === d.code}" style="animation-delay:${k * 35}ms">
      <span class="nm"><b>${cap(drugName(d.code, d.name))}<span class="plan-label" ${plan === d.code ? "" : "hidden"}>${keyCopy.planned}</span>${d.changed ? `<span class="tag">${t("changed")}</span>` : ""}</b><small>${rowCopy.source}: ${src}</small>${d.source !== "ward" && AB.ward ? `<small class="source-note">${rowCopy.fallback}</small>` : ""}${previous ? `<em class="before"><span>${rowCopy.prior}</span><span>${previous}</span></em>` : ""}</span>
      <span class="dots" aria-hidden="true">${dots}${mark}</span>
      <span class="pct"><b>${pct(main.share)}</b><small>${fmt(main.s)} ${t("of")} ${fmt(main.n)}<span class="count-label">${keyCopy.count}</span></small>${d.changed && r.n ? `<em class="wk4">${Profile.recentLabel(AB.recent_weeks || 4, true)}: ${fmt(r.s)} ${t("of")} ${fmt(r.n)}</em>` : ""}</span></button>`;
  }).join("");
}
const cap = s => s[0].toUpperCase() + s.slice(1);
const NATURAL = { NIT: ["P. mirabilis"], AMP: ["K. pneumoniae", "K. oxytoca", "C. freundii", "P. aeruginosa"], CRO: ["P. aeruginosa"], TMP: ["P. aeruginosa"] };   // naturally resistant (EUCAST expected phenotypes)
function drawGrows() {
  const el = $("grows"); if (!el) return; const w = el.clientWidth || 340, h = 220;
  const contextCopy = {
    en: { title: "Bacteria found in samples", period: "Past 12 months to", group: "Selected age and sex" },
    fi: { title: "Näytteistä löydetyt bakteerit", period: "Edeltävät 12 kuukautta, päättyen", group: "Valittu ikä ja sukupuoli" },
    sv: { title: "Bakterier som hittats i prover", period: "Senaste 12 månaderna till", group: "Vald ålder och kön" },
  }[LANG];
  $("grows-title").textContent = contextCopy.title;
  $("grows-context").textContent = `${AB.ward ? wardName(AB.ward) : t("allWards")} · ${specName(AB.spec)} · ${contextCopy.group}. ${contextCopy.period} ${niceDate(AB.asof)}.`;
  const root = d3.pack().size([w, h]).padding(4)(d3.hierarchy({ children: AB.organisms }).sum(d => d.n));
  el.innerHTML = ""; const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  const selectOrganism = name => { F.org = F.org === name ? "" : name; if (PT) { F.patient = ""; PT = null; } saveF(); renderSentence(); loadDoctor(); };
  const g = svg.selectAll("g").data(root.leaves()).join("g").attr("class", "bub").attr("transform", d => `translate(${d.x},${d.y})`)
    .attr("data-organism", d => d.data.name).attr("role", "button").attr("tabindex", 0)
    .attr("aria-label", d => `${d.data.name}, ${pct(d.data.share)}`).attr("aria-pressed", d => String(F.org === d.data.name))
    .on("click", (e, d) => selectOrganism(d.data.name))
    .on("keydown", (e, d) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); selectOrganism(d.data.name); } });
  g.append("circle").attr("r", 0).attr("fill", d => F.org === d.data.name ? css("--organism-soft") : css("--sheet-2")).attr("stroke", d => F.org === d.data.name ? css("--organism") : css("--line"))
    .attr("stroke-width", d => F.org === d.data.name ? 2 : (css("--bw") || 1)).transition().duration(reduceMotion() ? 0 : 700).delay((d, i) => reduceMotion() ? 0 : i * 50).ease(d3.easeBackOut).attr("r", d => d.r);
  g.filter(d => d.r > 20).append("text").attr("text-anchor", "middle").attr("dy", "-.1em").style("fill", d => F.org === d.data.name ? css("--organism") : css("--ink")).text(d => d.data.short);
  g.filter(d => d.r > 20).append("text").attr("text-anchor", "middle").attr("dy", "1.2em").style("fill", d => F.org === d.data.name ? css("--organism") : css("--ink-3")).text(d => pct(d.data.share));
  g.append("title").text(d => `${d.data.name}: ${pct(d.data.share)} of samples · click to see drugs for it`);
  const cap2 = document.createElement("p"); cap2.className = "muted"; cap2.style.margin = "4px 0 0";
  cap2.textContent = F.org ? t("growsShowing", { org: F.org }) : t("growsHint");
  el.append(cap2);
}
function renderEvidence() {
  const d = AB && AB.drugs.find(x => x.code === F.drug), el = $("evcard");
  if (!d) { el.innerHTML = ""; return; }
  const y = d.year, r = d.recent, ward = META.wards.find(w => w.code === AB.ward);
  const where = d.source === "ward" ? wardName(ward.code) : t("allWards") + (AB.ward ? ` (${t("onlyTested", { n: d.ward_n, ward: AB.ward })})` : "");
  const dn = drugName(d.code, d.name);
  const coverage = {
    en: { narrow: "Covers fewer types of bacteria (narrow spectrum).", moderate: "Covers an intermediate range of bacteria (moderate spectrum).", broad: "Covers many types of bacteria (broad spectrum).", reserve: "Classified as a reserve antibiotic." },
    fi: { narrow: "Tehoaa harvempiin bakteerityyppeihin (kapeakirjoinen).", moderate: "Tehoaa kohtalaiseen määrään bakteerityyppejä.", broad: "Tehoaa moniin bakteerityyppeihin (laajakirjoinen).", reserve: "Luokiteltu vara-antibiootiksi." },
    sv: { narrow: "Täcker färre bakterietyper (smalt spektrum).", moderate: "Täcker ett mellanstort urval av bakterier.", broad: "Täcker många bakterietyper (brett spektrum).", reserve: "Klassificerat som reservantibiotikum." },
  }[LANG]?.[d.spectrum] || "";
  el.innerHTML = `<div class="ev-card"><h3>${cap(dn)}</h3>
    ${coverage ? `<p class="drug-coverage">${coverage}</p>` : ""}
    <div class="big">${pct(y.share)}</div>
    <p>${t("killedSentence", { s: fmt(y.s), n: fmt(y.n), drug: dn, where })}</p>
    <div class="range"><span class="track"></span><span class="ci" style="left:${y.ci[0] * 100}%;width:${(y.ci[1] - y.ci[0]) * 100}%"></span><span class="eighty" style="left:80%"></span><span class="pt" style="left:${y.share * 100}%"></span>
      <small style="left:0">0%</small><small style="right:0">100%</small></div>
    <p style="margin-top:14px">${Profile.recentLabel(AB.recent_weeks || 4) + ":"} ${r.n ? `<b>${r.s} ${t("of")} ${r.n}</b> (${pct(r.share)})${r.n < 30 ? t("tooFew") : ""}${d.changed ? `. <b style="color:var(--accent)">${t("differs")}</b>` : "."}` : t("noTests")}</p>
    <div class="spark" id="spark"></div>
    ${y.resisted_by.length ? `<p>${t("survivedMost")} ${y.resisted_by.map(([o, n]) => `<b>${o}</b> ${n}${NATURAL[d.code]?.includes(o) ? ` <span class="muted">${t("always")}</span>` : ""}`).join(" · ")}</p>` : ""}
    ${resistedBefore(d.code) ? `<p class="warnline">${t("ptSurvived", { drug: dn, when: resistedBefore(d.code) })}</p>` : ""}
    <p class="caveat">${t("caveat")}</p>
    <div id="kn"></div>
  </div>`;
  drawSpark(d); placeEvidence();
  loadKnowledge(d.code);
}
function drawSpark(d) {
  const el = $("spark"), w = el.clientWidth || 340, h = 70, pts = d.monthly.map(([n, s], i) => ({ i, n, v: n ? s / n : null }));
  const x = d3.scaleLinear().domain([0, 11]).range([6, w - 6]), y = d3.scaleLinear().domain([Math.min(.5, d3.min(pts, p => p.v ?? 1) - .05), 1]).range([h - 16, 6]);
  const rr = d3.scaleSqrt().domain([0, d3.max(pts, p => p.n) || 1]).range([1.5, 5]);
  el.innerHTML = ""; const svg = d3.select(el).append("svg").attr("viewBox", `0 0 ${w} ${h}`);
  svg.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(.8)).attr("y2", y(.8)).attr("stroke", css("--accent")).attr("stroke-dasharray", "3 4").attr("opacity", .5);
  const line = d3.line().defined(p => p.v != null).x(p => x(p.i)).y(p => y(p.v)).curve(d3.curveMonotoneX);
  const path = svg.append("path").datum(pts).attr("d", line).attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 1.5);
  const L = path.node().getTotalLength(); path.attr("stroke-dasharray", L).attr("stroke-dashoffset", L).transition().duration(900).attr("stroke-dashoffset", 0);
  svg.selectAll("circle.m").data(pts.filter(p => p.v != null)).join("circle").attr("cx", p => x(p.i)).attr("cy", p => y(p.v)).attr("r", p => rr(p.n)).attr("fill", p => p.v < .8 ? css("--accent") : css("--ink"))
    .append("title").text(p => `${p.n} tested`);
  svg.append("text").attr("x", 0).attr("y", h - 2).attr("font-size", 11).attr("fill", css("--ink-3")).text(t("monthsAgo"));
  svg.append("text").attr("x", w).attr("y", h - 2).attr("text-anchor", "end").attr("font-size", 11).attr("fill", css("--ink-3")).text(t("now"));
}

// ---------- hygiene: the morning brief. Only what changed; each element answers one question and opens its evidence. ----------
let BR = null, BR_RAW = null;   // BR is BR_RAW after the floating filters (filters.js)
const longDate = s => new Date(s + "T00:00").toLocaleDateString(loc(), { weekday: "long", day: "numeric", month: "long", year: "numeric" });
async function renderBrief() {
  const p = $("page");
  p.innerHTML = `<div class="dhead brief-head"><div><h1>${t("briefTitle")}</h1><p id="bsub"></p></div>${exportBar("brief")}</div>
    <section class="mb" id="mb"></section>
    <div class="bgrid" id="bgrid">${Array.from({ length: 5 }, () => `<div class="bcard"><div class="skel" style="height:180px"></div></div>`).join("")}</div>`;
  BR_RAW = await api("/api/app/brief"); if (VIEW === "brief") paintBrief();
}
function paintBrief() {
  BR = typeof filterBrief === "function" ? filterBrief(BR_RAW) : BR_RAW;
  $("bsub").textContent = `${longDate(BR.today)} · ${t("sinceYesterday")} · ${BR.source === "feed" ? t("liveFeed") : t("dataUpTo", { d: niceDate(BR.today) })}`;
  $("bgrid").innerHTML = `
    <section class="bcard wide" id="b-new"></section>
    <section class="bcard" id="b-clusters"></section>
    <section class="bcard" id="b-wards"></section>
    <section class="bcard" id="b-trends"></section>
    <section class="bcard" id="b-health"></section>
    <section class="bcard wide" id="b-notes"></section>`;
  briefNew(); briefClusters(); briefWards(); briefTrends(); briefHealth(); briefNotes();
  if (typeof morningTop === "function") morningTop(BR);
}
const bhead = (q, big, sub = "") => `<h3 class="bq">${q}</h3><div class="bbig">${big}</div>${sub ? `<p class="bsub">${sub}</p>` : ""}`;

// 1 · new cases since yesterday: one dot per case on its ward; filled = sampled on day 3 or later of the stay
function briefNew() {
  const el = $("b-new"), cs = BR.new_cases, col = TYPE_COL(), hosp = cs.filter(c => (c.hday || 0) >= 3).length;
  el.innerHTML = bhead(t("bNewQ"), cs.length ? t("bNewBig", { n: cs.length }) : t("bNewNone"), cs.length ? t("bNewSub", { h: hosp }) : "") + `<div class="bnew" id="bnewsvg"></div><ul class="blist" id="bnewlist"></ul>`;
  const W = 900, H = 120, wards = META.wards.map(w => w.code), x = d3.scaleBand().domain(wards).range([0, W]).padding(.1);
  const svg = d3.select("#bnewsvg").append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  svg.selectAll("line.base").data(wards).join("line").attr("x1", w => x(w)).attr("x2", w => x(w) + x.bandwidth()).attr("y1", H - 26).attr("y2", H - 26).attr("stroke", css("--line"));
  svg.selectAll("text.wl").data(wards).join("text").attr("class", "maplab").attr("x", w => x(w) + x.bandwidth() / 2).attr("y", H - 8).attr("text-anchor", "middle").text(w => w);
  const per = d3.group(cs, c => c.ward);
  wards.forEach(w => (per.get(w) || []).forEach((c, i) => {
    const hospital = (c.hday || 0) >= 3, cx = x(w) + x.bandwidth() / 2 + ((i % 4) - 1.5) * 16, cy = H - 40 - Math.floor(i / 4) * 16;
    svg.append("circle").attr("cx", cx).attr("cy", cy).attr("r", 0).attr("fill", hospital ? col[c.flags[0]] : css("--paper")).attr("stroke", col[c.flags[0]]).attr("stroke-width", 2).attr("data-type", c.flags[0]).style("cursor", "default")
      .transition().delay(i * 60).duration(500).ease(d3.easeBackOut).attr("r", 6);
  }));
  $("bnewlist").innerHTML = cs.slice(0, 8).map(c => `<li><b>${c.ward}</b><span>${c.short} · ${c.flags.map(typeWord).join(" ")}</span><em>${c.hday ? t("wDay", { d: c.hday }) : t("bOutpatient")}</em></li>`).join("");
}
// 2 · clusters: new, growing, stable or over, with days since the last case
function briefClusters() {
  const el = $("b-clusters"), cl = BR.clusters, active = cl.filter(c => c.status !== "over").length;
  el.innerHTML = bhead(t("bClusterQ"), active ? t("bClusterBig", { n: active }) : t("bClusterNone")) + `<div class="bclusters">${cl.slice(0, 5).map((c, k) =>
    `<button class="bcl" data-fp="${c.key}"><span class="st st-${c.status}" style="color:${c.status === "over" ? css("--ink-3") : css("--accent")}">${t("cl_" + c.status)}</span><span class="nm"><b>${c.organism}</b> ${c.flags.map(typeWord).join(" ")}<small>${t("bClusterLine", { n: c.n, d: c.since, w: c.wards.join(", ") })}</small></span><span class="spark60" id="cls${k}"></span></button>`).join("")}</div>`;
  cl.slice(0, 5).forEach((c, k) => {
    const W = 180, H = 26, x = d3.scaleLinear().domain([0, 59]).range([4, W - 4]);
    const svg = d3.select(`#cls${k}`).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    svg.append("line").attr("x1", 0).attr("x2", W).attr("y1", H - 6).attr("y2", H - 6).attr("stroke", css("--line"));
    c.daily.forEach((n, i) => { for (let j = 0; j < n; j++) svg.append("circle").attr("cx", x(i)).attr("cy", H - 10 - j * 6).attr("r", 2.6).attr("fill", c.status === "over" ? css("--ink-3") : css("--accent")); });
  });
  el.querySelectorAll(".bcl").forEach(b => b.onclick = () => { WS.fp = b.dataset.fp; WS.ward = null; WS.win = null; go("wards"); });
}
// 3 · wards against their own normal: this period's count over the usual band; colour only with 3 or more cases
function briefWards() {
  const el = $("b-wards"), ws = [...BR.all_wards].sort((a, b) => b.z - a.z), above = BR.wards;
  el.innerHTML = bhead(t("bWardsQ"), above.length ? t("bWardsBig", { w: above.map(w => w.code).join(", ") }) : t("bWardsNone"), t("bWardsSub")) + `<div id="bwardsvg"></div>`;
  const W = 420, rh = 26, H = ws.length * rh + 20, max = Math.max(6, d3.max(ws, w => Math.max(w.recent, w.expected + 2 * Math.sqrt(w.expected + .5))));
  const x = d3.scaleLinear().domain([0, max]).range([70, W - 30]);
  const svg = d3.select("#bwardsvg").append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  ws.forEach((w, i) => {
    const y = 10 + i * rh, lo = Math.max(0, w.expected - 2 * Math.sqrt(w.expected + .5)), hi = w.expected + 2 * Math.sqrt(w.expected + .5);
    const flagged = w.recent >= 3 && w.z > 2;
    const g = svg.append("g").style("cursor", "pointer").on("click", () => { WS.ward = w.code; WS.fp = null; WS.win = null; go("wards"); });
    g.append("text").attr("class", "maplab").attr("x", 0).attr("y", y + 12).text(w.code);
    g.append("rect").attr("x", x(lo)).attr("width", Math.max(2, x(hi) - x(lo))).attr("y", y + 2).attr("height", 14).attr("rx", 7).attr("fill", css("--sheet-2"));
    g.append("line").attr("x1", x(w.expected)).attr("x2", x(w.expected)).attr("y1", y).attr("y2", y + 18).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "2 2");
    g.append("circle").attr("cx", x(0)).attr("cy", y + 9).attr("r", 6).attr("fill", flagged ? css("--accent") : w.recent < 3 ? css("--paper") : css("--ink")).attr("stroke", flagged ? css("--accent") : css("--ink-2"))
      .transition().duration(700).ease(d3.easeCubicOut).attr("cx", x(w.recent));
    g.append("text").attr("class", flagged ? "maplab acc" : "maplab").attr("x", W).attr("y", y + 13).attr("text-anchor", "end").text(w.recent);
  });
}
// 4 · slow trends: two years of resistant share, version changes marked; flagged only when clearly beyond chance with enough tests
function briefTrends() {
  const el = $("b-trends"), tr = BR.trends, crossed = tr.filter(x => x.crossed);
  el.innerHTML = bhead(t("bTrendsQ"), crossed.length ? t("bTrendsBig", { n: crossed.length }) : t("bTrendsNone"), t("bTrendsSub")) + `<div class="btrends">${tr.map((x, k) =>
    `<div class="btr ${x.crossed ? "on" : ""}"><span class="nm"><b>${x.organism}</b> · ${drugName(x.drug)}${x.spec ? ` · ${specName(x.spec)}` : ""}<small>${pct(x.now)} ${t("of")} ${fmt(x.n_now)} · ${t("bYearAgo")} ${pct(x.before)}</small></span><span id="btr${k}"></span></div>`).join("")}</div>`;
  tr.forEach((x, k) => {
    const W = 200, H = 40, pts = x.series.map((m, i) => ({ i, v: m.n >= 10 ? m.r / m.n : null, n: m.n, month: m.month }));
    const vals = pts.filter(p => p.v != null).map(p => p.v), sx = d3.scaleLinear().domain([0, 23]).range([2, W - 2]);
    const sy = d3.scaleLinear().domain([Math.max(0, d3.min(vals) - .03), d3.max(vals) + .03]).range([H - 4, 4]);
    const svg = d3.select(`#btr${k}`).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    BR.versions.forEach(v => { const i = pts.findIndex(p => p.month === v.from); if (i >= 0) svg.append("line").attr("x1", sx(i)).attr("x2", sx(i)).attr("y1", 0).attr("y2", H).attr("stroke", css("--violet")).attr("stroke-dasharray", "2 3").append("title").text(v.version); });
    svg.append("path").datum(pts).attr("fill", "none").attr("stroke", x.crossed ? css("--accent") : css("--ink-2")).attr("stroke-width", 1.6)
      .attr("d", d3.line().defined(p => p.v != null).x(p => sx(p.i)).y(p => sy(p.v)).curve(d3.curveMonotoneX));
  });
}
// 5 · data health: samples per ward per day against usual; empty days marked, results still pending, late batches
function briefHealth() {
  const el = $("b-health"), hs = BR.health, gaps = hs.filter(h => h.missing_days), late = Object.entries(BR.late);
  const big = gaps.length ? t("bHealthGaps", { w: gaps.map(h => h.ward).join(", ") }) : late.length ? t("bHealthLate", { w: late.map(([w]) => w).join(", ") }) : t("bHealthOk");
  el.innerHTML = bhead(t("bHealthQ"), big, t("bHealthSub")) + `<div id="bhsvg"></div>${BR.versions.length ? `<p class="bsub">${t("bVersion", { v: BR.versions[BR.versions.length - 1].version, m: BR.versions[BR.versions.length - 1].from })}</p>` : ""}`;
  const W = 460, rh = 22, H = hs.length * rh + 6, x = d3.scaleBand().domain(d3.range(14)).range([56, W - 130]).padding(.18);
  const svg = d3.select("#bhsvg").append("svg").attr("viewBox", `0 0 ${W} ${H}`);
  hs.forEach((h, i) => {
    const y = i * rh, max = Math.max(3, d3.max(h.days, d => Math.max(d.n, d.usual)));
    svg.append("text").attr("class", "maplab").attr("x", 0).attr("y", y + 14).text(h.ward);
    h.days.forEach((d, k) => {
      const missing = d.n === 0 && d.usual >= 2, bh = Math.max(1.5, d.n / max * 16);
      svg.append("rect").attr("x", x(k)).attr("width", x.bandwidth()).attr("y", y + 18 - bh).attr("height", bh).attr("rx", 1).attr("fill", missing ? "none" : css("--ink-3"))
        .attr("stroke", missing ? css("--amber") : "none").attr("stroke-dasharray", missing ? "2 2" : null).append("title").text(`${niceDate(d.day)}: ${d.n} · ${t("wUsual")} ${d.usual}`);
      if (missing) svg.append("rect").attr("x", x(k)).attr("width", x.bandwidth()).attr("y", y + 2).attr("height", 16).attr("rx", 2).attr("fill", "none").attr("stroke", css("--amber")).attr("stroke-dasharray", "2 2");
    });
    const extra = [h.pending ? t("bPending", { n: h.pending }) : "", BR.late[h.ward] ? t("bLate", { n: BR.late[h.ward] }) : ""].filter(Boolean).join(" · ");
    if (extra) svg.append("text").attr("class", BR.late[h.ward] ? "maplab amb" : "maplab").attr("x", W).attr("y", y + 14).attr("text-anchor", "end").text(extra);
  });
}
// 6 · from colleagues: de-identified ward knowledge
function briefNotes() {
  const el = $("b-notes"), ns = BR.notes;
  el.innerHTML = bhead(t("bNotesQ"), ns.length ? t("bNotesBig", { n: ns.length }) : t("bNotesNone")) + (ns.length ? `<ul class="notes">${ns.map(r => `<li>${shareText({ ...r.fields, ward: r.fields.ward || "", sample: r.fields.sample || "" })}<small>${t("deid")} · ${r.fields.month}</small></li>`).join("")}</ul>` : "");
}

// ---------- export: HTML file or PDF, built from the view's data in export.js (exportView), never a copy of the screen ----------
const EXPORT_ICON = '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>';
function exportBar(name) { return `<div class="exportbar" data-export="${name}"><span>${EXPORT_ICON}</span><button data-exp="html">HTML</button><button data-exp="pdf">PDF</button></div>`; }
$("page").addEventListener("click", e => { const b = e.target.closest("[data-exp]"); if (!b) return; exportView(b.dataset.exp, b.closest("[data-export]").dataset.export); });

// ---------- hygiene: ward overview. Three linked views; every interaction is a filter. ----------
const HYG = Object.assign({ types: ["ESBL", "MRSA", "VRE", "CPE"], windowWeeks: 4, home: "" }, store.get("rl-hyg", {}));   // defaults live in Settings
const WS = { ward: null, win: null, fp: null, hoverWard: null, hoverFp: null, hoverType: null, wardChosen: false };   // what is selected
const wardEsc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const profileWardForView = () => SESSION.role === 'hygiene' ? HYG.home : SESSION.ward || '';
function chooseOverviewWard(code) {
  WS.ward = code || null; WS.wardChosen = true; WS.fp = null; WS.hoverWard = null; WS.hoverFp = null; drawFingerprints.last = null;
  drawWards();
}
let WD = null;
const TYPE_COL = () => ({ ESBL: css("--accent"), MRSA: css("--violet"), VRE: css("--amber"), CPE: css("--cool") });
// the colour key lives in the words: each resistance type is written in its own colour, and lights up when its marks are hovered
const typeWord = tp => `<span class="tw" data-type="${tp}" style="--c:${TYPE_COL()[tp] || css("--ink")}">${tp}</span>`;
const markTypes = () => document.querySelectorAll("#page .tw").forEach(w => { w.classList.toggle("on", WS.hoverType === w.dataset.type); w.classList.toggle("off", !!WS.hoverType && WS.hoverType !== w.dataset.type); });
// a schematic hospital: the wards inside, the two health centres outside; fixed places so the picture never jumps
const PLACE = { ICU: [300, 96], SURG: [168, 150], URO: [432, 150], "MED-A": [196, 252], "MED-B": [404, 252], GER: [300, 196], ED: [300, 318], "PHC-N": [62, 84], "PHC-S": [538, 330] };
async function renderWards() {
  const p = $("page");
  p.innerHTML = `<div class="dhead brief-head"><div><h1>${t("wardsTitle")}</h1><p id="wsum"></p></div>${exportBar("wards")}</div>
    <div class="ward-scope"><label for="ward-view-select">Viewing<select id="ward-view-select"><option value="">All wards</option>${META.wards.map(w => `<option value="${wardEsc(w.code)}">${wardEsc(wardName(w.code))}</option>`).join('')}</select></label><button id="ward-view-clear" class="ward-action" hidden>Clear ward selection</button>${profileWardForView() ? `<button id="ward-view-profile" class="ward-action">Show my ward: ${wardEsc(wardName(profileWardForView()))}</button>` : ''}<p id="ward-scope-note"></p></div>
    <section class="wq"><p class="ward-chart-context" id="ward-time-context"></p><details class="ward-date-controls" id="ward-date-controls"><summary>Change date range</summary><div><label>From<input type="date" id="ward-date-from"></label><label>Through<input type="date" id="ward-date-to"></label><button class="ward-action" id="ward-date-apply">Apply date range</button><button class="ward-action" id="ward-date-reset">Recent ${HYG.windowWeeks} weeks</button></div><p>Changes this chart only. The range follows the weekly intervals shown below.</p></details><figure class="wtime"><div id="wtime"></div></figure></section>
    <div class="wgrid"><section class="wq wmap"><p class="ward-map-context">Hospital comparison · select a ward name or circle to filter the timeline and patterns.</p><div id="wmap"></div><p class="ward-hover-info" id="ward-hover-info" aria-live="polite"></p><p class="wleg">${t("wMapLegend")}</p></section>
      <section class="wq wfp"><div class="ward-pattern-head"><p class="ward-chart-context" id="ward-pattern-context"></p><button id="ward-pattern-clear" class="ward-action" hidden>Clear pattern</button></div><div id="wfp"></div></section></div>`;
  $('ward-view-select').onchange = e => chooseOverviewWard(e.target.value);
  $('ward-view-clear').onclick = () => chooseOverviewWard(null);
  if ($('ward-view-profile')) $('ward-view-profile').onclick = () => chooseOverviewWard(profileWardForView());
  $('ward-pattern-clear').onclick = () => { WS.fp = null; WS.hoverFp = null; drawWards(); };
  ['ward-date-from','ward-date-to'].forEach(id => $(id).oninput = () => { $('ward-date-controls').dataset.dirty = 'true'; $('ward-date-to').setCustomValidity(''); });
  $('ward-date-apply').onclick = () => {
    const from = $('ward-date-from'), to = $('ward-date-to');
    to.setCustomValidity(from.value > to.value ? 'Choose an end date on or after the start date.' : '');
    if (!from.reportValidity() || !to.reportValidity() || !from.value || !to.value) return;
    const start = Date.parse(WD.start+'T00:00:00Z'), a = Math.max(0, Math.min(WD.weeks-1, Math.floor((Date.parse(from.value+'T00:00:00Z')-start)/6048e5))), b = Math.max(a, Math.min(WD.weeks-1, Math.floor((Date.parse(to.value+'T00:00:00Z')-start)/6048e5)));
    WS.win = [a,b]; WS.preview = null; delete $('ward-date-controls').dataset.dirty; drawWards();
  };
  $('ward-date-reset').onclick = () => { WS.win = null; WS.preview = null; delete $('ward-date-controls').dataset.dirty; drawWards(); };
  $("wmap").innerHTML = `<div class="skel" style="height:360px"></div>`;
  const data = await api(`/api/app/wards?types=${HYG.types.join(",").toLowerCase()}`);
  if (VIEW !== 'wards') return;
  WD = data; drawFingerprints.last = null;
  if (HYG.home && !WS.ward && !WS.wardChosen) WS.ward = HYG.home;
  drawWards(true);
}
// step the window a week at a time with the arrow keys
addEventListener("keydown", e => {
  if (VIEW !== "wards" || !WD || !["ArrowLeft", "ArrowRight"].includes(e.key) || e.target.closest("input, textarea, select, button, [role=button]")) return;
  const w = winNow(), len = w[1] - w[0], d = e.key === "ArrowLeft" ? -1 : 1, a = Math.max(0, Math.min(WD.weeks - 1 - len, w[0] + d));
  WS.win = [a, a + len]; drawWards();
});
const wkOf = d => Math.min(WD.weeks - 1, Math.floor((new Date(d) - new Date(WD.start)) / 6048e5));
const winNow = () => WS.preview || WS.win || [WD.weeks - HYG.windowWeeks, WD.weeks - 1];
const winSet = () => WS.win || [WD.weeks - HYG.windowWeeks, WD.weeks - 1];
const wardWindowEnd = win => win[1] === WD.weeks - 1 ? WD.asof : new Date(Date.parse(WD.start+'T00:00:00Z')+(win[1]+1)*6048e5-864e5).toISOString().slice(0,10);
function casesIn({ ward = WS.ward, fp = WS.fp, win = winNow() } = {}) {
  return WD.cases.filter(c => { const k = wkOf(c.date); return k >= win[0] && k <= win[1] && (!ward || c.ward === ward) && (!fp || c.fp + c.short === fp); });
}
const MIN_CASES = 3;   // below this a ward is never coloured or called unusual
const winZ = (w, n, win) => { const exp = w.expected / 4 * (win[1] - win[0] + 1); return (n - exp) / Math.sqrt(Math.max(exp, .5)); };
function drawWards(first) { if (!$('wmap') || !WD) return; $("page").classList.toggle("previewing", !!WS.preview); drawSummary(); drawMap(first); drawTimeline(first); drawFingerprints(); markTypes(); wardHoverContext(); }
function wardHoverContext() {
  const code = WS.hoverWard, el = $('ward-hover-info'); if (!el) return;
  $('ward-time-context').textContent = `New resistant cases over time · ${WS.ward ? wardName(WS.ward) : 'All wards'}${code && code !== WS.ward ? ` · Preview outline: ${wardName(code)}` : ''}`;
  if (!code) { el.textContent = 'Hover a ward to preview its counts and timeline. Click to keep that ward selected.'; return; }
  const w = WD.wards.find(w => w.code === code), win = winNow(), n = casesIn({ ward: code, fp: null, win }).length;
  el.innerHTML = `<strong>${wardEsc(wardName(code))}</strong> · ${n} new resistant cases in this window; usually about ${(w.expected / 4 * (win[1] - win[0] + 1)).toFixed(1)}. ${WS.ward === code ? 'Selected ward.' : 'Preview only. Click to select.'}`;
}
function drawSummary() {
  const win = winNow(), from = new Date(new Date(WD.start).getTime() + win[0] * 6048e5), to = new Date(wardWindowEnd(win)+'T00:00:00Z');
  const zs = WD.wards.map(w => ({ ...w, wz: winZ(w, casesIn({ ward: w.code, fp: null, win }).length, win), n: casesIn({ ward: w.code, fp: null, win }).length }));
  const top = zs.sort((a, b) => b.wz - a.wz)[0]; top.recent = top.n; top.z = top.wz; top.expected = top.expected / 4 * (win[1] - win[0] + 1);
  const n = casesIn({ ward: WS.ward }).length;
  $("wsum").innerHTML = `${WS.preview ? `<span class="pvtag">${t("preview")}</span>` : ""}${HYG.types.map(typeWord).join(", ")} · <button class="ward-date-link" id="ward-summary-dates" aria-controls="ward-date-controls" aria-label="Change chart date range: ${wardEsc(niceDate(from.toISOString().slice(0, 10)))} – ${wardEsc(niceDate(to.toISOString().slice(0, 10)))}">${niceDate(from.toISOString().slice(0, 10))} – ${niceDate(to.toISOString().slice(0, 10))}</button>. ` +
    (WS.ward ? `<button class="ward-summary-pick" data-overview-ward="${wardEsc(WS.ward)}">${wardEsc(wardName(WS.ward))}</button>: ${n} ${t("wCases")}${WS.fp ? ' matching the selected pattern' : ''}.` : top.z > 2 && top.recent >= MIN_CASES ? t("wMost", { ward: `<button class="ward-summary-pick" data-overview-ward="${wardEsc(top.code)}">${wardEsc(wardName(top.code))}</button>`, n: top.recent, e: top.expected.toFixed(1) })
      : zs.every(w => w.n < MIN_CASES) ? t("wFew") : t("wCalm"));
  $('wsum').querySelectorAll('[data-overview-ward]').forEach(b => b.onclick = () => chooseOverviewWard(WS.ward === b.dataset.overviewWard ? null : b.dataset.overviewWard));
  $('ward-summary-dates').onclick = () => { $('ward-date-controls').open = true; $('ward-date-controls').scrollIntoView({block:'nearest', behavior:reduceMotion()?'auto':'smooth'}); $('ward-date-from').focus({preventScroll:true}); };
  if (!$('ward-date-controls').dataset.dirty && !WS.preview) {
    const range = winSet();
    ['ward-date-from','ward-date-to'].forEach(id => { $(id).min=WD.start; $(id).max=WD.asof; $(id).required=true; });
    $('ward-date-from').value = new Date(new Date(WD.start).getTime()+range[0]*6048e5).toISOString().slice(0,10);
    $('ward-date-to').value = wardWindowEnd(range);
  }
  $('ward-view-select').value = WS.ward || ''; $('ward-view-clear').hidden = !WS.ward;
  const profile = profileWardForView();
  if ($('ward-view-profile')) $('ward-view-profile').hidden = WS.ward === profile;
  $('ward-scope-note').textContent = WS.ward ? `Timeline and patterns show ${wardName(WS.ward)}. The map keeps all wards visible for comparison.` : `Comparing all wards.${profile ? ` Your profile ward is ${wardName(profile)}; use “Show my ward” to focus on it.` : ''}`;
  $('ward-time-context').textContent = `New resistant cases over time · ${WS.ward ? wardName(WS.ward) : 'All wards'}${WS.hoverWard && WS.hoverWard !== WS.ward ? ` · Preview outline: ${wardName(WS.hoverWard)}` : ''}`;
  $('ward-pattern-context').textContent = `Bacteria and resistance patterns · ${WS.ward ? wardName(WS.ward) : 'All wards'}`;
  $('ward-pattern-clear').hidden = !WS.fp;
}
// the map: size is how many samples a ward sends, colour is how far it sits above its own normal, curves are shared patients.
// Layout: a small force simulation. Wards that share more patients (for their size) pull together, labels get room,
// and gentle anchors keep the hospital inside and the health centres outside. Run to rest before drawing: nothing jitters.
const HC = new Set(["PHC-N", "PHC-S"]);
let MAPL = null;   // { key, pos, ties, r }
function mapTies() {
  // tie strength: shared patients relative to both wards' size, so big wards don't tie to everything
  const vol = Object.fromEntries(WD.wards.map(w => [w.code, d3.sum(w.volume)]));
  const ties = WD.links.map(l => ({ ...l, s: l.n / Math.sqrt(vol[l.a] * vol[l.b]) }));
  const smax = d3.max(ties, l => l.s); ties.forEach(l => l.sn = l.s / smax);
  const top = (code, k) => ties.filter(l => l.a === code || l.b === code).sort((a, b) => b.s - a.s).slice(0, k);
  const shown = new Set(WD.wards.flatMap(w => top(w.code, 2)));   // the backbone: each ward's two strongest ties
  return { ties, top, shown };
}
function mapLayout(focus, prev) {
  const vmax = d3.max(WD.wards, w => d3.sum(w.volume)), r = d3.scaleSqrt().domain([0, vmax]).range([14, 44]);
  const { ties, top, shown } = MAPL && MAPL.ties ? MAPL.tiesAll : mapTies();
  const near = new Set(focus ? top(focus, 3) : []);
  const nodes = WD.wards.map(w => {
    const a = PLACE[w.code] || [300, 200], p = prev && prev[w.code] || a;
    return { code: w.code, r: r(d3.sum(w.volume)), ax: a[0], ay: a[1], x: p[0], y: p[1] };
  });
  const links = ties.filter(l => shown.has(l) || near.has(l)).map(l => ({ source: l.a, target: l.b, sn: l.sn, focus: near.has(l) }));
  const sim = d3.forceSimulation(nodes).randomSource(d3.randomLcg(7)).stop()
    .force("link", d3.forceLink(links).id(d => d.code).distance(l => l.source.r + l.target.r + (l.focus ? 30 : 60)).strength(l => l.focus ? .55 : .08 + .14 * l.sn))
    .force("collide", d3.forceCollide(d => d.r + 22).iterations(4))     // room for the label under each node
    .force("x", d3.forceX(d => d.ax).strength(d => HC.has(d.code) ? .3 : .1))
    .force("y", d3.forceY(d => d.ay).strength(d => HC.has(d.code) ? .3 : .1))
    .force("outside", () => {   // health centres keep clear of the hospital's outline; only they move
      for (const h of nodes) if (HC.has(h.code)) for (const w of nodes) if (!HC.has(w.code)) {
        const dx = h.x - w.x, dy = h.y - w.y, d = Math.hypot(dx, dy) || 1, min = h.r + w.r + 64;
        if (d < min) { h.x += dx / d * (min - d) * .5; h.y += dy / d * (min - d) * .5; }
      }
    });
  for (let i = 0; i < 320; i++) sim.tick();
  return { pos: Object.fromEntries(nodes.map(n => [n.code, [n.x, n.y]])), r: Object.fromEntries(nodes.map(n => [n.code, n.r])) };
}
// a curve between two wards: bow it away from the centre of mass, as little as possible while clearing every other node
function tiePath(a, b, pos, rad, com) {
  const [x1, y1] = pos[a], [x2, y2] = pos[b], dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, nx = -dy / L, ny = dx / L;
  const away = Math.sign((mx - com[0]) * nx + (my - com[1]) * ny) || 1;
  const q = (c, t) => [(1 - t) * (1 - t) * x1 + 2 * (1 - t) * t * c[0] + t * t * x2, (1 - t) * (1 - t) * y1 + 2 * (1 - t) * t * c[1] + t * t * y2];
  const clear = c => Object.keys(pos).every(k => k === a || k === b || [.2, .35, .5, .65, .8].every(t => { const p = q(c, t); return Math.hypot(p[0] - pos[k][0], p[1] - pos[k][1]) > rad[k] + 6; }));
  let c = null;
  for (const k of [.12, .22, .34, .48]) { for (const s of [away, -away]) { const cc = [mx + nx * s * k * L, my + ny * s * k * L]; if (clear(cc)) { c = cc; break; } } if (c) break; }
  if (!c) c = [mx + nx * away * .3 * L, my + ny * away * .3 * L];
  const trim = (px, py, rr) => { const ux = c[0] - px, uy = c[1] - py, ul = Math.hypot(ux, uy) || 1; return [px + ux / ul * (rr + 4), py + uy / ul * (rr + 4)]; };
  const s0 = trim(x1, y1, rad[a]), s1 = trim(x2, y2, rad[b]);
  return `M${s0[0].toFixed(1)},${s0[1].toFixed(1)}Q${c[0].toFixed(1)},${c[1].toFixed(1)} ${s1[0].toFixed(1)},${s1[1].toFixed(1)}`;
}
// a soft outline around the hospital's wards, labels included
function hullPath(pos, rad) {
  const pts = [];
  WD.wards.filter(w => !HC.has(w.code)).forEach(w => { const [x, y] = pos[w.code], rr = rad[w.code] + 18;
    for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; pts.push([x + Math.cos(a) * rr, y + Math.sin(a) * rr + (Math.sin(a) > 0 ? 14 : 0)]); } });
  const h = d3.polygonHull(pts); if (!h) return { d: "", top: [0, 0] };
  return { d: d3.line().curve(d3.curveCatmullRomClosed.alpha(.5))(h), top: [d3.mean(h, p => p[0]), d3.min(h, p => p[1])] };
}
function drawMap(first) {
  const el = $("wmap");
  if (first || !el.querySelector("svg")) {
    el.innerHTML = ""; MAPL = null;
    d3.select(el).append("svg").attr("preserveAspectRatio", "xMidYMid meet")
      .call(s => ["frame", "links", "nodes"].forEach(c => s.append("g").attr("class", c)));
    const svg = d3.select(el).select("svg");
    svg.select(".frame").append("path").attr("class", "hull").attr("fill", "none").attr("stroke", css("--line")).attr("stroke-dasharray", "2 5");
    svg.select(".frame").append("text").attr("class", "maplab hlab").attr("text-anchor", "middle").text(t("wHospital"));
    svg.on("click", e => { if (!e.target.closest("g.wn")) chooseOverviewWard(null); });
  }
  const svg = d3.select(el).select("svg");
  // the layout changes only when a ward is chosen (a click), never on hover
  const key = WS.ward || "";
  if (!MAPL || MAPL.key !== key) {
    const tiesAll = MAPL ? MAPL.tiesAll : mapTies();
    MAPL = { ...(MAPL || {}), tiesAll, ties: true };
    const from = MAPL.pos, lay = mapLayout(WS.ward, from);
    MAPL.key = key; MAPL.r = lay.r; MAPL.target = lay.pos;
    if (!from) { MAPL.pos = lay.pos; fitMap(svg, lay.pos, lay.r); }
    else {   // glide from where things were to where they settle
      const ip = Object.fromEntries(Object.keys(lay.pos).map(k => [k, d3.interpolate(from[k], lay.pos[k])]));
      svg.interrupt("lay").transition("lay").duration(reduceMotion() ? 0 : 750).ease(d3.easeCubicInOut)
        .tween("lay", () => tt => { MAPL.pos = Object.fromEntries(Object.keys(ip).map(k => [k, ip[k](tt)])); placeMap(svg); })
        .on("end", () => fitMap(svg, MAPL.pos, MAPL.r, true));
    }
  }
  styleMap(svg); placeMap(svg);
}
const reduceMotion = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
function fitMap(svg, pos, rad, animate) {
  const xs = Object.keys(pos).flatMap(k => [pos[k][0] - Math.max(rad[k], 78), pos[k][0] + Math.max(rad[k], 78)]), ys = Object.keys(pos).flatMap(k => [pos[k][1] - rad[k] - 6, pos[k][1] + rad[k] + 28]);
  const pad = 24, x0 = d3.min(xs) - pad, y0 = d3.min(ys) - pad - 18, w = d3.max(xs) - x0 + pad, h = d3.max(ys) - y0 + pad;
  const vb = `${x0.toFixed(0)} ${y0.toFixed(0)} ${w.toFixed(0)} ${h.toFixed(0)}`;
  if (!animate || !svg.attr("viewBox")) svg.attr("viewBox", vb); else svg.transition().duration(400).attr("viewBox", vb);
}
// positions: nodes, curves and the hospital outline follow MAPL.pos (every frame while gliding)
function placeMap(svg) {
  const pos = MAPL.pos, rad = MAPL.r, com = [d3.mean(Object.values(pos), p => p[0]), d3.mean(Object.values(pos), p => p[1])];
  svg.select(".nodes").selectAll("g.wn").attr("transform", w => `translate(${pos[w.code][0].toFixed(1)},${pos[w.code][1].toFixed(1)})`);
  svg.select(".links").selectAll("path").attr("d", l => tiePath(l.a, l.b, pos, rad, com));
  const hull = hullPath(pos, rad);
  svg.select(".hull").attr("d", hull.d); svg.select(".hlab").attr("x", hull.top[0]).attr("y", hull.top[1] - 8);
}
// colours, sizes and emphasis: these change on hover and with the window, positions don't
function styleMap(svg) {
  const win = winNow(), counts = Object.fromEntries(WD.wards.map(w => [w.code, casesIn({ ward: w.code, fp: null, win }).length]));
  const { ties, top, shown } = MAPL.tiesAll, rad = MAPL.r;
  const focus = WS.hoverWard || WS.ward, focusTies = focus ? top(focus, 3) : [], near = new Set(focusTies.flatMap(l => [l.a, l.b]));
  const fpKey = WS.hoverFp || WS.fp, fpWards = fpKey ? new Set(casesIn({ ward: null, fp: fpKey, win }).map(c => c.ward)) : null;
  const heat = w => {   // colour always means: above this ward's own normal, for this window's length
    if (counts[w.code] < MIN_CASES) return css("--sheet-2");      // too few to judge: no colour, just the count
    const z = winZ(w, counts[w.code], win);
    return z > 2 ? css("--accent") : z > 1 ? d3.interpolate(css("--sheet-2"), css("--accent"))(.45) : css("--sheet-2");
  };
  const lw = d3.scaleLinear().domain([0, 1]).range([.6, 2.2]);
  const vis = ties.filter(l => shown.has(l) || focusTies.includes(l));
  svg.select(".links").selectAll("path").data(vis, l => l.a + l.b).join(
      enter => enter.append("path").attr("fill", "none").attr("stroke-linecap", "round").attr("stroke-opacity", 0),
      update => update, exit => exit.transition().duration(250).attr("stroke-opacity", 0).remove())
    .attr("stroke", l => focusTies.includes(l) ? css("--ink-2") : css("--ink-3"))
    .transition().duration(300).attr("stroke-width", l => focusTies.includes(l) ? lw(l.sn) + .4 : lw(l.sn))
    .attr("stroke-opacity", l => !focus ? .22 : focusTies.includes(l) ? .55 : .06);
  const g = svg.select(".nodes").selectAll("g.wn").data(WD.wards, w => w.code).join(enter => {
    const n = enter.append("g").attr("class", "wn").style("cursor", "pointer").attr('role', 'button').attr('tabindex', 0);
    n.append("circle").attr("class", "ring").attr("fill", "none").attr("r", 0);
    n.append("circle").attr("class", "body").attr("r", 0);
    n.append("text").attr("class", "wcount").attr("text-anchor", "middle").attr("dy", ".05em");
    n.append("text").attr("class", "wcode").attr("text-anchor", "middle");
    n.append('rect').attr('class', 'ward-label-hit').attr('fill', 'transparent').attr('x', -83).attr('width', 166).attr('height', 24);
    const hover = (e, w) => { WS.hoverWard = w.code; styleMap(svg); drawTimeline(); wardHoverContext(); };
    const leave = () => { WS.hoverWard = null; styleMap(svg); drawTimeline(); wardHoverContext(); };
    n.on('pointerenter', hover).on('pointerleave', leave).on('focus', hover).on('blur', leave)
     .on("click", (e, w) => { e.stopPropagation(); chooseOverviewWard(WS.ward === w.code ? null : w.code); })
     .on('keydown', (e, w) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); chooseOverviewWard(WS.ward === w.code ? null : w.code); } else if (e.key === 'Escape') { chooseOverviewWard(null); } });
    return n;
  });
  g.attr('aria-label', w => `${wardName(w.code)}: ${counts[w.code]} new resistant cases in this window. Select this ward.`).attr('aria-pressed', w => w.code === WS.ward).classed('ward-hovered', w => w.code === WS.hoverWard);
  g.select('.ward-label-hit').attr('y', w => rad[w.code] + 3);
  g.select("circle.body").transition().duration(500).ease(d3.easeCubicOut).attr("r", w => rad[w.code])
    .attr("fill", heat).attr("stroke", w => w.code === WS.ward || w.code === WS.hoverWard ? css("--ward") : css("--line")).attr("stroke-width", w => w.code === WS.ward || w.code === WS.hoverWard ? 3 : 1)
    .attr("opacity", w => (focus && !near.has(w.code) && w.code !== focus) || (fpWards && !fpWards.has(w.code)) ? .35 : 1);
  g.select("circle.ring").transition().duration(400).attr("r", w => rad[w.code] + 6).attr("stroke", css("--accent")).attr("stroke-width", 1.6)
    .attr("stroke-dasharray", WS.hoverFp && WS.hoverFp !== WS.fp ? "3 4" : null).attr("opacity", w => fpWards && fpWards.has(w.code) ? 1 : 0);
  g.select("text.wcount").text(w => counts[w.code]).attr("class", w => "wcount" + (heat(w) === css("--accent") ? " on" : counts[w.code] < MIN_CASES ? " few" : ""));
  g.select("text.wcode").attr("dy", w => rad[w.code] + 17).text(w => wardName(w.code))
    .attr("opacity", w => (focus && !near.has(w.code) && w.code !== focus) || (fpWards && !fpWards.has(w.code)) ? .45 : 1);
}
// 1 · the time strip: new cases per week (or for the ward in focus) and the window, which you drag, resize, or move with a click
let dragRaf = 0;
function drawTimeline(first) {
  const el = $("wtime"), W = Math.max(300, el.clientWidth || 900), H = 150, m = { l: 30, r: 12, t: 30, b: 24 };
  const ward = WS.ward, ghostWard = WS.hoverWard && WS.hoverWard !== WS.ward ? WS.hoverWard : null, wsel = ward ? WD.wards.filter(w => w.code === ward) : WD.wards;
  const x = d3.scaleBand().domain(d3.range(WD.weeks)).range([m.l, W - m.r]).padding(.18), step = x.step();
  const per = d3.range(WD.weeks).map(k => { const o = { k }; HYG.types.forEach(tp => o[tp] = 0); return o; });
  WD.cases.forEach(c => { if (ward && c.ward !== ward) return; const k = wkOf(c.date); if (k < 0) return; c.flags.forEach(f => { if (per[k][f] != null) per[k][f] += 1; }); });
  const weekly = (keep) => { const a = new Array(WD.weeks).fill(0); WD.cases.forEach(c => { const k = wkOf(c.date); if (k >= 0 && keep(c)) a[k] += c.flags.filter(f => HYG.types.includes(f)).length; }); return a; };
  const fpPer = WS.fp ? d3.range(WD.weeks).map(k => WD.cases.filter(c => wkOf(c.date) === k && c.fp + c.short === WS.fp && (!ward || c.ward === ward)).length) : null;
  // ghosts: what hovering would show, drawn as outlines on the same scale
  const ghost = WS.hoverFp && WS.hoverFp !== WS.fp ? d3.range(WD.weeks).map(k => WD.cases.filter(c => wkOf(c.date) === k && c.fp + c.short === WS.hoverFp && (!ward || c.ward === ward)).length)
    : ghostWard ? weekly(c => c.ward === ghostWard) : null;
  // the scale only changes on a click: all wards, or the busiest single ward when one is chosen
  const ymax = Math.max(4, ward ? d3.max(WD.wards, w => d3.max(weekly(c => c.ward === w.code))) : d3.max(per, o => d3.sum(HYG.types, tp => o[tp])));
  const y = d3.scaleLinear().domain([0, ymax]).nice().range([H - m.b, m.t]);
  if (first || !el.querySelector("svg")) {
    el.innerHTML = ""; const sv = d3.select(el).append("svg").attr("viewBox", `0 0 ${W} ${H}`);
    sv.append("rect").attr("class", "hitarea").attr("x", m.l).attr("y", m.t - 22).attr("width", W - m.l - m.r).attr("height", H - m.b - m.t + 22).attr("fill", "transparent").style("cursor", "pointer");
    ["band", "bars", "fpbars", "ghost", "exp", "ax", "win"].forEach(c => sv.append("g").attr("class", c));
    const wg = sv.select(".win");
    wg.append("rect").attr("class", "wband").attr("rx", 8).style("cursor", "grab");
    wg.append("rect").attr("class", "wh l").attr("width", 6).attr("rx", 3).style("cursor", "ew-resize");
    wg.append("rect").attr("class", "wh r").attr("width", 6).attr("rx", 3).style("cursor", "ew-resize");
    wg.append("text").attr("class", "wlab").attr("text-anchor", "middle");
  }
  const svg = d3.select(el).select("svg"), col = TYPE_COL();
  el.__per = per; el.__y = y;
  svg.select(".bars").selectAll("g").data(d3.stack().keys(HYG.types)(per), s2 => s2.key).join("g").attr("fill", s2 => col[s2.key])
    .attr("opacity", s2 => fpPer ? .25 : ghost ? .45 : WS.hoverType && WS.hoverType !== s2.key ? .18 : .9)
    .selectAll("rect").data(s2 => s2).join("rect").attr("x", (d, i) => x(i)).attr("width", x.bandwidth()).attr("rx", 1.5).style("pointer-events", "none")
    .transition().duration(400).attr("y", d => y(d[1])).attr("height", d => Math.max(0, y(d[0]) - y(d[1])));
  svg.select(".fpbars").selectAll("rect").data(fpPer || []).join("rect").attr("x", (d, i) => x(i) + x.bandwidth() * .2).attr("width", x.bandwidth() * .6).attr("rx", 1.5)
    .attr("fill", css("--ink")).style("pointer-events", "none").transition().duration(300).attr("y", d => y(d)).attr("height", d => y(0) - y(d));
  svg.select(".ghost").selectAll("rect").data(ghost || []).join("rect").attr("x", (d, i) => x(i) + .5).attr("width", Math.max(1, x.bandwidth() - 1)).attr("rx", 1.5)
    .attr("fill", "none").attr("stroke", css("--ink")).attr("stroke-width", 1.2).attr("stroke-dasharray", "2 2").style("pointer-events", "none")
    .attr("y", d => y(Math.min(d, y.domain()[1]))).attr("height", d => d ? y(0) - y(Math.min(d, y.domain()[1])) : 0);
  const exp = d3.sum(wsel, w => w.expected) / 4;
  svg.select(".exp").selectAll("line").data([exp]).join("line").attr("x1", m.l).attr("x2", W - m.r).attr("stroke", css("--ink-3")).attr("stroke-dasharray", "3 4").style("pointer-events", "none")
    .transition().duration(400).attr("y1", d => y(d)).attr("y2", d => y(d));
  svg.select(".exp").selectAll("text").data([exp]).join("text").attr("class", "maplab").attr("x", W - m.r).attr("text-anchor", "end").style("pointer-events", "none")
    .transition().duration(400).attr("y", d => y(d) - 5).text(t("wUsual"));
  const ax = svg.select(".ax").attr("transform", `translate(0,${H - m.b})`).style("pointer-events", "none");
  ax.call(d3.axisBottom(x).tickValues(d3.range(0, WD.weeks, W < 560 ? 16 : 8)).tickFormat(k => wkDate(k).replace(/ \d{4}$/, "")).tickSizeOuter(0));
  ax.selectAll("text").attr("class", "maplab"); ax.selectAll("path,line").attr("stroke", css("--line"));
  // the window itself
  const win = winNow(), x0 = x(win[0]) - 3, x1 = x(win[1]) + x.bandwidth() + 3, wg = svg.select(".win");
  wg.select(".wband").attr("y", m.t - 8).attr("height", H - m.b - m.t + 8).attr("fill", css("--timeline")).attr("fill-opacity", WS.preview ? .06 : .1)
    .attr("stroke", css("--timeline")).attr("stroke-opacity", .45).attr("stroke-dasharray", WS.preview ? "4 4" : null).attr("x", x0).attr("width", x1 - x0);
  const ws = winSet(), g0 = x(ws[0]) - 3, g1 = x(ws[1]) + x.bandwidth() + 3;
  svg.select(".band").selectAll("rect").data(WS.preview ? [1] : []).join("rect").attr("y", m.t - 8).attr("height", H - m.b - m.t + 8).attr("rx", 8)
    .attr("fill", "none").attr("stroke", css("--ink-3")).attr("stroke-opacity", .5).attr("x", g0).attr("width", g1 - g0);
  wg.select(".wh.l").attr("y", m.t + 14).attr("height", 30).attr("fill", css("--timeline")).attr("x", x0 - 3);
  wg.select(".wh.r").attr("y", m.t + 14).attr("height", 30).attr("fill", css("--timeline")).attr("x", x1 - 3);
  wg.select(".wlab").attr("x", Math.max(m.l + 90, Math.min(W - m.r - 90, (x0 + x1) / 2))).attr("y", m.t - 14).attr("fill", css("--timeline")).attr("class", "wlab")
    .text(`${WS.preview ? t("preview") + " · " : ""}${wkDate(win[0]).replace(/ \d{4}$/, "")} – ${niceDate(wardWindowEnd(win))} · ${t("weeks", { n: win[1] - win[0] + 1 })}`);
  if (first) {
    const set = (a, b2) => { a = Math.max(0, Math.min(WD.weeks - 1, a)); b2 = Math.max(a, Math.min(WD.weeks - 1, b2)); WS.win = [a, b2]; if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; drawWards(); }); };
    const drag = (node, fn) => node.call(d3.drag().on("start", function (e) { WS.preview = null; this.__x = e.x; this.__w = winSet().slice(); }).on("drag", function (e) { fn(Math.round((e.x - this.__x) / step), this.__w); }));
    drag(wg.select(".wband"), (dk, w0) => { const len = w0[1] - w0[0], a = Math.max(0, Math.min(WD.weeks - 1 - len, w0[0] + dk)); set(a, a + len); });
    drag(wg.select(".wh.l"), (dk, w0) => set(Math.min(w0[1], w0[0] + dk), w0[1]));
    drag(wg.select(".wh.r"), (dk, w0) => set(w0[0], Math.max(w0[0], w0[1] + dk)));
    // hover anywhere on the strip: the page previews the window ending at that week; click keeps it; leave to go back
    const weekAt = e => Math.max(0, Math.min(WD.weeks - 1, Math.floor((d3.pointer(e, svg.node())[0] - m.l) / step)));
    const redraw = () => { if (!dragRaf) dragRaf = requestAnimationFrame(() => { dragRaf = 0; drawWards(); }); };
    // which type's segment is under the pointer: its word in the text lights up
    const typeAt = e => {
      const k = weekAt(e), o = el.__per && el.__per[k]; if (!o) return null;
      const v = el.__y.invert(d3.pointer(e, svg.node())[1]); let acc = 0;
      for (const tp of HYG.types) { if (o[tp] && v >= acc && v <= acc + o[tp]) return tp; acc += o[tp]; }
      return null;
    };
    svg.on("pointermove", e => {
      if (e.buttons) return;
      const tp = typeAt(e), k = weekAt(e), len = winSet()[1] - winSet()[0], a = Math.max(0, Math.min(WD.weeks - 1 - len, k - len));
      const pv = a === winSet()[0] ? null : [a, a + len];
      if (tp === WS.hoverType && (WS.preview ? pv && WS.preview[0] === pv[0] : !pv)) return;
      WS.hoverType = tp; WS.preview = pv; redraw();
    });
    svg.on("pointerleave", () => { if (WS.preview || WS.hoverType) { WS.preview = null; WS.hoverType = null; redraw(); } });
    svg.on("click", e => { if (e.defaultPrevented) return; if (WS.preview) { WS.win = WS.preview; WS.preview = null; redraw(); } });
  }
}
const wkDate = k => niceDate(new Date(new Date(WD.start).getTime() + k * 6048e5).toISOString().slice(0, 10));
// 3 · fingerprints: cases in the window grouped by organism and resistance pattern; shared patterns across wards stand out
function drawFingerprints() {
  const list = casesIn({ fp: null }), groups = d3.groups(list, c => c.fp + c.short).sort((a, b) => b[1].length - a[1].length).slice(0, 6);
  const sig = groups.map(([k, cs]) => k + cs.length).join("|") + "|" + WS.fp + "|" + WS.ward + "|" + LANG;
  if (sig === drawFingerprints.last && $("wfp").childElementCount) return;   // unchanged: keep it still while the window is dragged
  drawFingerprints.last = sig;
  $("wfp").classList.toggle("quiet", !!(WS.preview || dragRaf));            // previews swap rows in place, no entrance animation
  const col = TYPE_COL();
  $("wfp").innerHTML = groups.length ? groups.map(([key, cs], k) => {
    const wardsHere = [...new Set(cs.map(c => c.ward))], fp = cs[0].fp;
    const strip = WD.drugs.map((dcode, i) => `<i class="${fp[i] === "R" ? "r" : fp[i] === "S" ? "s" : "n"}" title="${wardEsc(drugName(dcode))}: ${fp[i] === "R" ? "Resistance found" : fp[i] === "S" ? "No resistance found" : "Not reported"}"></i>`).join("");
    const dots = cs.slice(0, 40).map(c => `<b style="background:${col[c.flags[0]] || css("--accent")}" title="${wardEsc(wardName(c.ward))} · ${niceDate(c.date)}${c.hday ? ` · ${t("wDay", { d: c.hday })}` : ""}"></b>`).join("");
    return `<button class="fprow ${WS.fp === key ? "on" : ""}" data-fp="${wardEsc(key)}" aria-pressed="${WS.fp === key}" style="animation-delay:${k * 40}ms"><span class="fpn"><b>${wardEsc(cs[0].short)}</b><small>${cs[0].flags.map(typeWord).join(" ")} · <span class="ward-pattern-names">${wardsHere.map(w => wardEsc(wardName(w))).join(", ")}</span></small></span>
      <span class="fps">${strip}</span><span class="fpd">${dots}</span><span class="fpc">${cs.length}</span></button>`;
  }).join("") : `<p class="muted">${t("wNone")}</p>`;
  $("wfp").querySelectorAll(".fprow").forEach(b => {
    b.onmouseenter = () => { WS.hoverFp = b.dataset.fp; drawMap(); drawTimeline(); };
    b.onmouseleave = () => { WS.hoverFp = null; drawMap(); drawTimeline(); };
    b.onclick = () => { WS.fp = WS.fp === b.dataset.fp ? null : b.dataset.fp; drawWards(); };
  });
}

// ---------- admin: generate data (the feed simulator, inside this shell) ----------
function renderGenerate() {
  if ($("simframe")) return;
  $("page").innerHTML = `<iframe class="simframe" id="simframe" src="${window.MindlineStatic.base}admin/sim/?embed=1" title="${t("navGen")}"></iframe>`;
}

// ---------- settings ----------
let SETTAB = store.get("rl-settab", "profile");
function renderSettings() {
  const cur = document.documentElement.dataset.theme;
  const tabs = [["profile", Profile.text("tab")], ["appearance", t("theme")], ["language", t("language")]];
  if (!tabs.some(([k]) => k === SETTAB)) SETTAB = "profile";
  const body = {
    profile: Profile.html(),
    appearance: `<div class="themes">${THEMES.map(th => `<button class="theme" data-theme="${th.id}" aria-pressed="${th.id === cur}">
      <span class="pv" style="background:${th.pv[0]};${th.id === "neo-brutal" ? "border:2px solid #111;box-shadow:4px 4px 0 #111" : ""}">
        ${[[18, 28, 26, 1], [52, 60, 14, 2], [70, 30, 20, 3], [34, 70, 10, 1]].map(([l, tp, s, c]) => `<i style="left:${l}%;top:${tp}%;width:${s}px;height:${s}px;background:${th.pv[c]}"></i>`).join("")}
        <i style="left:10%;top:10%;width:46%;height:8px;border-radius:4px;background:${th.pv[1]}"></i></span>
      <b>${th.name}</b><small>${th.about}</small></button>`).join("")}</div>`,
    language: `<div class="langs">${[["en", "English", "Antibiotics, wards and samples in English"], ["fi", "Suomi", "Lääkkeet, osastot ja näytteet suomeksi"], ["sv", "Svenska", "Läkemedel, avdelningar och prov på svenska"]].map(([k, n, a]) =>
      `<button class="lang" data-lang="${k}" aria-pressed="${LANG === k}"><b>${n}</b><small>${a}</small></button>`).join("")}</div>`,

  };
  $("page").innerHTML = `<div class="settings profile-settings"><h1>${Profile.text("title")}</h1>
    <nav class="subtabs">${tabs.map(([k, label]) => `<button data-settab="${k}" aria-current="${SETTAB === k}">${label}</button>`).join("")}<i class="subline"></i></nav>
    <div class="setbody" id="setbody">${body[SETTAB]}</div></div>`;
  // the underline slides to the chosen tab
  const on = $("page").querySelector(`[data-settab="${SETTAB}"]`), line = $("page").querySelector(".subline");
  if (on && line) { line.style.width = on.offsetWidth + "px"; line.style.transform = `translateX(${on.offsetLeft}px)`; }
  $("page").querySelectorAll("[data-settab]").forEach(b => b.onclick = () => { SETTAB = b.dataset.settab; store.set("rl-settab", SETTAB); renderSettings(); });
  $("page").querySelectorAll(".theme").forEach(b => b.onclick = () => setTheme(b.dataset.theme));
  $("page").querySelectorAll(".lang").forEach(b => b.onclick = () => setLang(b.dataset.lang));
  if (SETTAB === "profile") Profile.bind();
  $("page").querySelectorAll("[data-hyg]").forEach(b => b.onclick = () => {
    const k = b.dataset.hyg, v = b.dataset.v;
    if (k === "types") { HYG.types = HYG.types.includes(v) ? HYG.types.filter(x => x !== v) : [...HYG.types, v]; if (!HYG.types.length) HYG.types = [v]; }
    else HYG[k] = k === "windowWeeks" ? +v : v;
    store.set("rl-hyg", HYG); WS.ward = null; WS.win = null; WS.preview = null; renderSettings();
  });
}

// ---------- the hospital clock: a small floating pill. Next day, play, back to where the data ends. ----------
let CLOCK = null, PLAYING = null, clockBusy = false, clockExpanded = false;
const CICON = {
  prev: '<svg viewBox="0 0 24 24"><path d="M18 6l-7 6 7 6zM9 6v12"/></svg>',
  notable: '<svg viewBox="0 0 24 24"><path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/></svg>',
  cal: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
  next: '<svg viewBox="0 0 24 24"><path d="M6 6l7 6-7 6zM15 6v12"/></svg>',
  play: '<svg viewBox="0 0 24 24"><path d="M7 5l12 7-12 7z"/></svg>',
  pause: '<svg viewBox="0 0 24 24"><path d="M8 5v14M16 5v14"/></svg>',
  reset: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v4h4"/></svg>',
};
async function loadClock() { CLOCK = await api("/api/app/clock"); META.last = CLOCK.today; renderClock(); }
function renderClock(flash) {
  const el = $("clockpill"); if (!el || !CLOCK) return;
  el.hidden = !SESSION || SESSION.role === "admin" || VIEW === 'settings' || (typeof ANS_ON !== 'undefined' && ANS_ON);
  el.classList.toggle('collapsed', !clockExpanded);
  el.classList.toggle('expanded', clockExpanded);
  const atStart = CLOCK.today === CLOCK.data_end, atEnd = CLOCK.today >= CLOCK.last;
  el.innerHTML = `<div id="simulation-controls" class="clock-controls" role="group" aria-label="Simulation controls"${clockExpanded ? '' : ' hidden'}><span class="cdate"><small>${t("today")}</small><b>${niceDate(CLOCK.today)}</b></span>
    <span class="cnew ${flash ? "show" : ""}">${CLOCK.new_today ? t("newResults", { n: CLOCK.new_today }) : ""}</span>
    <button data-c="prev" title="${t("prevDay")}" ${atStart ? "disabled" : ""}>${CICON.prev}</button>
    <button data-c="next" title="${t("nextDay")}" ${atEnd ? "disabled" : ""}>${CICON.next}</button>
    <button data-c="play" title="${PLAYING ? t("pause") : t("play")}" class="${PLAYING ? "on" : ""}" ${atEnd ? "disabled" : ""}>${PLAYING ? CICON.pause : CICON.play}</button>
    <button data-c="notable" title="${t("nextNotable")}" ${atEnd ? "disabled" : ""}>${CICON.notable}</button>
    <button data-c="cal" title="${t("calendar")}" class="${$("calpop") && !$("calpop").hidden ? "on" : ""}">${CICON.cal}</button>
    <button data-c="reset" title="${t("backToData")}" ${atStart ? "disabled" : ""}>${CICON.reset}</button></div>
    <button type="button" class="clock-toggle" data-c="toggle" aria-label="${clockExpanded ? 'Collapse' : 'Expand'} simulation controls" title="${clockExpanded ? 'Collapse' : 'Expand'} simulation controls" aria-expanded="${clockExpanded}" aria-controls="simulation-controls"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${clockExpanded ? 'M10 6l6 6-6 6' : 'M14 6l-6 6 6 6'}"/></svg></button>`;
  $("asof").textContent = atStart ? t("dataUpTo", { d: niceDate(CLOCK.today) }) : t("liveFeed");
}
async function clockAction(action, extra = {}) {
  if (clockBusy) return; clockBusy = true;
  try {
    CLOCK = await api("/api/app/clock", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...extra }) });
    META.last = CLOCK.today; renderClock(action === "next"); if (typeof renderCalendar === "function") renderCalendar(); await refreshView();
    if (CLOCK.today >= CLOCK.last) stopPlay();
  } finally { clockBusy = false; }
}
function stopPlay() { clearInterval(PLAYING); PLAYING = null; renderClock(); }
async function refreshView() {
  // the open view updates in place: same layout, new numbers, the usual transitions
  if (VIEW === "doctor") { loadPatients(); if (F.patient) { const pt = await api(`/api/app/patient?id=${F.patient}`); PT = pt; drawHistory(); } await loadDoctor(); renderSentence(); }
  if (VIEW === "brief") await renderBrief();
  if (VIEW === "insights") await renderInsights(true);
  if (VIEW === "overview") await renderOverview();
  if (VIEW === "wards" && WD) { WD = await api(`/api/app/wards?types=${HYG.types.join(",").toLowerCase()}`); drawFingerprints.last = null; drawWards(); }
}
$("clockpill").addEventListener("click", e => {
  const b = e.target.closest("[data-c]"); if (!b || b.disabled) return;
  const c = b.dataset.c;
  if (c === 'toggle') {
    clockExpanded = !clockExpanded;
    if (!clockExpanded) { clearInterval(PLAYING); PLAYING = null; if ($('calpop')) $('calpop').hidden = true; }
    renderClock(); $('clockpill').querySelector('.clock-toggle')?.focus({preventScroll:true}); return;
  }
  if (c === "play") { if (PLAYING) return stopPlay(); PLAYING = setInterval(() => clockAction("next"), 1600); renderClock(); clockAction("next"); return; }
  if (c === "reset" || c === "prev") stopPlay();
  if (c === "notable") { stopPlay(); return jumpNotable(); }
  if (c === "cal") return toggleCalendar();
  clockAction(c);
});

// ---------- start ----------
document.addEventListener('DOMContentLoaded', function init() {
  document.documentElement.lang = LANG; applyStaticText();
  if (window.MindlineStatic.isAdmin) { $("login").hidden = true; enterApp({ role: "admin", name: "Admin", email: "admin@mindline.demo" }); }
  else { const s = store.get("rl-session", null); if (s) enterApp(s); }
  if (!$("login").hidden) loadLoginScene();
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => { if (VIEW === "doctor" && AB) { drawGrows(); drawSpark(AB.drugs.find(x => x.code === F.drug) || AB.drugs[0]); } }, 200); });
});
