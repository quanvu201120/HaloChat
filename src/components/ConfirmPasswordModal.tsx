import { useState, useRef, useEffect } from 'react';
import Modal from './Modal';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Eye, EyeOff } from 'lucide-react';

interface ConfirmPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  title?: string;
  message?: string;
}

export default function ConfirmPasswordModal({
  isOpen,
  onClose,
  onSuccess,
  title = 'Xác nhận mật khẩu',
  message = 'Vui lòng nhập mật khẩu của bạn để tiếp tục.',
}: ConfirmPasswordModalProps) {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setPassword('');
      setShowPassword(false);
      setIsLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) {
      toast.error('Vui lòng nhập mật khẩu');
      return;
    }

    try {
      setIsLoading(true);
      await authApi.confirmPassword(password);
      toast.success('Xác nhận thành công');
      onSuccess();
    } catch (error) {
      toast.error(parseError(error));
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={isLoading ? () => {} : onClose}
      title={title}
      footer={
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Hủy
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={isLoading || !password.trim()}
          >
            {isLoading ? 'Đang xử lý...' : 'Xác nhận'}
          </button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} style={{ padding: '10px 0' }}>
        <p style={{ fontSize: '14.5px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
          {message}
        </p>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              className="form-input"
              placeholder="Nhập mật khẩu..."
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              style={{ width: '100%', paddingRight: '44px' }}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              tabIndex={-1}
              style={{
                position: 'absolute', right: '12px', top: '50%',
                transform: 'translateY(-50%)', background: 'none',
                border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                display: 'flex', alignItems: 'center',
              }}
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
}
