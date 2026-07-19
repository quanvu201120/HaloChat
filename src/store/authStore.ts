import { create } from 'zustand';
import {
  type AppealContext,
  type LoginPayload,
  authApi,
  broadcastAccessToken,
  clearStoredAuth,
  getAccessToken,
  notifyStoredUserChanged,
  persistAccessToken,
  releaseSessionRefreshLock,
  subscribeAuthStorage,
  tryAcquireSessionRefreshLock,
  waitForBroadcastAccessToken
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
  hasPassword?: boolean;
  avatar?: {
    _id?: string;
    url?: string;
  };
}

interface AuthState {
  user: User | null;
  accessToken: string | null;
  bannedAppeal: (AppealContext & { banUntil?: string }) | null;
  sessionRestoreError: { message: string; retryAfterSeconds: number } | null;
  isLoading: boolean;
  isSessionRestoring: boolean;
  isAdminVerified: boolean;
  login: (identifier: string, password: string) => Promise<LoginPayload>;
  googleLogin: (code: string) => Promise<LoginPayload>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  localLogout: () => void;
  updateUser: (data: Partial<User>) => void;
  setAdminVerified: (status: boolean) => void;
  setBannedAppeal: (data: (AppealContext & { banUntil?: string }) | null) => void;
  retrySessionRestore: () => Promise<void>;
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

const storedUser = readStoredUser();
const storedAccessToken = getAccessToken();
let sessionRefreshPromise: Promise<void> | null = null;
const CREATE_PASSWORD_PROMPT_KEY = 'halochat_create_password_prompt';
const BANNED_APPEAL_SESSION_KEY = 'halochat_banned_appeal';

const readStoredBannedAppeal = () => {
  const saved = sessionStorage.getItem(BANNED_APPEAL_SESSION_KEY);
  if (!saved) return null;

  try {
    return JSON.parse(saved) as AppealContext & { banUntil?: string };
  } catch {
    sessionStorage.removeItem(BANNED_APPEAL_SESSION_KEY);
    return null;
  }
};

const persistBannedAppeal = (data: (AppealContext & { banUntil?: string }) | null) => {
  if (data) {
    sessionStorage.setItem(BANNED_APPEAL_SESSION_KEY, JSON.stringify(data));
    return;
  }

  sessionStorage.removeItem(BANNED_APPEAL_SESSION_KEY);
};

const getErrorMessage = (error: any) => {
  const message = error?.response?.data?.message;
  if (typeof message === 'string') return message;
  return error?.message || 'KhÃ´ng thá»ƒ khÃ´i phá»¥c phiÃªn Ä‘Äƒng nháº­p. Vui lÃ²ng thá»­ láº¡i.';
};

const getRetryAfterSeconds = (error: any) => {
  const header = error?.response?.headers?.['retry-after'];
  const headerSeconds = Number(header);
  if (Number.isFinite(headerSeconds) && headerSeconds > 0) return Math.ceil(headerSeconds);

  const matched = getErrorMessage(error).match(/(\d+)/);
  if (matched) {
    const seconds = Number(matched[1]);
    if (Number.isFinite(seconds) && seconds > 0) return seconds;
  }

  return 10;
};

const getRefreshAccessToken = (data: unknown) => {
  const responseData = data as { data?: unknown };
  const payload = responseData?.data ?? data;
  const accessToken = typeof payload === 'object' && payload !== null && 'accessToken' in payload
    ? (payload as { accessToken?: unknown }).accessToken
    : null;
  const newToken = accessToken || (typeof payload === 'string' ? payload : null);
  return typeof newToken === 'string' && newToken ? newToken : null;
};

export const useAuthStore = create<AuthState>((set, get) => ({
  user: storedUser,
  accessToken: storedAccessToken,
  bannedAppeal: readStoredBannedAppeal(),
  sessionRestoreError: null,
  isLoading: false,
  isSessionRestoring: Boolean(storedUser && !storedAccessToken),
  isAdminVerified: false,

  setAdminVerified: (status: boolean) => set({ isAdminVerified: status }),
  setBannedAppeal: (data) => {
    persistBannedAppeal(data);
    set({ bannedAppeal: data });
  },

  login: async (identifier: string, password: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.login(identifier, password);
      const payload = (res.data?.data || res.data) as LoginPayload;
      const { accessToken, user, isBanned, banUntil, appeal } = payload;

      if (isBanned) {
        const bannedAppeal = appeal ? { ...appeal, banUntil } : null;
        clearStoredAuth();
        persistBannedAppeal(bannedAppeal);
        set({
          user: null,
          accessToken: null,
          bannedAppeal,
        });
        return payload;
      }

      if (!accessToken || !user) {
        throw new Error('Đăng nhập thất bại: Không nhận được token từ server');
      }

      persistAccessToken(accessToken);
      persistBannedAppeal(null);
      localStorage.setItem('user', JSON.stringify(user));
      notifyStoredUserChanged();
      if (user?.accountType === 'GOOGLE' && user?.hasPassword === false) {
        sessionStorage.setItem(CREATE_PASSWORD_PROMPT_KEY, '1');
      } else {
        sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
      }
      set({ user, accessToken, bannedAppeal: null, sessionRestoreError: null });
      return payload;
    } catch (error) {
      clearStoredAuth();
      persistBannedAppeal(null);
      set({ bannedAppeal: null });
      throw error;
    } finally {
      set({ isLoading: false });
    }
  },

  googleLogin: async (code: string) => {
    set({ isLoading: true });
    try {
      const res = await authApi.googleLogin(code);
      const payload = (res.data?.data || res.data) as LoginPayload;
      const { accessToken, user, isBanned, banUntil, appeal } = payload;

      if (isBanned) {
        const bannedAppeal = appeal ? { ...appeal, banUntil } : null;
        clearStoredAuth();
        persistBannedAppeal(bannedAppeal);
        set({
          user: null,
          accessToken: null,
          bannedAppeal,
        });
        return payload;
      }

      if (!accessToken || !user) {
        throw new Error('Đăng nhập Google thất bại: Không nhận được token từ server');
      }

      persistAccessToken(accessToken);
      persistBannedAppeal(null);
      localStorage.setItem('user', JSON.stringify(user));
      notifyStoredUserChanged();
      if (user?.accountType === 'GOOGLE' && user?.hasPassword === false) {
        sessionStorage.setItem(CREATE_PASSWORD_PROMPT_KEY, '1');
      } else {
        sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
      }
      set({ user, accessToken, bannedAppeal: null, sessionRestoreError: null });
      return payload;
    } catch (error) {
      clearStoredAuth();
      persistBannedAppeal(null);
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
    persistBannedAppeal(null);
    sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
    set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
  },

  localLogout: () => {
    clearStoredAuth();
    persistBannedAppeal(null);
    sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
    set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
  },

  logoutAll: async () => {
    await authApi.logoutAll();
    clearStoredAuth();
    persistBannedAppeal(null);
    sessionStorage.removeItem(CREATE_PASSWORD_PROMPT_KEY);
    set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
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
    let isRefreshingSession = false;

    const refreshSession = async () => {
      const user = readStoredUser();
      const currentToken = getAccessToken();

      if (!user) {
        set({ user: null, accessToken: null, sessionRestoreError: null, isSessionRestoring: false });
        return;
      }

      if (currentToken) {
        set({ user, accessToken: currentToken, sessionRestoreError: null, isSessionRestoring: false });
        return;
      }

      if (sessionRefreshPromise) {
        await sessionRefreshPromise;
        return;
      }

      isRefreshingSession = true;
      set({ isSessionRestoring: true });

      sessionRefreshPromise = (async () => {
        let hasRefreshLock = false;
        try {
          const broadcastToken = await waitForBroadcastAccessToken(800, false);
          if (broadcastToken) {
            persistAccessToken(broadcastToken);
            set({ user, accessToken: broadcastToken, sessionRestoreError: null });
            return;
          }

          hasRefreshLock = tryAcquireSessionRefreshLock();
          if (!hasRefreshLock) {
            const fallbackToken = await waitForBroadcastAccessToken();
            if (fallbackToken) {
              persistAccessToken(fallbackToken);
              set({ user, accessToken: fallbackToken, sessionRestoreError: null });
              return;
            }

            hasRefreshLock = tryAcquireSessionRefreshLock();
          }

          const res = await authApi.refreshToken();
          const newToken = getRefreshAccessToken(res.data);

          if (newToken) {
            persistAccessToken(newToken);
            broadcastAccessToken(newToken);
            set({ user, accessToken: newToken, sessionRestoreError: null });
          } else {
            clearStoredAuth();
            set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
          }
        } catch (error: any) {
          const status = error?.response?.status;

          if (status === 401 || status === 403) {
            const broadcastToken = await waitForBroadcastAccessToken(1500, false);
            if (broadcastToken) {
              persistAccessToken(broadcastToken);
              set({ user, accessToken: broadcastToken, sessionRestoreError: null });
              return;
            }

            clearStoredAuth();
            set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
            return;
          }

          set({
            user,
            accessToken: null,
            sessionRestoreError: {
              message: getErrorMessage(error),
              retryAfterSeconds: getRetryAfterSeconds(error),
            },
          });
        } finally {
          if (hasRefreshLock) {
            releaseSessionRefreshLock();
          }
          sessionRefreshPromise = null;
          isRefreshingSession = false;
          set({ isSessionRestoring: false });
        }
      })();

      await sessionRefreshPromise;
    };

    void refreshSession();

    return subscribeAuthStorage(() => {
      const accessToken = getAccessToken();
      const user = readStoredUser();

      set({
        accessToken,
        user,
        bannedAppeal: get().bannedAppeal,
      });

      if (user && !accessToken && !isRefreshingSession) {
        void refreshSession();
      }
    });
  },

  retrySessionRestore: async () => {
    const user = readStoredUser();
    const currentToken = getAccessToken();

    if (!user) {
      set({ user: null, accessToken: null, sessionRestoreError: null });
      return;
    }

    if (currentToken) {
      set({ user, accessToken: currentToken, sessionRestoreError: null });
      return;
    }

    set({ isSessionRestoring: true, sessionRestoreError: null });

    let hasRefreshLock = false;
    try {
      const broadcastToken = await waitForBroadcastAccessToken(800, false);
      if (broadcastToken) {
        persistAccessToken(broadcastToken);
        set({ user, accessToken: broadcastToken, sessionRestoreError: null });
        return;
      }

      hasRefreshLock = tryAcquireSessionRefreshLock();
      if (!hasRefreshLock) {
        const fallbackToken = await waitForBroadcastAccessToken();
        if (fallbackToken) {
          persistAccessToken(fallbackToken);
          set({ user, accessToken: fallbackToken, sessionRestoreError: null });
          return;
        }

        hasRefreshLock = tryAcquireSessionRefreshLock();
      }

      const res = await authApi.refreshToken();
      const newToken = getRefreshAccessToken(res.data);

      if (newToken) {
        persistAccessToken(newToken);
        broadcastAccessToken(newToken);
        set({ user, accessToken: newToken, sessionRestoreError: null });
      } else {
        clearStoredAuth();
        set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
      }
    } catch (error: any) {
      const status = error?.response?.status;

      if (status === 401 || status === 403) {
        const broadcastToken = await waitForBroadcastAccessToken(1500, false);
        if (broadcastToken) {
          persistAccessToken(broadcastToken);
          set({ user, accessToken: broadcastToken, sessionRestoreError: null });
          return;
        }

        clearStoredAuth();
        set({ user: null, accessToken: null, bannedAppeal: null, sessionRestoreError: null });
        return;
      }

      set({
        user,
        accessToken: null,
        sessionRestoreError: {
          message: getErrorMessage(error),
          retryAfterSeconds: getRetryAfterSeconds(error),
        },
      });
    } finally {
      if (hasRefreshLock) {
        releaseSessionRefreshLock();
      }
      set({ isSessionRestoring: false });
    }
  },
}));
