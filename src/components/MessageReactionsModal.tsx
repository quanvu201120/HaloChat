import Modal from './Modal';
import type { Conversation } from '../services/conversations';
import type { Message } from '../services/messages';
import { REACTIONS } from './MessageBubble';

interface MessageReactionsModalProps {
  isOpen: boolean;
  onClose: () => void;
  message: Message;
  conversation: Conversation;
}

export default function MessageReactionsModal({
  isOpen,
  onClose,
  message,
  conversation,
}: MessageReactionsModalProps) {
  if (!isOpen) return null;

  const reactions = message.reactions ?? [];

  const renderUserReaction = (reaction: { userId: string; type: string }) => {
    const user = conversation.users.find((u) => u._id === reaction.userId);
    const displayName = user?.name || user?.email || 'Người dùng';
    const avatar = typeof user?.avatar === 'object' && user.avatar?.url
      ? user.avatar.url
      : typeof user?.avatar === 'string' ? user.avatar : null;
    
    const reactionConfig = REACTIONS.find((r) => r.type === reaction.type);

    return (
      <div key={`${reaction.userId}-${reaction.type}`} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0' }}>
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#eee', flexShrink: 0,
            backgroundImage: avatar ? `url(${avatar})` : 'none', backgroundSize: 'cover', backgroundPosition: 'center',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', fontWeight: 'bold',
            color: '#666', border: '1px solid #ddd'
          }}>
            {!avatar && displayName.charAt(0).toUpperCase()}
          </div>
          <div style={{
            position: 'absolute', bottom: '-4px', right: '-4px',
            background: '#fff', borderRadius: '50%', padding: '2px',
            fontSize: '14px', lineHeight: 1, boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}>
            {reactionConfig?.icon}
          </div>
        </div>
        <div style={{ flex: 1, fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)' }}>
          {displayName}
        </div>
      </div>
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Cảm xúc (${reactions.length})`}>
      <div style={{ padding: '8px 0 16px', maxHeight: '400px', overflowY: 'auto' }}>
        {reactions.length > 0 ? (
          reactions.map(renderUserReaction)
        ) : (
          <div style={{ fontSize: '14px', color: 'var(--text-muted)', textAlign: 'center', padding: '20px 0' }}>
            Chưa có cảm xúc nào.
          </div>
        )}
      </div>
    </Modal>
  );
}
