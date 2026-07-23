import React from 'react';
import { Camera, Trash2, Edit2 } from 'lucide-react';
import type { User } from '../store/authStore';
import { UserRole } from '../constants/roles';

type InfoItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
};

type ProfileAvatarCardProps = {
  user: User | null;
  isUploading: boolean;
  isAvatarMenuOpen: boolean;
  setIsAvatarMenuOpen: React.Dispatch<React.SetStateAction<boolean>>;
  menuRef: React.RefObject<HTMLDivElement | null>;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  handleUploadAvatar: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleDeleteAvatar: () => void;
  getInitials: () => string;
  setSelectedMedia: React.Dispatch<React.SetStateAction<{ url: string; type: 'image' | 'video' } | null>>;
  infoItems: InfoItem[];
};

export default function ProfileAvatarCard({
  user,
  isUploading,
  isAvatarMenuOpen,
  setIsAvatarMenuOpen,
  menuRef,
  fileInputRef,
  handleUploadAvatar,
  handleDeleteAvatar,
  getInitials,
  setSelectedMedia,
  infoItems,
}: ProfileAvatarCardProps) {
  return (
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
  );
}
