"""Check static entrypoints and their local asset references, plus ZIP integrity."""
import gzip, json, re, zipfile
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urljoin,urlparse,unquote
ROOT=Path(__file__).resolve().parents[1]/'dist'
missing=[]
remote=[]
class Page(HTMLParser):
    def __init__(self,p,mount):
        super().__init__();self.p=p;self.mount=mount;self.base='https://local.invalid'+mount+p.relative_to(ROOT).as_posix();self.importmap=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if tag=='base':self.base=urljoin(self.base,a.get('href',''));return
        self.importmap=tag=='script' and a.get('type')=='importmap'
        value=a.get('src') or a.get('href')
        self.check(value,tag=='a')
    def handle_endtag(self,tag):
        if tag=='script':self.importmap=False
    def handle_data(self,value):
        if self.importmap:
            for asset in json.loads(value).get('imports',{}).values():self.check(asset,directory=asset.endswith('/'))
    def check(self,value,external_link=False,directory=False):
        if not value or value.startswith(('#','data:','blob:','mailto:')):return
        u=urlparse(urljoin(self.base,value))
        if u.hostname!='local.invalid':
            if not external_link:remote.append(f'{self.p.relative_to(ROOT)} -> {value}')
            return
        if not u.path.startswith(self.mount):
            missing.append(f'{self.p.relative_to(ROOT)} escapes mount {self.mount}: {value}');return
        rel=unquote(u.path).removeprefix(self.mount)
        target=ROOT/rel
        if u.path.endswith('/') and not directory:target=target/'index.html'
        if not target.exists():missing.append(f'{self.p.relative_to(ROOT)} -> {value}')
for p in ROOT.rglob('*.html'):
    for mount in ('/','/nested/site/'):
        parser=Page(p,mount);parser.feed(p.read_text(encoding='utf-8'))
for p in ROOT.rglob('*.css'):
    for url in re.findall(r'url\([\'\"]?([^\)\'\"]+)',p.read_text(encoding='utf-8')):
        if url.startswith(('http:','https:','//')):
            remote.append(f'{p.relative_to(ROOT)} -> {url}');continue
        if url.startswith(('data:','#','%23')):continue
        if not (p.parent/url.split('?')[0]).exists():missing.append(f'{p.relative_to(ROOT)} -> {url}')
assert not missing,'\n'.join(missing)
assert not remote,'Remote runtime assets:\n'+'\n'.join(remote)
assert not list(ROOT.rglob('*.py'))
assert not list(ROOT.rglob('.env*'))
for name in ('index.html','admin/index.html','admin/sim/index.html','demo/index.html','demo-v2/index.html'):
    assert (ROOT/name).exists(),name
for name in ('runtime/vendor/oxigraph/web.mjs','runtime/vendor/oxigraph/web_bg.wasm'):
    assert (ROOT/name).exists(),name
payload=json.loads(gzip.decompress((ROOT/'data/source.json.gz').read_bytes()))
entries=payload['knowledge']['entries']
assert entries and all(e['source']=='illustrative' and e['demo'] for e in entries),'Only illustrative knowledge may be bundled'
assert payload['knowledge']['summary']['committed']==0,'Developer contributions must stay out of the release'
for key in ('PRACTICES','TRIGGER_LABELS','NEGATION'):
    assert key in payload['vocabulary'],key
assert payload['knowledge_queries']['templates'] and payload['knowledge_queries']['prefixes']
assert json.loads((ROOT/'demo/knowledge-summary.json').read_text(encoding='utf-8'))==payload['knowledge']['summary']
zip_path=Path(__file__).with_name('feed-test.zip')
if zip_path.exists():
    with zipfile.ZipFile(zip_path) as z:
        assert z.testzip() is None
        assert all(n in z.namelist() for n in ('recipe.json','truth.json','checks.json'))
print('PASS: root and nested-path assets/import maps; no remote runtime assets; 5 entrypoints; local RDF/WASM; no Python/config secrets; feed ZIP CRCs.')
