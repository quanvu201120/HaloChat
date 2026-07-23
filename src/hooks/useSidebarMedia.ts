/* eslint-disable react-hooks/set-state-in-effect */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState, useEffect, useCallback } from 'react';
import {
  mediaApi, MediaResourceTypeEnum, type MediaResponse,
} from '../services/media';
import { type Message } from '../services/messages';
import { globalMediaCache } from '../pages/ChatPage.helpers';

type UseSidebarMediaParams = {
  activeConversationId: string;
  isTempConversation: boolean;
  isImagesExpanded: boolean;
  isVideosExpanded: boolean;
  isFilesExpanded: boolean;
};

export function useSidebarMedia({
  activeConversationId,
  isTempConversation,
  isImagesExpanded,
  isVideosExpanded,
  isFilesExpanded,
}: UseSidebarMediaParams) {
  const [sidebarMedia, setSidebarMedia] = useState<Partial<Record<MediaResourceTypeEnum, MediaResponse[]>>>({});
  const [sidebarMediaCursor, setSidebarMediaCursor] = useState<Partial<Record<MediaResourceTypeEnum, string | null>>>({});
  const [sidebarMediaHasMore, setSidebarMediaHasMore] = useState<Partial<Record<MediaResourceTypeEnum, boolean>>>({});
  const [isLoadingSidebarMedia, setIsLoadingSidebarMedia] = useState<Partial<Record<MediaResourceTypeEnum, boolean>>>({});
  const [hasFetchedSidebarMedia, setHasFetchedSidebarMedia] = useState<Partial<Record<MediaResourceTypeEnum, boolean>>>({});

  // --- SIDEBAR MEDIA LOGIC ---
  useEffect(() => {
    if (activeConversationId) {
      const cached = globalMediaCache[activeConversationId];
      if (cached) {
        setSidebarMedia({
          [MediaResourceTypeEnum.IMAGE]: cached[MediaResourceTypeEnum.IMAGE]?.medias || [],
          [MediaResourceTypeEnum.VIDEO]: cached[MediaResourceTypeEnum.VIDEO]?.medias || [],
          [MediaResourceTypeEnum.FILE]: cached[MediaResourceTypeEnum.FILE]?.medias || [],
        });
        setSidebarMediaCursor({
          [MediaResourceTypeEnum.IMAGE]: cached[MediaResourceTypeEnum.IMAGE]?.nextCursor || null,
          [MediaResourceTypeEnum.VIDEO]: cached[MediaResourceTypeEnum.VIDEO]?.nextCursor || null,
          [MediaResourceTypeEnum.FILE]: cached[MediaResourceTypeEnum.FILE]?.nextCursor || null,
        });
        setSidebarMediaHasMore({
          [MediaResourceTypeEnum.IMAGE]: cached[MediaResourceTypeEnum.IMAGE]?.hasMore || false,
          [MediaResourceTypeEnum.VIDEO]: cached[MediaResourceTypeEnum.VIDEO]?.hasMore || false,
          [MediaResourceTypeEnum.FILE]: cached[MediaResourceTypeEnum.FILE]?.hasMore || false,
        });
        setHasFetchedSidebarMedia({
          [MediaResourceTypeEnum.IMAGE]: !!cached[MediaResourceTypeEnum.IMAGE],
          [MediaResourceTypeEnum.VIDEO]: !!cached[MediaResourceTypeEnum.VIDEO],
          [MediaResourceTypeEnum.FILE]: !!cached[MediaResourceTypeEnum.FILE],
        });
      } else {
        setSidebarMedia({});
        setSidebarMediaCursor({});
        setSidebarMediaHasMore({});
        setHasFetchedSidebarMedia({});
      }
    }
  }, [activeConversationId]);

  const fetchSidebarMedia = useCallback(async (type: MediaResourceTypeEnum, isLoadMore = false, forceRefetch = false) => {
    if (!activeConversationId || isTempConversation) return;
    if (isLoadingSidebarMedia[type]) return;
    if (isLoadMore && !sidebarMediaHasMore[type]) return;
    if (!isLoadMore && !forceRefetch && hasFetchedSidebarMedia[type]) return;

    setIsLoadingSidebarMedia((prev) => ({ ...prev, [type]: true }));
    const cursor = isLoadMore ? sidebarMediaCursor[type] : null;

    try {
      const res = await mediaApi.getListByConversation(activeConversationId, type, cursor);
      const responseData = (res.data as any)?.data ?? res.data;
      const fetchedMedias = responseData?.medias ?? responseData ?? [];
      const nextCursor = responseData?.nextCursor ?? null;

      setSidebarMedia((prev) => {
        const existing = isLoadMore ? (prev[type] || []) : [];
        const fetchedIds = new Set(fetchedMedias.map((m: any) => m._id));
        const unmergedAppended = !isLoadMore ? (prev[type] || []).filter((m) => !fetchedIds.has(m._id)) : [];
        const updated = [...existing, ...unmergedAppended, ...fetchedMedias];

        if (!globalMediaCache[activeConversationId]) globalMediaCache[activeConversationId] = {};
        globalMediaCache[activeConversationId]![type] = {
          medias: updated,
          nextCursor,
          hasMore: !!nextCursor,
        };

        return { ...prev, [type]: updated };
      });
      setSidebarMediaCursor((prev) => ({ ...prev, [type]: nextCursor }));
      setSidebarMediaHasMore((prev) => ({ ...prev, [type]: !!nextCursor }));
      setHasFetchedSidebarMedia((prev) => ({ ...prev, [type]: true }));
    } catch (err) {
      console.warn(`Failed to load ${type} media`, err);
      if (!isLoadMore) {
        setSidebarMedia((prev) => ({ ...prev, [type]: prev[type] || [] }));
      }
    } finally {
      setIsLoadingSidebarMedia((prev) => ({ ...prev, [type]: false }));
    }
  }, [activeConversationId, sidebarMedia, sidebarMediaCursor, sidebarMediaHasMore, isLoadingSidebarMedia, hasFetchedSidebarMedia]);

  const appendSidebarMedia = useCallback((message: Message) => {
    if (!message.media || typeof message.media === 'string') return;

    const mediaObj = message.media as any;

    let type = mediaObj.resourceType as MediaResourceTypeEnum;
    if (!type || (type as any) === 'voice') {
      const mime = mediaObj.mimeType || '';
      type = MediaResourceTypeEnum.FILE;
      if (mime.startsWith('image/')) type = MediaResourceTypeEnum.IMAGE;
      else if (mime.startsWith('video/')) type = MediaResourceTypeEnum.VIDEO;
      else if (mime.startsWith('audio/')) type = MediaResourceTypeEnum.FILE;
    }

    setSidebarMedia((prev) => {
      const existing = prev[type] || [];
      if (existing.some((m) => m._id === mediaObj._id)) return prev;

      const newMedia = {
        _id: mediaObj._id,
        provider: mediaObj.provider,
        url: mediaObj.url || '',
        thumbUrl: mediaObj.thumbUrl,
        expiresAt: mediaObj.expiresAt,
        fileName: mediaObj.fileName,
        mimeType: mediaObj.mimeType,
        size: mediaObj.size,
        publicId: mediaObj.publicId,
        objectKey: mediaObj.objectKey,
        duration: mediaObj.duration,
        resourceType: type,
        owner: typeof message.sender === 'object' ? message.sender._id : message.sender,
        conversation: message.conversationId,
        createdAt: message.createdAt,
      } as any;

      return { ...prev, [type]: [newMedia, ...existing] };
    });
  }, []);

  const removeSidebarMedia = useCallback((mediaId: string) => {
    setSidebarMedia((prev) => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach((type) => {
        const t = type as MediaResourceTypeEnum;
        if (next[t]) {
          const filtered = next[t]!.filter((m) => m._id !== mediaId);
          if (filtered.length !== next[t]!.length) {
            next[t] = filtered;
            changed = true;
          }
        }
      });
      return changed ? next : prev;
    });
  }, []);

  const refreshSidebarMedia = useCallback(() => {
    if (!activeConversationId) return;
    delete globalMediaCache[activeConversationId];
    setSidebarMedia({});
    setSidebarMediaCursor({});
    setSidebarMediaHasMore({});
    setHasFetchedSidebarMedia({});

    if (isImagesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.IMAGE, false, true);
    if (isVideosExpanded) fetchSidebarMedia(MediaResourceTypeEnum.VIDEO, false, true);
    if (isFilesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.FILE, false, true);
  }, [activeConversationId, isImagesExpanded, isVideosExpanded, isFilesExpanded, fetchSidebarMedia]);

  useEffect(() => {
    if (isImagesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.IMAGE);
  }, [isImagesExpanded, fetchSidebarMedia]);

  useEffect(() => {
    if (isVideosExpanded) fetchSidebarMedia(MediaResourceTypeEnum.VIDEO);
  }, [isVideosExpanded, fetchSidebarMedia]);

  useEffect(() => {
    if (isFilesExpanded) fetchSidebarMedia(MediaResourceTypeEnum.FILE);
  }, [isFilesExpanded, fetchSidebarMedia]);
  // ---------------------------

  return {
    sidebarMedia,
    sidebarMediaHasMore,
    isLoadingSidebarMedia,
    fetchSidebarMedia,
    appendSidebarMedia,
    removeSidebarMedia,
    refreshSidebarMedia,
  };
}
