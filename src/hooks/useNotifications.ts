import { useMemo } from 'react';
import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';

export type NotificationType =
  | 'REPORT_RESOLVED'
  | 'REPORT_APPEAL_PENDING'
  | 'REPORT_APPEAL_REJECTED'
  | 'REPORT_APPEAL_SUCCESS'
  | 'SYSTEM';

export interface NotificationSnapshot {
  avatarMediaId?: any;
  displayName?: string;
  bio?: string;
  role?: string;
}

export interface NotificationItem {
  _id: string;
  userId: string;
  type: NotificationType | string;
  title: string;
  refId?: string | null;
  snapshot?: NotificationSnapshot;
  reportStatus?: string;
  hasAppealed?: boolean;
  reason?: string;
  penaltyApplied?: string;
  appealDeadline?: string;
  isRead: boolean;
  readAt?: string;
  createdAt: string;
  updatedAt: string;
}

interface NotificationListResponse {
  notifications: NotificationItem[];
  nextCursor: string | null;
}

const normalizeListResponse = (data: any): NotificationListResponse => {
  const payload = data?.data ?? data ?? {};
  return {
    notifications: Array.isArray(payload.notifications) ? payload.notifications : [],
    nextCursor: payload.nextCursor ?? null,
  };
};

const normalizeCountResponse = (data: any) => {
  const payload = data?.data ?? data ?? {};
  return Number(payload.unreadCount ?? 0);
};

export function useNotifications() {
  const { user } = useAuthStore();
  const queryClient = useQueryClient();

  const unreadCountQuery = useQuery({
    queryKey: ['notifications-unread-count'],
    queryFn: async () => {
      const res = await notificationsApi.unreadCount();
      return normalizeCountResponse(res.data);
    },
    enabled: !!user,
  });

  const notificationsQuery = useInfiniteQuery({
    queryKey: ['notifications'],
    queryFn: async ({ pageParam }) => {
      const res = await notificationsApi.getAll({
        cursor: typeof pageParam === 'string' ? pageParam : undefined,
      });
      return normalizeListResponse(res.data);
    },
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    enabled: !!user,
  });

  const notifications = useMemo(() => {
    return notificationsQuery.data?.pages.flatMap((page) => page.notifications) ?? [];
  }, [notificationsQuery.data]);

  const markReadMutation = useMutation({
    mutationFn: async (notificationId: string) => {
      const res = await notificationsApi.markRead(notificationId);
      return res.data;
    },
    onSuccess: async (data) => {
      if (data?.success !== false) {
        await Promise.all([
          queryClient.invalidateQueries({ queryKey: ['notifications'] }),
          queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
        ]);
      }
    },
  });

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      await notificationsApi.markAllRead();
    },
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
      ]);
    },
  });

  return {
    unreadCount: unreadCountQuery.data ?? 0,
    isUnreadCountLoading: unreadCountQuery.isLoading,
    notifications,
    isLoading: notificationsQuery.isLoading,
    isFetching: notificationsQuery.isFetching,
    fetchNextPage: notificationsQuery.fetchNextPage,
    hasNextPage: notificationsQuery.hasNextPage,
    isFetchingNextPage: notificationsQuery.isFetchingNextPage,
    markRead: markReadMutation.mutateAsync,
    isMarkingRead: markReadMutation.isPending,
    markAllRead: markAllReadMutation.mutateAsync,
    isMarkingAllRead: markAllReadMutation.isPending,
  };
}
