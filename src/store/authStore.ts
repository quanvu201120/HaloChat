import { create } from 'zustand';
import {
  type AppealContext,
  type LoginPayload,
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
  bannedAppeal: (AppealContext & { banUntil?: string }) | null;
  isLoading: boolean;
  isAdminVerified: boolean;
  login: (identifier: string, password: string) => Promise<LoginPayload>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  localLogout: () => void;
  updateUser: (data: Partial<User>) => void;
  setAdminVerified: (status: boolean) => void;
  setBannedAppeal: (data: (AppealContext & { banUntil?: string }) | null) => void;
  init: () => () => void;
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
  bannedAppeal: null,
  isLoading: false,
  isAdminVerified: false,

  setAdminVerified: (status: boolean) => set({ isAdminVerified: status }),
  setBannedAppeal: (data) => set({ bannedAppeal: data }),

  login: async (identifier: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(identifier, password);
      const payload = (res.data?.data || res.data) as LoginPayload;
      const { accessToken, user, isBanned, banUntil, appeal } = payload;

      if (isBanned) {
        clearStoredAuth();
        set({
          user: null,
          accessToken: null,
          bannedAppeal: appeal ? { ...appeal, banUntil } : null,
        });
        return payload;
      }

      if (!accessToken || !user) {
        throw new Error('Đăng nhập thất bại: Không nhận được token từ server');
      }

      persistAccessToken(accessToken);
      localStorage.setItem('user', JSON.stringify(user));
      notifyStoredUserChanged();
      set({ user, accessToken, bannedAppeal: null });
      return payload;
    } catch (error) {
      clearStoredAuth();
      set({ bannedAppeal: null });
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
    set({ user: null, accessToken: null, bannedAppeal: null });
  },

  localLogout: () => {
    clearStoredAuth();
    set({ user: null, accessToken: null, bannedAppeal: null });
  },

  logoutAll: async () => {
    await authApi.logoutAll();
    clearStoredAuth();
    set({ user: null, accessToken: null, bannedAppeal: null });
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
        bannedAppeal: get().bannedAppeal,
      });
    });
  }
}));
