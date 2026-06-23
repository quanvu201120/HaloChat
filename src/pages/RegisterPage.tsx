import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { UserPlus, Eye, EyeOff, Moon, Sun } from 'lucide-react';

const registerSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();

  const [showPwd, setShowPwd] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', confirmPassword: '' }
  });

  const onSubmit = async (data: RegisterFormValues) => {
    setIsLoading(true);
    try {
      await authApi.register({ email: data.email, password: data.password, confirmPassword: data.confirmPassword });
      toast.success('Đăng ký thành công! Vui lòng nhập mã xác nhận được gửi về email.');
      navigate('/active-account', { state: { email: data.email } });
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
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

        <form className="login-form" onSubmit={handleSubmit(onSubmit)}>
          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email *</label>
            <input
              id="reg-email"
              className={`form-input ${errors.email ? 'is-invalid' : ''}`}
              type="email"
              placeholder="your@email.com"
              {...register('email')}
              autoFocus
            />
            {errors.email && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.email.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Mật khẩu *</label>
            <div style={{ position: 'relative' }}>
              <input
                id="reg-password"
                className={`form-input ${errors.password ? 'is-invalid' : ''}`}
                type={showPwd ? 'text' : 'password'}
                placeholder="Tối thiểu 6 ký tự"
                {...register('password')}
                style={{ paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowPwd(v => !v)}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {errors.password && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.password.message}</div>}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-confirm">Xác nhận mật khẩu *</label>
            <input
              id="reg-confirm"
              className={`form-input ${errors.confirmPassword ? 'is-invalid' : ''}`}
              type="password"
              placeholder="Nhập lại mật khẩu"
              {...register('confirmPassword')}
            />
            {errors.confirmPassword && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.confirmPassword.message}</div>}
          </div>

          <button
            id="btn-register"
            type="submit"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '24px' }}
          >
            {isLoading
              ? <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang đăng ký...</>
              : <><UserPlus size={16} /> Đăng ký</>
            }
          </button>

          <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
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
