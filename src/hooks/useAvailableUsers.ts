import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';
import { fetchUsersList } from '../queries/users';

export interface UserResult {
  _id: string;
  name?: string;
  email: string;
  image?: string;
  isDisabled?: boolean;
}

export function useAvailableUsers() {
  const toast = useToast();

  const query = useQuery({
    queryKey: ['users', 'available'],
    queryFn: async () => fetchUsersList(1, '', 100),
    staleTime: 5 * 60_000,
  });

  const users = useMemo<UserResult[]>(() => {
    const list = query.data?.userList || [];
    return list.map((user) => ({
      _id: user._id,
      name: user.name,
      email: user.email,
      image: user.image,
      isDisabled: user.isDisabled,
    })).filter((user) => Boolean(user._id) && !user.isDisabled);
  }, [query.data?.userList]);

  useEffect(() => {
    if (query.isError) {
      toast.error('Khong tai duoc danh sach nguoi dung');
    }
  }, [query.isError, toast]);

  return {
    users,
    isLoading: query.isPending && !query.data,
    refetch: () => query.refetch(),
  };
}
