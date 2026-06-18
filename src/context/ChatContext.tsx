import {
  createContext, useCallback, useContext, useEffect, useState, type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import {
  conversationsApi, normalizeConversations, type Conversation,
} from '../services/conversations';
import {
  normalizeMessage, type Message,
} from '../services/messages';
import {
  connectSocket, disconnectSocket,
} from '../services/socket';
import { presenceApi } from '../services/api';
import { normalizeId } from '../utils/chat';

interface OnlineMap { [userId: string]: true | string }
interface TypingMap { [conversationId: string]: string[] }
interface UnreadMap { [conversationId: string]: boolean }

interface ChatContextType {
  conversations: Conversation[];
  isLoadingConversations: boolean;
  hasLoadedConversations: boolean;
  unread: UnreadMap;
  online: OnlineMap;
  typing: TypingMap;
  refetchConversations: (options?: { silent?: boolean }) => Promise<void>;
  clearUnread: (conversationId: string) => void;
  isSocketConnected: boolean;
  setUsersOnline: (userIds: string[]) => void;
  syncConversationMessage: (message: Message, options?: { markUnread?: boolean }) => void;
}

const ChatContext = createContext<ChatContextType | null>(null);

function getSenderId(message: Message): string {
  return normalizeId(typeof message.sender === 'string' ? message.sender : message.sender?._id);
}

function sortConversations(list: Conversation[]): Conversation[] {
  return [...list].sort((left, right) => {
    const leftTime = new Date(left.lastMessage?.createdAt || left.updatedAt || 0).getTime();
    const rightTime = new Date(right.lastMessage?.createdAt || right.updatedAt || 0).getTime();
    return rightTime - leftTime;
  });
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user, accessToken } = useAuth();
  const currentUserId = user?._id || '';

  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(false);
  const [hasLoadedConversations, setHasLoadedConversations] = useState(false);
  const [unread, setUnread] = useState<UnreadMap>({});
  const [online, setOnline] = useState<OnlineMap>({});
  const [typing, setTyping] = useState<TypingMap>({});
  const [isSocketConnected, setIsSocketConnected] = useState(false);

  const buildUnreadMap = useCallback((list: Conversation[]) => list.reduce<UnreadMap>((acc, conversation) => {
    if (!currentUserId) return acc;

    const lastMessageId = normalizeId(conversation.lastMessage?._id);
    const lastReadMessageId = normalizeId(conversation.readReceipts?.[currentUserId]);

    if (lastMessageId && lastMessageId !== lastReadMessageId) {
      acc[conversation._id] = true;
    }

    return acc;
  }, {}), [currentUserId]);

  const setUsersOnline = useCallback((userIds: string[]) => {
    if (userIds.length === 0) return;

    setOnline((prev) => {
      let changed = false;
      userIds.forEach((userId) => {
        if (!prev[userId]) changed = true;
      });
      if (!changed) return prev;

      const next = { ...prev };
      userIds.forEach((userId) => {
        next[userId] = true;
      });
      return next;
    });
  }, []);

  const patchConversation = useCallback((
    conversationId: string,
    updater: (conversation: Conversation) => Conversation,
  ) => {
    setConversations((prev) => {
      const index = prev.findIndex((item) => item._id === conversationId);
      if (index === -1) return prev;

      const next = [...prev];
      next[index] = updater(next[index]);
      return sortConversations(next);
    });
  }, []);

  const mergeConversation = useCallback((incoming: Conversation) => {
    setConversations((prev) => {
      const index = prev.findIndex((item) => item._id === incoming._id);
      if (index === -1) {
        return sortConversations([incoming, ...prev]);
      }

      const next = [...prev];
      next[index] = {
        ...next[index],
        ...incoming,
      };
      return sortConversations(next);
    });
  }, []);

  const syncConversationMessage = useCallback((
    message: Message,
    options?: { markUnread?: boolean },
  ) => {
    const conversationId = normalizeId(message.conversationId);
    if (!conversationId) return;

    setConversations((prev) => {
      const index = prev.findIndex((item) => item._id === conversationId);
      if (index === -1) return prev;

      const currentConversation = prev[index];
      const nextConversation: Conversation = {
        ...currentConversation,
        lastMessage: message,
        updatedAt: message.createdAt || message.updatedAt || new Date().toISOString(),
      };

      if (currentUserId && getSenderId(message) === currentUserId) {
        nextConversation.readReceipts = {
          ...(currentConversation.readReceipts ?? {}),
          [currentUserId]: message._id,
        };
      }

      const next = [...prev];
      next[index] = nextConversation;
      return sortConversations(next);
    });

    if (options?.markUnread !== false && getSenderId(message) !== currentUserId) {
      setUnread((prev) => ({ ...prev, [conversationId]: true }));
    }
  }, [currentUserId]);

  const hydratePresence = useCallback(async (list: Conversation[]) => {
    const memberMap = new Map<string, string | undefined>();

    list.forEach((conversation) => {
      conversation.users.forEach((member) => {
        if (member._id && member._id !== currentUserId) {
          if (!memberMap.has(member._id)) {
            memberMap.set(member._id, member.lastOnlineAt);
          }
        }
      });
    });

    if (memberMap.size === 0) {
      setOnline({});
      return;
    }

    try {
      const res = await presenceApi.getUsersOnline([...memberMap.keys()]);
      const payload = (res.data as any)?.data ?? res.data;
      const onlineIds = Array.isArray(payload) ? payload : [];
      const next: OnlineMap = {};

      memberMap.forEach((lastOnlineAt, userId) => {
        if (onlineIds.includes(userId)) {
          next[userId] = true;
        } else {
          next[userId] = lastOnlineAt || '';
        }
      });

      setOnline(next);
    } catch (err) {
      console.warn('[ChatContext] hydrate presence failed', err);
    }
  }, [currentUserId]);

  const fetchConversations = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent === true;
    if (!silent) {
      setIsLoadingConversations(true);
    }

    try {
      const res = await conversationsApi.getAll();
      const list = res.data?.data ?? (res.data as any) ?? [];
      const normalized = sortConversations(normalizeConversations(list));
      setConversations(normalized);
      setUnread(buildUnreadMap(normalized));
      void hydratePresence(normalized);
    } catch (err) {
      console.warn('[ChatContext] fetch conversations failed', err);
    } finally {
      if (!silent) {
        setIsLoadingConversations(false);
      }
      setHasLoadedConversations(true);
    }
  }, [buildUnreadMap, hydratePresence]);

  const fetchConversationById = useCallback(async (conversationId: string) => {
    try {
      const res = await conversationsApi.getOne(conversationId);
      const normalized = normalizeConversations([res.data?.data ?? res.data])[0];
      if (!normalized) return;

      mergeConversation(normalized);
      setUnread((prev) => {
        const next = { ...prev };
        const lastMessageId = normalizeId(normalized.lastMessage?._id);
        const lastReadMessageId = normalizeId(normalized.readReceipts?.[currentUserId]);

        if (lastMessageId && lastMessageId !== lastReadMessageId) {
          next[conversationId] = true;
        }

        return next;
      });
    } catch (err) {
      console.warn('[ChatContext] fetch conversation by id failed', err);
    }
  }, [currentUserId, mergeConversation]);

  const clearUnread = useCallback((conversationId: string) => {
    setUnread((prev) => {
      if (!prev[conversationId]) return prev;
      const next = { ...prev };
      delete next[conversationId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!currentUserId || !accessToken) return;

    const sock = connectSocket(accessToken);

    const onConnect = () => setIsSocketConnected(true);
    const onDisconnect = () => setIsSocketConnected(false);

    const onUnseenMessage = (data: { conversationId: string }) => {
      const conversationId = normalizeId(data.conversationId);
      if (!conversationId) return;
      setUnread((prev) => ({ ...prev, [conversationId]: true }));
      void fetchConversationById(conversationId);
    };

    const onUserOnline = (data: { userId: string }) => {
      const userId = normalizeId(data.userId);
      if (!userId) return;
      setOnline((prev) => ({ ...prev, [userId]: true }));
    };

    const onUserOffline = (data: { userId: string; lastOnlineAt?: string }) => {
      const userId = normalizeId(data.userId);
      if (!userId) return;
      setOnline((prev) => ({ ...prev, [userId]: data.lastOnlineAt || new Date().toISOString() }));
    };

    const onTypingUpdate = (data: {
      conversationId: string;
      userId: string;
      typing: boolean;
    }) => {
      const conversationId = normalizeId(data.conversationId);
      const userId = normalizeId(data.userId);

      if (!conversationId || !userId || userId === currentUserId) {
        return;
      }

      setTyping((prev) => {
        const current = prev[conversationId] ?? [];

        if (data.typing) {
          if (current.includes(userId)) return prev;
          return { ...prev, [conversationId]: [...current, userId] };
        }

        return {
          ...prev,
          [conversationId]: current.filter((id) => id !== userId),
        };
      });
    };

    const onUnseenCleared = (data: { conversationId: string }) => {
      const conversationId = normalizeId(data.conversationId);
      if (!conversationId) return;
      clearUnread(conversationId);
    };

    const onConversationDisbanded = (data: { conversationId: string }) => {
      const conversationId = normalizeId(data.conversationId);
      if (!conversationId) return;

      setConversations((prev) => prev.filter((item) => item._id !== conversationId));
      setUnread((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
      setTyping((prev) => {
        if (!prev[conversationId]) return prev;
        const next = { ...prev };
        delete next[conversationId];
        return next;
      });
    };

    const onNewMessage = (rawMessage: any) => {
      syncConversationMessage(normalizeMessage(rawMessage));
    };

    const onMessageUpdated = (rawMessage: any) => {
      const message = normalizeMessage(rawMessage);
      patchConversation(message.conversationId, (conversation) => ({
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

      patchConversation(conversationId, (conversation) => {
        if (conversation.lastMessage?._id !== messageId) {
          return conversation;
        }

        return {
          ...conversation,
          lastMessage: {
            ...conversation.lastMessage,
            isDeleted: true,
          },
        };
      });
    };

    const onMarkRead = (data: { conversationId: string; userId: string; messageId: string }) => {
      const conversationId = normalizeId(data.conversationId);
      const userId = normalizeId(data.userId);
      const messageId = normalizeId(data.messageId);
      if (!conversationId || !userId || !messageId) return;

      patchConversation(conversationId, (conversation) => ({
        ...conversation,
        readReceipts: {
          ...(conversation.readReceipts ?? {}),
          [userId]: messageId,
        },
      }));

      if (userId === currentUserId) {
        clearUnread(conversationId);
      }
    };

    const onConversationNameChanged = (data: { conversationId: string; name: string }) => {
      const conversationId = normalizeId(data.conversationId);
      if (!conversationId) return;

      patchConversation(conversationId, (conversation) => ({
        ...conversation,
        name: data.name,
      }));
    };

    const onGroupCreated = () => { void fetchConversations({ silent: true }); };
    const onConversationRestored = () => { void fetchConversations({ silent: true }); };
    const onAdminChanged = () => { void fetchConversations({ silent: true }); };
    const onMemberAdded = () => { void fetchConversations({ silent: true }); };
    const onMemberRemoved = (data: { conversationId: string; removedMemberId: string }) => {
      const removedMemberId = normalizeId(data.removedMemberId);
      if (removedMemberId && removedMemberId === currentUserId) {
        onConversationDisbanded({ conversationId: data.conversationId });
        return;
      }

      void fetchConversations({ silent: true });
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

    if (sock.connected) {
      setIsSocketConnected(true);
    }

    return () => {
      sock.off('connect', onConnect);
      sock.off('disconnect', onDisconnect);
      sock.off('user:unseen-message', onUnseenMessage);
      sock.off('user:online', onUserOnline);
      sock.off('user:offline', onUserOffline);
      sock.off('user:typing-update', onTypingUpdate);
      sock.off('user:unseen-cleared', onUnseenCleared);
      sock.off('conversation:group-created', onGroupCreated);
      sock.off('conversation:restored', onConversationRestored);
      sock.off('conversation:name-changed', onConversationNameChanged);
      sock.off('conversation:admin-changed', onAdminChanged);
      sock.off('conversation:member-added', onMemberAdded);
      sock.off('conversation:member-removed', onMemberRemoved);
      sock.off('conversation:disbanded', onConversationDisbanded);
      sock.off('chat:new-message', onNewMessage);
      sock.off('message:updated', onMessageUpdated);
      sock.off('chat:message-deleted', onMessageDeleted);
      sock.off('user:mark-read', onMarkRead);
      disconnectSocket();
    };
  }, [
    accessToken,
    clearUnread,
    currentUserId,
    fetchConversations,
    patchConversation,
    syncConversationMessage,
  ]);

  useEffect(() => {
    if (currentUserId && accessToken) {
      void fetchConversations();
    }
  }, [currentUserId, accessToken, fetchConversations]);

  return (
    <ChatContext.Provider value={{
      conversations,
      isLoadingConversations,
      hasLoadedConversations,
      unread,
      online,
      typing,
      refetchConversations: (options) => fetchConversations(options),
      clearUnread,
      isSocketConnected,
      setUsersOnline,
      syncConversationMessage,
    }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be inside ChatProvider');
  return ctx;
}
