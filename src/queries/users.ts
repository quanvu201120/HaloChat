import { useQuery } from '@tanstack/react-query';
import { usersApi } from '../services/api';
import { normalizeId } from '../utils/chat';

export interface UserSummary {
  _id: string;
  name?: string;
  email: string;
  image?: string;
  phone?: string;
  address?: string;
  role: string;
  isActive: boolean;
  isDisabled: boolean;
  accountType: string;
  createdAt?: string;
}

export interface UsersListResponse {
  userList?: UserSummary[];
  totalPages?: number;
}

export function getUsersListQueryKey(currentPage: number, searchText: string) {
  return ['users', 'list', currentPage, searchText.trim()] as const;
}

function normalizeUserSummary(raw: any): UserSummary {
  return {
    _id: normalizeId(raw?._id ?? raw?.id ?? raw?.userId),
    name: raw?.name,
    email: String(raw?.email ?? ''),
    image: raw?.image ?? raw?.avatar?.url,
    phone: raw?.phone,
    address: raw?.address,
    role: String(raw?.role ?? 'USER'),
    isActive: Boolean(raw?.isActive),
    isDisabled: Boolean(raw?.isDisabled),
    accountType: String(raw?.accountType ?? raw?.type ?? 'LOCAL'),
    createdAt: raw?.createdAt,
  };
}

function normalizeUsersListResponse(raw: any): UsersListResponse {
  const data = raw?.data ?? raw;
  const userList = data?.userList ?? data?.users ?? raw?.userList ?? raw?.users ?? [];
  const totalPages = data?.totalPages ?? raw?.totalPages ?? 1;

  return {
    userList: Array.isArray(userList) ? userList.map(normalizeUserSummary).filter((user) => user._id) : [],
    totalPages: Number.isFinite(totalPages) ? totalPages : 1,
  };
}

export async function fetchUsersList(currentPage: number, searchText = '', pageSize = 10) {
  const params: { current: number; pageSize: number; email?: string } = {
    current: currentPage,
    pageSize,
  };

  if (searchText.trim()) {
    params.email = `/${searchText.trim()}/i`;
  }

  const res = await usersApi.getAll(params);
  return normalizeUsersListResponse(res.data);
}

export function useUsersListQuery(currentPage: number, searchText: string, pageSize = 10) {
  return useQuery({
    queryKey: getUsersListQueryKey(currentPage, searchText),
    queryFn: () => fetchUsersList(currentPage, searchText, pageSize),
  });
}

export async function fetchUserDetail(userId: string) {
  const res = await usersApi.getOne(userId);
  return res.data?.data ?? res.data;
}
