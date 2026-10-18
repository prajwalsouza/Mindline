"""Fetch pinned public UI dependencies once, then build offline from vendor/."""
import hashlib, json, re, urllib.request
from pathlib import Path
HERE=Path(__file__).resolve().parent
ROOT=HERE.parent
OUT=HERE/'vendor'
OUT.mkdir(exist_ok=True)
mapping={}
def fetch(url,name):
    p=OUT/name
    p.parent.mkdir(parents=True,exist_ok=True)
    if not p.exists():
        req=urllib.request.Request(url,headers={'User-Agent':'Mozilla/5.0 Chrome/125.0.0.0 Safari/537.36'})
        with urllib.request.urlopen(req,timeout=40) as r: p.write_bytes(r.read())
    return p
urls={'https://cdnjs.cloudflare.com/ajax/libs/d3/7.9.0/d3.min.js':'d3.min.js',
      'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js':'three/three.module.js'}
for url,name in urls.items():fetch(url,name);mapping[url]='vendor/'+name
for name in ('controls/OrbitControls.js','geometries/RoundedBoxGeometry.js','utils/BufferGeometryUtils.js'):
    fetch('https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/'+name,'three/addons/'+name)
mapping['https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/']='vendor/three/addons/'
fetch('https://cdn.jsdelivr.net/npm/three@0.170.0/LICENSE','three/LICENSE')
fetch('https://cdn.jsdelivr.net/npm/d3@7.9.0/LICENSE','D3-LICENSE')
for family in ('inter','intertight','spacegrotesk','fraunces'):
    fetch('https://raw.githubusercontent.com/google/fonts/main/ofl/'+family+'/OFL.txt','fonts/'+family+'-OFL.txt')
for folder in (ROOT/'app/static',ROOT/'data-prep/simulator/static'):
    for p in folder.rglob('*'):
        if p.suffix not in ('.html','.js','.css'):continue
        for url in re.findall(r'https://fonts.googleapis.com/css2[^"\s<>]+',p.read_text(encoding='utf-8')):
            if url in mapping:continue
            name='fonts-'+hashlib.sha256(url.encode()).hexdigest()[:10]+'.css'
            target=fetch(url,name)
            css=target.read_text(encoding='utf-8')
            for font in set(re.findall(r'https://fonts.gstatic.com/[^)\s]+',css)):
                local='fonts/'+hashlib.sha256(font.encode()).hexdigest()[:16]+'.woff2'
                fetch(font,local);css=css.replace(font,local)
            target.write_text(css,encoding='utf-8');mapping[url]='vendor/'+name
(OUT/'manifest.json').write_text(json.dumps(mapping,indent=2),encoding='utf-8')
print('Vendored',len(mapping),'dependency URLs')
