import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore as useAuth } from '../store/authStore';
import { parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff, LogIn, Moon, Sun } from 'lucide-react';

const GOOGLE_OAUTH_STATE_KEY = 'halochat_google_oauth_state';

const loginSchema = z.object({
  identifier: z.string()
    .min(1, 'Email hoặc Số điện thoại không được để trống')
    .refine(
      (val) => {
        const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val);
        const isPhone = /^(?:0|\+84)[3|5|7|8|9][0-9]{8}$/.test(val);
        return isEmail || isPhone;
      },
      {
        message: 'Vui lòng nhập Email hoặc Số điện thoại hợp lệ',
      }
    ),
  password: z.string().min(1, 'Mật khẩu không được để trống'),
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function LoginPage() {
  const { login, isLoading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [showPassword, setShowPassword] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { identifier: '', password: '' },
    mode: 'onSubmit',
    reValidateMode: 'onChange',
  });

  const onSubmit = async (data: LoginFormValues) => {
    try {
      const payload = await login(data.identifier, data.password);
      if (payload.isBanned) {
        toast.warning('Tài khoản của bạn đang bị khóa.');
        navigate(payload.appeal?.reportId ? `/appeal/${payload.appeal.reportId}` : '/appeal', {
          replace: true,
          state: { bannedAppeal: payload.appeal, banUntil: payload.banUntil },
        });
        return;
      }
      toast.success('Đăng nhập thành công!');
      navigate('/', { replace: true });
    } catch (err: any) {
      const msg: string = parseError(err);

      const isInactive = err?.response?.status === 403;

      if (isInactive) {
        toast.warning('Tài khoản chưa được kích hoạt. Vui lòng nhập mã xác nhận.');
        navigate('/active-account', { state: { email: data.identifier } });
      } else {
        toast.error(msg);
      }
    }
  };

  const handleGoogleLogin = () => {
    const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID?.trim();
    const redirectUri = import.meta.env.VITE_GOOGLE_REDIRECT_URI?.trim();

    if (!clientId || !redirectUri) {
      toast.error('Chưa cấu hình đăng nhập Google.');
      return;
    }

    const state = crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`;
    sessionStorage.setItem(GOOGLE_OAUTH_STATE_KEY, state);

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'openid email profile',
      state,
      prompt: 'select_account',
    });

    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
  };

  return (
    <div className="login-page" style={{ position: 'relative' }}>
      <button
        onClick={toggleTheme}
        title={theme === 'dark' ? 'Chế độ sáng' : 'Chế độ tối'}
        style={{
          position: 'absolute', top: '24px', right: '24px',
          width: '40px', height: '40px', borderRadius: '50%',
          background: 'var(--bg-card)', border: '1px solid var(--border)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'pointer', color: 'var(--text-primary)',
          boxShadow: 'var(--shadow-sm)', zIndex: 10
        }}
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      <div className="login-bg-orb orb1" />
      <div className="login-bg-orb orb2" />

      <div className="login-card">
        <div className="login-header">
          <div className="login-icon">HC</div>
          <h1 className="login-title">HaloChat</h1>
          <p className="login-subtitle">Đăng nhập để quản lý tài khoản của bạn</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-identifier">Email / Số điện thoại</label>
            <input
              id="login-identifier"
              className={`form-input ${errors.identifier ? 'is-invalid' : ''}`}
              type="text"
              placeholder="Nhập email hoặc SĐT"
              {...register('identifier')}
              autoFocus
              autoComplete="username"
            />
            {errors.identifier && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.identifier.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className={`form-input ${errors.password ? 'is-invalid' : ''}`}
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                {...register('password')}
                autoComplete="current-password"
                style={{ paddingRight: '44px' }}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                style={{
                  position: 'absolute', right: '12px', top: '50%',
                  transform: 'translateY(-50%)', background: 'none',
                  border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                  display: 'flex', alignItems: 'center',
                }}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.password.message}</div>}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Link to="/forgot-password" style={{ fontSize: '13px', color: 'var(--accent-primary)', textDecoration: 'none' }}>
              Quên mật khẩu?
            </Link>
          </div>

          <button
            id="btn-login"
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '16px' }}
          >
            {isLoading
              ? <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang đăng nhập...</>
              : <><LogIn size={16} /> Đăng nhập</>
            }
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', margin: '4px 0' }}>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
            <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>hoặc</span>
            <div className="divider" style={{ flex: 1, margin: 0 }} />
          </div>

          <button
            id="btn-google-login"
            type="button"
            className="btn btn-secondary"
            disabled={isLoading}
            onClick={handleGoogleLogin}
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
          >
            <span style={{ fontWeight: 800, fontSize: '16px', lineHeight: 1 }}>G</span> Đăng nhập với Google
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
            Chưa có tài khoản?{' '}
            <Link to="/register" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Đăng ký ngay
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
