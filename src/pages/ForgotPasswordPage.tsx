import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { useTheme } from '../context/ThemeContext';
import { Mail, KeyRound, Eye, EyeOff, ArrowLeft, CheckCircle, Moon, Sun } from 'lucide-react';

type Step = 'email' | 'reset';

const emailSchema = z.object({
  email: z.string().email('Email không hợp lệ'),
});

const resetSchema = z.object({
  code: z.string().min(1, 'Vui lòng nhập mã xác nhận'),
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string()
}).refine(data => data.password === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
});

type EmailFormValues = z.infer<typeof emailSchema>;
type ResetFormValues = z.infer<typeof resetSchema>;

export default function ForgotPasswordPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const { theme, toggleTheme } = useTheme();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const emailForm = useForm<EmailFormValues>({
    resolver: zodResolver(emailSchema),
    defaultValues: { email: '' },
  });

  const resetForm = useForm<ResetFormValues>({
    resolver: zodResolver(resetSchema),
    defaultValues: { code: '', password: '', confirmPassword: '' },
  });

  // Step 1: Gửi email
  const onEmailSubmit = async (data: EmailFormValues) => {
    setIsLoading(true);
    try {
      await authApi.forgotPassword(data.email.trim());
      setEmail(data.email.trim());
      toast.success('Đã gửi mã đặt lại mật khẩu! Kiểm tra email của bạn.');
      setStep('reset');
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Đặt lại mật khẩu với code
  const onResetSubmit = async (data: ResetFormValues) => {
    setIsLoading(true);
    try {
      await authApi.resetPassword({ email, code: data.code.trim(), password: data.password, confirmPassword: data.confirmPassword });
      toast.success('Đặt lại mật khẩu thành công! Vui lòng đăng nhập.');
      navigate('/login', { replace: true });
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

      <div className="login-bg-orb orb1" style={{ background: 'var(--accent-orange)' }} />
      <div className="login-bg-orb orb2" style={{ background: 'var(--accent-pink)' }} />

      <div className="login-card">
        {/* Back button */}
        <button
          onClick={() => step === 'reset' ? setStep('email') : navigate('/login')}
          style={{
            display: 'flex', alignItems: 'center', gap: '6px',
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px',
          }}
        >
          <ArrowLeft size={14} />
          {step === 'reset' ? 'Nhập lại email' : 'Quay lại đăng nhập'}
        </button>

        {/* Step indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0', marginBottom: '28px' }}>
          {(['email', 'reset'] as Step[]).map((s, i) => (
            <React.Fragment key={s}>
              <div style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', flex: 1,
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '50%',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '13px', fontWeight: 700,
                  background: step === s
                    ? 'linear-gradient(135deg, var(--accent-orange), var(--accent-pink))'
                    : (i < (['email', 'reset'] as Step[]).indexOf(step))
                      ? 'var(--success)'
                      : 'var(--border)',
                  color: 'white',
                  transition: 'all 0.3s ease',
                }}>
                  {i < (['email', 'reset'] as Step[]).indexOf(step) ? <CheckCircle size={14} /> : i + 1}
                </div>
                <span style={{
                  fontSize: '11px', color: step === s ? 'var(--text-primary)' : 'var(--text-muted)',
                  fontWeight: step === s ? 600 : 400,
                }}>
                  {s === 'email' ? 'Gửi email' : 'Đặt mật khẩu'}
                </span>
              </div>
              {i < 1 && (
                <div style={{
                  height: '2px', flex: 1, marginBottom: '20px',
                  background: i < (['email', 'reset'] as Step[]).indexOf(step)
                    ? 'var(--success)'
                    : 'var(--border)',
                  transition: 'background 0.3s ease',
                }} />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* ===== STEP 1: Email ===== */}
        {step === 'email' && (
          <>
            <div className="login-header">
              <div
                className="login-icon"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-pink))',
                  borderRadius: '12px',
                }}
              >
                <Mail size={24} color="white" />
              </div>
              <h1 className="login-title">Quên mật khẩu</h1>
              <p className="login-subtitle">Nhập email để nhận mã đặt lại mật khẩu</p>
            </div>

            <form className="login-form" onSubmit={emailForm.handleSubmit(onEmailSubmit)}>
              <div className="form-group">
                <label className="form-label" htmlFor="forgot-email">Địa chỉ Email</label>
                <input
                  id="forgot-email"
                  className={`form-input ${emailForm.formState.errors.email ? 'is-invalid' : ''}`}
                  type="email"
                  placeholder="your@email.com"
                  {...emailForm.register('email')}
                  autoFocus
                  autoComplete="email"
                />
                {emailForm.formState.errors.email && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{emailForm.formState.errors.email.message}</div>}
              </div>

              <button
                id="btn-send-forgot"
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '16px' }}
              >
                {isLoading ? (
                  <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang gửi...</>
                ) : (
                  <><Mail size={16} /> Gửi mã xác nhận</>
                )}
              </button>

              <div style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', marginTop: '16px' }}>
                Nhớ mật khẩu rồi?{' '}
                <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
                  Đăng nhập
                </Link>
              </div>
            </form>
          </>
        )}

        {/* ===== STEP 2: Nhập code + mật khẩu mới ===== */}
        {step === 'reset' && (
          <>
            <div className="login-header">
              <div
                className="login-icon"
                style={{
                  background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-pink))',
                  borderRadius: '12px',
                }}
              >
                <KeyRound size={24} color="white" />
              </div>
              <h1 className="login-title">Đặt mật khẩu mới</h1>
              <p className="login-subtitle">
                Mã xác nhận đã gửi đến<br />
                <strong style={{ color: 'var(--text-primary)' }}>{email}</strong>
              </p>
            </div>

            <form className="login-form" onSubmit={resetForm.handleSubmit(onResetSubmit)}>
              <div className="form-group">
                <label className="form-label" htmlFor="reset-code">Mã xác nhận</label>
                <input
                  id="reset-code"
                  className={`form-input ${resetForm.formState.errors.code ? 'is-invalid' : ''}`}
                  type="text"
                  placeholder="Nhập mã từ email..."
                  {...resetForm.register('code')}
                  autoFocus
                  style={{ letterSpacing: '2px', fontSize: '14px', textAlign: 'center' }}
                />
                {resetForm.formState.errors.code && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{resetForm.formState.errors.code.message}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-password">Mật khẩu mới</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-password"
                    className={`form-input ${resetForm.formState.errors.password ? 'is-invalid' : ''}`}
                    type={showPwd ? 'text' : 'password'}
                    placeholder="Tối thiểu 6 ký tự"
                    {...resetForm.register('password')}
                    style={{ paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowPwd(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {resetForm.formState.errors.password && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{resetForm.formState.errors.password.message}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="reset-confirm">Xác nhận mật khẩu</label>
                <div style={{ position: 'relative' }}>
                  <input
                    id="reset-confirm"
                    className={`form-input ${resetForm.formState.errors.confirmPassword ? 'is-invalid' : ''}`}
                    type={showConfirm ? 'text' : 'password'}
                    placeholder="Nhập lại mật khẩu mới"
                    {...resetForm.register('confirmPassword')}
                    style={{ paddingRight: '44px' }}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)}
                    style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {resetForm.formState.errors.confirmPassword && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{resetForm.formState.errors.confirmPassword.message}</div>}
              </div>

              <button
                id="btn-reset-password"
                type="submit"
                className="btn btn-primary"
                disabled={isLoading}
                style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '24px' }}
              >
                {isLoading ? (
                  <><div className="loading-spinner" style={{ width: 16, height: 16 }} /> Đang xử lý...</>
                ) : (
                  <><KeyRound size={16} /> Đặt lại mật khẩu</>
                )}
              </button>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
