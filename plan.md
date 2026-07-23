# Plan tách file (File-Splitting Refactor)

> **Mục đích của file này:** Hướng dẫn tách các file lớn trong repo HaloChat frontend thành nhiều file nhỏ hơn, **không phá logic, không phá giao diện**. File này được viết để **mỗi phiên chat mới đọc là làm được ngay** — mỗi session xử lý **đúng 1 file mục tiêu** rồi mở session mới cho file tiếp theo (tránh context phình to).
>
> **Đọc file này trước khi bắt đầu bất kỳ session tách file nào.** Đọc kèm `AGENTS.md` ở repo root.

---

## 0. Quy tắc vàng (đọc kỹ trước khi làm)

Tuân theo `AGENTS.md`. Tóm tắt các ràng buộc bắt buộc:

1. **Chỉ được di chuyển code, KHÔNG được sửa logic.** Tách file = cut & paste + thêm `import`/`export`. Không đổi thuật toán, không "tiện tay" tối ưu.
2. **Không đổi tên** biến/hàm/component/prop trừ khi bắt buộc để tránh trùng tên khi tách.
3. **Không tạo abstraction mới** (không gộp, không tách thêm hàm, không đổi cấu trúc dữ liệu) trừ khi bắt buộc.
4. **Giữ nguyên tuyệt đối:** API endpoint, payload gửi đi, cách đọc response, xử lý lỗi, thứ tự side-effect, class Tailwind / inline style / cấu trúc DOM.
5. **Không refactor code không liên quan.** Chỉ đụng vào đúng file đang tách + các file import mới sinh ra.
6. **Mỗi session 1 file mục tiêu.** Làm xong 1 file (đã verify pass) thì dừng, commit/report, mở session mới cho file kế tiếp.
7. **Nếu gặp quyết định gây tranh cãi** (ví dụ: có nên gộp code trùng lặp không) → **KHÔNG tự quyết**. Ghi rõ ra và hỏi user. Xem mục "Điểm cần quyết định" ở từng file.

---

## 1. Phân loại rủi ro khi tách (BẮT BUỘC hiểu)

Chia code cần tách làm 2 loại. Cách xử lý khác nhau.

### 1a. Tách AN TOÀN (safe extraction) — ưu tiên làm trước
Cut & paste thuần, gần như không rủi ro:
- **Types / interfaces / enums** → đưa ra file riêng (ví dụ `types.ts` cạnh file gốc, hoặc `src/types/`).
- **Constants thuần** (không phụ thuộc state/props runtime).
- **Hàm pure** (không dùng hook, không đọc state ngoài, chỉ nhận input → trả output).
- **Component con thuần** chỉ nhận props, **không** có `useState`/`useEffect`/`useRef`/`useContext` bên trong, không đọc biến closure từ component cha.

Cách làm: cut ra file mới → `export` → `import` lại vào file gốc. Verify build.

### 1b. Tách CÓ STATE (stateful extraction) — rủi ro cao, làm cẩn thận
Component/logic mang `useState` / `useEffect` / `useRef` / `useContext`, hoặc đọc biến từ closure của component cha. **User đã chọn tách cả loại này.** Rủi ro: mất state, re-render sai, effect chạy 2 lần / mất effect, closure bắt sai giá trị.

Hai cách tách hợp lệ:

**Cách A — Tách thành custom hook** (`src/hooks/useXxx.ts`):
- Dùng khi: một cụm state + effect + handler gắn với nhau về mặt logic (ví dụ: logic emoji picker, logic sidebar media, logic click-outside).
- Đưa toàn bộ cụm `useState/useEffect/useRef/useCallback` đó vào 1 hàm `useXxx()`, `return` ra đúng các giá trị + setter + handler mà component cha đang dùng.
- Component cha đổi từ khai báo state inline → `const { ... } = useXxx(...)`.
- **Giữ NGUYÊN thứ tự các hook** trong component cha. React tính hook theo thứ tự gọi — đổi thứ tự = bug. Nếu hook mới gói nhiều `useState`, thứ tự nội bộ trong hook cũng phải giữ như cũ.
- Truyền vào hook các dependency cần thiết (ví dụ giá trị từ props/state khác) qua tham số — **không** để hook tự đọc biến ngoài.

**Cách B — Tách thành component con giữ state của chính nó**:
- Dùng khi: một mảng UI có state cục bộ, **không** bị component cha đọc lại state đó (ví dụ 1 popup tự quản lý open/close của riêng nó).
- Chỉ tách được nếu state đó **không** được cha hay anh em component dùng. Nếu cha cần đọc/ghi state đó → **không** tách kiểu này, dùng Cách A hoặc nâng state lên (nhưng nâng state = đổi logic → phải hỏi user).
- Props truyền xuống phải đủ để component con hoạt động y hệt. Callback (onXxx) phải giữ đúng chữ ký.

**Quy tắc chung cho 1b:**
- Sau khi tách, số lần `useEffect` chạy phải y như cũ. Cẩn thận với `<StrictMode>` (dev chạy effect 2 lần — đó là bình thường, so sánh trước/sau chứ đừng hoảng).
- Không đổi dependency array của `useEffect`/`useCallback`/`useMemo`. Copy y nguyên. Nếu bắt buộc thêm dep vì đổi scope → ghi chú lại và kiểm tra kỹ.
- `useRef` phải nằm cùng phía với nơi dùng ref đó. Đừng để ref bị tạo lại mỗi render.

---

## 2. Quy trình chuẩn cho MỖI session tách file

Làm tuần tự:

1. **Đọc** `AGENTS.md` + mục 0,1,2 của file này.
2. **Đọc toàn bộ file mục tiêu.** Vẽ ra trong đầu: các top-level symbol (type/const/component/hook), cụm state, các ranh giới logic (thường có comment section).
3. **Chốt phạm vi tách của session này.** Ưu tiên phần AN TOÀN (1a) trước. Nếu file quá lớn, có thể trong 1 session chỉ tách 1 cụm — ghi rõ đã tách gì, còn gì.
4. **Chạy baseline TRƯỚC khi sửa** (xem mục 3) để có mốc so sánh chính xác trên máy hiện tại.
5. **Tách:** tạo file mới, cut code sang, thêm `export`/`import`. Giữ nguyên format, comment, thứ tự.
6. **Verify** (xem mục 3). So với baseline. Không được phát sinh lỗi mới.
7. **Kiểm tra tay giao diện/logic** nếu có thể (xem mục 4).
8. **Report** cho user: đã tách gì → file nào, kết quả `tsc`/`eslint` so với baseline, còn phần nào chưa tách. Rồi **dừng** — file tiếp theo để session mới.

---

## 3. Verify (BẮT BUỘC sau mỗi lần tách)

Chạy tại repo root HaloChat:

```bash
npx tsc -b
npx eslint .
```

(Scripts tương đương trong `package.json`: `build` = `tsc -b && vite build`, `lint` = `eslint .`.)

### Baseline đã tồn tại từ TRƯỚC (KHÔNG phải lỗi do bạn gây ra)

> ⚠️ Baseline dưới đây là số liệu tại thời điểm viết plan. **Luôn chạy lại baseline ở đầu session** để lấy số thực tế trên máy, vì repo có thể đã thay đổi. Nguyên tắc là: **so sánh trước/sau, không được có lỗi MỚI.**

- **`tsc -b`: 3 lỗi có sẵn**, đều trong `src/pages/AppealPage.tsx` (file này KHÔNG đụng tới khi tách):
  - `FileImage` import không dùng (dòng ~4)
  - `STATUS_LABELS` const không dùng (dòng ~42)
  - `PENALTY_LABELS` const không dùng (dòng ~49)
  - → Bất kỳ lỗi `tsc` nào xuất hiện Ở FILE KHÁC sau khi tách = **regression, phải sửa** trước khi coi là xong.

- **`eslint .`: ~253 problems (236 errors, 17 warnings)** có sẵn.
  - → Sau khi tách, số problems **không được tăng**. Nếu tăng, đó là do phần vừa tách → phải sửa. (Lỗi eslint có sẵn không liên quan thì kệ, không tự sửa — đó là refactor ngoài phạm vi.)

**Định nghĩa "xong":** `tsc` không có lỗi mới ngoài 3 lỗi AppealPage; `eslint` không tăng số problems. Nếu build `vite build` được yêu cầu thì cũng phải pass.

---

## 4. Kiểm tra logic/giao diện bằng tay (nếu môi trường cho phép)

`tsc`/`eslint` chỉ bắt lỗi type/style, KHÔNG bắt lỗi logic runtime. Nếu có thể chạy `npm run dev`, kiểm nhanh phần vừa tách:
- Component render đúng như cũ (không lệch layout, không mất phần tử).
- State vẫn hoạt động (mở/đóng popup, gõ input, toggle... như cũ).
- Effect vẫn chạy (ví dụ: click outside vẫn đóng menu, socket vẫn nhận event).
- Không có lỗi đỏ trong console.

Nếu không chạy được dev server: rà lại bằng mắt cực kỹ phần state/effect/closure, và **báo user rằng chưa kiểm tra runtime**.

---

## 5. Quy ước đặt file mới

- **Custom hook** → `src/hooks/useXxx.ts` (đã có sẵn: `useNotifications.ts`, `useRelationships.ts` — theo mẫu này).
- **Component dùng chung** → `src/components/` (subfolder `admin/` cho admin, `ui/` cho UI nguyên thủy).
- **Component chỉ dùng bởi 1 page** → có thể đặt file cạnh page đó hoặc trong subfolder riêng của page. Ưu tiên đặt cạnh cho dễ tìm, trừ khi nó rõ ràng dùng chung.
- **Types/consts riêng của 1 file** → `types.ts` / `constants.ts` đặt cạnh file gốc, hoặc dùng `src/types/`, `src/constants/` nếu dùng chung.
- Không đổi cấu trúc thư mục hiện có. Chỉ thêm file mới.

Cấu trúc `src/` hiện tại: `assets`, `components` (`admin`, `ui`), `constants`, `context`, `hooks`, `lib`, `pages`, `queries`, `services`, `store`, `types`, `utils`.

---

## 6. Danh sách file mục tiêu (theo thứ tự ưu tiên)

Làm **từ trên xuống**, **mỗi file 1 session**. File càng to càng nhiều state → càng cần cẩn thận; nhưng thứ tự dưới đây ưu tiên theo mức độ "đáng tách" (to + lặp lại nhiều).

| # | File | Dòng | Ghi chú |
|---|------|------|---------|
| 1 | `src/pages/ChatPage.tsx` | ~4322 | To nhất, rủi ro cao nhất. Xem 6.1. |
| 2 | `src/pages/admin/UsersTab.tsx` | ~1829 | Có điểm cần quyết định. Xem 6.2. |
| 3 | `src/pages/ProfilePage.tsx` | ~1127 | Xem 6.3. |
| 4 | `src/pages/admin/AuditLogsTab.tsx` | ~967 | |
| 5 | `src/pages/admin/ReportsTab.tsx` | ~809 | |
| 6 | `src/pages/FriendsPage.tsx` | ~679 | |
| 7 | `src/components/NotificationsCenter.tsx` | ~649 | |
| 8 | `src/components/MessageBubble.tsx` | ~628 | |
| 9 | `src/pages/admin/MaintenanceTab.tsx` | ~589 | |
| 10 | `src/services/api.ts` | ~553 | Cẩn thận: đụng vào đây ảnh hưởng toàn app. Tách theo nhóm endpoint, giữ nguyên mọi export. |
| 11 | `src/pages/admin/AdminLayout.tsx` | ~545 | Ở `src/pages/admin/`, không phải `components`. |
| 12 | `src/components/admin/ResolveReportModal.tsx` | ~471 | Ở `src/components/admin/`. |

> Line count là số tại thời điểm viết plan — **đọc lại file để lấy số thật** ở đầu mỗi session.

---

### 6.1 — `src/pages/ChatPage.tsx` (~4322 dòng)

File lớn & rủi ro nhất. Nhiều hook (đếm được ~140+ lần dùng hook/top-level). Chứa cả UI gọi WebRTC (state phức tạp). **Đừng cố tách hết trong 1 session** — có thể chia thành nhiều session, mỗi session 1 cụm.

Các ranh giới logic (theo comment section đã tìm thấy — số dòng có thể đã dịch chuyển, dùng để định vị chứ đừng tin tuyệt đối):
- `User Profile Popup States` (~415)
- `Handle click outside for Emoji Picker` (~570)
- `SIDEBAR MEDIA LOGIC` (~1701)
- `Handle window focus to mark conversation as read` (~2068)
- `Group Management Handlers` (~2598)

Gợi ý cụm tách (ưu tiên từ dễ → khó):
1. **An toàn trước:** types/interfaces, constants, sub-component thuần (nếu có) → file riêng.
2. **Click-outside / Emoji Picker** → custom hook (`useClickOutside`-style hoặc `useEmojiPicker`). Chú ý `useRef` + `useEffect` addEventListener/removeEventListener phải đi cùng nhau.
3. **Sidebar media logic** → custom hook (`useSidebarMedia`), gói state + fetch liên quan.
4. **Group management handlers** → có thể gom vào hook nếu chúng chia sẻ state.
5. **WebRTC/call UI** → rủi ro cao nhất, để CUỐI, tách thành hook riêng nếu tự tin; nếu không chắc thì để nguyên và báo user.

Luôn giữ nguyên thứ tự hook trong ChatPage. Mỗi lần tách 1 cụm → verify → report → dừng nếu cần.

---

### 6.2 — `src/pages/admin/UsersTab.tsx` (~1829 dòng)

**⚠️ ĐIỂM CẦN QUYẾT ĐỊNH — HỎI USER, KHÔNG TỰ QUYẾT:**

1. File này có **`MuiSelect` cục bộ** gần-trùng với `src/components/admin/MuiSelect.tsx` (bản dùng chung) nhưng **KHÁC** ở một vài prop/style. **KHÔNG tự gộp** vào bản chung (sẽ đổi hành vi/giao diện). Nếu muốn tách `MuiSelect` local ra file riêng thì tách **nguyên trạng** (giữ y hệt) thành file cạnh UsersTab. Việc hợp nhất 2 bản là **thay đổi logic** → phải hỏi user trước.
2. Có const `LIMIT` kèm comment TODO (đổi lại giá trị sau khi test). **KHÔNG tự sửa giá trị.** Chỉ di chuyển nếu tách, giữ nguyên cả comment.

Ngoài 2 điểm trên, tách theo quy trình thường: types/consts an toàn trước, rồi sub-component/hook.

---

### 6.3 — `src/pages/ProfilePage.tsx` (~1127 dòng)

Tách theo quy trình chuẩn. Ưu tiên tách form sections / tab thành component con (giữ nguyên props & handler), và cụm state liên quan thành hook nếu chúng dính nhau. Giữ nguyên mọi call API cập nhật profile (endpoint/payload).

---

### 6.4 → 6.12 — Các file còn lại

Chưa khảo sát chi tiết per-file. Khi tới lượt, ở đầu session hãy:
1. Đọc toàn bộ file, liệt kê top-level symbol + cụm state + comment section.
2. Phân loại 1a (an toàn) vs 1b (có state).
3. Tách phần an toàn trước, phần có state theo Cách A/B ở mục 1b.
4. Verify theo mục 3.

Lưu ý riêng:
- **`api.ts` (#10):** đây là hạ tầng dùng toàn app. Tách theo **nhóm endpoint** (ví dụ authApi, userApi, mediaApi...) sang các file `src/services/*.ts`, nhưng **giữ nguyên mọi tên export** và **re-export** lại từ `api.ts` để chỗ import cũ không gãy. Không đổi interceptor, base URL, header, logic refresh token.
- **`AdminLayout.tsx` (#11):** đường dẫn đúng là `src/pages/admin/AdminLayout.tsx`.
- **`ResolveReportModal.tsx` (#12):** đường dẫn đúng là `src/components/admin/ResolveReportModal.tsx`.

---

## 7. Checklist rút gọn (dán vào đầu mỗi session)

- [ ] Đọc `AGENTS.md` + plan.md (mục 0,1,2,3).
- [ ] Chạy baseline `npx tsc -b` & `npx eslint .`, ghi lại số.
- [ ] Đọc hết file mục tiêu, chốt phạm vi tách session này.
- [ ] Tách an toàn (1a) trước, có state (1b) sau — giữ nguyên thứ tự hook, dep array, DOM/CSS.
- [ ] Không đụng file khác ngoài phạm vi. Không gộp code trùng lặp khi chưa hỏi.
- [ ] Verify: `tsc` không lỗi mới (ngoài 3 lỗi AppealPage), `eslint` không tăng problems.
- [ ] Kiểm tra runtime nếu chạy được dev; nếu không, báo user chưa test runtime.
- [ ] Report: tách gì → đâu, kết quả verify, phần còn lại. Dừng, mở session mới cho file kế.
