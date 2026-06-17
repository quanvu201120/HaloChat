# HaloChat Rules

## 1. Product Rules

- `HaloChat` la user app, khong phai admin panel
- duoc tan dung code tu `NestAdmin`, nhung khong duoc giu UX cua admin dashboard
- tat ca thay doi moi phai huong toi app chat that

## 2. Source-of-Truth Rules

Phai tham chieu theo thu tu:

1. backend behavior trong `NestJs`
2. client behavior da test trong `NestJs/TestSocket/index.html`
3. product direction trong cac file docs cua `HaloChat`

## 3. Reuse Rules

Co the tai su dung:

- auth context
- toast context
- axios setup
- profile flow
- mot so utility / modal co san

Khong nen giu nguyen:

- admin sidebar
- dashboard layout
- route `users`
- route `api-tester`
- visual language qua giong panel quan tri

## 4. UI Rules

- bo cuc chinh:
  - sidebar trai
  - chat panel giua
  - conversation info sidebar ben phai
- right sidebar la noi chua tinh nang conversation
- message area phai uu tien de doc va de chat
- action an/bung hop ly, khong lo qua nhieu control cung luc

## 5. Message Rules

- click message thi hien status ngan
- hover/active moi hien actions
- reply, reaction, revoke, seen detail phai co vi tri ro rang
- neu reply target da bi thu hoi thi chi hien `Tin nhan da thu hoi`

## 6. Realtime Rules

- khong join tat ca room ngay tu dau
- chi join room khi user mo conversation
- text message uu tien optimistic UI
- unread phai de thay o sidebar

## 7. Responsive Rules

Desktop:

- co the hien trai + giua + panel phai

Mobile:

- uu tien 1 panel chinh tai mot thoi diem
- chat panel la trong tam khi da vao room
- right sidebar thanh drawer/full-screen sheet

## 8. Implementation Rules

- neu thay code cu trong `HaloChat` mang tinh admin, uu tien refactor dan thay vi co gang nhung them tinh nang chat vao layout cu
- moi thay doi lon ve route, layout, state nen giu tinh "chat-first"
- khi co nhieu cach lam, uu tien cach de support reply/reaction/unread/right-sidebar som

## 9. Naming Rules

- ten san pham trong docs/UI la `HaloChat`
- khong de lo label `NestAdmin` trong UX moi
- package name co the doi sau, nhung product name trong UI nen doi som

## 10. Handoff Rules

Neu mot chat/agent khac tiep tuc lam:

- phai doc:
  - `HALOCHAT_PLAN.md`
  - `HALOCHAT_FLOW.md`
  - `HALOCHAT_RULES.md`
  - `NestJs/docs/app-flow.md`
  - `NestJs/TestSocket/index.html`
- phai hieu `HaloChat` la ban clone tu `NestAdmin` nhung dang duoc bien thanh app user
