import { useState, useEffect, useCallback } from 'react';
import { usersApi } from '../services/api';
import { useToast } from '../context/ToastContext';

export interface UserResult {
  _id: string;
  name?: string;
  email: string;
  image?: string;
}

let cachedUsers: UserResult[] | null = null;
let fetchPromise: Promise<UserResult[]> | null = null;

export function useAvailableUsers() {
  const [users, setUsers] = useState<UserResult[]>(cachedUsers || []);
  const [isLoading, setIsLoading] = useState(!cachedUsers);
  const toast = useToast();

  const fetchUsers = useCallback(async (force = false) => {
    if (cachedUsers && !force) {
      setUsers(cachedUsers);
      setIsLoading(false);
      return;
    }

    if (!fetchPromise || force) {
      setIsLoading(true);
      fetchPromise = usersApi.getAll({ current: 1, pageSize: 100 })
        .then(res => {
          const list = res.data?.data?.users || res.data?.users || [];
          cachedUsers = list;
          return list;
        })
        .catch(err => {
          toast.error('Không tải được danh sách người dùng');
          throw err;
        });
    }

    try {
      const result = await fetchPromise;
      setUsers(result);
    } catch (err) {
      // Error is already handled with toast in the promise chain
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  return { users, isLoading, refetch: () => fetchUsers(true) };
}
