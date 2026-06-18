import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Eye, EyeOff, LogIn, Moon, Sun } from 'lucide-react';

export default function LoginPage() {
  const { login, isLoading, user, accessToken } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const toast = useToast();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Nếu đã đăng nhập rồi thì redirect về trang chính
  useEffect(() => {
    if (user && accessToken) {
      navigate('/', { replace: true });
    }
  }, [user, accessToken, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Vui lòng nhập email và mật khẩu');
      return;
    }
    try {
      await login(email, password);
      toast.success('Đăng nhập thành công!');
      window.location.href = '/';
    } catch (err: any) {
      const msg: string = parseError(err);

      // LocalStrategy ném BadRequestException 400: 'User is not active'
      const isInactive =
        err?.response?.status === 400 &&
        (msg.toLowerCase().includes('not active') ||
          msg.toLowerCase().includes('inactive'));

      if (isInactive) {
        toast.warning('Tài khoản chưa được kích hoạt. Vui lòng nhập mã xác nhận.');
        navigate('/active-account', { state: { email } });
      } else {
        toast.error(msg);
      }
    }
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
          <div className="login-icon">💬</div>
          <h1 className="login-title">HaloChat</h1>
          <p className="login-subtitle">Đăng nhập để quản lý tài khoản của bạn</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">Email</label>
            <input
              id="login-email"
              className="form-input"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus
              autoComplete="email"
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">Mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                className="form-input"
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
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
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
          >
            {isLoading
              ? <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang đăng nhập...</>
              : <><LogIn size={16} /> Đăng nhập</>
            }
          </button>

          <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '13px', color: 'var(--text-muted)' }}>
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
