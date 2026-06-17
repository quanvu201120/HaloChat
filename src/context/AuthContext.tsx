import { createContext, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi, clearStoredAuth, notifyStoredUserChanged, persistAccessToken, subscribeAuthStorage } from '../services/api';

interface User {
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

interface AuthContextType {
  user: User | null;
  accessToken: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateUser: (data: Partial<User>) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const readStoredUser = () => {
    const saved = localStorage.getItem('user');
    return saved ? JSON.parse(saved) as User : null;
  };

  const [user, setUser] = useState<User | null>(readStoredUser);
  const [accessToken, setAccessToken] = useState<string | null>(
    () => localStorage.getItem('accessToken')
  );
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return subscribeAuthStorage(() => {
      setAccessToken(localStorage.getItem('accessToken'));
      setUser(readStoredUser());
    });
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
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
      setUser(user);
    } catch (error) {
      clearStoredAuth();
      throw error;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    try {
      await authApi.logout();
    } catch {
      // ignore
    }
    clearStoredAuth();
  };

  const logoutAll = async () => {
    await authApi.logoutAll();
    clearStoredAuth();
  };

  const updateUser = (data: Partial<User>) => {
    if (!user) return;
    const merged = { ...user, ...data };
    setUser(merged);
    localStorage.setItem('user', JSON.stringify(merged));
    notifyStoredUserChanged();
  };

  return (
    <AuthContext.Provider value={{ user, accessToken, login, logout, logoutAll, updateUser, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
