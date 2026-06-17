# HaloChat Flow

## Flow Sources

Flow phai bam theo:

- `NestJs/docs/app-flow.md`
- `NestJs/TestSocket/index.html`

`app-flow.md` cho biet backend rules.

`TestSocket/index.html` cho biet client behavior da test.

Neu co mau thuan giua suy doan UI va behavior test client:

- uu tien behavior da duoc test trong `index.html`

## Auth Flow

### Login

1. user login bang email/password
2. backend tra `accessToken` va `user`
3. FE luu `accessToken`
4. socket chi connect sau khi co session hop le

### Refresh

1. access token het han
2. axios interceptor thu refresh token
3. refresh thanh cong thi retry request
4. that bai thi ve login

## Conversation Flow

### Load Conversation List

1. goi `GET /conversations`
2. render sidebar trai
3. xac dinh direct/group name
4. danh dau unread local neu co event socket toi

### Open Conversation

1. user click conversation item
2. FE dat active conversation
3. socket emit `chat:join-conversation`
4. FE load messages page dau
5. neu can thi mark read
6. chat panel hien room

### Create Direct Chat

1. mo popup tao chat
2. chon 1 user
3. submit `POST /conversations`
4. refetch conversations
5. dieu huong vao room vua co

### Create Group Chat

1. mo popup tao group
2. chon nhieu user
3. nhap ten nhom
4. submit `POST /conversations`
5. refetch conversations
6. mo room vua tao

## Message Flow

### Load Messages

1. goi `GET /conversations/:conversationId/message`
2. render theo thu tu phu hop UI
3. khi scroll len dau thi fetch tiep theo bang `cursor`

Luu y:

- backend tra `Message[]`
- FE tu quan ly `cursor` bang `createdAt` cua item cu nhat

### Send Text Message

Hoc theo `NestJs/TestSocket/index.html`:

1. tao optimistic message
2. append vao UI
3. emit `chat:create-message`
4. ack thanh cong thi thay message tam bang message that
5. ack that bai thi doi status sang `Loi`

### Send Media Message

1. user chon file
2. FE validate local neu can
3. gui qua HTTP endpoint phu hop:
  - image
  - video
  - file
  - voice
4. thanh cong thi merge message moi vao list

### Update Message

1. chi message text cua chinh minh
2. emit `chat:update-message`
3. nghe `message:updated` de sync UI

### Revoke Message

1. user chon `Thu hoi`
2. emit `chat:delete-message`
3. nghe `chat:message-deleted`
4. UI doi sang message da thu hoi

## Reply Flow

1. user bam reply tren message
2. FE dat `replyTarget`
3. composer hien preview
4. gui message kem `replyTo`

Neu message duoc reply da bi thu hoi/xoa:

- preview va bubble reply chi hien `Tin nhan da thu hoi`
- khong hien lai noi dung cu

## Reaction Flow

1. user chon reaction
2. FE goi REST:
  - `PATCH /messages/:messageId/reaction`
  - hoac `DELETE /messages/:messageId/reaction`
3. socket event `message:updated` se dong bo lai UI

## Read / Seen Flow

### Mark Read

1. user mo room hoac doc den message can thiet
2. emit `chat:mark-read` hoac goi REST mark read tuy diem dung
3. backend cap nhat `readReceipts`
4. backend xoa unseen cho user do

### Seen Status

Khi click vao message, UI chi hien:

- `Dang gui`
- `Da gui`
- `Da xem`
- `Loi`

### Seen Detail

Chi cho tin nhan cua minh.

FE suy ra tu `conversation.readReceipts`:

- user nao co `readReceipts[userId] >= currentMessageId` thi la da xem
- nguoc lai la chua xem

## Typing Flow

1. user bat dau go
2. emit `chat:typing-start`
3. debounce/schedule stop
4. blur hoac gui xong thi emit `chat:typing-stop`
5. nghe `user:typing-update` de hien typing indicator

## Unread Flow

1. backend phat `user:unseen-message`
2. FE danh dau conversation unread trong sidebar
3. khi user vao room va mark read:
  - clear unread
  - nhan `user:unseen-cleared` neu co

## Presence Flow

1. socket connect hop le
2. backend set online presence
3. FE nghe:
  - `user:online`
  - `user:offline`
4. direct chat uu tien hien online state cua doi phuong

## Conversation Info Sidebar Flow

1. user dang o chat panel
2. bam nut mo panel ben phai trong header
3. panel hien:
  - thong tin room
  - thanh vien
  - media/file/link
  - settings
4. action group / room duoc thuc hien tai day

Mobile:

- panel nay bien thanh drawer hoac full-screen sheet
