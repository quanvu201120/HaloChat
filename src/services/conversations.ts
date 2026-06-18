import { api } from './api';
import { normalizeMessage, type Message } from './messages';
import { normalizeId, normalizeReadReceipts } from '../utils/chat';

export interface ConversationUser {
  _id: string;
  name?: string;
  email: string;
  avatar?: {
    _id?: string;
    url?: string;
  };
  lastOnlineAt?: string;
}

export interface Conversation {
  _id: string;
  name?: string;
  isGroup: boolean;
  users: ConversationUser[];
  adminGroupId?: string;
  lastMessage?: Message;
  avatar?: { url: string };
  updatedAt: string;
  readReceipts?: Record<string, string>;
}

function normalizeConversationUser(raw: any): ConversationUser {
  return {
    _id: normalizeId(raw?._id),
    name: raw?.name,
    email: String(raw?.email ?? ''),
    avatar: raw?.avatar,
    lastOnlineAt: raw?.lastOnlineAt,
  };
}

export function normalizeConversation(raw: any): Conversation {
  return {
    _id: normalizeId(raw?._id),
    name: raw?.name,
    isGroup: Boolean(raw?.isGroup),
    users: Array.isArray(raw?.users) ? raw.users.map(normalizeConversationUser) : [],
    adminGroupId: raw?.adminGroupId ? normalizeId(raw.adminGroupId) : undefined,
    lastMessage: raw?.lastMessage ? normalizeMessage(raw.lastMessage) : raw?.lastMessageId ? normalizeMessage(raw.lastMessageId) : undefined,
    avatar: raw?.avatar,
    updatedAt: raw?.updatedAt ?? new Date().toISOString(),
    readReceipts: normalizeReadReceipts(raw?.readReceipts),
  };
}

export function normalizeConversations(raw: any): Conversation[] {
  if (!Array.isArray(raw)) return [];
  return raw.map(normalizeConversation);
}

export const conversationsApi = {
  getAll: () => api.get<{ data: Conversation[] }>('/conversations'),

  getOne: (id: string) => api.get<{ data: Conversation }>(`/conversations/${id}`),

  create: (data: { users: string[]; name?: string; isGroup?: boolean }) =>
    api.post<{ data: Conversation }>('/conversations', data),

  updateName: (id: string, name: string) =>
    api.patch(`/conversations/${id}/update-name`, { name }),

  addMembers: (id: string, members: string[]) =>
    api.patch(`/conversations/${id}/add-members`, { members }),

  removeMember: (id: string, memberId: string) =>
    api.patch(`/conversations/${id}/remove-member`, { memberId }),

  leaveGroup: (id: string) =>
    api.delete(`/conversations/${id}/leave-group`),

  disbandGroup: (id: string) =>
    api.delete(`/conversations/${id}/disband-group`),

  hideHistory: (id: string) =>
    api.delete(`/conversations/${id}`),

  markRead: (id: string, messageId: string) =>
    api.patch(`/conversations/${id}/read`, { messageId }),

  uploadAvatar: (id: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    return api.patch(`/conversations/${id}/avatar`, form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  },

  deleteAvatar: (id: string) =>
    api.delete(`/conversations/${id}/avatar`),

  changeAdmin: (id: string, newAdminId: string) =>
    api.patch(`/conversations/${id}/change-admin`, { newAdminId }),
};
