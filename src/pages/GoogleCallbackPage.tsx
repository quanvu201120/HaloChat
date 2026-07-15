import { useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useAuthStore as useAuth } from '../store/authStore';
import { parseError } from '../services/api';
import { useToast } from '../context/ToastContext';

const GOOGLE_OAUTH_STATE_KEY = 'halochat_google_oauth_state';

export default function GoogleCallbackPage() {
  const { googleLogin } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const hasHandled = useRef(false);

  useEffect(() => {
    if (hasHandled.current) return;
    hasHandled.current = true;

    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    const storedState = sessionStorage.getItem(GOOGLE_OAUTH_STATE_KEY);
    sessionStorage.removeItem(GOOGLE_OAUTH_STATE_KEY);

    if (error) {
      toast.error('Đăng nhập Google đã bị hủy.');
      navigate('/login', { replace: true });
      return;
    }

    if (!code || !state || !storedState || state !== storedState) {
      toast.error('Phiên đăng nhập Google không hợp lệ.');
      navigate('/login', { replace: true });
      return;
    }

    googleLogin(code)
      .then((payload) => {
        if (payload.isBanned) {
          toast.warning('Tài khoản của bạn đang bị khóa.');
          navigate(payload.appeal?.reportId ? `/appeal/${payload.appeal.reportId}` : '/appeal', {
            replace: true,
            state: { bannedAppeal: payload.appeal, banUntil: payload.banUntil },
          });
          return;
        }

        toast.success('Đăng nhập Google thành công!');
        navigate('/', { replace: true });
      })
      .catch((err) => {
        toast.error(parseError(err));
        navigate('/login', { replace: true });
      });
  }, [googleLogin, navigate, searchParams, toast]);

  return (
    <div className="login-page" style={{ position: 'relative' }}>
      <div className="login-bg-orb orb1" />
      <div className="login-bg-orb orb2" />
      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">
            <Loader2 size={28} style={{ animation: 'spin 0.8s linear infinite' }} />
          </div>
          <h1 className="login-title">HaloChat</h1>
          <p className="login-subtitle">Đang hoàn tất đăng nhập Google...</p>
        </div>
      </div>
    </div>
  );
}

export { GOOGLE_OAUTH_STATE_KEY };
