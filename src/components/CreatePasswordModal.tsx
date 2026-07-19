import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { KeyRound, Eye, EyeOff } from 'lucide-react';
import Modal from './Modal';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';

const createPasswordSchema = z.object({
  password: z.string().min(6, 'Mật khẩu phải có ít nhất 6 ký tự'),
  confirmPassword: z.string(),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Xác nhận mật khẩu không khớp',
  path: ['confirmPassword'],
});

type CreatePasswordFormValues = z.infer<typeof createPasswordSchema>;
const CREATE_PASSWORD_PROMPT_KEY = 'halochat_create_password_prompt';

type VisibilityState = {
  password: boolean;
  confirm: boolean;
};

interface CreatePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  onSkipLogout?: () => void | Promise<void>;
  showSkipLogout?: boolean;
}

export default function CreatePasswordModal({
  isOpen,
  onClose,
  onSuccess,
  onSkipLogout,
  showSkipLogout = false,
}: CreatePasswordModalProps) {
  const toast = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [show, setShow] = useState<VisibilityState>({ password: false, confirm: false });

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreatePasswordFormValues>({
    resolver: zodResolver(createPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  });

  const handleClose = () => {
    reset();
    setShow({ password: false, confirm: false });
    sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
    onClose();
  };

  const onSubmit = async (data: CreatePasswordFormValues) => {
    setIsLoading(true);
    try {
      await authApi.createPassword({
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      toast.success('Tạo mật khẩu thành công!');
      reset();
      setShow({ password: false, confirm: false });
      sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
      onSuccess?.();
      onClose();
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Tạo mật khẩu"
      closeOnOverlayClick={!showSkipLogout}
      footer={(
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', width: '100%' }}>
          <button
            type="submit"
            form="create-password-form"
            className="btn btn-primary"
            disabled={isLoading}
            style={{ background: 'linear-gradient(135deg, #4f46e5, #7c3aed)' }}
          >
            {isLoading ? 'Đang lưu...' : 'Tạo mật khẩu'}
          </button>
          {showSkipLogout && onSkipLogout && (
            <button
              type="button"
              className="btn btn-danger"
              disabled={isLoading}
              style={{ background: 'linear-gradient(135deg, #dc2626, #b91c1c)', color:"white" }}
              onClick={async () => {
                setIsLoading(true);
                try {
                  await onSkipLogout();
                } finally {
                  setIsLoading(false);
                }
              }}
            >
              {isLoading ? 'Đang xử lý...' : 'Bỏ qua & đăng xuất'}
            </button>
          )}
        </div>
      )}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
        <div style={{ width: '44px', height: '44px', borderRadius: 'var(--radius-md)', background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <KeyRound size={20} />
        </div>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Tài khoản Google chưa có mật khẩu</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Bạn có thể tạo mật khẩu lần đầu để dùng đăng nhập bằng email và mật khẩu.</div>
        </div>
      </div>

      <form id="create-password-form" onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div className="form-group">
          <label className="form-label" htmlFor="create-password">Mật khẩu mới</label>
          <div style={{ position: 'relative' }}>
            <input
              id="create-password"
              className={`form-input ${errors.password ? 'is-invalid' : ''}`}
              type={show.password ? 'text' : 'password'}
              placeholder="Tối thiểu 6 ký tự"
              {...register('password')}
              style={{ paddingRight: '44px' }}
            />
            <button type="button" onClick={() => setShow((prev) => ({ ...prev, password: !prev.password }))} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {show.password ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.password && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.password.message}</div>}
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="create-confirm">Xác nhận mật khẩu</label>
          <div style={{ position: 'relative' }}>
            <input
              id="create-confirm"
              className={`form-input ${errors.confirmPassword ? 'is-invalid' : ''}`}
              type={show.confirm ? 'text' : 'password'}
              placeholder="Nhập lại mật khẩu"
              {...register('confirmPassword')}
              style={{ paddingRight: '44px' }}
            />
            <button type="button" onClick={() => setShow((prev) => ({ ...prev, confirm: !prev.confirm }))} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
              {show.confirm ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
          {errors.confirmPassword && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.confirmPassword.message}</div>}
        </div>
      </form>
    </Modal>
  );
}
