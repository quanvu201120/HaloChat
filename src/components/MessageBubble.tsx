import { useMemo, useState, useEffect, useRef } from 'react';
import {
  CornerUpLeft, Pencil, Trash2, Heart, Download,
} from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import type { Message, MessageReaction } from '../services/messages';
import { api } from '../services/api';
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
  onMediaClick?: (media: any) => void;
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

  return message.type === 'file';
}

function isEmojiOnly(text?: string): boolean {
  if (!text) return false;
  const trimmed = text.replace(/[\s\n]+/g, '');
  if (!trimmed || trimmed.length > 20) return false;
  return /^[\p{Extended_Pictographic}\uFE0F\u200D]+$/u.test(trimmed);
}

function getEmojiOnlySizeClass(text: string): string {
  const trimmed = text.replace(/[\s\n]+/g, '');
  try {
    const segmenter = new Intl.Segmenter('en', { granularity: 'grapheme' });
    const count = Array.from(segmenter.segment(trimmed)).length;
    if (count === 1) return 'emoji-huge';
    if (count === 2) return 'emoji-large';
    if (count === 3) return 'emoji-medium';
    return 'emoji-normal';
  } catch (e) {
    return 'emoji-large'; // fallback
  }
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
  onMediaClick,
}: Props) {
  const [showActions, setShowActions] = useState(false);
  const [showStatus, setShowStatus] = useState(false);
  const [showReactionPicker, setShowReactionPicker] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const actionsRef = useRef<HTMLDivElement>(null);
  const reactionsRef = useRef<HTMLDivElement>(null);
  const toast = useToast();

  // Dynamic positioning for mobile edge cases
  useEffect(() => {
    if (showActions && actionsRef.current && window.innerWidth <= 768) {
      actionsRef.current.style.left = '';
      actionsRef.current.style.right = '';
      
      const rect = actionsRef.current.getBoundingClientRect();
      const padding = 8;
      
      if (isMe) {
        if (rect.left < padding) {
          actionsRef.current.style.right = 'auto';
          actionsRef.current.style.left = '4px';
        }
      } else {
        if (rect.right > window.innerWidth - padding) {
          actionsRef.current.style.left = 'auto';
          actionsRef.current.style.right = '4px';
        }
      }
    }
  }, [showActions, isMe]);

  useEffect(() => {
    if (showReactionPicker && reactionsRef.current && window.innerWidth <= 768) {
      reactionsRef.current.style.left = '';
      reactionsRef.current.style.right = '';
      reactionsRef.current.style.transform = '';

      const rect = reactionsRef.current.getBoundingClientRect();
      const padding = 8;

      if (rect.left < padding) {
        reactionsRef.current.style.right = 'auto';
        reactionsRef.current.style.left = `-${Math.max(0, actionsRef.current?.getBoundingClientRect().left || 0) - padding}px`;
      } else if (rect.right > window.innerWidth - padding) {
        reactionsRef.current.style.left = 'auto';
        reactionsRef.current.style.right = `-${window.innerWidth - Math.min(window.innerWidth, actionsRef.current?.getBoundingClientRect().right || window.innerWidth) - padding}px`;
      }
    }
  }, [showReactionPicker]);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (showActions) {
      timer = setTimeout(() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }, 5000);
    }
    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [showActions]);

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

  const isEmojiOnlyText = message.type === 'text' && !message.isDeleted && !message.replyTo && isEmojiOnly(message.content);
  const emojiSizeClass = isEmojiOnlyText ? getEmojiOnlySizeClass(message.content!) : '';

  const isSenderDisabled = message.isSenderDisabled || (message.content === 'Người dùng bị vô hiệu hoá' && !message.isDeleted);

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
      } catch (err: any) {
        console.error('Download error:', err);
        if (err.response?.data instanceof Blob) {
          const text = await err.response.data.text();
          toast.error(`Lỗi backend: ${text}`);
        } else {
          toast.error(`Lỗi: ${err.message || 'Không tải được tệp'}`);
        }
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
      className={`msg-row${isMe ? ' me' : ' other'}${showActions && !isSenderDisabled ? ' show-actions' : ''}`}
      onMouseEnter={() => !isSenderDisabled && setShowActions(true)}
      onMouseLeave={() => {
        setShowActions(false);
        setShowReactionPicker(false);
      }}
      onClick={() => !isSenderDisabled && setShowActions((prev) => !prev)}
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
        <div className={`msg-content-wrapper${isMe ? ' me' : ' other'}${!message.isDeleted && !isSenderDisabled && reactions.length > 0 ? ' has-reactions' : ''}`} style={{ flex: 1, maxWidth: isMe ? '100%' : 'calc(100% - 40px)' }}>
          <div
            className={`msg-bubble${isMe ? ' me' : ' other'}${message.isDeleted ? ' deleted' : ''}${isOptimistic ? ' sending' : ''}${isError ? ' error' : ''}${isMediaOnly ? ' media-only' : ''}${isEmojiOnlyText ? ' emoji-only' : ''}`}
            onClick={() => isMe && setShowStatus((prev) => !prev)}
            style={isSenderDisabled ? { border: '1px solid var(--error)', opacity: 0.8 } : undefined}
        >
          {showActions && !message.isDeleted && !isSenderDisabled && (
            <div ref={actionsRef} className={`msg-actions${isMe ? ' me' : ' other'}`} onClick={(e) => e.stopPropagation()}>
              <div
                className="action-btn"
                title="Cảm xúc"
                style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                onClick={(e) => {
                  e.stopPropagation();
                  setShowReactionPicker((prev) => !prev);
                }}
              >
                <Heart size={14} style={{ fill: myReaction ? 'var(--error)' : 'transparent', color: myReaction ? 'var(--error)' : 'inherit' }} />
                {showReactionPicker && (
                  <div ref={reactionsRef} className={`msg-reaction-picker${isMe ? ' me' : ' other'}`} onClick={(e) => e.stopPropagation()}>
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
                          setShowActions(false);
                        }}
                      >
                        {reaction.icon}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <button className="action-btn" title="Trả lời" onClick={(e) => { e.stopPropagation(); onReply?.(); setShowActions(false); }}>
                <CornerUpLeft size={14} />
              </button>
              {canDownload && typeof message.media === 'object' && message.media?.url && (
                <button
                  className="action-btn"
                  type="button"
                  title={isDownloading ? 'Đang tải' : 'Tải xuống'}
                  onClick={(e) => { handleDownload(e); setShowActions(false); }}
                  disabled={isDownloading}
                >
                  <Download size={14} />
                </button>
              )}
              {canEdit && (
                <button className="action-btn" title="Sửa" onClick={(e) => { e.stopPropagation(); onEdit?.(); setShowActions(false); }}>
                  <Pencil size={14} />
                </button>
              )}
              {canDelete && (
                <button className="action-btn" title="Thu hồi với mọi người" onClick={(e) => { e.stopPropagation(); onDelete?.(); setShowActions(false); }}>
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          )}

          {!message.isDeleted && message.replyTo && (
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
            <span className={`msg-text ${emojiSizeClass}`}>{message.content}</span>
          ) : message.type === 'image' && typeof message.media === 'object' && message.media?.url ? (
            <img
              src={message.media.url}
              alt={message.media.fileName || 'Ảnh'}
              className="msg-image"
              loading="lazy"
              onClick={(e) => { e.stopPropagation(); onMediaClick?.(message.media); }}
              style={{ cursor: onMediaClick ? 'pointer' : 'default' }}
            />
          ) : message.type === 'video' && typeof message.media === 'object' && message.media?.url ? (
            <div style={{ position: 'relative', cursor: onMediaClick ? 'pointer' : 'default', display: 'inline-block' }} onClick={(e) => { e.stopPropagation(); onMediaClick?.(message.media); }}>
              <video className="msg-video" preload="metadata" style={{ display: 'block' }}>
                <source src={message.media.url} type={message.media.mimeType || 'video/mp4'} />
              </video>
              <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: '48px', height: '48px', backgroundColor: 'rgba(0,0,0,0.5)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', pointerEvents: 'none' }}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              </div>
            </div>
          ) : message.type === 'voice' && typeof message.media === 'object' && message.media?.url ? (
            <AudioPlayer src={message.media.url} isMe={isMe} />
          ) : typeof message.media === 'object' && message.media?.url ? (
            <div className="msg-file-block" onClick={(event) => event.stopPropagation()}>
              <div
                className="msg-file"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px', overflow: 'hidden' }}>
                  <span style={{ flexShrink: 0 }}>[File]</span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{message.media.fileName || 'Tệp đính kèm'}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleDownload(e as any)}
                  disabled={isDownloading}
                  style={{
                    background: 'var(--surface-3)', border: 'none', color: 'inherit',
                    cursor: 'pointer', padding: '6px', display: 'flex', alignItems: 'center',
                    borderRadius: '4px', flexShrink: 0
                  }}
                  title="Tải xuống"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          ) : (
            <span className="msg-text">{message.content || 'Tin nhắn đính kèm'}</span>
          )}

          <div className="msg-meta">
            <span className="msg-time">{formatTime(message.createdAt)}</span>
          </div>
        </div>

        {!message.isDeleted && !isSenderDisabled && reactions.length > 0 && (
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
