import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { ShieldCheck, RefreshCw, ArrowLeft } from 'lucide-react';

/**
 * Trang kích hoạt tài khoản.
 * CHỈ truy cập được khi được redirect từ LoginPage với state.email.
 * Không có link trực tiếp từ sidebar / menu.
 */
export default function ActiveAccountPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const toast = useToast();

  // Email có thể được truyền từ Login/Register qua router state
  const emailFromState = (location.state as any)?.email || '';

  const [email, setEmail] = useState(emailFromState);
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Đếm ngược cooldown gửi lại
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleActivate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) {
      toast.error('Vui lòng nhập email đã đăng ký');
      return;
    }
    if (!code.trim()) {
      toast.error('Vui lòng nhập mã kích hoạt');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.active(email.trim(), code.trim());
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
    if (!email.trim()) {
      toast.error('Vui lòng nhập email để gửi lại mã kích hoạt');
      return;
    }
    setResendLoading(true);
    try {
      await authApi.resendCode(email.trim());
      toast.success('Đã gửi lại mã kích hoạt. Kiểm tra email!');
      setResendCooldown(60);
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="login-page">
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

        <form className="login-form" onSubmit={handleActivate}>
          <div className="form-group">
            <label className="form-label" htmlFor="activation-email">
              Email
            </label>
            <input
              id="activation-email"
              className="form-input"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoFocus={!emailFromState}
              readOnly={Boolean(emailFromState)}
              style={emailFromState ? { opacity: 0.7, cursor: 'not-allowed' } : undefined}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="activation-code">
              Mã kích hoạt
            </label>
            <input
              id="activation-code"
              className="form-input"
              type="text"
              placeholder="Nhập mã từ email..."
              value={code}
              onChange={(e) => setCode(e.target.value)}
              autoFocus={Boolean(emailFromState)}
              style={{ letterSpacing: '2px', fontSize: '16px', textAlign: 'center' }}
            />
          </div>

          <button
            id="btn-activate"
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
          >
            {isLoading ? (
              <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang kích hoạt...</>
            ) : (
              <><ShieldCheck size={16} /> Kích hoạt tài khoản</>
            )}
          </button>

          <div style={{ textAlign: 'center' }}>
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
