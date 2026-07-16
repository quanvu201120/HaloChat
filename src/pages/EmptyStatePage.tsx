import { MessageSquarePlus } from 'lucide-react';

export default function EmptyStatePage() {
  return (
    <div className="chat-empty-state">
      <div className="chat-empty-inner">
        <div className="chat-empty-icon">
          <img src="/halo-icon-96.png" alt="HaloChat" className="chat-empty-icon-image" />
        </div>
        <h2 className="chat-empty-title">Chào mừng đến HaloChat</h2>
        <p className="chat-empty-desc">
          Chọn một cuộc trò chuyện từ danh sách bên trái hoặc tạo cuộc trò chuyện mới.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-muted)', fontSize: '13px' }}>
          <MessageSquarePlus size={16} />
          Nhấn vào biểu tượng bút để bắt đầu chat
        </div>
      </div>
    </div>
  );
}
