import { useEffect } from 'react';
import { useAuthStore } from '../store/authStore';
import { useChatStore } from '../store/chatStore';
import { connectSocket, disconnectSocket } from '../services/socket';
import { normalizeId } from '../utils/chat';
import { normalizeMessage } from '../services/messages';
import { useToast } from '../context/ToastContext';
import { useNavigate } from 'react-router-dom';
import { queryClient } from '../lib/queryClient';

export default function SocketManager() {
  const toast = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    // We subscribe to the store instead of calling hook directly to avoid unnecessary re-renders of the manager component
    const unsubAuth = useAuthStore.subscribe((state, prevState) => {
      if (state.user?.muteUntil !== prevState.user?.muteUntil) {
        syncMuteExpiration(state.user?.muteUntil);
      }

      if (state.accessToken !== prevState.accessToken || state.user?._id !== prevState.user?._id) {
        initSocket();
      }
    });

    let currentSock: ReturnType<typeof connectSocket> | null = null;
    let muteTimer: ReturnType<typeof setTimeout> | null = null;

    const clearMuteTimer = () => {
      if (muteTimer) {
        clearTimeout(muteTimer);
        muteTimer = null;
      }
    };

    const syncMuteExpiration = (muteUntil?: string) => {
      clearMuteTimer();
      if (!muteUntil) return;

      const muteUntilDate = new Date(muteUntil);
      const delay = muteUntilDate.getTime() - Date.now();
      if (Number.isNaN(muteUntilDate.getTime()) || delay <= 0) {
        useAuthStore.getState().updateUser({ muteUntil: undefined });
        return;
      }

      muteTimer = setTimeout(() => {
        const currentMuteUntil = useAuthStore.getState().user?.muteUntil;
        if (currentMuteUntil === muteUntil) {
          useAuthStore.getState().updateUser({ muteUntil: undefined });
        }
      }, delay);
    };

    const initSocket = () => {
      const { user, accessToken } = useAuthStore.getState();
      const currentUserId = user?._id || '';

      if (currentSock) {
        disconnectSocket();
        currentSock = null;
      }

      if (!currentUserId || !accessToken) return;

      syncMuteExpiration(user?.muteUntil);

      const sock = connectSocket(accessToken);
      currentSock = sock;

      const chatStore = useChatStore.getState();

      const onConnect = () => chatStore.setIsSocketConnected(true);
      const onDisconnect = () => chatStore.setIsSocketConnected(false);

      const onUnseenMessage = (data: { conversationId: string }) => {
        const conversationId = normalizeId(data.conversationId);
        if (!conversationId) return;
        useChatStore.getState().setUnread((prev) => ({ ...prev, [conversationId]: true }));
        void useChatStore.getState().fetchConversationById(conversationId);
      };

      const onUserOnline = (data: { userId: string }) => {
        const userId = normalizeId(data.userId);
        if (!userId) return;
        useChatStore.getState().setOnline((prev) => ({ ...prev, [userId]: true }));
      };

      const onUserOffline = (data: { userId: string; lastOnlineAt?: string }) => {
        const userId = normalizeId(data.userId);
        if (!userId) return;
        useChatStore.getState().setOnline((prev) => ({ ...prev, [userId]: data.lastOnlineAt || new Date().toISOString() }));
      };

      const onTypingUpdate = (data: { conversationId: string; userId: string; typing: boolean }) => {
        const conversationId = normalizeId(data.conversationId);
        const userId = normalizeId(data.userId);

        if (!conversationId || !userId || userId === currentUserId) return;

        useChatStore.getState().setTyping((prev) => {
          const current = prev[conversationId] ?? [];
          if (data.typing) {
            if (current.includes(userId)) return prev;
            return { ...prev, [conversationId]: [...current, userId] };
          }
          return { ...prev, [conversationId]: current.filter((id) => id !== userId) };
        });
      };

      const onUnseenCleared = (data: { conversationId: string }) => {
        const conversationId = normalizeId(data.conversationId);
        if (!conversationId) return;
        useChatStore.getState().clearUnread(conversationId);
      };

      const onConversationDisbanded = (data: { conversationId: string }) => {
        const conversationId = normalizeId(data.conversationId);
        if (!conversationId) return;

        useChatStore.getState().setConversations((prev) => prev.filter((item) => item._id !== conversationId));
        useChatStore.getState().setUnread((prev) => {
          if (!prev[conversationId]) return prev;
          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
        useChatStore.getState().setTyping((prev) => {
          if (!prev[conversationId]) return prev;
          const next = { ...prev };
          delete next[conversationId];
          return next;
        });
      };

      const onNewMessage = (rawMessage: any) => {
        useChatStore.getState().syncConversationMessage(normalizeMessage(rawMessage));
      };

      const onMessageUpdated = (rawMessage: any) => {
        const message = normalizeMessage(rawMessage);
        useChatStore.getState().patchConversation(message.conversationId, (conversation) => ({
          ...conversation,
          lastMessage: conversation.lastMessage?._id === message._id
            ? { ...conversation.lastMessage, ...message }
            : conversation.lastMessage,
        }));
      };

      const onMessageDeleted = (data: { conversationId: string; messageId: string }) => {
        const conversationId = normalizeId(data.conversationId);
        const messageId = normalizeId(data.messageId);
        if (!conversationId || !messageId) return;

        useChatStore.getState().patchConversation(conversationId, (conversation) => {
          if (conversation.lastMessage?._id !== messageId) return conversation;
          return {
            ...conversation,
            lastMessage: { ...conversation.lastMessage, isDeleted: true },
          };
        });
      };

      const onMarkRead = (data: { conversationId: string; userId: string; messageId: string }) => {
        const conversationId = normalizeId(data.conversationId);
        const userId = normalizeId(data.userId);
        const messageId = normalizeId(data.messageId);
        if (!conversationId || !userId || !messageId) return;

        useChatStore.getState().patchConversation(conversationId, (conversation) => ({
          ...conversation,
          readReceipts: {
            ...(conversation.readReceipts ?? {}),
            [userId]: messageId,
          },
        }));

        if (userId === currentUserId) {
          useChatStore.getState().clearUnread(conversationId);
        }
      };

      const onConversationNameChanged = (data: { conversationId: string; name: string }) => {
        const conversationId = normalizeId(data.conversationId);
        if (!conversationId) return;
        useChatStore.getState().patchConversation(conversationId, (conversation) => ({
          ...conversation,
          name: data.name,
        }));
      };

      const onGroupCreated = () => { void useChatStore.getState().refetchConversations({ silent: true }); };
      const onConversationRestored = () => { void useChatStore.getState().refetchConversations({ silent: true }); };
      const onAdminChanged = (data: { conversationId: string; newAdminId: string }) => {
        const convId = normalizeId(data.conversationId);
        if (convId) {
          useChatStore.getState().patchConversation(convId, (prev) => ({ ...prev, adminGroupId: data.newAdminId }));
        }
        void useChatStore.getState().refetchConversations({ silent: true });
      };
      const onMemberAdded = () => { void useChatStore.getState().refetchConversations({ silent: true }); };
      const onMemberRemoved = (data: { conversationId: string; removedMemberId: string }) => {
        const removedMemberId = normalizeId(data.removedMemberId);
        if (removedMemberId && removedMemberId === currentUserId) {
          onConversationDisbanded({ conversationId: data.conversationId });
          return;
        }
        void useChatStore.getState().refetchConversations({ silent: true });
      };

      const onUserDisabled = (data: { userId: string }) => {
        const userId = normalizeId(data.userId);
        if (!userId) return;

        if (userId === currentUserId) {
          useAuthStore.getState().localLogout();
          toast.warning('Tài khoản của bạn đã bị vô hiệu hóa.');
          navigate('/login');
          return;
        }

        // Cập nhật UI ngay lập tức
        useChatStore.getState().setOnline((prev) => ({ ...prev, [userId]: new Date().toISOString() }));
        void useChatStore.getState().refetchConversations({ silent: true });
      };

      const onUserMuted = (data: { muteUntil: string | Date }) => {
        const muteUntil = data.muteUntil ? new Date(data.muteUntil).toISOString() : undefined;
        useAuthStore.getState().updateUser({ muteUntil });
        syncMuteExpiration(muteUntil);
      };

      const onUserUnmuted = () => {
        useAuthStore.getState().updateUser({ muteUntil: undefined });
      };

      const onRelationshipCreated = () => {
        void queryClient.invalidateQueries({ queryKey: ['relationships'] });
      };

      const onRelationshipAccepted = () => {
        void queryClient.invalidateQueries({ queryKey: ['relationships'] });
        void useChatStore.getState().refetchConversations({ silent: true });
      };

      const onRelationshipDeleted = () => {
        void queryClient.invalidateQueries({ queryKey: ['relationships'] });
      };

      const onRelationshipBlocked = () => {
        void queryClient.invalidateQueries({ queryKey: ['relationships'] });
      };

      const onRelationshipUnblocked = () => {
        void queryClient.invalidateQueries({ queryKey: ['relationships'] });
      };

      sock.on('connect', onConnect);
      sock.on('disconnect', onDisconnect);
      sock.on('user:unseen-message', onUnseenMessage);
      sock.on('user:online', onUserOnline);
      sock.on('user:offline', onUserOffline);
      sock.on('user:typing-update', onTypingUpdate);
      sock.on('user:unseen-cleared', onUnseenCleared);
      sock.on('conversation:group-created', onGroupCreated);
      sock.on('conversation:restored', onConversationRestored);
      sock.on('conversation:name-changed', onConversationNameChanged);
      sock.on('conversation:admin-changed', onAdminChanged);
      sock.on('conversation:member-added', onMemberAdded);
      sock.on('conversation:member-removed', onMemberRemoved);
      sock.on('conversation:disbanded', onConversationDisbanded);
      sock.on('chat:new-message', onNewMessage);
      sock.on('message:updated', onMessageUpdated);
      sock.on('chat:message-deleted', onMessageDeleted);
      sock.on('user:mark-read', onMarkRead);
      sock.on('user:disabled', onUserDisabled);
      sock.on('user:muted', onUserMuted);
      sock.on('user:unmuted', onUserUnmuted);
      sock.on('relationship:created', onRelationshipCreated);
      sock.on('relationship:accepted', onRelationshipAccepted);
      sock.on('relationship:deleted', onRelationshipDeleted);
      sock.on('relationship:blocked', onRelationshipBlocked);
      sock.on('relationship:unblocked', onRelationshipUnblocked);

      if (sock.connected) {
        chatStore.setIsSocketConnected(true);
      }
    };

    // Also fetch initial conversations on auth change
    const unsubFetch = useAuthStore.subscribe((state, prevState) => {
      const isAuthChanged = state.accessToken !== prevState.accessToken || state.user?._id !== prevState.user?._id;
      if (isAuthChanged && state.accessToken && state.user) {
        void useChatStore.getState().refetchConversations();
      }
    });

    // Initial check
    initSocket();
    if (useAuthStore.getState().accessToken && useAuthStore.getState().user) {
       void useChatStore.getState().refetchConversations();
    }

    return () => {
      unsubAuth();
      unsubFetch();
      clearMuteTimer();
      if (currentSock) disconnectSocket();
    };
  }, []);

  return null;
}
