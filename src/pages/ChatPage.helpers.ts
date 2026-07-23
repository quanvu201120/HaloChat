import {
  type Conversation,
} from '../services/conversations';
import {
  formatCallMessageLabel, type Message,
} from '../services/messages';
import {
  type MediaResourceTypeEnum, type MediaResponse,
} from '../services/media';
import { normalizeId } from '../utils/chat';
import { CHAT_DEFAULTS, MESSAGE_PREVIEWS } from '../constants/chat';
import { PERMANENT_BAN_DAYS } from '../constants/penalty';
import { type LocalMessage } from './ChatPage.types';

type NavigatorWithLegacyMedia = Navigator & {
  webkitGetUserMedia?: (
    constraints: MediaStreamConstraints,
    successCallback: (stream: MediaStream) => void,
    errorCallback: (error: DOMException) => void
  ) => void;
  mozGetUserMedia?: (
    constraints: MediaStreamConstraints,
    successCallback: (stream: MediaStream) => void,
    errorCallback: (error: DOMException) => void
  ) => void;
  getUserMedia?: (
    constraints: MediaStreamConstraints,
    successCallback: (stream: MediaStream) => void,
    errorCallback: (error: DOMException) => void
  ) => void;
};

export function getUserMediaCompat(constraints: MediaStreamConstraints) {
  if (navigator.mediaDevices?.getUserMedia) {
    return navigator.mediaDevices.getUserMedia(constraints);
  }

  const legacyNavigator = navigator as NavigatorWithLegacyMedia;
  const legacyGetUserMedia =
    legacyNavigator.getUserMedia ||
    legacyNavigator.webkitGetUserMedia ||
    legacyNavigator.mozGetUserMedia;

  if (!legacyGetUserMedia) {
    return Promise.reject(new Error('Không thể truy cập microphone/camera trên thiết bị này.'));
  }

  return new Promise<MediaStream>((resolve, reject) => {
    legacyGetUserMedia.call(legacyNavigator, constraints, resolve, reject);
  });
}

/**
 * Formats a given number of seconds into an mm:ss string.
 *
 * @param {number} seconds - The duration in seconds.
 * @returns {string} The formatted duration string (e.g., "01:30").
 */
export function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export function getBanStatusText(banUntil?: string): string {
  if (!banUntil) return 'Tài khoản này đã bị khóa.';

  const diffMs = new Date(banUntil).getTime() - Date.now();
  if (diffMs <= 0) return 'Tài khoản này đã bị khóa.';

  const totalDays = Math.ceil(diffMs / 86400000);
  if (totalDays >= PERMANENT_BAN_DAYS) return 'Tài khoản này đã bị khóa.';

  const totalMinutes = Math.ceil(diffMs / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  let remaining = '';
  if (days > 0) {
    remaining = `${days} ngày${hours > 0 ? ` ${hours} giờ` : ''}${minutes > 0 ? ` ${minutes} phút` : ''}`;
  } else if (hours > 0) {
    remaining = `${hours} giờ${minutes > 0 ? ` ${minutes} phút` : ''}`;
  } else {
    remaining = `${Math.max(minutes, 1)} phút`;
  }

  return `Tài khoản này đã bị khóa. Còn ${remaining}.`;
}

export function getUserRestrictionState(user?: { isDisabled?: boolean; banUntil?: string } | null) {
  if (!user) {
    return { kind: null as null, badgeLabel: null as null | 'BAN' | 'DISABLE' };
  }

  const hasActiveBan = !!user.banUntil && new Date(user.banUntil).getTime() > Date.now();
  const isPermanentBan = hasActiveBan
    ? Math.ceil((new Date(user.banUntil!).getTime() - Date.now()) / 86400000) >= PERMANENT_BAN_DAYS - 1
    : false;

  if (hasActiveBan && (!user.isDisabled || isPermanentBan)) {
    return { kind: 'ban' as const, badgeLabel: 'BAN' as const };
  }

  if (hasActiveBan || user.isDisabled) {
    return { kind: 'disable' as const, badgeLabel: 'DISABLE' as const };
  }

  return { kind: null as null, badgeLabel: null as null | 'BAN' | 'DISABLE' };
}

/**
 * Retrieves the display name of a conversation.
 * For groups, it returns the group name or a default fallback.
 * For 1-on-1 chats, it returns the other user's name or a default fallback.
 *
 * @param {Conversation} conv - The conversation object.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @returns {string} The resolved conversation name.
 */
export function getConversationName(conv: Conversation, currentUserId: string): string {
  if (conv.isGroup) return conv.name || CHAT_DEFAULTS.GROUP_NAME;
  const other = conv.users.find((u) => u._id !== currentUserId);
  return other?.name || CHAT_DEFAULTS.USER_NAME;
}

/**
 * Extracts the normalized ID of the sender from a message.
 *
 * @param {Message} message - The message object.
 * @returns {string} The normalized sender ID.
 */
export function getSenderId(message: Message): string {
  return normalizeId(typeof message.sender === 'string' ? message.sender : message.sender?._id);
}

/**
 * Gets a short preview text for a message that is being replied to.
 * Returns different fallback strings based on message type.
 *
 * @param {Message | null} replyTarget - The message being replied to, or null.
 * @returns {string} The preview text.
 */
export function getReplyTargetPreview(replyTarget: Message | null) {
  if (!replyTarget) return '';
  if (replyTarget.isDeleted) return MESSAGE_PREVIEWS.RECALLED;
  if (replyTarget.type === 'callAudio' || replyTarget.type === 'callVideo') return formatCallMessageLabel(replyTarget);
  if (replyTarget.type === 'text') return replyTarget.content || MESSAGE_PREVIEWS.TEXT;
  if (replyTarget.type === 'image') return MESSAGE_PREVIEWS.IMAGE;
  if (replyTarget.type === 'video') return MESSAGE_PREVIEWS.VIDEO;
  if (replyTarget.type === 'voice') return MESSAGE_PREVIEWS.VOICE;
  if (replyTarget.type === 'file') return MESSAGE_PREVIEWS.FILE;
  return CHAT_DEFAULTS.MESSAGE_FALLBACK;
}

export function getPinnedMessageSummary(message: Message) {
  if (message.isDeleted) return 'Tin nhắn đã thu hồi';
  if (message.type === 'callAudio' || message.type === 'callVideo') return formatCallMessageLabel(message);
  if (message.type === 'text') {
    const text = (message.content || '').replace(/@\[\[(.*?)\]\]/gs, '$1').replace(/\s+/g, ' ').trim();
    if (!text) return 'Tin nhắn văn bản';
    return text.length > 120 ? `${text.slice(0, 120).trimEnd()}...` : text;
  }
  if (message.type === 'image') return 'Đã ghim một hình ảnh';
  if (message.type === 'video') return 'Đã ghim một video';
  if (message.type === 'voice') return 'Đã ghim một đoạn voice';
  if (message.type === 'file') return 'Đã ghim một tệp đính kèm';
  return MESSAGE_PREVIEWS.TEXT;
}

/**
 * Determines the appropriate file extension for a voice message based on its MIME type.
 *
 * @param {string} mimeType - The MIME type of the audio file.
 * @returns {string} The determined file extension (e.g., 'webm', 'mp3').
 */
export function getVoiceFileExtension(mimeType: string) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
}

/**
 * Checks whether an incoming message is likely the server's confirmation
 * of an optimistic local message (sent before server acknowledgment).
 *
 * @param {LocalMessage} candidate - The local optimistic message.
 * @param {Message} incoming - The incoming message from the server.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @returns {boolean} True if they likely match, otherwise false.
 */
export function isLikelyOptimisticMatch(candidate: LocalMessage, incoming: Message, currentUserId: string) {
  if (!candidate._id.startsWith('opt_')) return false;
  if (getSenderId(incoming) !== currentUserId) return false;
  if (candidate.type !== incoming.type) return false;

  if (candidate.type === 'text') {
    return (candidate.content || '').trim() === (incoming.content || '').trim();
  }

  const candidateMedia = typeof candidate.media === 'object' ? candidate.media : undefined;
  const incomingMedia = typeof incoming.media === 'object' ? incoming.media : undefined;
  if (!candidateMedia || !incomingMedia) return false;

  return candidateMedia.fileName === incomingMedia.fileName && candidateMedia.size === incomingMedia.size;
}

export const globalMessagesCache: Record<string, { messages: LocalMessage[], hasMore: boolean, nextCursor: string | null }> = {};

/**
 * Tìm các conversation (1-1 lẫn group chung) chứa cả currentUser và đối phương,
 * dùng khi 2 người chặn/bỏ chặn nhau để refresh lại tin nhắn đã serialize.
 */
export function findSharedConversationIds(
  conversations: Conversation[],
  currentUserId: string,
  otherUserId: string,
): string[] {
  if (!currentUserId || !otherUserId) return [];
  return conversations
    .filter((conversation) => {
      const memberIds = conversation.users.map((user) => normalizeId(user._id));
      return memberIds.includes(currentUserId) && memberIds.includes(otherUserId);
    })
    .map((conversation) => conversation._id);
}

type MediaCacheEntry = {
  medias: MediaResponse[];
  nextCursor: string | null;
  hasMore: boolean;
};
export const globalMediaCache: Record<string, Partial<Record<MediaResourceTypeEnum, MediaCacheEntry>>> = {};

export const WEBRTC_FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: import.meta.env.VITE_WEBRTC_STUN_URL || 'stun:stun.l.google.com:19302' },
];
export const PENDING_CALL_ID_PREFIX = 'pending-call-';
