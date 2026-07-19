import { api } from './api';
import { UserRole } from '../constants/roles';

// DTOs for Admin endpoints based on backend responses and plans

export interface SystemLimits {
  database: number | string; // 'Unlimited' or limit
  redis: number | string;
  cloudinary: number | string;
  r2: number | string;
}

export interface InfrastructureStats {
  bandwidth: { inbound: number; outbound: number };
  database: { activeConnections: number; queriesPerSecond: number; avgResponseTime: number; diskUsage: number };
  redis: { memoryUsage: number; hitRate: number; connectedClients: number };
  upload: { storageUsed: number; fileCount: number; bandwidthUsed: number };
}

export const ReportStatusEnum = {
    PENDING: 'pending',
    RESOLVING: 'resolving',
    RESOLVED: 'resolved',
    DISMISSED: 'dismissed',
    APPEAL_PENDING: 'appeal_pending',
    APPEAL_REJECTED: 'appeal_rejected',
    APPEAL_SUCCESS: 'appeal_success',
  } as const;
export type ReportStatusEnum = typeof ReportStatusEnum[keyof typeof ReportStatusEnum];

export const ReportReasonEnum = {
    SPAM_HARASSMENT: 'spam_harassment',
    INAPPROPRIATE_CONTENT: 'inappropriate_content',
    IMPERSONATION: 'impersonation',
    SYSTEM_SPAM: 'system_spam',
    OTHER: 'other',
  } as const;
export type ReportReasonEnum = typeof ReportReasonEnum[keyof typeof ReportReasonEnum];

export interface Report {
  _id: string;
  reporterId: any;
  targetUserId: any;
  reason: ReportReasonEnum;
  description?: string;
  evidenceMediaIds?: any[];
  status: ReportStatusEnum;
  snapshot?: any;
  appealText?: string;
  appealEvidenceMediaIds?: any[];
  appealDeadline?: Date;
  appealReviewDeadline?: Date;
  penaltyApplied?: string;
  adminNote?: string;
  resolvedBy?: any;
  resolvedAt?: Date;
  createdAt: string | Date;
  updatedAt: string | Date;
}

export interface ReportPenaltySuggestion {
  action: string | null;
  durationDays: number;
  strike: number;
}

export interface StatsOverview {
  totals: {
    users: number;
    logins: number;
    messages: number;
    conversations: number;
    groups: number;
    directs: number;
    activeUsers: number; // users online/active
  };
  messageBreakdown: {
    text: number;
    image: number;
    video: number;
    file: number;
    voice: number;
  };
  metrics: {
    peakOnlineUsers: number;
    bandwidthUsage: number; // in GB
    cloudinaryBandwidth: number; // in GB
    r2Bandwidth: number; // in GB
    uploadCloudinary: number; // in MB
    uploadR2: number; // in MB
    redisPeakClients: number;
    redisPeakMemoryMB: number;
    newUsersToday: number;
  };
  storage: {
    cloudinaryUsed: number;
    cloudinaryPeak: number;
    r2Used: number;
    r2Peak: number;
    mongoUsedMB: number;
    redisRamUsed: number; // MB or percentage
    redisRamTotal: number;
  };
  limits: SystemLimits;
}

export interface UserAdminData {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  address?: string;
  role: UserRole;
  accountType?: string;
  isActive: boolean;
  isDisabled: boolean;
  disabledAt?: string;
  lastOnlineAt?: string;
  avatar?: string;
  createdAt: string;
  dateOfBirth?: string;
  gender?: string;
  bio?: string;
  banUntil?: string;
  muteUntil?: string;
}

export interface ServiceHealth {
  status: 'online' | 'offline';
  ping: number; // ms
  uptime?: string; // e.g., "5 days"
}

export interface SystemHealth {
  backendUptime: string;
  redisUptime: string;
  services: {
    mongodb: ServiceHealth;
    redis: ServiceHealth;
    cloudinary: ServiceHealth;
    r2: ServiceHealth;
  };
}

export interface CleanupJob {
  _id: string;
  action: string;
  status: 'PENDING' | 'RETRY' | 'DONE' | 'FAILED' | 'IGNORED';
  lastTriedAt?: string;
  nextRetryAt?: string;
  resolvedAt?: string;
  createdAt: string;
  updatedAt?: string;
  error?: string;
  payload?: any;
  lockedBy?: string;
  lockedUntil?: string;
  retryCount?: number;
  maxRetries?: number;
}

export interface AuditLogData {
  _id: string;
  actor: any;
  actorRole: string;
  action: string;
  target: any;
  targetType: string;
  metadata?: any;
  ip: string;
  userAgent: string;
  createdAt: string;
}

export const adminApi = {
  // === TAB 1: OVERVIEW ===
  getOverview: (startDate?: string, endDate?: string) => api.get('/stats/overview', { params: { startDate, endDate } }).then(res => {
    const p = res.data?.data || res.data;
    return {
      totals: {
        users: p.totals?.totalNewUsers || 0,
        logins: p.totals?.totalLogins || 0,
        messages: (p.totals?.totalMessagesText || 0) + (p.totals?.totalMessagesImage || 0) + (p.totals?.totalMessagesVideo || 0) + (p.totals?.totalMessagesFile || 0) + (p.totals?.totalMessagesVoice || 0),
        conversations: (p.totals?.totalNewDirects || 0) + (p.totals?.totalNewGroups || 0),
        groups: p.totals?.totalNewGroups || 0,
        directs: p.totals?.totalNewDirects || 0,
        activeUsers: parseInt(p.current?.redis?.connectedClients || '0'),
      },
      messageBreakdown: {
        text: p.totals?.totalMessagesText || 0,
        image: p.totals?.totalMessagesImage || 0,
        video: p.totals?.totalMessagesVideo || 0,
        file: p.totals?.totalMessagesFile || 0,
        voice: p.totals?.totalMessagesVoice || 0,
      },
      metrics: {
        peakOnlineUsers: p.totals?.peakOnlineUsers || 0,
        bandwidthUsage: Number((((p.current?.cloud?.cloudinaryBandwidthBytes || 0) + (p.current?.cloud?.r2BandwidthBytes || 0)) / (1024 * 1024)).toFixed(2)),
        cloudinaryBandwidth: Number(((p.current?.cloud?.cloudinaryBandwidthBytes || 0) / (1024 * 1024)).toFixed(2)),
        cloudinaryCredits: Number((p.current?.cloud?.cloudinaryCreditsUsage || 0).toFixed(2)),
        r2Bandwidth: Number(((p.current?.cloud?.r2BandwidthBytes || 0) / (1024 * 1024)).toFixed(2)),
        uploadCloudinary: Number(((p.totals?.totalUploadBytesCloudinary || 0) / (1024 * 1024)).toFixed(2)),
        uploadR2: Number(((p.totals?.totalUploadBytesR2 || 0) / (1024 * 1024)).toFixed(2)),
        redisPeakClients: p.totals?.redisPeakClients || 0,
        redisPeakMemoryMB: Number(((p.totals?.redisPeakMemoryBytes || 0) / (1024 * 1024)).toFixed(2)),
        newUsersToday: 0, // Need a separate daily query to get exact today, 0 for now
      },
      storage: {
        cloudinaryUsed: Number(((p.current?.cloud?.currentCloudinaryStorageBytes || 0) / (1024 * 1024)).toFixed(2)),
        cloudinaryPeak: Number(((p.current?.cloud?.cloudinaryStorageBytes || 0) / (1024 * 1024)).toFixed(2)),
        r2Used: Number(((p.current?.cloud?.currentR2StorageBytes || 0) / (1024 * 1024)).toFixed(2)),
        r2Peak: Number(((p.current?.cloud?.r2StorageBytes || 0) / (1024 * 1024)).toFixed(2)),
        mongoUsedMB: Number(((p.current?.mongoStorageBytes || 0) / (1024 * 1024)).toFixed(2)),
        redisRamUsed: Number(p.current?.redis?.usedMemoryBytes ? (p.current.redis.usedMemoryBytes / (1024 * 1024)).toFixed(2) : 0),
        redisRamTotal: Math.round((p.current?.redis?.totalMemoryBytes || 1024 * 1024 * 1024) / (1024 * 1024)),
      },
      limits: {
        database: p.systemLimits?.database || 'Unlimited',
        redis: Math.round((p.current?.redis?.totalMemoryBytes || 1024 * 1024 * 1024) / (1024 * 1024)),
        cloudinary: p.systemLimits?.cloudinaryStorageBytes ? Math.round(p.systemLimits.cloudinaryStorageBytes / (1024 * 1024)) : 'Unlimited',
        r2: p.systemLimits?.r2StorageBytes ? Math.round(p.systemLimits.r2StorageBytes / (1024 * 1024)) : 'Unlimited',
      }
    } as StatsOverview;
  }),
  
  getChartData: (type: 'daily' | 'weekly' | 'monthly' | 'yearly', dataType: 'users' | 'messages' | 'bandwidth', startDate?: string, endDate?: string) => 
    api.get(`/stats/chart`, { params: { type, dataType, startDate, endDate } }).then(res => res.data?.data || res.data),

  // === TAB 2: USERS ===
  getUsers: (params?: { page?: number; limit?: number; search?: string; status?: string; role?: string; sort?: string }) => 
    api.get('/users/admin', { params: { current: params?.page || 1, pageSize: params?.limit || 20, query: params?.search, status: params?.status, role: params?.role, sort: params?.sort } }).then(res => {
      const p = res.data?.data || res.data;
      return {
        items: p.users || [],
        total: p.totalItems ?? ((p.totalPages || 0) * (params?.limit || 20)) // Approximate total based on totalPages if total is missing
      };
    }),

  getUserDetail: (id: string) => api.get(`/users/admin/${id}`).then(res => (res.data?.data || res.data) as UserAdminData),
  
  createUser: (data: any) => api.post('/users', data).then(res => res.data?.data || res.data),
  
  quickPenalty: (targetUserId: string, data: { reason: string; resetAvatar?: boolean; resetBio?: boolean; resetName?: boolean; adminNote?: string; password?: string }) => 
    api.post(`/reports/quick-penalty/${targetUserId}`, data).then(res => res.data?.data || res.data),

  manualBan: (targetUserId: string, data: { reason: string; durationDays: number; password?: string; resetAvatar?: boolean; resetBio?: boolean; resetName?: boolean; }) => 
    api.post(`/reports/manual-ban/${targetUserId}`, data).then(res => res.data?.data || res.data),
  
  logoutAllDevices: (id: string, reason: string) => api.post(`/auth/${id}/logoutAll-by-admin`, { reason }).then(res => res.data?.data || res.data),
  
  enableUser: (id: string, password: string | undefined, reason: string) => 
    api.patch(`/users/${id}/enable`, { password, reason }).then(res => res.data?.data || res.data),
    
  unbanUser: (id: string, password: string | undefined, reason: string) =>
    api.patch(`/reports/${id}/unban`, { password, reason }).then(res => res.data?.data || res.data),

  unmuteUser: (id: string, password: string | undefined, reason: string) =>
    api.patch(`/reports/${id}/unmute`, { password, reason }).then(res => res.data?.data || res.data),

  changeUserRole: (id: string, data: { role: string; password: string; reason?: string }) => api.patch(`/users/${id}/role`, data).then(res => res.data?.data || res.data),

  // === TAB 3: MAINTENANCE ===
  getHealth: () => api.get('/stats/health').then(res => {
    const p = res.data?.data || res.data;
    return {
      backendUptime: `${Math.round((p.uptimeSeconds || 0) / 3600)}h ${Math.round(((p.uptimeSeconds || 0) % 3600) / 60)}m`,
      redisUptime: 'Online',
      services: {
        mongodb: { status: p.services?.mongodb?.status ? 'online' : 'offline', ping: p.services?.mongodb?.ping || 0 },
        redis: { status: p.services?.redis?.status ? 'online' : 'offline', ping: p.services?.redis?.ping || 0 },
        cloudinary: { status: p.services?.cloudinary?.status ? 'online' : 'offline', ping: p.services?.cloudinary?.ping || 0 },
        r2: { status: p.services?.r2?.status ? 'online' : 'offline', ping: p.services?.r2?.ping || 0 },
      }
    } as SystemHealth;
  }),

  syncStats: () => api.post('/stats/sync').then(res => res.data?.data || res.data),

  getCleanupJobs: (params?: { page?: number; limit?: number; type?: string; status?: string; sort?: string }) => 
    api.get('/cleanup-jobs', { params: { page: params?.page || 1, limit: params?.limit || 20, type: params?.type, status: params?.status, sort: params?.sort } }).then(res => {
      const p = res.data?.data || res.data;
      return {
        items: (p.cleanupJobs || []) as CleanupJob[],
        total: p.pagination?.totalItems || 0
      };
    }),
  
  getJobDetail: (id: string) => api.get(`/cleanup-jobs/${id}`).then(res => res.data?.data || res.data),
  
  runJobManually: (id: string) => api.patch(`/cleanup-jobs/process/${id}`).then(res => res.data?.data || res.data),
  
  ignoreJob: (id: string) => api.patch(`/cleanup-jobs/${id}/status`, null, { params: { status: 'IGNORED' } }).then(res => res.data?.data || res.data),

  // === TAB 4: AUDIT LOGS ===
  getAuditLogs: (params?: { 
    cursor?: string; 
    actorId?: string; 
    targetId?: string;
    action?: string;
    targetType?: string;
    actorRole?: string;
    ip?: string;
    startDate?: string;
    endDate?: string;
  }) => api.get('/audit-logs', { params }).then(res => res.data?.data || res.data),


  // === TAB 5: REPORTS ===
  getReports: (params?: {
    current?: number | string;
    pageSize?: number | string;
    status?: string;
    targetUserId?: string;
    reporterId?: string;
    resolvedBy?: string;
    startDate?: string;
    endDate?: string;
    reason?: string;
    targetRole?: string;
    reportId?: string;
    sort?: string;
  }) => api.get('/reports', { params }).then(res => res.data?.data || res.data),

  resolveReport: (reportId: string, data: { status: typeof ReportStatusEnum.RESOLVED | typeof ReportStatusEnum.DISMISSED | typeof ReportStatusEnum.APPEAL_REJECTED | typeof ReportStatusEnum.APPEAL_SUCCESS; adminNote: string; overridePenaltyAction?: string; overridePenaltyDurationDays?: number; resetAvatar?: boolean; resetName?: boolean; resetBio?: boolean }) =>
      api.patch(`/reports/${reportId}/resolve`, data).then(res => res.data?.data || res.data),
  calculatePenalty: (reportId: string): Promise<ReportPenaltySuggestion> => 
      api.get(`/reports/${reportId}/calculate-penalty`).then(res => res.data?.data || res.data),
};
