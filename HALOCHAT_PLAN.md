# HaloChat Plan

## Project Context

`HaloChat` hien tai la project frontend duoc clone/tan dung tu `NestAdmin`, sau do chuyen huong thanh app chat danh cho user.

Dieu nay co nghia:

- co the tai su dung mot so phan auth, toast, service layer, profile flow
- nhung khong duoc giu tu duy "admin dashboard"
- layout, route, state va UI phai duoc tai cau truc de phu hop voi user app

Workspace lien quan:

- frontend: `HaloChat`
- backend: `NestJs`
- tham khao cu: `NestAdmin`

Tai lieu va nguon tham chieu bat buoc:

- `NestJs/docs/app-flow.md`
- `NestJs/TestSocket/index.html`
- code hien tai trong `HaloChat`

## Product Goal

Xay dung `HaloChat` thanh app chat realtime kieu Messenger/Zalo, phuc vu user thuong.

Muc tieu V1:

- login / register / active account / forgot password
- conversation list
- direct chat
- group chat
- send text
- send media
- reply
- reaction
- revoke
- seen / unread / typing / online presence
- profile page
- mobile responsive

## Current Reality

Hien trang code base:

- package name van la `nestadmin`
- route van con:
  - dashboard
  - users
  - api tester
- layout van la sidebar admin co dinh
- auth context, toast context, axios service da co the tai su dung mot phan

Huong xu ly:

- khong dap bo tat ca
- tai su dung co chon loc
- refactor dan thanh product chat

## Product Layout

### 1. Left Sidebar

Chua:

- conversation list
- search conversation
- tao chat 1-1
- tao group chat
- profile shortcut
- logout

### 2. Center Chat Panel

Chua:

- chat header
- message list
- composer
- typing / status / reply preview

### 3. Right Conversation Info Sidebar

Mo tu header chat.

Chua:

- thong tin room
- thanh vien
- them thanh vien
- media / file / link
- quan ly nhom
- roi nhom / giai tan nhom

## Core Features

### Conversation List

- hien direct chat va group chat
- search theo ten doi phuong hoac ten nhom
- unread highlight ro rang
- direct chat co online state cua doi phuong

### Chat Experience

- text message qua socket
- media message qua HTTP
- optimistic UI cho text message
- update / delete message qua socket
- mark read
- typing start / stop
- seen status ngan gon

### Message Interactions

- reply
- reaction
- three-dot menu
- revoke
- seen details cho tin nhan cua minh

### Group Features

- tao group
- them thanh vien
- xoa thanh vien
- doi ten nhom
- doi avatar nhom
- roi nhom
- giai tan nhom neu la admin

## Technical Direction

Co the tiep tuc tan dung:

- React
- TypeScript
- Vite
- axios
- react-router-dom
- react-hot-toast
- lucide-react

Nen bo sung:

- `@tanstack/react-query`
- `zustand`
- `socket.io-client`
- `react-hook-form`
- `zod`
- `@hookform/resolvers`
- `framer-motion`
- `tailwindcss` hoac he thong design token moi neu tiep tuc CSS custom

## Refactor Strategy

### Phase 1. Reposition Project

- doi ten product trong UI thanh `HaloChat`
- xoa dan mental model admin
- danh dau nhung file duoc tai su dung
- ghi ro nhung route/admin page se loai bo hoac thay the

### Phase 2. App Shell

- refactor `App.tsx`
- refactor `AppLayout.tsx`
- thay sidebar admin thanh sidebar conversation
- dat route chinh cho chat app

### Phase 3. Data + Realtime Layer

- tach API theo module:
  - auth
  - users
  - conversations
  - messages
  - presence
- them socket client layer
- them cache/store layer

### Phase 4. Chat UI

- conversation list
- chat panel
- message bubble
- composer
- right info sidebar

### Phase 5. Polish

- responsive
- loading / empty / error states
- animation
- profile integration

## Routes Target

Public:

- `/login`
- `/register`
- `/forgot-password`
- `/active-account`

Protected:

- `/`
  - co the redirect vao room dau tien hoac empty state
- `/chat/:conversationId`
- `/profile`
- `/change-password`

Admin pages cu du kien loai bo khoi user app:

- `/users`
- `/api-tester`
- dashboard admin-style neu khong can

## Definition of Done

`HaloChat` duoc xem la di dung huong khi:

- user login vao thay chat app, khong phai admin dashboard
- co the mo conversation, gui nhan tin, thay unread, typing, seen
- co right info sidebar cho conversation
- profile page va auth flow van chay
- UI nhat quan voi vai tro "user chat app"
