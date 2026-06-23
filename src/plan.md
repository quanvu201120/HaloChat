# HaloChat FE Refactor Plan

Muc tieu: refactor frontend HaloChat theo tung buoc nho, co the dung lai va tiep tuc an toan giua cac phien chat.

## Cach dung file nay

- Moi task xong thi tick `x`.
- Neu chuyen sang chat khac, chi can doc lai file nay de biet dang o buoc nao.
- Moi phase nen dung lai de kiem tra build / runtime truoc khi sang phase tiep theo.

## Trang thai hien tai

- [x] Da audit so bo cau truc FE
- [x] Da xac nhan project la `Vite + React`
- [x] Da xac nhan hien dang dung `Context` + CSS thu cong
- [x] Da doc skill `frontend-patterns` va bam theo no
- [x] Da bat dau refactor code
- [x] Da cai QueryClientProvider va migrate UsersPage / CreateConversationModal sang React Query

## Phase 0 - Chot baseline

- [x] Doc cac file loi: `App.tsx`, `AppLayout.tsx`, `AuthContext.tsx`, `ChatContext.tsx`, `ThemeContext.tsx`, `ToastContext.tsx`, `api.ts`
- [x] Doc cac man hinh quan trong: `LoginPage.tsx`, `RegisterPage.tsx`, `ChatPage.tsx`, `Modal.tsx`
- [x] Xac dinh `ChatPage` la file nang nhat va co nhieu state / side effect nhat
- [x] Xac dinh `ChatContext` dang om conversations, unread, online, typing, socket lifecycle
- [x] Xac dinh `AuthContext` dang xu ly persist login state bang localStorage
- [x] Xac dinh `api.ts` dang xu ly axios, attach token, refresh queue, redirect login
- [x] Xac dinh form login/register hien con dung `useState` thu cong
- [x] Xac dinh modal/sidebar hien con CSS thu cong va co the huong loi tu animation
- [x] Chot toan bo component/page con lai neu can truoc khi code
- [x] Chot thu tu migrate cu the theo file

Checkpoint:

- [x] Co danh sach file can sua theo tung phase
- [x] Co thu tu trien khai ro rang

## Baseline notes

- Nen uu tien `ChatPage` + `ChatContext` truoc vi day la noi gom nhieu logic nhat.
- `LoginPage` va `RegisterPage` la cac diem tot de ap dung `react-hook-form` + `zod` som.
- `Modal` la diem tot de gan `framer-motion` truoc khi dung vao nhieu UI khac.
- `index.css` hien rat lon, nen migrate sang `tailwindcss` theo tung cum UI, khong doi mot lan.
- Theo skill `frontend-patterns`, nen giu component don gian, logic phuc tap day ra custom hooks / stores.

## Phase 1 - Nen tang data fetching

- [x] Cai va cau hinh `@tanstack/react-query`
- [x] Tao `QueryClientProvider`
- [x] Tach API layer query dung chung cho users
- [x] Migrate UsersPage danh sach / chi tiet sang query/mutation
- [x] Migrate cac man hinh chi doc du lieu sang query truoc
- [x] Chuan hoa loading / error state tu query
- [x] Dung shared users query cho CreateConversationModal / useAvailableUsers
- [x] Loc user `isDisabled` khoi danh sach chon de khop backend create/add member

Checkpoint:

- [x] App chay binh thuong
- [x] Cac trang fetch data khong con phu thuoc `useEffect` dai dong

## Phase 2 - Global state

- [x] Cai va cau hinh `zustand`
- [x] Xac dinh state nao nen o store global
- [x] Tach state chat khoi `ChatContext`
- [x] Tach auth/session state neu can
- [x] Giu context chi cho nhung phan that su can React Context

Checkpoint:

- [x] Sidebar / chat state van dong bo
- [x] Socket events van cap nhat dung UI

## Phase 3 - Form stack

- [x] Cai `react-hook-form` va `zod`
- [x] Tao schema cho login / register / forgot password / change password
- [x] Migrate tung form mot
- [x] Chuan hoa message validation va error display
- [x] Giam toi da state nhap lieu thu cong bang `useState`

Checkpoint:

- [x] Form submit hoat dong on
- [x] Validation hien thi dung va nhat quan

## Phase 4 - Animation

- [x] Cai `framer-motion`
- [x] Animate modal open/close
- [x] Animate sidebar slide in/out
- [x] Animate page / panel transitions neu can
- [x] Giua motion vua du, khong lam nang UI

Checkpoint:

- [x] Khong co giat layout khi mo/dong modal
- [x] Mobile van muot

## Phase 5 - Tailwind migration

- [ ] Cai va cau hinh `tailwindcss`
- [ ] Thiet lap design tokens / theme map neu can
- [ ] Chon 1 cum UI nho de migrate truoc
- [ ] Migrate dan cac component dung CSS nhieu nhat
- [ ] Giam dan phu thuoc vao `src/index.css`

Checkpoint:

- [ ] Build khong loi
- [ ] UI khong bi lech style khi chuyen tung phan

## Phase 6 - Don dep cuoi

- [ ] Xoa CSS / context / helper khong con dung
- [ ] Ra lai import thua
- [ ] Ra lai lint / type errors
- [ ] Chay test / build
- [ ] Kiem tra responsive desktop + mobile

## Ghi chu

- Uu tien refactor theo huong an toan: thay doi nho, kiem tra som, roi moi mo rong.
- Neu mot phase dung qua nhieu file, chia tiep thanh nhieu patch nho hon.
