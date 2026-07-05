import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { connectSocket, disconnectSocket } from '../services/socket';
import { normalizeId } from '../utils/chat';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
/**
 * Lightweight socket manager dành riêng cho trang Admin.
 * Chỉ kết nối socket để lắng nghe sự kiện bị vô hiệu hóa tài khoản (user:disabled).
 * Không fetch conversations, không fetch users-online.
 */
export default function AdminSocketManager() {
  const toast = useToast();
  const navigate = useNavigate();
  useEffect(() => {
    const { user, accessToken } = useAuthStore.getState();
    if (!user?._id || !accessToken) return;
    const currentUserId = user._id;
    const sock = connectSocket(accessToken);
    const onUserDisabled = (data: { userId: string }) => {
      const userId = normalizeId(data.userId);
      if (!userId || userId !== currentUserId) return;
      useAuthStore.getState().localLogout();
      toast.warning('Tài khoản của bạn đã bị vô hiệu hóa.');
      navigate('/login');
    };
    sock.on('user:disabled', onUserDisabled);
    return () => {
      sock.off('user:disabled', onUserDisabled);
      disconnectSocket();
    };
  }, []);
  return null;
}
