import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Users, MessageSquareDashed, Ban, Moon, Sun, LogOut, Shield } from 'lucide-react';
import { useAuthStore as useAuth } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import { useRelationships } from '../hooks/useRelationships';
import { useChatStore } from '../store/chatStore';
import ConfirmModal from './ConfirmModal';

import { UserRole } from '../constants/roles';
import { UI_LIMITS } from '../constants/limits';
import { UI_MESSAGES } from '../constants/messages';

interface NavigationSidebarProps {
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
}

export default function NavigationSidebar({ isOpen, setIsOpen }: NavigationSidebarProps) {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const location = useLocation();
  const navigate = useNavigate();
  const { receivedRequests } = useRelationships();
  const { unread, conversations, setMessageRequestContext } = useChatStore();
  const unreadMessageCount = conversations.filter(c => c.acceptedBy?.includes(user?._id || '') && unread[c._id]).length;
  const pendingRequestCount = conversations.filter(c => !c.acceptedBy?.includes(user?._id || '')).length;

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    action: () => void | Promise<void>;
  } | null>(null);

  const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/chat');
  const isFriendsRoute = location.pathname === '/friends';
  const isMessageRequestsRoute = location.pathname === '/message-requests';
  const isBlockedRoute = location.pathname === '/blocked';
  const isAdminRoute = location.pathname.startsWith('/admin');

  const getInitials = () => {
    const n = user?.name || 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

  const handleLogout = () => {
    setConfirmAction({
      title: UI_MESSAGES.navigation.logoutTitle,
      message: UI_MESSAGES.navigation.logoutConfirm,
      isDanger: true,
      confirmText: UI_MESSAGES.navigation.logoutConfirmButton,
      action: async () => {
        try {
          await logout();
          toast.success(UI_MESSAGES.navigation.logoutSuccess);
          navigate('/login');
        } catch {
          toast.error(UI_MESSAGES.navigation.logoutFailed);
        }
      }
    });
  };

  const handleNavigate = (path: string, action?: () => void) => {
    if (window.innerWidth < 768 && isOpen) {
      setIsOpen(false);
      setTimeout(() => {
        if (action) action();
        navigate(path);
      }, UI_LIMITS.SIDEBAR_NAVIGATION_DELAY_MS);
    } else {
      if (action) action();
      navigate(path);
      setIsOpen(false);
    }
  };

  // Shared classes for navigation items
  const baseItemClass = "w-[228px] md:w-[44px] h-[44px] min-h-[44px] md:h-[44px] pl-7 pr-4 md:px-0 rounded-lg flex items-center justify-start md:justify-center gap-3 border-none bg-transparent text-[var(--text-muted)] cursor-pointer transition-all duration-200 relative";
  const hoverClass = "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]";
  const activeClass = "bg-transparent !text-[var(--accent-primary)] font-semibold";
  
  const iconSizeClass = "w-[20px] h-[20px] md:w-[22px] md:h-[22px] shrink-0";
  const smallIconSizeClass = "w-[20px] h-[20px] md:w-[20px] md:h-[20px] shrink-0";

  return (
    <>
      {/* Mobile Backdrop */}
      <div 
        className={`md:hidden fixed inset-0 bg-black/50 z-30 transition-opacity duration-300 ease-in-out ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Sidebar Drawer */}
      <aside className={`w-[260px] min-w-[260px] md:w-[68px] md:min-w-[68px] h-full bg-[var(--bg-card)] border-r border-[var(--border)] flex flex-col items-center py-6 md:py-4 z-40 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] fixed md:static inset-y-0 left-0 transition-transform duration-300 ease-in-out ${isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        

        <div className="flex flex-col items-center gap-2 md:gap-4 w-full">
          <button

            className={`${baseItemClass} ${hoverClass} ${isChatRoute ? activeClass : ''}`}
            onClick={() => handleNavigate('/', () => setMessageRequestContext(false))}
            title="Đoạn chat"
          >
            <div className="relative">
              <MessageCircle className={iconSizeClass} />
              {unreadMessageCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-[5px] bg-[#ef4444] text-white text-[9px] font-bold rounded-full shadow-sm leading-none">
                  {unreadMessageCount > UI_LIMITS.UNREAD_BADGE_MAX ? `${UI_LIMITS.UNREAD_BADGE_MAX}+` : unreadMessageCount}
                </span>
              )}
            </div>
            <span className="text-[15px] font-medium block md:hidden">Đoạn chat</span>
          </button>
          <button

            className={`${baseItemClass} ${hoverClass} ${isFriendsRoute ? activeClass : ''}`}
            onClick={() => handleNavigate('/friends')}
            title="Bạn bè"
          >
            <div className="relative">
              <Users className={iconSizeClass} />
              {receivedRequests.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#ef4444] rounded-full border-[1.5px] border-[var(--bg-card)]"></span>
              )}
            </div>
            <span className="text-[15px] font-medium block md:hidden">Bạn bè</span>
          </button>
          <button

            className={`${baseItemClass} ${hoverClass} ${isMessageRequestsRoute ? activeClass : ''}`}
            onClick={() => handleNavigate('/message-requests', () => setMessageRequestContext(true))}
            title="Tin nhắn chờ"
          >
            <div className="relative">
              <MessageSquareDashed className={iconSizeClass} />
              {pendingRequestCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-[5px] bg-[#ef4444] text-white text-[9px] font-bold rounded-full shadow-sm leading-none">
                  {pendingRequestCount > UI_LIMITS.UNREAD_BADGE_MAX ? `${UI_LIMITS.UNREAD_BADGE_MAX}+` : pendingRequestCount}
                </span>
              )}
            </div>
            <span className="text-[15px] font-medium block md:hidden">Tin nhắn chờ</span>
          </button>
          <button

            className={`${baseItemClass} ${hoverClass} ${isBlockedRoute ? activeClass : ''}`}
            onClick={() => handleNavigate('/blocked')}
            title="Chặn"
          >
            <Ban className={iconSizeClass} />
            <span className="text-[15px] font-medium block md:hidden">Chặn</span>
          </button>

          {/* Theme Toggle is now part of the top group */}
          
        </div>

        {/* Spacer to push Logout and Profile to the bottom */}
        <div className="flex-1 w-full min-h-[16px]"></div>

        <div className="flex flex-col items-center gap-2 md:gap-4 w-full pt-2 md:pt-4 pb-2">
          {(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) && (
            <button

              className={`${baseItemClass} ${hoverClass} ${isAdminRoute ? activeClass : ''}`}
              onClick={() => handleNavigate('/admin')}
              title="Quản trị viên"
            >
              <Shield className={iconSizeClass} />
              <span className="text-[15px] font-medium block md:hidden">Quản trị viên</span>
            </button>
          )}

          <button

            className={`${baseItemClass} ${hoverClass}`}
            onClick={() => handleNavigate('/profile')}
            title="Hồ sơ cá nhân"
          >
            <div 
              className={`w-[28px] h-[28px] min-w-[28px] min-h-[28px] md:w-[36px] md:h-[36px] md:min-w-[36px] md:min-h-[36px] shrink-0 rounded-full bg-cover bg-center flex items-center justify-center text-white font-semibold text-[13px] md:text-[14px]`}
              style={{ 
                backgroundImage: user?.avatar?.url ? `url(${user.avatar.url})` : 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))'
              }}
            >
              {!user?.avatar?.url && getInitials()}
            </div>
            <span className="text-[15px] font-medium block md:hidden truncate flex-1 text-left">
              {user?.name || 'Hồ sơ cá nhân'}
            </span>
          </button>

          <button

            className={`${baseItemClass} ${hoverClass}`}
            onClick={toggleTheme}
            title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
          >
            {theme === 'dark' ? <Sun className={smallIconSizeClass} /> : <Moon className={smallIconSizeClass} />}
            <span className="text-[15px] font-medium block md:hidden">{theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>

          <button

            className={`${baseItemClass} hover:text-[var(--error)] hover:bg-[rgba(220,38,38,0.1)]`}
            onClick={handleLogout}
            title="Đăng xuất"
          >
            <LogOut className={smallIconSizeClass} />
            <span className="text-[15px] font-medium block md:hidden">Đăng xuất</span>
          </button>
        </div>
      </aside>

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
