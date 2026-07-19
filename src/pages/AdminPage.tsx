import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../constants/roles';
import { Navigate, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import ConfirmPasswordModal from '../components/ConfirmPasswordModal';
import AdminLayout from './admin/AdminLayout';
import SessionRestoreFallback from '../components/SessionRestoreFallback';

export default function AdminPage() {
  const { user, accessToken, isSessionRestoring, sessionRestoreError, isAdminVerified, setAdminVerified } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Reset admin verification state when leaving the page or tab loses focus
  useEffect(() => {
    const lockAdmin = () => {
      setAdminVerified(false);
      queryClient.removeQueries({
        predicate: (query) => String(query.queryKey[0] ?? '').startsWith('admin_'),
      });
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        lockAdmin();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', lockAdmin);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', lockAdmin);
      lockAdmin();
    };
  }, [queryClient, setAdminVerified]);

  if (isSessionRestoring) {
    return <div className="w-full h-screen bg-[var(--bg-primary)]" />;
  }

  if (user && !accessToken && sessionRestoreError) {
    return <SessionRestoreFallback />;
  }

  if (user?.role !== UserRole.ADMIN && user?.role !== UserRole.SUPER_ADMIN) {
    return <Navigate to="/" replace />;
  }

  if (!isAdminVerified) {
    return (
      <div className="flex flex-col w-full h-screen bg-[var(--bg-primary)]">
        <ConfirmPasswordModal
          isOpen={true}
          onClose={() => navigate('/')}
          onSuccess={() => setAdminVerified(true)}
          title="Bảo mật Quản trị viên"
          message="Vui lòng xác nhận mật khẩu để truy cập trang quản trị."
        />
      </div>
    );
  }

  return <AdminLayout />;
}
