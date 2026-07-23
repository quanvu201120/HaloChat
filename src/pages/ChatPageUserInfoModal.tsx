import { AlertTriangle, UserCheck, UserPlus, MessageSquare, MapPin, Calendar, User as UserIcon } from 'lucide-react';
import Modal from '../components/Modal';
import { parseError } from '../services/api';
import { UI_MESSAGES } from '../constants/messages';
import { getUserRestrictionState } from './ChatPage.helpers';

type ProfileUser = {
  _id: string;
  name?: string;
  bio?: string;
  address?: string;
  gender?: string;
  dateOfBirth?: string;
  avatar?: { url?: string };
  isDisabled?: boolean;
  banUntil?: string;
};

type ChatPageUserInfoModalProps = {
  selectedUserForInfo: ProfileUser;
  currentUserId: string;
  userId?: string;
  friends: { _id: string }[];
  sentRequests: { _id: string }[];
  isSendingRequest: boolean;
  sendRequest: (data: { targetUserId: string }) => Promise<unknown>;
  toast: {
    success: (msg: string) => void;
    error: (msg: string) => void;
  };
  onClose: () => void;
  onOpenReport: () => void;
  onStartDirectChat: (userId: string) => void;
};

export default function ChatPageUserInfoModal({
  selectedUserForInfo,
  currentUserId,
  userId,
  friends,
  sentRequests,
  isSendingRequest,
  sendRequest,
  toast,
  onClose,
  onOpenReport,
  onStartDirectChat,
}: ChatPageUserInfoModalProps) {
  return (
    <Modal
      isOpen={!!selectedUserForInfo}
      onClose={onClose}
      title="Thông tin người dùng"
    >
      <div style={{ position: 'relative', width: '100%', minHeight: '400px' }}>
        {/* Report Icon */}
        {userId !== selectedUserForInfo._id && getUserRestrictionState(selectedUserForInfo).kind === null && (
          <button
            onClick={() => onOpenReport()}
            style={{
              position: 'absolute',
              top: '-12px',
              right: '0px',
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              cursor: 'pointer',
              padding: '8px',
              borderRadius: '50%',
              transition: 'all 0.2s',
              zIndex: 50,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
            title="Báo cáo người dùng"
          >
            <AlertTriangle size={22} />
          </button>
        )}

        {/* Add Friend / Sent Request Icon */}
        {userId !== selectedUserForInfo._id && getUserRestrictionState(selectedUserForInfo).kind === null && (() => {
          const isFriend = friends.some(f => f._id === selectedUserForInfo._id);
          const hasSent = sentRequests.some(f => f._id === selectedUserForInfo._id);
          if (isFriend) return null;
          return (
            <button
              onClick={async () => {
                if (hasSent || isSendingRequest) return;
                try {
                  await sendRequest({ targetUserId: selectedUserForInfo._id });
                  toast.success(UI_MESSAGES.chat.sendInvitationSuccess);
                } catch (err: unknown) {
                  toast.error(parseError(err));
                }
              }}
              disabled={hasSent || isSendingRequest}
              style={{
                position: 'absolute',
                top: '-12px',
                left: '0px',
                background: 'transparent',
                border: 'none',
                color: hasSent ? 'var(--text-muted)' : 'var(--accent-primary)',
                cursor: hasSent || isSendingRequest ? 'default' : 'pointer',
                padding: '8px',
                borderRadius: '50%',
                transition: 'all 0.2s',
                zIndex: 50,
                opacity: hasSent ? 0.7 : 1,
              }}
              onMouseEnter={e => { if (!hasSent && !isSendingRequest) e.currentTarget.style.background = 'rgba(99,102,241,0.1)'; }}
              onMouseLeave={e => { e.currentTarget.style.background = 'transparent'; }}
              title={hasSent ? 'Đã gửi lời mời kết bạn' : 'Thêm bạn'}
            >
              {isSendingRequest
                ? <div className="loading-spinner" style={{ width: 18, height: 18 }} />
                : hasSent
                  ? <UserCheck size={22} />
                  : <UserPlus size={22} />}
            </button>
          );
        })()}

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '0 0 24px 0', marginTop: '-12px' }}>
          {/* Avatar */}
        <div
          style={{
            width: '135px', height: '135px', borderRadius: '50%', flexShrink: 0,
            backgroundColor: 'var(--accent-primary)',
            backgroundImage: selectedUserForInfo.avatar?.url ? `url(${selectedUserForInfo.avatar.url})` : 'none',
            backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: '#fff', fontWeight: 600, fontSize: '42px',
            marginBottom: '16px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            position: 'relative'
          }}
        >
          {!selectedUserForInfo.avatar?.url && (selectedUserForInfo.name || 'U').charAt(0).toUpperCase()}
        </div>

        {/* Name */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
          <h3 style={{ fontSize: '24px', fontWeight: 600, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word', textAlign: 'center', maxWidth: '100%', padding: '0 16px' }}>
          {selectedUserForInfo.name || 'Người dùng'}
          </h3>
          {getUserRestrictionState(selectedUserForInfo).badgeLabel && (
            <span
              className={`badge ${getUserRestrictionState(selectedUserForInfo).kind === 'ban' ? 'badge-error' : ''}`}
              style={getUserRestrictionState(selectedUserForInfo).kind === 'disable'
                ? { background: 'rgba(107,114,128,0.10)', color: 'var(--text-muted)', border: '1px solid rgba(107,114,128,0.20)' }
                : undefined}
            >
              {getUserRestrictionState(selectedUserForInfo).badgeLabel}
            </span>
          )}
        </div>

        {/* Bio */}
        <div style={{
          textAlign: 'center', color: 'var(--text-secondary)', fontSize: '15px',
          maxWidth: '85%', marginBottom: '24px',
          wordBreak: 'break-word',
          minHeight: '22px'
        }}>
          {selectedUserForInfo.bio || 'Chưa có tiểu sử.'}
        </div>

        {selectedUserForInfo._id !== currentUserId && getUserRestrictionState(selectedUserForInfo).kind === null && (
          <div style={{ width: '100%', padding: '0 16px', marginBottom: '24px', display: 'flex', gap: '12px' }}>
            <button
              type="button"
              className="btn btn-primary"
              style={{ flex: 1, padding: '10px 0', borderRadius: '10px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', fontWeight: 600 }}
              onClick={() => onStartDirectChat(selectedUserForInfo._id)}
            >
              <MessageSquare size={18} />
              Nhắn tin
            </button>
          </div>
        )}

        {/* Personal Info */}
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '16px', padding: '0 16px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', color: 'var(--text-primary)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', flexShrink: 0, backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              <MapPin size={18} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Địa chỉ</div>
              <div style={{ fontSize: '15px', fontWeight: 500 }}>
                {selectedUserForInfo.address || 'Chưa cập nhật'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              <UserIcon size={18} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Giới tính</div>
              <div style={{ fontSize: '15px', fontWeight: 500 }}>
                {selectedUserForInfo.gender === 'MALE' ? 'Nam' : selectedUserForInfo.gender === 'FEMALE' ? 'Nữ' : selectedUserForInfo.gender === 'OTHER' ? 'Khác' : 'Chưa cập nhật'}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-primary)' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#6b7280' }}>
              <Calendar size={18} />
            </div>
            <div>
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>Ngày sinh</div>
              <div style={{ fontSize: '15px', fontWeight: 500 }}>
                {selectedUserForInfo.dateOfBirth ? new Date(selectedUserForInfo.dateOfBirth).toLocaleDateString('vi-VN') : 'Chưa cập nhật'}
              </div>
            </div>
          </div>
        </div>
        </div>
      </div>
    </Modal>
  );
}
