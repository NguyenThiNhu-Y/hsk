import json, re, sys
S = sys.argv[1]
CJK = '一-鿿'
def fix_exs(exs):
    out = []
    for e in exs:
        e = e.replace('分 他买了一台数码相机。– tích.', 'phân tích. 他买了一台数码相机。–')
        parts = re.split(r'\s(?=[%s][^–]*[。！？!?…]\s*–)' % CJK, e) if e.count('–') > 2 else [e]
        out += parts
    return out
def split_ex(e):
    p = [x.strip() for x in re.split(r'\s*–\s*', e, maxsplit=2)]
    return {'zh': p[0].replace(' ', ''), 'py': p[1] if len(p) > 1 else '', 'vi': p[2] if len(p) > 2 else ''}
res = {}
for n, level in (('h3', 3), ('h4', 4)):
    d = json.load(open(f'{S}/{n}.html.json'))
    exs = fix_exs(d['exs'])
    rows = d['rows']
    print(n, len(rows), len(exs))
    words = []
    for r, e in zip(rows, exs):
        toks = ' '.join(x[2] for x in r['hz'] + r['py']).split()
        hz = ''.join(t for t in toks if re.search('[%s]' % CJK, t))
        py = ' '.join(t for t in toks if not re.search('[%s()]' % CJK, t) and not re.search('[;]', t))
        py = re.sub(r'\s*（\s*', ' (', re.sub(r'\s*）', ')', py)).strip()
        if hz.count('（') > hz.count('）'):
            hz += '）'; py = re.sub(r'^\)\s*', '', py)
        w = {'no': r['no'], 'hz': hz, 'py': py, 'vi': ' '.join(x[2] for x in r['vi']), 'ex': split_ex(e)}
        words.append(w)
    bad = []
    for w in words:
        core = re.sub(r'（[^）]*）|\([^)]*\)', '', w['hz'])
        keys = [core] + core.split('｜') + [c for c in re.split(r'[…/、]', core) if c]
        if not any(k and k in w['ex']['zh'] for k in keys): bad.append((w['no'], w['hz'], w['ex']['zh']))
        if not (w['ex']['py'] and w['ex']['vi']): bad.append(('PARTS', w['no'], w['hz'], w['ex']))
    print(' mismatch', len(bad))
    for b in bad[:40]: print('  ', b)
    res[level] = words
for lv in res:
    for w in res[lv]:
        if False and w['no'] in (7,103,301,681,691,810,869,902,111,366,438,548,556,660,749): print(lv, w['no'], w['hz'], '|', w['py'], '|', w['vi'])
json.dump(res, open(f'{S}/vocab.json', 'w'), ensure_ascii=False, indent=0)
