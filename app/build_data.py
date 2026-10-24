#!/usr/bin/env python3
"""Gộp data/*.jsonl -> data.js (const DATA = {lessons, words, texts, grammar}).

Chạy: python3 build_data.py
"""
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent
KINDS = {'lesson': 'lessons', 'word': 'words', 'text': 'texts', 'grammar': 'grammar'}


def main():
    out = {v: [] for v in KINDS.values()}
    seen = set()
    errors = []
    files = sorted((ROOT / 'data').glob('*.jsonl'))
    if not files:
        sys.exit('Không thấy file nào trong data/*.jsonl')
    for f in files:
        for n, line in enumerate(f.read_text(encoding='utf-8').splitlines(), 1):
            if not line.strip():
                continue
            try:
                r = json.loads(line)
            except json.JSONDecodeError as e:
                errors.append(f'{f.name}:{n}: JSON lỗi ({e})')
                continue
            kind = r.pop('kind', None)
            if kind not in KINDS:
                errors.append(f'{f.name}:{n}: kind không hợp lệ: {kind}')
                continue
            key = (kind, r.get('book'), r.get('lesson'), r.get('text'), r.get('no'), r.get('proper'), r.get('hz'))
            if key in seen:
                errors.append(f'{f.name}:{n}: trùng {key}')
                continue
            seen.add(key)
            if kind == 'word':
                r['hz'] = r['hz'].replace(' ', '').replace('　', '')
                r['proper'] = bool(r.get('proper'))
            out[KINDS[kind]].append(r)
    if errors:
        print('\n'.join(errors))
        sys.exit(1)
    for k in out:
        out[k].sort(key=lambda r: (r['book'], r['lesson'], r.get('text', 0), r.get('proper', False), r.get('no') or 0))
    js = '// File sinh tự động bởi build_data.py — đừng sửa tay, hãy sửa data/*.jsonl rồi chạy lại.\n'
    js += 'const DATA = ' + json.dumps(out, ensure_ascii=False, separators=(',', ':')) + ';\n'
    (ROOT / 'data.js').write_text(js, encoding='utf-8')
    for book in sorted({r['book'] for r in out['lessons']}):
        n = lambda k: sum(1 for r in out[k] if r['book'] == book)
        print(f"{book}: {n('lessons')} bài, {n('words')} từ, {n('texts')} bài khoá, {n('grammar')} điểm ngữ pháp")


if __name__ == '__main__':
    main()
