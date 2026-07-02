import { create } from 'zustand';
import {
  conversationsApi, normalizeConversations, type Conversation,
} from '../services/conversations';
import { type Message } from '../services/messages';
import { presenceApi } from '../services/api';
import { normalizeId } from '../utils/chat';
import { useAuthStore } from './authStore';

export interface OnlineMap { [userId: string]: true | string }
export interface TypingMap { [conversationId: string]: string[] }
export interface UnreadMap { [conversationId: string]: boolean }

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

function buildUnreadMap(list: Conversation[], currentUserId: string): UnreadMap {
  return list.reduce<UnreadMap>((acc, conversation) => {
    if (!currentUserId) return acc;

    const lastMessageId = normalizeId(conversation.lastMessage?._id);
    const lastReadMessageId = normalizeId(conversation.readReceipts?.[currentUserId]);

    if (lastMessageId && lastMessageId !== lastReadMessageId) {
      acc[conversation._id] = true;
    }

    return acc;
  }, {});
}

interface ChatState {
  conversations: Conversation[];
  isLoadingConversations: boolean;
  hasLoadedConversations: boolean;
  nextCursorConversations?: string | null;
  unread: UnreadMap;
  online: OnlineMap;
  typing: TypingMap;
  isSocketConnected: boolean;

  setIsSocketConnected: (connected: boolean) => void;
  setConversations: (updater: Conversation[] | ((prev: Conversation[]) => Conversation[])) => void;
  setUnread: (updater: UnreadMap | ((prev: UnreadMap) => UnreadMap)) => void;
  setTyping: (updater: TypingMap | ((prev: TypingMap) => TypingMap)) => void;
  setOnline: (updater: OnlineMap | ((prev: OnlineMap) => OnlineMap)) => void;
  
  refetchConversations: (options?: { silent?: boolean }) => Promise<void>;
  loadMoreConversations: () => Promise<void>;
  fetchConversationById: (conversationId: string) => Promise<void>;
  clearUnread: (conversationId: string) => void;
  setUsersOnline: (userIds: string[]) => void;
  syncConversationMessage: (message: Message, options?: { markUnread?: boolean }) => void;
  patchConversation: (conversationId: string, updater: (conversation: Conversation) => Conversation) => void;
  mergeConversation: (incoming: Conversation) => void;
  hydratePresence: (list: Conversation[]) => Promise<void>;
  isInMessageRequestContext: boolean;
  setMessageRequestContext: (value: boolean) => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
  conversations: [],
  isLoadingConversations: false,
  hasLoadedConversations: false,
  nextCursorConversations: null,
  unread: {},
  online: {},
  typing: {},
  isSocketConnected: false,
  isInMessageRequestContext: false,

  setMessageRequestContext: (value) => set({ isInMessageRequestContext: value }),
  setIsSocketConnected: (connected) => set({ isSocketConnected: connected }),
  
  setConversations: (updater) => set((state) => ({ 
    conversations: typeof updater === 'function' ? updater(state.conversations) : updater 
  })),

  setUnread: (updater) => set((state) => ({ 
    unread: typeof updater === 'function' ? updater(state.unread) : updater 
  })),

  setTyping: (updater) => set((state) => ({ 
    typing: typeof updater === 'function' ? updater(state.typing) : updater 
  })),

  setOnline: (updater) => set((state) => ({ 
    online: typeof updater === 'function' ? updater(state.online) : updater 
  })),

  patchConversation: (conversationId, updater) => {
    set((state) => {
      const index = state.conversations.findIndex((item) => item._id === conversationId);
      if (index === -1) return state;

      const next = [...state.conversations];
      next[index] = updater(next[index]);
      return { conversations: sortConversations(next) };
    });
  },

  mergeConversation: (incoming) => {
    set((state) => {
      const index = state.conversations.findIndex((item) => item._id === incoming._id);
      if (index === -1) {
        return { conversations: sortConversations([incoming, ...state.conversations]) };
      }

      const next = [...state.conversations];
      next[index] = { ...next[index], ...incoming };
      return { conversations: sortConversations(next) };
    });
  },

  hydratePresence: async (list) => {
    const { user } = useAuthStore.getState();
    const currentUserId = user?._id || '';
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
      set({ online: {} });
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

      set({ online: next });
    } catch (err) {
      console.warn('[chatStore] hydrate presence failed', err);
    }
  },

  refetchConversations: async (options) => {
    const silent = options?.silent === true;
    if (!silent) set({ isLoadingConversations: true });

    try {
      const res = await conversationsApi.getAll();
      const list = res.data?.data?.conversations ?? (res.data?.data as any) ?? [];
      const nextCursor = res.data?.data?.nextCursor ?? null;
      const normalized = sortConversations(normalizeConversations(list));
      
      const { user } = useAuthStore.getState();
      const currentUserId = user?._id || '';
      
      set({ 
        conversations: normalized,
        nextCursorConversations: nextCursor,
        unread: buildUnreadMap(normalized, currentUserId),
      });
      void get().hydratePresence(normalized);
    } catch (err) {
      console.warn('[chatStore] fetch conversations failed', err);
    } finally {
      if (!silent) set({ isLoadingConversations: false });
      set({ hasLoadedConversations: true });
    }
  },

  loadMoreConversations: async () => {
    const state = get();
    if (!state.nextCursorConversations || state.isLoadingConversations) return;
    
    set({ isLoadingConversations: true });
    try {
      const res = await conversationsApi.getAll(state.nextCursorConversations);
      const list = res.data?.data?.conversations ?? (res.data?.data as any) ?? [];
      const nextCursor = res.data?.data?.nextCursor ?? null;
      const normalized = sortConversations(normalizeConversations(list));
      
      const { user } = useAuthStore.getState();
      const currentUserId = user?._id || '';
      
      const combined = sortConversations([...state.conversations, ...normalized]);
      
      set({
        conversations: combined,
        nextCursorConversations: nextCursor,
        unread: buildUnreadMap(combined, currentUserId),
      });
      void get().hydratePresence(normalized);
    } catch (err) {
      console.warn('[chatStore] load more conversations failed', err);
    } finally {
      set({ isLoadingConversations: false });
    }
  },
  
  fetchConversations: async (options?: { silent?: boolean }) => {
    return get().refetchConversations(options);
  },

  fetchConversationById: async (conversationId) => {
    try {
      const res = await conversationsApi.getOne(conversationId);
      const normalized = normalizeConversations([res.data?.data ?? res.data])[0];
      if (!normalized) return;

      get().mergeConversation(normalized);
      
      const { user } = useAuthStore.getState();
      const currentUserId = user?._id || '';

      set((state) => {
        const next = { ...state.unread };
        const lastMessageId = normalizeId(normalized.lastMessage?._id);
        const lastReadMessageId = normalizeId(normalized.readReceipts?.[currentUserId]);

        if (lastMessageId && lastMessageId !== lastReadMessageId) {
          next[conversationId] = true;
        }
        return { unread: next };
      });
    } catch (err) {
      console.warn('[chatStore] fetch conversation by id failed', err);
    }
  },

  clearUnread: (conversationId) => {
    set((state) => {
      if (!state.unread[conversationId]) return state;
      const next = { ...state.unread };
      delete next[conversationId];
      return { unread: next };
    });
  },

  setUsersOnline: (userIds) => {
    if (userIds.length === 0) return;

    set((state) => {
      let changed = false;
      userIds.forEach((userId) => {
        if (!state.online[userId]) changed = true;
      });
      if (!changed) return state;

      const next = { ...state.online };
      userIds.forEach((userId) => {
        next[userId] = true;
      });
      return { online: next };
    });
  },

  syncConversationMessage: (message, options) => {
    const conversationId = normalizeId(message.conversationId);
    if (!conversationId) return;

    const { user } = useAuthStore.getState();
    const currentUserId = user?._id || '';
    const senderId = getSenderId(message);

    set((state) => {
      const index = state.conversations.findIndex((item) => item._id === conversationId);
      if (index === -1) return state;

      const currentConversation = state.conversations[index];
      const nextConversation: Conversation = {
        ...currentConversation,
        lastMessage: message,
        updatedAt: message.createdAt || message.updatedAt || new Date().toISOString(),
      };

      if (currentUserId && senderId === currentUserId) {
        nextConversation.readReceipts = {
          ...(currentConversation.readReceipts ?? {}),
          [currentUserId]: message._id,
        };
      }

      const next = [...state.conversations];
      next[index] = nextConversation;
      return { conversations: sortConversations(next) };
    });

    if (options?.markUnread !== false && senderId !== currentUserId) {
      set((state) => ({ unread: { ...state.unread, [conversationId]: true } }));
    }
  }
}));
