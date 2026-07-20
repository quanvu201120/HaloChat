/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Send, Phone, Video, Info, Smile, Paperclip, Image, Mic, Square, X,
  MicOff, VideoOff, RefreshCw, Camera, Trash2, LogOut, ShieldOff, Check, Pencil, UserPlus, UserMinus, Crown, History, ChevronDown, ChevronRight, ChevronLeft, FileText, Search, Plus, Download, Edit2, UserX, UserCheck,
  MapPin, Calendar, User as UserIcon, MessageSquare, AlertTriangle, Pin
} from 'lucide-react';
import { useAuthStore as useAuth } from '../store/authStore';
import { useChatStore as useChat } from '../store/chatStore';
import { useRelationships } from '../hooks/useRelationships';
import {
  conversationsApi, normalizeConversation, type Conversation,
} from '../services/conversations';
import MediaLightbox from '../components/MediaLightbox';
import {
  messagesApi, normalizeMessage, normalizeMessages, formatCallMessageLabel, type Message,
} from '../services/messages';
import {
  mediaApi, MediaResourceTypeEnum, type MediaResponse,
} from '../services/media';
import { api, parseError } from '../services/api';
import {
  joinConversation,
  sendTextMessage,
  startTyping,
  stopTyping,
  getSocket,
  markReadSocket,
  revokeMessage,
  updateTextMessage,
  startCallSocket,
  acceptCallSocket,
  rejectCallSocket,
  endCallSocket,
  sendCallHeartbeatSocket,
  sendCallOfferSocket,
  sendCallAnswerSocket,
  sendCallIceCandidateSocket,
  type CallIceCandidate,
  type CallSessionDescription,
  type CallType,
} from '../services/socket';
import { useToast } from '../context/ToastContext';
import EmojiPicker from 'emoji-picker-react';
import MessageBubble from '../components/MessageBubble';
import AudioPlayer from '../components/AudioPlayer';
import Modal from '../components/Modal';
import AddMemberModal from '../components/AddMemberModal';
import ConfirmModal from '../components/ConfirmModal';
import MessageReadersModal from '../components/MessageReadersModal';
import ReportUserModal from '../components/ReportUserModal';
import MessageReactionsModal from '../components/MessageReactionsModal';
import { normalizeId } from '../utils/chat';
import { sanitizeExternalUrl } from '../utils/url';
import { getDeviceCategoryFromUserAgent } from '../utils/device';
import { startCallTone as startSharedCallTone, stopCallTone as stopSharedCallTone } from '../utils/callTone';
import { CHAT_DEFAULTS, MESSAGE_PREVIEWS, MIME_TYPES, TIMING } from '../constants/chat';
import { PERMANENT_BAN_DAYS } from '../constants/penalty';
import { UI_MESSAGES } from '../constants/messages';
import { formatDateVN } from '../utils/date';

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

function getUserMediaCompat(constraints: MediaStreamConstraints) {
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
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getBanStatusText(banUntil?: string): string {
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

function getUserRestrictionState(user?: { isDisabled?: boolean; banUntil?: string } | null) {
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

type LocalMessage = Message & {
  _error?: boolean;
};

/**
 * Retrieves the display name of a conversation.
 * For groups, it returns the group name or a default fallback.
 * For 1-on-1 chats, it returns the other user's name or a default fallback.
 *
 * @param {Conversation} conv - The conversation object.
 * @param {string} currentUserId - The ID of the currently logged-in user.
 * @returns {string} The resolved conversation name.
 */
function getConversationName(conv: Conversation, currentUserId: string): string {
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
function getSenderId(message: Message): string {
  return normalizeId(typeof message.sender === 'string' ? message.sender : message.sender?._id);
}

/**
 * Gets a short preview text for a message that is being replied to.
 * Returns different fallback strings based on message type.
 *
 * @param {Message | null} replyTarget - The message being replied to, or null.
 * @returns {string} The preview text.
 */
function getReplyTargetPreview(replyTarget: Message | null) {
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

function getPinnedMessageSummary(message: Message) {
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
function getVoiceFileExtension(mimeType: string) {
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
function isLikelyOptimisticMatch(candidate: LocalMessage, incoming: Message, currentUserId: string) {
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

const globalMessagesCache: Record<string, { messages: LocalMessage[], hasMore: boolean, nextCursor: string | null }> = {};

type MediaCacheEntry = {
  medias: MediaResponse[];
  nextCursor: string | null;
  hasMore: boolean;
};
const globalMediaCache: Record<string, Partial<Record<MediaResourceTypeEnum, MediaCacheEntry>>> = {};

const WEBRTC_FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: import.meta.env.VITE_WEBRTC_STUN_URL || 'stun:stun.l.google.com:19302' },
];
const WEBRTC_ICE_SERVERS_CACHE_KEY = 'halochat-webrtc-ice-servers';
const PENDING_CALL_ID_PREFIX = 'pending-call-';

type CallUiState = {
  callId: string;
  conversationId: string;
  callToken?: string;
  callType: CallType;
  direction: 'incoming' | 'outgoing';
  status: 'incoming' | 'calling' | 'connecting' | 'active';
  peerName: string;
  peerId: string;
  peerAvatarUrl?: string;
};

type IncomingCallRouteState = {
  incomingCall?: {
    callId: string;
    callerId?: string;
    calleeId: string;
    conversationId: string;
    callType: CallType;
    callToken?: string;
  };
};

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const activeConversationId = normalizeId(conversationId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const {
    conversations,
    online,
    typing,
    clearUnread,
    isSocketConnected,
    syncConversationMessage,
    refetchConversations,
    patchConversation,
    hasLoadedConversations,
    setUsersOnline,
    setConversations,
    mergeConversation,
  } = useChat();
  const toast = useToast();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadedMessagesConversationId, setLoadedMessagesConversationId] = useState('');
  const [isLoadingConv, setIsLoadingConv] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const [pendingHighlightMessageId, setPendingHighlightMessageId] = useState<string | null>(null);
  
  const [isGroupAvatarMenuOpen, setIsGroupAvatarMenuOpen] = useState(false);
  const [selectedGroupMedia, setSelectedGroupMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null);
  const [selectedPinnedMessage, setSelectedPinnedMessage] = useState<Message | null>(null);
  const groupAvatarMenuRef = useRef<HTMLDivElement>(null);

  const isTempConversation = activeConversationId.startsWith('temp_');
  const isMuted = !!user?.muteUntil && new Date(user.muteUntil) > new Date();
  const muteUntilLabel = user?.muteUntil ? formatDateVN(user.muteUntil) : '';

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (groupAvatarMenuRef.current && !groupAvatarMenuRef.current.contains(event.target as Node)) {
        setIsGroupAvatarMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string>('');
  const [voiceMimeType, setVoiceMimeType] = useState(MIME_TYPES.WEBM_AUDIO);
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [isMembersExpanded, setIsMembersExpanded] = useState(false);
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);
  const [isVideosExpanded, setIsVideosExpanded] = useState(false);
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);

  const [sidebarMedia, setSidebarMedia] = useState<Partial<Record<MediaResourceTypeEnum, MediaResponse[]>>>({});
  const [sidebarMediaCursor, setSidebarMediaCursor] = useState<Partial<Record<MediaResourceTypeEnum, string | null>>>({});
  const [sidebarMediaHasMore, setSidebarMediaHasMore] = useState<Partial<Record<MediaResourceTypeEnum, boolean>>>({});
  const [isLoadingSidebarMedia, setIsLoadingSidebarMedia] = useState<Partial<Record<MediaResourceTypeEnum, boolean>>>({});
  const [hasFetchedSidebarMedia, setHasFetchedSidebarMedia] = useState<Partial<Record<MediaResourceTypeEnum, boolean>>>({});

  const [lightboxMedias, setLightboxMedias] = useState<MediaResponse[] | null>(null);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showHighlightMenu, setShowHighlightMenu] = useState(false);
  const [suppressHighlightTriggerIndex, setSuppressHighlightTriggerIndex] = useState<number | null>(null);
  const [showMediaMenu, setShowMediaMenu] = useState(false);
  const [readersModalData, setReadersModalData] = useState<{ isOpen: boolean; readers: string[] }>({ isOpen: false, readers: [] });
  const [reactionsModalData, setReactionsModalData] = useState<{ isOpen: boolean; message: Message | null }>({ isOpen: false, message: null });
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    action: () => void;
    isDanger?: boolean;
    confirmText?: string;
    countdown?: number;
  } | null>(null);
  const [callState, setCallState] = useState<CallUiState | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localCallStream, setLocalCallStream] = useState<MediaStream | null>(null);
  const [callStartedAt, setCallStartedAt] = useState<number | null>(null);
  const [callDurationSeconds, setCallDurationSeconds] = useState(0);
  const [isCallMicEnabled, setIsCallMicEnabled] = useState(true);
  const [isCallCameraEnabled, setIsCallCameraEnabled] = useState(true);
  const [isSwitchingCamera, setIsSwitchingCamera] = useState(false);
  const callTokenRef = useRef<string>('');
  const pendingOutgoingCallIdRef = useRef<string>('');
  const callHeartbeatTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [webrtcIceServers, setWebrtcIceServers] = useState<RTCIceServer[]>(WEBRTC_FALLBACK_ICE_SERVERS);
  const webrtcIceServersLoadedRef = useRef(false);

  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // User Profile Popup States
  const [selectedUserForInfo, setSelectedUserForInfo] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const renderPinnedMessagePreview = useCallback((message: Message) => {
    const media = typeof message.media === 'object' ? message.media : null;
    if (message.type === 'image' && media?.url) {
      return (
        <img
          src={media.url}
          alt={message.content || 'Hình ảnh ghim'}
          style={{ width: '100%', maxHeight: 420, objectFit: 'contain', borderRadius: 12, background: '#f8fafc' }}
        />
      );
    }

    if (message.type === 'video' && media?.url) {
      return (
        <video
          src={media.url}
          controls
          style={{ width: '100%', maxHeight: 420, borderRadius: 12, background: '#000' }}
        />
      );
    }

    if (message.type === 'voice' && media?.url) {
      return (
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-secondary)', fontSize: 13 }}>
            <Mic size={16} />
            <span>{media.fileName || 'Voice message'}</span>
          </div>
          <AudioPlayer src={media.url} isMe={false} />
        </div>
      );
    }

    if (message.type === 'file' && media?.url) {
      return (
        <a
          href={sanitizeExternalUrl(media.url) || undefined}
          target="_blank"
          rel="noreferrer"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: 16,
            borderRadius: 12,
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            textDecoration: 'none',
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
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>{media.fileName || 'File đính kèm'}</div>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Nhấn để mở tệp</div>
          </div>
        </a>
      );
    }

    const renderHighlightedContent = (text: string) => {
      const segments: React.ReactNode[] = [];
      const pattern = /@\[\[(.*?)\]\]/gs;
      let lastIndex = 0;
      let match: RegExpExecArray | null;
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
      return segments;
    };

    return (
      <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.65, fontSize: 15, color: 'var(--text-primary)' }}>
        {message.content ? renderHighlightedContent(message.content) : 'Tin nhắn trống'}
      </div>
    );
  }, []);

  const handleShowUserProfile = (userObj: any) => {
    if (!userObj || !userObj._id || getUserRestrictionState(userObj).kind === 'disable') return;
    setSelectedUserForInfo(userObj);
  };

  const handleStartDirectChat = async (userId: string) => {
    if (userId === currentUserId) return;
    
    const existingConv = conversations.find((c) => 
      !c.isGroup && c.users.some((u) => u._id === userId)
    );

    if (existingConv) {
      setSelectedUserForInfo(null);
      navigate(`/chat/${existingConv._id}`);
      return;
    }

    try {
      const res = await conversationsApi.create({ users: [userId] });
      const newConv = res.data?.data ?? res.data;
      if (newConv?._id) {
        mergeConversation(newConv);
        setSelectedUserForInfo(null);
        navigate(`/chat/${newConv._id}`);
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Không thể mở cuộc trò chuyện');
    }
  };

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const highlightTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const peerConnectionRef = useRef<RTCPeerConnection | null>(null);
  const callLocalStreamRef = useRef<MediaStream | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);
  const pendingIceCandidatesRef = useRef<RTCIceCandidateInit[]>([]);
  const isMobileDevice = getDeviceCategoryFromUserAgent(typeof navigator !== 'undefined' ? navigator.userAgent : '') === 'mobile';
  
  // Handle click outside for Emoji Picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      if (showEmojiPicker && emojiPickerRef.current && !emojiPickerRef.current.contains(event.target as Node)) {
        setShowEmojiPicker(false);
      }
    };
    
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [showEmojiPicker]);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const isCancelledVoiceRef = useRef(false);
  const hasHandledMissingConversationRef = useRef(false);
  const prevScrollHeightRef = useRef<number>(0);
  const isPrependingRef = useRef(false);
  const messagesRequestIdRef = useRef(0);
  const conversationRequestIdRef = useRef(0);
  const isLeavingOrDisbandingRef = useRef(false);
  const currentUserId = user?._id || '';

  const socket = getSocket();
  const typingUsers = activeConversationId ? (typing[activeConversationId] ?? []) : [];
  const typingNames = typingUsers
    .filter((id) => id !== currentUserId)
    .map((id) => conv?.users.find((u) => u._id === id)?.name || 'ai đó');

  const visibleMessages = useMemo(() => (
    loadedMessagesConversationId === activeConversationId
      ? messages.filter((message) => normalizeId(message.conversationId) === activeConversationId)
      : []
  ), [activeConversationId, loadedMessagesConversationId, messages]);

  const otherUser = conv && !conv.isGroup
    ? conv.users.find((u) => u._id !== currentUserId)
    : null;
  const otherUserRestriction = getUserRestrictionState(otherUser);
  const isTargetUserDisabled = otherUserRestriction.kind === 'disable';
  const isTargetUserBanned = otherUserRestriction.kind === 'ban';
  const isOtherOnline = otherUser ? online[otherUser._id] === true : false;
  const convName = conv ? getConversationName(conv, currentUserId) : '...';
  const pinnedMessage = conv?.pinMessage ?? null;
  const { block, unblock, rawRelationships, friends, sentRequests, blockedUsers, sendRequest, isSendingRequest, isLoading: isLoadingRelationships } = useRelationships();

  const currentRelationship = useMemo(() => {
    if (!otherUser || !rawRelationships) return null;
    return rawRelationships.find((r: any) => 
      (r.requester?._id === currentUserId && r.recipient?._id === otherUser._id) ||
      (r.recipient?._id === currentUserId && r.requester?._id === otherUser._id)
    );
  }, [otherUser, rawRelationships, currentUserId]);

  const isBlocked = currentRelationship?.status === 'BLOCKED';
  const iBlockedThem = isBlocked && currentRelationship?.blockedBy === currentUserId;
  const isFriend = !conv?.isGroup && currentRelationship?.status === 'ACCEPTED';
  const canStartDirectCall = !!conv && !conv.isGroup && isFriend && !isBlocked && !isTargetUserBanned && !isTargetUserDisabled;
  const blockedUserIds = useMemo(() => {
    const ids = new Set(blockedUsers.map((blockedUser) => blockedUser._id));

    rawRelationships
      .filter((rel: any) => rel.status === 'BLOCKED')
      .forEach((rel: any) => {
        if (rel.requester?._id === currentUserId && rel.recipient?._id) {
          ids.add(rel.recipient._id);
        }
        if (rel.recipient?._id === currentUserId && rel.requester?._id) {
          ids.add(rel.requester._id);
        }
      });

    return ids;
  }, [blockedUsers, rawRelationships, currentUserId]);

  const headerAvatarUrl = conv?.isGroup 
    ? (conv.avatar?.url || '') 
    : (otherUser?.avatar?.url || '');

  const isMessageRequest = conv && !isFriend && !conv.acceptedBy?.includes(currentUserId);

  useEffect(() => {
    if (isMessageRequest) {
      setShowInfo(false);
    }
  }, [isMessageRequest]);

  useEffect(() => {
    if (remoteVideoRef.current) {
      remoteVideoRef.current.srcObject = remoteStream;
    }
    if (remoteAudioRef.current) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  useEffect(() => {
    if (localVideoRef.current) {
      localVideoRef.current.srcObject = localCallStream;
    }
  }, [localCallStream]);

  useEffect(() => {
    for (const video of [remoteVideoRef.current, localVideoRef.current]) {
      if (!video) continue;
      video.setAttribute('playsinline', 'true');
      video.setAttribute('webkit-playsinline', 'true');
      video.disablePictureInPicture = true;
    }
  }, []);

  useEffect(() => {
    if (!localCallStream) return;

    setIsCallMicEnabled(localCallStream.getAudioTracks()[0]?.enabled ?? true);
    setIsCallCameraEnabled(localCallStream.getVideoTracks()[0]?.enabled ?? true);
  }, [localCallStream]);

  useEffect(() => {
    callTokenRef.current = callState?.callToken || '';
  }, [callState?.callToken]);

  useEffect(() => {
    if (webrtcIceServersLoadedRef.current) return;
    webrtcIceServersLoadedRef.current = true;

    try {
      const cachedIceServers = sessionStorage.getItem(WEBRTC_ICE_SERVERS_CACHE_KEY);
      if (cachedIceServers) {
        const parsedIceServers = JSON.parse(cachedIceServers) as RTCIceServer[];
        if (Array.isArray(parsedIceServers) && parsedIceServers.length > 0) {
          setWebrtcIceServers(parsedIceServers);
          return;
        }
      }
    } catch {
      // Ignore cache parse errors and fall back to backend fetch.
    }

    let cancelled = false;
    void api.get('/realtime/webrtc/ice-servers')
      .then((res) => {
        const servers = res.data?.iceServers;
        if (!cancelled && Array.isArray(servers) && servers.length > 0) {
          setWebrtcIceServers(servers);
          try {
            sessionStorage.setItem(WEBRTC_ICE_SERVERS_CACHE_KEY, JSON.stringify(servers));
          } catch {
            // Ignore storage errors.
          }
        }
      })
      .catch(() => {
        if (!cancelled) {
          setWebrtcIceServers(WEBRTC_FALLBACK_ICE_SERVERS);
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const stopCallTone = useCallback(() => stopSharedCallTone(), []);
  const startCallTone = useCallback((mode: 'incoming' | 'outgoing') => startSharedCallTone(mode), []);

  const cleanupCall = useCallback(() => {
    stopCallTone();
    pendingOutgoingCallIdRef.current = '';
    peerConnectionRef.current?.close();
    peerConnectionRef.current = null;
    callLocalStreamRef.current?.getTracks().forEach((track) => track.stop());
    callLocalStreamRef.current = null;
    pendingIceCandidatesRef.current = [];
    setRemoteStream(null);
    setLocalCallStream(null);
    setCallState(null);
    setCallStartedAt(null);
    setCallDurationSeconds(0);
    setIsCallMicEnabled(true);
    setIsCallCameraEnabled(true);
    setIsSwitchingCamera(false);
  }, [stopCallTone]);

  const getCallMedia = useCallback(async (callType: CallType) => {
    if (callLocalStreamRef.current) return callLocalStreamRef.current;

    const stream = await getUserMediaCompat({
      audio: true,
      video: callType === 'video',
    });
    callLocalStreamRef.current = stream;
    setLocalCallStream(stream);
    setIsCallMicEnabled(stream.getAudioTracks()[0]?.enabled ?? true);
    setIsCallCameraEnabled(stream.getVideoTracks()[0]?.enabled ?? true);
    return stream;
  }, []);

  const handleToggleCallMic = useCallback(() => {
    const audioTrack = callLocalStreamRef.current?.getAudioTracks()[0];
    if (!audioTrack) return;

    audioTrack.enabled = !audioTrack.enabled;
    setIsCallMicEnabled(audioTrack.enabled);
  }, []);

  const handleToggleCallCamera = useCallback(() => {
    const videoTrack = callLocalStreamRef.current?.getVideoTracks()[0];
    if (!videoTrack) return;

    videoTrack.enabled = !videoTrack.enabled;
    setIsCallCameraEnabled(videoTrack.enabled);
  }, []);

  const handleSwitchCallCamera = useCallback(async () => {
    if (!callState || callState.callType !== 'video' || !isMobileDevice || isSwitchingCamera) return;

    const currentStream = callLocalStreamRef.current;
    const currentVideoTrack = currentStream?.getVideoTracks()[0];
    if (!currentStream || !currentVideoTrack) return;

    const currentFacingMode = currentVideoTrack.getSettings().facingMode;
    const nextFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';

    setIsSwitchingCamera(true);
    try {
      const videoStream = await getUserMediaCompat({
        audio: false,
        video: { facingMode: { ideal: nextFacingMode } },
      });
      const nextVideoTrack = videoStream.getVideoTracks()[0];
      if (!nextVideoTrack) {
        throw new Error('Không thể đổi camera.');
      }

      nextVideoTrack.enabled = isCallCameraEnabled;
      const nextStream = new MediaStream([
        ...currentStream.getAudioTracks(),
        nextVideoTrack,
      ]);

      const sender = peerConnectionRef.current?.getSenders().find((item) => item.track?.kind === 'video');
      if (sender) {
        await sender.replaceTrack(nextVideoTrack);
      }

      currentVideoTrack.stop();
      callLocalStreamRef.current = nextStream;
      setLocalCallStream(nextStream);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Không thể đổi camera.');
    } finally {
      setIsSwitchingCamera(false);
    }
  }, [callState, isCallCameraEnabled, isMobileDevice, isSwitchingCamera, toast]);

  const flushPendingIceCandidates = useCallback(async () => {
    const peerConnection = peerConnectionRef.current;
    if (!peerConnection?.remoteDescription) return;

    const candidates = pendingIceCandidatesRef.current;
    pendingIceCandidatesRef.current = [];
    for (const candidate of candidates) {
      await peerConnection.addIceCandidate(candidate);
    }
  }, []);

  const ensurePeerConnection = useCallback((callId: string, conversationId: string, stream: MediaStream) => {
    if (peerConnectionRef.current) return peerConnectionRef.current;

    const peerConnection = new RTCPeerConnection({ iceServers: webrtcIceServers });
    peerConnectionRef.current = peerConnection;

    const markCallActive = () => {
      setCallState((prev) => {
        if (!prev || prev.callId !== callId || prev.status === 'active') return prev;
        return { ...prev, status: 'active' };
      });
      setCallStartedAt((prev) => prev ?? Date.now());
    };

    stream.getTracks().forEach((track) => peerConnection.addTrack(track, stream));

    peerConnection.ontrack = (event) => {
      const [incomingStream] = event.streams;
      if (incomingStream) {
        setRemoteStream(incomingStream);
        markCallActive();
      }
    };

    peerConnection.onicecandidate = (event) => {
      const candidate = event.candidate?.toJSON() as CallIceCandidate | undefined;
      if (!candidate) return;
      const callToken = callTokenRef.current;
      if (!callToken) return;
      void sendCallIceCandidateSocket({ callId, conversationId, callToken, candidate }).catch(() => {});
    };

    peerConnection.onconnectionstatechange = () => {
      const state = peerConnection.connectionState;
      if (state === 'connected') {
        markCallActive();
      }
      if (state === 'failed' || state === 'disconnected') {
        if (callState?.callId === callId) {
          void endCallSocket(callId, 'network_lost').catch(() => {});
        }
        cleanupCall();
      }
    };

    peerConnection.oniceconnectionstatechange = () => {
      const state = peerConnection.iceConnectionState;
      if (state === 'connected') {
        markCallActive();
      }
      if (state === 'failed' || state === 'disconnected') {
        if (callState?.callId === callId) {
          void endCallSocket(callId, 'network_lost').catch(() => {});
        }
        cleanupCall();
      }
    };

    return peerConnection;
  }, [callState?.callId, cleanupCall, webrtcIceServers]);

  useEffect(() => {
    if (!callState || callState.status !== 'active' || !callStartedAt) {
      setCallDurationSeconds(0);
      return;
    }

    const updateDuration = () => {
      setCallDurationSeconds(Math.max(0, Math.floor((Date.now() - callStartedAt) / 1000)));
    };

    updateDuration();
    const timer = setInterval(updateDuration, 1000);
    return () => clearInterval(timer);
  }, [callStartedAt, callState?.status, callState?.callId]);

  /**
   * Bắt đầu cuộc gọi mới từ chat hiện tại.
   * Chỉ cho phép chat 1-1 và chỉ khi không có cuộc gọi active nào khác.
   */
  const handleStartCall = useCallback(async (callType: CallType) => {
    if (!activeConversationId || !otherUser || !conv || conv.isGroup) {
      toast.warning('Chỉ hỗ trợ gọi 1-1 ở phiên bản này.');
      return;
    }
    if (!isFriend) {
      toast.warning('Chỉ có thể gọi khi hai bên là bạn bè.');
      return;
    }
    if (!socket?.connected) {
      toast.error('Socket chưa sẵn sàng, vui lòng thử lại.');
      return;
    }
    if (callState) {
      toast.warning('Bạn đang có một cuộc gọi khác.');
      return;
    }

    const pendingCallId = PENDING_CALL_ID_PREFIX + Date.now();
    pendingOutgoingCallIdRef.current = pendingCallId;
    setCallState({
      callId: pendingCallId,
      conversationId: activeConversationId,
      callType,
      direction: 'outgoing',
      status: 'calling',
      peerName: otherUser.name || otherUser.email || 'Người dùng',
      peerId: otherUser._id,
      peerAvatarUrl: otherUser.avatar?.url || '',
    });
    startCallTone('outgoing');

    try {
      const stream = await getCallMedia(callType);
      if (pendingOutgoingCallIdRef.current !== pendingCallId) {
        cleanupCall();
        return;
      }

      const ack = await startCallSocket({
        calleeId: otherUser._id,
        conversationId: activeConversationId,
        callType,
      });
      if (pendingOutgoingCallIdRef.current !== pendingCallId) {
        await endCallSocket(ack.callId, 'user_hangup').catch(() => undefined);
        cleanupCall();
        return;
      }

      ensurePeerConnection(ack.callId, activeConversationId, stream);
      pendingOutgoingCallIdRef.current = '';
      setCallState((prev) => {
        if (!prev || prev.callId !== pendingCallId) return prev;
        return {
          ...prev,
          callId: ack.callId,
          conversationId: activeConversationId,
          callToken: ack.callToken,
        };
      });
    } catch (error) {
      pendingOutgoingCallIdRef.current = '';
      cleanupCall();
      toast.error(error instanceof Error ? error.message : 'Không thể bắt đầu cuộc gọi.');
    }
  }, [activeConversationId, callState, cleanupCall, conv, ensurePeerConnection, getCallMedia, isFriend, otherUser, socket?.connected, startCallTone, toast]);

  /**
   * Chấp nhận cuộc gọi incoming và chuyển sang giai đoạn kết nối WebRTC.
   */
  const handleAcceptCall = useCallback(async () => {
    if (!callState || callState.status !== 'incoming') return;

    try {
      stopCallTone();
      const stream = await getCallMedia(callState.callType);
      await acceptCallSocket(callState.callId);
      ensurePeerConnection(callState.callId, callState.conversationId, stream);
      setCallState((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
    } catch (error) {
      cleanupCall();
      toast.error(error instanceof Error ? error.message : 'Không thể nhận cuộc gọi.');
    }
  }, [callState, cleanupCall, ensurePeerConnection, getCallMedia, stopCallTone, toast]);

  /**
   * Từ chối cuộc gọi incoming hoặc dừng call đang chờ/kết nối.
   */
  const handleRejectCall = useCallback(async () => {
    if (!callState) return;
    try {
      if (callState.status === 'incoming') {
        await rejectCallSocket(callState.callId);
      } else {
        await endCallSocket(callState.callId, 'user_hangup');
      }
    } catch {
      // UI vẫn cần đóng cuộc gọi dù ack thất bại.
    } finally {
      cleanupCall();
    }
  }, [callState, cleanupCall]);

  /**
   * Chủ động kết thúc cuộc gọi đang chạy từ phía người dùng hiện tại.
   */
  const handleEndCall = useCallback(async () => {
    if (!callState) return;
    if (callState.callId.startsWith(PENDING_CALL_ID_PREFIX)) {
      pendingOutgoingCallIdRef.current = '';
      cleanupCall();
      return;
    }
    try {
      await endCallSocket(callState.callId, 'user_hangup');
    } catch {
      // UI vẫn cần dọn media local nếu server không ack kịp.
    } finally {
      cleanupCall();
    }
  }, [callState, cleanupCall]);

  /**
   * Dừng timer heartbeat của call hiện tại để tránh ping tiếp sau khi call đã đóng.
   */
  const stopCallHeartbeat = useCallback(() => {
    if (callHeartbeatTimerRef.current) {
      clearInterval(callHeartbeatTimerRef.current);
      callHeartbeatTimerRef.current = null;
    }
  }, []);

  /**
   * Bắt đầu ping heartbeat định kỳ cho call đã accept.
   * FE chỉ bật timer này ở phía callee sau khi cuộc gọi chuyển khỏi trạng thái incoming.
   */
  const startCallHeartbeat = useCallback(() => {
    stopCallHeartbeat();

    if (!callState || callState.direction !== 'incoming' || callState.status === 'incoming') {
      return;
    }

    const ping = () => {
      void sendCallHeartbeatSocket({
        callId: callState.callId,
      }).catch(() => {});
    };

    ping();
    callHeartbeatTimerRef.current = setInterval(ping, 25_000);
  }, [callState, stopCallHeartbeat]);
  useEffect(() => {
    const incomingCall = (location.state as IncomingCallRouteState | null)?.incomingCall;
    if (!incomingCall || callState) return;

    const conversationId = normalizeId(incomingCall.conversationId);
    if (!conversationId || conversationId !== activeConversationId) return;
    if (incomingCall.calleeId !== currentUserId) return;

    const callerId = normalizeId(incomingCall.callerId) || conv?.users.find((member) => member._id !== currentUserId)?._id || '';
    const caller = conv?.users.find((member) => member._id === callerId);
    setCallState({
      callId: incomingCall.callId,
      conversationId,
      callToken: incomingCall.callToken,
      callType: incomingCall.callType,
      direction: 'incoming',
      status: 'incoming',
      peerName: caller?.name || caller?.email || 'Người gọi',
      peerId: callerId,
      peerAvatarUrl: caller?.avatar?.url || '',
    });
    startCallTone('incoming');
    navigate(`/chat/${conversationId}`, { replace: true, state: null });
  }, [activeConversationId, callState, conv?.users, currentUserId, location.state, navigate, startCallTone]);

  useEffect(() => {
    if (!callState || callState.direction !== 'incoming') {
      stopCallHeartbeat();
      return;
    }

    if (callState.status === 'incoming') {
      stopCallHeartbeat();
      return;
    }

    startCallHeartbeat();
    return () => stopCallHeartbeat();
  }, [callState, startCallHeartbeat, stopCallHeartbeat]);

  useEffect(() => {
    if (!activeConversationId || !socket) return;

    const onIncomingCall = (data: {
      callId: string;
      callerId: string;
      calleeId: string;
      conversationId: string;
      callType: CallType;
      callToken?: string;
    }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (data.calleeId !== currentUserId) return;
      if (callState) return;

      const caller = conv?.users.find((member) => member._id === data.callerId);
      setCallState({
        callId: data.callId,
        conversationId: data.conversationId,
        callToken: data.callToken,
        callType: data.callType,
        direction: 'incoming',
        status: 'incoming',
        peerName: caller?.name || caller?.email || 'Người gọi',
        peerId: data.callerId,
        peerAvatarUrl: caller?.avatar?.url || '',
      });
      startCallTone('incoming');
    };

      const onCallAccepted = async (data: { callId: string; conversationId: string; callToken?: string; acceptedBySocketId?: string }) => {
        if (!callState || data.callId !== callState.callId) return;
        try {
          if (callState.direction === 'incoming' && data.acceptedBySocketId && getSocket()?.id !== data.acceptedBySocketId) {
            cleanupCall();
            return;
          }

          stopCallTone();
          const stream = callLocalStreamRef.current || await getCallMedia(callState.callType);
          const callToken = data.callToken || callTokenRef.current || callState.callToken;
          if (!callToken) throw new Error('Missing call token');
          const peerConnection = ensurePeerConnection(data.callId, data.conversationId, stream);
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          if (!offer.sdp) throw new Error('Invalid call offer');

          await sendCallOfferSocket({
            callId: data.callId,
            conversationId: data.conversationId,
            callToken,
            offer: { type: 'offer', sdp: offer.sdp },
          });
          setCallState((prev) => (prev ? { ...prev, callToken, status: 'connecting' } : prev));
        } catch (error) {
          toast.error(error instanceof Error ? error.message : 'Không thể tạo kết nối cuộc gọi.');
          cleanupCall();
        }
      };

    const onCallRejected = (data: { callId: string }) => {
      if (callState?.callId !== data.callId) return;
      toast.info('Cuộc gọi đã bị từ chối.');
      cleanupCall();
    };

    const onCallEnded = (data: { callId: string }) => {
      if (callState?.callId !== data.callId) return;
      cleanupCall();
    };

    const onCallClose = (data: {
      callId: string;
      acceptedBySocketId?: string;
      reason?: 'accepted' | 'rejected' | 'ended';
    }) => {
      if (callState?.callId !== data.callId) return;
      if (data.acceptedBySocketId && getSocket()?.id === data.acceptedBySocketId) return;
      cleanupCall();
    };

    const onCallOffer = async (data: {
      callId: string;
      conversationId: string;
      fromUserId: string;
      offer: CallSessionDescription;
    }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!callState || data.callId !== callState.callId || data.fromUserId === currentUserId) return;

      try {
        const stream = callLocalStreamRef.current || await getCallMedia(callState.callType);
        const callToken = callTokenRef.current || callState.callToken;
        if (!callToken) throw new Error('Missing call token');
        const peerConnection = ensurePeerConnection(data.callId, data.conversationId, stream);
        await peerConnection.setRemoteDescription(data.offer);
        await flushPendingIceCandidates();

        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);
        if (!answer.sdp) throw new Error('Invalid call answer');

        await sendCallAnswerSocket({
          callId: data.callId,
          conversationId: data.conversationId,
          callToken,
          answer: { type: 'answer', sdp: answer.sdp },
        });
        setCallState((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể trả lời kết nối cuộc gọi.');
        cleanupCall();
      }
    };

      const onCallAnswer = async (data: {
        callId: string;
        conversationId: string;
        fromUserId: string;
        answer: CallSessionDescription;
      }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!callState || data.callId !== callState.callId || data.fromUserId === currentUserId) return;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection) return;

        try {
          await peerConnection.setRemoteDescription(data.answer);
          await flushPendingIceCandidates();
          setCallState((prev) => (prev ? { ...prev, status: 'connecting' } : prev));
      } catch (error) {
        toast.error(error instanceof Error ? error.message : 'Không thể nhận kết nối cuộc gọi.');
        cleanupCall();
      }
    };

      const onCallIceCandidate = async (data: {
        callId: string;
        conversationId: string;
        fromUserId: string;
        candidate: CallIceCandidate;
      }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!callState || data.callId !== callState.callId || data.fromUserId === currentUserId) return;

      const candidate = data.candidate as RTCIceCandidateInit;
      const peerConnection = peerConnectionRef.current;
      if (!peerConnection?.remoteDescription) {
        pendingIceCandidatesRef.current.push(candidate);
        return;
      }

      try {
        await peerConnection.addIceCandidate(candidate);
      } catch {
        pendingIceCandidatesRef.current.push(candidate);
      }
    };

    socket.on('call:incoming', onIncomingCall);
    socket.on('call:accepted', onCallAccepted);
    socket.on('call:rejected', onCallRejected);
    socket.on('call:ended', onCallEnded);
    socket.on('call:close', onCallClose);
    socket.on('call:offer', onCallOffer);
    socket.on('call:answer', onCallAnswer);
    socket.on('call:ice-candidate', onCallIceCandidate);

    return () => {
      socket.off('call:incoming', onIncomingCall);
      socket.off('call:accepted', onCallAccepted);
      socket.off('call:rejected', onCallRejected);
      socket.off('call:ended', onCallEnded);
      socket.off('call:close', onCallClose);
      socket.off('call:offer', onCallOffer);
      socket.off('call:answer', onCallAnswer);
      socket.off('call:ice-candidate', onCallIceCandidate);
    };
  }, [
    activeConversationId,
    callState,
    cleanupCall,
    conv?.users,
    currentUserId,
    ensurePeerConnection,
    flushPendingIceCandidates,
    getCallMedia,
    getSocket,
    socket,
    startCallTone,
    stopCallTone,
    toast,
  ]);

  useEffect(() => () => stopCallHeartbeat(), [stopCallHeartbeat]);

  useEffect(() => cleanupCall, [activeConversationId, cleanupCall]);

  const handleAcceptRequest = async () => {
    if (!conv) return;
    try {
      await conversationsApi.accept(conv._id);
      const updatedAcceptedBy = [...(conv.acceptedBy || []), currentUserId];
      patchConversation(conv._id, (c) => ({
        ...c,
        acceptedBy: updatedAcceptedBy,
      }));
      setConv((prev) => prev ? { ...prev, acceptedBy: updatedAcceptedBy } : prev);
      // Mark as read now that we've accepted
      const latestMsg = messages.length > 0 ? messages[messages.length - 1] : null;
      if (latestMsg && conv._id) {
        markReadSocket(conv._id, latestMsg._id, () => {
          clearUnread(conv._id);
        });
      }
      toast.success(UI_MESSAGES.chat.acceptConnectionSuccess);
    } catch {
      toast.error(UI_MESSAGES.chat.acceptConnectionFailed);
    }
  };

  const handleBlockRequest = () => {
    if (!otherUser || !conv) return;
    const conversationId = conv._id;
    const targetUserId = otherUser._id;
    setConfirmAction({
      title: 'Chặn người dùng',
      message: UI_MESSAGES.chat.blockConfirm(otherUser.name || ''),
      isDanger: true,
      confirmText: 'Chặn',
      action: async () => {
        try {
          await block({ targetUserId });
          await reloadMessages(conversationId, true);
          refreshSidebarMedia();
          toast.success(UI_MESSAGES.chat.blockSuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.blockFailed);
        }
      }
    });
  };

  const handleUnblockRequest = () => {
    if (!otherUser) return;
    const conversationId = conv?._id || '';
    const targetUserId = otherUser._id;
    setConfirmAction({
      title: 'Bỏ chặn người dùng',
      message: UI_MESSAGES.chat.unblockConfirm(otherUser.name || ''),
      isDanger: false,
      confirmText: 'Bỏ chặn',
      action: async () => {
        try {
          await unblock({ targetUserId });
          if (conversationId) {
            await reloadMessages(conversationId, true);
            refreshSidebarMedia();
          }
          toast.success(UI_MESSAGES.chat.unblockSuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.unblockFailed);
        }
      }
    });
  };

  const handleDeleteRequest = () => {
    if (!conv) return;
    setConfirmAction({
      title: 'Xóa tin nhắn chờ',
      message: UI_MESSAGES.chat.deleteRequestConfirm,
      isDanger: true,
      confirmText: 'Xóa',
      action: async () => {
        try {
          await conversationsApi.hideHistory(conv._id);
          toast.success(UI_MESSAGES.chat.deleteRequestSuccess);
          hasHandledMissingConversationRef.current = true; // Prevent false error toast
          setConversations((prev) => prev.filter((c) => c._id !== conv._id));
          refetchConversations();
          navigate('/message-requests');
        } catch {
          toast.error(UI_MESSAGES.chat.deleteRequestFailed);
        }
      }
    });
  };

  const handleLeaveGroupRequest = () => {
    if (!conv) return;
    setConfirmAction({
      title: 'Rời nhóm',
      message: UI_MESSAGES.chat.leaveGroupConfirm,
      isDanger: true,
      confirmText: 'Rời nhóm',
      action: async () => {
        try {
          isLeavingOrDisbandingRef.current = true;
          await conversationsApi.leaveGroup(conv._id);
          toast.success(UI_MESSAGES.chat.leaveGroupSuccess);
          hasHandledMissingConversationRef.current = true;
          setConversations((prev) => prev.filter((c) => c._id !== conv._id));
          refetchConversations();
          navigate('/message-requests');
        } catch {
          isLeavingOrDisbandingRef.current = false;
          toast.error(UI_MESSAGES.chat.leaveGroupFailed);
        }
      }
    });
  };

  // Tick counter to refresh relative time display every minute
  const [timeTick, setTick] = useState(0);
  useEffect(() => {
    if (conv?.isGroup || isOtherOnline) return;
    const interval = setInterval(() => setTick((t) => t + 1), TIMING.RELATIVE_TIME_REFRESH_MS);
    return () => clearInterval(interval);
  }, [conv?.isGroup, isOtherOnline]);

  const memberSummary = useMemo(() => {
    if (!conv) return '';
    if (isTargetUserDisabled) return '';
    if (isTargetUserBanned) return '';
    if (isBlocked) return ''; // Hide status if blocked
    if (!conv.isGroup) {
      if (isOtherOnline) return 'Đang hoạt động';
      // Show relative time if we have lastOnlineAt
      const lastOnlineValue = otherUser ? online[otherUser._id] : undefined;
      if (typeof lastOnlineValue === 'string' && lastOnlineValue) {
        const diffMs = Date.now() - new Date(lastOnlineValue).getTime();
        if (diffMs < 0 || isNaN(diffMs)) return 'Không hoạt động';
        const diffMin = Math.floor(diffMs / 60_000);
        if (diffMin < 1) return 'Hoạt động vừa xong';
        if (diffMin < 60) return `Hoạt động ${diffMin} phút trước`;
        const diffHour = Math.floor(diffMin / 60);
        if (diffHour < 24) return `Hoạt động ${diffHour} giờ trước`;
        const diffDay = Math.floor(diffHour / 24);
        if (diffDay < 30) return `Hoạt động ${diffDay} ngày trước`;
        return 'Không hoạt động';
      }
      return 'Không hoạt động';
    }

    const onlineCount = conv.users.filter((u) => u._id === currentUserId || online[u._id] === true).length;
    return `Online ${onlineCount}/${conv.users.length}`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, isOtherOnline, otherUser, online, currentUserId, isBlocked, isTargetUserDisabled, isTargetUserBanned, timeTick]);

  const stopVoiceStream = useCallback(() => {
    mediaStreamRef.current?.getTracks().forEach((track) => track.stop());
    mediaStreamRef.current = null;
    mediaRecorderRef.current = null;
  }, []);

  const resetVoiceDraft = useCallback(() => {
    if (voiceUrl) {
      URL.revokeObjectURL(voiceUrl);
    }
    setVoiceBlob(null);
    setVoiceUrl('');
    setVoiceMimeType(MIME_TYPES.WEBM_AUDIO);
  }, [voiceUrl]);

  useEffect(() => () => {
    stopVoiceStream();
    if (voiceUrl) URL.revokeObjectURL(voiceUrl);
  }, [stopVoiceStream, voiceUrl]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | undefined;
    if (isRecordingVoice) {
      setRecordingDuration(0);
      interval = setInterval(() => {
        setRecordingDuration((prev) => prev + 1);
      }, 1000);
    } else {
      setRecordingDuration(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRecordingVoice]);

  const markConversationRead = useCallback((latestMessage?: Message | null) => {
    if (!activeConversationId || !latestMessage) return;
    if (getSenderId(latestMessage) === currentUserId) return;

    markReadSocket(activeConversationId, latestMessage._id, () => {
      clearUnread(activeConversationId);
    });
  }, [activeConversationId, currentUserId, clearUnread]);

  const reloadMessages = useCallback(async (conversationId: string, silent = false) => {
    if (!conversationId) return;
    const requestId = ++messagesRequestIdRef.current;

    if (!silent) {
      setIsLoadingMsgs(true);
    }

    try {
      const res = await messagesApi.getList(conversationId);
      if (messagesRequestIdRef.current !== requestId) return;
      const responseData = (res.data as any)?.data ?? res.data;
      const listRaw = responseData?.messages ?? responseData;
      const cursor = responseData?.nextCursor ?? null;

      const list = normalizeMessages(listRaw);
      const ordered = [...list].reverse();
      setMessages(ordered);
      setLoadedMessagesConversationId(conversationId);
      setHasMore(cursor !== null ? !!cursor : list.length === 20);
      setNextCursor(cursor);
      markConversationRead(ordered[ordered.length - 1]);
    } catch {
      if (!silent) {
        toast.error(UI_MESSAGES.chat.loadMessagesFailed);
      }
    } finally {
      if (messagesRequestIdRef.current !== requestId) return;
      setIsLoadingMsgs(false);
    }
  }, [markConversationRead, toast]);

  const updateConversationReadReceipt = useCallback((userId: string, messageId: string) => {
    setConv((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        readReceipts: {
          ...(prev.readReceipts ?? {}),
          [userId]: messageId,
        },
      };
    });
  }, []);

  const messageIndices = useMemo(() => {
    const map = new Map<string, number>();
    visibleMessages.forEach((m, i) => map.set(m._id, i));
    return map;
  }, [visibleMessages]);

  const getReadersForMessage = useCallback((message: Message) => {
    if (!conv?.readReceipts || message._id.startsWith('opt_')) return [];
    
    const messageIndex = messageIndices.get(message._id);
    if (messageIndex === undefined) return [];

    const readers: string[] = [];
    Object.entries(conv.readReceipts).forEach(([userId, latestReadMsgId]) => {
      if (userId === currentUserId) return;
      
      const readIndex = messageIndices.get(latestReadMsgId);
      if (readIndex !== undefined && readIndex >= messageIndex) {
        readers.push(userId);
      }
    });
    return readers;
  }, [conv, currentUserId, messageIndices]);

  const getReadStatusLabel = useCallback((message: Message) => {
    const readers = getReadersForMessage(message);
    if (readers.length === 0) return 'Đã gửi';
    return 'Đã xem';
  }, [getReadersForMessage]);

  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;

  useEffect(() => {
    hasHandledMissingConversationRef.current = false;
    const requestId = ++conversationRequestIdRef.current;

    if (!activeConversationId) {
      setConv(null);
      setIsLoadingConv(false);
      return;
    }

    // Snapshot from store for initial render (without making store a dependency)
    const syncedConversation = conversationsRef.current.find((item) => item._id === activeConversationId);
    if (syncedConversation) {
      setConv(syncedConversation);
    }

    if (isTempConversation) {
      setIsLoadingConv(false);
      return;
    }

    setIsLoadingConv(true);
    conversationsApi.getOne(activeConversationId)
      .then((res) => {
        if (conversationRequestIdRef.current !== requestId) return;
        const freshConv = normalizeConversation(res.data?.data ?? res.data);
        setConv(freshConv);
        // Sync fresh user data (avatar, name...) back into the sidebar store
        patchConversation(freshConv._id, (prev) => ({ ...prev, users: freshConv.users, avatar: freshConv.avatar }));
      })
      .catch((error) => {
        if (conversationRequestIdRef.current !== requestId) return;
        console.warn('[ChatPage] load conversation failed', error);
        setConv(null);
      })
      .finally(() => {
        if (conversationRequestIdRef.current !== requestId) return;
        setIsLoadingConv(false);
      });
  }, [activeConversationId]);

  useEffect(() => {
    if (!activeConversationId || !hasLoadedConversations || isLoadingConv || conv) return;
    if (hasHandledMissingConversationRef.current) return;

    hasHandledMissingConversationRef.current = true;
    toast.error(UI_MESSAGES.chat.conversationUnavailable);
    navigate('/', { replace: true });
  }, [activeConversationId, conv, hasLoadedConversations, isLoadingConv, navigate, toast]);

  useEffect(() => {
    if (!isMuted && !isTargetUserBanned) return;
    setReplyTarget(null);
    setEditingMessageId(null);
  }, [isMuted, isTargetUserBanned]);

  useEffect(() => {
    if (!activeConversationId || !isSocketConnected || isTempConversation) return;

    joinConversation(activeConversationId)
      .then((result) => {
        const membersOnline = Array.isArray(result?.membersOnline) ? result.membersOnline : [];
        setUsersOnline(membersOnline);
      })
      .catch((err) => {
        console.warn('[ChatPage] join room failed', err.message);
      });
  }, [activeConversationId, isSocketConnected, setUsersOnline]);


  useEffect(() => {
    if (!activeConversationId) {
      setMessages([]);
      setLoadedMessagesConversationId('');
      setIsLoadingMsgs(false);
      prevVisibleLengthRef.current = 0;
      isPrependingRef.current = false;
      return;
    }
    prevVisibleLengthRef.current = 0;
    isPrependingRef.current = false;

    const cached = globalMessagesCache[activeConversationId];
    if (cached) {
      setMessages(cached.messages);
      setHasMore(cached.hasMore);
      setNextCursor(cached.nextCursor);
      setIsLoadingMsgs(false);
      setLoadedMessagesConversationId(activeConversationId);
    } else {
      setIsLoadingMsgs(true);
      setMessages([]);
      setHasMore(true);
      setNextCursor(null);
      setLoadedMessagesConversationId('');
    }

    setReplyTarget(null);
    setEditingMessageId(null);
    setText('');
    setVoiceBlob(null);
    setVoiceUrl('');
    setVoiceMimeType(MIME_TYPES.WEBM_AUDIO);

    if (isTempConversation) {
      setIsLoadingMsgs(false);
      setLoadedMessagesConversationId(activeConversationId);
      return;
    }

    reloadMessages(activeConversationId).catch(() => {});

    clearUnread(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, reloadMessages]);

  // --- SIDEBAR MEDIA LOGIC ---
  useEffect(() => {
    if (activeConversationId) {
      const cached = globalMediaCache[activeConversationId];
      if (cached) {
        setSidebarMedia({
          [MediaResourceTypeEnum.IMAGE]: cached[MediaResourceTypeEnum.IMAGE]?.medias || [],
          [MediaResourceTypeEnum.VIDEO]: cached[MediaResourceTypeEnum.VIDEO]?.medias || [],
          [MediaResourceTypeEnum.FILE]: cached[MediaResourceTypeEnum.FILE]?.medias || [],
        });
        setSidebarMediaCursor({
          [MediaResourceTypeEnum.IMAGE]: cached[MediaResourceTypeEnum.IMAGE]?.nextCursor || null,
          [MediaResourceTypeEnum.VIDEO]: cached[MediaResourceTypeEnum.VIDEO]?.nextCursor || null,
          [MediaResourceTypeEnum.FILE]: cached[MediaResourceTypeEnum.FILE]?.nextCursor || null,
        });
        setSidebarMediaHasMore({
          [MediaResourceTypeEnum.IMAGE]: cached[MediaResourceTypeEnum.IMAGE]?.hasMore || false,
          [MediaResourceTypeEnum.VIDEO]: cached[MediaResourceTypeEnum.VIDEO]?.hasMore || false,
          [MediaResourceTypeEnum.FILE]: cached[MediaResourceTypeEnum.FILE]?.hasMore || false,
        });
        setHasFetchedSidebarMedia({
          [MediaResourceTypeEnum.IMAGE]: !!cached[MediaResourceTypeEnum.IMAGE],
          [MediaResourceTypeEnum.VIDEO]: !!cached[MediaResourceTypeEnum.VIDEO],
          [MediaResourceTypeEnum.FILE]: !!cached[MediaResourceTypeEnum.FILE],
        });
      } else {
        setSidebarMedia({});
        setSidebarMediaCursor({});
        setSidebarMediaHasMore({});
        setHasFetchedSidebarMedia({});
      }
    }
  }, [activeConversationId]);

  const fetchSidebarMedia = useCallback(async (type: MediaResourceTypeEnum, isLoadMore = false, forceRefetch = false) => {
    if (!activeConversationId || isTempConversation) return;
    if (isLoadingSidebarMedia[type]) return;
    if (isLoadMore && !sidebarMediaHasMore[type]) return;
    if (!isLoadMore && !forceRefetch && hasFetchedSidebarMedia[type]) return;

    setIsLoadingSidebarMedia((prev) => ({ ...prev, [type]: true }));
    const cursor = isLoadMore ? sidebarMediaCursor[type] : null;

    try {
      const res = await mediaApi.getListByConversation(activeConversationId, type, cursor);
      const responseData = (res.data as any)?.data ?? res.data;
      const fetchedMedias = responseData?.medias ?? responseData ?? [];
      const nextCursor = responseData?.nextCursor ?? null;

      setSidebarMedia((prev) => {
        const existing = isLoadMore ? (prev[type] || []) : [];
        const fetchedIds = new Set(fetchedMedias.map((m: any) => m._id));
        const unmergedAppended = !isLoadMore ? (prev[type] || []).filter((m) => !fetchedIds.has(m._id)) : [];
        const updated = [...existing, ...unmergedAppended, ...fetchedMedias];
        
        if (!globalMediaCache[activeConversationId]) globalMediaCache[activeConversationId] = {};
        globalMediaCache[activeConversationId]![type] = {
          medias: updated,
          nextCursor,
          hasMore: !!nextCursor,
        };

        return { ...prev, [type]: updated };
      });
      setSidebarMediaCursor((prev) => ({ ...prev, [type]: nextCursor }));
      setSidebarMediaHasMore((prev) => ({ ...prev, [type]: !!nextCursor }));
      setHasFetchedSidebarMedia((prev) => ({ ...prev, [type]: true }));
    } catch (err) {
      console.warn(`Failed to load ${type} media`, err);
      if (!isLoadMore) {
        setSidebarMedia((prev) => ({ ...prev, [type]: prev[type] || [] }));
      }
    } finally {
      setIsLoadingSidebarMedia((prev) => ({ ...prev, [type]: false }));
    }
  }, [activeConversationId, sidebarMedia, sidebarMediaCursor, sidebarMediaHasMore, isLoadingSidebarMedia, hasFetchedSidebarMedia]);

  const appendSidebarMedia = useCallback((message: Message) => {
    if (!message.media || typeof message.media === 'string') return;
    
    const mediaObj = message.media as any;
    
    let type = mediaObj.resourceType as MediaResourceTypeEnum;
    if (!type || (type as any) === 'voice') {
      const mime = mediaObj.mimeType || '';
      type = MediaResourceTypeEnum.FILE;
      if (mime.startsWith('image/')) type = MediaResourceTypeEnum.IMAGE;
      else if (mime.startsWith('video/')) type = MediaResourceTypeEnum.VIDEO;
      else if (mime.startsWith('audio/')) type = MediaResourceTypeEnum.FILE;
    }
    
    setSidebarMedia((prev) => {
      const existing = prev[type] || [];
      if (existing.some((m) => m._id === mediaObj._id)) return prev;

      const newMedia = {
        _id: mediaObj._id,
        url: mediaObj.url || '',
        fileName: mediaObj.fileName,
        mimeType: mediaObj.mimeType,
        size: mediaObj.size,
        publicId: mediaObj.publicId,
        resourceType: type,
        owner: typeof message.sender === 'object' ? message.sender._id : message.sender,
        conversation: message.conversationId,
        createdAt: message.createdAt,
      } as any;

      return { ...prev, [type]: [newMedia, ...existing] };
    });
  }, []);

  const removeSidebarMedia = useCallback((mediaId: string) => {
    setSidebarMedia((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((type) => {
        const t = type as MediaResourceTypeEnum;
        if (next[t]) {
          const filtered = next[t]!.filter((m) => m._id !== mediaId);
          if (filtered.length !== next[t]!.length) {
            next[t] = filtered;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const refreshSidebarMedia = useCallback(() => {
    if (!activeConversationId) return;
    delete globalMediaCache[activeConversationId];
    setSidebarMedia({});
    setSidebarMediaCursor({});
    setSidebarMediaHasMore({});
    setHasFetchedSidebarMedia({});
    
    if (isImagesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.IMAGE, false, true);
    if (isVideosExpanded) fetchSidebarMedia(MediaResourceTypeEnum.VIDEO, false, true);
    if (isFilesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.FILE, false, true);
  }, [activeConversationId, isImagesExpanded, isVideosExpanded, isFilesExpanded, fetchSidebarMedia]);

  useEffect(() => {
    if (isImagesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.IMAGE);
  }, [isImagesExpanded, fetchSidebarMedia]);

  useEffect(() => {
    if (isVideosExpanded) fetchSidebarMedia(MediaResourceTypeEnum.VIDEO);
  }, [isVideosExpanded, fetchSidebarMedia]);

  useEffect(() => {
    if (isFilesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.FILE);
  }, [isFilesExpanded, fetchSidebarMedia]);
  // ---------------------------

  useEffect(() => {
    if (!activeConversationId || !socket) return;

    const onNewMessage = (rawMessage: any) => {
      const message = normalizeMessage(rawMessage);
      if (normalizeId(message.conversationId) !== activeConversationId) return;

      setMessages((prev) => {
        const existedIndex = prev.findIndex((item) => item._id === message._id);
        if (existedIndex !== -1) {
          const next = [...prev];
          next[existedIndex] = { ...next[existedIndex], ...message, _error: false };
          return next;
        }

        const optimisticIndex = prev.findIndex((item) => isLikelyOptimisticMatch(item, message, currentUserId));
        if (optimisticIndex !== -1) {
          const next = [...prev];
          next[optimisticIndex] = { ...message, _error: false };
          return next;
        }

        return [...prev, message];
      });

      appendSidebarMedia(message);

      if (getSenderId(message) !== currentUserId) {
        if (document.hasFocus()) {
          markConversationRead(message);
        }
      }
    };

    const onMessageUpdated = (rawMessage: any) => {
      const message = normalizeMessage(rawMessage);
      if (normalizeId(message.conversationId) !== activeConversationId) return;
      setMessages((prev) => prev.map((item) => (item._id === message._id ? { ...item, ...message } : item)));
      if (editingMessageId === message._id) {
        setEditingMessageId(null);
        setText('');
      }
    };

    const onMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      setMessages((prev) => {
        const target = prev.find((m) => m._id === data.messageId);
        if (target && target.media) {
          const mediaId = typeof target.media === 'object' ? target.media._id : target.media;
          removeSidebarMedia(mediaId);
        }
        return prev.map((item) => {
          let updatedItem = item;
          if (item._id === data.messageId) {
            updatedItem = {
              ...item,
              isDeleted: true,
              content: '',
              reactions: [],
            };
          } else if (typeof item.replyTo === 'object' && item.replyTo?._id === data.messageId) {
            updatedItem = {
              ...item,
              replyTo: {
                ...item.replyTo,
                isDeleted: true,
                content: '',
              }
            };
          }
          return updatedItem;
        });
      });
      if (replyTarget?._id === data.messageId) {
        setReplyTarget(null);
      }
      if (editingMessageId === data.messageId) {
        setEditingMessageId(null);
        setText('');
      }
    };

    const onMarkRead = (data: { conversationId: string; userId: string; messageId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      updateConversationReadReceipt(data.userId, data.messageId);
    };

    const onConversationNameChanged = (data: { conversationId: string; name: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      setConv((prev) => (prev ? { ...prev, name: data.name } : prev));
    };

    const onMemberAdded = (data: { conversationId: string; addedMemberIds: string[] }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      refetchConversations();
    };

    const onMemberRemoved = (data: { conversationId: string; removedMemberId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (data.removedMemberId === currentUserId) {
        if (!isLeavingOrDisbandingRef.current) {
          toast.error(UI_MESSAGES.chat.removedFromConversation);
        }
        navigate('/', { replace: true });
        return;
      }
      // Update local state to remove the user who left
      setConv((prev) => {
        if (!prev) return prev;
        return { ...prev, users: prev.users.filter((u) => u._id !== data.removedMemberId) };
      });
      // Also update the global list if needed
      refetchConversations();
    };

    const onConversationDisbanded = (data: { conversationId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!isLeavingOrDisbandingRef.current) {
        toast.error(UI_MESSAGES.chat.groupDissolved);
      }
      navigate('/', { replace: true });
    };

    const onAdminChanged = (data: { conversationId: string; newAdminId: string }) => {
      const convId = normalizeId(data.conversationId);
      if (convId === activeConversationId) {
        setConv((prev) => (prev ? { ...prev, adminGroupId: data.newAdminId } : prev));
      }
      patchConversation(convId, (prev) => ({ ...prev, adminGroupId: data.newAdminId }));
      refetchConversations();
    };

    const onMessagePinned = (data: { conversationId: string; messageId: string }) => {
      const convId = normalizeId(data.conversationId);
      if (convId !== activeConversationId) return;

      setMessages((prev) => {
        const msg = prev.find((m) => m._id === data.messageId);
        if (msg) {
          setConv((c) => (c ? { ...c, pinMessage: msg } : c));
          patchConversation(convId, (c) => ({ ...c, pinMessage: msg }));
        } else {
          conversationsApi.getOne(convId).then((res) => {
            const updatedConv = normalizeConversation(res.data?.data ?? res.data);
            setConv(updatedConv);
            patchConversation(convId, () => updatedConv);
          }).catch(() => {});
        }
        return prev;
      });
    };

    const onMessageUnpinned = (data: { conversationId: string; messageId: string }) => {
      const convId = normalizeId(data.conversationId);
      if (convId !== activeConversationId) return;
      
      setConv((c) => (c ? { ...c, pinMessage: undefined } : c));
      patchConversation(convId, (c) => ({ ...c, pinMessage: undefined }));
    };

    const onRelationshipChanged = () => {
      void reloadMessages(activeConversationId, true);
      refreshSidebarMedia();
    };

    socket.on('chat:new-message', onNewMessage);
    socket.on('message:updated', onMessageUpdated);
    socket.on('chat:message-deleted', onMessageDeleted);
    socket.on('user:mark-read', onMarkRead);
    socket.on('conversation:name-changed', onConversationNameChanged);
    socket.on('conversation:member-added', onMemberAdded);
    socket.on('conversation:member-removed', onMemberRemoved);
    socket.on('conversation:disbanded', onConversationDisbanded);
    socket.on('conversation:admin-changed', onAdminChanged);
    socket.on('message:pinned', onMessagePinned);
    socket.on('message:unpinned', onMessageUnpinned);
    socket.on('relationship:blocked', onRelationshipChanged);
    socket.on('relationship:unblocked', onRelationshipChanged);

    return () => {
      socket.off('chat:new-message', onNewMessage);
      socket.off('message:updated', onMessageUpdated);
      socket.off('chat:message-deleted', onMessageDeleted);
      socket.off('user:mark-read', onMarkRead);
      socket.off('conversation:name-changed', onConversationNameChanged);
      socket.off('conversation:member-added', onMemberAdded);
      socket.off('conversation:member-removed', onMemberRemoved);
      socket.off('conversation:disbanded', onConversationDisbanded);
      socket.off('conversation:admin-changed', onAdminChanged);
      socket.off('message:pinned', onMessagePinned);
      socket.off('message:unpinned', onMessageUnpinned);
      socket.off('relationship:blocked', onRelationshipChanged);
      socket.off('relationship:unblocked', onRelationshipChanged);
    };
  }, [
    activeConversationId,
    editingMessageId,
    replyTarget?._id,
    socket,
    currentUserId,
    markConversationRead,
    navigate,
    toast,
    updateConversationReadReceipt,
    appendSidebarMedia,
    removeSidebarMedia,
    refreshSidebarMedia,
    reloadMessages,
  ]);

  // Handle window focus to mark conversation as read
  useEffect(() => {
    const handleFocus = () => {
      if (!activeConversationId || visibleMessages.length === 0) return;
      const latestMsg = visibleMessages[visibleMessages.length - 1];
      if (getSenderId(latestMsg) !== currentUserId) {
        markConversationRead(latestMsg);
      }
    };

    window.addEventListener('focus', handleFocus);
    return () => window.removeEventListener('focus', handleFocus);
  }, [activeConversationId, visibleMessages, currentUserId, markConversationRead]);

  // Scroll to bottom only on first load of a conversation or new messages sent/received.
  // NOT when prepending older messages (handled separately below).
  const prevVisibleLengthRef = useRef(0);
  useEffect(() => {
    if (isPrependingRef.current) {
      // After prepend: restore scroll position so user stays at where they were
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight - prevScrollHeightRef.current;
      }
      isPrependingRef.current = false;
      prevVisibleLengthRef.current = visibleMessages.length;
      return;
    }

    // Scroll to bottom when loading fresh conversation or new message appended
    const prevLen = prevVisibleLengthRef.current;
    const currLen = visibleMessages.length;
    prevVisibleLengthRef.current = currLen;

    // If count decreased (e.g. switched conversation) or jumped a lot → scroll to bottom
    if (currLen === 0) return;
    
    if (prevLen === 0) {
      const container = messagesContainerRef.current;
      if (container) {
        container.scrollTop = container.scrollHeight;
      }
    } else {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [visibleMessages.length]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isFetchingMore || !hasMore || visibleMessages.length === 0 || !activeConversationId) return;
    
    // Do not fetch more if we haven't finished the initial scroll
    if (prevVisibleLengthRef.current === 0) return;
    
    if (container.scrollTop > 60) return;

    const oldest = visibleMessages[0];
    if (!oldest) return;

    // Snapshot scroll height BEFORE prepending, so we can restore position after
    prevScrollHeightRef.current = container.scrollHeight;
    isPrependingRef.current = true;

    setIsFetchingMore(true);
    messagesApi.getList(activeConversationId, nextCursor || oldest.createdAt)
      .then((res) => {
        const responseData = (res.data as any)?.data ?? res.data;
        const listRaw = responseData?.messages ?? responseData;
        const cursor = responseData?.nextCursor ?? null;

        const older = normalizeMessages(listRaw);
        if (older.length < 20 && cursor === null) setHasMore(false);
        setNextCursor(cursor);
        setMessages((prev) => [...older.reverse(), ...prev]);
      })
      .catch(() => { isPrependingRef.current = false; })
      .finally(() => setIsFetchingMore(false));
  }, [activeConversationId, hasMore, isFetchingMore, visibleMessages]);

  const scheduleTypingStop = useCallback(() => {
    if (!activeConversationId) return;
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      stopTyping(activeConversationId);
    }, 3000);
  }, [activeConversationId]);

  const handleTextChange = (value: string) => {
    if (isMuted) return;
    setText(value);
    if (activeConversationId && socket?.connected) {
      if (!value.trim()) {
        stopTyping(activeConversationId);
        return;
      }
      startTyping(activeConversationId);
      scheduleTypingStop();
    }
  };

  const handleComposerChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    const cursor = event.target.selectionStart ?? value.length;
    const beforeCursor = value.slice(0, cursor);
    const triggerIndex = beforeCursor.lastIndexOf('@');
    const query = triggerIndex >= 0 ? beforeCursor.slice(triggerIndex + 1) : '';
    const isActive = triggerIndex >= 0 && !/[\s\[\]@]/.test(query) && triggerIndex !== suppressHighlightTriggerIndex;

    if (triggerIndex === -1 || triggerIndex !== suppressHighlightTriggerIndex) {
      setSuppressHighlightTriggerIndex(null);
    }

    setShowHighlightMenu(isActive);
    handleTextChange(value);
  };

  const insertHighlightToken = () => {
    const input = inputRef.current;
    if (!input || isMuted || isTempConversation) return;

    const start = input.selectionStart ?? text.length;
    const end = input.selectionEnd ?? text.length;
    const token = '@[[  ]]';
    const atIndex = text.lastIndexOf('@', start - 1);
    const replaceStart = atIndex >= 0 ? atIndex : start;
    const nextValue = `${text.slice(0, replaceStart)}${token}${text.slice(end)}`;
    const cursorPos = replaceStart + 4;

    setText(nextValue);
    setShowHighlightMenu(false);
    setSuppressHighlightTriggerIndex(null);
    requestAnimationFrame(() => {
      input.focus();
      input.setSelectionRange(cursorPos, cursorPos);
    });
  };

  const replaceOptimisticMessage = useCallback((optimisticId: string, nextMessage: Message) => {
    setMessages((prev) => prev.map((item) => (
      item._id === optimisticId ? { ...nextMessage, _error: false } : item
    )));
    appendSidebarMedia(nextMessage);
  }, [appendSidebarMedia]);

  const replaceMessageLocally = useCallback((messageId: string, updater: (message: LocalMessage) => LocalMessage) => {
    setMessages((prev) => prev.map((item) => (
      item._id === messageId ? updater(item) : item
    )));
  }, []);

  const markMessageError = useCallback((optimisticId: string) => {
    setMessages((prev) => prev.map((item) => (
      item._id === optimisticId ? { ...item, _error: true } : item
    )));
  }, []);

  const handleReplyReferenceClick = useCallback((message: Message) => {
    const targetId = typeof message.replyTo === 'object'
      ? message.replyTo?._id
      : message.replyTo;
    const normalizedTargetId = normalizeId(targetId);
    if (!normalizedTargetId) return;

    const target = messageRefs.current[normalizedTargetId];
    if (!target) return;

    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
      highlightTimerRef.current = null;
    }

    setHighlightedMessageId(null);
    setPendingHighlightMessageId(normalizedTargetId);
    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, []);

  useEffect(() => () => {
    if (highlightTimerRef.current) {
      clearTimeout(highlightTimerRef.current);
    }
  }, []);

  useEffect(() => {
    if (!pendingHighlightMessageId) return;

    const target = messageRefs.current[pendingHighlightMessageId];
    const container = messagesContainerRef.current;
    if (!target || !container) return;

    const observer = new IntersectionObserver(([entry]) => {
      if (!entry.isIntersecting) return;

      setHighlightedMessageId(pendingHighlightMessageId);
      setPendingHighlightMessageId(null);
      observer.disconnect();

      if (highlightTimerRef.current) {
        clearTimeout(highlightTimerRef.current);
      }
      highlightTimerRef.current = setTimeout(() => {
        setHighlightedMessageId((current) => (current === pendingHighlightMessageId ? null : current));
        highlightTimerRef.current = null;
      }, 1600);
    }, {
      root: container,
      threshold: 0.7,
    });

    observer.observe(target);

    return () => observer.disconnect();
  }, [pendingHighlightMessageId]);

  const handleSend = async () => {
    if (isMuted) return;
    const content = text.trim();
    if (!content || !activeConversationId) return;
    setShowHighlightMenu(false);

    if (editingMessageId) {
      replaceMessageLocally(editingMessageId, (message) => ({
        ...message,
        content,
        updatedAt: new Date().toISOString(),
      }));
      updateTextMessage(activeConversationId, editingMessageId, content, (ack: any) => {
        if (!ack?.ok) {
          toast.error(ack?.message || UI_MESSAGES.chat.editMessageFailed);
          return;
        }

        setEditingMessageId(null);
        setText('');
      });
      return;
    }

    const activeReplyTarget = replyTarget;
    const optimisticId = `opt_${Date.now()}`;
    const optimisticMessage: LocalMessage = {
      _id: optimisticId,
      conversationId: activeConversationId,
      sender: currentUserId,
      type: 'text',
      content,
      isDeleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      replyTo: activeReplyTarget || undefined,
      reactions: [],
    };

    setText('');
    setReplyTarget(null);
    setEditingMessageId(null);
    setMessages((prev) => [...prev, optimisticMessage]);

    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    stopTyping(activeConversationId);

    if (socket?.connected) {
      sendTextMessage(activeConversationId, content, typeof activeReplyTarget?._id === 'string' ? activeReplyTarget._id : undefined, (ack: any) => {
        if (ack?.ok && ack?.data?.message) {
          const createdMessage = normalizeMessage(ack.data.message);
          replaceOptimisticMessage(optimisticId, createdMessage);
          syncConversationMessage(createdMessage, { markUnread: false });
          return;
        }

        messagesApi.sendText(activeConversationId, content, activeReplyTarget?._id)
          .then((res) => {
            const createdMessage = normalizeMessage(res.data?.data ?? res.data);
            replaceOptimisticMessage(optimisticId, createdMessage);
            syncConversationMessage(createdMessage, { markUnread: false });
          })
          .catch(() => {
            markMessageError(optimisticId);
            toast.error(UI_MESSAGES.chat.sendMessageFailed);
          });
      });
      return;
    }

    try {
      const res = await messagesApi.sendText(activeConversationId, content, activeReplyTarget?._id);
      const createdMessage = normalizeMessage(res.data?.data ?? res.data);
      replaceOptimisticMessage(optimisticId, createdMessage);
      syncConversationMessage(createdMessage, { markUnread: false });
    } catch {
      markMessageError(optimisticId);
      toast.error(UI_MESSAGES.chat.sendMessageFailed);
    }
  };

  const sendMediaMessage = async (type: 'image' | 'video' | 'file' | 'voice', file: File) => {
    if (!activeConversationId) return;
    const activeReplyTarget = replyTarget;
    const optimisticId = `opt_${type}_${Date.now()}`;
    const previewUrl = ['image', 'video', 'voice'].includes(type) ? URL.createObjectURL(file) : '';
    const optimisticMessage: LocalMessage = {
      _id: optimisticId,
      conversationId: activeConversationId,
      sender: currentUserId,
      type,
      content: '',
      media: {
        _id: `${optimisticId}_media`,
        url: previewUrl || undefined,
        fileName: file.name,
        mimeType: file.type,
        size: file.size,
      },
      replyTo: activeReplyTarget || undefined,
      isDeleted: false,
      reactions: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, optimisticMessage]);
    setReplyTarget(null);

    try {
      const response = await (type === 'image'
        ? messagesApi.sendImage(activeConversationId, file, activeReplyTarget?._id)
        : type === 'video'
          ? messagesApi.sendVideo(activeConversationId, file, activeReplyTarget?._id)
          : type === 'voice'
            ? messagesApi.sendVoice(activeConversationId, file, activeReplyTarget?._id)
            : messagesApi.sendFile(activeConversationId, file, activeReplyTarget?._id));

      const createdMessage = normalizeMessage(response.data?.data ?? response.data);
      replaceOptimisticMessage(optimisticId, createdMessage);
      syncConversationMessage(createdMessage, { markUnread: false });
    } catch (error: any) {
      markMessageError(optimisticId);
      toast.error(error?.response?.data?.message || UI_MESSAGES.chat.sendMediaFailed);
    } finally {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    }
  };

  const handleFileChange = async (
    event: React.ChangeEvent<HTMLInputElement>,
    type: 'image' | 'video' | 'file'
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    await sendMediaMessage(type, file);
    event.target.value = '';
  };

  const handleToggleReaction = async (message: Message, reactionType: string) => {
    if (!activeConversationId) return;
    const myReaction = message.reactions?.find((reaction) => reaction.userId === currentUserId)?.type;
    const isRemoving = myReaction === reactionType;

    // Optimistic UI update
    replaceMessageLocally(message._id, (currentMessage) => {
      const reactions = currentMessage.reactions ? [...currentMessage.reactions] : [];
      const newReactions = reactions.filter((r) => r.userId !== currentUserId);
      if (!isRemoving) {
        newReactions.push({ userId: currentUserId, type: reactionType });
      }
      return { ...currentMessage, reactions: newReactions };
    });

    try {
      if (isRemoving) {
        await messagesApi.removeReaction(message._id, activeConversationId);
      } else {
        await messagesApi.addReaction(message._id, activeConversationId, reactionType);
      }
    } catch (error: any) {
      // Revert on error
      replaceMessageLocally(message._id, (currentMessage) => ({
        ...currentMessage,
        reactions: message.reactions,
      }));
      toast.error(error?.response?.data?.message || UI_MESSAGES.chat.updateReactionFailed);
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message._id);
    setReplyTarget(null);
    setText(message.content || '');
  };

  const handleDeleteMessage = (message: Message) => {
    if (!activeConversationId) return;

    setConfirmAction({
      title: 'Thu hồi tin nhắn với mọi người',
      message: UI_MESSAGES.chat.revokeMessageConfirm,
      isDanger: true,
      confirmText: 'Thu hồi',
      action: () => {
        replaceMessageLocally(message._id, (currentMessage) => ({
          ...currentMessage,
          isDeleted: true,
          content: '',
          reactions: [],
          updatedAt: new Date().toISOString(),
        }));
        if (replyTarget?._id === message._id) {
          setReplyTarget(null);
        }
        if (editingMessageId === message._id) {
          setEditingMessageId(null);
          setText('');
        }

        revokeMessage(activeConversationId, message._id, (ack: any) => {
          if (!ack?.ok) {
            replaceMessageLocally(message._id, () => ({ ...message }));
            toast.error(ack?.message || UI_MESSAGES.chat.revokeMessageFailed);
          }
        });
      }
    });
  };

  const handlePinMessage = async (message: Message) => {
    if (!activeConversationId) return;
    const previousPin = conv?.pinMessage;
    
    setConv((prev) => prev ? { ...prev, pinMessage: message } : prev);
    patchConversation(activeConversationId, (prev) => ({ ...prev, pinMessage: message }));
    
    try {
      await conversationsApi.pinMessage(activeConversationId, message._id);
    } catch (error: any) {
      setConv((prev) => prev ? { ...prev, pinMessage: previousPin } : prev);
      patchConversation(activeConversationId, (prev) => ({ ...prev, pinMessage: previousPin }));
      toast.error(error?.response?.data?.message || 'Ghim tin nhắn thất bại');
    }
  };

  const handleUnpinMessage = async (message: Message) => {
    if (!activeConversationId) return;
    const previousPin = conv?.pinMessage;
    
    setConv((prev) => prev ? { ...prev, pinMessage: undefined } : prev);
    patchConversation(activeConversationId, (prev) => ({ ...prev, pinMessage: undefined }));
    
    try {
      await conversationsApi.unpinMessage(activeConversationId, message._id);
    } catch (error: any) {
      setConv((prev) => prev ? { ...prev, pinMessage: previousPin } : prev);
      patchConversation(activeConversationId, (prev) => ({ ...prev, pinMessage: previousPin }));
      toast.error(error?.response?.data?.message || 'Bỏ ghim tin nhắn thất bại');
    }
  };

  const startVoiceRecording = async () => {
    if (!activeConversationId) {
      toast.error(UI_MESSAGES.chat.recordRequiresConversation);
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error(UI_MESSAGES.chat.browserNoRecordingSupport);
      return;
    }

    resetVoiceDraft();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      mediaChunksRef.current = [];
      isCancelledVoiceRef.current = false;
      setVoiceMimeType(recorder.mimeType || 'audio/webm');
      setIsRecordingVoice(true);

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        setIsRecordingVoice(false);
        stopVoiceStream();
        
        if (isCancelledVoiceRef.current) {
          return;
        }

        const blob = new Blob(mediaChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          const nextUrl = URL.createObjectURL(blob);
          setVoiceBlob(blob);
          setVoiceUrl(nextUrl);
        }
      }, { once: true });

      recorder.start();
    } catch {
      setIsRecordingVoice(false);
      stopVoiceStream();
      toast.error(UI_MESSAGES.chat.cannotEnableMicrophone);
    }
  };

  const stopVoiceRecording = () => {
    mediaRecorderRef.current?.stop();
  };

  const cancelVoiceRecording = () => {
    mediaChunksRef.current = [];
    mediaRecorderRef.current?.stop();
  };

  const handleSendVoice = async () => {
    if (isMuted || !voiceBlob) return;
    const file = new File(
      [voiceBlob],
      `voice-${Date.now()}.${getVoiceFileExtension(voiceMimeType)}`,
      { type: voiceMimeType },
    );
    await sendMediaMessage('voice', file);
    resetVoiceDraft();
  };

  // ===== Group Management Handlers =====
  const isGroupAdmin = !!(conv?.isGroup && conv.adminGroupId === currentUserId);

  const handleUploadGroupAvatar = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeConversationId) return;
    setIsUploadingAvatar(true);
    try {
      const res = await conversationsApi.uploadAvatar(activeConversationId, file);
      const updated = normalizeConversation(res.data?.data ?? res.data);
      setConv(updated);
      toast.success(UI_MESSAGES.chat.updateGroupAvatarSuccess);
    } catch {
      toast.error(UI_MESSAGES.chat.updateGroupAvatarFailed);
    } finally {
      setIsUploadingAvatar(false);
      if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = '';
    }
  };

  const handleDeleteGroupAvatar = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa ảnh đại diện nhóm',
      message: UI_MESSAGES.chat.deleteGroupAvatarConfirm,
      isDanger: true,
      action: () => {
        setConfirmAction(null);
        (async () => {
          setIsUploadingAvatar(true);
          try {
            await conversationsApi.deleteAvatar(activeConversationId);
            setConv((prev) => prev ? { ...prev, avatar: undefined } : prev);
            toast.success(UI_MESSAGES.chat.deleteGroupAvatarSuccess);
          } catch {
            toast.error(UI_MESSAGES.chat.deleteGroupAvatarFailed);
          } finally {
            setIsUploadingAvatar(false);
          }
        })();
      }
    });
  };

  const handleUpdateGroupName = async () => {
    if (!activeConversationId || !groupNameInput.trim()) return;
    try {
      await conversationsApi.updateName(activeConversationId, groupNameInput.trim());
      setConv((prev) => prev ? { ...prev, name: groupNameInput.trim() } : prev);
      setEditingGroupName(false);
      toast.success(UI_MESSAGES.chat.updateGroupNameSuccess);
    } catch {
      toast.error(UI_MESSAGES.chat.updateGroupNameFailed);
    }
  };

  const handleLeaveGroup = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Rời nhóm',
      message: UI_MESSAGES.chat.leaveGroupConfirm,
      isDanger: true,
      confirmText: 'Rời nhóm',
      action: async () => {
        isLeavingOrDisbandingRef.current = true;
        try {
          await conversationsApi.leaveGroup(activeConversationId);
          navigate('/', { replace: true });
          toast.success(UI_MESSAGES.chat.leaveGroupSuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.leaveGroupFailed);
        }
      }
    });
  };

  const handleDisbandGroup = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Giải tán nhóm',
      message: UI_MESSAGES.chat.dissolveGroupConfirm,
      isDanger: true,
      confirmText: 'Giải tán',
      action: async () => {
        isLeavingOrDisbandingRef.current = true;
        try {
          await conversationsApi.disbandGroup(activeConversationId);
          navigate('/', { replace: true });
          toast.success(UI_MESSAGES.chat.dissolveGroupSuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.dissolveGroupFailed);
        }
      }
    });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa thành viên',
      message: UI_MESSAGES.chat.removeMemberConfirm(memberName),
      isDanger: true,
      confirmText: 'Xóa khỏi nhóm',
      action: async () => {
        try {
          await conversationsApi.removeMember(activeConversationId, memberId);
          setConv((prev) => prev ? { ...prev, users: prev.users.filter(u => u._id !== memberId) } : prev);
          toast.success(UI_MESSAGES.chat.removeMemberSuccess(memberName));
        } catch {
          toast.error(UI_MESSAGES.chat.removeMemberFailed);
        }
      }
    });
  };

  const handleChangeAdminStep2 = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xác nhận chuyển quyền',
      message: UI_MESSAGES.chat.transferAdminConfirm(memberName),
      isDanger: true,
      confirmText: 'Chuyển quyền',
      countdown: 5,
      action: async () => {
        try {
          await conversationsApi.changeAdmin(activeConversationId, memberId);
          setConv((prev) => prev ? { ...prev, adminGroupId: memberId } : prev);
          toast.success(UI_MESSAGES.chat.transferAdminSuccess(memberName));
        } catch {
          toast.error(UI_MESSAGES.chat.transferAdminFailed);
        }
      }
    });
  };

  const handleChangeAdmin = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Chuyển quyền quản trị',
      message: UI_MESSAGES.chat.transferAdminConfirmSecondary(memberName),
      isDanger: true,
      confirmText: 'Tiếp tục',
      action: () => {
        handleChangeAdminStep2(memberId, memberName);
        return false;
      }
    });
  };

  const handleHideHistory = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa lịch sử chat',
      message: UI_MESSAGES.chat.deleteChatHistoryConfirm,
      isDanger: true,
      confirmText: 'Xóa lịch sử',
      action: async () => {
        try {
          await conversationsApi.hideHistory(activeConversationId);
          void refetchConversations({ silent: true });
          navigate('/', { replace: true });
          toast.success(UI_MESSAGES.chat.deleteChatHistorySuccess);
        } catch {
          toast.error(UI_MESSAGES.chat.deleteChatHistoryFailed);
        }
      }
    });
  };

  const lastMyMessageId = useMemo(() => {
    for (let i = visibleMessages.length - 1; i >= 0; i--) {
      if (getSenderId(visibleMessages[i]) === currentUserId) {
        return visibleMessages[i]._id;
      }
    }
    return null;
  }, [visibleMessages, currentUserId]);

  useEffect(() => {
    if (activeConversationId && loadedMessagesConversationId === activeConversationId) {
      globalMessagesCache[activeConversationId] = { messages, hasMore, nextCursor };
    }
  }, [messages, hasMore, nextCursor, activeConversationId, loadedMessagesConversationId]);

  return (
    <div className="chat-page-layout">
      <div className="chat-page">
      <div className="chat-header">
          <div className="chat-header-info">
          <button 
            className="icon-btn mobile-back-btn" 
            onClick={() => navigate('/')}
            title="Quay lại"
            style={{ marginRight: '8px' }}
          >
            <ChevronLeft size={20} />
          </button>
          <div className="chat-header-avatar" style={isTargetUserDisabled ? { background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}}>
            {isTargetUserDisabled ? (
              <UserX size={20} style={{ color: 'var(--text-muted)' }} />
            ) : headerAvatarUrl ? (
              <img src={headerAvatarUrl} alt={convName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span>{convName.slice(0, 2).toUpperCase()}</span>
            )}
            {isOtherOnline && !isTargetUserDisabled && !isBlocked && <span className="online-dot" style={{ position: 'absolute', bottom: 1, right: 1 }} />}
          </div>
          <div style={{ minWidth: 0, flex: 1 }}>
            <div className="chat-header-name">{convName}</div>
            {(isLoadingConv || memberSummary) && (
              <div 
                className="chat-header-sub"
                style={{
                  cursor: conv?.isGroup ? 'pointer' : 'default',
                  userSelect: 'none',
                }}
                onClick={() => {
                  if (conv?.isGroup) setShowOnlineModal(true);
                }}
                title={conv?.isGroup ? "Nhấp để xem ai đang online" : ""}
              >
                {isLoadingConv ? '...' : memberSummary}
              </div>
            )}
          </div>
        </div>

        {!isMessageRequest && (
          <div className="chat-header-actions">
            {canStartDirectCall && (
              <>
                <button
                  className="icon-btn"
                  title="Gọi thoại"
                  onClick={() => void handleStartCall('audio')}
                  disabled={!!callState}
                >
                  <Phone size={18} />
                </button>
                <button
                  className="icon-btn"
                  title="Video call"
                  onClick={() => void handleStartCall('video')}
                  disabled={!!callState}
                >
                  <Video size={18} />
                </button>
              </>
            )}
            <button className={`icon-btn${showInfo ? ' active' : ''}`} title="Thông tin hội thoại" onClick={() => setShowInfo((v) => !v)}>
              <Info size={18} />
            </button>
          </div>
        )}
      </div>

      {pinnedMessage && (
        <div
          className="pinned-message-banner"
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(168,85,247,0.12))',
            borderBottom: '1px solid rgba(99,102,241,0.15)',
            padding: '6px 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
            <button
              type="button"
              onClick={() => setSelectedPinnedMessage(pinnedMessage)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                minWidth: 0,
                flex: 1,
                border: 'none',
                background: 'transparent',
                padding: 0,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <div style={{
                width: 32,
                height: 32,
                borderRadius: '50%',
                background: 'rgba(99,102,241,0.16)',
                color: 'var(--accent-primary)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
              }}>
                <Pin size={16} />
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: '12px', fontWeight: 700, color: 'var(--accent-primary)', marginBottom: '2px' }}>
                  Tin nhắn đã ghim
                </div>
                <div
                  style={{
                    fontSize: '13px',
                    color: 'var(--text-secondary)',
                    overflow: 'hidden',
                    whiteSpace: 'nowrap',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {getPinnedMessageSummary(pinnedMessage)}
                </div>
              </div>
            </button>
            {(!conv?.isGroup || isGroupAdmin) && (
              <button
                type="button"
                onClick={() => handleUnpinMessage(pinnedMessage)}
                className="icon-btn"
                title="Bỏ ghim"
                style={{
                  width: 32,
                  height: 32,
                  flexShrink: 0,
                  background: 'rgba(255,255,255,0.45)',
                }}
              >
                <Pin size={15} style={{ transform: 'rotate(45deg)' }} />
              </button>
            )}
          </div>
        </div>
      )}

      <div
        className="messages-container"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {isFetchingMore && (
          <div style={{ textAlign: 'center', padding: '8px' }}>
            <div className="loading-spinner" style={{ margin: '0 auto' }} />
          </div>
        )}

        {isLoadingMsgs ? (
          <div className="loading-center">
            <div className="loading-spinner" />
            <span>Đang tải tin nhắn...</span>
          </div>
        ) : visibleMessages.length === 0 ? (
          <div className="messages-empty">
            <div style={{ fontSize: '40px' }}>💬</div>
            <p>Chưa có tin nhắn nào. Hãy bắt đầu cuộc trò chuyện!</p>
          </div>
        ) : (
          visibleMessages.map((message, index) => {
            if (normalizeId(message.conversationId) !== activeConversationId) return null;
            const isPinnedMessage = normalizeId(conv?.pinMessage?._id) === message._id;
            return (
              <MessageBubble
                key={message._id}
                messageRef={(node) => {
                  if (node) {
                    messageRefs.current[message._id] = node;
                  } else {
                    delete messageRefs.current[message._id];
                  }
                }}
                message={message}
                isMe={getSenderId(message) === currentUserId}
                prevMessage={index > 0 ? visibleMessages[index - 1] : undefined}
                currentUserId={currentUserId}
                isGroup={conv?.isGroup}
                senderAvatarUrl={typeof message.sender === 'object' ? message.sender?.avatar?.url : undefined}
                onAvatarClick={isBlocked ? undefined : () => {
                  if (getSenderId(message) !== currentUserId && typeof message.sender === 'object' && !message.sender.isDisabled && !isTargetUserBanned) {
                    setSelectedUserForInfo(message.sender as any);
                  }
                }}
                readStatusLabel={getReadStatusLabel(message)}
                forceShowStatus={message._id === lastMyMessageId}
                onReadStatusClick={() => {
                  if (conv?.isGroup) {
                    setReadersModalData({ isOpen: true, readers: getReadersForMessage(message) });
                  }
                }}
                onReactionsClick={conv?.isGroup ? () => {
                  setReactionsModalData({ isOpen: true, message });
                } : undefined}
                onReply={() => {
                  if (isMuted || isTargetUserBanned) return;
                  setReplyTarget(message);
                  setEditingMessageId(null);
                }}
                onReplyReferenceClick={() => handleReplyReferenceClick(message)}
                onEdit={() => handleEditMessage(message)}
                onDelete={() => handleDeleteMessage(message)}
                onPin={!isPinnedMessage && (!conv?.isGroup || isGroupAdmin) ? () => handlePinMessage(message) : undefined}
                onUnpin={isPinnedMessage && (!conv?.isGroup || isGroupAdmin) ? () => handleUnpinMessage(message) : undefined}
                onToggleReaction={(reactionType: string) => handleToggleReaction(message, reactionType)}
                onMediaClick={(media) => {
                  setLightboxMedias([media]);
                  setLightboxIndex(0);
                }}
                isHighlighted={highlightedMessageId === message._id}
                disableActions={isMessageRequest || isBlocked}
                disableReply={isMuted || isTargetUserBanned}
              />
            );
          })
        )}

        {typingNames.length > 0 && (
          <div className="typing-indicator">
            <div className="typing-dots">
              <span /><span /><span />
            </div>
            <span className="typing-text">
              {typingNames.join(', ')} đang nhập...
            </span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {replyTarget && (
        <div className="reply-preview">
          <div className="reply-preview-content">
            <span className="reply-preview-label">Trả lời</span>
            <span className="reply-preview-text">{getReplyTargetPreview(replyTarget)}</span>
          </div>
          <button className="icon-btn" onClick={() => setReplyTarget(null)}>
            <X size={14} />
          </button>
        </div>
      )}

      {editingMessageId && (
        <div className="reply-preview editing">
          <div className="reply-preview-content">
            <span className="reply-preview-label">Đang chỉnh sửa</span>
            <span className="reply-preview-text">Enter để lưu, sửa nội dung trực tiếp trong ô chat.</span>
          </div>
          <button className="icon-btn" onClick={() => {
            setEditingMessageId(null);
            setText('');
          }}
          >
            <X size={14} />
          </button>
        </div>
      )}

      {voiceBlob && voiceUrl && (
        <div className="voice-preview-bar">
          <AudioPlayer src={voiceUrl} isMe={true} className="voice-preview-player" />
          <div className="voice-preview-actions">
            <button className="btn btn-secondary" onClick={resetVoiceDraft}>Xóa</button>
            <button className="btn btn-primary" onClick={handleSendVoice} disabled={isMuted}>Gửi voice</button>
          </div>
        </div>
      )}

      {isTargetUserDisabled ? (
        <div style={{ padding: '16px', background: 'var(--bg-primary)', textAlign: 'center', color: 'var(--text-secondary)', borderTop: '1px solid var(--border)', fontSize: '13px' }}>
          Người này hiện không có mặt trên HaloChat. 
        </div>
      ) : isTargetUserBanned ? (
        <div className="composer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          <span style={{color:'red'}}>{getBanStatusText(otherUser?.banUntil)}</span>
        </div>
      ) : isMessageRequest ? (
        <div style={{ padding: '16px', background: 'var(--bg-primary)', textAlign: 'center', borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
          <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
            {conv?.isGroup ? 'Bạn có lời mời tham gia nhóm này.' : 'Người này muốn kết nối với bạn.'}
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              className="btn btn-primary" 
              onClick={handleAcceptRequest}
            >
              Chấp nhận
            </button>
            <button 
              className="btn" 
              style={{ background: '#fff', color: '#000', border: '1px solid #d1d5db' }}
              onClick={handleDeleteRequest}
            >
              Xóa
            </button>
            {conv?.isGroup ? (
              <button 
                className="btn" 
                style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                onClick={handleLeaveGroupRequest}
              >
                Rời nhóm
              </button>
            ) : !isLoadingRelationships ? (
              isBlocked && iBlockedThem ? (
                <button
                  className="btn"
                  style={{ background: '#fff', color: '#000', border: '1px solid #d1d5db' }}
                  onClick={handleUnblockRequest}
                >
                  Bỏ chặn
                </button>
              ) : !isBlocked ? (
                <button
                  className="btn"
                  style={{ background: '#ef4444', color: '#fff', border: 'none' }}
                  onClick={handleBlockRequest}
                >
                  Chặn
                </button>
              ) : null
            ) : null}
          </div>
        </div>
      ) : isBlocked ? (
        <div className="composer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          {iBlockedThem ? (
            <span>
              Bạn đã chặn người này.{' '}
              <span 
                style={{ color: 'var(--primary)', cursor: 'pointer', fontWeight: 600, textDecoration: 'underline' }}
                onClick={handleUnblockRequest}
              >
                Bỏ chặn
              </span>{' '}
              để gửi tin nhắn.
            </span>
          ) : 'Không thể gửi tin nhắn. Bạn đã bị chặn.'}
        </div>
      ) : isMuted ? (
        <div className="composer" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-muted)' }}>
          {muteUntilLabel ? (
            <span>
              Bạn đã bị cấm chat đến <strong>{muteUntilLabel}</strong>. Bạn không thể gửi tin nhắn trong thời gian này.
            </span>
          ) : (
            <span>Bạn đã bị cấm chat. Bạn không thể gửi tin nhắn trong thời gian này.</span>
          )}
        </div>
      ) : (
      <div className="composer">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          style={{ display: 'none' }}
          onChange={(event) => handleFileChange(event, 'image')}
        />
        <input
          ref={videoInputRef}
          type="file"
          accept="video/mp4,video/webm,video/quicktime"
          style={{ display: 'none' }}
          onChange={(event) => handleFileChange(event, 'video')}
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar"
          style={{ display: 'none' }}
          onChange={(event) => handleFileChange(event, 'file')}
        />

        {isRecordingVoice ? (
          <div className="voice-recording-overlay">
            <button className="icon-btn cancel-voice-btn" onClick={cancelVoiceRecording} title="Hủy">
              <X size={24} />
            </button>
            <div className="voice-recording-pill">
              <button className="voice-stop-btn" onClick={stopVoiceRecording} title="Dừng và xem trước">
                <Square size={20} fill="currentColor" />
              </button>
              <span className="voice-timer">{formatDuration(recordingDuration)}</span>
            </div>
            <button className="icon-btn send-voice-btn" onClick={() => {
              stopVoiceRecording();
            }} title="Xong">
              <Send size={24} />
            </button>
          </div>
        ) : (
          <>
            <div className="composer-media-actions">
              <button 
                className={`icon-btn mobile-plus-btn${showMediaMenu ? ' active' : ''}`}
                title="Đính kèm"
                onClick={() => setShowMediaMenu((prev) => !prev)}
                disabled={isTempConversation}
              >
                <Plus size={24} />
              </button>
              
              {showMediaMenu && (
                <div className="media-actions-backdrop" onClick={() => setShowMediaMenu(false)} />
              )}
              
              <div className={`media-actions-menu${showMediaMenu ? ' open' : ''}`}>
                <button className="icon-btn" title="Đính kèm file" onClick={() => { fileInputRef.current?.click(); setShowMediaMenu(false); }}>
                  <Paperclip size={24} />
                </button>
                <button className="icon-btn" title="Gửi ảnh" onClick={() => { imageInputRef.current?.click(); setShowMediaMenu(false); }}>
                  <Image size={24} />
                </button>
                <button className="icon-btn" title="Gửi video" onClick={() => { videoInputRef.current?.click(); setShowMediaMenu(false); }}>
                  <Video size={24} />
                </button>
                <button
                  className="icon-btn"
                  title="Ghi âm"
                  onClick={() => { startVoiceRecording(); setShowMediaMenu(false); }}
                >
                  <Mic size={24} />
                </button>
              </div>
            </div>
            <input
              ref={inputRef}
              className="composer-input"
              placeholder={isTempConversation ? 'Đang khởi tạo...' : editingMessageId ? 'Chỉnh sửa tin nhắn...' : 'Nhập tin nhắn...'}
              value={text}
              onChange={handleComposerChange}
              onKeyDown={(event) => {
                if (event.key === '@' && !isMuted && !isTempConversation) {
                  requestAnimationFrame(() => setShowHighlightMenu(true));
                }
                if (event.key === 'Escape' && showHighlightMenu) {
                  event.preventDefault();
                  event.stopPropagation();
                  const cursor = inputRef.current?.selectionStart ?? text.length;
                  const beforeCursor = text.slice(0, cursor);
                  const triggerIndex = beforeCursor.lastIndexOf('@');
                  setSuppressHighlightTriggerIndex(triggerIndex >= 0 ? triggerIndex : null);
                  setShowHighlightMenu(false);
                  return;
                }
                if (event.key === 'Tab' && showHighlightMenu) {
                  event.preventDefault();
                  insertHighlightToken();
                  return;
                }
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              onBlur={() => {
                if (activeConversationId) stopTyping(activeConversationId);
                setTimeout(() => setShowHighlightMenu(false), 120);
              }}
              disabled={isTempConversation}
            />
            {showHighlightMenu && (
              <div className="highlight-menu">
                <button type="button" className="highlight-menu-item" onMouseDown={(e) => e.preventDefault()} onClick={insertHighlightToken}>
                  <strong>@[[  ]]</strong>
                  <span>Nổi bật đoạn này</span>
                </button>
              </div>
            )}
            <div style={{ position: 'relative' }}>
              <button 
                className={`icon-btn${showEmojiPicker ? ' active' : ''}`} 
                title="Emoji"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (!showEmojiPicker) {
                    inputRef.current?.blur();
                  }
                  setShowEmojiPicker((prev) => !prev);
                }}
                disabled={isTempConversation}
              >
                <Smile size={24} />
              </button>
              {showEmojiPicker && (
                <div 
                  ref={emojiPickerRef}
                  style={{ position: 'absolute', bottom: '100%', right: 0, zIndex: 50, marginBottom: '8px' }}
                >
                  <EmojiPicker 
                    onEmojiClick={(emojiData) => {
                      setText((prev) => prev + emojiData.emoji);
                      if (activeConversationId) startTyping(activeConversationId);
                    }}
                    lazyLoadEmojis={true}
                    searchPlaceHolder="Tìm kiếm Emoji..."
                    autoFocusSearch={false}
                  />
                </div>
              )}
            </div>
            <button
              className={`composer-send${text.trim() ? ' active' : ''}`}
              onClick={handleSend}
              disabled={!text.trim() || isTempConversation}
              title={editingMessageId ? 'Lưu thay đổi' : 'Gửi'}
            >
              <Send size={24} />
            </button>
          </>
        )}
      </div>
      )}
    </div>

      {/* Info Sidebar */}
      {showInfo && (
        <div 
          className="info-sidebar-backdrop" 
          onClick={() => setShowInfo(false)} 
        />
      )}
      <div className={`info-sidebar${showInfo ? ' open' : ''}`}>
        <div className="info-sidebar-header">
          <span>Thông tin hội thoại</span>
          <button className="icon-btn" onClick={() => setShowInfo(false)} title="Đóng">
            <X size={18} />
          </button>
        </div>

        <div className="info-sidebar-body">
          {/* Hidden file input for avatar */}
          {isGroupAdmin && (
            <input
              ref={groupAvatarInputRef}
              type="file"
              accept="image/*"
              style={{ display: 'none' }}
              onChange={handleUploadGroupAvatar}
            />
          )}

          {/* Avatar & Name */}
          <div className="info-sidebar-profile">
            <div className="info-sidebar-avatar-wrap">
              <div 
                className="info-sidebar-avatar"
                style={{ cursor: conv?.avatar?.url ? 'pointer' : 'default', ...(isTargetUserDisabled ? { background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : {}) }}
                onClick={() => {
                  if (conv?.avatar?.url) {
                    setSelectedGroupMedia({ url: conv.avatar.url, type: 'image' });
                  }
                }}
              >
                {isTargetUserDisabled ? (
                  <UserX size={36} style={{ color: 'var(--text-muted)' }} />
                ) : conv?.avatar?.url ? (
                  <img src={conv.avatar.url} alt={convName} />
                ) : headerAvatarUrl ? (
                  <img src={headerAvatarUrl} alt={convName} />
                ) : (
                  <span>{convName.slice(0, 2).toUpperCase()}</span>
                )}
                
                {isUploadingAvatar && (
                  <div className="info-avatar-uploading">
                    <div className="loading-spinner" style={{ width: 20, height: 20 }} />
                  </div>
                )}
              </div>

              {isGroupAdmin && conv?.isGroup && (
                <div 
                  ref={groupAvatarMenuRef}
                  style={{
                    position: 'absolute', bottom: -5, right: -5,
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (conv?.avatar?.url) {
                      setIsGroupAvatarMenuOpen(!isGroupAvatarMenuOpen);
                    } else {
                      groupAvatarInputRef.current?.click();
                    }
                  }}
                >
                  <div style={{
                    background: 'var(--accent-primary)',
                    borderRadius: '50%', width: 28, height: 28, display: 'flex', alignItems: 'center',
                    justifyContent: 'center', color: '#fff', border: '2px solid var(--bg-primary)',
                    cursor: 'pointer'
                  }} title={conv?.avatar?.url ? "Tùy chọn" : "Đổi ảnh đại diện nhóm"}>
                    {isUploadingAvatar ? <div className="loading-spinner" style={{ width: 14, height: 14, borderColor: 'white', borderTopColor: 'transparent' }} /> : (conv?.avatar?.url ? <Edit2 size={13} /> : <Camera size={14} />)}
                  </div>

                  {isGroupAvatarMenuOpen && (
                    <div style={{
                      position: 'absolute',
                      top: '100%',
                      right: 0,
                      marginTop: '8px',
                      background: 'var(--bg-primary)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                      padding: '4px',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      zIndex: 10,
                      minWidth: '120px',
                      animation: 'fadeIn 0.2s ease-out'
                    }}>
                      <button
                        className="dropdown-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '4px', color: 'var(--text-primary)' }}
                        onClick={(e) => { e.stopPropagation(); setIsGroupAvatarMenuOpen(false); groupAvatarInputRef.current?.click(); }}
                      >
                        <Camera size={14} /> Chọn mới
                      </button>
                      <button
                        className="dropdown-item"
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--error)', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', width: '100%', borderRadius: '4px' }}
                        onClick={(e) => { e.stopPropagation(); setIsGroupAvatarMenuOpen(false); handleDeleteGroupAvatar(); }}
                        disabled={isUploadingAvatar}
                      >
                        <Trash2 size={14} /> Xóa ảnh
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Group name - editable for admin */}
            {conv?.isGroup ? (
              editingGroupName ? (
                <div className="info-name-edit">
                  <input
                    className="info-name-input"
                    value={groupNameInput}
                    onChange={(e) => setGroupNameInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUpdateGroupName();
                      if (e.key === 'Escape') setEditingGroupName(false);
                    }}
                    autoFocus
                    maxLength={50}
                  />
                  <div className="info-name-edit-actions">
                    <button className="icon-btn" onClick={handleUpdateGroupName} title="Lưu">
                      <Check size={14} />
                    </button>
                    <button className="icon-btn" onClick={() => setEditingGroupName(false)} title="Hủy">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="info-sidebar-name-row">
                  <div className="info-sidebar-name">{convName}</div>
                  {isGroupAdmin && (
                    <button
                      className="icon-btn info-edit-name-btn"
                      title="Đổi tên nhóm"
                      onClick={() => {
                        setGroupNameInput(conv.name || '');
                        setEditingGroupName(true);
                      }}
                    >
                      <Pencil size={14} />
                    </button>
                  )}
                </div>
              )
            ) : (
              <div 
                className={isTargetUserDisabled || isBlocked ? 'info-sidebar-name' : 'info-sidebar-name clickable'} 
                onClick={isTargetUserDisabled || isBlocked ? undefined : () => handleShowUserProfile(otherUser || (conv && conv.users.find((u) => u._id === currentUserId)))}
                title={isTargetUserDisabled || isBlocked ? undefined : 'Xem thông tin'}
                style={{ cursor: isTargetUserDisabled || isBlocked ? 'default' : 'pointer' }}
              >
                {convName}
              </div>
            )}

            {conv?.isGroup && (
              <div className="info-sidebar-sub">{conv.users.length} thành viên</div>
            )}
          </div>

          {/* Members section */}
          {conv?.isGroup && (
            <div className="info-sidebar-section">
              <div 
                className="info-sidebar-section-title" 
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
                onClick={() => setIsMembersExpanded(!isMembersExpanded)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <span>Thành viên trong đoạn chat</span>
                  {isMembersExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                </div>
                {isGroupAdmin && (
                  <button
                    className="icon-btn"
                    title="Thêm thành viên"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowAddMemberModal(true);
                    }}
                  >
                    <UserPlus size={16} />
                  </button>
                )}
              </div>
              {isMembersExpanded && (
                <>
                  <div style={{ padding: '8px 20px 4px' }}>
                    <div style={{ background: 'var(--bg-secondary)', borderRadius: '20px', padding: '8px 14px', display: 'flex', alignItems: 'center', gap: '8px', border: '1px solid var(--border-light)' }}>
                      <Search size={14} style={{ color: 'var(--text-muted)' }} />
                      <input 
                        type="text" 
                        placeholder="Tìm thành viên..." 
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        style={{ border: 'none', background: 'transparent', outline: 'none', width: '100%', fontSize: '13px', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                  <div className="info-sidebar-members">
                  {conv.users.filter(member => {
                    if (!memberSearchQuery) return true;
                    const name = (member.name || '').toLowerCase();
                    return name.includes(memberSearchQuery.toLowerCase());
                  }).map((member) => {
                  const avatar = typeof member.avatar === 'object' && member.avatar?.url
                    ? member.avatar.url
                    : typeof member.avatar === 'string' ? member.avatar : null;
                  const displayName = member.name || 'Người dùng';
                  const isMemberAdmin = conv.adminGroupId === member._id;
                  const memberRestriction = getUserRestrictionState(member);
                  const hasMemberBadges = Boolean(memberRestriction.badgeLabel || member._id === currentUserId || isMemberAdmin);
                  const isMemberHidden = member.isDisabled || blockedUserIds.has(member._id);
                  const canOpenMemberProfile = memberRestriction.kind !== 'disable' && !isMemberHidden;
                  const canTransferAdmin = memberRestriction.kind === null && !isMemberHidden;
                  return (
                    <div key={member._id} className={`info-sidebar-member${canOpenMemberProfile ? '' : ' disabled'}`}>
                      <div
                        className="info-sidebar-member-avatar"
                        style={memberRestriction.kind === 'disable' || isMemberHidden
                          ? { background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: '1px solid var(--border-light)' }
                          : {}}
                      >
                        {memberRestriction.kind === 'disable' || isMemberHidden
                          ? <UserX size={18} />
                          : avatar
                            ? <img src={avatar} alt={displayName} />
                            : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="info-sidebar-member-info">
                        {hasMemberBadges && (
                          <div className="info-sidebar-member-badges">
                          {memberRestriction.badgeLabel && (
                            <span
                              className={`info-sidebar-member-mini-badge ${memberRestriction.kind === 'ban' ? 'badge-error' : ''}`}
                              style={memberRestriction.kind === 'disable'
                                ? { background: 'rgba(107,114,128,0.10)', color: 'var(--text-muted)', border: '1px solid rgba(107,114,128,0.20)' }
                                : undefined}
                            >
                              {memberRestriction.badgeLabel}
                            </span>
                          )}
                          {member._id === currentUserId && <span className="info-badge-me">Bạn</span>}
                          {isMemberAdmin && <span className="info-sidebar-member-admin-badge" aria-label="Quản trị viên"><Crown size={12} /></span>}
                          </div>
                        )}
                        <div 
                          className={canOpenMemberProfile ? 'info-sidebar-member-name clickable' : 'info-sidebar-member-name info-sidebar-member-name-disabled'}
                          onClick={canOpenMemberProfile ? () => handleShowUserProfile(member) : undefined}
                          title={member.isDisabled ? undefined : displayName}
                          style={{ cursor: canOpenMemberProfile ? 'pointer' : 'default' }}
                        >
                          <span className="info-sidebar-member-name-text">{displayName}</span>
                          {memberRestriction.badgeLabel && (
                            <span
                              className={`info-sidebar-member-mini-badge ${memberRestriction.kind === 'ban' ? 'badge-error' : ''}`}
                              style={memberRestriction.kind === 'disable'
                                ? { background: 'rgba(107,114,128,0.10)', color: 'var(--text-muted)', border: '1px solid rgba(107,114,128,0.20)' }
                                : undefined}
                            >
                              {memberRestriction.badgeLabel}
                            </span>
                          )}
                          {member._id === currentUserId && <span className="info-badge-me">Bạn</span>}
                          {isMemberAdmin && <Crown size={14} className="text-warning" style={{ color: 'var(--warning)', marginLeft: '4px' }} aria-label="Quản trị viên" />}
                        </div>
                      </div>
                      {isGroupAdmin && !isMemberAdmin && (
                        <div className="info-sidebar-member-actions">
                          <button
                            className="icon-btn info-member-more"
                            title="Chuyển quyền quản trị viên"
                            onClick={canTransferAdmin ? () => handleChangeAdmin(member._id, displayName) : undefined}
                            disabled={!canTransferAdmin}
                            style={{ opacity: canTransferAdmin ? 1 : 0.4, cursor: canTransferAdmin ? 'pointer' : 'not-allowed' }}
                          >
                            <Crown size={16} className="text-warning" style={{ color: 'var(--warning)' }} />
                          </button>
                          <button
                            className="icon-btn info-member-more"
                            title="Xóa khỏi nhóm"
                            onClick={() => handleRemoveMember(member._id, displayName)}
                          >
                            <UserMinus size={16} className="text-error" style={{ color: 'var(--error)' }} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              </>
              )}
            </div>
          )}

          {/* Images section */}
          <div className="info-sidebar-section">
            <div 
              className="info-sidebar-section-title" 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setIsImagesExpanded(!isImagesExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Hình ảnh</span>
                {isImagesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <Image size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            {isImagesExpanded && (
              <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isLoadingSidebarMedia[MediaResourceTypeEnum.IMAGE] && !sidebarMedia[MediaResourceTypeEnum.IMAGE]?.length ? (
                  <div style={{ textAlign: 'center' }}>Đang tải...</div>
                ) : sidebarMedia[MediaResourceTypeEnum.IMAGE]?.length ? (
                  <>
                    <div 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '2px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        paddingRight: '2px'
                      }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          fetchSidebarMedia(MediaResourceTypeEnum.IMAGE, true);
                        }
                      }}
                    >
                      {sidebarMedia[MediaResourceTypeEnum.IMAGE]!.map((media, idx) => (
                        <div 
                          key={media._id} 
                          onClick={() => {
                            setLightboxMedias(sidebarMedia[MediaResourceTypeEnum.IMAGE]!);
                            setLightboxIndex(idx);
                          }}
                          style={{ position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: '#f0f0f0', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}
                        >
                          <img src={media.thumbUrl || media.url} alt="img" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ))}
                    </div>
                    {isLoadingSidebarMedia[MediaResourceTypeEnum.IMAGE] && (
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>Đang tải thêm...</div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>Chưa có hình ảnh nào</div>
                )}
              </div>
            )}
          </div>

          {/* Videos section */}
          <div className="info-sidebar-section">
            <div 
              className="info-sidebar-section-title" 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setIsVideosExpanded(!isVideosExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>Video</span>
                {isVideosExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <Video size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            {isVideosExpanded && (
              <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isLoadingSidebarMedia[MediaResourceTypeEnum.VIDEO] && !sidebarMedia[MediaResourceTypeEnum.VIDEO]?.length ? (
                  <div style={{ textAlign: 'center' }}>Đang tải...</div>
                ) : sidebarMedia[MediaResourceTypeEnum.VIDEO]?.length ? (
                  <>
                    <div 
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: 'repeat(3, 1fr)', 
                        gap: '2px',
                        maxHeight: '240px',
                        overflowY: 'auto',
                        paddingRight: '2px'
                      }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          fetchSidebarMedia(MediaResourceTypeEnum.VIDEO, true);
                        }
                      }}
                    >
                      {sidebarMedia[MediaResourceTypeEnum.VIDEO]!.map((media, idx) => (
                        <div 
                          key={media._id} 
                          onClick={() => {
                            setLightboxMedias(sidebarMedia[MediaResourceTypeEnum.VIDEO]!);
                            setLightboxIndex(idx);
                          }}
                          style={{ position: 'relative', width: '100%', paddingBottom: '100%', backgroundColor: '#333', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer' }}
                        >
                          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white', zIndex: 1 }}>
                            <Video size={20} />
                          </div>
                          {media.thumbUrl ? (
                            <img src={media.thumbUrl} alt="thumb" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }} />
                          ) : media.url ? (
                            <video preload="metadata" style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}>
                              <source src={media.url} type={media.mimeType || 'video/mp4'} />
                            </video>
                          ) : null}
                        </div>
                      ))}
                    </div>
                    {isLoadingSidebarMedia[MediaResourceTypeEnum.VIDEO] && (
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>Đang tải thêm...</div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>Chưa có video nào</div>
                )}
              </div>
            )}
          </div>

          {/* Files section */}
          <div className="info-sidebar-section">
            <div 
              className="info-sidebar-section-title" 
              style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              onClick={() => setIsFilesExpanded(!isFilesExpanded)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span>File</span>
                {isFilesExpanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              </div>
              <FileText size={16} style={{ color: 'var(--text-secondary)' }} />
            </div>
            {isFilesExpanded && (
              <div style={{ padding: '16px 0', color: 'var(--text-secondary)', fontSize: '13px' }}>
                {isLoadingSidebarMedia[MediaResourceTypeEnum.FILE] && !sidebarMedia[MediaResourceTypeEnum.FILE]?.length ? (
                  <div style={{ textAlign: 'center' }}>Đang tải...</div>
                ) : sidebarMedia[MediaResourceTypeEnum.FILE]?.length ? (
                  <>
                    <div 
                      style={{ 
                        display: 'flex', 
                        flexDirection: 'column', 
                        gap: '4px',
                        maxHeight: '260px',
                        overflowY: 'auto',
                        paddingRight: '4px'
                      }}
                      onScroll={(e) => {
                        const target = e.currentTarget;
                        if (target.scrollHeight - target.scrollTop <= target.clientHeight + 20) {
                          fetchSidebarMedia(MediaResourceTypeEnum.FILE, true);
                        }
                      }}
                    >
                      {sidebarMedia[MediaResourceTypeEnum.FILE]!.map((media) => (
                        <div key={media._id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 8px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', color: 'var(--text-primary)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                            <FileText size={18} style={{ color: 'var(--primary)', flexShrink: 0 }} />
                            <div style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '13px' }}>
                              {media.fileName || 'Tài liệu'}
                            </div>
                          </div>
                          <button 
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (!media.url) return;
                              try {
                                const isR2Media = Boolean(media.provider === 'r2' || (media.objectKey && media._id));
                                let blob: Blob;

                                if (isR2Media) {
                                  const response = await api.get(`/media/${media._id}/download`, {
                                    responseType: 'blob',
                                  });
                                  blob = response.data instanceof Blob 
                                    ? response.data 
                                    : new Blob([response.data], { type: media.mimeType || 'application/octet-stream' });
                                } else {
                                  const response = await fetch(media.url);
                                  blob = await response.blob();
                                }
                                
                                const blobUrl = window.URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = blobUrl;
                                a.download = media.fileName || 'download';
                                document.body.appendChild(a);
                                a.click();
                                a.remove();
                                window.URL.revokeObjectURL(blobUrl);
                              } catch (err: any) {
                                console.error('Download error:', err);
                                if (err.response?.data instanceof Blob) {
                                  const text = await err.response.data.text();
                                  toast.error(`${UI_MESSAGES.chat.backendDownloadErrorPrefix}${text}`);
                                } else {
                                  toast.error(`${UI_MESSAGES.chat.downloadErrorPrefix}${err.message || UI_MESSAGES.chat.downloadFailedFallback}`);
                                }
                              }
                            }}
                            title="Tải xuống"
                            style={{ background: 'transparent', border: 'none', cursor: 'pointer', padding: '4px', flexShrink: 0, color: 'var(--text-secondary)' }}
                          >
                            <Download size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                    {isLoadingSidebarMedia[MediaResourceTypeEnum.FILE] && (
                      <div style={{ textAlign: 'center', marginTop: '8px', fontSize: '12px' }}>Đang tải thêm...</div>
                    )}
                  </>
                ) : (
                  <div style={{ textAlign: 'center' }}>Chưa có file nào</div>
                )}
              </div>
            )}
          </div>

          {/* Danger Zone */}
          {(!isLoadingConv && !isLoadingRelationships) && (
            <div className="info-sidebar-danger-zone">
              <button
              className="info-danger-btn leave"
              style={{ marginBottom: '8px' }}
              onClick={handleHideHistory}
            >
              <History size={16} />
              <span>Xóa lịch sử chat</span>
            </button>
            
            {conv?.isGroup ? (
              isGroupAdmin ? (
                <button className="info-danger-btn disband" onClick={handleDisbandGroup}>
                  <ShieldOff size={16} />
                  <span>Giải tán nhóm</span>
                </button>
              ) : (
                <button className="info-danger-btn leave" onClick={handleLeaveGroup}>
                  <LogOut size={16} />
                  <span>Rời nhóm</span>
                </button>
              )
            ) : iBlockedThem ? (
              <button 
                className="info-danger-btn" 
                style={{ color: 'var(--primary)', borderColor: 'var(--primary)' }}
                onClick={handleUnblockRequest}
              >
                <UserCheck size={16} />
                <span>Bỏ chặn</span>
              </button>
            ) : !isBlocked ? (
              <button 
                className="info-danger-btn disband" 
                onClick={handleBlockRequest}
              >
                <UserX size={16} />
                <span>Chặn</span>
              </button>
            ) : null}
          </div>
          )}
        </div>
      </div>

      {callState && (
        <div className="call-overlay">
          <div className={`call-panel ${callState.callType}`}>
            <div className="call-panel-header">
              <div>
                <div className="call-panel-title">
                  {callState.callType === 'video' ? 'Video call' : 'Cuộc gọi thoại'}
                </div>
                <div className="call-panel-subtitle">
                  {callState.status === 'incoming'
                    ? `${callState.peerName} đang gọi`
                    : callState.status === 'calling'
                      ? `Đang gọi ${callState.peerName}`
                      : callState.status === 'active'
                        ? `Đang kết nối với ${callState.peerName}`
                        : `Đang thiết lập với ${callState.peerName}`}
                </div>
                {callState.status === 'active' && (
                  <div className="call-panel-subtitle">
                    {formatDuration(callDurationSeconds)}
                  </div>
                )}
              </div>
              {callState.status !== 'incoming' && (
                <button className="call-close-btn" onClick={() => void handleEndCall()} title="Kết thúc">
                  <X size={18} />
                </button>
              )}
            </div>

            <div className="call-media">
              {callState.callType === 'video' ? (
                <>
                  <video ref={remoteVideoRef} className="call-remote-video" autoPlay playsInline />
                  <video
                    ref={localVideoRef}
                    className={`call-local-video${!isCallCameraEnabled ? ' off' : ''}`}
                    autoPlay
                    muted
                    playsInline
                  />
                </>
              ) : (
                <div className="call-audio-avatar">
                  {callState.peerAvatarUrl ? (
                    <img src={callState.peerAvatarUrl} alt={callState.peerName} />
                  ) : (
                    <>
                      <Phone size={38} />
                      <span>{callState.peerName.slice(0, 2).toUpperCase()}</span>
                    </>
                  )}
                </div>
              )}
              {callState.callType === 'audio' && <audio ref={remoteAudioRef} autoPlay />}
            </div>

            <div className="call-actions">
              {callState.status === 'incoming' ? (
                <>
                  <button className="call-action-btn reject" onClick={() => void handleRejectCall()}>
                    <X size={20} />
                  </button>
                  <button className="call-action-btn accept" onClick={() => void handleAcceptCall()}>
                    {callState.callType === 'video' ? <Video size={20} /> : <Phone size={20} />}
                  </button>
                </>
              ) : (
                <>
                  <button
                    className={`call-action-btn toggle${!isCallMicEnabled ? ' off' : ''}`}
                    onClick={handleToggleCallMic}
                    title={isCallMicEnabled ? 'Tắt mic' : 'Bật mic'}
                  >
                    {isCallMicEnabled ? <Mic size={20} /> : <MicOff size={20} />}
                  </button>
                  <button className="call-action-btn reject" onClick={() => void handleEndCall()}>
                    <X size={20} />
                  </button>
                  {callState.callType === 'video' && (
                    <>
                      <button
                        className={`call-action-btn toggle${!isCallCameraEnabled ? ' off' : ''}`}
                        onClick={handleToggleCallCamera}
                        title={isCallCameraEnabled ? 'Tắt camera' : 'Bật camera'}
                      >
                        {isCallCameraEnabled ? <Camera size={20} /> : <VideoOff size={20} />}
                      </button>
                      {isMobileDevice && (
                        <button
                          className="call-action-btn toggle"
                          onClick={() => void handleSwitchCallCamera()}
                          title="Đổi camera"
                          disabled={isSwitchingCamera}
                        >
                          <RefreshCw size={20} />
                        </button>
                      )}
                    </>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Member Modal */}
      {activeConversationId && conv && (
        <AddMemberModal
          isOpen={showAddMemberModal}
          conversationId={activeConversationId}
          currentMembers={conv.users.map((u) => u._id)}
          onClose={() => setShowAddMemberModal(false)}
          onSuccess={(updatedConv) => {
            setConv(updatedConv);
          }}
        />
      )}

      {/* Message Readers Modal */}
      {conv && readersModalData.isOpen && (
        <MessageReadersModal
          isOpen={readersModalData.isOpen}
          onClose={() => setReadersModalData({ isOpen: false, readers: [] })}
          conversation={conv}
          readers={readersModalData.readers}
          currentUserId={currentUserId}
        />
      )}

      {/* Message Reactions Modal */}
      {conv && reactionsModalData.isOpen && reactionsModalData.message && (
        <MessageReactionsModal
          isOpen={reactionsModalData.isOpen}
          onClose={() => setReactionsModalData({ isOpen: false, message: null })}
          conversation={conv}
          message={reactionsModalData.message}
        />
      )}

      {/* Pinned Message Modal */}
      {selectedPinnedMessage && (
        <Modal
          isOpen={!!selectedPinnedMessage}
          onClose={() => setSelectedPinnedMessage(null)}
          title="Tin nhắn đã ghim"
        >
          <div style={{ display: 'grid', gap: 14 }}>
            <div style={{ padding: 16, borderRadius: 14, border: '1px solid var(--border)', background: 'var(--bg-secondary)' }}>
              {renderPinnedMessagePreview(selectedPinnedMessage)}
            </div>
          </div>
        </Modal>
      )}

      {/* Confirm Modal */}
      {confirmAction && (
        <ConfirmModal
          key={confirmAction.title}
          isOpen={!!confirmAction}
          title={confirmAction.title}
          message={confirmAction.message}
          isDanger={confirmAction.isDanger}
          confirmText={confirmAction.confirmText}
          countdown={confirmAction.countdown}
          onConfirm={confirmAction.action}
          onCancel={() => setConfirmAction(null)}
        />
      )}

      {/* User Info Modal (View Only) */}
      {selectedUserForInfo && (
        <Modal
          isOpen={!!selectedUserForInfo}
          onClose={() => setSelectedUserForInfo(null)}
          title="Thông tin người dùng"
        >
          <div style={{ position: 'relative', width: '100%', minHeight: '400px' }}>
            {/* Report Icon */}
            {user?._id !== selectedUserForInfo._id && getUserRestrictionState(selectedUserForInfo).kind === null && (
              <button
                onClick={() => setShowReportModal(true)}
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
            {user?._id !== selectedUserForInfo._id && getUserRestrictionState(selectedUserForInfo).kind === null && (() => {
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
                    } catch (err: any) {
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
                  onClick={() => handleStartDirectChat(selectedUserForInfo._id)}
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
      )}
      {/* Online/Offline Status Modal */}
      {showOnlineModal && conv?.isGroup && (
        <Modal
          isOpen={true}
          onClose={() => setShowOnlineModal(false)}
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
      )}
      {/* Lightbox for Images and Videos */}
      {lightboxMedias && (
        <MediaLightbox 
          medias={lightboxMedias} 
          initialIndex={lightboxIndex} 
          onClose={() => setLightboxMedias(null)} 
        />
      )}
      {/* Image/Video Viewer for group avatar */}
      {selectedGroupMedia && (
        <MediaLightbox
          medias={[{ _id: 'group_avatar', url: selectedGroupMedia.url, resourceType: selectedGroupMedia.type, provider: 'cloudinary' } as any]}
          initialIndex={0}
          onClose={() => setSelectedGroupMedia(null)}
        />
      )}

      {/* Report User Modal */}
      {selectedUserForInfo && (
        <ReportUserModal
          key={`${selectedUserForInfo._id}-${showReportModal ? 'open' : 'closed'}`}
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetUserId={selectedUserForInfo._id}
          targetUserName={selectedUserForInfo.name}
        />
      )}
    </div>
  );
}

