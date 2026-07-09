import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminApi, type UserAdminData } from '../../services/admin';
import { ShieldBan, ShieldCheck, X, ChevronLeft, ChevronRight, Eye, EyeOff, Mail, Phone, MapPin, Calendar, Clock, User, Lock, Shield, CalendarDays } from 'lucide-react';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../constants/roles';
import { UI_LIMITS } from '../../constants/limits';

import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';
import { formatDateOnlyVN, formatDateVN } from '../../utils/date';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => clearTimeout(handler);
  }, [value, delay]);

  return debouncedValue;
}

const LIMIT = UI_LIMITS.ADMIN_TABLE_PAGE_SIZE; // TODO: đổi lại 20 sau khi test xong

// ── MUI-style custom Select ──────────────────────────────────────────────────
interface MuiSelectProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
  minWidth?: number;
  labelBgColor?: string;
}

function MuiSelect({ label, value, onChange, options, minWidth = 140, labelBgColor = 'var(--bg-primary)' }: MuiSelectProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const selectedLabel = options.find(o => o.value === value)?.label ?? value;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth, marginBottom: '10px' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          padding: '5px 20px 5px 12px',
          fontSize: '14px',
          color: 'var(--text-primary)',
          background: 'transparent',
          border: `1px solid ${open ? '#1976d2' : 'var(--border)'}`,
          borderRadius: '4px',
          cursor: 'pointer',
          textAlign: 'left',
          outline: 'none',
          boxShadow: open ? '0 0 0 1px #1976d2' : 'none',
          transition: 'border-color 0.2s, box-shadow 0.2s',
          position: 'relative',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {selectedLabel}
        {/* Arrow icon */}
        <span style={{
          position: 'absolute', right: '8px', top: '50%',
          transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
          transition: 'transform 0.2s',
          color: open ? '#1976d2' : 'var(--text-muted)',
          pointerEvents: 'none',
          fontSize: '12px',
        }}>▾</span>
      </button>
      {/* Floating label */}
      <span style={{
        position: 'absolute', top: 0, left: '10px',
        transform: 'translateY(-50%)',
        fontSize: '10px', fontWeight: 500,
        color: open ? '#1976d2' : 'var(--text-muted)',
        background: labelBgColor,
        padding: '0 4px',
        pointerEvents: 'none',
        transition: 'color 0.2s',
        whiteSpace: 'nowrap',
      }}>{label}</span>
      {/* Dropdown */}
      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: 'var(--bg-card)',
          borderRadius: '4px',
          boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
          paddingTop: '8px', paddingBottom: '8px',
          zIndex: 100,
          minWidth: '100%',
        }}>
          {options.map(opt => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '6px 16px',
                fontSize: '14px',
                border: 'none', cursor: 'pointer',
                background: opt.value === value ? 'rgba(25,118,210,0.12)' : 'transparent',
                color: opt.value === value ? '#1976d2' : 'var(--text-primary)',
                fontWeight: opt.value === value ? 600 : 400,
                transition: 'background 0.15s',
                whiteSpace: 'nowrap',
              }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = 'rgba(25,118,210,0.08)'; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              {opt.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────
const UserStatusBadges = ({ user, variant = 'table' }: { user: UserAdminData, variant?: 'table' | 'detail' }) => {
  const badges = [];
  const now = new Date();
  
  const isBanned = user.banUntil && new Date(user.banUntil) > now;
  const isMuted = user.muteUntil && new Date(user.muteUntil) > now;

  const renderBadge = (key: string, text: string, colorClass: string, detailColor: string) => {
    if (variant === 'table') {
      return (
        <span key={key} style={{padding:'0 3px'}} className={`inline-flex items-center px-2.5 py-1 rounded-xs text-xs font-medium ${colorClass}`}>
          {text}
        </span>
      );
    }
    return (
      <span key={key} style={{ padding: '5px 10px' }} className={`inline-flex items-center rounded text-[9px] font-bold ${detailColor} text-white uppercase tracking-wider shadow-sm`}>
        {text}
      </span>
    );
  };

  if (isBanned) {
    const banDate = new Date(user.banUntil!);
    const diffYears = banDate.getFullYear() - now.getFullYear();
    if (diffYears > 10) {
      badges.push(renderBadge('ban', 'Khóa vĩnh viễn', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', 'bg-[#e74c3c]'));
    } else {
      const diffTime = Math.abs(banDate.getTime() - now.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      badges.push(renderBadge('ban', `Khóa ${diffDays} ngày`, 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', 'bg-[#e74c3c]'));
    }
  } else if (user.isDisabled) {
    badges.push(renderBadge('disabled', 'Vô hiệu hóa', 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', 'bg-[#e74c3c]'));
  } else {
    if (!user.isActive) {
      badges.push(renderBadge('unverified', 'Chưa xác thực', 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', 'bg-[#e67e22]'));
    } else {
      badges.push(renderBadge('active', 'Hoạt động', 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', 'bg-[#2ecc71]'));
    }
  }
  
  if (isMuted) {
    const muteDate = new Date(user.muteUntil!);
    const diffTime = Math.abs(muteDate.getTime() - now.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    badges.push(renderBadge('mute', `Cấm chat ${diffDays} ngày`, 'bg-gray-100 text-gray-800 dark:bg-gray-800/30 dark:text-gray-400', 'bg-[#f39c12]'));
  }

  return <div className={`flex ${variant === 'table' ? 'flex-col items-start gap-1' : 'flex-wrap items-center gap-2 justify-center sm:justify-start mt-2'}`}>{badges}</div>;
};
// ────────────────────────────────────────────────────────────────────────────
interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  placeholder?: string;
  valueClass?: string;
}

function InfoItem({ icon, label, value, placeholder = 'Chưa xác định', valueClass = '' }: InfoItemProps) {
  return (
    <div className="flex items-center gap-4 border-b border-[var(--border)] last:border-b-0" style={{ padding: '10px 0' }}>
      <div className="w-9 h-9 flex items-center justify-center bg-[var(--bg-primary)] rounded-sm text-[var(--text-secondary)] shrink-0 border border-[var(--border)]">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        <span className={`block text-sm font-semibold mt-0.5 break-words whitespace-normal ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] italic'} ${valueClass}`}>
          {value || placeholder}
        </span>
      </div>
    </div>
  );
}
// ────────────────────────────────────────────────────────────────────────────


export default function UsersTab() {
  const { user: currentUser } = useAuthStore();
  const queryClient = useQueryClient();
  const toast = useToast();
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, UI_LIMITS.SEARCH_DEBOUNCE_MS);
  const [statusFilter, setStatusFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('newest');
  const [page, setPage] = useState(1);
  const [selectedUser, setSelectedUser] = useState<UserAdminData | null>(null);
  
  // Real fetch
  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['admin_users', page, debouncedSearch, statusFilter, roleFilter, sortFilter],
    queryFn: () => adminApi.getUsers({ 
      page, 
      limit: LIMIT, 
      search: debouncedSearch, 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      role: roleFilter !== 'all' ? roleFilter.toUpperCase() : undefined,
      sort: sortFilter !== 'newest' ? sortFilter : undefined
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const updateUserInList = (userId: string, updates: Partial<UserAdminData>) => {
    queryClient.setQueryData(
      ['admin_users', page, debouncedSearch, statusFilter, roleFilter, sortFilter],
      (oldData: any) => {
        if (!oldData) return oldData;
        return {
          ...oldData,
          items: oldData.items.map((u: any) => u._id === userId ? { ...u, ...updates } : u)
        };
      }
    );
  };

  const logoutAllDevicesMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string, reason: string }) => adminApi.logoutAllDevices(id, reason),
    onSuccess: () => {
      toast.success('Đã đăng xuất người dùng khỏi tất cả thiết bị');
      setConfirmModalConfig(prev => ({ ...prev, isOpen: false }));
      setConfirmReason('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi đăng xuất thiết bị')
  });

  const manualBanMutation = useMutation({
    mutationFn: ({ id, reason, durationDays, password, resetAvatar, resetBio, resetName }: { id: string, reason: string, durationDays: number, password?: string, resetAvatar?: boolean, resetBio?: boolean, resetName?: boolean }) => adminApi.manualBan(id, { reason, durationDays, password, resetAvatar, resetBio, resetName }),
    onSuccess: (_data, variables) => {
      toast.success('Đã khóa tài khoản');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setShowStatusModal(false);
      setShowQuickPenaltyModal(false);
      setStatusPassword('');
      setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: 1 });
      setSelectedUser(prev => prev ? { ...prev, isDisabled: true } : null);
      updateUserInList(variables.id, { isDisabled: true });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi khóa tài khoản')
  });

  const enableMutation = useMutation({
    mutationFn: ({ id, password, reason }: { id: string, password?: string, reason: string }) => adminApi.enableUser(id, password, reason),
    onSuccess: (_data, variables) => {
      toast.success('Đã kích hoạt lại tài khoản');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setShowStatusModal(false);
      setStatusPassword('');
      setSelectedUser(prev => prev ? { ...prev, isDisabled: false } : null);
      updateUserInList(variables.id, { isDisabled: false });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi kích hoạt tài khoản')
  });

  const unbanMutation = useMutation({
    mutationFn: ({ id, password, reason }: { id: string, password?: string, reason: string }) => adminApi.unbanUser(id, password, reason),
    onSuccess: (_data, variables) => {
      toast.success('Đã mở khóa tài khoản');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setShowStatusModal(false);
      setStatusPassword('');
      setSelectedUser(prev => prev ? { ...prev, banUntil: undefined } : null);
      updateUserInList(variables.id, { banUntil: undefined });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi mở khóa tài khoản')
  });

  const unmuteMutation = useMutation({
    mutationFn: ({ id, password, reason }: { id: string, password?: string, reason: string }) => adminApi.unmuteUser(id, password, reason),
    onSuccess: (_data, variables) => {
      toast.success('Đã mở khóa chat');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setShowStatusModal(false);
      setStatusPassword('');
      setSelectedUser(prev => prev ? { ...prev, muteUntil: undefined } : null);
      updateUserInList(variables.id, { muteUntil: undefined });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi mở khóa chat')
  });

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [statusAction, setStatusAction] = useState<'disable' | 'enable' | 'unban' | 'unmute'>('disable');
  const [statusPassword, setStatusPassword] = useState('');
  
  const [confirmModalConfig, setConfirmModalConfig] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'danger' | 'warning' | 'info';
    onConfirm: (reason?: string) => void;
    isLoading?: boolean;
    requireReason?: boolean;
  }>({
    isOpen: false,
    title: '',
    message: '',
    actionType: 'danger',
    onConfirm: () => {}
  });

  const [confirmReason, setConfirmReason] = useState('');
  const [statusReason, setStatusReason] = useState('');
  const [roleReason, setRoleReason] = useState('');

  const quickPenaltyMutation = useMutation({
    mutationFn: ({ id, reason, resetAvatar, resetBio, resetName, adminNote, password }: { id: string, reason: string, resetAvatar?: boolean, resetBio?: boolean, resetName?: boolean, adminNote?: string, password?: string }) => 
      adminApi.quickPenalty(id, { reason, resetAvatar, resetBio, resetName, adminNote, password }),
    onSuccess: (data: { name?: string }, variables) => {
      toast.success('Đã xử lý vi phạm thành công');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setSelectedUser(prev => {
        if (!prev) return null;
        const updated = { ...prev };
        if (variables.resetAvatar) updated.avatar = undefined;
        if (variables.resetBio) updated.bio = '';
        if (variables.resetName && data.name) updated.name = data.name;
        return updated;
      });
      setShowQuickPenaltyModal(false);
      setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: 1 });
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi xử lý vi phạm')
  });

  const changeRoleMutation = useMutation({
    mutationFn: ({ id, role, password, reason }: { id: string, role: string, password?: string, reason?: string }) => adminApi.changeUserRole(id, { role, password: password || '', reason }),
    onSuccess: (data: { role: UserRole }, variables) => {
      toast.success('Đã thay đổi quyền thành công');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setSelectedUser(prev => prev ? { ...prev, role: data.role } : null);
      updateUserInList(variables.id, { role: data.role });
      setShowRoleModal(false);
      setAdminPassword('');
      setRoleReason('');
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi đổi quyền')
  });


  const [showRoleModal, setShowRoleModal] = useState(false);
  const [showQuickPenaltyModal, setShowQuickPenaltyModal] = useState(false);
  const [quickPenaltyData, setQuickPenaltyData] = useState({
    reason: 'other',
    adminNote: '',
    resetAvatar: false,
    resetBio: false,
    resetName: false,
    password: '',
    manualDurationDays: 1
  });
  
  const [showActionsDropdown, setShowActionsDropdown] = useState(false);
  const [selectedNewRole, setSelectedNewRole] = useState<UserRole>(UserRole.USER);
  const [adminPassword, setAdminPassword] = useState('');
  const [statusDuration, setStatusDuration] = useState<number>(0);
  const actionsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showActionsDropdown) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (actionsDropdownRef.current && !actionsDropdownRef.current.contains(e.target as Node)) {
        setShowActionsDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showActionsDropdown]);

  // Create user modal state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    phone: '',
    address: '',
    role: UserRole.USER as UserRole,
  });
  const [createFormErrors, setCreateFormErrors] = useState<Record<string, string>>({});
  const [showCreatePassword, setShowCreatePassword] = useState(false);
  const [showCreateConfirmPassword, setShowCreateConfirmPassword] = useState(false);

  const createUserMutation = useMutation({
    mutationFn: adminApi.createUser,
    onSuccess: () => {
      toast.success('Tạo tài khoản thành công');
      queryClient.invalidateQueries({ queryKey: ['admin_users'] });
      setShowCreateModal(false);
      setCreateForm({ name: '', email: '', password: '', confirmPassword: '', phone: '', address: '', role: UserRole.USER });
      setCreateFormErrors({});
    },
    onError: (err: any) => toast.error(err.response?.data?.message || 'Lỗi khi tạo tài khoản'),
  });

  const isSuperAdmin = currentUser?.role === UserRole.SUPER_ADMIN;

  const validateCreateForm = () => {
    const errors: Record<string, string> = {};
    if (!createForm.email.trim()) errors.email = 'Email không được để trống';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(createForm.email)) errors.email = 'Email không đúng định dạng';
    if (!createForm.password) errors.password = 'Mật khẩu không được để trống';
    if (!createForm.confirmPassword) errors.confirmPassword = 'Xác nhận mật khẩu không được để trống';
    else if (createForm.password !== createForm.confirmPassword) errors.confirmPassword = 'Xác nhận mật khẩu không trùng khớp';
    if (createForm.phone && !/^(0|\+84)(3|5|7|8|9)[0-9]{8}$/.test(createForm.phone)) errors.phone = 'Số điện thoại không hợp lệ';
    setCreateFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateUser = () => {
    if (!validateCreateForm()) return;
    const payload: any = {
      name: createForm.name.trim() || undefined,
      email: createForm.email.trim().toLowerCase(),
      password: createForm.password,
      confirmPassword: createForm.confirmPassword,
      role: createForm.role,
    };
    if (createForm.phone.trim()) payload.phone = createForm.phone.trim();
    if (createForm.address.trim()) payload.address = createForm.address.trim();
    createUserMutation.mutate(payload);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        if (showStatusModal && !(manualBanMutation.isPending || enableMutation.isPending || unbanMutation.isPending || unmuteMutation.isPending)) {
          if (statusAction === 'disable' && statusDuration > 0 && statusReason.trim()) {
            manualBanMutation.mutate({ id: selectedUser!._id, reason: statusReason.trim(), durationDays: statusDuration });
          } else if (statusAction === 'enable' && statusPassword && statusReason.trim()) {
            enableMutation.mutate({ id: selectedUser!._id, password: statusPassword, reason: statusReason.trim() });
          } else if (statusAction === 'unban' && statusPassword && statusReason.trim()) {
            unbanMutation.mutate({ id: selectedUser!._id, password: statusPassword, reason: statusReason.trim() });
          } else if (statusAction === 'unmute' && statusPassword && statusReason.trim()) {
            unmuteMutation.mutate({ id: selectedUser!._id, password: statusPassword, reason: statusReason.trim() });
          }
        } else if (showRoleModal && adminPassword && !changeRoleMutation.isPending) {
          changeRoleMutation.mutate({ id: selectedUser!._id, role: selectedNewRole, password: adminPassword, reason: roleReason.trim() });
        } else if (showCreateModal && !createUserMutation.isPending) {
          handleCreateUser();
        } else if (showQuickPenaltyModal && !quickPenaltyMutation.isPending && !manualBanMutation.isPending) {
          if (quickPenaltyData.reason === 'other') {
            manualBanMutation.mutate({
              id: selectedUser!._id,
              reason: quickPenaltyData.adminNote.trim(),
              durationDays: quickPenaltyData.manualDurationDays,
              password: quickPenaltyData.password,
              resetAvatar: quickPenaltyData.resetAvatar,
              resetBio: quickPenaltyData.resetBio,
              resetName: quickPenaltyData.resetName
            });
          } else {
            quickPenaltyMutation.mutate({
              id: selectedUser!._id,
              reason: quickPenaltyData.reason,
              resetAvatar: quickPenaltyData.resetAvatar,
              resetBio: quickPenaltyData.resetBio,
              resetName: quickPenaltyData.resetName,
              adminNote: quickPenaltyData.adminNote.trim() || undefined,
              password: quickPenaltyData.password
            });
          }
        } else if (confirmModalConfig.isOpen && !(confirmModalConfig.isLoading || logoutAllDevicesMutation.isPending)) {
          if (confirmModalConfig.requireReason && !confirmReason.trim()) return;
          confirmModalConfig.onConfirm(confirmReason.trim());
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    showStatusModal, statusPassword, statusDuration, manualBanMutation.isPending, enableMutation.isPending, unbanMutation.isPending, unmuteMutation.isPending, statusAction, selectedUser, statusReason,
    showRoleModal, adminPassword, changeRoleMutation.isPending, selectedNewRole, roleReason,
    showCreateModal, createUserMutation.isPending, createForm,
    showQuickPenaltyModal, quickPenaltyMutation.isPending, quickPenaltyData,
    confirmModalConfig, confirmReason, logoutAllDevicesMutation.isPending
  ]);

  const renderFilters = (idPrefix: string) => {
    const labelBgColor = idPrefix === 'mobile' ? 'var(--bg-card)' : 'var(--bg-primary)';

    return (
      <>
        {/* Tạo mới button */}
        <div className="flex items-center" style={{ marginBottom: '10px' }}>
          <button
            id={`${idPrefix}-btn-create-user`}
            onClick={() => setShowCreateModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-[#1976d2] text-xs font-medium tracking-wide uppercase border border-[#1976d2] bg-transparent hover:bg-[rgba(25,118,210,0.08)] active:bg-[rgba(25,118,210,0.16)] transition-colors whitespace-nowrap"
            style={{ letterSpacing: '0.02857em', height:'34px', lineHeight: '1.75', padding:'3px 10px 3px', borderRadius:'4px' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
            </svg>
            Tạo mới
          </button>
        </div>
        
        {/* Search */}
        <div className="relative flex-1" style={{marginBottom:'10px', minWidth:'175px'}}>
          <div className="relative">
            <input 
              id={`${idPrefix}-search-input`}
              type="text" 
              placeholder=" "
              style={{padding:'2px 10px', borderRadius:'4px', height:'34px'}}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors "
            />
            <label 
              htmlFor={`${idPrefix}-search-input `}
              style={{
                padding:'0 5px',
                background: labelBgColor
              }}
              className={`absolute pointer-events-none transition-all duration-200 text-[var(--text-muted)] z-10 whitespace-nowrap
                top-1/2 left-3 -translate-y-1/2 text-sm
                peer-focus:top-0 peer-focus:left-3 peer-focus:text-[10px] peer-focus:font-medium peer-focus:text-indigo-500
                peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium
              `}
            >
              Tìm theo Tên, Email, SĐT
            </label>
          </div>
        </div>

        {/* Sort */}
        <MuiSelect
          label="Sắp xếp"
          value={sortFilter}
          onChange={setSortFilter}
          options={[
            { value: 'newest', label: 'Mới nhất' },
            { value: 'name_asc', label: 'Tên (A-Z)' },
            { value: 'name_desc', label: 'Tên (Z-A)' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />

        {/* Role */}
        <MuiSelect
          label="Vai trò"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: UserRole.USER, label: 'USER' },
            { value: UserRole.ADMIN, label: 'ADMIN' },
            { value: UserRole.SUPER_ADMIN, label: 'SUPER_ADMIN' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />

        {/* Status */}
        <MuiSelect
          label="Trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'active', label: 'Hoạt động' },
            { value: 'unverified', label: 'Chưa kích hoạt' },
            { value: 'banned', label: 'Vô hiệu hóa' },
            { value: 'suspended', label: 'Khóa tài khoản' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />
      </>
    );
  };

  const users: UserAdminData[] = data?.items || [];
  const total = data?.total || 0;

  // Sync selectedUser if data changes (e.g. after refresh)
  useEffect(() => {
    if (selectedUser && data?.items) {
      const updatedUser = data.items.find((u: any) => u._id === selectedUser._id);
      if (updatedUser) {
        setSelectedUser(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(updatedUser)) {
            return updatedUser;
          }
          return prev;
        });
      }
    }
  }, [data?.items, selectedUser?._id]);

  const isPermanentlyBanned = selectedUser?.banUntil 
    ? new Date(selectedUser.banUntil).getFullYear() - new Date().getFullYear() > 10 
    : false;

  return (
    <>
      {/* Mobile Toggle Button & Filters (Fixed to viewport) */}
      {!selectedUser && (
        <AdminMobileFilter 
          isOpen={isFilterOpen} 
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
        >
          {renderFilters('mobile')}
        </AdminMobileFilter>
      )}

      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* List View */}
        <div className={`flex flex-col h-full ${selectedUser ? 'hidden' : ''} relative`}>
        {/* Mobile Toggle Button (Absolute to touch the top padding) */}
        {/* Desktop Filters */}
        <div className="max-[1050px]:hidden min-[1050px]:flex flex-row flex-wrap gap-4 mb-6 mt-2 items-center w-full">
          {renderFilters('desktop')}
        </div>

      {/* Data Grid */}
      <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex-1 flex flex-col">
        <div className="overflow-x-auto flex-1">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-secondary)] text-sm">
                <th className="px-6 py-4 font-medium w-[60px] text-center">STT</th>
                <th className="px-6 py-4 font-medium w-[300px]">Người dùng</th>
                <th className="px-6 py-4 font-medium">Vai trò</th>
                <th className="px-6 py-4 font-medium">Trạng thái</th>
                <th className="px-6 py-4 font-medium">Ngày tham gia</th>

              </tr>
            </thead>
            <tbody className={`transition-opacity duration-200 ${isFetching && !isLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
              {isLoading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                    Đang tải dữ liệu...
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">
                    Không tìm thấy người dùng nào.
                  </td>
                </tr>
              ) : (
                users.map((u, index) => (
                  <tr 
                    key={u._id} 
                    className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                    onClick={() => setSelectedUser(u)}
                  >
                    <td className="px-6 py-4 text-center text-[var(--text-secondary)] font-medium">
                      {(page - 1) * LIMIT + index + 1}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        {(() => {
                          const avatarUrl = typeof u.avatar === 'string' ? u.avatar : (u.avatar as any)?.url;
                          const DefaultAvatar = () => (
                            <div className="relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                              <svg className="absolute w-12 h-12 text-gray-400 -left-1 mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                              </svg>
                            </div>
                          );
                          
                          return avatarUrl ? (
                            <img 
                              src={avatarUrl} 
                              alt="Avatar" 
                              className="w-10 h-10 rounded-full object-cover"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                                e.currentTarget.nextElementSibling?.classList.remove('hidden');
                              }}
                            />
                          ) : <DefaultAvatar />;
                        })()}
                        {/* Fallback for broken images */}
                           <div className="hidden relative w-10 h-10 overflow-hidden bg-gray-100 rounded-full dark:bg-gray-700 shrink-0 border border-gray-200 dark:border-gray-600">
                             <svg className="absolute w-12 h-12 text-gray-400 -left-1 mt-1" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                               <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd"></path>
                             </svg>
                           </div>
                        <div>
                          <div className="font-semibold text-[var(--text-primary)]">{u.name}</div>
                          <div className="text-sm text-[var(--text-muted)]">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-[var(--text-secondary)] capitalize">{u.role}</span>
                    </td>
                    <td className="px-6 py-4" style={{minWidth:'116px'}}>
                      <UserStatusBadges user={u} variant="table" />
                    </td>
                    <td className="px-6 py-4 text-[var(--text-secondary)]">
                      {formatDateVN(u.createdAt)}
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        <div className="p-2.5 sm:p-5 border-t border-[var(--border)] flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-4 items-center text-[13px] sm:text-sm text-[var(--text-secondary)]">
          <div className="text-center sm:text-left">
            Hiển thị <span className="font-medium text-[var(--text-primary)]">{total === 0 ? 0 : (page - 1) * LIMIT + 1}</span> đến <span className="font-medium text-[var(--text-primary)]">{Math.min(page * LIMIT, total)}</span> trong tổng số <span className="font-medium text-[var(--text-primary)]">{total}</span>
          </div>
          
          <div className="flex items-center justify-center gap-1.5">
            <button 
              disabled={page === 1} 
              onClick={() => setPage(p => p - 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
            >
              <ChevronLeft size={16} />
            </button>
            
            {(() => {
              const totalPages = Math.ceil(total / LIMIT);
              const pages = [];
              
              if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) pages.push(i);
              } else {
                if (page <= 4) {
                  pages.push(1, 2, 3, 4, 5, '...', totalPages);
                } else if (page >= totalPages - 3) {
                  pages.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                  pages.push(1, '...', page - 1, page, page + 1, '...', totalPages);
                }
              }

              return pages.map((p, idx) => {
                if (p === '...') {
                  return <span key={`ellipsis-${idx}`} className="w-8 h-8 flex items-center justify-center text-[var(--text-muted)] tracking-widest shrink-0">...</span>;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors font-medium border shrink-0 cursor-pointer ${(p as number) >= 100 ? 'text-[10px]' : 'text-[13px]'} ${
                      page === p 
                        ? 'bg-blue-500/10 border-blue-500/30 text-blue-500 shadow-sm' 
                        : 'border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 hover:border-indigo-300 dark:hover:border-indigo-500/50 text-[var(--text-primary)]'
                    }`}
                  >
                    {p}
                  </button>
                );
              });
            })()}

            <button 
              disabled={page >= Math.ceil(total / LIMIT) || total === 0} 
              onClick={() => setPage(p => p + 1)}
              className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          
          <div className="hidden sm:block"></div>
        </div>
      </div>
      </div>

      {/* User Detail View */}
      {selectedUser && (
        <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
          

          {/* Grid Layout cho các phần thông tin */}
          <div className="flex flex-col gap-5 overflow-y-auto flex-1 pb-4 pr-1">
          
          {/* Header bar */}
          <div 
            style={{padding:'5px'}}
            className="relative flex items-center bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm mb-4 mt-2 px-2 sm:px-5 py-1.5">
            <button
              onClick={() => { setSelectedUser(null); setShowActionsDropdown(false); }}
              className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2.5 py-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-all duration-200 font-medium text-sm z-10 cursor-pointer"
            >
              <ChevronLeft size={16} />
              Quay lại
            </button>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] pointer-events-auto">
                Thông tin chi tiết
              </h2>
            </div>
          </div>
            {/* ── KHỐI 1: Avatar | Tên | Nút hành động ── */}
            <div className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm">
              <div style={{ padding: '10px' }} className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                
                {/* Trái: Avatar + Thông tin cơ bản */}
                <div className="flex flex-col sm:flex-row items-center gap-5 flex-1 min-w-0">
                  {/* Avatar tròn */}
                  <div className="relative shrink-0">
                    {(() => {
                      const avatarUrl = typeof selectedUser.avatar === 'string' ? selectedUser.avatar : (selectedUser.avatar as any)?.url;
                      return avatarUrl ? (
                        <img src={avatarUrl} alt="Avatar" className="w-20 h-20 rounded-full object-cover border-2 border-[var(--border)] shadow-sm" />
                      ) : (
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-[#1b4d7e] to-[#2c3e50] text-white flex items-center justify-center text-3xl font-semibold border-2 border-[#1b4d7e] shadow-md">
                          {selectedUser.name?.charAt(0)?.toUpperCase() || '?'}
                        </div>
                      );
                    })()}
                  </div>

                  {/* Tên + Email & Role + Badges */}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold text-[var(--text-primary)] truncate">{selectedUser.name}</h3>
                    
                    <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mt-2">
                      <UserStatusBadges user={selectedUser} variant="detail" />
                      <span 
                        style={{ padding: '5px 10px' }}
                        className={`inline-flex items-center rounded text-[9px] font-bold text-white uppercase tracking-wider shadow-sm ${
                          selectedUser.role === 'SUPER_ADMIN' ? 'bg-[#e74c3c]' :
                          selectedUser.role === 'ADMIN' ? 'bg-[#e67e22]' :
                          'bg-[#27ae60]'
                        }`}
                      >
                        {selectedUser.role}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Phải: Nút hành động */}
                <div className="shrink-0 flex flex-row gap-2.5 items-center justify-center sm:justify-end">
                  
                  {currentUser?.role === UserRole.SUPER_ADMIN && (
                    <button
                      onClick={() => { setSelectedNewRole(selectedUser.role as UserRole); setShowRoleModal(true); }}
                      style={{ cursor: 'pointer', padding: '5px 10px' }}
                      className="text-xs font-semibold text-white bg-orange-600 hover:bg-warning-700 rounded transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider border border-transparent cursor-pointer"
                    >
                      <User size={14} />
                      Thay đổi quyền
                    </button>
                  )}
                  <div className="relative" ref={actionsDropdownRef}>
                    <button
                      onClick={() => setShowActionsDropdown(!showActionsDropdown)}
                      style={{ cursor: 'pointer', padding: '5px 10px' }}
                      className="text-xs font-semibold text-[var(--text-primary)] bg-[var(--bg-primary)] hover:bg-[var(--bg-card-hover)] border border-[var(--border)] rounded transition-colors flex items-center gap-1.5 shadow-sm uppercase tracking-wider cursor-pointer"
                    >
                      <span>Thao tác</span>
                      <span className={`transition-transform duration-200 ${showActionsDropdown ? 'rotate-180' : 'rotate-0'}`}>▾</span>
                    </button>
                    {showActionsDropdown && (
                      <div 
                        className="absolute right-0 top-full mt-2 w-56 bg-[var(--bg-card)] z-50 origin-top-right animate-in fade-in slide-in-from-top-2 duration-150"
                        style={{
                          borderRadius: '4px',
                          boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
                          paddingTop: '8px', paddingBottom: '8px'
                        }}
                      >
                       
                        {/* Xử lý vi phạm (Quick Penalty) */}
                        <button
                          disabled={isPermanentlyBanned}
                          title={isPermanentlyBanned ? 'Người dùng đã bị khóa vĩnh viễn' : ''}
                          className={`w-full text-left text-sm flex items-center gap-3 ${isPermanentlyBanned ? 'text-[var(--text-muted)] opacity-50' : 'text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors duration-150'}`}
                          style={{ padding: '6px 16px', cursor: isPermanentlyBanned ? 'not-allowed' : 'pointer' }}
                          onClick={() => {
                            if (isPermanentlyBanned) return;
                            setShowQuickPenaltyModal(true);
                            setShowActionsDropdown(false);
                          }}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`shrink-0 ${isPermanentlyBanned ? 'text-[var(--text-muted)]' : 'text-gray-400 hover:text-red-500'}`}><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
                          <span>Xử lý vi phạm</span>
                        </button>
                        {/* Divider */}
                        <div className="h-px bg-[var(--border)] my-2" />
                        {/* Đăng xuất thiết bị */}
                        {!(selectedUser.banUntil && new Date(selectedUser.banUntil) > new Date()) && !selectedUser.isDisabled && (
                          <button
                            className="w-full text-left text-sm text-amber-600 dark:text-amber-500 hover:bg-amber-500/5 transition-colors duration-150 flex items-center gap-3 font-medium"
                            style={{ padding: '6px 16px',cursor:'pointer' }}
                            onClick={() => {
                              setConfirmModalConfig({
                                isOpen: true,
                                title: 'Đăng xuất tất cả',
                                message: 'Bạn có chắc muốn đăng xuất người dùng này khỏi tất cả các thiết bị không?',
                                actionType: 'warning',
                                requireReason: true,
                                onConfirm: (reason) => {
                                  logoutAllDevicesMutation.mutate({ id: selectedUser._id, reason: reason || '' });
                                }
                              });
                              setShowActionsDropdown(false);
                            }}
                          >
                            <ShieldBan size={16} className="shrink-0" />
                            <span>Đăng xuất tất cả</span>
                          </button>
                        )}
                        {/* Unban, Unmute, Enable */}
                        {selectedUser.banUntil && new Date(selectedUser.banUntil) > new Date() && (
                          <button
                            className="w-full text-left text-sm text-green-600 dark:text-green-500 hover:bg-green-500/5 transition-colors duration-150 flex items-center gap-3 font-medium"
                            style={{ padding: '6px 16px',cursor:'pointer' }}
                            onClick={() => {
                              setStatusAction('unban');
                              setStatusPassword('');
                              setStatusReason('');
                              setShowStatusModal(true);
                              setShowActionsDropdown(false);
                            }}
                          >
                            <ShieldCheck size={16} className="shrink-0" />
                            <span>Mở khóa tài khoản</span>
                          </button>
                        )}
                        
                        {selectedUser.muteUntil && new Date(selectedUser.muteUntil) > new Date() && (
                          <button
                            className="w-full text-left text-sm text-green-600 dark:text-green-500 hover:bg-green-500/5 transition-colors duration-150 flex items-center gap-3 font-medium"
                            style={{ padding: '6px 16px',cursor:'pointer' }}
                            onClick={() => {
                              setStatusAction('unmute');
                              setStatusPassword('');
                              setStatusReason('');
                              setShowStatusModal(true);
                              setShowActionsDropdown(false);
                            }}
                          >
                            <ShieldCheck size={16} className="shrink-0" />
                            <span>Mở khóa chat</span>
                          </button>
                        )}

                        {selectedUser.isDisabled && (
                          <button
                            className="w-full text-left text-sm text-blue-600 dark:text-blue-500 hover:bg-blue-500/5 transition-colors duration-150 flex items-center gap-3 font-medium"
                            style={{ padding: '6px 16px',cursor:'pointer' }}
                            onClick={() => {
                              setStatusAction('enable');
                              setStatusPassword('');
                              setStatusReason('');
                              setShowStatusModal(true);
                              setShowActionsDropdown(false);
                            }}
                          >
                            <ShieldCheck size={16} className="shrink-0" />
                            <span>Kích hoạt lại tài khoản</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  
                </div>

              </div>
            </div>

            {/* ── KHỐI 2: Tiểu sử ── */}
            <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm w-full">
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2 block font-semibold">
                Tiểu sử
              </span>
              <div style={{ minHeight: '80px' }} className="flex items-start bg-[var(--bg-primary)] rounded-sm border border-[var(--border)] px-4 py-2.5 w-full">
                <span className={`text-sm ${selectedUser.bio ? 'text-[var(--text-primary)] font-medium' : 'text-[var(--text-muted)] italic'}`}>
                  {selectedUser.bio || 'Người dùng chưa có tiểu sử.'}
                </span>
              </div>
            </div>

            {/* ── HAI CỘT DƯỚI: Thông tin cơ bản & Chi tiết tài khoản ── */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 w-full">
              
              {/* CỘT TRÁI: THÔNG TIN CƠ BẢN & LIÊN HỆ */}
              <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">
                  Thông tin cơ bản & liên hệ
                </h4>
                <div className="flex flex-col">
                  <InfoItem 
                    icon={<Mail size={16} />}
                    label="Email"
                    value={selectedUser.email}
                  />

                  <InfoItem 
                    icon={<Phone size={16} />}
                    label="Số điện thoại"
                    value={selectedUser.phone}
                    placeholder="Chưa xác định"
                  />

                  <InfoItem 
                    icon={<MapPin size={16} />}
                    label="Địa chỉ"
                    value={selectedUser.address}
                    placeholder="Chưa xác định"
                  />
<InfoItem 
                    icon={<Calendar size={16} />}
                    label="Ngày sinh"
                    value={selectedUser.dateOfBirth ? formatDateOnlyVN(selectedUser.dateOfBirth) : undefined}
                    placeholder="Chưa xác định"
                  />
                  <InfoItem 
                    icon={<User size={16} />}
                    label="Giới tính"
                    value={
                      selectedUser.gender === 'MALE' ? 'Nam' : 
                      selectedUser.gender === 'FEMALE' ? 'Nữ' : 
                      selectedUser.gender === 'OTHER' ? 'Khác' : undefined
                    }
                    placeholder="Chưa xác định"
                  />
                </div>
              </div>

              {/* CỘT PHẢI: CHI TIẾT & LỊCH SỬ TÀI KHOẢN */}
              <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">
                  Chi tiết & lịch sử tài khoản
                </h4>
                <div className="flex flex-col">
                  <InfoItem 
                    icon={<Clock size={16} />}
                    label="Lần cuối online"
                    value={selectedUser.lastOnlineAt ? formatDateVN(selectedUser.lastOnlineAt) : undefined}
                    placeholder="Chưa xác định"
                  />

                  

                  <InfoItem 
                    icon={<CalendarDays size={16} />}
                    label="Ngày tham gia"
                    value={(() => {
                      return formatDateVN(selectedUser.createdAt);
                    })()}
                  />

                  <InfoItem 
                    icon={<Shield size={16} />}
                    label="Loại tài khoản"
                    value={selectedUser.accountType || 'LOCAL'}
                  />

                  {selectedUser.isDisabled && selectedUser.disabledAt && (
                    <InfoItem 
                      icon={<Lock size={16} />}
                      label="Ngày bị khóa"
                      value={formatDateVN(selectedUser.disabledAt)}
                      valueClass="text-red-500 dark:text-red-400 font-semibold"
                    />
                  )}
                </div>
              </div>

            </div>

          </div>
        </div>
      )}
      {/* Status Modal (Lock/Unlock) */}
      {showStatusModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '480px',
              overflow: 'hidden',
            }}
            className="animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {statusAction === 'disable' ? 'Khóa Tài Khoản (Manual Ban)' : 
                 statusAction === 'unban' ? 'Mở Khóa Tài Khoản' : 
                 statusAction === 'unmute' ? 'Mở Khóa Chat' : 'Kích Hoạt Lại Tài Khoản'}
              </h3>
              <button 
                onClick={() => { setShowStatusModal(false); setStatusPassword(''); setStatusDuration(0); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p style={{ fontSize: '13.5px', color: '#d97706', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  {statusAction === 'disable' ? (
                    <>Bạn đang thao tác khóa tài khoản <strong>{selectedUser.email}</strong>. Lệnh cấm này sẽ được ghi nhận vào lịch sử vi phạm của người dùng.</>
                  ) : (
                    <>Tính năng này yêu cầu xác thực bảo mật. Bạn đang thao tác {statusAction === 'unban' ? 'mở khóa' : statusAction === 'unmute' ? 'mở khóa chat' : 'kích hoạt lại'} cho <strong>{selectedUser.email}</strong>.</>
                  )}
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Lý do thực hiện <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="text" 
                  value={statusReason}
                  onChange={(e) => setStatusReason(e.target.value)}
                  placeholder="Nhập lý do (bắt buộc)..."
                  style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              {statusAction === 'disable' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Thời hạn khóa (ngày) <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="number" 
                    value={statusDuration}
                    onChange={(e) => setStatusDuration(Number(e.target.value))}
                    min="1"
                    placeholder="Ví dụ: 7 (nhập số ngày, tối đa 3650)"
                    style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ef4444'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  <span className="text-xs text-[var(--text-muted)] mt-1">Sử dụng 3650 (10 năm) cho khóa vĩnh viễn.</span>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mật khẩu của bạn <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="password" 
                    value={statusPassword}
                    onChange={(e) => setStatusPassword(e.target.value)}
                    placeholder="Nhập mật khẩu hiện tại để xác nhận..."
                    style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ef4444'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <button 
                onClick={() => { setShowStatusModal(false); setStatusPassword(''); setStatusDuration(0); }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Hủy
              </button>
              <button 
                disabled={(statusAction === 'disable' ? (manualBanMutation.isPending || !statusDuration || statusDuration <= 0 || !statusPassword) : (enableMutation.isPending || unbanMutation.isPending || unmuteMutation.isPending || !statusPassword)) || !statusReason.trim()}
                onClick={() => {
                  if (statusAction === 'disable') manualBanMutation.mutate({ id: selectedUser._id, reason: statusReason.trim(), durationDays: statusDuration, password: statusPassword });
                  else if (statusAction === 'enable') enableMutation.mutate({ id: selectedUser._id, password: statusPassword, reason: statusReason.trim() });
                  else if (statusAction === 'unban') unbanMutation.mutate({ id: selectedUser._id, password: statusPassword, reason: statusReason.trim() });
                  else if (statusAction === 'unmute') unmuteMutation.mutate({ id: selectedUser._id, password: statusPassword, reason: statusReason.trim() });
                }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: '#fff', background: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: ((statusAction === 'disable' ? (manualBanMutation.isPending || !statusDuration || statusDuration <= 0 || !statusPassword) : (enableMutation.isPending || unbanMutation.isPending || unmuteMutation.isPending || !statusPassword)) || !statusReason.trim()) ? 0.6 : 1, transition: 'background 0.2s' }}
                onMouseEnter={e => { if (!((statusAction === 'disable' ? (manualBanMutation.isPending || !statusDuration || statusDuration <= 0 || !statusPassword) : (enableMutation.isPending || unbanMutation.isPending || unmuteMutation.isPending || !statusPassword)) || !statusReason.trim())) e.currentTarget.style.background = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
              >
                {(statusAction === 'disable' ? manualBanMutation.isPending : (enableMutation.isPending || unbanMutation.isPending || unmuteMutation.isPending)) ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Quick Penalty Modal */}
      {showQuickPenaltyModal && selectedUser && (
        <div 
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-in fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowQuickPenaltyModal(false);
              setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: 1 });
            }
          }}
        >
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '480px',
              overflow: 'hidden',
            }}
            className="animate-in zoom-in-95 duration-200 flex flex-col"
          >
            {/* Header */}
            <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Xử Lý Vi Phạm</h3>
              <button 
                onClick={() => {
                  setShowQuickPenaltyModal(false);
                  setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: 1 });
                }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
                <ul style={{ fontSize: '13.5px', color: '#ef4444', margin: 0, paddingLeft: '20px', fontWeight: 500, lineHeight: 1.5, listStyleType: 'disc' }}>
                  <li>Lệnh cấm này sẽ được ghi nhận vào lịch sử vi phạm của người dùng.</li>
                  <li>Không thể sửa đổi sau khi đã hoàn tất.</li>
                  <li>Bạn sẽ chịu mọi trách nhiệm về quyết định này.</li>
                  <li>Vui lòng kiểm tra kỹ trước khi thực hiện!</li>
                </ul>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Loại vi phạm <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {[
                    { value: 'spam_harassment', label: 'Spam / Lừa đảo / Quấy rối' },
                    { value: 'impersonation', label: 'Tài khoản giả mạo' },
                    { value: 'inappropriate_content', label: 'Nội dung không phù hợp (Ảnh đại diện/Tên/Tiểu sử/Nội dung tin nhắn)' },
                    { value: 'other', label: 'Lý do khác' }
                  ].map(option => (
                    <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                      <input 
                        type="radio" 
                        name="penaltyReason" 
                        value={option.value} 
                        checked={quickPenaltyData.reason === option.value}
                        onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, reason: e.target.value }))}
                        style={{ cursor: 'pointer', accentColor: '#ef4444' }}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'var(--bg-primary)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border)' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Xử lí kèm theo:</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={quickPenaltyData.resetAvatar}
                      onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, resetAvatar: e.target.checked }))}
                      style={{ cursor: 'pointer', accentColor: '#ef4444' }}
                    />
                    Xóa ảnh đại diện
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={quickPenaltyData.resetName}
                      onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, resetName: e.target.checked }))}
                      style={{ cursor: 'pointer', accentColor: '#ef4444' }}
                    />
                    Đặt lại tên người dùng
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: 'var(--text-primary)' }}>
                    <input 
                      type="checkbox" 
                      checked={quickPenaltyData.resetBio}
                      onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, resetBio: e.target.checked }))}
                      style={{ cursor: 'pointer', accentColor: '#ef4444' }}
                    />
                    Xóa tiểu sử
                  </label>
                </div>

              {quickPenaltyData.reason === 'other' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '10px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Khóa tài khoản</label>
                  <select
                    value={quickPenaltyData.manualDurationDays}
                    onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, manualDurationDays: Number(e.target.value) }))}
                    style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-primary)', outline: 'none' }}
                  >
                    <option value={1}>1 ngày</option>
                    <option value={7}>7 ngày</option>
                    <option value={30}>30 ngày</option>
                    <option value={36500}>Vĩnh viễn</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Ghi chú của Admin {quickPenaltyData.reason === 'other' && <span className="text-red-500">*</span>}</label>
                <textarea 
                  value={quickPenaltyData.adminNote}
                  onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, adminNote: e.target.value }))}
                  rows={3}
                  style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', resize: 'none' }}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mật khẩu xác thực <span className="text-red-500">*</span></label>
                <input 
                  type="password"
                  value={quickPenaltyData.password}
                  onChange={(e) => setQuickPenaltyData(prev => ({ ...prev, password: e.target.value }))}
                  style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#ef4444'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <button 
                onClick={() => {
                  setShowQuickPenaltyModal(false);
                  setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: 1 });
                }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Hủy
              </button>
              <button 
                disabled={(quickPenaltyData.reason === 'other' ? manualBanMutation.isPending : quickPenaltyMutation.isPending) || !quickPenaltyData.password || (quickPenaltyData.reason === 'other' && !quickPenaltyData.adminNote.trim())}
                onClick={() => {
                  if (quickPenaltyData.reason === 'other') {
                    manualBanMutation.mutate({
                      id: selectedUser._id,
                      reason: quickPenaltyData.adminNote.trim(),
                      durationDays: quickPenaltyData.manualDurationDays,
                      password: quickPenaltyData.password,
                      resetAvatar: quickPenaltyData.resetAvatar,
                      resetBio: quickPenaltyData.resetBio,
                      resetName: quickPenaltyData.resetName
                    });
                  } else {
                    quickPenaltyMutation.mutate({
                      id: selectedUser._id,
                      reason: quickPenaltyData.reason,
                      resetAvatar: quickPenaltyData.resetAvatar,
                      resetBio: quickPenaltyData.resetBio,
                      resetName: quickPenaltyData.resetName,
                      adminNote: quickPenaltyData.adminNote.trim() || undefined,
                      password: quickPenaltyData.password
                    });
                  }
                }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: '#fff', background: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: ((quickPenaltyData.reason === 'other' ? manualBanMutation.isPending : quickPenaltyMutation.isPending) || !quickPenaltyData.password || (quickPenaltyData.reason === 'other' && !quickPenaltyData.adminNote.trim())) ? 0.6 : 1, transition: 'background 0.2s' }}
                onMouseEnter={e => { if (!((quickPenaltyData.reason === 'other' ? manualBanMutation.isPending : quickPenaltyMutation.isPending) || !quickPenaltyData.password || (quickPenaltyData.reason === 'other' && !quickPenaltyData.adminNote.trim()))) e.currentTarget.style.background = '#dc2626'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
              >
                {(quickPenaltyData.reason === 'other' ? manualBanMutation.isPending : quickPenaltyMutation.isPending) ? 'Đang xử lý...' : 'Xác nhận xử lý'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sudo Mode Role Modal */}
      {showRoleModal && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '480px',
              overflow: 'hidden',
            }}
            className="animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cấp Quyền</h3>
              <button 
                onClick={() => { setShowRoleModal(false); setAdminPassword(''); }}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ background: 'rgba(245, 158, 11, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p style={{ fontSize: '13.5px', color: '#d97706', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
                  Tính năng này yêu cầu xác thực bảo mật vì tác động tới quyền hạn của hệ thống.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Vai trò mới</label>
                <select 
                  value={selectedNewRole}
                  onChange={(e) => setSelectedNewRole(e.target.value as UserRole)}
                  style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                >
                  <option value={UserRole.USER}>USER</option>
                  <option value={UserRole.ADMIN}>ADMIN</option>
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Lý do thực hiện</label>
                <input 
                  type="text" 
                  value={roleReason}
                  onChange={(e) => setRoleReason(e.target.value)}
                  placeholder="Nhập lý do thực hiện (tùy chọn)..."
                  style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mật khẩu của bạn <span style={{ color: '#ef4444' }}>*</span></label>
                <input 
                  type="password" 
                  value={adminPassword}
                  onChange={(e) => setAdminPassword(e.target.value)}
                  placeholder="Nhập mật khẩu hiện tại để xác nhận..."
                  style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <button 
                onClick={() => { setShowRoleModal(false); setAdminPassword(''); }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Hủy
              </button>
              <button 
                disabled={changeRoleMutation.isPending || !adminPassword}
                onClick={() => {
                  changeRoleMutation.mutate({ 
                    id: selectedUser._id, 
                    role: selectedNewRole, 
                    password: adminPassword,
                    reason: roleReason.trim() || undefined
                  });
                }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: '#fff', background: '#3b82f6', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: (changeRoleMutation.isPending || !adminPassword) ? 0.6 : 1, transition: 'background 0.2s' }}
                onMouseEnter={e => { if (!(changeRoleMutation.isPending || !adminPassword)) e.currentTarget.style.background = '#2563eb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#3b82f6'; }}
              >
                {changeRoleMutation.isPending ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-6 bg-black/50 animate-in fade-in">
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '560px',
              overflow: 'hidden',
            }}
            className="animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div style={{ padding: '28px 28px 20px' }}>
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Create New User</h3>
            </div>

            {/* Body */}
            <div style={{ padding: '0 28px 20px', maxHeight: '65vh', overflowY: 'auto' }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>

                {/* ROW 1: Email (left) | Name (right) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Email <span style={{ color: '#ef4444' }}>*</span></label>
                  <input
                    type="email"
                    value={createForm.email}
                    onChange={(e) => setCreateForm(p => ({ ...p, email: e.target.value }))}
                    placeholder="..."
                    style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  {createFormErrors.email && <p style={{ fontSize: '12px', color: '#ef4444' }}>{createFormErrors.email}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Họ tên</label>
                  <input
                    type="text"
                    value={createForm.name}
                    onChange={(e) => setCreateForm(p => ({ ...p, name: e.target.value }))}
                    placeholder="..."
                    style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  {createFormErrors.name && <p style={{ fontSize: '12px', color: '#ef4444' }}>{createFormErrors.name}</p>}
                </div>

                {/* ROW 2: Password (left) | Phone (right) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mật khẩu <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCreatePassword ? 'text' : 'password'}
                      value={createForm.password}
                      onChange={(e) => setCreateForm(p => ({ ...p, password: e.target.value }))}
                      placeholder="..."
                      style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreatePassword(p => !p)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {showCreatePassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {createFormErrors.password && <p style={{ fontSize: '12px', color: '#ef4444' }}>{createFormErrors.password}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Số điện thoại
                  </label>
                  <input
                    type="tel"
                    value={createForm.phone}
                    onChange={(e) => setCreateForm(p => ({ ...p, phone: e.target.value }))}
                    placeholder="..."
                    style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                  {createFormErrors.phone && <p style={{ fontSize: '12px', color: '#ef4444' }}>{createFormErrors.phone}</p>}
                </div>

                {/* ROW 3: Confirm Password (left) | Role (right) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Xác nhận mật khẩu <span style={{ color: '#ef4444' }}>*</span></label>
                  <div style={{ position: 'relative' }}>
                    <input
                      type={showCreateConfirmPassword ? 'text' : 'password'}
                      value={createForm.confirmPassword}
                      onChange={(e) => setCreateForm(p => ({ ...p, confirmPassword: e.target.value }))}
                      placeholder="..."
                      style={{ width: '100%', padding: '8px 36px 8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                      onFocus={e => e.target.style.borderColor = '#3b82f6'}
                      onBlur={e => e.target.style.borderColor = 'var(--border)'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCreateConfirmPassword(p => !p)}
                      style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                    >
                      {showCreateConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {createFormErrors.confirmPassword && <p style={{ fontSize: '12px', color: '#ef4444' }}>{createFormErrors.confirmPassword}</p>}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Vai trò</label>
                  <select
                    value={createForm.role}
                    onChange={(e) => setCreateForm(p => ({ ...p, role: e.target.value as UserRole }))}
                    style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  >
                    <option value={UserRole.USER}>User</option>
                    {isSuperAdmin && <option value={UserRole.ADMIN}>Admin</option>}
                  </select>
                  {!isSuperAdmin && (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Admin chỉ có thể tạo tài khoản với vai trò USER.</p>
                  )}
                </div>

                {/* ROW 4: Address (full width) */}
                <div style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                    Địa chỉ
                  </label>
                  <input
                    type="text"
                    value={createForm.address}
                    onChange={(e) => setCreateForm(p => ({ ...p, address: e.target.value }))}
                    placeholder="..."
                    style={{ width: '100%', padding: '8px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              </div>
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)' }}>
              <button
                onClick={() => {
                  setShowCreateModal(false);
                  setCreateForm({ name: '', email: '', password: '', confirmPassword: '', phone: '', address: '', role: UserRole.USER });
                  setCreateFormErrors({});
                }}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Cancel
              </button>
              <button
                disabled={createUserMutation.isPending}
                onClick={handleCreateUser}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: '#fff', background: '#3b82f6', border: 'none', borderRadius: '6px', cursor: 'pointer', opacity: createUserMutation.isPending ? 0.6 : 1, transition: 'background 0.2s' }}
                onMouseEnter={e => { if (!createUserMutation.isPending) e.currentTarget.style.background = '#2563eb'; }}
                onMouseLeave={e => { e.currentTarget.style.background = '#3b82f6'; }}
              >
                {createUserMutation.isPending ? 'Đang tạo...' : 'Tạo mới'}
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Generic Confirm Modal */}
      {confirmModalConfig.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
          <div
            style={{
              background: 'var(--bg-card)',
              borderRadius: '12px',
              boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
              width: '100%',
              maxWidth: '400px',
              overflow: 'hidden',
            }}
            className="animate-in zoom-in-95 duration-200"
          >
            {/* Header */}
            <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h3 style={{ fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                {confirmModalConfig.title}
              </h3>
              <button 
                onClick={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
                style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                <X size={20} />
              </button>
            </div>
            
            {/* Body */}
            <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <p style={{ fontSize: '14px', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
                {confirmModalConfig.message}
              </p>
              
              {confirmModalConfig.requireReason && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Lý do thực hiện <span style={{ color: '#ef4444' }}>*</span></label>
                  <input 
                    type="text" 
                    value={confirmReason}
                    onChange={(e) => setConfirmReason(e.target.value)}
                    placeholder="Nhập lý do (bắt buộc)..."
                    style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
              <button 
                onClick={() => setConfirmModalConfig(prev => ({ ...prev, isOpen: false }))}
                style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
              >
                Hủy
              </button>
              <button 
                disabled={confirmModalConfig.isLoading || logoutAllDevicesMutation.isPending || (confirmModalConfig.requireReason && !confirmReason.trim())}
                onClick={() => confirmModalConfig.onConfirm(confirmReason.trim())}
                style={{ 
                  padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: '#fff', 
                  background: confirmModalConfig.actionType === 'danger' ? '#ef4444' : '#f59e0b', 
                  border: 'none', borderRadius: '6px', cursor: 'pointer', 
                  opacity: (confirmModalConfig.isLoading || logoutAllDevicesMutation.isPending || (confirmModalConfig.requireReason && !confirmReason.trim())) ? 0.6 : 1, transition: 'background 0.2s' 
                }}
                onMouseEnter={e => { if (!(confirmModalConfig.isLoading || logoutAllDevicesMutation.isPending || (confirmModalConfig.requireReason && !confirmReason.trim()))) e.currentTarget.style.background = confirmModalConfig.actionType === 'danger' ? '#dc2626' : '#d97706'; }}
                onMouseLeave={e => { e.currentTarget.style.background = confirmModalConfig.actionType === 'danger' ? '#ef4444' : '#f59e0b'; }}
              >
                {(confirmModalConfig.isLoading || logoutAllDevicesMutation.isPending) ? 'Đang xử lý...' : 'Xác nhận'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
    </>
  );
}
