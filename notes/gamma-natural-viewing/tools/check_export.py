"""Check scientific export integrity and static links; stdlib only."""
from pathlib import Path
from html.parser import HTMLParser
from urllib.parse import urlsplit, unquote
import gzip
import hashlib
import json
import math

ROOT=Path(__file__).resolve().parents[1]
def load(p): return json.loads(gzip.decompress(p.read_bytes()))
def increasing(x): return all(b>a for a,b in zip(x,x[1:]))
def numeric(x): return x is not None and math.isfinite(x)

class Links(HTMLParser):
    def __init__(self): super().__init__(); self.links=[]; self.ids=set(); self.noindex=False
    def handle_starttag(self,tag,attrs):
        a=dict(attrs)
        if 'id' in a: self.ids.add(a['id'])
        for k in ('src','href'):
            if k in a:self.links.append(a[k])
        if tag=='meta' and a.get('name')=='robots':self.noindex='noindex' in a.get('content','')

pages={}
for p in ROOT.rglob('*.html'):
    parser=Links();parser.feed(p.read_text());pages[p.resolve()]=parser
    assert parser.noindex,p
for p,doc in pages.items():
    for href in doc.links:
        url=urlsplit(href)
        if url.scheme or url.netloc or not url.path and not url.fragment:continue
        target=(p.parent/unquote(url.path)).resolve() if url.path else p
        if target.is_dir():target=target/'index.html'
        assert target.exists(),(p,href)
        if url.fragment and target in pages:assert unquote(url.fragment) in pages[target].ids,(p,href)

cohort=load(ROOT/'data/cohort/manifest.json.gz')
assert len(cohort['sessions'])==30
assert sum(n.startswith('Allen_') for n in cohort['sessions'])==14
for ref in cohort['references']:
    for name in ['all']+cohort['sessions']:
        d=load(ROOT/f'data/cohort/{ref}/{name}.json.gz')
        assert d['ready'] and d['line']==0 and d['reference']==ref
        assert d['time'][0]==-100 and d['time'][-1]==300
        assert increasing(d['time']) and increasing(d['frequency'])
        if name=='all':assert d['eligible_saccades']==135797 and d['trials']==4310
        else:assert d['selected_sessions']==[name]
        for p in d['panels']:
            for key in ['power_z','ispc']:
                assert len(p[key])==len(d['frequency'])
                assert all(len(row)==len(d['time']) for row in p[key])
            assert all(0<=v<=1 for row in p['ispc'] for v in row if numeric(v))

selection=load(ROOT/'data/fixations/manifest.json.gz');clips=variants=0
assert selection['eye_signals']==['velocity','position']
for session in selection['sessions']:
    root=ROOT/'data/fixations'/session;m=load(root/'session.json.gz')
    assert len(m['fixations'])==6 and len(m['public_contacts'])==2
    assert m['default_contact'] in m['public_contacts']
    assert load(root/'rf.json.gz')[str(m['default_unit'])]['available'],session
    for f in m['fixations']:
        folder=root/str(f['ordinal']);c=load(folder/'common.json.gz');clips+=1
        assert c['session']==session and c['fixation']['ordinal']==f['ordinal']
        assert 'cloud' not in c['image']['filename'].casefold(),c['image']['filename']
        assert increasing(c['eye_t']) and increasing(c['velocity_t'])
        assert len(c['spike_t'])==len(c['spike_units'])
        assert len(c['crop']['t'])==len(c['crop']['roi'])==len(c['crop']['valid'])
        for ref in selection['references']:
            for ch in m['public_contacts']:
                prefix=folder/ref/str(ch);t=load(prefix/'trace.json.gz');variants+=1
                assert t['channel']==ch and t['reference']==ref and increasing(t['t'])
                assert len(t['field'])==len(t['channels'])==len(t['fast'])
                assert all(len(row)==len(t['t']) for row in t['field']+t['fast'])
                assert sum(numeric(v) for v in t['field'][t['channels'].index(ch)])==t['quality']['selected_accepted_samples']>0
                for window in selection['windows']:
                    for method in selection['methods']:
                        tf=load(prefix/f'tf-{window}-{method}.json.gz');eye=load(folder/f'eye-{window}-{method}.json.gz')
                        position=load(folder/f'eye-position-{window}-{method}.json.gz')
                        assert position['signal']=='position' and position['units']=='arcmin'
                        assert position['time_ms']==tf['time_ms']
                        assert tf['window_ms']==window and tf['method']==method
                        assert increasing(tf['time_ms']) and tf['lfp']['valid_windows']>0
                        for signal in [tf['lfp'],eye,position]:
                            assert len(signal['power'])==len(tf['frequencies'])
                            assert all(len(row)==len(tf['time_ms']) for row in signal['power'])
                            assert sum(signal['valid'])==signal['valid_windows']
                            assert all(v is None or v>=0 for row in signal['power'] for v in row)
                            assert len(signal['band_power'])==len(signal['rms'])==3
                            for power,rms in zip(signal['band_power'],signal['rms']):
                                assert len(power)==len(rms)==len(tf['time_ms'])
                                for p,r in zip(power,rms):
                                    assert (p is None)==(r is None)
                                    if p is not None:assert math.isclose(r*r,p,rel_tol=2e-6)
                for band in selection['phase_bands']:
                    phase=load(prefix/f'phase-{band}.json.gz')
                    assert phase['band']==band and phase['time_ms']==t['t']
                    assert len(phase['spikes']['selected']['angle'])==len(c['spike_t'])
                    assert phase['guides']['selected']['channel']==ch
                    assert len(phase['guides']['selected']['waveform'])==len(t['t'])
                    assert all(v is None or 0<=v<=2*math.pi+1e-6 for v in phase['spikes']['selected']['angle'])

for f in ROOT.rglob('*.json.gz'):
    text=gzip.decompress(f.read_bytes()).decode()
    assert not any(s in text for s in ['/home/','/mnt/','192.168.','127.0.0.1','recording.dat']),f
for f in json.loads((ROOT/'figure_manifest.json').read_text()):
    assert hashlib.sha256((ROOT/f['figure']).read_bytes()).hexdigest()==f['sha256']
print(f'PASS: {len(pages)} pages, 30 sessions × 3 references, {clips} fixations, {variants} contact/reference clips; position/velocity spectra, all spectral presets and phase bands.')
