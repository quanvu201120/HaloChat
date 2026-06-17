import {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Send, Phone, Video, Info, Smile, Paperclip, Image, Mic, Square, X,
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
import { normalizeId } from '../utils/chat';

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

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const mediaChunksRef = useRef<Blob[]>([]);
  const hasHandledMissingConversationRef = useRef(false);
  const messagesRequestIdRef = useRef(0);
  const conversationRequestIdRef = useRef(0);
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
  const isOtherOnline = otherUser ? !!online[otherUser._id] : false;
  const convName = conv ? getConversationName(conv, currentUserId) : '...';
  const headerAvatarUrl = conv?.avatar?.url || otherUser?.avatar?.url || '';
  const otherMemberIds = useMemo(
    () => (conv?.users ?? []).map((member) => member._id).filter((id) => id !== currentUserId),
    [conv?.users, currentUserId],
  );

  const memberSummary = useMemo(() => {
    if (!conv) return '';
    if (!conv.isGroup) {
      return isOtherOnline ? 'Đang hoạt động' : 'Không hoạt động';
    }

    return `${conv.users.length} thành viên`;
  }, [conv, isOtherOnline]);

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

  const getReadStatusLabel = useCallback((message: Message) => {
    if (!conv?.readReceipts || message._id.startsWith('opt_')) return undefined;

    const readers = Object.entries(conv.readReceipts)
      .filter(([userId, messageId]) => userId !== currentUserId && messageId === message._id);

    if (readers.length === 0) return undefined;
    if (conv.isGroup) return `Da xem boi ${readers.length} nguoi`;
    return 'Da xem';
  }, [conv, currentUserId]);

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
    };

    const onMessageDeleted = (data: { messageId: string; conversationId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      setMessages((prev) => prev.map((item) => (
        item._id === data.messageId ? { ...item, isDeleted: true } : item
      )));
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
        toast.error('Ban da bi xoa khoi cuoc tro chuyen');
        navigate('/', { replace: true });
        return;
      }
    };

    const onConversationDisbanded = (data: { conversationId: string }) => {
      if (normalizeId(data.conversationId) !== activeConversationId) return;
      toast.error('Nhom nay da giai tan');
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
    socket,
    currentUserId,
    markConversationRead,
    navigate,
    toast,
    updateConversationReadReceipt,
  ]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [visibleMessages.length]);

  const handleScroll = useCallback(() => {
    const container = messagesContainerRef.current;
    if (!container || isFetchingMore || !hasMore || visibleMessages.length === 0 || !activeConversationId) return;
    if (container.scrollTop > 60) return;

    const oldest = visibleMessages[0];
    if (!oldest) return;

    setIsFetchingMore(true);
    messagesApi.getList(activeConversationId, oldest.createdAt)
      .then((res) => {
        const older = normalizeMessages((res.data as any)?.data ?? res.data);
        if (older.length < 20) setHasMore(false);
        setMessages((prev) => [...older.reverse(), ...prev]);
      })
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

  const markMessageError = useCallback((optimisticId: string) => {
    setMessages((prev) => prev.map((item) => (
      item._id === optimisticId ? { ...item, _error: true } : item
    )));
  }, []);

  const handleSend = async () => {
    const content = text.trim();
    if (!content || !activeConversationId) return;

    if (editingMessageId) {
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

    try {
      if (myReaction === reactionType) {
        await messagesApi.removeReaction(message._id, activeConversationId);
      } else {
        await messagesApi.addReaction(message._id, activeConversationId, reactionType);
      }
    } catch (error: any) {
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

    revokeMessage(activeConversationId, message._id, (ack: any) => {
      if (!ack?.ok) {
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
      setVoiceMimeType(recorder.mimeType || 'audio/webm');
      setIsRecordingVoice(true);

      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) {
          mediaChunksRef.current.push(event.data);
        }
      });

      recorder.addEventListener('stop', () => {
        const blob = new Blob(mediaChunksRef.current, {
          type: recorder.mimeType || 'audio/webm',
        });
        if (blob.size > 0) {
          const nextUrl = URL.createObjectURL(blob);
          setVoiceBlob(blob);
          setVoiceUrl(nextUrl);
        }
        setIsRecordingVoice(false);
        stopVoiceStream();
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

  return (
    <div className="chat-page">
      <div style={{ position: 'absolute', top: 0, right: 0, zIndex: 9999, background: 'red', color: 'white' }}>
        DEBUG ID: {activeConversationId} | URL: {window.location.pathname}
      </div>
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
            <div className="chat-header-sub">
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
          <button className="icon-btn" title="Thông tin hội thoại">
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
                readStatusLabel={getReadStatusLabel(message)}
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
          <audio controls preload="metadata" src={voiceUrl} className="voice-preview-audio" />
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
          className={`icon-btn${isRecordingVoice ? ' recording' : ''}`}
          title={isRecordingVoice ? 'Dừng ghi âm' : 'Ghi âm'}
          onClick={isRecordingVoice ? stopVoiceRecording : startVoiceRecording}
        >
          {isRecordingVoice ? <Square size={18} /> : <Mic size={18} />}
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
      </div>
    </div>
  );
}
