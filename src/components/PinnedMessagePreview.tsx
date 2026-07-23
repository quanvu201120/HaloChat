import { Mic, FileText } from 'lucide-react';
import AudioPlayer from './AudioPlayer';
import { useRefreshableMediaUrl } from '../hooks/useRefreshableMediaUrl';
import { sanitizeExternalUrl } from '../utils/url';
import { type Message } from '../services/messages';

export default function PinnedMessagePreview({ message }: { message: Message }) {
  const media = typeof message.media === 'object' ? message.media : null;
  // Preview ghim luôn hiển thị khi mở → assumeInView để chủ động giữ URL tươi.
  const { url, ensureFreshUrl, refreshOnError } = useRefreshableMediaUrl(media, { assumeInView: true });

  if (message.type === 'image' && media?.url) {
    return (
      <img
        src={url || media.url}
        alt={message.content || 'Hình ảnh ghim'}
        onError={() => { void refreshOnError(); }}
        style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 12, background: '#f8fafc' }}
      />
    );
  }

  if (message.type === 'video' && media?.url) {
    return (
      <video
        src={url || media.url}
        controls
        onPlay={() => { void ensureFreshUrl(); }}
        onError={() => { void refreshOnError(); }}
        style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }}
      />
    );
  }

  if (message.type === 'voice' && media?.url) {
    return (
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
          <Mic size={16} />
          <span>{media.fileName || 'Tin nhắn thoại'}</span>
        </div>
        <AudioPlayer src={media.url} media={media} isMe={false} />
      </div>
    );
  }

  if (message.type === 'file' && media?.url) {
    return (
      <button
        type="button"
        onClick={async () => {
          const nextUrl = await ensureFreshUrl();
          const safeUrl = sanitizeExternalUrl(nextUrl || media.url);
          if (safeUrl) window.open(safeUrl, '_blank', 'noopener,noreferrer');
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: 16,
          borderRadius: 12,
          border: '1px solid var(--border)',
          color: 'var(--text-primary)',
          textDecoration: 'none',
          background: 'transparent',
          width: '100%',
          cursor: 'pointer',
        }}
      >
        <div style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: 'rgba(99,102,241,0.12)',
          color: 'var(--accent-primary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}>
          <FileText size={18} />
        </div>
        <div style={{ minWidth: 0, textAlign: 'left' }}>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>{media.fileName || 'Tệp đính kèm'}</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nhấn để mở tệp</div>
        </div>
      </button>
    );
  }

  const segments: React.ReactNode[] = [];
  const pattern = /@\[\[(.*?)\]\]/gs;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  const text = message.content || '';

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(text.slice(lastIndex, match.index));
    }
    segments.push(
      <span key={`${match.index}-${match[1]}`} className="msg-highlight">
        {match[1]}
      </span>,
    );
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push(text.slice(lastIndex));
  }

  return (
    <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: 15, color: 'var(--text-primary)' }}>
      {message.content ? segments : 'Tin nhắn trống'}
    </div>
  );
}
