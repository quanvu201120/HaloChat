import { useMemo, useState } from 'react';
import {
  CornerUpLeft, MoreHorizontal, Pencil, Trash2, Heart, Laugh, Frown, Angry, Sparkles,
} from 'lucide-react';
import type { Message, MessageReaction } from '../services/messages';

interface Props {
  message: Message;
  isMe: boolean;
  prevMessage?: Message;
  currentUserId: string;
  readStatusLabel?: string;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleReaction?: (type: string) => void;
}

const REACTIONS = [
  { type: 'like', icon: <Heart size={12} />, label: 'Thich' },
  { type: 'love', icon: <Heart size={12} fill="currentColor" />, label: 'Yeu thich' },
  { type: 'haha', icon: <Laugh size={12} />, label: 'Haha' },
  { type: 'wow', icon: <Sparkles size={12} />, label: 'Wow' },
  { type: 'sad', icon: <Frown size={12} />, label: 'Buon' },
  { type: 'angry', icon: <Angry size={12} />, label: 'Gian' },
];

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getSenderId(message: Message): string {
  return typeof message.sender === 'string' ? message.sender : message.sender?._id || '';
}

function getSenderName(message: Message): string {
  if (typeof message.sender === 'string') return '';
  return message.sender?.name || message.sender?.email || '';
}

function isSameSender(a: Message, b?: Message): boolean {
  if (!b) return false;
  return getSenderId(a) === getSenderId(b);
}

function getReactionSummary(reactions: MessageReaction[]) {
  return reactions.reduce<Record<string, number>>((acc, reaction) => {
    acc[reaction.type] = (acc[reaction.type] || 0) + 1;
    return acc;
  }, {});
}

function getReplyPreview(replyTo?: string | Message) {
  if (!replyTo || typeof replyTo === 'string') {
    return {
      senderName: '',
      content: 'Tin nhan da thu hoi',
    };
  }

  return {
    senderName: getSenderName(replyTo),
    content: replyTo.isDeleted ? 'Tin nhan da thu hoi' : (replyTo.content || 'Tin nhan dinh kem'),
  };
}

export default function MessageBubble({
  message,
  isMe,
  prevMessage,
  currentUserId,
  readStatusLabel,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
}: Props) {
  const [showActions, setShowActions] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);

  const isOptimistic = message._id.startsWith('opt_');
  const isError = Boolean((message as Message & { _error?: boolean })._error);
  const showSenderName = !isMe && !isSameSender(message, prevMessage);
  const senderName = getSenderName(message);
  const replyPreview = getReplyPreview(message.replyTo);
  const reactions = message.reactions ?? [];
  const reactionSummary = useMemo(() => getReactionSummary(reactions), [reactions]);
  const myReaction = reactions.find((reaction) => reaction.userId === currentUserId)?.type;
  const canEdit = isMe && message.type === 'text' && !message.isDeleted;
  const canDelete = isMe && !message.isDeleted;
  const statusLabel = isError ? 'Loi' : isOptimistic ? 'Dang gui' : readStatusLabel || 'Da gui';

  if (message.type === 'system') {
    return (
      <div className="msg-system">
        <span>{message.content}</span>
      </div>
    );
  }

  return (
    <div
      className={`msg-row${isMe ? ' me' : ' other'}`}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
    >
      {showSenderName && senderName && (
        <div className="msg-sender-name">{senderName}</div>
      )}

      {showActions && !message.isDeleted && (
        <div className={`msg-actions${isMe ? ' me' : ' other'}`}>
          <button className="icon-btn" title="Tra loi" onClick={onReply}>
            <CornerUpLeft size={14} />
          </button>
          <button
            className={`icon-btn${myReaction ? ' active' : ''}`}
            title="Tha cam xuc"
            onClick={() => setShowReactionPicker((prev) => !prev)}
          >
            <Heart size={14} />
          </button>
          {canEdit && (
            <button className="icon-btn" title="Sua" onClick={onEdit}>
              <Pencil size={14} />
            </button>
          )}
          {canDelete && (
            <button className="icon-btn" title="Thu hoi" onClick={onDelete}>
              <Trash2 size={14} />
            </button>
          )}
          <button className="icon-btn" title="Tuy chon">
            <MoreHorizontal size={14} />
          </button>
        </div>
      )}

      {showReactionPicker && (
        <div className={`msg-reaction-picker${isMe ? ' me' : ' other'}`}>
          {REACTIONS.map((reaction) => (
            <button
              key={reaction.type}
              type="button"
              className={`msg-reaction-option${myReaction === reaction.type ? ' active' : ''}`}
              title={reaction.label}
              onClick={() => {
                onToggleReaction?.(reaction.type);
                setShowReactionPicker(false);
              }}
            >
              {reaction.icon}
            </button>
          ))}
        </div>
      )}

      <div
        className={`msg-bubble${isMe ? ' me' : ' other'}${message.isDeleted ? ' deleted' : ''}${isOptimistic ? ' sending' : ''}${isError ? ' error' : ''}`}
        onClick={() => setShowStatus((prev) => !prev)}
      >
        {message.replyTo && (
          <div className="msg-reply-ref">
            {replyPreview.senderName && (
              <div className="msg-reply-ref-name">{replyPreview.senderName}</div>
            )}
            <div className="msg-reply-ref-content">{replyPreview.content}</div>
          </div>
        )}

        {message.isDeleted ? (
          <span className="msg-deleted">
            <Trash2 size={12} style={{ display: 'inline', marginRight: 4 }} />
            Tin nhan da thu hoi
          </span>
        ) : message.type === 'text' ? (
          <span className="msg-text">{message.content}</span>
        ) : message.type === 'image' && typeof message.media === 'object' && message.media?.url ? (
          <img
            src={message.media.url}
            alt={message.media.fileName || 'Anh'}
            className="msg-image"
            loading="lazy"
          />
        ) : message.type === 'video' && typeof message.media === 'object' && message.media?.url ? (
          <video className="msg-video" controls preload="metadata">
            <source src={message.media.url} type={message.media.mimeType || 'video/mp4'} />
          </video>
        ) : message.type === 'voice' && typeof message.media === 'object' && message.media?.url ? (
          <audio className="msg-audio" controls preload="metadata">
            <source src={message.media.url} type={message.media.mimeType || 'audio/webm'} />
          </audio>
        ) : typeof message.media === 'object' && message.media?.url ? (
          <a
            className="msg-file"
            href={message.media.url}
            target="_blank"
            rel="noreferrer"
            onClick={(event) => event.stopPropagation()}
          >
            <span>[File]</span>
            <span>{message.media.fileName || 'Tep dinh kem'}</span>
          </a>
        ) : (
          <span className="msg-text">{message.content || 'Tin nhan dinh kem'}</span>
        )}

        {reactions.length > 0 && (
          <div className="msg-reactions">
            {Object.entries(reactionSummary).map(([type, count]) => {
              const reaction = REACTIONS.find((item) => item.type === type);
              if (!reaction) return null;

              return (
                <button
                  key={type}
                  type="button"
                  className={`msg-reaction-chip${myReaction === type ? ' mine' : ''}`}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleReaction?.(type);
                  }}
                >
                  {reaction.icon}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        <div className="msg-meta">
          <span className="msg-time">{formatTime(message.createdAt)}</span>
          {isMe && (
            <span className="msg-status-icon">{statusLabel}</span>
          )}
        </div>

        {showStatus && (
          <div className={`msg-status-detail${isError ? ' error' : ''}`}>
            {statusLabel}
          </div>
        )}
      </div>
    </div>
  );
}
