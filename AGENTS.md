# Calo Gym - hướng dẫn cho AI agent (Codex, agy, Claude)

App cá nhân (1 người dùng) theo dõi calo + lịch tập gym. PWA chạy offline, dữ liệu lưu trên máy (IndexedDB), không có server.
Thiết kế chi tiết: `../docs/thiet-ke.md`. Tìm code nằm đâu: đọc `graphify-out/GRAPH_REPORT.md` hoặc `graphify query "..."` trước, đừng đọc nguyên file.

## Stack và lệnh
React 19 + Vite + vite-plugin-pwa, Dexie, Recharts. JavaScript thuần, CSS thường, ưu tiên điện thoại.
`npm run dev` · `npm test` (vitest) · `npm run lint` (oxlint) · `npm run build`. Trước khi báo xong: test và lint phải qua.

## Cấu trúc
- `src/pages/`: Today, Eat, Gym, Progress (4 tab)
- `src/db.js`: schema Dexie. Đổi schema phải tăng version + viết migration, không làm mất dữ liệu cũ.
- `src/calc.js`: hàm tính (TDEE, mục tiêu, streak, gợi ý protein...). `src/gemini.js`: AI nhận diện món. `src/drive.js`: backup Google Drive.
- `src/data/foods.json`: 336 món (từ Excel qua `scripts/import_foods.py`).

## Quy ước
- Giữ app đơn giản, ghi nhanh ít bước. Không thêm thư viện nếu CSS/JS thường làm được. Không thêm tài khoản, server, đăng nhập.
- Chữ hiển thị bằng tiếng Việt. Commit nhỏ, message tiếng Việt ngắn gọn.
- Không commit `node_modules`, `dist`, `.env*`, `.taste-skill`, `graphify-out`.
- Không hard-code API key/token, không in key ra log hay trả lời. `.env` chỉ cho công cụ máy tính, KHÔNG đổi thành `VITE_...` (Vite sẽ đưa key vào JS công khai).

## Nhiều agent song song
Mỗi agent làm trong worktree riêng (`scripts/new-agent-worktree.ps1`), nhánh `agent/<tên>`: `../app-codex`, `../app-agy`; `../app` là `main`. Không sửa code trực tiếp trên `main`.
- Gộp: `git merge --ff-only agent/<tên>` trên `main`, rồi chạy lại test + build. Hai nhánh cùng sửa `src/index.css` dễ đụng.
- Việc rủi ro (xoá file, commit/push/reset, cài gói, gọi mạng, sửa ngoài worktree) thì DỪNG, ghi `CẦN HỎI: ...`.

## Deploy
- Push `main` là tự deploy GitHub Pages (~30s): https://hunhgiaphu.github.io/calo-gym/. **Hỏi người dùng trước mỗi lần deploy.**
- Kiểm trang thật: `curl` file `assets/index-*.js` rồi grep chuỗi vừa thêm. iPhone phải tắt hẳn app mở lại 1-2 lần mới nhận bản mới; đổi icon phải xoá icon rồi thêm lại.
- CI từng lỗi chập chờn "No artifacts named github-pages": chạy lại `gh workflow run deploy.yml --ref main`.

## Bài học đã gặp
- **Gemini "Load failed":** model mặc định `gemini-flash-lite-latest` (~10s); `gemini-flash-latest` hay treo >60s làm Safari báo "Load failed". `recognize()` tự chuyển model mặc định khi 429/500/503 hoặc >30s. Thử key thật bằng `curl`, không ghi key vào code/log.
- **Drive backup** chỉ đăng nhập được trên origin `hunhgiaphu.github.io`. Ở localhost test bằng `window.google` + `fetch` giả. `getToken()` phải gọi ngay lúc bấm nút (không `await` trước), không thì iPhone chặn cửa sổ đăng nhập. PWA không chạy ngầm được trên iPhone nên chỉ có nhắc + nút 1 chạm.
- **Test UI trên browser Claude:** khung Browser ẩn thì CSS transition/animation Recharts bị bóp, ảnh chụp sai. Chèn `*{transition:none!important}` trước khi chụp, kiểm số liệu bằng DOM. Vite đôi khi bỏ lỡ khi file ghi 2 lần liên tiếp: `touch` file đó.
- **Danh sách món:** đã Việt hoá; `foods_rename.json` map tên cũ → Việt, Dexie v3 tự đổi tên trên máy đã cài. Món không khớp danh sách đánh dấu `*` = số AI tra. Chỉ khớp món tính theo gram (món "theo phần" ghi gram thì 50g thành 50 phần).

## Giao diện (người dùng đã chốt)
- Nền đen ngả tím (đổi từ đen + lime ngày 26/11, người dùng chọn) + chữ trắng + **một** màu nhấn tím violet `--accent` (#a78bfa); vượt mục tiêu dùng `--bad` (đỏ). Chỉ dùng biến màu trong `src/index.css`, không viết mã màu thẳng (mọi màu mới khai báo trong `:root`). Thẻ có gradient nhẹ + viền sáng + bóng; chuyển động chỉ opacity/transform, tắt khi `prefers-reduced-motion`.
- **Giữ emoji** 🔥 kcal · 🥩 protein · 🍚 carb · 🧈 fat · 🍬 đường. Font Be Vietnam Pro.
- Hôm nay kiểu app calo: vòng kcal lớn + 3 thẻ macro. Thanh tab dính sát đáy, nền liền (không thanh nổi); tab chọn tô chữ tím + chấm nhỏ phía trên.
- Chữ phụ tương phản ≥4.5:1; nút cao tối thiểu 44px.

## Tính năng đã có (đã deploy, 26/11/2026)
- **Hôm nay:** vòng kcal + macro, xem ngày trước (state `day` ở `App.jsx`), ô cân nặng nhanh, gợi ý món đủ protein, thanh 🍬 đường x/36g (`SUGAR_LIMIT`, mức AHA cho nam, đỏ khi vượt), mục tiêu kcal đổi theo ngày tập/nghỉ (`dayAdjust` ở `calc.js`: ngày có lịch tập +`TRAIN_DELTA`=150, ngày nghỉ trừ bù để trung bình tuần = mục tiêu gốc; chưa xếp lịch thì không đổi; tab Tiến độ vẫn dùng mục tiêu gốc), nút Lưu vào Drive khi >7 ngày chưa backup.
- **Ăn:** khối "Hay ăn" (`frequentFoods` ở `calc.js`: món nhiều lần nhất 30 ngày qua, lượng lần gần nhất, bấm 1 chạm ghi vào bữa đang chọn; ẩn khi chưa có log); 📷 Chụp món, 🖼 Gửi ảnh, 🏷 Nhãn, nhắn chữ; bảng kcal/P/C/F/🍬; chat sửa món; combo theo bữa. Mọi món qua AI, khớp danh sách trước, không có thì AI tra.
- **Tập:** 5 buổi mặc định đang TRỐNG bài, người dùng tự thêm.
- **Tiến độ:** streak, cân + TB 7 ngày + gợi ý kcal, 7 ngày qua, tiến bộ tạ (1RM Epley), hồ sơ, khoá Gemini, Backup (Drive, Khôi phục từ Drive, chia sẻ/nhập file).
- **Dữ liệu:** Dexie version 3. Trường tuỳ chọn không cần đổi version:
  - `s` = gram đường trên 100g. Thiếu = "chưa biết" (`nutrients` không trả `s`, `sumLogs` coi là 0, bảng hiện "–"). 336 món gốc chưa có `s`, món khớp danh sách sẽ học số đường AI lần đầu (`foodFor`). Là tổng đường (cả trái cây/sữa), còn mức AHA tính đường thêm vào.
  - `liq: true` = đồ uống, chỉ để HIỂN THỊ ml (`qtyLabel` ở `calc.js`), tính dinh dưỡng vẫn như gram. Món gốc trong danh sách chưa có `liq`, được đánh dấu khi AI nhận ra lần đầu.

## Việc tồn đọng
- Chưa thử trên iPhone thật: Khôi phục từ Drive, chụp nhãn, nhắn chữ, đăng nhập Google, và số đường/ml Gemini thật trả. Mới thử bằng Gemini/Google giả.
- Key Gemini dán vào chat 20/11 chưa đổi (người dùng quyết định bỏ qua; không lên GitHub, đã quét sạch).
- Nhánh `agent/agy` (`../app-agy`) cũ hơn `main`: làm tiếp thì `git merge --ff-only main` trong đó.
- Ý tưởng chưa làm: Siri/Phím tắt ghi món, chụp menu quán, dự đoán ngày đạt cân mục tiêu, AI coach, AI tạo giáo án, ghi vòng eo, xuất CSV, đánh dấu sẵn đồ uống trong `foods.json`.
