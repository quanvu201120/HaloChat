import { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Search, PenSquare, LogOut, MessageSquarePlus, Moon, Sun
} from 'lucide-react';
import { useAuthStore as useAuth } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import { useChatStore as useChat } from '../store/chatStore';
import ConversationItem from './ConversationItem';
import CreateConversationModal from './CreateConversationModal';
import ConfirmModal from './ConfirmModal';
import { useTheme } from '../context/ThemeContext';

export default function Sidebar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const conversationId = location.pathname.startsWith('/chat/')
    ? decodeURIComponent(location.pathname.slice('/chat/'.length).split('/')[0] ?? '')
    : '';
  const {
    conversations,
    isLoadingConversations,
    unread,
    online,
  } = useChat();

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    action: () => void | Promise<void>;
  } | null>(null);

  const handleLogout = () => {
    setConfirmAction({
      title: 'Đăng xuất',
      message: 'Bạn có chắc chắn muốn đăng xuất?',
      isDanger: true,
      confirmText: 'Đăng xuất',
      action: async () => {
        try {
          await logout();
          toast.success('Đăng xuất thành công!');
          navigate('/login');
        } catch {
          toast.error('Đăng xuất thất bại');
        }
      }
    });
  };

  const getInitials = () => {
    const n = user?.name || user?.email || 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const currentUserId = user?._id || '';

  const filtered = useMemo(() => conversations.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const name = c.isGroup
      ? (c.name || '').toLowerCase()
      : c.users.map((u) => (u.name || u.email || '').toLowerCase()).join(' ');
    return name.includes(q);
  }), [conversations, search]);

  return (
    <>
      <aside className="chat-sidebar">
        {/* Header */}
        <div className="sidebar-header">
          <div className="sidebar-brand">
            <div className="sidebar-brand-icon">💬</div>
            <span className="sidebar-brand-name">HaloChat</span>
          </div>
          <button
            className="icon-btn"
            title="Tạo cuộc trò chuyện"
            onClick={() => setShowCreateModal(true)}
          >
            <PenSquare size={18} />
          </button>
        </div>

        {/* Search */}
        <div className="sidebar-search">
          <div className="search-input-wrapper">
            <Search size={14} />
            <input
              className="search-input"
              placeholder="Tìm kiếm cuộc trò chuyện..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Conversation list */}
        <div className="conv-list">
          {isLoadingConversations ? (
            <div className="conv-list-loading">
              <div className="loading-spinner" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="conv-list-empty">
              {search ? (
                <>
                  <Search size={32} style={{ opacity: 0.3 }} />
                  <p>Không tìm thấy</p>
                </>
              ) : (
                <>
                  <MessageSquarePlus size={32} style={{ opacity: 0.3 }} />
                  <p>Chưa có cuộc trò chuyện nào</p>
                  <button
                    className="btn btn-primary"
                    style={{ fontSize: '13px', padding: '8px 16px' }}
                    onClick={() => setShowCreateModal(true)}
                  >
                    Bắt đầu chat
                  </button>
                </>
              )}
            </div>
          ) : (
            filtered.map((conv) => (
              <ConversationItem
                key={conv._id}
                conv={conv}
                currentUserId={currentUserId}
                hasUnread={!!unread[conv._id]}
                isActive={conversationId === conv._id}
                isOnline={!conv.isGroup && online[conv.users.find((u) => u._id !== currentUserId)?._id || ''] === true}
              />
            ))
          )}
        </div>

        {/* Footer */}
        <div className="sidebar-footer-chat" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border)' }}>
          <button
            className="sidebar-profile-btn"
            onClick={() => navigate('/profile')}
            title="Hồ sơ cá nhân"
            style={{ padding: 0, background: 'none', width: 'auto' }}
          >
            <div className="user-avatar" style={{ 
              width: '36px', height: '36px', 
              backgroundImage: user?.avatar?.url ? `url(${user.avatar.url})` : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))',
              backgroundSize: 'cover', backgroundPosition: 'center',
              borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'white', fontWeight: 600, fontSize: '14px'
            }}>
              {!user?.avatar?.url && getInitials()}
            </div>
          </button>

          <button
            className="icon-btn"
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
            onClick={toggleTheme}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          
          <button
            className="icon-btn"
            title="Đăng xuất"
            onClick={handleLogout}
            style={{ color: 'var(--error)' }}
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>

      {showCreateModal && (
        <CreateConversationModal onClose={() => setShowCreateModal(false)} />
      )}

      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          title={confirmAction.title}
          message={confirmAction.message}
          isDanger={confirmAction.isDanger}
          confirmText={confirmAction.confirmText}
          onConfirm={confirmAction.action}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </>
  );
}
