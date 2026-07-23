import Modal from '../components/Modal';
import type { Conversation } from '../services/conversations';
import type { OnlineMap } from '../store/chatStore';
import type { User } from '../store/authStore';

type ChatPageOnlineStatusModalProps = {
  conv: Conversation;
  online: OnlineMap;
  user: User | null;
  onClose: () => void;
};

export default function ChatPageOnlineStatusModal({
  conv,
  online,
  user,
  onClose,
}: ChatPageOnlineStatusModalProps) {
  return (
    <Modal
      isOpen={true}
      onClose={onClose}
      title="Trạng thái hoạt động"
    >
      <div style={{ padding: '10px 0' }}>
        <div style={{ padding: '0 20px 8px', fontSize: '13px', fontWeight: 600, color: 'var(--success)', textTransform: 'uppercase' }}>
          Đang hoạt động
        </div>
        {conv.users.filter(u => online[u._id] === true || u._id === user?._id).map(u => (
          <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px', minWidth: 0 }}>
          <div style={{ position: 'relative', width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
              {u.avatar && typeof u.avatar === 'object' && u.avatar.url ? (
                <img src={u.avatar.url} alt={u.name || 'Người dùng'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                (u.name || '?').slice(0, 1).toUpperCase()
              )}
              <span className="online-dot" style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, border: '2px solid var(--bg-card)' }} />
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Người dùng'} {u._id === user?._id && '(Bạn)'}</div>
            </div>
          </div>
        ))}

        <div style={{ padding: '16px 20px 8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
          Ngoại tuyến
        </div>
        {conv.users.filter(u => online[u._id] !== true && u._id !== user?._id).map(u => (
          <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px', opacity: 0.7, minWidth: 0 }}>
            <div style={{ width: 36, height: 36, flexShrink: 0, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
              {u.avatar && typeof u.avatar === 'object' && u.avatar.url ? (
                <img src={u.avatar.url} alt={u.name || 'Người dùng'} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
              ) : (
                (u.name || '?').slice(0, 1).toUpperCase()
              )}
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.name || 'Người dùng'}</div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
