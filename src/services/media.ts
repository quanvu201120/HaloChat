import { api } from './api';

export enum MediaResourceTypeEnum {
  IMAGE = 'image',
  VIDEO = 'video',
  AUDIO = 'audio',
  FILE = 'file',
}

export interface MediaResponse {
  _id: string;
  uploadedBy?: string;
  ownerType: string;
  ownerId?: string;
  provider: string;
  resourceType: MediaResourceTypeEnum;
  publicId?: string;
  objectKey?: string;
  fileName?: string;
  mimeType?: string;
  size?: number;
  width?: number;
  height?: number;
  duration?: number;
  thumbUrl?: string;
  url?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ListMediaResponse {
  nextCursor: string | null;
  medias: MediaResponse[];
}

export const mediaApi = {
  getListByConversation: (conversationId: string, type: MediaResourceTypeEnum, cursor?: string | null) =>
    api.get<ListMediaResponse | { data: ListMediaResponse }>(`/conversations/${conversationId}/medias`, {
      params: { type, ...(cursor ? { cursor } : {}) },
    }),
};
