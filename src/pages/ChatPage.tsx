/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable react-hooks/purity */
/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  useState, useEffect, useRef, useCallback, useMemo, type ChangeEvent,
} from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import {
  Phone, Video, Info, X,
  ChevronLeft, UserX,
  Pin
} from 'lucide-react';
import { useAuthStore as useAuth } from '../store/authStore';
import { useChatStore as useChat } from '../store/chatStore';
import { useRelationships } from '../hooks/useRelationships';
import { useCallLogic } from '../hooks/useCallLogic';
import { useSidebarMedia } from '../hooks/useSidebarMedia';
import { useGroupManagement } from '../hooks/useGroupManagement';
import { useChatSocketEvents } from '../hooks/useChatSocketEvents';
import {
  conversationsApi, normalizeConversation, type Conversation,
} from '../services/conversations';
import MediaLightbox from '../components/MediaLightbox';
import {
  messagesApi, normalizeMessage, normalizeMessages, type Message,
} from '../services/messages';
import {
  type MediaResponse,
} from '../services/media';
import {
  joinConversation,
  sendTextMessage,
  startTyping,
  stopTyping,
  getSocket,
  markReadSocket,
  revokeMessage,
  updateTextMessage,
} from '../services/socket';
import { useToast } from '../context/ToastContext';
import MessageBubble from '../components/MessageBubble';
import AudioPlayer from '../components/AudioPlayer';
import Modal from '../components/Modal';
import AddMemberModal from '../components/AddMemberModal';
import ConfirmModal from '../components/ConfirmModal';
import MessageReadersModal from '../components/MessageReadersModal';
import ReportUserModal from '../components/ReportUserModal';
import MessageReactionsModal from '../components/MessageReactionsModal';
import PinnedMessagePreview from '../components/PinnedMessagePreview';
import { normalizeId } from '../utils/chat';
import { MIME_TYPES, TIMING } from '../constants/chat';
import { UI_MESSAGES } from '../constants/messages';
import { formatDateVN } from '../utils/date';
import {
  getBanStatusText,
  getUserRestrictionState,
  getConversationName,
  getSenderId,
  getReplyTargetPreview,
  getPinnedMessageSummary,
  getVoiceFileExtension,
  globalMessagesCache,
  findSharedConversationIds,
} from './ChatPage.helpers';
import type { LocalMessage } from './ChatPage.types';
import ChatPageCallOverlay from './ChatPageCallOverlay';
import ChatPageOnlineStatusModal from './ChatPageOnlineStatusModal';
import ChatPageUserInfoModal from './ChatPageUserInfoModal';
import ChatPageComposer from './ChatPageComposer';
import ChatPageInfoSidebar from './ChatPageInfoSidebar';

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

  const [conv, setConv] = useState<Conversation | null>(() => (
    conversations.find((item) => item._id === activeConversationId) ?? null
  ));
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
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  // User Profile Popup States
  const [selectedUserForInfo, setSelectedUserForInfo] = useState<any>(null);
  const [showReportModal, setShowReportModal] = useState(false);


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

  const {
    callState,
    callDurationSeconds,
    isCallMicEnabled,
    isCallCameraEnabled,
    isSwitchingCamera,
    isMobileDevice,
    remoteVideoRef,
    localVideoRef,
    remoteAudioRef,
    handleStartCall,
    handleAcceptCall,
    handleRejectCall,
    handleEndCall,
    handleToggleCallMic,
    handleToggleCallCamera,
    handleSwitchCallCamera,
  } = useCallLogic({
    activeConversationId,
    conv,
    otherUser,
    currentUserId,
    isFriend,
    socket,
    toast,
    navigate,
    location,
  });

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
          findSharedConversationIds(conversationsRef.current, currentUserId, targetUserId)
            .forEach((sharedId) => { delete globalMessagesCache[sharedId]; });
          await reloadMessages(conversationId, true);
          void refetchConversations({ silent: true });
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
          findSharedConversationIds(conversationsRef.current, currentUserId, targetUserId)
            .forEach((sharedId) => { delete globalMessagesCache[sharedId]; });
          if (conversationId) {
            await reloadMessages(conversationId, true);
            refreshSidebarMedia();
          }
          void refetchConversations({ silent: true });
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
        setConv((prev) => {
          if (prev) {
            const prevComparable = { ...prev, _stableKey: undefined };
            const freshComparable = { ...freshConv, _stableKey: undefined };
            if (JSON.stringify(prevComparable) === JSON.stringify(freshComparable)) return prev;
          }
          return freshConv;
        });
        // Sync fresh user data (avatar, name...) back into the sidebar store
        patchConversation(freshConv._id, (prev) => {
          const next = { ...prev, users: freshConv.users, avatar: freshConv.avatar };
          if (JSON.stringify(prev) === JSON.stringify(next)) return prev;
          return next;
        });
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
        if (err?.retryAfterSeconds) {
          toast.countdown('Bạn thao tác quá nhanh, thử lại sau', err.retryAfterSeconds);
        }
      });
  }, [activeConversationId, isSocketConnected, setUsersOnline, toast]);


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

    if (!cached) {
      reloadMessages(activeConversationId).catch(() => {});
    }

    clearUnread(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId, reloadMessages]);

  const {
    sidebarMedia,
    isLoadingSidebarMedia,
    fetchSidebarMedia,
    appendSidebarMedia,
    removeSidebarMedia,
    refreshSidebarMedia,
  } = useSidebarMedia({
    activeConversationId,
    isTempConversation,
    isImagesExpanded,
    isVideosExpanded,
    isFilesExpanded,
  });

  useChatSocketEvents({
    activeConversationId,
    socket,
    currentUserId,
    editingMessageId,
    replyTarget,
    isLeavingOrDisbandingRef,
    setMessages,
    setConv,
    setEditingMessageId,
    setText,
    setReplyTarget,
    markConversationRead,
    updateConversationReadReceipt,
    appendSidebarMedia,
    removeSidebarMedia,
    refreshSidebarMedia,
    reloadMessages,
    patchConversation,
    refetchConversations,
    navigate,
    toast,
  });

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
    if (isLoadingMsgs) return;

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
  }, [activeConversationId, isLoadingMsgs, visibleMessages.length]);

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

        if (ack?.retryAfterSeconds) {
          markMessageError(optimisticId);
          toast.countdown('Bạn gửi tin quá nhanh, thử lại sau', ack.retryAfterSeconds);
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
    resetVoiceDraft();
    await sendMediaMessage('voice', file);
  };

  const {
    isGroupAdmin,
    handleUploadGroupAvatar,
    handleDeleteGroupAvatar,
    handleUpdateGroupName,
    handleLeaveGroup,
    handleDisbandGroup,
    handleRemoveMember,
    handleChangeAdmin,
    handleHideHistory,
  } = useGroupManagement({
    activeConversationId,
    conv,
    currentUserId,
    groupNameInput,
    setConv,
    setEditingGroupName,
    setIsUploadingAvatar,
    setConfirmAction,
    groupAvatarInputRef,
    isLeavingOrDisbandingRef,
    toast,
    navigate,
    refetchConversations,
  });

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
          <div className="chat-header-avatar" style={isTargetUserDisabled ? { background: 'var(--bg-secondary)', display: 'flex', alignItems: 'center', justifyContent: 'center' } : (headerAvatarUrl ? { background: 'none' } : {})}>
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
            {((isLoadingConv && !conv) || memberSummary) && (
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
                {isLoadingConv && !conv ? '...' : memberSummary}
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
      <ChatPageComposer
        imageInputRef={imageInputRef}
        videoInputRef={videoInputRef}
        fileInputRef={fileInputRef}
        inputRef={inputRef}
        emojiPickerRef={emojiPickerRef}
        handleFileChange={handleFileChange}
        isRecordingVoice={isRecordingVoice}
        recordingDuration={recordingDuration}
        cancelVoiceRecording={cancelVoiceRecording}
        stopVoiceRecording={stopVoiceRecording}
        startVoiceRecording={startVoiceRecording}
        showMediaMenu={showMediaMenu}
        setShowMediaMenu={setShowMediaMenu}
        isTempConversation={isTempConversation}
        editingMessageId={editingMessageId}
        text={text}
        setText={setText}
        handleComposerChange={handleComposerChange}
        isMuted={isMuted}
        showHighlightMenu={showHighlightMenu}
        setShowHighlightMenu={setShowHighlightMenu}
        setSuppressHighlightTriggerIndex={setSuppressHighlightTriggerIndex}
        insertHighlightToken={insertHighlightToken}
        handleSend={handleSend}
        showEmojiPicker={showEmojiPicker}
        setShowEmojiPicker={setShowEmojiPicker}
        activeConversationId={activeConversationId}
        startTyping={startTyping}
        stopTyping={stopTyping}
      />
      )}
    </div>

      {/* Info Sidebar */}
      <ChatPageInfoSidebar
        showInfo={showInfo}
        setShowInfo={setShowInfo}
        conv={conv}
        convName={convName}
        currentUserId={currentUserId}
        isGroupAdmin={isGroupAdmin}
        isTargetUserDisabled={isTargetUserDisabled}
        isBlocked={isBlocked}
        iBlockedThem={iBlockedThem}
        headerAvatarUrl={headerAvatarUrl}
        otherUser={otherUser}
        blockedUserIds={blockedUserIds}
        isLoadingConv={isLoadingConv}
        isLoadingRelationships={isLoadingRelationships}
        isUploadingAvatar={isUploadingAvatar}
        editingGroupName={editingGroupName}
        setEditingGroupName={setEditingGroupName}
        groupNameInput={groupNameInput}
        setGroupNameInput={setGroupNameInput}
        isGroupAvatarMenuOpen={isGroupAvatarMenuOpen}
        setIsGroupAvatarMenuOpen={setIsGroupAvatarMenuOpen}
        groupAvatarMenuRef={groupAvatarMenuRef}
        groupAvatarInputRef={groupAvatarInputRef}
        isMembersExpanded={isMembersExpanded}
        setIsMembersExpanded={setIsMembersExpanded}
        memberSearchQuery={memberSearchQuery}
        setMemberSearchQuery={setMemberSearchQuery}
        isImagesExpanded={isImagesExpanded}
        setIsImagesExpanded={setIsImagesExpanded}
        isVideosExpanded={isVideosExpanded}
        setIsVideosExpanded={setIsVideosExpanded}
        isFilesExpanded={isFilesExpanded}
        setIsFilesExpanded={setIsFilesExpanded}
        sidebarMedia={sidebarMedia}
        isLoadingSidebarMedia={isLoadingSidebarMedia}
        fetchSidebarMedia={fetchSidebarMedia}
        setLightboxMedias={setLightboxMedias}
        setLightboxIndex={setLightboxIndex}
        setSelectedGroupMedia={setSelectedGroupMedia}
        handleUploadGroupAvatar={handleUploadGroupAvatar}
        handleDeleteGroupAvatar={handleDeleteGroupAvatar}
        handleUpdateGroupName={handleUpdateGroupName}
        handleShowUserProfile={handleShowUserProfile}
        handleChangeAdmin={handleChangeAdmin}
        handleRemoveMember={handleRemoveMember}
        setShowAddMemberModal={setShowAddMemberModal}
        handleHideHistory={handleHideHistory}
        handleDisbandGroup={handleDisbandGroup}
        handleLeaveGroup={handleLeaveGroup}
        handleBlockRequest={handleBlockRequest}
        handleUnblockRequest={handleUnblockRequest}
        toast={toast}
      />

      {callState && (
        <ChatPageCallOverlay
          callState={callState}
          callDurationSeconds={callDurationSeconds}
          isCallMicEnabled={isCallMicEnabled}
          isCallCameraEnabled={isCallCameraEnabled}
          isSwitchingCamera={isSwitchingCamera}
          isMobileDevice={isMobileDevice}
          remoteVideoRef={remoteVideoRef}
          localVideoRef={localVideoRef}
          remoteAudioRef={remoteAudioRef}
          handleEndCall={handleEndCall}
          handleRejectCall={handleRejectCall}
          handleAcceptCall={handleAcceptCall}
          handleToggleCallMic={handleToggleCallMic}
          handleToggleCallCamera={handleToggleCallCamera}
          handleSwitchCallCamera={handleSwitchCallCamera}
        />
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
              <PinnedMessagePreview message={selectedPinnedMessage} />
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
        <ChatPageUserInfoModal
          selectedUserForInfo={selectedUserForInfo}
          currentUserId={currentUserId}
          userId={user?._id}
          friends={friends}
          sentRequests={sentRequests}
          isSendingRequest={isSendingRequest}
          sendRequest={sendRequest}
          toast={toast}
          onClose={() => setSelectedUserForInfo(null)}
          onOpenReport={() => setShowReportModal(true)}
          onStartDirectChat={handleStartDirectChat}
        />
      )}
      {/* Online/Offline Status Modal */}
      {showOnlineModal && conv?.isGroup && (
        <ChatPageOnlineStatusModal
          conv={conv}
          online={online}
          user={user}
          onClose={() => setShowOnlineModal(false)}
        />
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

