import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useAuthStore as useAuth } from '../store/authStore';
import { authApi, usersApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { UserCircle, Save, Phone, MapPin, Mail, Shield, Activity, LogOut, Camera, Trash2, AlertTriangle, Edit2, ChevronLeft, Calendar, Users, FileText, Monitor, Smartphone, TabletSmartphone, CircleHelp, RefreshCw } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import UpdateEmailModal from '../components/UpdateEmailModal';
import MediaLightbox from '../components/MediaLightbox';
import { UserRole } from '../constants/roles';
import { UI_MESSAGES } from '../constants/messages';
import { getDeviceCategoryForDisplay, getDeviceDetailLabel, getDeviceDisplayLabel } from '../utils/device';

const profileSchema = z.object({
  name: z.string().optional(),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(val), {
      message: UI_MESSAGES.profile.phoneInvalid,
    }),
  address: z.string().max(150).optional(),
  dateOfBirth: z.string().optional().refine((val) => {
    if (!val) return true;
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    return d <= new Date();
  }, { message: UI_MESSAGES.profile.dateOfBirthInvalid }),
  gender: z.string().optional(),
  bio: z.string().max(250).optional(),
});

type ProfileFormValues = z.infer<typeof profileSchema>;

type ProfileSession = {
  sessionId: string;
  deviceId: string;
  deviceCategory: ReturnType<typeof getDeviceCategoryForDisplay>;
  deviceLabel: string;
  deviceDetail: string;
  lastActiveLabel: string;
  expiresLabel: string;
  lastActiveAt: number;
  isCurrent: boolean;
};

type SessionApiItem = {
  _id?: string;
  deviceId?: string;
  sessionId?: string;
  deviceName?: string;
  userAgent?: string;
  expiresAt?: string | Date;
  lastUsedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

const decodeJwtPayload = (token?: string | null) => {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded)) as { sessionId?: string };
  } catch {
    return null;
  }
};

const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Không rõ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không rõ';

  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${time} - ${day}/${month}/${year}`;
};

const toTimestamp = (value?: string | Date | null) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

const mapSessionItem = (session: SessionApiItem, currentSessionId: string | null): ProfileSession | null => {
  const sessionId = String(session?._id || session?.sessionId || '').trim();
  const deviceId = String(session?.deviceId || '').trim();
  if (!sessionId || !deviceId) return null;

  return {
    sessionId,
    deviceId,
    deviceCategory: getDeviceCategoryForDisplay(session?.deviceName, session?.userAgent),
    deviceLabel: getDeviceDisplayLabel(session?.deviceName, session?.userAgent),
    deviceDetail: getDeviceDetailLabel(session?.userAgent),
    lastActiveLabel: `Hoạt động gần nhất: ${formatDateTime(session?.lastUsedAt || session?.updatedAt || session?.createdAt)}`,
    expiresLabel: `Hết hạn: ${formatDateTime(session?.expiresAt)}`,
    lastActiveAt: toTimestamp(session?.lastUsedAt || session?.updatedAt || session?.createdAt),
    isCurrent: Boolean(currentSessionId && sessionId === currentSessionId),
  };
};

export function ProfilePageContent() {
  const navigate = useNavigate();
  const { user, accessToken, logoutAll, updateUser, localLogout } = useAuth();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors }
  } = useForm<ProfileFormValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      address: user?.address || '',
      dateOfBirth: (user?.dateOfBirth && !isNaN(new Date(user.dateOfBirth).getTime())) 
        ? new Date(user.dateOfBirth).toISOString().split('T')[0] 
        : '',
      gender: user?.gender || '',
      bio: user?.bio || '',
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const isInitialLoading = !user;
  const [logoutAllLoading, setLogoutAllLoading] = useState(false);
  const [sessions, setSessions] = useState<ProfileSession[]>([]);
  const [sessionsLoading, setSessionsLoading] = useState(false);
  const [sessionsError, setSessionsError] = useState('');
  const [sessionsReloadKey, setSessionsReloadKey] = useState(0);
  const [logoutSessionId, setLogoutSessionId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDisabling, setIsDisabling] = useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    countdown?: number;
    action: () => void | boolean | Promise<void | boolean>;
  } | null>(null);
  const [isUpdateEmailModalOpen, setIsUpdateEmailModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const currentSessionId = decodeJwtPayload(accessToken)?.sessionId || null;

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (!user?._id) return;

    let isMounted = true;

    const loadSessions = async () => {
      setSessionsLoading(true);
      setSessionsError('');

      try {
        const res = await authApi.getDevices();
        const payload = res.data?.data ?? res.data;
        const list = Array.isArray(payload) ? payload : [];
        const mapped = list
          .map((item) => mapSessionItem(item, currentSessionId))
          .filter(Boolean)
          .sort((a, b) => {
            const sessionA = a as ProfileSession;
            const sessionB = b as ProfileSession;

            if (sessionA.isCurrent !== sessionB.isCurrent) {
              return sessionA.isCurrent ? -1 : 1;
            }

            return sessionB.lastActiveAt - sessionA.lastActiveAt;
          }) as ProfileSession[];

        if (!isMounted) return;
        setSessions(mapped);
      } catch (err) {
        if (!isMounted) return;
        setSessions([]);
        setSessionsError(parseError(err));
      }

      if (isMounted) {
        setSessionsLoading(false);
      }
    };

    void loadSessions();

    return () => {
      isMounted = false;
    };
  }, [user?._id, sessionsReloadKey, currentSessionId]);

  const onSubmit = async (data: ProfileFormValues) => {
    setIsLoading(true);
    try {
      const payload = {
        name: data.name?.trim() || '',
        phone: data.phone?.trim() || null,
        address: data.address?.trim() || null,
        dateOfBirth: data.dateOfBirth || null,
        gender: data.gender || null,
        bio: data.bio?.trim() || null,
      };

      const res = await usersApi.update(payload);
      const updated = res.data?.data ?? res.data;
      updateUser({
        ...updated,
        phone: updated.phone || '',
        address: updated.address || '',
        dateOfBirth: updated.dateOfBirth || '',
        gender: updated.gender || '',
        bio: updated.bio || '',
      });
      toast.success(UI_MESSAGES.profile.updateSuccess);
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
    { icon: <Activity size={14} />, label: 'Tài khoản', value: user?.accountType || 'LOCAL' },
  ];

  const handleLogoutAll = () => {
    setConfirmAction({
      title: 'Đăng xuất tất cả',
      message: UI_MESSAGES.profile.logoutAllConfirm,
      isDanger: true,
      confirmText: 'Đăng xuất',
      action: async () => {
        setLogoutAllLoading(true);
        try {
          await logoutAll();
          toast.success(UI_MESSAGES.profile.logoutAllSuccess);
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
      message: UI_MESSAGES.profile.deleteAvatarConfirm,
      isDanger: true,
      action: () => {
        setConfirmAction(null);
        (async () => {
          setIsUploading(true);
          try {
            const res = await usersApi.deleteAvatar();
            const updated = res.data?.data ?? res.data;
            updateUser({ ...updated, avatar: undefined });
            toast.success(UI_MESSAGES.profile.deleteAvatarSuccess);
          } catch (err: any) {
            toast.error(parseError(err));
          } finally {
            setIsUploading(false);
          }
        })();
      }
    });
  };

  const handleDisableSelfStep3 = () => {
    setConfirmAction({
      title: UI_MESSAGES.profile.disableStep3Title,
      message: UI_MESSAGES.profile.disableStep3Message,
      isDanger: true,
      confirmText: UI_MESSAGES.profile.disableStep3Confirm,
      countdown: 5,
      action: async () => {
        setIsDisabling(true);
        try {
          await usersApi.disableSelf();
          toast.success(UI_MESSAGES.profile.disableSuccess);
          localLogout();
          navigate('/login', { replace: true });
        } catch (err: any) {
          toast.error(parseError(err));
          setIsDisabling(false);
        }
      }
    });
  };

  const handleDisableSelfStep2 = () => {
    setConfirmAction({
      title: UI_MESSAGES.profile.disableStep2Title,
      message: UI_MESSAGES.profile.disableStep2Message,
      isDanger: true,
      confirmText: UI_MESSAGES.profile.disableStep2Confirm,
      countdown: 5,
      action: () => {
        handleDisableSelfStep3();
        return false;
      }
    });
  };

  const handleLogoutSession = (session: ProfileSession) => {
    setConfirmAction({
      title: 'Xóa thiết bị',
      message: session.isCurrent
        ? 'Bạn có chắc chắn muốn xóa thiết bị hiện tại?'
        : `Bạn có chắc chắn muốn xóa ${session.deviceLabel}?`,
      isDanger: true,
      confirmText: 'Xóa',
      action: async () => {
        setConfirmAction(null);
        setLogoutSessionId(session.deviceId);

        try {
          await authApi.logoutDevice(session.deviceId);

          if (session.isCurrent) {
            localLogout();
            navigate('/login', { replace: true });
            return;
          }

          toast.success(UI_MESSAGES.profile.sessionsLogoutSuccess);
          setSessionsReloadKey((value) => value + 1);
        } catch (err: any) {
          toast.error(parseError(err));
        } finally {
          setLogoutSessionId(null);
        }
      }
    });
  };

  const handleDisableSelf = () => {
    setConfirmAction({
      title: UI_MESSAGES.profile.disableStep1Title,
      message: UI_MESSAGES.profile.disableStep1Message,
      isDanger: true,
      confirmText: UI_MESSAGES.profile.disableStep1Confirm,
      action: () => {
        handleDisableSelfStep2();
        return false;
      }
    });
  };

  if (isInitialLoading) {
    return (
      <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
          <button 
            className="icon-btn mobile-back-btn" 
            onClick={() => navigate('/')}
            title="Quay lại"
          >
            <ChevronLeft size={24} />
          </button>
          <div style={{paddingLeft:'15px'}}>

            <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
              Hồ sơ cá nhân
            </h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
              Quản lý thông tin tài khoản của bạn
            </p>
          </div>
        </div>

        <div className="profile-section">
          {/* Left column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card profile-card-info" style={{ height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 animate-pulse" />
              <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-4 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mt-2 animate-pulse" />
              <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded mt-2 animate-pulse" />
              <div className="divider" style={{ width: '100%', margin: '16px 0 8px' }} />
              <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
            </div>
            <div className="card" style={{ height: 'auto' }}>
              <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse" />
              <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4 animate-pulse" />
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
            </div>
          </div>

          {/* Right column */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="card" style={{ height: 'auto' }}>
              <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
                <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
                <div className="space-y-2">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
                </div>
              </div>
              <div className="flex flex-col gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                  </div>
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                    <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                  </div>
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                </div>
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-2 animate-pulse" />
              </div>
            </div>
            
            <div className="card" style={{ height: 'auto' }}>
              <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
                <div className="space-y-2 w-full max-w-[200px]">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                </div>
                <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-2 w-full max-w-[200px]">
                  <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
                </div>
                <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <button 
          className="icon-btn mobile-back-btn" 
          onClick={() => navigate('/')}
          title="Quay lại"
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{paddingLeft:'15px'}}>
          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Hồ sơ cá nhân
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Quản lý thông tin tài khoản của bạn
          </p>
        </div>
      </div>

      <div className="profile-section">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Left: avatar + read-only info */}
        <div className="card profile-card-info" style={{ position: 'relative' }}>
          <div 
            className="profile-avatar" 
            style={{ 
              position: 'relative', 
              cursor: user?.avatar?.url ? 'pointer' : 'default',
              backgroundImage: user?.avatar?.url ? `url(${user.avatar.url})` : 'none',
              backgroundSize: 'cover',
              backgroundPosition: 'center'
            }}
            onClick={() => {
              if (user?.avatar?.url) {
                setSelectedMedia({ url: user.avatar.url, type: 'image' });
              }
            }}
            title={user?.avatar?.url ? "Xem ảnh đại diện" : "Ảnh đại diện"}
          >
            {!user?.avatar?.url && getInitials()}
            
            <div 
              ref={menuRef}
              style={{
                position: 'absolute', bottom: -5, right: -5,
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (user?.avatar?.url) {
                  setIsAvatarMenuOpen(!isAvatarMenuOpen);
                } else {
                  fileInputRef.current?.click();
                }
              }}
            >
              <div style={{
                background: 'var(--accent-primary)',
                borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center',
                justifyContent: 'center', color: '#fff', border: '2px solid var(--bg-primary)',
                cursor: 'pointer'
              }} title={user?.avatar?.url ? "Tùy chọn" : "Đổi ảnh đại diện"}>
                {isUploading ? <div className="loading-spinner" style={{ width: 14, height: 14, borderColor: 'white', borderTopColor: 'transparent' }} /> : (user?.avatar?.url ? <Edit2 size={13} /> : <Camera size={14} />)}
              </div>

              {isAvatarMenuOpen && (
                <div style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '8px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  padding: '4px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px',
                  zIndex: 10,
                  minWidth: '120px',
                  animation: 'fadeIn 0.2s ease-out'
                }}>
                  <button
                    className="dropdown-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '4px', color: 'var(--text-primary)' }}
                    onClick={(e) => { e.stopPropagation(); setIsAvatarMenuOpen(false); fileInputRef.current?.click(); }}
                  >
                    <Camera size={14} /> Chọn mới
                  </button>
                  <button
                    className="dropdown-item"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '4px' }}
                    onClick={(e) => { e.stopPropagation(); setIsAvatarMenuOpen(false); handleDeleteAvatar(); }}
                    disabled={isUploading}
                  >
                    <Trash2 size={14} /> Xóa ảnh
                  </button>
                </div>
              )}
            </div>
          </div>
          
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{ display: 'none' }} 
            accept="image/jpeg,image/png,image/gif"
            onChange={handleUploadAvatar}
          />
          <div className="profile-name">{user?.name || 'Chưa đặt tên'}</div>
          <div className="profile-email">{user?.email}</div>

          {(user?.role === UserRole.ADMIN || user?.role === UserRole.SUPER_ADMIN) && (
            <span className="badge badge-info" style={{ marginTop: '4px' }}>
              {user?.role}
            </span>
          )}

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

        {/* Change password card moved here */}
        <div className="card">
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
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

          <form onSubmit={handleSubmit(onSubmit)} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="profile-bio" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <FileText size={13} /> Tiểu sử
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  {(watch('bio') || '').length}/250
                </span>
              </label>
              <textarea
                id="profile-bio"
                className={`form-input ${errors.bio ? 'is-invalid' : ''}`}
                placeholder="Giới thiệu đôi nét về bạn..."
                rows={3}
                maxLength={250}
                {...register('bio')}
              />
              {errors.bio && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.bio.message}</div>}
            </div>
            {/* Email readonly */}
            <div className="form-group">
              <div className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <Mail size={13} /> Email
                </span>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '4px 8px', fontSize: '12px', height: 'auto', background: 'transparent', border: '1px solid var(--border)' }}
                  onClick={() => setIsUpdateEmailModalOpen(true)}
                >
                  <Edit2 size={12} style={{ marginRight: '4px' }} /> Cập nhật
                </button>
              </div>
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
                  className={`form-input ${errors.name ? 'is-invalid' : ''}`}
                  placeholder="VD: Nguyễn Văn A"
                  {...register('name')}
                />
               
                {errors.name && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.name.message}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-phone">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Phone size={13} /> Số điện thoại
                  </span>
                </label>
                <input
                  id="profile-phone"
                  className={`form-input ${errors.phone ? 'is-invalid' : ''}`}
                  placeholder="VD: 0912345678"
                  {...register('phone')}
                />
               
                {errors.phone && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.phone.message}</div>}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="profile-address" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                  <MapPin size={13} /> Địa chỉ
                </span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: 'normal' }}>
                  {(watch('address') || '').length}/150
                </span>
              </label>
              <input
                id="profile-address"
                className={`form-input ${errors.address ? 'is-invalid' : ''}`}
                placeholder="VD: TP. Hồ Chí Minh"
                maxLength={150}
                {...register('address')}
              />
             
              {errors.address && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.address.message}</div>}
            </div>

            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="profile-dob">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Calendar size={13} /> Ngày sinh
                  </span>
                </label>
                <input
                  id="profile-dob"
                  type="date"
                  className={`form-input ${errors.dateOfBirth ? 'is-invalid' : ''}`}
                  {...register('dateOfBirth')}
                />
                {errors.dateOfBirth && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.dateOfBirth.message}</div>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="profile-gender">
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <Users size={13} /> Giới tính
                  </span>
                </label>
                <select
                  id="profile-gender"
                  className={`form-input ${errors.gender ? 'is-invalid' : ''}`}
                  {...register('gender')}
                  style={{ appearance: 'auto' }}
                >
                  <option value="">Chọn giới tính</option>
                  <option value="MALE">Nam</option>
                  <option value="FEMALE">Nữ</option>
                  <option value="OTHER">Khác</option>
                </select>
                {errors.gender && <div className="error-message" style={{ color: 'var(--error-color)', fontSize: '13px', marginTop: '4px' }}>{errors.gender.message}</div>}
              </div>
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

        <div className="card">
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

        <div className="card">
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
                {UI_MESSAGES.profile.sessionsTitle}
              </div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {UI_MESSAGES.profile.sessionsSubtitle}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSessionsReloadKey((value) => value + 1)}
                disabled={sessionsLoading}
              >
                {sessionsLoading
                  ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang tải...</>
                  : <><RefreshCw size={15} /> Làm mới</>}
              </button>
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
          </div>

          {sessionsLoading && sessions.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', padding: '8px 0' }}>
              <div className="loading-spinner" style={{ width: 14, height: 14 }} />
              <span>{UI_MESSAGES.profile.sessionsLoading}</span>
            </div>
          ) : sessionsError ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '8px 0' }}>
              <div style={{ color: 'var(--error)', fontSize: '14px' }}>{sessionsError || UI_MESSAGES.profile.sessionsLoadFailed}</div>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setSessionsReloadKey((value) => value + 1)}
              >
                Thử lại
              </button>
            </div>
          ) : sessions.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '8px 0' }}>
              {UI_MESSAGES.profile.sessionsEmpty}
            </div>
          ) : (
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              gap: '12px',
              maxHeight: '480px',
              overflowY: 'auto',
              paddingRight: '4px'
            }}>
              {sessions.map((session) => (
                <div
                  key={session.deviceId}
                  style={{
                    position: 'relative',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    padding: '14px 16px',
                    background: session.isCurrent ? 'rgba(99,102,241,0.03)' : 'var(--bg-card)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'nowrap' }}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: 'var(--radius-md)',
                        background: session.isCurrent ? 'rgba(99,102,241,0.12)' : 'rgba(71,85,105,0.08)',
                        color: session.isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexShrink: 0,
                      }}>
                        {session.deviceCategory === 'mobile' ? (
                          <Smartphone size={20} />
                        ) : session.deviceCategory === 'tablet' ? (
                          <TabletSmartphone size={20} />
                        ) : session.deviceCategory === 'desktop' || session.deviceCategory === 'tv' ? (
                          <Monitor size={20} />
                        ) : (
                          <CircleHelp size={20} />
                        )}
                      </div>

                      <div style={{ minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                            {session.deviceLabel}
                          </div>
                          {session.isCurrent && (
                            <span style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#0f766e',
                              background: 'rgba(45,212,191,0.16)',
                              padding: '3px 8px',
                              borderRadius: '999px',
                            }}>
                              Thiết bị hiện tại
                            </span>
                          )}
                        </div>

                        <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          {session.deviceDetail}
                        </div>
                        <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          {session.lastActiveLabel}
                        </div>
                        <div style={{ marginTop: '2px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                          {session.expiresLabel}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      className="btn btn-secondary shrink-0 px-[2px] py-[2px] text-sm sm:self-center sm:px-4 sm:py-2 sm:text-base"
                      onClick={() => handleLogoutSession(session)}
                      disabled={logoutSessionId === session.deviceId}
                      style={{ color: 'var(--error)', alignSelf: 'center' }}
                    >
                      {logoutSessionId === session.deviceId
                        ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
                        : <><Trash2 size={14} /><span className="hidden sm:inline">Xóa thiết bị</span></>}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      </div>

      {confirmAction && (
        <ConfirmModal
          isOpen={!!confirmAction}
          title={confirmAction.title}
          message={confirmAction.message}
          isDanger={confirmAction.isDanger}
          confirmText={confirmAction.confirmText}
          countdown={confirmAction.countdown}
          onConfirm={confirmAction.action}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      <UpdateEmailModal 
        isOpen={isUpdateEmailModalOpen} 
        onClose={() => setIsUpdateEmailModalOpen(false)} 
      />

      {selectedMedia && (
        <MediaLightbox
          medias={[{ _id: 'avatar', url: selectedMedia.url, resourceType: selectedMedia.type, provider: 'cloudinary' } as any]}
          initialIndex={0}
          onClose={() => setSelectedMedia(null)}
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
