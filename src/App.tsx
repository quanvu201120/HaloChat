import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
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

function ChatRoute() {
  const { conversationId } = useParams();
  return <ChatPage key={conversationId} />;
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            {/* Public routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/active-account" element={<ActiveAccountPage />} />

            {/* Protected routes (wrapped in AppLayout + ChatProvider) */}
            <Route element={<AppLayout />}>
              <Route index element={<EmptyStatePage />} />
              <Route path="chat/:conversationId" element={<ChatRoute />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="change-password" element={<ChangePasswordPage />} />
            </Route>

            {/* Fallback */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
