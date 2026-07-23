import { ShieldBan, ShieldCheck, ChevronLeft, Mail, Phone, MapPin, Calendar, Clock, User, Lock, Shield, CalendarDays } from 'lucide-react';
import type { UserAdminData } from '../../services/admin';
import { UserRole } from '../../constants/roles';
import { formatDateOnlyVN, formatDateVN } from '../../utils/date';
import { InfoItem, UserStatusBadges } from './UsersTab.primitives';

interface UserDetailViewProps {
  selectedUser: UserAdminData;
  currentUser: { role?: string } | null;
  setSelectedUser: (u: UserAdminData | null) => void;
  showActionsDropdown: boolean;
  setShowActionsDropdown: React.Dispatch<React.SetStateAction<boolean>>;
  actionsDropdownRef: React.RefObject<HTMLDivElement | null>;
  isPermanentlyBanned: boolean;
  setShowRoleModal: (v: boolean) => void;
  setSelectedNewRole: (r: UserRole) => void;
  setShowQuickPenaltyModal: (v: boolean) => void;
  setConfirmModalConfig: React.Dispatch<React.SetStateAction<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'danger' | 'warning' | 'info';
    onConfirm: (reason?: string) => void;
    isLoading?: boolean;
    requireReason?: boolean;
  }>>;
  logoutAllDevicesMutation: { mutate: (vars: { id: string; reason: string }) => void };
  setStatusAction: (a: 'disable' | 'enable' | 'unban' | 'unmute') => void;
  setStatusPassword: (v: string) => void;
  setStatusReason: (v: string) => void;
  setShowStatusModal: (v: boolean) => void;
}

export function UserDetailView({
  selectedUser,
  currentUser,
  setSelectedUser,
  showActionsDropdown,
  setShowActionsDropdown,
  actionsDropdownRef,
  isPermanentlyBanned,
  setShowRoleModal,
  setSelectedNewRole,
  setShowQuickPenaltyModal,
  setConfirmModalConfig,
  logoutAllDevicesMutation,
  setStatusAction,
  setStatusPassword,
  setStatusReason,
  setShowStatusModal,
}: UserDetailViewProps) {
  return (
    <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
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

      {/* Grid Layout cho các phần thông tin */}
      <div className="flex flex-col gap-5 overflow-y-auto flex-1 pb-4 pr-1">


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
              <div className="flex-1 min-w-0 w-full">
                <h3 className="text-xl font-bold text-[var(--text-primary)] break-all whitespace-normal leading-tight">{selectedUser.name}</h3>

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
  );
}
