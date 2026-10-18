"""Generate parity fixtures from the existing Python implementation, without HTTP."""
import json, sys
from pathlib import Path
from datetime import date, datetime, timezone
HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
sys.path[:0] = [str(ROOT/'app'), str(ROOT/'data-prep/simulator')]
import evidence, insights, narrative, overview
from feed import FEED
from feedsim.views import Views

def clean(x):
    if isinstance(x, datetime): return x.replace(tzinfo=timezone.utc).timestamp()*1000
    if isinstance(x, date): return datetime(x.year,x.month,x.day,tzinfo=timezone.utc).timestamp()*1000
    if isinstance(x, dict): return {k:clean(v) for k,v in x.items()}
    if isinstance(x,(list,tuple)): return [clean(v) for v in x]
    if isinstance(x,set): return list(x)
    return x

FEED.ensure()
r=FEED.run
run={k:clean(getattr(r,k)) for k in ('recipe','start','end','deliveries','cases','truth_list','complete_at','final','check_results','batch_format','stats','truth','history')}
fixtures=[]
def take(path,expected,body=None): fixtures.append({'path':path,'body':body,'day':str(FEED.today),'expected':expected})
for day in ('2026-09-27','2026-10-18','2026-11-15'):
    FEED.set_today(date.fromisoformat(day))
    take('/api/app/meta',evidence.meta())
    take('/api/app/overview',overview.overview())
    take('/api/app/clock',FEED.status())
    for ward,sex,age,spec,org,weeks in [('URO',None,None,'urine',None,4),('ICU','F','65+','blood',None,2),(None,'M','<65','wound',None,8),('ED',None,None,'urine','Escherichia coli',12)]:
        from urllib.parse import urlencode
        q=dict(ward=ward,sex=sex,age=age,spec=spec,org=org,recent_weeks=weeks)
        take('/api/app/antibiogram?'+urlencode({k:v for k,v in q.items() if v is not None}),evidence.antibiogram(**q))
    for ward in ('URO','ICU'):
        ps=evidence.patients(ward)
        take('/api/app/patients?ward='+ward,ps)
        for p in ps[:2]: take('/api/app/patient?id='+p['id'],evidence.patient(p['id']))
    take('/api/app/wards',evidence.wards_overview())
    take('/api/app/wards?types=mrsa',evidence.wards_overview(types=('mrsa',)))
    take('/api/app/brief',evidence.brief())
    for role in ('doctor','hygiene'): take('/api/app/insights?role='+role,insights.insights(role))
v=Views(r)
for size in ('day','week','hour'):take('/api/runs/reference/bins?size='+size,v.bins(size))
take('/api/runs/reference/delays',v.delays())
for table in ('cultures','isolates','susceptibility','deliveries','batches','truth','checks'):
    take('/api/runs/reference/table/'+table+'?limit=10',v.page(table,{},0,10))
texts=['Ask about their routine, because the daughter noticed a change.','Confusion noted today.','Kysy tyttäreltä, koska hän tuntee potilaan.','Fråga dottern, eftersom hon känner patienten.','Review E. coli results, because the earlier result differed.',"Start nitrofurantoin because it was tolerated before. If ESBL, switch to meropenem."]
out={'run':run,'fixtures':fixtures,'notes':[{'text':t,'expected':narrative.parse(t)} for t in texts]}
(HERE/'reference.json').write_text(json.dumps(out,ensure_ascii=False,separators=(',',':')),encoding='utf-8')
print('Wrote',len(fixtures),'Python reference responses.')
