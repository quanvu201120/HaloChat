import { createPortal } from 'react-dom';
import { X, Eye, EyeOff } from 'lucide-react';
import type { UserAdminData } from '../../services/admin';
import { UserRole } from '../../constants/roles';
import { BAN_DURATION_1_DAY, BAN_DURATION_7_DAYS, BAN_DURATION_30_DAYS, PERMANENT_BAN_DAYS } from '../../constants/penalty';
import { MuiSelect } from './UsersTab.primitives';

interface UsersTabModalsProps {
  selectedUser: UserAdminData | null;

  // Status Modal (Lock/Unlock)
  showStatusModal: boolean;
  setShowStatusModal: (v: boolean) => void;
  statusAction: 'disable' | 'enable' | 'unban' | 'unmute';
  statusPassword: string;
  setStatusPassword: (v: string) => void;
  statusReason: string;
  setStatusReason: (v: string) => void;
  statusDuration: number;
  setStatusDuration: (v: number) => void;
  manualBanMutation: { mutate: (vars: { id: string, reason: string, durationDays: number, password?: string, resetAvatar?: boolean, resetBio?: boolean, resetName?: boolean }) => void; isPending: boolean };
  enableMutation: { mutate: (vars: { id: string, password?: string, reason: string }) => void; isPending: boolean };
  unbanMutation: { mutate: (vars: { id: string, password?: string, reason: string }) => void; isPending: boolean };
  unmuteMutation: { mutate: (vars: { id: string, password?: string, reason: string }) => void; isPending: boolean };

  // Quick Penalty Modal
  showQuickPenaltyModal: boolean;
  setShowQuickPenaltyModal: (v: boolean) => void;
  quickPenaltyData: {
    reason: string;
    adminNote: string;
    resetAvatar: boolean;
    resetBio: boolean;
    resetName: boolean;
    password: string;
    manualDurationDays: number;
  };
  setQuickPenaltyData: React.Dispatch<React.SetStateAction<{
    reason: string;
    adminNote: string;
    resetAvatar: boolean;
    resetBio: boolean;
    resetName: boolean;
    password: string;
    manualDurationDays: number;
  }>>;
  quickPenaltyMutation: { mutate: (vars: { id: string, reason: string, resetAvatar?: boolean, resetBio?: boolean, resetName?: boolean, adminNote?: string, password?: string }) => void; isPending: boolean };

  // Sudo Mode Role Modal
  showRoleModal: boolean;
  setShowRoleModal: (v: boolean) => void;
  selectedNewRole: UserRole;
  setSelectedNewRole: (r: UserRole) => void;
  roleReason: string;
  setRoleReason: (v: string) => void;
  adminPassword: string;
  setAdminPassword: (v: string) => void;
  changeRoleMutation: { mutate: (vars: { id: string, role: string, password?: string, reason?: string }) => void; isPending: boolean };

  // Create User Modal
  showCreateModal: boolean;
  setShowCreateModal: (v: boolean) => void;
  createForm: {
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone: string;
    address: string;
    role: UserRole;
  };
  setCreateForm: React.Dispatch<React.SetStateAction<{
    name: string;
    email: string;
    password: string;
    confirmPassword: string;
    phone: string;
    address: string;
    role: UserRole;
  }>>;
  createFormErrors: Record<string, string>;
  setCreateFormErrors: React.Dispatch<React.SetStateAction<Record<string, string>>>;
  showCreatePassword: boolean;
  setShowCreatePassword: React.Dispatch<React.SetStateAction<boolean>>;
  showCreateConfirmPassword: boolean;
  setShowCreateConfirmPassword: React.Dispatch<React.SetStateAction<boolean>>;
  createUserMutation: { isPending: boolean };
  handleCreateUser: () => void;
  isSuperAdmin: boolean;

  // Generic Confirm Modal
  confirmModalConfig: {
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'danger' | 'warning' | 'info';
    onConfirm: (reason?: string) => void;
    isLoading?: boolean;
    requireReason?: boolean;
  };
  setConfirmModalConfig: React.Dispatch<React.SetStateAction<{
    isOpen: boolean;
    title: string;
    message: string;
    actionType: 'danger' | 'warning' | 'info';
    onConfirm: (reason?: string) => void;
    isLoading?: boolean;
    requireReason?: boolean;
  }>>;
  confirmReason: string;
  setConfirmReason: (v: string) => void;
  logoutAllDevicesMutation: { isPending: boolean };
}

export function UsersTabModals({
  selectedUser,
  showStatusModal,
  setShowStatusModal,
  statusAction,
  statusPassword,
  setStatusPassword,
  statusReason,
  setStatusReason,
  statusDuration,
  setStatusDuration,
  manualBanMutation,
  enableMutation,
  unbanMutation,
  unmuteMutation,
  showQuickPenaltyModal,
  setShowQuickPenaltyModal,
  quickPenaltyData,
  setQuickPenaltyData,
  quickPenaltyMutation,
  showRoleModal,
  setShowRoleModal,
  selectedNewRole,
  setSelectedNewRole,
  roleReason,
  setRoleReason,
  adminPassword,
  setAdminPassword,
  changeRoleMutation,
  showCreateModal,
  setShowCreateModal,
  createForm,
  setCreateForm,
  createFormErrors,
  setCreateFormErrors,
  showCreatePassword,
  setShowCreatePassword,
  showCreateConfirmPassword,
  setShowCreateConfirmPassword,
  createUserMutation,
  handleCreateUser,
  isSuperAdmin,
  confirmModalConfig,
  setConfirmModalConfig,
  confirmReason,
  setConfirmReason,
  logoutAllDevicesMutation,
}: UsersTabModalsProps) {
  return (
    <>
      {/* Status Modal (Lock/Unlock) */}
      {showStatusModal && selectedUser && createPortal(
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 animate-in fade-in" style={{ zIndex: 1000 }}>
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
                    min={BAN_DURATION_1_DAY}
                    placeholder={`Ví dụ: ${BAN_DURATION_7_DAYS} (nhập số ngày, chọn giá trị rất lớn nếu muốn khóa vĩnh viễn)`}
                    style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s' }}
                    onFocus={e => e.target.style.borderColor = '#ef4444'}
                    onBlur={e => e.target.style.borderColor = 'var(--border)'}
                  />
                    <span className="text-xs text-[var(--text-muted)] mt-1">Giá trị rất lớn sẽ được hiển thị là khóa vĩnh viễn.</span>
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
        </div>,
        document.body
      )}

      {/* Quick Penalty Modal */}
      {showQuickPenaltyModal && selectedUser && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-in fade-in"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) {
              setShowQuickPenaltyModal(false);
              setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: BAN_DURATION_1_DAY });
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
              setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: BAN_DURATION_1_DAY });
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
                    { value: 'inappropriate_content', label: 'Vi phạm Tiêu chuẩn Cộng đồng' },
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
                <MuiSelect
                  label="Thời hạn phạt"
                  value={String(quickPenaltyData.manualDurationDays)}
                  onChange={(value) => setQuickPenaltyData(prev => ({ ...prev, manualDurationDays: Number(value) }))}
                  options={[
                      { value: String(BAN_DURATION_1_DAY), label: `${BAN_DURATION_1_DAY} ngày` },
                      { value: String(BAN_DURATION_7_DAYS), label: `${BAN_DURATION_7_DAYS} ngày` },
                      { value: String(BAN_DURATION_30_DAYS), label: `${BAN_DURATION_30_DAYS} ngày` },
                      { value: String(PERMANENT_BAN_DAYS), label: 'Vĩnh viễn' },
                    ]}
                    minWidth={140}
                    labelBgColor="var(--bg-card)"
                  />
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
              setQuickPenaltyData({ reason: 'other', adminNote: '', resetAvatar: false, resetBio: false, resetName: false, password: '', manualDurationDays: BAN_DURATION_1_DAY });
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
        <div className="fixed inset-0 flex items-center justify-center p-4 bg-black/50 animate-in fade-in" style={{ zIndex: 1000 }}>
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

              <MuiSelect
                label="Vai trò mới"
                value={selectedNewRole}
                onChange={(value) => setSelectedNewRole(value as UserRole)}
                options={[
                  { value: UserRole.USER, label: 'USER' },
                  { value: UserRole.ADMIN, label: 'ADMIN' },
                ]}
                minWidth={0}
                labelBgColor="var(--bg-card)"
              />

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
                  <MuiSelect
                    label=""
                    value={createForm.role}
                    onChange={(role) => setCreateForm(p => ({ ...p, role: role as UserRole }))}
                    options={[
                      { value: UserRole.USER, label: 'User' },
                      ...(isSuperAdmin ? [{ value: UserRole.ADMIN, label: 'Admin' }] : []),
                    ]}
                    minWidth={0}
                    labelBgColor="var(--bg-card)"
                  />
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
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-in fade-in">
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
    </>
  );
}
