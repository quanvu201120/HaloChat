import { BrowserRouter, Routes, Route, Navigate, useParams, Outlet } from 'react-router-dom';
import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { ToastProvider } from './context/ToastContext';
import { ThemeProvider } from './context/ThemeContext';
import AppLayout from './AppLayout';

// Public pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ActiveAccountPage from './pages/ActiveAccountPage';

// Protected pages
import EmptyStatePage from './pages/EmptyStatePage';
import ChatPage from './pages/ChatPage';
import ProfilePage from './pages/ProfilePage';
import ChangePasswordPage from './pages/ChangePasswordPage';
import FriendsPage from './pages/FriendsPage';
import AdminPage from './pages/AdminPage';

function ChatRoute() {
  const { conversationId } = useParams();
  return <ChatPage key={conversationId} />;
}

function PublicLayout() {
  const { user, accessToken } = useAuthStore();
  if (user && accessToken) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}

function AppInit() {
  useEffect(() => {
    return useAuthStore.getState().init();
  }, []);
  return null;
}

export default function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppInit />
        <ToastProvider>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicLayout />}>
                <Route path="/login" element={<LoginPage />} />
                <Route path="/register" element={<RegisterPage />} />
                <Route path="/forgot-password" element={<ForgotPasswordPage />} />
                <Route path="/active-account" element={<ActiveAccountPage />} />
              </Route>

              {/* Protected routes (wrapped in AppLayout + ChatProvider) */}
              <Route element={<AppLayout />}>
                <Route index element={<EmptyStatePage />} />
                <Route path="/message-requests" element={<EmptyStatePage />} />
                <Route path="/friends" element={<FriendsPage />} />
                <Route path="/requests" element={<FriendsPage />} />
                <Route path="/sent-requests" element={<FriendsPage />} />
                <Route path="/blocked" element={<FriendsPage />} />
                <Route path="/chat/:conversationId" element={<ChatRoute />} />
                <Route path="/profile" element={<ProfilePage />} />
                <Route path="/change-password" element={<ChangePasswordPage />} />
              </Route>

              {/* Admin Route - Full Screen (Outside AppLayout) */}
              <Route path="/admin" element={<AdminPage />} />

              {/* Catch-all redirect */}
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </ToastProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}
