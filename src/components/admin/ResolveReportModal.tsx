import { useState, useEffect } from 'react';
import { X, ShieldAlert, AlertTriangle, UserX } from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adminApi, ReportStatusEnum, type ReportPenaltySuggestion } from '../../services/admin';
import { parseError } from '../../services/api';
import { useToast } from '../../context/ToastContext';

interface ResolveReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportId: string;
  reportStatus: typeof ReportStatusEnum[keyof typeof ReportStatusEnum];
  isTargetSuperAdmin?: boolean;
}

export default function ResolveReportModal({ isOpen, onClose, reportId, reportStatus, isTargetSuperAdmin }: ResolveReportModalProps) {
  const superAdminDismissNote = 'Bỏ qua báo cáo SUPER_ADMIN';
  const [status, setStatus] = useState<typeof ReportStatusEnum.RESOLVED | typeof ReportStatusEnum.DISMISSED>(isTargetSuperAdmin ? ReportStatusEnum.DISMISSED : ReportStatusEnum.RESOLVED);
  const [adminNote, setAdminNote] = useState(isTargetSuperAdmin ? superAdminDismissNote : '');
  
  const [useOverride, setUseOverride] = useState(false);
  const [penaltyAction, setPenaltyAction] = useState<string>('WARNING');
  const [durationDays, setDurationDays] = useState<number>(7);
  const [resetAvatar, setResetAvatar] = useState(false);
  const [resetName, setResetName] = useState(false);
  const [resetBio, setResetBio] = useState(false);
  
  const toast = useToast();
  const queryClient = useQueryClient();

  // Fetch penalty recommendation
  const { data: penaltySuggestion, isLoading: isLoadingSuggestion } = useQuery<ReportPenaltySuggestion>({
    queryKey: ['report_penalty', reportId],
    queryFn: () => adminApi.calculatePenalty(reportId),
    enabled: isOpen && reportStatus === ReportStatusEnum.PENDING,
    staleTime: 0,
    gcTime: 0,
  });

  // Pre-fill override forms with suggestion if available
  useEffect(() => {
    if (penaltySuggestion && penaltySuggestion.action) {
      setPenaltyAction(penaltySuggestion.action);
      if (penaltySuggestion.durationDays) {
        setDurationDays(penaltySuggestion.durationDays);
      }
    }
  }, [penaltySuggestion]);

  useEffect(() => {
    if (!isOpen) return;

    setStatus(isTargetSuperAdmin ? ReportStatusEnum.DISMISSED : ReportStatusEnum.RESOLVED);
    setAdminNote(isTargetSuperAdmin ? superAdminDismissNote : '');
  }, [isOpen, isTargetSuperAdmin]);

  const resolveMutation = useMutation({
    mutationFn: (data: any) => adminApi.resolveReport(reportId, data),
    onSuccess: () => {
      toast.success('Xử lý báo cáo thành công');
      queryClient.invalidateQueries({ queryKey: ['admin_reports'] });
      onClose();
    },
    onError: (error: any) => {
      toast.error(parseError(error));
    },
  });

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 animate-in fade-in"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) {
          onClose();
        }
      }}
    >
      <div
        style={{
          background: 'var(--bg-card)',
          borderRadius: '12px',
          boxShadow: '0 8px 40px rgba(0,0,0,0.18)',
          width: '100%',
          maxWidth: '520px',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column'
        }}
        className="animate-in zoom-in-95 duration-200"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert className="text-amber-500" size={24} />
            Xử lý vi phạm
          </h3>
          <button 
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>
        
        {/* Body */}
        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          {reportStatus !== ReportStatusEnum.PENDING && (
            <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.08)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', color: '#2563eb', fontSize: '13px' }}>
              Báo cáo này không còn ở trạng thái chờ xử lý, vui lòng tải lại danh sách trước khi tiếp tục.
            </div>
          )}
          
          {/* Hướng xử lý */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Hướng xử lý</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <label 
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '2px solid', cursor: isTargetSuperAdmin ? 'not-allowed' : 'pointer', transition: 'all 0.2s',
                  borderColor: status === ReportStatusEnum.RESOLVED ? '#f59e0b' : 'var(--border)',
                  background: status === ReportStatusEnum.RESOLVED ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                  color: status === ReportStatusEnum.RESOLVED ? '#d97706' : 'var(--text-primary)',
                  fontWeight: status === ReportStatusEnum.RESOLVED ? 600 : 400,
                  opacity: isTargetSuperAdmin ? 0.5 : 1
                }}
              >
                <input type="radio" name="resolveStatus" checked={status === ReportStatusEnum.RESOLVED} onChange={() => !isTargetSuperAdmin && setStatus(ReportStatusEnum.RESOLVED)} style={{ display: 'none' }} disabled={isTargetSuperAdmin} />
                <AlertTriangle size={18} /> Ghi nhận vi phạm
              </label>
              <label 
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', borderRadius: '8px', border: '2px solid', cursor: 'pointer', transition: 'all 0.2s',
                  borderColor: status === ReportStatusEnum.DISMISSED ? '#6b7280' : 'var(--border)',
                  background: status === ReportStatusEnum.DISMISSED ? 'rgba(107, 114, 128, 0.1)' : 'transparent',
                  color: status === ReportStatusEnum.DISMISSED ? 'var(--text-primary)' : 'var(--text-primary)',
                  fontWeight: status === ReportStatusEnum.DISMISSED ? 600 : 400
                }}
              >
                <input type="radio" name="resolveStatus" checked={status === ReportStatusEnum.DISMISSED} onChange={() => setStatus(ReportStatusEnum.DISMISSED)} style={{ display: 'none' }} />
                <UserX size={18} /> Bỏ qua báo cáo
              </label>
            </div>
          </div>

          {status === ReportStatusEnum.RESOLVED && (
            <div className="flex flex-col gap-5 animate-in fade-in slide-in-from-top-2 duration-300">
              
              <div style={{ padding: '10px 14px', background: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.2)', borderRadius: '8px', color: '#2563eb', fontSize: '13px', display: 'flex', gap: '8px', alignItems: 'center' }}>
                <ShieldAlert size={16} style={{ flexShrink: 0 }} />
                <span>Các báo cáo khác đang chờ xử lý có cùng lý do của người dùng này sẽ tự động được gộp chung.</span>
              </div>

              {/* Đề xuất từ hệ thống */}
              <div style={{ background: 'rgba(245, 158, 11, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <p style={{ margin: '0 0 12px 0', fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Hình phạt áp dụng</p>
                
                {isLoadingSuggestion ? (
                  <p style={{ fontSize: '14px', color: 'var(--text-muted)', margin: 0 }}>Đang tính toán đề xuất...</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    
                    <label style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        checked={!useOverride} 
                        onChange={() => setUseOverride(false)} 
                        style={{ marginTop: '2px', cursor: 'pointer', accentColor: '#f59e0b' }} 
                      />
                      <div style={{ display: 'flex', flexDirection: 'column' }}>
                        <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Theo đề xuất của hệ thống</span>
                        {penaltySuggestion?.action ? (
                          <span style={{ fontSize: '13px', color: '#d97706', marginTop: '4px' }}>
                            {penaltySuggestion.action === 'WARNING' ? 'Cảnh cáo' : 
                             penaltySuggestion.action === 'MUTE' ? `Cấm chat ${penaltySuggestion.durationDays} ngày` :
                             penaltySuggestion.action === 'BAN' ? `Khóa tài khoản ${penaltySuggestion.durationDays === -1 ? 'vĩnh viễn' : penaltySuggestion.durationDays + ' ngày'}` :
                             penaltySuggestion.action === 'RESET_AND_WARNING' ? 'Gỡ dữ liệu & Cảnh cáo' :
                             penaltySuggestion.action === 'RESET_AND_BAN' ? `Gỡ dữ liệu & Khóa tài khoản ${penaltySuggestion.durationDays === -1 ? 'vĩnh viễn' : penaltySuggestion.durationDays + ' ngày'}` : ''
                            } 
                            {' '} (Vi phạm lần {penaltySuggestion.strike})
                          </span>
                        ) : (
                          <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>Không có đề xuất, admin tự đưa ra hình thức xử lí</span>
                        )}
                      </div>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input 
                        type="radio" 
                        checked={useOverride} 
                        onChange={() => setUseOverride(true)} 
                        style={{ cursor: 'pointer', accentColor: '#f59e0b' }} 
                      />
                      <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)' }}>Khác (Tuỳ chỉnh)</span>
                    </label>
                  </div>
                )}
              </div>

              {/* Tùy chỉnh (Chỉ hiện khi chọn Khác) */}
              {useOverride && (
                <div className="flex flex-col gap-5 animate-in fade-in zoom-in-95 duration-200" style={{ paddingLeft: '28px', borderLeft: '2px solid rgba(245, 158, 11, 0.3)' }}>
                  {/* Hình phạt */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                        <input type="radio" name="penaltyAction" checked={penaltyAction === 'WARNING'} onChange={() => setPenaltyAction('WARNING')} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                        Cảnh cáo (Warning)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                        <input type="radio" name="penaltyAction" checked={penaltyAction === 'MUTE'} onChange={() => { setPenaltyAction('MUTE'); if (durationDays === -1) setDurationDays(30); }} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                        Cấm chat (Mute)
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                        <input type="radio" name="penaltyAction" checked={penaltyAction === 'BAN'} onChange={() => setPenaltyAction('BAN')} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                        Khóa tài khoản (Ban)
                      </label>
                    </div>
                  </div>

                  {/* Thời gian */}
                  {(penaltyAction === 'MUTE' || penaltyAction === 'BAN') && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Thời gian phạt</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {[1, 7, 30, penaltyAction === 'BAN' ? -1 : null].filter(d => d !== null).map((days) => (
                          <button
                            key={days}
                            type="button"
                            onClick={() => setDurationDays(days)}
                            style={{
                              padding: '6px 12px',
                              fontSize: '13px',
                              fontWeight: 500,
                              borderRadius: '6px',
                              cursor: 'pointer',
                              transition: 'all 0.2s',
                              border: durationDays === days ? '1px solid #f59e0b' : '1px solid var(--border)',
                              background: durationDays === days ? 'rgba(245, 158, 11, 0.1)' : 'transparent',
                              color: durationDays === days ? '#d97706' : 'var(--text-primary)'
                            }}
                          >
                            {days === -1 ? 'Vĩnh viễn' : `${days} ngày`}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}


                </div>
              )}

              {/* Gỡ dữ liệu - Always visible for RESOLVED status */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', background: 'rgba(245, 158, 11, 0.05)', padding: '16px', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Gỡ bỏ dữ liệu vi phạm</label>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={resetAvatar} onChange={(e) => setResetAvatar(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                    Gỡ Ảnh đại diện
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={resetName} onChange={(e) => setResetName(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                    Khôi phục Tên hiển thị về mặc định
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                    <input type="checkbox" checked={resetBio} onChange={(e) => setResetBio(e.target.checked)} style={{ cursor: 'pointer', accentColor: '#f59e0b' }} />
                    Xoá nội dung Tiểu sử
                  </label>
                </div>
              </div>

            </div>
          )}

          {/* Ghi chú */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Ghi chú của Admin {status === ReportStatusEnum.DISMISSED && <span style={{ color: '#ef4444' }}>*</span>}</label>
            <textarea 
              value={adminNote}
              onChange={(e) => setAdminNote(e.target.value)}
              placeholder="Nhập lý do hoặc thông tin nội bộ..."
              rows={3}
              disabled={isTargetSuperAdmin}
              style={{ 
                width: '100%', padding: '10px 12px', background: isTargetSuperAdmin ? 'var(--bg-secondary)' : 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', resize: 'none', cursor: isTargetSuperAdmin ? 'not-allowed' : 'text', opacity: isTargetSuperAdmin ? 0.7 : 1
              }}
              onFocus={e => !isTargetSuperAdmin && (e.target.style.borderColor = '#f59e0b')}
              onBlur={e => !isTargetSuperAdmin && (e.target.style.borderColor = 'var(--border)')}
            />
          </div>

        </div>

        {/* Footer */}
        <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <button 
            onClick={onClose}
            style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-primary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          >
            Hủy
          </button>
          <button 
            disabled={
              reportStatus !== ReportStatusEnum.PENDING ||
              resolveMutation.isPending ||
              (status === ReportStatusEnum.DISMISSED &&
                !(isTargetSuperAdmin ? superAdminDismissNote : adminNote).trim())
            }
            onClick={() => {
              const normalizedAdminNote = (isTargetSuperAdmin ? superAdminDismissNote : adminNote).trim();
              const payload: any = {
                status,
                adminNote: normalizedAdminNote
              };
              if (status === ReportStatusEnum.RESOLVED) {
                payload.resetAvatar = resetAvatar;
                payload.resetName = resetName;
                payload.resetBio = resetBio;
                
                if (useOverride) {
                  payload.overridePenaltyAction = penaltyAction;
                  if (penaltyAction === 'MUTE' || penaltyAction === 'BAN') {
                    payload.overridePenaltyDurationDays = durationDays;
                  }
                }
              }
              resolveMutation.mutate(payload);
            }}
            style={{ 
              padding: '8px 20px', 
              fontSize: '14px', 
              fontWeight: 600, 
              color: 'white', 
              background: status === ReportStatusEnum.RESOLVED ? '#f59e0b' : '#6b7280', 
              border: 'none', 
              borderRadius: '6px', 
              cursor: (
                reportStatus !== ReportStatusEnum.PENDING ||
                resolveMutation.isPending ||
                (status === ReportStatusEnum.DISMISSED &&
                  !(isTargetSuperAdmin ? superAdminDismissNote : adminNote).trim())
              ) ? 'not-allowed' : 'pointer', 
              opacity: (
                reportStatus !== ReportStatusEnum.PENDING ||
                resolveMutation.isPending ||
                (status === ReportStatusEnum.DISMISSED &&
                  !(isTargetSuperAdmin ? superAdminDismissNote : adminNote).trim())
              ) ? 0.6 : 1,
              transition: 'background 0.2s'
            }}
          >
            {resolveMutation.isPending ? 'Đang lưu...' : 'Xác nhận'}
          </button>
        </div>
      </div>
    </div>
  );
}
