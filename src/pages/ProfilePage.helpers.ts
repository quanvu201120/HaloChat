import { z } from 'zod';
import { UI_MESSAGES } from '../constants/messages';
import { getDeviceCategoryForDisplay, getDeviceDetailLabel, getDeviceDisplayLabel } from '../utils/device';

export const CREATE_PASSWORD_PROMPT_CLOSED_EVENT = 'halochat_create_password_prompt_closed';

export const profileSchema = z.object({
  name: z.string().optional(),
  phone: z.string()
    .optional()
    .refine((val) => !val || /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(val), {
      message: UI_MESSAGES.profile.phoneInvalid,
    }),
  address: z.string().max(150).optional(),
  dateOfBirth: z.string().optional().refine((val) => {
    if (!val) return true;
    const d = new Date(val);
    if (isNaN(d.getTime())) return false;
    return d <= new Date();
  }, { message: UI_MESSAGES.profile.dateOfBirthInvalid }),
  gender: z.string().optional(),
  bio: z.string().max(250).optional(),
});

export type ProfileFormValues = z.infer<typeof profileSchema>;

export type ProfileSession = {
  sessionId: string;
  deviceId: string;
  deviceCategory: ReturnType<typeof getDeviceCategoryForDisplay>;
  deviceLabel: string;
  deviceDetail: string;
  lastActiveLabel: string;
  lastActiveAt: number;
  isCurrent: boolean;
};

export type SessionApiItem = {
  _id?: string;
  deviceId?: string;
  sessionId?: string;
  deviceName?: string;
  userAgent?: string;
  expiresAt?: string | Date;
  lastUsedAt?: string | Date;
  createdAt?: string | Date;
  updatedAt?: string | Date;
};

export const decodeJwtPayload = (token?: string | null) => {
  if (!token) return null;

  const parts = token.split('.');
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
    return JSON.parse(window.atob(padded)) as { sessionId?: string };
  } catch {
    return null;
  }
};

export const formatDateTime = (value?: string | Date | null) => {
  if (!value) return 'Không rõ';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Không rõ';

  const time = new Intl.DateTimeFormat('vi-VN', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(date);

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();

  return `${time} - ${day}/${month}/${year}`;
};

export const toTimestamp = (value?: string | Date | null) => {
  if (!value) return 0;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 0 : date.getTime();
};

export const mapSessionItem = (session: SessionApiItem, currentSessionId: string | null): ProfileSession | null => {
  const sessionId = String(session?._id || session?.sessionId || '').trim();
  const deviceId = String(session?.deviceId || '').trim();
  if (!sessionId || !deviceId) return null;

  return {
    sessionId,
    deviceId,
    deviceCategory: getDeviceCategoryForDisplay(session?.deviceName, session?.userAgent),
    deviceLabel: getDeviceDisplayLabel(session?.deviceName, session?.userAgent),
    deviceDetail: getDeviceDetailLabel(session?.userAgent),
    lastActiveLabel: `Hoạt động gần nhất: ${formatDateTime(session?.lastUsedAt || session?.updatedAt || session?.createdAt)}`,
    lastActiveAt: toTimestamp(session?.lastUsedAt || session?.updatedAt || session?.createdAt),
    isCurrent: Boolean(currentSessionId && sessionId === currentSessionId),
  };
};
