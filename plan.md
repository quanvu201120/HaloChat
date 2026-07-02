# Kế hoạch thiết kế Admin Dashboard (HaloChat Frontend)

Dựa trên 3 module chính từ Backend là **Stats (Thống kê)**, **Users (Quản lý người dùng)** và **Cleanup Jobs (Bảo trì hệ thống)**, dưới đây là bản thiết kế UI/UX tổng thể cho trang Admin Dashboard.

Phong cách thiết kế: **Modern, Premium & Dashboard Analytics** (Sử dụng Dark Mode, Glassmorphism, Micro-animations và các gam màu HSL nổi bật).

---

## 1. Cấu trúc Layout Tổng thể (App Shell)

- **Sidebar (Trái - Cố định):** Menu điều hướng tối giản, bao gồm Avatar của Admin, trạng thái "Online", và các Tabs:
  - 📊 **Overview** (Trang chủ thống kê)
  - 👥 **Users** (Quản lý tài khoản)
  - 🛠️ **Maintenance** (Dọn dẹp & Tình trạng hệ thống)
- **Header (Trên cùng):** nút themes và nút **"Sync Now"** (Gọi API `/stats/sync`) có hiệu ứng xoay tròn (spinning) khi đang đồng bộ.

---

## 2. Chi tiết các trang (Pages)

### 📊 Tab 1: Overview (Trang chủ Thống kê)

**Cảm hứng thiết kế:** Giống các trang Vercel Analytics hoặc Stripe Dashboard.

- **Row 1: Key Metrics (Thẻ chỉ số dạng lưới 4 cột)**
  - Các thẻ kính (Glass effect) bo góc tròn, bên trong hiển thị số lớn, kèm theo một biểu đồ mini-sparkline (đường xu hướng mờ ở nền).
  - Thẻ 1: Tổng Users (Kèm mũi tên 📈 + số lượng users mới hôm nay).
  - Thẻ 2: Tổng Tin nhắn (Text/Media).
  - Thẻ 3: Peak Online Users (Thể hiện lượng người online cùng lúc lớn nhất - CCU).
  - Thẻ 4: Cloud Bandwidth (Sử dụng màu cảnh báo Vàng/Đỏ nếu vượt ngưỡng).
- **Row 2: The Main Chart (Biểu đồ trung tâm)**
  - Chiếm diện tích lớn nhất.
  - Góc trên cùng có 2 Dropdown:
    - **Loại dữ liệu:** "Tăng trưởng User" | "Lượng tin nhắn" | "Băng thông Cloud".
    - **Khoảng thời gian:** "Daily" | "Monthly" | "Yearly".
  - Biểu đồ dạng Line/Area Chart với dải màu Gradient nhạt dần xuống dưới, có tooltip hiển thị chi tiết khi hover chuột.
- **Row 3: Storage, Cloud Health & Redis Health**
  - **Cloud Status:** 2 thanh Progress Bar dạng vòng cung (Gauge chart) cho Cloudinary và R2. Hiển thị "Storage Used" so với hạn mức (nếu có).
  - **Redis Status:** Hiển thị thông số RAM đang sử dụng hiện tại (Ví dụ: `150MB / 1GB`). Kèm một biểu đồ dao động (như nhịp tim) để thể hiện lượng query Redis đang xử lý (Real-time).

### 👥 Tab 2: Users Management (Quản lý người dùng)

**Cảm hứng thiết kế:** Bảng dữ liệu hiện đại, gọn gàng (như Linear hoặc Notion).

- **Thanh công cụ (Top Bar):**
  - Thanh Search lớn (Tìm theo Email, Tên, SĐT).
  - Filter dropdown (Lọc theo trạng thái: Active, Non-Active, Disabled).
- **Bảng dữ liệu (Data Grid):**
  - Hiển thị Avatar (hình tròn nhỏ), Tên ,Cột "Trạng thái" (Dùng các Badge màu: Xanh lá cho Active, Đỏ cho Banned).
  - Cột cuối cùng là **Actions** (Nút thao tác dạng icon `...` dropdown):
    - 🛑 **Ban User** (Khóa tài khoản - hiện Modal xác nhận với viền đỏ nguy hiểm).
    - 🔓 **Unban User** (Mở khóa).
    - Click vô user Mở ra một popup hiển thị thông tin đầy đủ, có nút cập nhật click vô thì cho cập nhật thông tin
- **Hiệu ứng:** Hover vào mỗi dòng sẽ sáng lên nhẹ nhàng (Subtle highlight).

### 🛠️ Tab 3: Maintenance & System (Dọn dẹp & Hệ thống)

**Cảm hứng thiết kế:** Giao diện dạng "Control Panel" / "DevTools" chuyên nghiệp, chia làm các khu vực quản lý rõ ràng.

- **Khu vực 1: System Health & Quick Actions (Tổng quan kỹ thuật)**
  - Hiển thị Uptime của Backend (thời gian server Node.js đã chạy liên tục) và Uptime của Redis.
  - **Trạng thái kết nối (Ping Status):** Sử dụng chấm tròn nhấp nháy (Xanh = Trực tuyến, Đỏ = Lỗi kết nối) cho 4 dịch vụ và thêm nút check connect cho admin tự check lại bằng tay có animation:
    - `Database (MongoDB)`
    - `Cache (Redis)`
    - `Media Server (Cloudinary)`
    - `Storage Bucket (Cloudflare R2)`
  - Các nút thao tác nhanh (Quick Actions): "Force Sync Stats" (Đồng bộ thống kê khẩn cấp từ Cloudinary & Redis).

- **Khu vực 2: Scheduled Cleanup Jobs (Quản lý tác vụ dọn dẹp)**
  - Hiển thị dưới dạng Grid các Thẻ (Cards) to, nổi bật. Mỗi thẻ đại diện cho một Job:
    - **Tên Job:** Xóa 1 Media ở Cloudinary, Dọn Session hết hạn, Xóa nhiều media ở Cloudflare R2...
    - **Thông tin chi tiết:**
      - Trạng thái: `Đang chờ (Idle)` / `Đang chạy (Running 🔄) tức là đang bị worker/admin khóa`, retry,...
    - nếu là chờ dọn dẹp như pending retry thì hiện nextretry
    - **Hành động (Actions):**
      - Nút **"▶ Run Manually"** (Kích hoạt chạy thủ công ngay lập tức).
      - Nút **"⚙️ Cài đặt"** sửa status qua jgnore hay failed, kèm theo confirm, trừ done và đang chạy thì k cho admin chạy tay chứ failed hay ignore vẫn cho admin thử chạy lại
- **Khu vực 3: Job Execution Logs (Lịch sử & Nhật ký chạy)**
  - Không chỉ là một khung Terminal đơn điệu, đây sẽ là một **Bảng lịch sử (Data Table)**.
  - Các cột: `Tên Job`, `Người kích hoạt` (Hệ thống Auto / Admin), `Thời gian chạy`, `Thời gian hoàn thành`, `Trạng thái`.
  - **Terminal Drawer:** Khi click vào một dòng trong bảng sẽ hiện lên toàn bộ chi tiết của job đó

**🔗 Các API Endpoint & File tham khảo Backend (Dành cho Frontend tích hợp):**

- **Tab 1: Overview & Thống kê:**
  - `GET /stats/overview`: Trả về toàn bộ số liệu tổng quan (Totals), mức sử dụng hiện tại (Cloud, Redis), và `systemLimits`. Tham khảo file: `src/modules/stats/stats.controller.ts` & `src/modules/stats/stats.service.ts`.
  - `GET /stats/chart?type=daily`: Trả về dữ liệu để vẽ biểu đồ Line Chart (newUsers, messages, uploadBytes...).
- **Tab 2: Quản lý Users:**
  - `GET /users`: Lấy danh sách người dùng (có phân trang, tìm kiếm). Tham khảo file: `src/modules/users/users.controller.ts`.
  - `GET /users/:id`: Lấy chi tiết thông tin một người dùng.
  - `POST /users`: Tạo mới tài khoản (dành cho Admin).
  - `PATCH /users/:id`: Cập nhật thông tin (Tên, Role...).
  - `PATCH /users/:id/disable` và `PATCH /users/:id/enable`: Khóa/Mở khóa tài khoản người dùng.
- **Tab 3: Maintenance & Cleanup Jobs:**
  - `GET /stats/health`: Trả về Uptime và Ping status của 4 dịch vụ (MongoDB, Redis, Cloudinary, R2). Tham khảo: `src/modules/stats/stats.controller.ts`.
  - `POST /stats/sync`: Kích hoạt đồng bộ Cloud/Redis khẩn cấp (Quick Action).
  - `GET /cleanup-jobs`: Lấy toàn bộ danh sách các Job. Tham khảo: `src/modules/cleanup-jobs/cleanup-jobs.controller.ts`.
  - `GET /cleanup-jobs/pending-retry`: Lấy danh sách các Job đang chờ chạy hoặc lỗi cần retry.
  - `GET /cleanup-jobs/:id`: Lấy chi tiết Job (hiển thị Terminal Drawer).
  - `PATCH /cleanup-jobs/process/:id`: Chạy thủ công 1 Job (khi bấm ▶ Run Manually).
  - `PATCH /cleanup-jobs/:id/status?status=IGNORED`: Chuyển trạng thái Job sang Bỏ qua (Ignore).

---

## 3. Tech Stack Frontend đề xuất

- **Core:** React 19 + Vite.
- **Styling:** TailwindCSS.
- **State Management:** `Zustand` (lưu trạng thái Admin/Sidebar) và `@tanstack/react-query` (Auto-refetch API tự động).
- **Charts:** `Recharts` (Dễ tích hợp React, tùy biến cao).
- **Icons:** `Lucide-React`.
