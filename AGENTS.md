# Calo Gym - hướng dẫn cho AI agent (Codex, agy, Claude)

App cá nhân (1 người dùng) theo dõi calo + lịch tập gym. PWA, chạy offline, dữ liệu lưu trên máy (IndexedDB), không có server.
Thiết kế chi tiết: `../docs/thiet-ke.md` (đọc trước khi đổi tính năng).

## Stack
React 19 + Vite + vite-plugin-pwa, Dexie (IndexedDB), Recharts. JavaScript thuần (không TypeScript). CSS thường, ưu tiên điện thoại.

## Lệnh
- `npm install`
- `npm run dev` chạy thử
- `npm test` (vitest, test hàm tính toán `src/calc.js`, `src/gemini.test.js`)
- `npm run lint` (oxlint)
- `npm run build` ra `dist/`

Trước khi báo xong: chạy `npm test` và `npm run lint`, cả hai phải qua.

## Cấu trúc
- `src/pages/`: Today, Eat, Gym, Progress (4 tab)
- `src/db.js`: schema Dexie. Đổi schema phải tăng version và viết migration, không làm mất dữ liệu cũ.
- `src/calc.js`: tính TDEE, mục tiêu kcal/protein
- `src/drive.js`: backup lên Google Drive; `src/gemini.js`: nhận diện món bằng ảnh
- `src/data/foods.json`: danh sách món (sinh từ Excel bằng `scripts/import_foods.py`)

## Quy ước
- Giữ app đơn giản, ghi nhanh ít bước. Không thêm thư viện nếu CSS/JS thường làm được.
- Không thêm tài khoản, server, đăng nhập.
- Giao diện và chữ hiển thị bằng tiếng Việt.
- Commit nhỏ, message tiếng Việt ngắn gọn, mô tả đúng thay đổi.
- Không commit `node_modules`, `dist`, `.env*`, `.taste-skill`, `graphify-out`.

## Bí mật
Không hard-code API key/token vào code hay commit. Không in key ra log hay trả lời.

## Làm việc song song nhiều agent
Mỗi agent làm trong worktree riêng (xem `scripts/new-agent-worktree.ps1`), nhánh `agent/<tên>`. Không sửa trực tiếp trên `main`. Khi xong báo danh sách file đã đổi để người dùng review rồi merge.
- Worktree hiện có: `../app-codex` (nhánh `agent/codex`), `../app-agy` (nhánh `agent/agy`). `../app` là `main`.
- Gộp: `git merge --ff-only agent/<tên>` trên `main`. Hai nhánh cùng sửa `src/index.css` dễ đụng nhau, gộp xong phải chạy lại test + build.
- Claude điều phối có thể giao việc qua CLI: `codex exec -s read-only -C <worktree> "..."` (chỉ đọc), `agy -p "..." --sandbox --dangerously-skip-permissions --mode accept-edits` (kèm quy tắc an toàn trong prompt). Việc rủi ro (xoá file, git commit/push/reset, cài gói, gọi mạng, sửa ngoài worktree) thì DỪNG, ghi dòng `CẦN HỎI: ...` để Claude hỏi người dùng.

## Deploy
- Push `main` lên GitHub là tự deploy GitHub Pages (workflow `.github/workflows/deploy.yml`, khoảng 30s): https://hunhgiaphu.github.io/calo-gym/
- **Hỏi người dùng trước mỗi lần deploy**, kể cả khi lần trước đã đồng ý.
- Deploy xong kiểm tra trang thật đã có code mới: `curl` file `assets/index-*.js` rồi grep một chuỗi vừa thêm. Trên iPhone phải tắt hẳn app mở lại 1-2 lần mới nhận bản mới; đổi icon thì phải xoá icon ở màn hình chính rồi thêm lại.

## Bài học đã gặp (đọc trước khi sửa)
- **Gemini / "Load failed":** model mặc định là `gemini-flash-lite-latest` (~10s). `gemini-flash-latest` hay quá tải, treo >60s nên Safari iPhone báo "Load failed"; đổi API key không giải quyết được. `recognize()` tự chuyển sang model mặc định khi model đã chọn trả 429/500/503 hoặc quá 30s. Muốn thử key thật thì gọi bằng `curl` trong terminal, không ghi key vào code/commit/log.
- **Google Drive backup** chỉ đăng nhập được trên origin `hunhgiaphu.github.io` (client ID giới hạn origin). Ở localhost thì test bằng `window.google` + `fetch` giả. `getToken()` phải gọi ngay trong lúc bấm nút (không `await` gì trước), không thì iPhone chặn cửa sổ đăng nhập. Dùng chung `backupToDrive()` trong `src/drive.js`.
- **PWA không chạy ngầm được trên iPhone**: không làm được backup tự động hoàn toàn; chỉ nhắc + nút 1 chạm ở tab Hôm nay.
- **Kiểm tra UI trên browser của Claude:** khung Browser bị ẩn thì CSS transition và animation Recharts bị bóp, ảnh chụp sai (vòng tròn/biểu đồ trống). Chèn `*{transition:none!important}` trước khi chụp, kiểm số liệu bằng DOM. Vite đôi khi bỏ lỡ khi file bị ghi 2 lần liên tiếp: `touch` file đó.
- **Danh sách món** (`foods.json`, 336 món) đã Việt hoá (file Excel gốc tên tiếng Anh bị rớt chữ f: "ish sauce"). `foods_rename.json` map tên cũ → tên Việt; Dexie v3 (`db.js`) tự đổi tên món gốc trên máy đã cài, `import_foods.py` giữ tên Việt khi nhập lại. Món không khớp danh sách đánh dấu `*` = số AI tra. Chỉ khớp món tính theo gram (món "theo phần" mà ghi gram thì 50g thành 50 phần).

## Giao diện (người dùng đã chốt)
- Nền đen OLED + chữ trắng + **một** màu nhấn lime `--accent` (vòng kcal, nút chính, tab đang chọn); vượt mục tiêu dùng `--bad` (đỏ). Chỉ dùng biến màu trong `src/index.css`, không viết mã màu thẳng.
- **Giữ emoji** 🔥 kcal · 🥩 protein · 🍚 carb · 🧈 fat (người dùng chọn, dù skill UI khuyên icon SVG). Font Be Vietnam Pro (dấu tiếng Việt chuẩn).
- Tab Hôm nay kiểu app calo trên App Store: vòng kcal lớn + 3 thẻ macro có vòng nhỏ. Thanh tab dính sát đáy, nền liền như app iPhone thường (người dùng không thích thanh nổi che nội dung); tab đang chọn tô chữ lime.
- Bữa ăn: Sáng / Trưa / Tối / Phụ. Chữ phụ phải đạt tương phản 4.5:1; nút bấm cao tối thiểu 44px.

## Tính năng đã có (đã deploy, cập nhật 26/11/2026)
- **Hôm nay:** vòng kcal + 3 thẻ macro; mũi tên ‹ › xem ngày trước (state `day` ở `App.jsx`, dùng chung với tab Ăn nên ghi món ăn đêm vào đúng hôm qua); ô cân nặng nhanh (`logWeight` ở `db.js`); gợi ý món cho đủ protein (`proteinPicks` ở `calc.js`, hiện khi thiếu ≥15g, mỗi món bù ≤40g, bấm Ghi vào bữa Phụ); mỗi món đã ăn hiện 🥩🍚🧈; nút Lưu vào Drive khi quá 7 ngày chưa backup.
- **Ăn:** ô "Thêm món" gồm 📷 Chụp món, 🖼 Gửi ảnh, 🏷 Nhãn (đọc bảng dinh dưỡng trên bao bì, lưu thành món để lần sau khớp), ô nhắn chữ ("2 trứng luộc, 1 chén cơm"); chung một bảng kcal/P/C/F, ô chat sửa món, hàng chọn bữa Sáng/Trưa/Tối/Phụ; lưu combo theo từng bữa. Đã bỏ ô tìm món và form "Món mới" (mọi món nhập qua AI, khớp danh sách Excel trước, không có mới thì AI tra). `recognize(input, fix, mode)` ở `gemini.js` nhận File hoặc chuỗi, mode `label`.
- **Tập:** 5 buổi mặc định (Push, Pull, Leg, Back + Chest, Arm + Vai + Abs) đang TRỐNG bài, người dùng tự thêm.
- **Tiến độ:** streak; cân + trung bình 7 ngày + gợi ý chỉnh kcal; "7 ngày qua" (`weekStats`); "Tiến bộ tạ" từng bài (`liftSeries`, `bestE1rm`, 1RM ước tính theo Epley); kcal 14 ngày; hồ sơ; khoá Gemini; Backup (Lưu vào Drive, **Khôi phục từ Drive** hỏi lại kèm ngày giờ bản trên Drive, Chia sẻ file, Nhập backup).
- **Dữ liệu:** Dexie version 3. `addLog` và `logWeight` nằm ở `db.js`.
- **CI:** `deploy.yml` tách 2 job `build` → `deploy`, action bản mới. Từng gặp lỗi chập chờn "No artifacts named github-pages": chạy lại bằng `gh workflow run deploy.yml --ref main`.

## Việc tồn đọng (đọc đầu phiên sau)
- **Chưa commit trên `main`:** `.gitignore` (thêm `graphify-out/`), `.env.example`, `scripts/new-agent-worktree.ps1`, và AGENTS.md này. `.env` đã tạo (để trống, nằm trong `.gitignore`); chỉ dành cho công cụ máy tính, KHÔNG đổi thành `VITE_...` vì Vite sẽ đưa key vào JS công khai.
- **Nhánh `agent/codex` đã cũ** (nội dung đã nằm trong `main` nhưng lịch sử khác). Trước khi làm tiếp, đưa nhánh về bằng `main` (việc có `reset --hard`, phải hỏi người dùng).
- **Chưa thử trên iPhone thật:** Khôi phục từ Drive, chụp nhãn, nhắn chữ, đăng nhập Google. Mới thử bằng Gemini/Google giả trên browser.
- **Key Gemini người dùng dán vào chat 20/11 chưa đổi** (người dùng quyết định bỏ qua). Không lên GitHub (đã quét lịch sử git và trang thật: sạch).
- **Ý tưởng chưa làm:** Siri/Phím tắt ghi món, chụp menu quán, chụp trước/sau khi ăn, dự đoán ngày đạt cân mục tiêu, AI coach, AI tạo giáo án cho tab Tập, AI nhận xét ngày ăn, ghi vòng eo, kcal theo ngày tập/nghỉ, xuất CSV.
- **Quy trình agent (toàn máy, không riêng project):** 4 agent mới `codex-reviewer`, `agy-reviewer`, `agy-security`, `final-checker` (Opus) và lệnh `/cross-check` đã tạo ở `~/.claude`. `final-checker` CHƯA thử vì chưa nạp trong phiên tạo; thử ở phiên sau bằng `/cross-check`. Codex phải chạy `codex exec` (không dùng `codex exec review` vì nó xin phép skill rồi đứng im); agy chạy ngầm chỉ được đọc file (không shell, không MCP).

