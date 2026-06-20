import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Modal from './Modal';
import { authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { clearStoredAuth } from '../services/api';
import { Mail, Lock, Key, AlertTriangle } from 'lucide-react';

interface UpdateEmailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function UpdateEmailModal({ isOpen, onClose }: UpdateEmailModalProps) {
  const navigate = useNavigate();
  const toast = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [password, setPassword] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [code, setCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  // Reset state when modal closes/opens
  React.useEffect(() => {
    if (isOpen) {
      setStep(1);
      setPassword('');
      setNewEmail('');
      setCode('');
      setIsLoading(false);
    }
  }, [isOpen]);

  const handleConfirmPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.confirmPassword(password);
      setStep(2);
      toast.success('Xác nhận mật khẩu thành công');
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.sendCodeUpdateEmail(newEmail);
      setStep(3);
      toast.success('Mã xác nhận đã được gửi đến email mới');
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpdateEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await authApi.updateEmail(newEmail, code);
      toast.success('Cập nhật email thành công. Vui lòng đăng nhập lại.');
      clearStoredAuth();
      navigate('/login', { replace: true });
      onClose();
    } catch (err: any) {
      toast.error(parseError(err));
      setIsLoading(false);
    }
  };

  let title = 'Cập nhật Email';
  if (step === 1) title = 'Xác nhận danh tính';
  else if (step === 2) title = 'Nhập Email mới';
  else if (step === 3) title = 'Xác thực Email';

  const renderFooter = () => {
    if (step === 1) {
      return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isLoading}>
            Hủy
          </button>
          <button type="submit" form="form-confirm-password" className="btn btn-primary" disabled={isLoading || !password}>
            {isLoading ? 'Đang kiểm tra...' : 'Tiếp tục'}
          </button>
        </div>
      );
    }
    if (step === 2) {
      return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setStep(1)} disabled={isLoading}>
            Quay lại
          </button>
          <button type="submit" form="form-send-code" className="btn btn-primary" disabled={isLoading || !newEmail}>
            {isLoading ? 'Đang gửi...' : 'Gửi mã xác nhận'}
          </button>
        </div>
      );
    }
    if (step === 3) {
      return (
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', width: '100%' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setStep(2)} disabled={isLoading}>
            Đổi Email khác
          </button>
          <button type="submit" form="form-update-email" className="btn btn-primary" disabled={isLoading || !code}>
            {isLoading ? 'Đang cập nhật...' : 'Xác nhận & Cập nhật'}
          </button>
        </div>
      );
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title} footer={renderFooter()} closeOnOverlayClick={false}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Timeline Stepper */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '8px', marginTop: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 'bold',
              background: step >= 1 ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: step >= 1 ? '#fff' : 'var(--text-muted)'
            }}>1</div>
            <div style={{ height: '2px', width: '40px', background: step >= 2 ? 'var(--accent-primary)' : 'var(--border)' }} />
            
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 'bold',
              background: step >= 2 ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: step >= 2 ? '#fff' : 'var(--text-muted)'
            }}>2</div>
            <div style={{ height: '2px', width: '40px', background: step >= 3 ? 'var(--accent-primary)' : 'var(--border)' }} />
            
            <div style={{
              width: '24px', height: '24px', borderRadius: '50%',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 'bold',
              background: step >= 3 ? 'var(--accent-primary)' : 'var(--bg-secondary)',
              color: step >= 3 ? '#fff' : 'var(--text-muted)'
            }}>3</div>
          </div>
        </div>

        {/* Step 1: Confirm Password */}
        {step === 1 && (
          <form id="form-confirm-password" onSubmit={handleConfirmPassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Vì lý do bảo mật, vui lòng nhập mật khẩu hiện tại của bạn để tiếp tục.
            </p>
            <div className="form-group">
              <label className="form-label">Mật khẩu hiện tại</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }}>
                  <Lock size={16} />
                </span>
                <input
                  type="password"
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="Nhập mật khẩu"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>
          </form>
        )}

        {/* Step 2: New Email */}
        {step === 2 && (
          <form id="form-send-code" onSubmit={handleSendCode} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <p style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              Nhập địa chỉ email mới mà bạn muốn sử dụng. Chúng tôi sẽ gửi một mã xác nhận đến email này.
            </p>
            <div className="form-group">
              <label className="form-label">Email mới</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }}>
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '36px' }}
                  placeholder="VD: emailmoi@example.com"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>
          </form>
        )}

        {/* Step 3: Verify Code */}
        {step === 3 && (
          <form id="form-update-email" onSubmit={handleUpdateEmail} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ padding: '12px', background: 'rgba(239, 68, 68, 0.1)', borderLeft: '4px solid var(--error)', borderRadius: '4px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
              <AlertTriangle size={18} color="var(--error)" style={{ marginTop: '2px', flexShrink: 0 }} />
              <p style={{ fontSize: '13px', color: 'var(--text-primary)', margin: 0, lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--error)' }}>Lưu ý quan trọng:</strong> Sau khi cập nhật email thành công, <b>tất cả thiết bị sẽ bị đăng xuất</b>. Bạn sẽ cần đăng nhập lại bằng email mới.
              </p>
            </div>
            
            <div className="form-group">
              <label className="form-label">Email mới</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }}>
                  <Mail size={16} />
                </span>
                <input
                  type="email"
                  className="form-input"
                  style={{ paddingLeft: '36px', opacity: 0.6, cursor: 'not-allowed' }}
                  value={newEmail}
                  disabled
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Mã xác nhận</label>
              <div style={{ position: 'relative' }}>
                <span style={{ position: 'absolute', top: '10px', left: '12px', color: 'var(--text-muted)' }}>
                  <Key size={16} />
                </span>
                <input
                  type="text"
                  className="form-input"
                  style={{ paddingLeft: '36px', fontWeight: 'bold' }}
                  placeholder="VD: 550e8400-e29b..."
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  disabled={isLoading}
                  autoFocus
                />
              </div>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
