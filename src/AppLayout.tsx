import { Outlet, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import Sidebar from './components/Sidebar';

export default function AppLayout() {
  const { user, accessToken } = useAuth();
  const location = useLocation();

  if (!user || !accessToken) {
    return <Navigate to="/login" replace />;
  }

  const isChatRoute =
    location.pathname === '/' ||
    location.pathname.startsWith('/chat');

  return (
    <ChatProvider>
      <div className="app-layout">
        {/* Left Sidebar: conversation list */}
        <Sidebar />

        {/* Center: chat content or page content */}
        <main className="chat-main">
          <div className={isChatRoute ? "chat-fluid" : "page-content"} style={isChatRoute ? { flex: 1, display: 'flex', flexDirection: 'column', width: '100%', height: '100%', overflow: 'hidden' } : {}}>
            <Outlet />
          </div>
        </main>
      </div>
    </ChatProvider>
  );
}
