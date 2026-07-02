import { NavLink } from 'react-router-dom';
import { Contact, Users, UserPlus, User, ArrowUpRight, AlignLeft } from 'lucide-react';
import { useRelationships } from '../hooks/useRelationships';

export default function ContactSidebar() {
  const { receivedRequests } = useRelationships();

  const menuItems = [
    { icon: <Contact size={20} />, label: 'Danh sách bạn bè', path: '/friends' },
    { icon: <UserPlus size={20} />, label: 'Lời mời kết bạn', path: '/requests', badge: receivedRequests.length },
    { 
      icon: (
        <div style={{ position: 'relative', width: 20, height: 20 }}>
          <User size={20} style={{ position: 'absolute', top: 0, left: -2.5 }} />
          <ArrowUpRight size={13} strokeWidth={3} style={{ position: 'absolute', top: -2, right: -3 }} />
        </div>
      ), 
      label: 'Đã gửi lời mời', 
      path: '/sent-requests' 
    },
  ];

  return (
    <div className="relative flex items-center justify-center w-full px-2 md:px-0 mb-5 shrink-0">
      {/* The global menu button from AppLayout handles the mobile menu toggle. We just need the tabs centered here. */}

      <div className="flex w-[260px] md:w-full justify-center md:justify-start bg-[var(--bg-secondary)] rounded-xl border border-[var(--border)] p-1">
        {menuItems.map((item, idx) => (
          <NavLink 
            key={idx} 
            to={item.path}
            className={({ isActive }) => `flex-1 flex flex-col md:flex-row items-center justify-center gap-0 md:gap-3 transition-all duration-200 h-[44px] md:h-[52px] rounded-[10px] ${isActive ? 'bg-[var(--bg-card)] text-[var(--text-primary)] font-semibold shadow-sm' : 'bg-transparent text-[#64748b] hover:text-[var(--text-primary)] md:hover:bg-[#e2e8f0]/50'}`}
            style={{ textDecoration: 'none' }}
            title={item.label}
          >
            {({ isActive }) => (
              <>
                <div style={{ color: isActive ? '#3b82f6' : 'inherit' }} className="scale-[1.2] md:scale-100 relative">
                  {item.icon}
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="md:hidden absolute -top-1 -right-1 flex items-center justify-center min-w-[16px] h-[16px] px-[5px] bg-[#ef4444] text-white text-[9px] font-bold rounded-full shadow-sm leading-none">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
                <div className="hidden md:flex items-center gap-1.5">
                  <span className="text-[15px]">{item.label}</span>
                  {typeof item.badge === 'number' && item.badge > 0 && (
                    <span className="flex items-center justify-center min-w-[20px] h-[20px] px-[6px] bg-[#ef4444] text-white text-[11px] font-bold rounded-full shadow-sm leading-none">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </div>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </div>
  );
}
