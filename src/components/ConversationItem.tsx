import { memo } from 'react';
import { Link } from 'react-router-dom';
import { UserX } from 'lucide-react';
import type { Conversation } from '../services/conversations';
import { useChatStore } from '../store/chatStore';

function getConversationName(conv: Conversation, currentUserId: string): string {
  if (conv.isGroup) return conv.name || 'Nhóm chưa đặt tên';
  const other = conv.users.find((u) => u._id !== currentUserId);
  return other?.name || other?.email || 'Người dùng';
}

function getConversationAvatar(conv: Conversation, currentUserId: string): string | null {
  if (!conv.isGroup) {
    const other = conv.users.find((u) => u._id !== currentUserId);
    return other?.avatar?.url ?? null;
  }
  return conv.avatar?.url ?? null;
}

function getInitials(name: string): string {
  const parts = name.trim().split(' ');
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

function getIsTargetUserDisabled(conv: Conversation, currentUserId: string): boolean {
  if (conv.isGroup) return false;
  const other = conv.users.find((u) => u._id !== currentUserId);
  return !!(other as any)?.isDisabled;
}

function getLastMessagePreview(conv: Conversation, currentUserId: string): string {
  const msg = conv.lastMessage;
  if (!msg) return 'Bắt đầu cuộc trò chuyện...';
  if (msg.isDeleted) return 'Tin nhắn đã thu hồi';
  const senderId = typeof msg.sender === 'string' ? msg.sender : msg.sender?._id;
  const isMe = senderId === currentUserId;
  const prefix = isMe ? 'Bạn: ' : '';
  if (msg.type === 'text') return `${prefix}${msg.content || ''}`;
  if (msg.type === 'image') return `${prefix}[Hình ảnh]`;
  if (msg.type === 'video') return `${prefix}[Video]`;
  if (msg.type === 'file') return `${prefix}[File]`;
  if (msg.type === 'voice') return `${prefix}[Tin nhắn thoại]`;
  if (msg.type === 'system') return msg.content || '';
  return '';
}

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (mins < 1) return 'vừa xong';
  if (mins < 60) return `${mins}p`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  return date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
}

interface Props {
  conv: Conversation;
  currentUserId: string;
  hasUnread: boolean;
  isActive: boolean;
  isOnline: boolean;
}

function ConversationItem({
  conv,
  currentUserId,
  hasUnread,
  isActive,
  isOnline,
}: Props) {
  const name = getConversationName(conv, currentUserId);
  const avatarUrl = getConversationAvatar(conv, currentUserId);
  const initials = getInitials(name);
  const isTargetUserDisabled = getIsTargetUserDisabled(conv, currentUserId);
  const preview = getLastMessagePreview(conv, currentUserId);
  const timeStr = conv.lastMessage?.createdAt
    ? formatTime(conv.lastMessage.createdAt)
    : '';

  const { setMessageRequestContext } = useChatStore();
  const isMessageRequest = !conv.acceptedBy?.includes(currentUserId);

  return (
    <Link
      className={`conv-item${isActive ? ' active' : ''}${hasUnread ? ' unread' : ''}`}
      to={`/chat/${conv._id}`}
      onClick={() => setMessageRequestContext(isMessageRequest)}
    >
      {/* Avatar */}
      <div className="conv-avatar-wrap">
        {isTargetUserDisabled ? (
          <div className="conv-avatar" style={{ background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <UserX size={20} style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : avatarUrl ? (
          <img src={avatarUrl} alt={name} className="conv-avatar-img" />
        ) : (
          <div className="conv-avatar">{initials}</div>
        )}
        {isOnline && !isTargetUserDisabled && <span className="online-dot" />}
      </div>

      {/* Info */}
      <div className="conv-info">
        <div className="conv-name-row">
          <span className="conv-name">{name}</span>
          {timeStr && <span className="conv-time">{timeStr}</span>}
        </div>
        <div className="conv-preview-row">
          <span className="conv-preview">{preview}</span>
          {hasUnread && <span className="unread-dot" />}
        </div>
      </div>
    </Link>
  );
}

export default memo(ConversationItem);
