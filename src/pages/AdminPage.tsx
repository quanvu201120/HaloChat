import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { UserRole } from '../constants/roles';
import { Navigate, useNavigate } from 'react-router-dom';
import ConfirmPasswordModal from '../components/ConfirmPasswordModal';
import { ArrowLeft } from 'lucide-react';

import AdminLayout from './admin/AdminLayout';

export default function AdminPage() {
  const { user, isAdminVerified, setAdminVerified } = useAuthStore();
  const navigate = useNavigate();

  // Reset admin verification state when leaving the page or tab loses focus
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        // [DEV] Tạm thời tắt reset admin khi mất focus để dễ dev
        // setAdminVerified(false);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      setAdminVerified(false);
    };
  }, [setAdminVerified]);

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
