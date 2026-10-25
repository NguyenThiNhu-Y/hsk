import re, json, sys, html
CJK = re.compile(r'[一-鿿]')
def words_of(page):
    out = []
    for m in re.finditer(r'<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)</word>', page):
        x0, y0, x1, y1 = map(float, m.groups()[:4]); out.append((x0, y0, x1, y1, html.unescape(m.group(5))))
    return out
def lines(ws):
    ws = sorted(ws, key=lambda w: (round(w[1]), w[0]))
    res = []
    for w in ws:
        if res and abs(res[-1]['y'] - w[1]) < 4: res[-1]['ws'].append(w)
        else: res.append({'y': w[1], 'ws': [w]})
    for l in res: l['ws'].sort(key=lambda w: w[0])
    return res
JUNK = re.compile(r'ZALO|TIKTOK|CÁC BẠN|RẤT MONG|VÌ LÀ|谢谢大家')
def parse(path, cols):
    s = open(path, encoding='utf-8').read()
    pages = re.split(r'<page ', s)[1:]
    rows = []; ex_lines = []
    for pi, pg in enumerate(pages):
        ws = [w for w in words_of(pg) if not (pi == 0 and w[1] < 140)]
        ls_all = lines(ws)
        bad_y = {round(l['y']) for l in ls_all if JUNK.search(' '.join(w[4] for w in l['ws']))}
        ws = [w for w in ws if round(w[1]) not in bad_y]
        col = lambda w: next(k for k, (a, b) in cols.items() if a <= w[0] < b)
        centers = [((w[1] + w[3]) / 2, int(w[4])) for w in ws if col(w) == 'stt' and w[4].isdigit()]
        page_rows = []
        for cy, n in sorted(centers):
            r = {'no': n, 'cy': cy, 'hz': [], 'py': [], 'en': [], 'vi': []}
            rows.append(r); page_rows.append(r)
        for c in ('hz', 'py', 'en', 'vi'):
            for l in lines([w for w in ws if col(w) == c]):
                cy = l['y'] + 6
                if page_rows:
                    near = min(page_rows, key=lambda r: abs(r['cy'] - cy))
                    if cy < page_rows[0]['cy'] - 22 and len(rows) > len(page_rows):
                        near = rows[len(rows) - len(page_rows) - 1]
                else:
                    near = rows[-1]
                near[c].append((pi, l['y'], ' '.join(w[4] for w in l['ws'])))
        for l in lines([w for w in ws if col(w) == 'ex']):
            ex_lines.append(' '.join(w[4] for w in l['ws']))
    # gom câu ví dụ: bắt đầu câu mới khi dòng mở đầu bằng chữ Hán và câu hiện tại đã đủ 3 phần
    exs = []
    for t in ex_lines:
        if exs and not (CJK.match(t) and exs[-1].count('–') >= 2): exs[-1] += ' ' + t
        else: exs.append(t)
    return rows, exs
if __name__ == '__main__':
    path, which = sys.argv[1], sys.argv[2]
    cols = {'h3': {'stt': (0, 55), 'hz': (55, 139), 'py': (139, 222), 'en': (222, 306), 'vi': (306, 414), 'ex': (414, 9999)},
            'h4': {'stt': (0, 48), 'hz': (48, 131), 'py': (131, 213), 'en': (213, 296), 'vi': (296, 379), 'ex': (379, 9999)}}[which]
    rows, exs = parse(path, cols)
    print(len(rows), 'rows', len(exs), 'examples', 'nums ok' if [r['no'] for r in rows] == list(range(1, len(rows) + 1)) else 'NUM GAP')
    json.dump({'rows': [{k: v for k, v in r.items()} for r in rows], 'exs': exs}, open(path + '.json', 'w'), ensure_ascii=False)
