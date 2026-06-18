import { useMemo, useState } from 'react';
import {
  CornerUpLeft, MoreHorizontal, Pencil, Trash2, Heart, Download,
} from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import type { Message, MessageReaction } from '../services/messages';
import { api, parseError } from '../services/api';
import { useToast } from '../context/ToastContext';

interface Props {
  message: Message;
  isMe: boolean;
  prevMessage?: Message;
  currentUserId: string;
  isGroup?: boolean;
  senderAvatarUrl?: string | null;
  readStatusLabel?: string;
  forceShowStatus?: boolean;
  onReadStatusClick?: () => void;
  onReactionsClick?: () => void;
  onReply?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  onToggleReaction?: (type: string) => void;
}

export const REACTIONS = [
  { type: 'like', icon: '👍', label: 'Thích' },
  { type: 'love', icon: '❤️', label: 'Yêu thích' },
  { type: 'haha', icon: '😂', label: 'Haha' },
  { type: 'wow', icon: '😮', label: 'Wow' },
  { type: 'sad', icon: '😢', label: 'Buồn' },
  { type: 'angry', icon: '😡', label: 'Giận' },
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
      content: 'Tin nhắn đã thu hồi',
    };
  }

  return {
    senderName: getSenderName(replyTo),
    content: replyTo.isDeleted ? 'Tin nhắn đã thu hồi' : (replyTo.content || 'Tin nhắn đính kèm'),
  };
}

function isDownloadableMessage(message: Message) {
  if (message.isDeleted || typeof message.media !== 'object' || !message.media?.url) {
    return false;
  }

  return message.type === 'image' || message.type === 'video' || message.type === 'file';
}

export default function MessageBubble({
  message,
  isMe,
  prevMessage,
  currentUserId,
  isGroup,
  senderAvatarUrl,
  readStatusLabel,
  forceShowStatus,
  onReadStatusClick,
  onReactionsClick,
  onReply,
  onEdit,
  onDelete,
  onToggleReaction,
}: Props) {
  const [showActions, setShowActions] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const toast = useToast();

  const isOptimistic = message._id.startsWith('opt_');
  const isError = Boolean((message as Message & { _error?: boolean })._error);
  const showSenderName = !isMe && isGroup && !isSameSender(message, prevMessage);
  const showAvatar = !isMe && !isSameSender(message, prevMessage);
  const senderName = getSenderName(message);
  const replyPreview = getReplyPreview(message.replyTo);
  const reactions = message.reactions ?? [];
  const reactionSummary = useMemo(() => getReactionSummary(reactions), [reactions]);
  const myReaction = reactions.find((reaction) => reaction.userId === currentUserId)?.type;
  const canEdit = isMe && message.type === 'text' && !message.isDeleted;
  const canDelete = isMe && !message.isDeleted;
  const canDownload = isDownloadableMessage(message);
  const downloadFileName = typeof message.media === 'object' && message.media?.fileName
    ? message.media.fileName
    : message.type === 'image'
      ? 'image'
      : message.type === 'video'
        ? 'video'
        : 'tệp-đính-kèm';
  const statusLabel = isError ? 'Lỗi' : isOptimistic ? 'Đang gửi' : readStatusLabel;
  const isMediaOnly = !message.isDeleted
    && !message.replyTo
    && !message.content?.trim()
    && (message.type === 'image' || message.type === 'video');

  const handleDownload = async (event: React.MouseEvent<HTMLButtonElement>) => {
    event.stopPropagation();
    if (isDownloading || typeof message.media !== 'object' || !message.media?.url) return;

    try {
      setIsDownloading(true);
      const isR2Media = Boolean(message.media.objectKey && message.media._id);
      let blob: Blob;

      if (isR2Media) {
        const response = await api.get(`/media/${message.media._id}/download`, {
          responseType: 'blob',
        });
        blob = response.data instanceof Blob
          ? response.data
          : new Blob([response.data], {
            type: message.media.mimeType || 'application/octet-stream',
          });
      } else {
        const response = await fetch(message.media.url, {
          method: 'GET',
          mode: 'cors',
          credentials: 'omit',
        });

        if (!response.ok) {
          throw new Error(`Download failed with status ${response.status}`);
        }

        blob = await response.blob();
      }

      const objectUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = downloadFileName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(objectUrl);
    } catch (error: any) {
      toast.error(parseError(error) || 'Không tải được tệp');
    } finally {
      setIsDownloading(false);
    }
  };

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
        <div className="msg-sender-name" style={{ marginLeft: '40px' }}>{senderName}</div>
      )}

      <div style={{ display: 'flex', flexDirection: 'row', alignItems: 'flex-start', gap: '8px', width: '100%', paddingLeft: isMe ? 0 : showAvatar ? 0 : '40px' }}>
        {!isMe && showAvatar && (
          <div className="msg-avatar-container" style={{ width: '32px', height: '32px', flexShrink: 0, borderRadius: '50%', backgroundColor: '#eee', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 'bold', color: '#666', border: '1px solid #ddd', marginTop: showSenderName ? '20px' : '0' }}>
            {senderAvatarUrl ? <img src={senderAvatarUrl} alt={senderName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : senderName.slice(0, 2).toUpperCase()}
          </div>
        )}
        <div className={`msg-content-wrapper${isMe ? ' me' : ' other'}${!message.isDeleted && reactions.length > 0 ? ' has-reactions' : ''}`} style={{ flex: 1, maxWidth: isMe ? '100%' : 'calc(100% - 40px)' }}>
          <div
            className={`msg-bubble${isMe ? ' me' : ' other'}${message.isDeleted ? ' deleted' : ''}${isOptimistic ? ' sending' : ''}${isError ? ' error' : ''}${isMediaOnly ? ' media-only' : ''}`}
          onClick={() => isMe && setShowStatus((prev) => !prev)}
        >
          {showActions && !message.isDeleted && (
            <div className={`msg-actions${isMe ? ' me' : ' other'}`} onClick={(e) => e.stopPropagation()}>
              <div
                className="action-btn"
                title="Cảm xúc"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onMouseEnter={() => setShowReactionPicker(true)}
                onMouseLeave={() => setShowReactionPicker(false)}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionPicker((prev) => !prev);
                }}
              >
                <Heart size={14} style={{ fill: myReaction ? 'var(--error)' : 'transparent', color: myReaction ? 'var(--error)' : 'inherit' }} />
                {showReactionPicker && (
                  <div className={`msg-reaction-picker${isMe ? ' me' : ' other'}`} onClick={(e) => e.stopPropagation()}>
                    {REACTIONS.map((reaction) => (
                      <button
                        key={reaction.type}
                        type="button"
                        className={`msg-reaction-option${myReaction === reaction.type ? ' active' : ''}`}
                        title={reaction.label}
                        onClick={(e) => {
                          e.stopPropagation();
                          onToggleReaction?.(reaction.type);
                          setShowReactionPicker(false);
                        }}
                      >
                        {reaction.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="action-btn" title="Trả lời" onClick={onReply}>
                <CornerUpLeft size={14} />
              </button>
              {canDownload && typeof message.media === 'object' && message.media?.url && (
                <button
                  className="action-btn"
                  type="button"
                  title={isDownloading ? 'Đang tải' : 'Tải xuống'}
                  onClick={handleDownload}
                  disabled={isDownloading}
                >
                  <Download size={14} />
                </button>
              )}
              {canEdit && (
                <button className="action-btn" title="Sửa" onClick={onEdit}>
                  <Pencil size={14} />
                </button>
              )}
              {canDelete && (
                <button className="action-btn" title="Thu hồi" onClick={onDelete}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}

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
              Tin nhắn đã thu hồi
            </span>
          ) : message.type === 'text' ? (
            <span className="msg-text">{message.content}</span>
          ) : message.type === 'image' && typeof message.media === 'object' && message.media?.url ? (
            <img
              src={message.media.url}
              alt={message.media.fileName || 'Ảnh'}
              className="msg-image"
              loading="lazy"
            />
          ) : message.type === 'video' && typeof message.media === 'object' && message.media?.url ? (
            <video className="msg-video" controls preload="metadata">
              <source src={message.media.url} type={message.media.mimeType || 'video/mp4'} />
            </video>
          ) : message.type === 'voice' && typeof message.media === 'object' && message.media?.url ? (
            <AudioPlayer src={message.media.url} isMe={isMe} />
          ) : typeof message.media === 'object' && message.media?.url ? (
            <div className="msg-file-block" onClick={(event) => event.stopPropagation()}>
              <a
                className="msg-file"
                href={message.media.url}
                target="_blank"
                rel="noreferrer"
              >
                <span>[File]</span>
                <span>{message.media.fileName || 'Tệp đính kèm'}</span>
              </a>
            </div>
          ) : (
            <span className="msg-text">{message.content || 'Tin nhắn đính kèm'}</span>
          )}

          <div className="msg-meta">
            <span className="msg-time">{formatTime(message.createdAt)}</span>
          </div>
        </div>

        {!message.isDeleted && reactions.length > 0 && (
          <div className={`msg-reactions${isMe ? ' me' : ' other'}`}>
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
                    if (onReactionsClick) {
                      onReactionsClick();
                    } else {
                      onToggleReaction?.(type);
                    }
                  }}
                >
                  {reaction.icon}
                  <span>{count}</span>
                </button>
              );
            })}
          </div>
        )}

        {isMe && (showStatus || forceShowStatus) && statusLabel && (
          <div
            className={`msg-status-detail-bottom${isError ? ' error' : ''}`}
            onClick={onReadStatusClick}
            style={{ cursor: onReadStatusClick ? 'pointer' : 'default' }}
          >
            {statusLabel}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
