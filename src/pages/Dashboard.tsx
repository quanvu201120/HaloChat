import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { usersApi, authApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import {
  UserCircle, Mail, Phone, MapPin, Shield, Activity,
  Save, KeyRound, LogOut, CheckCircle2, Clock, User,
} from 'lucide-react';

export default function Dashboard() {
  const navigate = useNavigate();
  const { user, logout, logoutAll } = useAuth();
  const toast = useToast();

  // Profile form
  const [form, setForm] = useState({
    _id: user?._id || '',
    name: user?.name || '',
    phone: user?.phone || '',
    address: user?.address || '',
  });
  const [isSaving, setIsSaving] = useState(false);

  // Change password form
  const [pwdForm, setPwdForm] = useState({
    passwordOld: '',
    passwordNew: '',
    confirmPassword: '',
  });
  const [showPwd, setShowPwd] = useState({ old: false, new: false, confirm: false });
  const [isPwdSaving, setIsPwdSaving] = useState(false);
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);

  const getInitials = () => {
    if (user?.name) return user.name.slice(0, 2).toUpperCase();
    if (user?.email) return user.email.slice(0, 2).toUpperCase();
    return 'U';
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Tên hiển thị không được để trống');
      return;
    }
    setIsSaving(true);
    try {
      const res = await usersApi.update(form);
      const updated = res.data?.data ?? res.data;
      const stored = localStorage.getItem('user');
      if (stored) {
        const merged = { ...JSON.parse(stored), ...updated };
        localStorage.setItem('user', JSON.stringify(merged));
      }
      toast.success('Cập nhật hồ sơ thành công!');
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pwdForm.passwordOld || !pwdForm.passwordNew || !pwdForm.confirmPassword) {
      toast.error('Vui lòng điền đầy đủ thông tin');
      return;
    }
    if (pwdForm.passwordNew.length < 6) {
      toast.error('Mật khẩu mới phải có ít nhất 6 ký tự');
      return;
    }
    if (pwdForm.passwordNew !== pwdForm.confirmPassword) {
      toast.error('Mật khẩu xác nhận không khớp');
      return;
    }
    if (pwdForm.passwordOld === pwdForm.passwordNew) {
      toast.error('Mật khẩu mới phải khác mật khẩu cũ');
      return;
    }
    setIsPwdSaving(true);
    try {
      await authApi.changePassword(pwdForm);
      toast.success('Đổi mật khẩu thành công!');
      setPwdForm({ passwordOld: '', passwordNew: '', confirmPassword: '' });
    } catch (err: any) {
      toast.error(parseError(err));
    } finally {
      setIsPwdSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      await logout();
      toast.success('Đăng xuất thành công!');
      navigate('/login');
    } catch {
      toast.error('Đăng xuất thất bại');
    }
  };

  const handleLogoutAll = async () => {
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
  };

  const infoItems = [
    {
      icon: <Mail size={16} />,
      label: 'Email',
      value: user?.email || '—',
      color: 'rgba(37,99,235,0.10)',
      iconColor: '#2563eb',
    },
    {
      icon: <Phone size={16} />,
      label: 'Điện thoại',
      value: user?.phone || 'Chưa cập nhật',
      color: 'rgba(13,148,136,0.10)',
      iconColor: '#0d9488',
    },
    {
      icon: <MapPin size={16} />,
      label: 'Địa chỉ',
      value: user?.address || 'Chưa cập nhật',
      color: 'rgba(219,39,119,0.10)',
      iconColor: '#db2777',
    },
    {
      icon: <Shield size={16} />,
      label: 'Vai trò',
      value: user?.role || '—',
      color: 'rgba(99,102,241,0.10)',
      iconColor: 'var(--accent-primary)',
    },
    {
      icon: <Activity size={16} />,
      label: 'Loại tài khoản',
      value: user?.accountType || 'LOCAL',
      color: 'rgba(217,119,6,0.10)',
      iconColor: '#d97706',
    },
    {
      icon: <CheckCircle2 size={16} />,
      label: 'Trạng thái',
      value: user?.isActive ? 'Đã kích hoạt' : 'Chưa kích hoạt',
      color: user?.isActive ? 'rgba(5,150,105,0.10)' : 'rgba(220,38,38,0.10)',
      iconColor: user?.isActive ? 'var(--success)' : 'var(--error)',
    },
  ];

  return (
    <div className="personal-dashboard">
      {/* Welcome Banner */}
      <div className="welcome-banner">
        <div className="welcome-avatar">{getInitials()}</div>
        <div className="welcome-text">
          <h1>Xin chào, {user?.name || user?.email?.split('@')[0] || 'bạn'} 👋</h1>
          <p>Quản lý thông tin và bảo mật tài khoản của bạn</p>
        </div>
        <div className="welcome-badge">
          <div className="status-pill">
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: user?.isActive ? '#4ade80' : '#f87171', display: 'inline-block' }} />
            {user?.isActive ? 'Đang hoạt động' : 'Chưa kích hoạt'}
          </div>
        </div>
      </div>

      {/* Info Overview */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header">
          <h3 className="card-title">
            <User size={16} style={{ display: 'inline', marginRight: 8, verticalAlign: 'middle' }} />
            Thông tin tài khoản
          </h3>
          <span className="badge badge-info">
            <span className="badge-dot" />
            ID: {user?._id?.slice(-8) || '—'}
          </span>
        </div>
        <div className="info-grid">
          {infoItems.map((item) => (
            <div key={item.label} className="info-item">
              <div
                className="info-item-icon"
                style={{ background: item.color, color: item.iconColor }}
              >
                {item.icon}
              </div>
              <div className="info-item-content">
                <div className="info-item-label">{item.label}</div>
                <div className="info-item-value">{item.value}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Edit Profile */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: 'rgba(99,102,241,0.10)', color: 'var(--accent-primary)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <UserCircle size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>Chỉnh sửa hồ sơ</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cập nhật tên, số điện thoại và địa chỉ</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleSaveProfile} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
              style={{ opacity: 0.55, cursor: 'not-allowed' }}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="profile-name">
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <UserCircle size={13} /> Tên hiển thị <span style={{ color: 'var(--error)' }}>*</span>
                </span>
              </label>
              <input
                id="profile-name"
                className="form-input"
                placeholder="Nguyễn Văn A"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
              />
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
          </div>

          <button
            id="btn-save-profile"
            type="submit"
            className="btn btn-primary"
            disabled={isSaving}
            style={{ alignSelf: 'flex-start', padding: '10px 28px' }}
          >
            {isSaving ? (
              <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</>
            ) : (
              <><Save size={15} /> Lưu thay đổi</>
            )}
          </button>
        </form>
      </div>

      {/* Change Password */}
      <div className="card" style={{ marginBottom: '20px' }}>
        <div className="card-header" style={{ marginBottom: '20px', paddingBottom: '16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: 'rgba(13,148,136,0.10)', color: 'var(--accent-teal)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <KeyRound size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>Đổi mật khẩu</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Cập nhật mật khẩu để bảo mật tài khoản</div>
            </div>
          </div>
        </div>

        <form onSubmit={handleChangePassword} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="form-group">
            <label className="form-label" htmlFor="pwd-old">Mật khẩu hiện tại</label>
            <div style={{ position: 'relative' }}>
              <input
                id="pwd-old"
                className="form-input"
                type={showPwd.old ? 'text' : 'password'}
                placeholder="••••••••"
                value={pwdForm.passwordOld}
                onChange={(e) => setPwdForm({ ...pwdForm, passwordOld: e.target.value })}
                style={{ paddingRight: '44px' }}
              />
              <button type="button" onClick={() => setShowPwd(p => ({ ...p, old: !p.old }))}
                style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                {showPwd.old ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label className="form-label" htmlFor="pwd-new">Mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pwd-new"
                  className="form-input"
                  type={showPwd.new ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={pwdForm.passwordNew}
                  onChange={(e) => setPwdForm({ ...pwdForm, passwordNew: e.target.value })}
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPwd(p => ({ ...p, new: !p.new }))}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPwd.new ? '🙈' : '👁️'}
                </button>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="pwd-confirm">Xác nhận mật khẩu mới</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="pwd-confirm"
                  className="form-input"
                  type={showPwd.confirm ? 'text' : 'password'}
                  placeholder="••••••••"
                  value={pwdForm.confirmPassword}
                  onChange={(e) => setPwdForm({ ...pwdForm, confirmPassword: e.target.value })}
                  style={{ paddingRight: '44px' }}
                />
                <button type="button" onClick={() => setShowPwd(p => ({ ...p, confirm: !p.confirm }))}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}>
                  {showPwd.confirm ? '🙈' : '👁️'}
                </button>
              </div>
            </div>
          </div>

          {pwdForm.confirmPassword && pwdForm.passwordNew !== pwdForm.confirmPassword && (
            <span className="form-error" style={{ marginTop: '-8px' }}>Mật khẩu không khớp</span>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
            <button
              id="btn-change-password"
              type="submit"
              className="btn btn-primary"
              disabled={isPwdSaving}
              style={{ padding: '10px 28px' }}
            >
              {isPwdSaving
                ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang lưu...</>
                : <><KeyRound size={15} /> Đổi mật khẩu</>}
            </button>

            <div className="card" style={{ background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.12)', padding: '12px 16px', flex: 1, minWidth: '200px' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.8 }}>
                💡 Mật khẩu tối thiểu 6 ký tự · Kết hợp chữ hoa, chữ thường, số · Không dùng mật khẩu dễ đoán
              </div>
            </div>
          </div>
        </form>
      </div>

      {/* Session / Logout */}
      <div className="card">
        <div className="card-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px', height: '40px', borderRadius: 'var(--radius-md)',
              background: 'rgba(220,38,38,0.08)', color: 'var(--error)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <LogOut size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '15px' }}>Phiên đăng nhập</div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Quản lý đăng xuất thiết bị</div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', marginTop: '4px' }}>
          <button
            id="btn-logout"
            type="button"
            className="btn btn-secondary"
            onClick={handleLogout}
          >
            <LogOut size={15} /> Đăng xuất thiết bị này
          </button>
          <button
            id="btn-logout-all"
            type="button"
            className="btn btn-danger"
            onClick={handleLogoutAll}
            disabled={logoutAllLoading}
          >
            {logoutAllLoading
              ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
              : <><LogOut size={15} /> Đăng xuất tất cả thiết bị</>}
          </button>
        </div>

        <div style={{ marginTop: '14px', display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-sm)' }}>
          <Clock size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            Đăng nhập với <strong style={{ color: 'var(--text-secondary)' }}>{user?.email}</strong> · Phiên hiện tại đang hoạt động
          </span>
        </div>
      </div>
    </div>
  );
}
