import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { KeyRound, Eye, EyeOff, ShieldCheck } from 'lucide-react';

const changePasswordSchema = z.object({
  passwordOld: z.string().min(1, 'Vui lòng nhập mật khẩu hiện tại'),
  passwordNew: z.string().min(6, 'Mật khẩu mới phải có ít nhất 6 ký tự'),
  confirmPassword: z.string()
}).refine(data => data.passwordNew === data.confirmPassword, {
  message: 'Mật khẩu xác nhận không khớp',
  path: ['confirmPassword']
}).refine(data => data.passwordOld !== data.passwordNew, {
  message: 'Mật khẩu mới phải khác mật khẩu cũ',
  path: ['passwordNew']
});

type ChangePasswordFormValues = z.infer<typeof changePasswordSchema>;

type PasswordVisibility = {
  old: boolean;
  new: boolean;
  confirm: boolean;
};

type PasswordField = keyof ChangePasswordFormValues;
type PasswordVisibilityKey = keyof PasswordVisibility;

function PasswordInput({
  id,
  label,
  field,
  showKey,
  register,
  error,
  show,
  onToggle,
}: {
  id: string;
  label: string;
  field: PasswordField;
  showKey: PasswordVisibilityKey;
  register: any;
  error?: string;
  show: PasswordVisibility;
  onToggle: (key: PasswordVisibilityKey) => void;
}) {
  return (
    <div className="form-group">
      <label className="form-label" htmlFor={id}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input
          id={id}
          className={`form-input ${error ? 'is-invalid' : ''}`}
          type={show[showKey] ? 'text' : 'password'}
          placeholder="••••••••"
          {...register(field)}
          style={{ paddingRight: '44px' }}
        />
        <button
          type="button"
          onClick={() => onToggle(showKey)}
          style={{
            position: 'absolute',
            right: '12px',
            top: '50%',
            transform: 'translateY(-50%)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
          }}
        >
          {show[showKey] ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
      {error && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{error}</div>}
    </div>
  );
}

export default function ChangePasswordPage() {
  const toast = useToast();
  
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm<ChangePasswordFormValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { passwordOld: '', passwordNew: '', confirmPassword: '' }
  });

  const [show, setShow] = useState<PasswordVisibility>({
    old: false,
    new: false,
    confirm: false,
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleToggleVisibility = (key: PasswordVisibilityKey) => {
    setShow((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const onSubmit = async (data: ChangePasswordFormValues) => {
    setIsLoading(true);
    try {
      await authApi.changePassword({ passwordOld: data.passwordOld, passwordNew: data.passwordNew, confirmPassword: data.confirmPassword });
      toast.success('Đổi mật khẩu thành công!');
      reset();
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div>
      <div style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button 
          onClick={() => window.history.back()}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', alignSelf: 'flex-start', padding: 0, fontSize: '13px' }}
        >
          ← Quay lại
        </button>
        <div>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Đổi mật khẩu
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Cập nhật mật khẩu để bảo mật tài khoản
          </p>
        </div>
      </div>

      <div style={{ maxWidth: '480px' }}>
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <KeyRound size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Thay đổi mật khẩu</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cần xác nhận mật khẩu hiện tại</div>
            </div>
          </div>

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <PasswordInput
              id="pwd-old"
              label="Mật khẩu hiện tại"
              field="passwordOld"
              showKey="old"
              register={register}
              error={errors.passwordOld?.message}
              show={show}
              onToggle={handleToggleVisibility}
            />
            <div className="divider" />
            <PasswordInput
              id="pwd-new"
              label="Mật khẩu mới"
              field="passwordNew"
              showKey="new"
              register={register}
              error={errors.passwordNew?.message}
              show={show}
              onToggle={handleToggleVisibility}
            />
            <PasswordInput
              id="pwd-confirm"
              label="Xác nhận mật khẩu mới"
              field="confirmPassword"
              showKey="confirm"
              register={register}
              error={errors.confirmPassword?.message}
              show={show}
              onToggle={handleToggleVisibility}
            />

            <button
              id="btn-change-password"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ alignSelf: 'flex-start', padding: '10px 24px', marginTop: '8px' }}
            >
              {isLoading
                ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</>
                : <><ShieldCheck size={15} /> Đổi mật khẩu</>}
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: '16px', background: 'rgba(99,102,241,0.05)' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px' }}>
            💡 Gợi ý bảo mật
          </h3>
          <ul style={{ fontSize: '13px', color: 'var(--text-muted)', paddingLeft: '16px', lineHeight: 2 }}>
            <li>Mật khẩu tối thiểu 6 ký tự</li>
            <li>Kết hợp chữ hoa, chữ thường, số và ký tự đặc biệt</li>
            <li>Không dùng mật khẩu dễ đoán như ngày sinh, tên</li>
            <li>Không tái sử dụng mật khẩu từ các dịch vụ khác</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
