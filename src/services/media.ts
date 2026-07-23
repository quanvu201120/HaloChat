import { api } from './api';

export const MediaResourceTypeEnum = {
  IMAGE: 'image',
  VIDEO: 'video',
  AUDIO: 'audio',
  FILE: 'file',
} as const;

export type MediaResourceTypeEnum = typeof MediaResourceTypeEnum[keyof typeof MediaResourceTypeEnum];

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
  expiresAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export function isR2Media(media?: { _id?: string; provider?: string; objectKey?: string } | null) {
  if (!media?._id) return false;
  return media.provider === 'r2' || Boolean(media.objectKey);
}

export function isMediaUrlExpired(expiresAt?: string, thresholdMs = 0) {
  if (!expiresAt) return false;
  const expiresAtMs = new Date(expiresAt).getTime();
  if (Number.isNaN(expiresAtMs)) return false;
  return expiresAtMs - thresholdMs <= Date.now();
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

  getUrl: (mediaId: string) =>
    api.get<{ url: string; expiresAt: string } | { data: { url: string; expiresAt: string } }>(`/media/${mediaId}/url`),
};
