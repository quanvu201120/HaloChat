import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { ShieldCheck, RefreshCw, ArrowLeft, Moon, Sun } from 'lucide-react';

const activeSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  code: z.string().min(1, 'Vui lòng nhập mã kích hoạt')
});

type ActiveFormValues = z.infer<typeof activeSchema>;

/**
 * Trang kích hoạt tài khoản.
 * CHỈ truy cập được khi được redirect từ LoginPage với state.email.
 * Không có link trực tiếp từ sidebar / menu.
 */
export default function ActiveAccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();

  // Email có thể được truyền từ Login/Register qua router state
  const emailFromState = (location.state as any)?.email || '';

  const {
    register,
    handleSubmit,
    formState: { errors },
    getValues,
  } = useForm<ActiveFormValues>({
    resolver: zodResolver(activeSchema),
    defaultValues: { email: emailFromState, code: '' }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Đếm ngược cooldown gửi lại
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const onActivateSubmit = async (data: ActiveFormValues) => {
    setIsLoading(true);
    try {
      await authApi.active(data.email.trim(), data.code.trim());
      toast.success('Kích hoạt tài khoản thành công! Vui lòng đăng nhập.');
      navigate('/login', { replace: true });
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    const currentEmail = getValues('email');
    if (!currentEmail || !currentEmail.trim()) {
      toast.error('Vui lòng nhập email để gửi lại mã kích hoạt');
      return;
    }
    setResendLoading(true);
    try {
      await authApi.resendCode(currentEmail.trim());
      toast.success('Đã gửi lại mã kích hoạt. Kiểm tra email!');
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setResendLoading(false);
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

      <div className="login-bg-orb orb1" style={{ background: 'var(--accent-teal)' }} />
      <div className="login-bg-orb orb2" style={{ background: 'var(--accent-secondary)' }} />

      <div className="login-card">
        <button
          onClick={() => navigate('/login')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px',
          }}
        >
          <ArrowLeft size={14} /> Quay lại đăng nhập
        </button>

        <div className="login-header">
          <div className="login-icon" style={{ background: 'linear-gradient(135deg, var(--accent-teal), #06b6d4)' }}>
            ✉️
          </div>
          <h1 className="login-title">Kích hoạt tài khoản</h1>
          <p className="login-subtitle">
            Nhập email và mã xác nhận để kích hoạt tài khoản
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit(onActivateSubmit)}>
          <div className="form-group">
            <label className="form-label" htmlFor="activation-email">
              Email
            </label>
            <input
              id="activation-email"
              className={`form-input ${errors.email ? 'is-invalid' : ''}`}
              type="email"
              placeholder="email@example.com"
              {...register('email')}
              autoFocus={!emailFromState}
              readOnly={Boolean(emailFromState)}
              style={emailFromState ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
            />
            {errors.email && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.email.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="activation-code">
              Mã kích hoạt
            </label>
            <input
              id="activation-code"
              className={`form-input ${errors.code ? 'is-invalid' : ''}`}
              type="text"
              placeholder="Nhập mã từ email..."
              {...register('code')}
              autoFocus={Boolean(emailFromState)}
              style={{ letterSpacing: '2px', fontSize: '16px', textAlign: 'center' }}
            />
            {errors.code && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.code.message}</div>}
          </div>

          <button
            id="btn-activate"
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '16px' }}
          >
            {isLoading ? (
              <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang kích hoạt...</>
            ) : (
              <><ShieldCheck size={16} /> Kích hoạt tài khoản</>
            )}
          </button>

          <div style={{ textAlign: 'center', marginTop: '16px' }}>
            <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chưa nhận được email? </span>
            <button
              type="button"
              id="btn-resend"
              onClick={handleResend}
              disabled={resendLoading || resendCooldown > 0}
              style={{
                background: 'none', border: 'none', cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                color: resendCooldown > 0 ? 'var(--text-muted)' : 'var(--accent-primary)',
                fontSize: '13px', fontWeight: 600,
              }}
            >
              {resendLoading ? (
                'Đang gửi...'
              ) : resendCooldown > 0 ? (
                `Gửi lại sau ${resendCooldown}s`
              ) : (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                  <RefreshCw size={12} /> Gửi lại
                </span>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
