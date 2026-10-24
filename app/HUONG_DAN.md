# Học HSK 3–4

Web học theo giáo trình **Chuẩn HSK 3** (20 bài) và **Chuẩn HSK 4 Thượng** (10 bài), bản tiếng Việt.

## Có gì trong app

| Phần | Nội dung |
|---|---|
| **Bài học** | Mỗi bài có 3 tab. **Từ mới**: pinyin, từ loại, nghĩa, âm Hán Việt. **Bài khoá**: từng câu kèm pinyin và bản dịch, có 🔊 nghe từng câu hoặc cả bài. **Ngữ pháp**: giải thích và câu ví dụ. |
| **Flashcard** | Mặt trước là chữ Hán. Mặt sau có pinyin, nghĩa, Hán Việt, câu ví dụ lấy từ bài khoá và các từ có chung chữ. Ôn lại theo lịch 1 → 3 → 7 → 14 → 30 ngày. |
| **Luyện tập** | 6 dạng câu hỏi: chọn nghĩa, chọn pinyin đúng dấu thanh, chọn chữ Hán, nghe chọn chữ, 选词填空 (điền từ), 连词成句 (sắp xếp câu). Từ nào làm sai sẽ quay lại hàng ôn. |
| **Từ vựng** | Tra theo chữ Hán, pinyin (gõ không dấu cũng được), nghĩa hoặc Hán Việt. |
| **Đồng bộ** | Nhập cùng một username trên mọi máy là dùng chung tiến độ. |

Số liệu:
- HSK 3: 20 bài, 325 từ, 80 bài khoá, 47 điểm ngữ pháp.
- HSK 4 Thượng: 10 bài, 324 từ, 50 bài khoá, 50 điểm ngữ pháp.

Phát âm dùng giọng tiếng Trung có sẵn của trình duyệt. Trên iPhone/Mac giọng có sẵn. Trên Windows, nếu không nghe được thì cài thêm ngôn ngữ "中文(简体)" trong Settings → Time & Language → Speech.

## Cấu trúc thư mục

```
index.html, style.css, app.js   giao diện + logic
sync.js, sync-config.js         đồng bộ qua Firebase
data/*.jsonl                    DỮ LIỆU GỐC (chép từ giáo trình) — sửa ở đây
build_data.py                   gộp data/*.jsonl -> data.js
data.js                         file sinh tự động, đừng sửa tay
```

## Sửa dữ liệu

1. Mở file `data/hsk3_Lxx-yy.jsonl` hoặc `data/hsk4_...jsonl`. Mỗi dòng là một bản ghi, `kind` là `lesson`, `word`, `text` hoặc `grammar`.
2. Sửa xong thì chạy:

   ```bash
   python3 build_data.py
   ```

3. Tăng số `?v=` trong `index.html`, ví dụ `data.js?v=1` → `data.js?v=2`, để trình duyệt tải lại file mới.

## Chạy thử trên máy

Mở thẳng file `index.html` bằng trình duyệt là chạy được.

## Tách ra repo riêng và đưa lên GitHub Pages

```bash
cp -R "hsk/app" ~/Documents/hoc-hsk     # chép thư mục app ra chỗ mới
cd ~/Documents/hoc-hsk
git init && git add . && git commit -m "Học HSK 3-4"
git branch -M main
git remote add origin https://github.com/<tên-github>/hoc-hsk.git
git push -u origin main
```

Sau đó trên GitHub vào **Settings → Pages → Branch: main / (root) → Save**. Web sẽ có ở `https://<tên-github>.github.io/hoc-hsk/`.

## Đồng bộ

- App đang dùng chung project Firebase `tuvungn4` với app N4.
- Tiến độ HSK lưu ở document `users/{username}.hsk`, nên không đè lên tiến độ N4, và luật bảo mật hiện tại vẫn cho phép (đã kiểm tra).
- Username tối đa 26 ký tự.
- Nếu muốn project riêng: tạo Firebase project mới theo `DONG_BO.md` của app N4, rồi thay `projectId` và `apiKey` trong `sync-config.js`.

## Lưu ý về dữ liệu

- **Phần đã chép:** 生词 (từ mới), 课文 (bài khoá) và 注释 (ngữ pháp). Phần 热身, 练习, 扩展, 文化 không chép.
- **Pinyin bài khoá** lấy theo mục 拼音 của sách. Vài chỗ sách in thiếu dấu đã được sửa theo chuẩn, ví dụ "Kexue" → "Kēxué".
- **Tự soạn thêm (sách không có):** pinyin của câu ví dụ ngữ pháp, toàn bộ bản dịch bài khoá và âm Hán Việt. Nếu thấy chỗ nào chưa đúng, sửa trong `data/` như hướng dẫn ở trên.
