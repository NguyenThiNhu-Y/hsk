# Trích từ vựng từ PDF "NEW HSK3/4 3.0"

```bash
pdftotext -bbox "../NEW HSK3 3.0.pdf" /tmp/hv/h3.html
pdftotext -bbox "../NEW HSK4 3.0.pdf" /tmp/hv/h4.html
python3 tools/vocab_parse.py /tmp/hv/h3.html h3   # tách bảng theo toạ độ cột -> h3.html.json
python3 tools/vocab_parse.py /tmp/hv/h4.html h4
python3 tools/vocab_build.py /tmp/hv               # ghép từ + câu ví dụ -> /tmp/hv/vocab.json
```
Sau đó ghi `vocab/hsk3.jsonl`, `vocab/hsk4.jsonl` (mỗi dòng: level, no, hz, py, vi, ex{zh, py, vi}) rồi chạy `python3 build_data.py`.
