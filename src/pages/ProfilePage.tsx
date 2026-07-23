import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useAuthStore as useAuth } from '../store/authStore';
import { authApi, usersApi, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';
import { Shield, Activity, AlertTriangle, ChevronLeft } from 'lucide-react';
import ConfirmModal from '../components/ConfirmModal';
import CreatePasswordModal from '../components/CreatePasswordModal';
import UpdateEmailModal from '../components/UpdateEmailModal';
import MediaLightbox from '../components/MediaLightbox';
import { UI_MESSAGES } from '../constants/messages';
import {
  CREATE_PASSWORD_PROMPT_CLOSED_EVENT,
  profileSchema,
  mapSessionItem,
  decodeJwtPayload,
  type ProfileFormValues,
  type ProfileSession,
} from './ProfilePage.helpers';
import ProfilePageSkeleton from './ProfilePageSkeleton';
import ProfileAvatarCard from './ProfileAvatarCard';
import ProfileEditForm from './ProfileEditForm';
import ProfileSessionsCard from './ProfileSessionsCard';

export function ProfilePageContent() {
  const navigate = useNavigate();
  const { user, accessToken, logoutAll, updateUser, localLogout } = useAuth();
  const toast = useToast();

  const {
    register,
    handleSubmit,
    watch,
    setValue,
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
  const [isCreatePasswordModalOpen, setIsCreatePasswordModalOpen] = useState(false);
  const [selectedMedia, setSelectedMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [isAvatarMenuOpen, setIsAvatarMenuOpen] = useState(false);
  const menuRef = React.useRef<HTMLDivElement>(null);
  const [isGenderSelectOpen, setIsGenderSelectOpen] = useState(false);
  const genderSelectRef = React.useRef<HTMLDivElement>(null);
  const currentSessionId = decodeJwtPayload(accessToken)?.sessionId || null;
  const shouldCreatePassword = user?.accountType === 'GOOGLE' && user?.hasPassword === false;

  React.useEffect(() => {
    if (shouldCreatePassword && sessionStorage.getItem('halochat_create_password_prompt') === '1') {
      setIsCreatePasswordModalOpen(true);
      sessionStorage.removeItem('halochat_create_password_prompt');
    }
  }, [shouldCreatePassword]);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsAvatarMenuOpen(false);
      }
      if (genderSelectRef.current && !genderSelectRef.current.contains(event.target as Node)) {
        setIsGenderSelectOpen(false);
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

  const handleCreatePasswordModalClose = () => {
    setIsCreatePasswordModalOpen(false);
    window.dispatchEvent(new Event(CREATE_PASSWORD_PROMPT_CLOSED_EVENT));
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
    return <ProfilePageSkeleton onBack={() => navigate('/')} />;
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
        <ProfileAvatarCard
          user={user}
          isUploading={isUploading}
          isAvatarMenuOpen={isAvatarMenuOpen}
          setIsAvatarMenuOpen={setIsAvatarMenuOpen}
          menuRef={menuRef}
          fileInputRef={fileInputRef}
          handleUploadAvatar={handleUploadAvatar}
          handleDeleteAvatar={handleDeleteAvatar}
          getInitials={getInitials}
          setSelectedMedia={setSelectedMedia}
          infoItems={infoItems}
        />

        {/* Change password card moved here */}
        <div className="card">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>Bảo mật tài khoản</div>
              <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                {shouldCreatePassword
                  ? 'Tài khoản Google của bạn chưa có mật khẩu. Hãy tạo mật khẩu để đăng nhập theo cách khác.'
                  : 'Thay đổi mật khẩu định kỳ để bảo vệ tài khoản của bạn.'}
              </div>
            </div>
            <button
              id="btn-go-change-password"
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                if (shouldCreatePassword) {
                  setIsCreatePasswordModalOpen(true);
                  return;
                }
                navigate('/change-password');
              }}
              style={{ padding: '8px 16px' }}
            >
              <Shield size={15} style={{ marginRight: '6px' }} />
              {shouldCreatePassword ? 'Tạo mật khẩu' : 'Đổi mật khẩu'}
            </button>
          </div>
        </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* Right: editable form */}
        <ProfileEditForm
          register={register}
          handleSubmit={handleSubmit}
          watch={watch}
          setValue={setValue}
          errors={errors}
          onSubmit={onSubmit}
          isLoading={isLoading}
          setIsUpdateEmailModalOpen={setIsUpdateEmailModalOpen}
          isGenderSelectOpen={isGenderSelectOpen}
          setIsGenderSelectOpen={setIsGenderSelectOpen}
          genderSelectRef={genderSelectRef}
          userEmail={user?.email || ''}
        />

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

        <ProfileSessionsCard
          sessions={sessions}
          sessionsLoading={sessionsLoading}
          sessionsError={sessionsError}
          setSessionsReloadKey={setSessionsReloadKey}
          logoutAllLoading={logoutAllLoading}
          handleLogoutAll={handleLogoutAll}
          logoutSessionId={logoutSessionId}
          handleLogoutSession={handleLogoutSession}
        />
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

      <CreatePasswordModal
        isOpen={isCreatePasswordModalOpen}
        onClose={handleCreatePasswordModalClose}
        onSuccess={() => updateUser({ hasPassword: true })}
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
