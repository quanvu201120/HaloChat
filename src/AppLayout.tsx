import { useState, useEffect } from 'react';
import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore as useAuth } from './store/authStore';
import SocketManager from './components/SocketManager';
import Sidebar from './components/Sidebar';
import NavigationSidebar from './components/NavigationSidebar';
import ContactSidebar from './components/ContactSidebar';
import { Menu } from 'lucide-react';

export default function AppLayout() {
  const { user, accessToken } = useAuth();
  const location = useLocation();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    const handleOpenMenu = () => setIsMobileMenuOpen(true);
    window.addEventListener('openMobileMenu', handleOpenMenu);
    return () => window.removeEventListener('openMobileMenu', handleOpenMenu);
  }, []);

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  const isChatRoute =
    location.pathname === '/' ||
    location.pathname === '/message-requests' ||
    location.pathname.startsWith('/chat');
  const isSidebarOnlyRoute = location.pathname === '/' || location.pathname === '/message-requests';
  const isOuterPage = ['/', '/friends', '/requests', '/blocked', '/message-requests'].includes(location.pathname);
  const isContactRoute = ['/friends', '/sent-requests', '/requests', '/group-requests'].some(p => location.pathname.startsWith(p));

  // Determine if we should animate the transition. We don't animate if it's just the sidebar opening/closing via CSS.
  // Actually animating everything gives a premium feel.
  
  return (
    <>
      <SocketManager />
      <div className={`app-layout ${isSidebarOnlyRoute ? 'mobile-sidebar-only' : 'mobile-main-only'}`}>
        {/* Far Left Navigation Sidebar */}
        <NavigationSidebar isOpen={isMobileMenuOpen} setIsOpen={setIsMobileMenuOpen} />

        {/* Global Mobile Menu Toggle */}
        {isOuterPage && (
          <button
            className={`md:hidden fixed top-4 left-4 z-20 p-1 bg-transparent border-none text-[var(--text-muted)] active:text-[var(--text-primary)] transition-opacity ${isMobileMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'}`}
            onClick={() => setIsMobileMenuOpen(true)}
          >
            <Menu size={24} />
          </button>
        )}

        {/* Inner Left Sidebar: conversation list (only show for chat routes) */}
        {isChatRoute && <Sidebar />}

        {/* Center: chat content or page content */}
        <main className="chat-main">
          <div className={isChatRoute ? "chat-fluid" : ``} 
          style={{  flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden'}}
          >
            {isContactRoute && <ContactSidebar />}
            
            <Outlet />

          </div>
        </main>
      </div>
    </>
  );
}
