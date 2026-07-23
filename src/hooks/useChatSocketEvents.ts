/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable react-hooks/exhaustive-deps */
import { useEffect } from 'react';
import {
  conversationsApi, normalizeConversation, type Conversation,
} from '../services/conversations';
import {
  normalizeMessage, type Message,
} from '../services/messages';
import { normalizeId } from '../utils/chat';
import { UI_MESSAGES } from '../constants/messages';
import { isLikelyOptimisticMatch, getSenderId } from '../pages/ChatPage.helpers';
import { type LocalMessage } from '../pages/ChatPage.types';

type SocketLike = {
  on: (event: string, handler: (...args: any[]) => void) => void;
  off: (event: string, handler: (...args: any[]) => void) => void;
} | null | undefined;

type UseChatSocketEventsParams = {
  activeConversationId: string;
  socket: SocketLike;
  currentUserId: string;
  editingMessageId: string | null;
  replyTarget: Message | null;
  isLeavingOrDisbandingRef: React.RefObject<boolean>;
  setMessages: React.Dispatch<React.SetStateAction<LocalMessage[]>>;
  setConv: React.Dispatch<React.SetStateAction<Conversation | null>>;
  setEditingMessageId: React.Dispatch<React.SetStateAction<string | null>>;
  setText: React.Dispatch<React.SetStateAction<string>>;
  setReplyTarget: React.Dispatch<React.SetStateAction<Message | null>>;
  markConversationRead: (message: Message) => void;
  updateConversationReadReceipt: (userId: string, messageId: string) => void;
  appendSidebarMedia: (message: Message) => void;
  removeSidebarMedia: (mediaId: string) => void;
  refreshSidebarMedia: () => void;
  reloadMessages: (conversationId: string, force?: boolean) => Promise<unknown> | void;
  patchConversation: (conversationId: string, updater: (prev: Conversation) => Conversation) => void;
  refetchConversations: (options?: { silent?: boolean }) => Promise<unknown> | void;
  navigate: (to: string, options?: { replace?: boolean }) => void;
  toast: { success: (msg: string) => void; error: (msg: string) => void };
};

export function useChatSocketEvents({
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
}: UseChatSocketEventsParams) {
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
}
