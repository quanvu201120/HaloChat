import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { UserPlus, Eye, EyeOff } from 'lucide-react';

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();

  // RegisterAuthDto: { email, password, confirmPassword } — không có name
  const [form, setForm] = useState({ email: '', password: '', confirmPassword: '' });
  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.email || !form.password) {
      toast.error('Email và mật khẩu là bắt buộc');
      return;
    }
    if (form.password.length < 6) {
      toast.error('Mật khẩu phải có ít nhất 6 ký tự');
      return;
    }
    if (form.password !== form.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    setIsLoading(true);
    try {
      await authApi.register(form);
      toast.success('Đăng ký thành công! Vui lòng nhập mã xác nhận được gửi về email.');
      navigate('/active-account', { state: { email: form.email } });
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="login-page">
      <div className="login-bg-orb orb1" style={{ background: 'var(--accent-secondary)' }} />
      <div className="login-bg-orb orb2" style={{ background: 'var(--accent-teal)' }} />

      <div className="login-card" style={{ maxWidth: '420px' }}>
        <div className="login-header">
          <div className="login-icon" style={{ background: 'linear-gradient(135deg, var(--accent-secondary), var(--accent-teal))' }}>
            <UserPlus size={24} color="white" />
          </div>
          <h1 className="login-title">Tạo tài khoản</h1>
          <p className="login-subtitle">Đăng ký để sử dụng hệ thống</p>
        </div>

        <form className="login-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email *</label>
            <input
              id="reg-email"
              className="form-input"
              type="email"
              placeholder="your@email.com"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              autoFocus
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Mật khẩu *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-password"
                className="form-input"
                type={showPwd ? 'text' : 'password'}
                placeholder="Tối thiểu 6 ký tự"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                style={{ paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Xác nhận mật khẩu *</label>
            <input
              id="reg-confirm"
              className="form-input"
              type="password"
              placeholder="Nhập lại mật khẩu"
              value={form.confirmPassword}
              onChange={(e) => setForm({ ...form, confirmPassword: e.target.value })}
              style={{ borderColor: form.confirmPassword && form.password !== form.confirmPassword ? 'var(--error)' : '' }}
            />
            {form.confirmPassword && form.password !== form.confirmPassword && (
              <span className="form-error">Mật khẩu không khớp</span>
            )}
          </div>

          <button
            id="btn-register"
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px' }}
          >
            {isLoading
              ? <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang đăng ký...</>
              : <><UserPlus size={16} /> Đăng ký</>
            }
          </button>

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)' }}>
            Đã có tài khoản?{' '}
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              Đăng nhập
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
