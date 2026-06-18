import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usersApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { UserCircle, Save, Phone, MapPin, Mail, Shield, Activity, LogOut, Camera, Trash2, AlertTriangle } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';

export function ProfilePageContent() {
  const navigate = useNavigate();
  const { user, logoutAll, updateUser, logout } = useAuth();
  const toast = useToast();

  const [form, setForm] = useState({
    _id: user?._id || '',
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [isLoading, setIsLoading] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeletingAvatar, setIsDeletingAvatar] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    countdown?: number;
    action: () => void | Promise<void>;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const payload = {
        _id: form._id,
        name: form.name.trim() || null,
        phone: form.phone.trim() || null,
        address: form.address.trim() || null,
      };

      const res = await usersApi.update(payload);
      const updated = res.data?.data ?? res.data;
      updateUser(updated);
      setForm({
        _id: updated?._id || form._id,
        name: updated?.name || '',
        phone: updated?.phone || '',
        address: updated?.address || '',
      });
      toast.success('Cập nhật hồ sơ thành công!');
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsLoading(false);
    }
  };

  const getInitials = () => {
    if (user?.name) return user.name.slice(0, 2).toUpperCase();
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const infoItems = [
    { icon: <Shield size={14} />, label: 'Vai trò', value: user?.role || '—' },
    { icon: <Activity size={14} />, label: 'Loại TK', value: user?.accountType || 'LOCAL' },
    {
      icon: <Activity size={14} />, label: 'Trạng thái',
      value: user?.isActive ? '✅ Đã kích hoạt' : '❌ Chưa kích hoạt',
    },
  ];

  const handleLogoutAll = () => {
    setConfirmAction({
      title: 'Đăng xuất tất cả',
      message: 'Bạn có chắc chắn muốn đăng xuất khỏi tất cả các thiết bị khác?',
      isDanger: true,
      confirmText: 'Đăng xuất',
      action: async () => {
        setLogoutAllLoading(true);
        try {
          await logoutAll();
          toast.success('Đã đăng xuất tất cả thiết bị.');
          navigate('/login', { replace: true });
        } catch (err: any) {
          toast.error(parseError(err));
        } finally {
          setLogoutAllLoading(false);
        }
      }
    });
  };

  const handleUploadAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploading(true);
    try {
      const res = await usersApi.uploadAvatar(file);
      const updated = res.data?.data ?? res.data;
      updateUser(updated);
      toast.success('Cập nhật ảnh đại diện thành công!');
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleDeleteAvatar = () => {
    setConfirmAction({
      title: 'Xóa ảnh đại diện',
      message: 'Bạn có chắc chắn muốn xóa ảnh đại diện?',
      isDanger: true,
      confirmText: 'Xóa',
      action: async () => {
        setIsDeletingAvatar(true);
        try {
          const res = await usersApi.deleteAvatar();
          const updated = res.data?.data ?? res.data;
          updateUser({ ...updated, avatar: undefined });
          toast.success('Đã xóa ảnh đại diện!');
        } catch (err: any) {
          toast.error(parseError(err));
        } finally {
          setIsDeletingAvatar(false);
        }
      }
    });
  };

  const handleDisableSelfStep2 = () => {
    setConfirmAction({
      title: 'Xác nhận vô hiệu hóa',
      message: 'Hành động này không thể hoàn tác. Bạn chắc chắn muốn vô hiệu hóa tài khoản?',
      isDanger: true,
      confirmText: 'Vô hiệu hóa',
      countdown: 5,
      action: async () => {
        setIsDisabling(true);
        try {
          await usersApi.disableSelf();
          toast.success('Tài khoản đã bị vô hiệu hóa.');
          await logout();
          navigate('/login', { replace: true });
        } catch (err: any) {
          toast.error(parseError(err));
          setIsDisabling(false);
        }
      }
    });
  };

  const handleDisableSelf = () => {
    setConfirmAction({
      title: 'CẢNH BÁO: Vô hiệu hóa tài khoản',
      message: 'Bạn có chắc chắn muốn vô hiệu hóa tài khoản? Bạn sẽ bị đăng xuất và không thể đăng nhập lại cho đến khi liên hệ quản trị viên.',
      isDanger: true,
      confirmText: 'Tiếp tục',
      action: () => {
        handleDisableSelfStep2();
        return false;
      }
    });
  };

  return (
    <div>
      <div style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
          Hồ sơ cá nhân
        </h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
          Quản lý thông tin tài khoản của bạn
        </p>
      </div>

      <div className="profile-section">
        {/* Left: avatar + read-only info */}
        <div className="card profile-card-info" style={{ position: 'relative' }}>
          <div 
            className="profile-avatar" 
            style={{ 
              position: 'relative', 
              cursor: 'pointer',
              backgroundImage: user?.avatar?.url ? `url(${user.avatar.url})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            onClick={() => fileInputRef.current?.click()}
            title="Đổi ảnh đại diện"
          >
            {!user?.avatar?.url && getInitials()}
            <div style={{
              position: 'absolute', bottom: -5, right: -5, background: 'var(--accent-primary)',
              borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center',
              justifyContent: 'center', color: '#fff', border: '2px solid var(--bg-primary)'
            }}>
              {isUploading ? <div className="loading-spinner" style={{ width: 14, height: 14, borderColor: 'white', borderTopColor: 'transparent' }} /> : <Camera size={14} />}
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/jpeg,image/png,image/gif"
            onChange={handleUploadAvatar}
          />

          {user?.avatar?.url && (
            <button 
              className="btn btn-secondary" 
              style={{ padding: '6px 12px', fontSize: '12px', marginTop: '8px' }}
              onClick={handleDeleteAvatar}
              disabled={isDeletingAvatar}
            >
              {isDeletingAvatar ? 'Đang xóa...' : <><Trash2 size={12} /> Xóa ảnh</>}
            </button>
          )}
          <div className="profile-name">{user?.name || 'Chưa đặt tên'}</div>
          <div className="profile-email">{user?.email}</div>

          <span className={`badge ${user?.role === 'ADMIN' ? 'badge-info' : 'badge-warning'}`} style={{ marginTop: '4px' }}>
            {user?.role}
          </span>

          <div className="divider" style={{ width: '100%', margin: '16px 0 8px' }} />

          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {infoItems.map((item) => (
              <div key={item.label} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', borderRadius: '8px', background: 'var(--bg-secondary)',
              }}>
                <span style={{ color: 'var(--accent-primary)' }}>{item.icon}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', minWidth: '60px' }}>{item.label}</span>
                <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right: editable form */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
            <div style={{
              width: '44px', height: '44px', borderRadius: 'var(--radius-md)',
              background: 'rgba(99,102,241,0.15)', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserCircle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Chỉnh sửa hồ sơ</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Thông tin có thể thay đổi</div>
            </div>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email readonly */}
            <div className="form-group">
              <label className="form-label">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={13} /> Email (không thể thay đổi)
                </span>
              </label>
              <input
                className="form-input"
                value={user?.email || ''}
                disabled
                style={{ opacity: 0.5, cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="profile-name">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <UserCircle size={13} /> Tên hiển thị
                  </span>
                </label>
                <input
                  id="profile-name"
                  className="form-input"
                  placeholder="Nguyễn Văn A"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Để trống nếu bạn muốn xóa tên hiển thị.
                </span>
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-phone">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Phone size={13} /> Số điện thoại
                  </span>
                </label>
                <input
                  id="profile-phone"
                  className="form-input"
                  placeholder="0912345678"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                  Có thể xóa số điện thoại bằng cách để trống.
                </span>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-address">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={13} /> Địa chỉ
                </span>
              </label>
              <input
                id="profile-address"
                className="form-input"
                placeholder="TP. Hồ Chí Minh"
                value={form.address}
                onChange={(e) => setForm({ ...form, address: e.target.value })}
              />
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                Có thể xóa địa chỉ bằng cách để trống.
              </span>
            </div>

            <button
              id="btn-save-profile"
              type="submit"
              className="btn btn-primary"
              disabled={isLoading}
              style={{ alignSelf: 'flex-start', padding: '10px 24px' }}
            >
              {isLoading ? (
                <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</>
              ) : (
                <><Save size={15} /> Lưu thay đổi</>
              )}
            </button>
          </form>
        </div>

        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Bảo mật tài khoản</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Thay đổi mật khẩu định kỳ để bảo vệ tài khoản của bạn.
              </div>
            </div>
            <button
              id="btn-go-change-password"
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/change-password')}
              style={{ padding: '8px 16px' }}
            >
              <Shield size={15} style={{ marginRight: '6px' }} /> Đổi mật khẩu
            </button>
          </div>
        </div>

        <div className="card" style={{ marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Phiên đăng nhập</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Thu hồi mọi phiên hoạt động trên các thiết bị khác.
              </div>
            </div>
            <button
              id="btn-logout-all"
              type="button"
              className="btn btn-secondary"
              onClick={handleLogoutAll}
              disabled={logoutAllLoading}
              style={{ color: 'var(--error)' }}
            >
              {logoutAllLoading
                ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
                : <><LogOut size={15} /> Đăng xuất tất cả</>}
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--error)', marginBottom: '4px' }}>Vô hiệu hóa tài khoản</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                Tài khoản của bạn sẽ bị vô hiệu hóa, không thể đăng nhập sau khi vô hiệu hóa.
              </div>
            </div>
            <button
              id="btn-disable-account"
              type="button"
              className="btn btn-danger"
              onClick={handleDisableSelf}
              disabled={isDisabling}
            >
              {isDisabling
                ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang vô hiệu hóa...</>
                : <><AlertTriangle size={15} /> vô hiệu hóa tài khoản</>}
            </button>
          </div>
        </div>
      </div>

      {confirmAction && (
        <ConfirmModal
          isOpen={true}
          title={confirmAction.title}
          message={confirmAction.message}
          isDanger={confirmAction.isDanger}
          confirmText={confirmAction.confirmText}
          countdown={confirmAction.countdown}
          onConfirm={confirmAction.action}
          onCancel={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

class ProfileErrorBoundary extends React.Component<{children: React.ReactNode}, {error: any}> {
  constructor(props: any) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(error: any) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: '50px', background: 'red', color: 'white' }}>
          <h1>ProfilePage Render Error!</h1>
          <pre>{this.state.error.toString()}</pre>
          <pre>{this.state.error.stack}</pre>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function SafeProfilePage() {
  return <ProfileErrorBoundary><ProfilePageContent /></ProfileErrorBoundary>;
}
