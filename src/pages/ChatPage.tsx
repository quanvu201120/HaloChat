import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, Phone, Video, Info, Smile, Paperclip, Image, Mic, Square, X,
  Camera, Trash2, LogOut, ShieldOff, Check, Pencil, UserPlus, UserMinus, Crown, History, ChevronDown, ChevronRight, FileText
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import {
  conversationsApi, normalizeConversation, type Conversation,
} from '../services/conversations';
import {
  messagesApi, normalizeMessage, normalizeMessages, type Message,
} from '../services/messages';
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
import MessageReactionsModal from '../components/MessageReactionsModal';
import { normalizeId } from '../utils/chat';

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

type LocalMessage = Message & {
  _error?: boolean;
};

function getConversationName(conv: Conversation, currentUserId: string): string {
  if (conv.isGroup) return conv.name || 'Nhóm chưa đặt tên';
  const other = conv.users.find((u) => u._id !== currentUserId);
  return other?.name || other?.email || 'Người dùng';
}

function getSenderId(message: Message): string {
  return normalizeId(typeof message.sender === 'string' ? message.sender : message.sender?._id);
}

function getReplyTargetPreview(replyTarget: Message | null) {
  if (!replyTarget) return '';
  if (replyTarget.isDeleted) return 'Tin nhắn đã thu hồi';
  if (replyTarget.type === 'text') return replyTarget.content || 'Tin nhắn văn bản';
  if (replyTarget.type === 'image') return 'Hình ảnh';
  if (replyTarget.type === 'video') return 'Video';
  if (replyTarget.type === 'voice') return 'Tin nhắn thoại';
  if (replyTarget.type === 'file') return 'Tệp đính kèm';
  return 'Tin nhắn';
}

function getVoiceFileExtension(mimeType: string) {
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('wav')) return 'wav';
  if (mimeType.includes('mpeg')) return 'mp3';
  if (mimeType.includes('aac')) return 'aac';
  if (mimeType.includes('mp4')) return 'm4a';
  return 'webm';
}

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

export default function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const activeConversationId = normalizeId(conversationId);
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    conversations,
    online,
    typing,
    clearUnread,
    isSocketConnected,
    setUsersOnline,
    hasLoadedConversations,
    syncConversationMessage,
    refetchConversations,
  } = useChat();
  const toast = useToast();

  const [conv, setConv] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [loadedMessagesConversationId, setLoadedMessagesConversationId] = useState('');
  const [isLoadingConv, setIsLoadingConv] = useState(true);
  const [isLoadingMsgs, setIsLoadingMsgs] = useState(true);
  const [isFetchingMore, setIsFetchingMore] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [text, setText] = useState('');
  const [replyTarget, setReplyTarget] = useState<Message | null>(null);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const [voiceUrl, setVoiceUrl] = useState<string>('');
  const [voiceMimeType, setVoiceMimeType] = useState('audio/webm');
  const [isRecordingVoice, setIsRecordingVoice] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [showInfo, setShowInfo] = useState(false);
  const [isMembersExpanded, setIsMembersExpanded] = useState(true);
  const [isImagesExpanded, setIsImagesExpanded] = useState(false);
  const [isVideosExpanded, setIsVideosExpanded] = useState(false);
  const [isFilesExpanded, setIsFilesExpanded] = useState(false);
  const [editingGroupName, setEditingGroupName] = useState(false);
  const [groupNameInput, setGroupNameInput] = useState('');
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showOnlineModal, setShowOnlineModal] = useState(false);
  const [readersModalData, setReadersModalData] = useState<{ isOpen: boolean; readers: string[] }>({ isOpen: false, readers: [] });
  const [reactionsModalData, setReactionsModalData] = useState<{ isOpen: boolean; message: Message | null }>({ isOpen: false, message: null });
  const [confirmAction, setConfirmAction] = useState<{
    title: string;
    message: string;
    isDanger?: boolean;
    confirmText?: string;
    action: () => void | Promise<void>;
  } | null>(null);
  const groupAvatarInputRef = useRef<HTMLInputElement>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
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
    .map((id) => conv?.users.find((u) => u._id === id)?.name || conv?.users.find((u) => u._id === id)?.email || 'ai đó');

  const visibleMessages = useMemo(() => (
    loadedMessagesConversationId === activeConversationId
      ? messages.filter((message) => normalizeId(message.conversationId) === activeConversationId)
      : []
  ), [activeConversationId, loadedMessagesConversationId, messages]);

  const otherUser = conv && !conv.isGroup
    ? conv.users.find((u) => u._id !== currentUserId)
    : null;
  const isOtherOnline = otherUser ? online[otherUser._id] === true : false;
  const convName = conv ? getConversationName(conv, currentUserId) : '...';
  const headerAvatarUrl = conv?.isGroup 
    ? (conv.avatar?.url || '') 
    : (otherUser?.avatar?.url || '');

  // Tick counter to refresh relative time display every minute
  const [, setTick] = useState(0);
  useEffect(() => {
    if (conv?.isGroup || isOtherOnline) return;
    const interval = setInterval(() => setTick((t) => t + 1), 60_000);
    return () => clearInterval(interval);
  }, [conv?.isGroup, isOtherOnline]);

  const memberSummary = useMemo(() => {
    if (!conv) return '';
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

    return `${conv.users.length} thành viên`;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conv, isOtherOnline, otherUser, online]);

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
    setVoiceMimeType('audio/webm');
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

  useEffect(() => {
    hasHandledMissingConversationRef.current = false;
    const requestId = ++conversationRequestIdRef.current;

    if (!activeConversationId) {
      setConv(null);
      setIsLoadingConv(false);
      return;
    }

    const syncedConversation = conversations.find((item) => item._id === activeConversationId);
    if (syncedConversation) {
      setConv(syncedConversation);
    }

    setIsLoadingConv(true);
    conversationsApi.getOne(activeConversationId)
      .then((res) => {
        if (conversationRequestIdRef.current !== requestId) return;
        setConv(normalizeConversation(res.data?.data ?? res.data));
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
  }, [activeConversationId, conversations]);

  useEffect(() => {
    if (!activeConversationId || !hasLoadedConversations || isLoadingConv || conv) return;
    if (hasHandledMissingConversationRef.current) return;

    hasHandledMissingConversationRef.current = true;
    toast.error('Cuoc tro chuyen khong con kha dung');
    navigate('/', { replace: true });
  }, [activeConversationId, conv, hasLoadedConversations, isLoadingConv, navigate, toast]);

  useEffect(() => {
    if (!activeConversationId || !isSocketConnected) return;

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
      return;
    }
    const requestId = ++messagesRequestIdRef.current;
    setIsLoadingMsgs(true);
    setMessages([]);
    setLoadedMessagesConversationId('');
    setHasMore(true);
    setReplyTarget(null);
    setEditingMessageId(null);
    setText('');
    setVoiceBlob(null);
    setVoiceUrl('');
    setVoiceMimeType('audio/webm');

    messagesApi.getList(activeConversationId)
      .then((res) => {
        if (messagesRequestIdRef.current !== requestId) return;
        const list = normalizeMessages((res.data as any)?.data ?? res.data);
        const ordered = [...list].reverse();
        setMessages(ordered);
        setLoadedMessagesConversationId(activeConversationId);
        setHasMore(list.length === 20);
        markConversationRead(ordered[ordered.length - 1]);
      })
      .catch(() => toast.error('Không tải được tin nhắn'))
      .finally(() => {
        if (messagesRequestIdRef.current !== requestId) return;
        setIsLoadingMsgs(false);
      });

    clearUnread(activeConversationId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

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

      if (getSenderId(message) !== currentUserId) {
        markConversationRead(message);
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
      setMessages((prev) => prev.map((item) => (
        item._id === data.messageId
          ? {
            ...item,
            isDeleted: true,
            content: '',
            reactions: [],
          }
          : item
      )));
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

    const onMemberAdded = () => {};

    const onMemberRemoved = (data: { conversationId: string; removedMemberId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (data.removedMemberId === currentUserId) {
        if (!isLeavingOrDisbandingRef.current) {
          toast.error('Ban da bi xoa khoi cuoc tro chuyen');
        }
        navigate('/', { replace: true });
        return;
      }
    };

    const onConversationDisbanded = (data: { conversationId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      if (!isLeavingOrDisbandingRef.current) {
        toast.error('Nhom nay da giai tan');
      }
      navigate('/', { replace: true });
    };

    socket.on('chat:new-message', onNewMessage);
    socket.on('message:updated', onMessageUpdated);
    socket.on('chat:message-deleted', onMessageDeleted);
    socket.on('user:mark-read', onMarkRead);
    socket.on('conversation:name-changed', onConversationNameChanged);
    socket.on('conversation:member-added', onMemberAdded);
    socket.on('conversation:member-removed', onMemberRemoved);
    socket.on('conversation:disbanded', onConversationDisbanded);

    return () => {
      socket.off('chat:new-message', onNewMessage);
      socket.off('message:updated', onMessageUpdated);
      socket.off('chat:message-deleted', onMessageDeleted);
      socket.off('user:mark-read', onMarkRead);
      socket.off('conversation:name-changed', onConversationNameChanged);
      socket.off('conversation:member-added', onMemberAdded);
      socket.off('conversation:member-removed', onMemberRemoved);
      socket.off('conversation:disbanded', onConversationDisbanded);
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
  ]);

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
    messagesEndRef.current?.scrollIntoView({ behavior: prevLen === 0 ? 'instant' : 'smooth' });
  }, [visibleMessages.length]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isFetchingMore || !hasMore || visibleMessages.length === 0 || !activeConversationId) return;
    if (container.scrollTop > 60) return;

    const oldest = visibleMessages[0];
    if (!oldest) return;

    // Snapshot scroll height BEFORE prepending, so we can restore position after
    prevScrollHeightRef.current = container.scrollHeight;
    isPrependingRef.current = true;

    setIsFetchingMore(true);
    messagesApi.getList(activeConversationId, oldest.createdAt)
      .then((res) => {
        const older = normalizeMessages((res.data as any)?.data ?? res.data);
        if (older.length < 20) setHasMore(false);
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

  const replaceOptimisticMessage = useCallback((optimisticId: string, nextMessage: Message) => {
    setMessages((prev) => prev.map((item) => (
      item._id === optimisticId ? { ...nextMessage, _error: false } : item
    )));
  }, []);

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

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !activeConversationId) return;

    if (editingMessageId) {
      replaceMessageLocally(editingMessageId, (message) => ({
        ...message,
        content,
        updatedAt: new Date().toISOString(),
      }));
      updateTextMessage(activeConversationId, editingMessageId, content, (ack: any) => {
        if (!ack?.ok) {
          toast.error(ack?.message || 'Không sửa được tin nhắn');
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
            toast.error('Gửi tin nhắn thất bại');
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
      toast.error('Gửi tin nhắn thất bại');
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
      toast.error(error?.response?.data?.message || 'Gửi media thất bại');
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
      toast.error(error?.response?.data?.message || 'Không cập nhật được cảm xúc');
    }
  };

  const handleEditMessage = (message: Message) => {
    setEditingMessageId(message._id);
    setReplyTarget(null);
    setText(message.content || '');
  };

  const handleDeleteMessage = (message: Message) => {
    if (!activeConversationId) return;
    if (!window.confirm('Thu hồi tin nhắn này?')) return;

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
        toast.error(ack?.message || 'Không thu hồi được tin nhắn');
      }
    });
  };

  const startVoiceRecording = async () => {
    if (!activeConversationId) {
      toast.error('Chọn cuộc trò chuyện trước khi ghi âm');
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      toast.error('Trình duyệt không hỗ trợ ghi âm');
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
      toast.error('Không thể bật microphone');
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
    if (!voiceBlob) return;
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
      toast.success('Cập nhật ảnh đại diện nhóm thành công');
    } catch {
      toast.error('Cập nhật ảnh đại diện thất bại');
    } finally {
      setIsUploadingAvatar(false);
      if (groupAvatarInputRef.current) groupAvatarInputRef.current.value = '';
    }
  };

  const handleDeleteGroupAvatar = async () => {
    if (!activeConversationId) return;
    try {
      await conversationsApi.deleteAvatar(activeConversationId);
      setConv((prev) => prev ? { ...prev, avatar: undefined } : prev);
      toast.success('Đã xóa ảnh đại diện nhóm');
    } catch {
      toast.error('Xóa ảnh đại diện thất bại');
    }
  };

  const handleUpdateGroupName = async () => {
    if (!activeConversationId || !groupNameInput.trim()) return;
    try {
      await conversationsApi.updateName(activeConversationId, groupNameInput.trim());
      setConv((prev) => prev ? { ...prev, name: groupNameInput.trim() } : prev);
      setEditingGroupName(false);
      toast.success('Đã cập nhật tên nhóm');
    } catch {
      toast.error('Cập nhật tên nhóm thất bại');
    }
  };

  const handleLeaveGroup = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Rời nhóm',
      message: 'Bạn có chắc muốn rời nhóm này không?',
      isDanger: true,
      confirmText: 'Rời nhóm',
      action: async () => {
        isLeavingOrDisbandingRef.current = true;
        try {
          await conversationsApi.leaveGroup(activeConversationId);
          navigate('/', { replace: true });
          toast.success('Đã rời nhóm');
        } catch {
          toast.error('Rời nhóm thất bại');
        }
      }
    });
  };

  const handleDisbandGroup = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Giải tán nhóm',
      message: 'Giải tán nhóm sẽ xóa toàn bộ tin nhắn và không thể khôi phục. Bạn có chắc chắn muốn tiếp tục?',
      isDanger: true,
      confirmText: 'Giải tán',
      action: async () => {
        isLeavingOrDisbandingRef.current = true;
        try {
          await conversationsApi.disbandGroup(activeConversationId);
          navigate('/', { replace: true });
          toast.success('Đã giải tán nhóm');
        } catch {
          toast.error('Giải tán nhóm thất bại');
        }
      }
    });
  };

  const handleRemoveMember = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa thành viên',
      message: `Bạn có chắc muốn xóa ${memberName} khỏi nhóm?`,
      isDanger: true,
      confirmText: 'Xóa khỏi nhóm',
      action: async () => {
        try {
          await conversationsApi.removeMember(activeConversationId, memberId);
          setConv((prev) => prev ? { ...prev, users: prev.users.filter(u => u._id !== memberId) } : prev);
          toast.success(`Đã xóa ${memberName} khỏi nhóm`);
        } catch {
          toast.error('Xóa thành viên thất bại');
        }
      }
    });
  };

  const handleChangeAdmin = (memberId: string, memberName: string) => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Chuyển quyền quản trị',
      message: `Bạn có chắc muốn chuyển quyền quản trị cho ${memberName} không? Bạn sẽ trở thành thành viên thường.`,
      isDanger: true,
      confirmText: 'Chuyển quyền',
      action: async () => {
        try {
          await conversationsApi.changeAdmin(activeConversationId, memberId);
          setConv((prev) => prev ? { ...prev, adminGroupId: memberId } : prev);
          toast.success(`Đã chuyển quyền quản trị cho ${memberName}`);
        } catch {
          toast.error('Chuyển quyền quản trị thất bại');
        }
      }
    });
  };

  const handleHideHistory = () => {
    if (!activeConversationId) return;
    setConfirmAction({
      title: 'Xóa lịch sử chat',
      message: 'Lịch sử đoạn chat này sẽ bị ẩn đối với bạn. Bạn có chắc chắn muốn xóa không?',
      isDanger: true,
      confirmText: 'Xóa lịch sử',
      action: async () => {
        try {
          await conversationsApi.hideHistory(activeConversationId);
          void refetchConversations({ silent: true });
          navigate('/', { replace: true });
          toast.success('Đã xóa lịch sử chat');
        } catch {
          toast.error('Xóa lịch sử chat thất bại');
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

  return (
    <div className="chat-page-layout">
      <div className="chat-page">
      <div className="chat-header">
        <div className="chat-header-info">
          <div className="chat-header-avatar">
            {headerAvatarUrl ? (
              <img src={headerAvatarUrl} alt={convName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
            ) : (
              <span>{convName.slice(0, 2).toUpperCase()}</span>
            )}
            {isOtherOnline && <span className="online-dot" style={{ position: 'absolute', bottom: 1, right: 1 }} />}
          </div>
          <div>
            <div className="chat-header-name">{convName}</div>
            <div 
              className="chat-header-sub"
              style={{ cursor: 'pointer', userSelect: 'none' }}
              onClick={() => {
                if (conv?.isGroup) setShowOnlineModal(true);
              }}
              title={conv?.isGroup ? "Nhấp để xem ai đang online" : ""}
            >
              {isLoadingConv ? '...' : memberSummary}
            </div>
          </div>
        </div>

        <div className="chat-header-actions">
          <button className="icon-btn" title="Gọi thoại">
            <Phone size={18} />
          </button>
          <button className="icon-btn" title="Video call">
            <Video size={18} />
          </button>
          <button className={`icon-btn${showInfo ? ' active' : ''}`} title="Thông tin hội thoại" onClick={() => setShowInfo((v) => !v)}>
            <Info size={18} />
          </button>
        </div>
      </div>

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
            return (
              <MessageBubble
                key={message._id}
                message={message}
                isMe={getSenderId(message) === currentUserId}
                prevMessage={index > 0 ? visibleMessages[index - 1] : undefined}
                currentUserId={currentUserId}
                isGroup={conv?.isGroup}
                senderAvatarUrl={typeof message.sender === 'object' ? message.sender?.avatar?.url : undefined}
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
                  setReplyTarget(message);
                  setEditingMessageId(null);
                }}
                onEdit={() => handleEditMessage(message)}
                onDelete={() => handleDeleteMessage(message)}
                onToggleReaction={(reactionType: string) => handleToggleReaction(message, reactionType)}
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
            <button className="btn btn-primary" onClick={handleSendVoice}>Gửi voice</button>
          </div>
        </div>
      )}

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
              <X size={18} />
            </button>
            <div className="voice-recording-pill">
              <button className="voice-stop-btn" onClick={stopVoiceRecording} title="Dừng và xem trước">
                <Square size={14} fill="currentColor" />
              </button>
              <span className="voice-timer">{formatDuration(recordingDuration)}</span>
            </div>
            <button className="icon-btn send-voice-btn" onClick={() => {
              stopVoiceRecording();
            }} title="Xong">
              <Send size={18} />
            </button>
          </div>
        ) : (
          <>
            <button className="icon-btn" title="Đính kèm file" onClick={() => fileInputRef.current?.click()}>
              <Paperclip size={18} />
            </button>
            <button className="icon-btn" title="Gửi ảnh" onClick={() => imageInputRef.current?.click()}>
              <Image size={18} />
            </button>
            <button className="icon-btn" title="Gửi video" onClick={() => videoInputRef.current?.click()}>
              <Video size={18} />
            </button>
            <button
              className="icon-btn"
              title="Ghi âm"
              onClick={startVoiceRecording}
            >
              <Mic size={18} />
            </button>
            <input
              className="composer-input"
              placeholder={editingMessageId ? 'Chỉnh sửa tin nhắn...' : 'Nhập tin nhắn...'}
              value={text}
              onChange={(event) => handleTextChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              onBlur={() => {
                if (activeConversationId) stopTyping(activeConversationId);
              }}
              autoFocus
            />
            <button className="icon-btn" title="Emoji">
              <Smile size={18} />
            </button>
            <button
              className={`composer-send${text.trim() ? ' active' : ''}`}
              onClick={handleSend}
              disabled={!text.trim()}
              title={editingMessageId ? 'Lưu thay đổi' : 'Gửi'}
            >
              <Send size={18} />
            </button>
          </>
        )}
      </div>
    </div>

      {/* Info Sidebar */}
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
              <div className="info-sidebar-avatar">
                {conv?.avatar?.url ? (
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
                <div className="info-avatar-actions">
                  <button
                    className="info-avatar-btn"
                    title="Đổi ảnh đại diện nhóm"
                    onClick={() => groupAvatarInputRef.current?.click()}
                  >
                    <Camera size={14} />
                  </button>
                  {conv.avatar?.url && (
                    <button
                      className="info-avatar-btn danger"
                      title="Xóa ảnh đại diện"
                      onClick={handleDeleteGroupAvatar}
                    >
                      <Trash2 size={14} />
                    </button>
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
              <div className="info-sidebar-name">{convName}</div>
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
                <div className="info-sidebar-members">
                  {conv.users.map((member) => {
                  const avatar = typeof member.avatar === 'object' && member.avatar?.url
                    ? member.avatar.url
                    : typeof member.avatar === 'string' ? member.avatar : null;
                  const displayName = member.name || member.email || 'Người dùng';
                  const isMemberAdmin = conv.adminGroupId === member._id;
                  return (
                    <div key={member._id} className="info-sidebar-member">
                      <div className="info-sidebar-member-avatar">
                        {avatar
                          ? <img src={avatar} alt={displayName} />
                          : <span>{displayName.slice(0, 1).toUpperCase()}</span>}
                      </div>
                      <div className="info-sidebar-member-info">
                        <div className="info-sidebar-member-name">
                          {displayName}
                          {member._id === currentUserId && <span className="info-badge-me">Bạn</span>}
                          {isMemberAdmin && <span className="info-badge-admin">Quản trị viên</span>}
                        </div>
                      </div>
                      {isGroupAdmin && !isMemberAdmin && (
                        <div style={{ display: 'flex', gap: '4px' }}>
                          <button
                            className="icon-btn info-member-more"
                            title="Nhường quyền quản trị"
                            onClick={() => handleChangeAdmin(member._id, displayName)}
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
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Chưa có hình ảnh nào
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
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Chưa có video nào
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
              <div style={{ padding: '16px 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '13px' }}>
                Chưa có file nào
              </div>
            )}
          </div>

          {/* Danger Zone */}
          <div className="info-sidebar-danger-zone">
            <button
              className="info-danger-btn leave"
              style={{ marginBottom: conv?.isGroup ? '8px' : '0' }}
              onClick={handleHideHistory}
            >
              <History size={16} />
              <span>Xóa lịch sử chat</span>
            </button>
            
            {conv?.isGroup && (
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
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && activeConversationId && conv && (
        <AddMemberModal
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

      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={!!confirmAction}
        title={confirmAction?.title || ''}
        message={confirmAction?.message || ''}
        isDanger={confirmAction?.isDanger}
        confirmText={confirmAction?.confirmText}
        onConfirm={() => {
          if (confirmAction?.action) confirmAction.action();
        }}
        onCancel={() => setConfirmAction(null)}
      />
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
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px' }}>
                <div style={{ position: 'relative', width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                  {u.avatar && typeof u.avatar === 'object' && u.avatar.url ? (
                    <img src={u.avatar.url} alt={u.name || u.email} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    (u.name || u.email || '?').slice(0, 1).toUpperCase()
                  )}
                  <span className="online-dot" style={{ position: 'absolute', bottom: 0, right: 0, width: 10, height: 10, border: '2px solid var(--bg-card)' }} />
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{u.name || u.email} {u._id === user?._id && '(Bạn)'}</div>
                </div>
              </div>
            ))}

            <div style={{ padding: '16px 20px 8px', fontSize: '13px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Ngoại tuyến
            </div>
            {conv.users.filter(u => online[u._id] !== true && u._id !== user?._id).map(u => (
              <div key={u._id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 20px', opacity: 0.7 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent-primary), var(--accent-secondary))', color: 'white', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 600 }}>
                  {u.avatar && typeof u.avatar === 'object' && u.avatar.url ? (
                    <img src={u.avatar.url} alt={u.name || u.email} style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                  ) : (
                    (u.name || u.email || '?').slice(0, 1).toUpperCase()
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>{u.name || u.email}</div>
                </div>
              </div>
            ))}
          </div>
        </Modal>
      )}
    </div>
  );
}
