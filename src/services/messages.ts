import { api } from './api';
import { normalizeId } from '../utils/chat';

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'system';

export interface MessageUser {
  _id: string;
  name?: string;
  email?: string;
  avatar?: {
    _id?: string;
    url?: string;
  };
}

export interface MessageMedia {
  _id: string;
  url?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  publicId?: string;
  objectKey?: string;
}

export interface MessageReaction {
  userId: string;
  type: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: string | MessageUser;
  type: MessageType;
  content?: string;
  media?: MessageMedia | string;
  replyTo?: string | Message;
  isDeleted: boolean;
  deletedAt?: string;
  reactions?: MessageReaction[];
  createdAt: string;
  updatedAt: string;
}

function normalizeReaction(raw: any): MessageReaction {
  return {
    userId: normalizeId(raw?.userId ?? raw?.user ?? raw?._id),
    type: String(raw?.type ?? ''),
  };
}

export function normalizeMessage(raw: any): Message {
  const conversationId = raw?.conversationId ?? raw?.conversation?._id ?? raw?.conversation;
  const replyTo = raw?.replyTo
    ? typeof raw.replyTo === 'string'
      ? normalizeId(raw.replyTo)
      : normalizeMessage(raw.replyTo)
    : undefined;

  const sender = raw?.sender ?? raw?.senderId ?? '';
  const media = raw?.media ?? raw?.mediaId;

  return {
    _id: normalizeId(raw?._id),
    conversationId: normalizeId(conversationId),
    sender: typeof sender === 'object' ? sender : normalizeId(sender),
    type: String(raw?.type ?? 'text').toLowerCase() as MessageType,
    content: raw?.content,
    media: typeof media === 'object' ? media : normalizeId(media),
    replyTo,
    isDeleted: Boolean(raw?.isDeleted),
    deletedAt: raw?.deletedAt,
    reactions: Array.isArray(raw?.reactions)
      ? raw.reactions.map(normalizeReaction).filter((reaction: MessageReaction) => reaction.userId)
      : [],
    createdAt: raw?.createdAt ?? new Date().toISOString(),
    updatedAt: raw?.updatedAt ?? raw?.createdAt ?? new Date().toISOString(),
  };
}

export function normalizeMessages(raw: any): Message[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeMessage);
}

export const messagesApi = {
  getList: (conversationId: string, cursor?: string) =>
    api.get<Message[]>(`/conversations/${conversationId}/message`, {
      params: cursor ? { cursor } : undefined,
    }),

  getLatest: (conversationId: string) =>
    api.get<Message>(`/conversations/${conversationId}/latest-message`),

  sendText: (conversationId: string, content: string, replyTo?: string) =>
    api.post<{ data: Message }>(`/conversations/${conversationId}/message/text`, {
      content,
      ...(replyTo ? { replyTo } : {}),
    }),

  sendImage: (conversationId: string, file: File, replyTo?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (replyTo) fd.append('replyTo', replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/image`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  sendVideo: (conversationId: string, file: File, replyTo?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (replyTo) fd.append('replyTo', replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/video`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  sendFile: (conversationId: string, file: File, replyTo?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (replyTo) fd.append('replyTo', replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/file`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  sendVoice: (conversationId: string, file: File, replyTo?: string) => {
    const fd = new FormData();
    fd.append('file', file);
    if (replyTo) fd.append('replyTo', replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/voice`, fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  addReaction: (messageId: string, conversationId: string, type: string) =>
    api.patch(`/messages/${messageId}/reaction`, { conversationId, type }),

  removeReaction: (messageId: string, conversationId: string) =>
    api.delete(`/messages/${messageId}/reaction`, { data: { conversationId } }),
};
