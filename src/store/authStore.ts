import { create } from 'zustand';
import {
  authApi,
  clearStoredAuth,
  notifyStoredUserChanged,
  persistAccessToken,
  subscribeAuthStorage
} from '../services/api';

export interface User {
  _id: string;
  email: string;
  name?: string;
  role: string;
  isActive: boolean;
  accountType: string;
  phone?: string;
  address?: string;
  avatar?: {
    _id?: string;
    url?: string;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  init: () => () => void; // call this on app mount to subscribe to storage
}

const readStoredUser = () => {
  const saved = localStorage.getItem('user');
  return saved ? JSON.parse(saved) as User : null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: readStoredUser(),
  accessToken: localStorage.getItem('accessToken'),
  isLoading: false,

  login: async (email: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(email, password);
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
