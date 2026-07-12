import Modal from './Modal';
import type { Conversation } from '../services/conversations';

interface MessageReadersModalProps {
  isOpen: boolean;
  onClose: () => void;
  conversation: Conversation;
  readers: string[]; // List of userIds who read the message
  currentUserId: string;
}

export default function MessageReadersModal({
  isOpen,
  onClose,
  conversation,
  readers,
  currentUserId,
}: MessageReadersModalProps) {
  if (!isOpen) return null;

  // users in the group excluding the current user
  const otherMembers = conversation.users.filter((u) => u._id !== currentUserId);

  const readMembers = otherMembers.filter((u) => readers.includes(u._id));
  const unreadMembers = otherMembers.filter((u) => !readers.includes(u._id));

  const renderUser = (user: { _id: string; name?: string; email?: string; avatar?: any }) => {
    const avatar = typeof user.avatar === 'object' && user.avatar?.url
      ? user.avatar.url
      : typeof user.avatar === 'string' ? user.avatar : null;
    const displayName = user.name || 'Người dùng';

    return (
      <div key={user._id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '50%', backgroundColor: '#eee', flexShrink: 0,
          backgroundImage: avatar ? `url(${avatar})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center',
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 'bold',
          color: '#666', border: '1px solid #ddd'
        }}>
          {!avatar && displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ flex: 1, fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {displayName}
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Chi tiết người xem">
      <div style={{ padding: '16px 0', maxHeight: '400px', overflowY: 'auto' }}>
        <div style={{ marginBottom: '24px' }}>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
            Đã xem ({readMembers.length})
          </h3>
          {readMembers.length > 0 ? (
            readMembers.map(renderUser)
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Chưa có ai xem.</div>
          )}
        </div>

        <div>
          <h3 style={{ fontSize: '13px', textTransform: 'uppercase', color: 'var(--text-secondary)', marginBottom: '8px', fontWeight: 600 }}>
            Chưa xem ({unreadMembers.length})
          </h3>
          {unreadMembers.length > 0 ? (
            unreadMembers.map(renderUser)
          ) : (
            <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Tất cả đã xem.</div>
          )}
        </div>
      </div>
    </Modal>
  );
}
