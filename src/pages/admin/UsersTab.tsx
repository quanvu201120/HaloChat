import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminApi, type UserAdminData } from '../../services/admin';
import { useToast } from '../../context/ToastContext';
import { useAuthStore } from '../../store/authStore';
import { UserRole } from '../../constants/roles';
import { UI_LIMITS } from '../../constants/limits';

import { BAN_DURATION_1_DAY } from '../../constants/penalty';
import { DAY_IN_MS, useDebounce, LIMIT } from './UsersTab.primitives';
import { UsersListView } from './UsersListView';
import { UserDetailView } from './UserDetailView';
import { UsersTabModals } from './UsersTabModals';
import { getBanStatusLabel } from './UsersTab.primitives';

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
  const detailHistoryPushedRef = useRef(false);

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
      setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: BAN_DURATION_1_DAY });
      const banUntil = new Date(Date.now() + variables.durationDays * DAY_IN_MS).toISOString();
      setSelectedUser(prev => prev ? { ...prev, banUntil } : null);
      updateUserInList(variables.id, { banUntil });
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
      setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: BAN_DURATION_1_DAY });
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
    manualDurationDays: BAN_DURATION_1_DAY
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

  useEffect(() => {
    if (!selectedUser) {
      detailHistoryPushedRef.current = false;
      return;
    }

    if (!detailHistoryPushedRef.current) {
      window.history.pushState({ ...window.history.state, adminDetail: 'users' }, '', window.location.href);
      detailHistoryPushedRef.current = true;
    }

    const handleAdminDetailBack = () => {
      setSelectedUser(null);
      setShowActionsDropdown(false);
    };

    window.addEventListener('popstate', handleAdminDetailBack);
    return () => window.removeEventListener('popstate', handleAdminDetailBack);
  }, [selectedUser]);

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

  const isPermanentlyBanned = !!getBanStatusLabel(selectedUser?.banUntil || undefined);

  return (
    <>
      <UsersListView
        selectedUser={selectedUser}
        isFilterOpen={isFilterOpen}
        setIsFilterOpen={setIsFilterOpen}
        setShowCreateModal={setShowCreateModal}
        search={search}
        setSearch={setSearch}
        sortFilter={sortFilter}
        setSortFilter={setSortFilter}
        roleFilter={roleFilter}
        setRoleFilter={setRoleFilter}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        users={users}
        total={total}
        page={page}
        setPage={setPage}
        isLoading={isLoading}
        isFetching={isFetching}
        setSelectedUser={setSelectedUser}
      />

      {/* User Detail View */}
      {selectedUser && (
        <UserDetailView
          selectedUser={selectedUser}
          currentUser={currentUser}
          setSelectedUser={setSelectedUser}
          showActionsDropdown={showActionsDropdown}
          setShowActionsDropdown={setShowActionsDropdown}
          actionsDropdownRef={actionsDropdownRef}
          isPermanentlyBanned={isPermanentlyBanned}
          setShowRoleModal={setShowRoleModal}
          setSelectedNewRole={setSelectedNewRole}
          setShowQuickPenaltyModal={setShowQuickPenaltyModal}
          setConfirmModalConfig={setConfirmModalConfig}
          logoutAllDevicesMutation={logoutAllDevicesMutation}
          setStatusAction={setStatusAction}
          setStatusPassword={setStatusPassword}
          setStatusReason={setStatusReason}
          setShowStatusModal={setShowStatusModal}
        />
      )}

      <UsersTabModals
        selectedUser={selectedUser}
        showStatusModal={showStatusModal}
        setShowStatusModal={setShowStatusModal}
        statusAction={statusAction}
        statusPassword={statusPassword}
        setStatusPassword={setStatusPassword}
        statusReason={statusReason}
        setStatusReason={setStatusReason}
        statusDuration={statusDuration}
        setStatusDuration={setStatusDuration}
        manualBanMutation={manualBanMutation}
        enableMutation={enableMutation}
        unbanMutation={unbanMutation}
        unmuteMutation={unmuteMutation}
        showQuickPenaltyModal={showQuickPenaltyModal}
        setShowQuickPenaltyModal={setShowQuickPenaltyModal}
        quickPenaltyData={quickPenaltyData}
        setQuickPenaltyData={setQuickPenaltyData}
        quickPenaltyMutation={quickPenaltyMutation}
        showRoleModal={showRoleModal}
        setShowRoleModal={setShowRoleModal}
        selectedNewRole={selectedNewRole}
        setSelectedNewRole={setSelectedNewRole}
        roleReason={roleReason}
        setRoleReason={setRoleReason}
        adminPassword={adminPassword}
        setAdminPassword={setAdminPassword}
        changeRoleMutation={changeRoleMutation}
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
        createForm={createForm}
        setCreateForm={setCreateForm}
        createFormErrors={createFormErrors}
        setCreateFormErrors={setCreateFormErrors}
        showCreatePassword={showCreatePassword}
        setShowCreatePassword={setShowCreatePassword}
        showCreateConfirmPassword={showCreateConfirmPassword}
        setShowCreateConfirmPassword={setShowCreateConfirmPassword}
        createUserMutation={createUserMutation}
        handleCreateUser={handleCreateUser}
        isSuperAdmin={isSuperAdmin}
        confirmModalConfig={confirmModalConfig}
        setConfirmModalConfig={setConfirmModalConfig}
        confirmReason={confirmReason}
        setConfirmReason={setConfirmReason}
        logoutAllDevicesMutation={logoutAllDevicesMutation}
      />
    </>
  );
}
