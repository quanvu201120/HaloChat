import { api } from './api';
import { normalizeId } from '../utils/chat';

export type MessageType = 'text' | 'image' | 'video' | 'file' | 'voice' | 'system' | 'callAudio' | 'callVideo';

export interface MessageUser {
  _id: string;
  name?: string;
  email?: string;
  isDisabled?: boolean;
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

export interface MessageCall {
  _id: string;
  callerId: string;
  calleeId: string;
  conversationId: string;
  callType: 'audio' | 'video';
  status: 'calling' | 'accepted' | 'rejected' | 'ended' | 'missed';
  startedAt?: string;
  endedAt?: string;
  duration: number;
  endReason?: string;
}

export interface Message {
  _id: string;
  conversationId: string;
  sender: string | MessageUser;
  type: MessageType;
  content?: string;
  media?: MessageMedia | string;
  call?: MessageCall | string;
  replyTo?: string | Message;
  isDeleted: boolean;
  deletedAt?: string;
  reactions?: MessageReaction[];
  isSenderDisabled?: boolean;
  createdAt: string;
  updatedAt: string;
}

function normalizeReaction(raw: any): MessageReaction {
  return {
    userId: normalizeId(raw?.userId ?? raw?.user ?? raw?._id),
    type: String(raw?.type ?? ''),
  };
}

export function formatCallMessageLabel(message: Pick<Message, 'type' | 'call'>): string {
  const call = typeof message.call === 'object' ? message.call : null;
  const duration = Number(call?.duration || 0);

  if (call?.status === 'rejected') return 'Đã từ chối';
  if (call?.status === 'missed') return 'Gọi nhỡ';
  if (call?.status === 'ended' && duration > 0) {
    return message.type === 'callVideo' ? 'Cuộc gọi video' : 'Cuộc gọi thoại';
  }
  return 'Gọi nhỡ';
}

export function formatCallMessageDuration(message: Pick<Message, 'call'>): string {
  const call = typeof message.call === 'object' ? message.call : null;
  const duration = Number(call?.duration || 0);
  if (call?.status !== 'ended' || duration <= 0) return '';

  const minutes = Math.floor(duration / 60);
  const seconds = Math.floor(duration % 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
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
  const call = raw?.call ?? raw?.callId;
  const rawType = String(raw?.type ?? 'text');
  const type = rawType === 'callAudio' || rawType === 'callVideo'
    ? rawType
    : rawType.toLowerCase();

  return {
    _id: normalizeId(raw?._id),
    conversationId: normalizeId(conversationId),
    sender: typeof sender === 'object' ? sender : normalizeId(sender),
    type: type as MessageType,
    content: raw?.content,
    media: typeof media === 'object' ? media : normalizeId(media),
    call: typeof call === 'object' ? call : normalizeId(call),
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

const FILE_MIME_BY_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  txt: 'text/plain',
  csv: 'text/csv',
  zip: 'application/zip',
  rar: 'application/vnd.rar',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  aac: 'audio/aac',
  m4a: 'audio/mp4',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
};

function withFallbackMimeType(file: File) {
  if (file.type) return file;

  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';
  const inferredType = FILE_MIME_BY_EXTENSION[extension];

  if (!inferredType) return file;

  return new File([file], file.name, {
    type: inferredType,
    lastModified: file.lastModified,
  });
}

function createUploadFormData(file: File, replyTo?: string) {
  const formData = new FormData();
  formData.append('file', withFallbackMimeType(file));
  if (replyTo) formData.append('replyTo', replyTo);
  return formData;
}

export interface ListMessagesResponse {
  messages: Message[];
  nextCursor: string | null;
}

export const messagesApi = {
  getList: (conversationId: string, cursor?: string | null) =>
    api.get<ListMessagesResponse | { data: ListMessagesResponse }>(`/conversations/${conversationId}/message`, {
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
    const fd = createUploadFormData(file, replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/image`, fd);
  },

  sendVideo: (conversationId: string, file: File, replyTo?: string) => {
    const fd = createUploadFormData(file, replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/video`, fd);
  },

  sendFile: (conversationId: string, file: File, replyTo?: string) => {
    const fd = createUploadFormData(file, replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/file`, fd);
  },

  sendVoice: (conversationId: string, file: File, replyTo?: string) => {
    const fd = createUploadFormData(file, replyTo);
    return api.post<{ data: Message }>(`/conversations/${conversationId}/message/voice`, fd);
  },

  addReaction: (messageId: string, conversationId: string, type: string) =>
    api.patch(`/messages/${messageId}/reaction`, { conversationId, type }),

  removeReaction: (messageId: string, conversationId: string) =>
    api.delete(`/messages/${messageId}/reaction`, { data: { conversationId } }),
};
