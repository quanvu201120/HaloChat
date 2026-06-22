# HaloChat FE Refactor Plan

Mục tiêu: refactor frontend HaloChat sang stack hiện đại theo từng bước nhỏ, có thể dừng và tiếp tục an toàn giữa các phiên chat.

## Cách dùng file này

- Mỗi task xong thì tick `x`.
- Nếu chuyển sang chat khác, chỉ cần đọc lại file này để biết đang ở bước nào.
- Mỗi phase nên dừng lại để kiểm tra build / runtime trước khi sang phase tiếp theo.

## Trạng thái hiện tại

- [x] Đã audit sơ bộ cấu trúc FE
- [x] Đã xác nhận project là `Vite + React`
- [x] Đã xác nhận hiện đang dùng `Context` + CSS thủ công
- [x] Đã đọc skill `frontend-patterns` và bám theo nó
- [ ] Chưa bắt đầu refactor code

## Phase 0 - Chốt baseline

- [x] Đọc các file lõi: `App.tsx`, `AppLayout.tsx`, `AuthContext.tsx`, `ChatContext.tsx`, `ThemeContext.tsx`, `ToastContext.tsx`, `api.ts`
- [x] Đọc các màn hình quan trọng: `LoginPage.tsx`, `RegisterPage.tsx`, `ChatPage.tsx`, `Modal.tsx`
- [x] Xác định `ChatPage` là file nặng nhất và có nhiều state / side effect nhất
- [x] Xác định `ChatContext` đang ôm conversations, unread, online, typing, socket lifecycle
- [x] Xác định `AuthContext` đang xử lý persist login state bằng localStorage
- [x] Xác định `api.ts` đang xử lý axios, attach token, refresh queue, redirect login
- [x] Xác định form login/register hiện còn dùng `useState` thủ công
- [x] Xác định modal/sidebar hiện còn CSS thủ công và có thể hưởng lợi từ animation
- [ ] Chốt toàn bộ component/page còn lại nếu cần trước khi code
- [ ] Chốt thứ tự migrate cụ thể theo file

Checkpoint:

- [x] Có danh sách file cần sửa theo từng phase
- [ ] Có thứ tự triển khai rõ ràng

## Baseline notes

- Nên ưu tiên `ChatPage` + `ChatContext` trước vì đây là nơi gom nhiều logic nhất.
- `LoginPage` và `RegisterPage` là các điểm tốt để áp dụng `react-hook-form` + `zod` sớm.
- `Modal` là điểm tốt để cắm `framer-motion` trước khi đụng nhiều UI khác.
- `index.css` hiện rất lớn, nên migrate sang `tailwindcss` theo từng cụm UI, không đổi một lần.
- Theo skill `frontend-patterns`, nên giữ component đơn giản, logic phức tạp đẩy ra custom hooks / stores.

## Phase 1 - Nền tảng data fetching

- [ ] Cài và cấu hình `@tanstack/react-query`
- [ ] Tạo `QueryClientProvider`
- [ ] Tách API layer nếu cần để query/mutation dùng chung
- [ ] Migrate các màn hình chỉ đọc dữ liệu sang query trước
- [ ] Chuẩn hóa loading / error state từ query

Checkpoint:

- [ ] App chạy bình thường
- [ ] Các trang fetch data không còn phụ thuộc `useEffect` dài dòng

## Phase 2 - Global state

- [ ] Cài và cấu hình `zustand`
- [ ] Xác định state nào nên ở store global
- [ ] Tách state chat khỏi `ChatContext`
- [ ] Tách auth/session state nếu cần
- [ ] Giữ context chỉ cho những phần thật sự cần React Context

Checkpoint:

- [ ] Sidebar / chat state vẫn đồng bộ
- [ ] Socket events vẫn cập nhật đúng UI

## Phase 3 - Form stack

- [ ] Cài `react-hook-form` và `zod`
- [ ] Tạo schema cho login / register / forgot password / change password
- [ ] Migrate từng form một
- [ ] Chuẩn hóa message validation và error display
- [ ] Giảm tối đa state nhập liệu thủ công bằng `useState`

Checkpoint:

- [ ] Form submit hoạt động ổn
- [ ] Validation hiển thị đúng và nhất quán

## Phase 4 - Animation

- [ ] Cài `framer-motion`
- [ ] Animate modal open/close
- [ ] Animate sidebar slide in/out
- [ ] Animate page / panel transitions nếu cần
- [ ] Giữ motion vừa đủ, không làm nặng UI

Checkpoint:

- [ ] Không có giật layout khi mở/đóng modal
- [ ] Mobile vẫn mượt

## Phase 5 - Tailwind migration

- [ ] Cài và cấu hình `tailwindcss`
- [ ] Thiết lập design tokens / theme map nếu cần
- [ ] Chọn 1 cụm UI nhỏ để migrate trước
- [ ] Migrate dần các component dùng CSS nhiều nhất
- [ ] Giảm dần phụ thuộc vào `src/index.css`

Checkpoint:

- [ ] Build không lỗi
- [ ] UI không bị lệch style khi chuyển từng phần

## Phase 6 - Dọn dẹp cuối

- [ ] Xóa CSS / context / helper không còn dùng
- [ ] Rà lại import thừa
- [ ] Rà lại lint / type errors
- [ ] Chạy test / build
- [ ] Kiểm tra responsive desktop + mobile

## Ghi chú

- Ưu tiên refactor theo hướng an toàn: thay đổi nhỏ, kiểm tra sớm, rồi mới mở rộng.
- Nếu một phase đụng quá nhiều file, chia tiếp thành nhiều patch nhỏ hơn.
