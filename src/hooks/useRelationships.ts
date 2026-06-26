import { useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { relationshipsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import type { User } from '../store/authStore';

export interface RelationshipUser extends User {
  relationshipId: string;
}

export function useRelationships() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['relationships'],
    queryFn: async () => {
      const res = await relationshipsApi.getRelationships();
      return res.data?.data || res.data || [];
    },
    enabled: !!currentUser,
  });

  const friends = useMemo<RelationshipUser[]>(() => {
    if (!query.data || !Array.isArray(query.data)) return [];
    
    return query.data
      .filter((rel: any) => rel.status === 'ACCEPTED')
      .map((rel: any) => {
        const isRequester = rel.requester?._id === currentUser?._id;
        const friend = isRequester ? rel.recipient : rel.requester;
        return {
          ...friend,
          relationshipId: rel._id,
        };
      })
      .filter((f: any) => f && f._id);
  }, [query.data, currentUser]);

  const sentRequests = useMemo<RelationshipUser[]>(() => {
    if (!query.data || !Array.isArray(query.data)) return [];
    
    return query.data
      .filter((rel: any) => rel.status === 'PENDING' && rel.requester?._id === currentUser?._id)
      .map((rel: any) => ({
        ...rel.recipient,
        relationshipId: rel._id,
      }))
      .filter((f: any) => f && f._id);
  }, [query.data, currentUser]);

  const receivedRequests = useMemo<RelationshipUser[]>(() => {
    if (!query.data || !Array.isArray(query.data)) return [];
    
    return query.data
      .filter((rel: any) => rel.status === 'PENDING' && rel.recipient?._id === currentUser?._id)
      .map((rel: any) => ({
        ...rel.requester,
        relationshipId: rel._id,
      }))
      .filter((f: any) => f && f._id);
  }, [query.data, currentUser]);

  const blockedUsers = useMemo<RelationshipUser[]>(() => {
    if (!query.data || !Array.isArray(query.data)) return [];
    
    return query.data
      .filter((rel: any) => rel.status === 'BLOCKED' && rel.blockedBy === currentUser?._id)
      .map((rel: any) => {
        const isRequester = rel.requester?._id === currentUser?._id;
        const blockedUser = isRequester ? rel.recipient : rel.requester;
        return {
          ...blockedUser,
          relationshipId: rel._id,
        };
      })
      .filter((f: any) => f && f._id);
  }, [query.data, currentUser]);

  const unfriendMutation = useMutation({
    mutationFn: async ({ relationshipId, targetUserId }: { relationshipId: string; targetUserId: string }) => {
      await relationshipsApi.unfriend(relationshipId, { targetUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const blockMutation = useMutation({
    mutationFn: async ({ targetUserId }: { targetUserId: string }) => {
      await relationshipsApi.block({ targetUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const unblockMutation = useMutation({
    mutationFn: async ({ targetUserId }: { targetUserId: string }) => {
      await relationshipsApi.unblock({ targetUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const acceptMutation = useMutation({
    mutationFn: async ({ relationshipId, targetUserId }: { relationshipId: string; targetUserId: string }) => {
      await relationshipsApi.accept(relationshipId, { targetUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  const rejectOrRemoveMutation = useMutation({
    mutationFn: async ({ relationshipId, targetUserId }: { relationshipId: string; targetUserId: string }) => {
      await relationshipsApi.rejectOrRemove(relationshipId, { targetUserId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['relationships'] });
    },
  });

  return {
    ...query,
    friends,
    sentRequests,
    receivedRequests,
    blockedUsers,
    unfriend: unfriendMutation.mutateAsync,
    isUnfriending: unfriendMutation.isPending,
    block: blockMutation.mutateAsync,
    isBlocking: blockMutation.isPending,
    unblock: unblockMutation.mutateAsync,
    isUnblocking: unblockMutation.isPending,
    accept: acceptMutation.mutateAsync,
    isAccepting: acceptMutation.isPending,
    rejectOrRemove: rejectOrRemoveMutation.mutateAsync,
    isRejectingOrRemoving: rejectOrRemoveMutation.isPending,
  };
}
