import axios from 'axios';

const envApiOrigin = import.meta.env.VITE_API_ORIGIN?.trim();

// Trong môi trường dev, backend luôn chạy ở cổng 8080 trên cùng IP/hostname
// Điều này giúp truy cập từ điện thoại (LAN IP) tự động trỏ đúng backend
const defaultOrigin = import.meta.env.DEV
  ? `http://${window.location.hostname}:8080`
  : ''; // Trả về rỗng ở production để tự động bắt Same-Origin

export const API_ORIGIN = envApiOrigin ? envApiOrigin : defaultOrigin;
export const API_BASE_URL = API_ORIGIN ? `${API_ORIGIN}/api/v1` : '/api/v1';

const AUTH_STORAGE_EVENT = 'halochat-auth-storage';

function emitAuthStorageEvent() {
  window.dispatchEvent(new Event(AUTH_STORAGE_EVENT));
}

export function persistAccessToken(token: string) {
  localStorage.setItem('accessToken', token);
  emitAuthStorageEvent();
}

export function clearStoredAuth() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('user');
  emitAuthStorageEvent();
}

export function notifyStoredUserChanged() {
  emitAuthStorageEvent();
}

export function subscribeAuthStorage(listener: () => void) {
  window.addEventListener(AUTH_STORAGE_EVENT, listener);
  window.addEventListener('storage', listener);

  return () => {
    window.removeEventListener(AUTH_STORAGE_EVENT, listener);
    window.removeEventListener('storage', listener);
  };
}

// Instance CHÍNH — bật withCredentials để login/refresh cookie flow hoạt động ổn định cross-origin
export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: {
    'Cache-Control': 'no-cache',
  },
});

// Instance CHO COOKIE endpoints (refreshToken, logout) — giữ riêng để flow auth rõ ràng
const apiWithCookies = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
});

// ===== Parse error message từ backend =====
// Backend có 2 dạng lỗi:
// 1. BadRequest/Unauthorized: { statusCode, message, error }
// 2. ValidationPipe (422): { statusCode, error, message: "Validation failed", errors: { field: "msg" } }
export function parseError(err: any): string {
  const res = err?.response?.data;
  if (!res) {
    // Network error (no response)
    if (err?.code === 'ERR_NETWORK' || err?.message === 'Network Error') {
      return 'Không kết nối được server. Vui lòng thử lại sau.';
    }
    return err?.message || 'Có lỗi xảy ra, vui lòng thử lại';
  }

  // Lỗi validation 422 — lấy field đầu tiên trong errors object
  if (res.errors && typeof res.errors === 'object') {
    const firstError = Object.values(res.errors)[0];
    if (typeof firstError === 'string') return firstError;
    if (typeof firstError === 'object') {
      const nested = Object.values(firstError as object)[0];
      if (typeof nested === 'string') return nested;
    }
  }

  // Lỗi thông thường (400, 401, 403, 404...)
  if (typeof res.message === 'string' && res.message !== 'Validation failed') {
    return res.message;
  }

  return 'Có lỗi xảy ra, vui lòng thử lại';
}

// Attach JWT token vào mỗi request
const attachToken = (config: any) => {
  const token = localStorage.getItem('accessToken');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
};

api.interceptors.request.use(attachToken);
apiWithCookies.interceptors.request.use(attachToken);

let isRefreshing = false;
let failedQueue: Array<{ resolve: (token: string) => void; reject: (err: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else if (token) {
      prom.resolve(token);
    }
  });
  failedQueue = [];
};

// Tự refresh token khi gặp 401
api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config || {};
    const status = error.response?.status;
    const requestUrl = String(original.url || '');

    const isAuthEndpoint =
      requestUrl.includes('/auth/login') ||
      requestUrl.includes('/auth/register') ||
      requestUrl.includes('/auth/active') ||
      requestUrl.includes('/auth/resend-code-active') ||
      requestUrl.includes('/auth/forgot-password') ||
      requestUrl.includes('/auth/reset-password');

    const hasAccessToken = Boolean(localStorage.getItem('accessToken'));

    if (status === 401 && !original._retry && !isAuthEndpoint && hasAccessToken) {
      if (isRefreshing) {
        return new Promise(function (resolve, reject) {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            original.headers = original.headers || {};
            original.headers.Authorization = `Bearer ${token}`;
            return api(original);
          })
          .catch((err) => {
            return Promise.reject(err);
          });
      }

      original._retry = true;
      isRefreshing = true;

      try {
        const { data } = await apiWithCookies.post('/auth/refreshToken');
        const resData = data?.data ?? data;
        const newToken = resData?.accessToken || (typeof resData === 'string' ? resData : null);
        
        if (typeof newToken === 'string' && newToken) {
          persistAccessToken(newToken);
          original.headers = original.headers || {};
          original.headers.Authorization = `Bearer ${newToken}`;
          processQueue(null, newToken);
          return api(original);
        } else {
          throw new Error('Invalid token format');
        }
      } catch (err) {
        processQueue(err, null);
        clearStoredAuth();
        window.location.href = '/login';
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }
    return Promise.reject(error);
  }
);

// ===== AUTH =====
export const authApi = {
  // LocalStrategy: usernameField = 'email' → gửi { email, password }
  login: (identifier: string, password: string) =>
    apiWithCookies.post('/auth/login', { identifier, password }),

  // Logout cần cookie refreshToken → dùng apiWithCookies
  logout: () => apiWithCookies.post('/auth/logout'),

  logoutAll: () => apiWithCookies.post('/auth/logoutAll'),

  // RegisterAuthDto: { email, password, confirmPassword }
  register: (data: { email: string; password: string; confirmPassword: string }) =>
    api.post('/auth/register', data),

  // ActiveAuthDto: { email, code }
  active: (email: string, code: string) =>
    api.post('/auth/active', { email, code }),

  // ResendCodeAuthDto: { email }
  resendCode: (email: string) =>
    api.post('/auth/resend-code-active', { email }),

  // ForgotPasswordAuthDto: { email }
  forgotPassword: (email: string) =>
    api.post('/auth/forgot-password', { email }),

  // ResetPasswordAuthDto: { email, code, password, confirmPassword }
  resetPassword: (data: { email: string; code: string; password: string; confirmPassword: string }) =>
    api.post('/auth/reset-password', data),

  // ChangePasswordAuthDto: { passwordOld, passwordNew, confirmPassword }
  changePassword: (data: { passwordOld: string; passwordNew: string; confirmPassword: string }) =>
    api.post('/auth/change-password', data),

  confirmPassword: (password: string) =>
    api.patch('/auth/confirm-password', { password }),

  sendCodeUpdateEmail: (email: string) =>
    api.post('/auth/send-code-update-email', { email }),

  updateEmail: (email: string, code: string) =>
    api.patch('/auth/update-email', { email, code }),

  // Refresh token dùng cookie → apiWithCookies
  refreshToken: () => apiWithCookies.post('/auth/refreshToken'),
};

export const systemApi = {
  getHello: () => axios.get(API_BASE_URL, {
    headers: (() => {
      const token = localStorage.getItem('accessToken');
      return token ? { Authorization: `Bearer ${token}` } : undefined;
    })(),
  }),
};

export const presenceApi = {
  getUsersOnline: (userIds: string[]) =>
    api.post<string[]>('/presence/users-online', { userIds }),
};

// ===== USERS =====
export const usersApi = {
  getAll: (params?: { current?: number; pageSize?: number; [key: string]: any }) =>
    api.get('/users', { params }),

  search: (query: string) => api.get('/users/search', { params: { query } }),

  getOne: (id: string) => api.get(`/users/${id}`),

  // CreateUserDto: { name*, email*, password*, confirmPassword*, phone?, address?, role? }
  create: (data: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone?: string;
    address?: string;
    role?: string;
  }) => api.post('/users', data),

  // UpdateUserDto: { name*, phone?, address?, dateOfBirth?, gender?, bio? }
  update: (data: {
    name: string;
    phone?: string | null;
    address?: string | null;
    dateOfBirth?: string | null;
    gender?: string | null;
    bio?: string | null;
  }) => api.patch('/users/me', data),

  // UpdateUserByAdminDto: { name?, email?, phone?, address?, role?, dateOfBirth?, gender?, bio? }
  updateByAdmin: (id: string, data: {
    name?: string;
    email?: string;
    phone?: string | null;
    address?: string | null;
    role?: string;
    dateOfBirth?: string | null;
    gender?: string | null;
    bio?: string | null;
  }) => api.patch(`/users/${id}`, data),

  delete: (id: string) => api.delete(`/users/${id}`),

  uploadAvatar: (file: File) => {
    const normalizedFile = file.type
      ? file
      : new File([file], file.name, {
        type: 'image/jpeg',
        lastModified: file.lastModified,
      });
    const formData = new FormData();
    formData.append('file', normalizedFile);
    return api.patch('/users/avatar', formData);
  },

  deleteAvatar: () => api.delete('/users/avatar'),

  disableSelf: () => apiWithCookies.patch('/users/me/disable'),
};

export const relationshipsApi = {
  getRelationships: () => api.get('/relationships'),
  create: (data: { targetUserId: string }) => api.post('/relationships', { recipient: data.targetUserId }),
  block: (data: { targetUserId: string }) => api.patch('/relationships/block', data),
  unblock: (data: { targetUserId: string }) => api.patch('/relationships/unblock', data),
  accept: (id: string, data: { targetUserId: string }) => api.patch(`/relationships/${id}/accept`, data),
  rejectOrRemove: (id: string, data: { targetUserId: string }) => api.patch(`/relationships/${id}/rejectOrRemove`, data),
  unfriend: (id: string, data: { targetUserId: string }) => api.patch(`/relationships/${id}/unfriend`, data),
};
