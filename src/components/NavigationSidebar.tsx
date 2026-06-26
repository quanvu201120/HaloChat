import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { MessageCircle, Users, MessageSquareDashed, Ban, Moon, Sun, LogOut } from 'lucide-react';
import { useAuthStore as useAuth } from '../store/authStore';
import { useTheme } from '../context/ThemeContext';
import { useToast } from '../context/ToastContext';
import ConfirmModal from './ConfirmModal';

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

  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    action: () => void | Promise<void>;
  } | null>(null);

  const isChatRoute = location.pathname === '/' || location.pathname.startsWith('/chat');
  const isFriendsRoute = location.pathname === '/friends';
  const isRequestsRoute = location.pathname === '/requests';
  const isBlockedRoute = location.pathname === '/blocked';
  const isProfileRoute = location.pathname === '/profile';

  const getInitials = () => {
    const n = user?.name || user?.email || 'U';
    const parts = n.trim().split(' ');
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return n.slice(0, 2).toUpperCase();
  };

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

  // Shared classes for navigation items
  const baseItemClass = "w-[210px] md:w-[44px] h-[44px] min-h-[44px] md:h-[44px] px-4 md:px-0 rounded-xl flex items-center justify-start md:justify-center gap-3 border-none bg-transparent text-[var(--text-muted)] cursor-pointer transition-all duration-200 relative";
  const hoverClass = "hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]";
  const activeClass = "bg-[rgba(99,102,241,0.15)] !text-[var(--accent-primary)]";
  
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
            onClick={() => { navigate('/'); setIsOpen(false); }}
            title="Đoạn chat"
          >
            <MessageCircle className={iconSizeClass} />
            <span className="text-[15px] font-medium block md:hidden">Đoạn chat</span>
          </button>
          <button
            className={`${baseItemClass} ${hoverClass} ${isFriendsRoute ? activeClass : ''}`}
            onClick={() => { navigate('/friends'); setIsOpen(false); }}
            title="Bạn bè"
          >
            <Users className={iconSizeClass} />
            <span className="text-[15px] font-medium block md:hidden">Bạn bè</span>
          </button>
          <button
            className={`${baseItemClass} ${hoverClass} ${isRequestsRoute ? activeClass : ''}`}
            onClick={() => { navigate('/requests'); setIsOpen(false); }}
            title="Tin nhắn chờ"
          >
            <MessageSquareDashed className={iconSizeClass} />
            <span className="text-[15px] font-medium block md:hidden">Tin nhắn chờ</span>
          </button>
          <button
            className={`${baseItemClass} ${hoverClass} ${isBlockedRoute ? activeClass : ''}`}
            onClick={() => { navigate('/blocked'); setIsOpen(false); }}
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
          

          <button
            className={`${baseItemClass} ${hoverClass}`}
            onClick={() => { navigate('/profile'); setIsOpen(false); }}
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
              {user?.name || user?.email || 'Hồ sơ cá nhân'}
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
