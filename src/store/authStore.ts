import { create } from 'zustand';
import {
  authApi,
  clearStoredAuth,
  notifyStoredUserChanged,
  persistAccessToken,
  subscribeAuthStorage
} from '../services/api';

import { UserRole } from '../constants/roles';

export interface User {
  _id: string;
  email: string;
  name?: string;
  role: UserRole | string;
  isActive: boolean;
  accountType: string;
  phone?: string;
  address?: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  muteUntil?: string;
  avatar?: {
    _id?: string;
    url?: string;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  isAdminVerified: boolean;
  login: (identifier: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  localLogout: () => void;
  updateUser: (data: Partial<User>) => void;
  setAdminVerified: (status: boolean) => void;
  init: () => () => void; // call this on app mount to subscribe to storage
}

const normalizeStoredUser = (user: User | null) => {
  if (!user?.muteUntil) return user;

  const muteUntilDate = new Date(user.muteUntil);
  if (Number.isNaN(muteUntilDate.getTime()) || muteUntilDate.getTime() <= Date.now()) {
    const { muteUntil, ...rest } = user;
    const normalizedUser = rest as User;
    localStorage.setItem('user', JSON.stringify(normalizedUser));
    notifyStoredUserChanged();
    return normalizedUser;
  }

  return user;
};

const readStoredUser = () => {
  const saved = localStorage.getItem('user');
  return saved ? normalizeStoredUser(JSON.parse(saved) as User) : null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: readStoredUser(),
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,
  isAdminVerified: false,

  setAdminVerified: (status: boolean) => set({ isAdminVerified: status }),

  login: async (identifier: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(identifier, password);
      const payload = res.data?.data || res.data;
      const { accessToken, user } = payload;
      
      if (!accessToken || !user) {
        throw new Error('Đăng nhập thất bại: Không nhận được token từ server');
      }

      persistAccessToken(accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      notifyStoredUserChanged();
      set({ user, accessToken });
    } catch (error) {
      clearStoredAuth();
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  logout: async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    clearStoredAuth();
    set({ user: null, accessToken: null });
  },

  localLogout: () => {
    clearStoredAuth();
    set({ user: null, accessToken: null });
  },

  logoutAll: async () => {
    await authApi.logoutAll();
    clearStoredAuth();
    set({ user: null, accessToken: null });
  },

  updateUser: (data: Partial<User>) => {
    const { user } = get();
    if (!user) return;
    const merged = { ...user, ...data };
    localStorage.setItem('user', JSON.stringify(merged));
    notifyStoredUserChanged();
    set({ user: merged });
  },

  init: () => {
    return subscribeAuthStorage(() => {
      set({
        accessToken: localStorage.getItem('accessToken'),
        user: readStoredUser(),
      });
    });
  }
}));
