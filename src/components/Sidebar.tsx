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
            <div className="w-full">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="conv-item animate-pulse" style={{ pointerEvents: 'none' }}>
                  <div className="conv-avatar-wrap">
                    <div className="conv-avatar bg-gray-200 dark:bg-gray-700" style={{ color: 'transparent' }} />
                  </div>
                  <div className="conv-info" style={{ gap: '8px' }}>
                    <div className="conv-name-row">
                      <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2" />
                    </div>
                    <div className="conv-preview-row">
                      <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded w-3/4" />
                    </div>
                  </div>
                </div>
              ))}
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

        {/* Footer removed and moved to NavigationSidebar */}
      </aside>

      <CreateConversationModal 
        isOpen={showCreateModal} 
        onClose={() => setShowCreateModal(false)} 
      />

      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        isDanger={confirmAction?.isDanger}
        confirmText={confirmAction?.confirmText}
        onConfirm={confirmAction?.action || (() => {})}
        onCancel={() => setConfirmAction(null)}
      />
    </>
  );
}
