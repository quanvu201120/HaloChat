import React, { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';
import { useMutation } from '@tanstack/react-query';
import { reportsApi, parseError } from '../services/api';
import type { CreateReportPayload } from '../services/api';
import { useToast } from '../context/ToastContext';

interface ReportUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  targetUserId: string;
  targetUserName?: string;
}

export default function ReportUserModal({ isOpen, onClose, targetUserId, targetUserName }: ReportUserModalProps) {
  const [reason, setReason] = useState<CreateReportPayload['reason']>('spam_harassment');
  const [description, setDescription] = useState('');
  const [optionalDescription, setOptionalDescription] = useState('');
  const toast = useToast();

  const reportMutation = useMutation({
    mutationFn: (data: CreateReportPayload) => reportsApi.create(data),
    onSuccess: () => {
      toast.success('Báo cáo người dùng thành công. Chúng tôi sẽ xem xét sớm nhất.');
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
          maxWidth: '480px',
          overflow: 'hidden',
        }}
        className="animate-in zoom-in-95 duration-200 flex flex-col"
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle className="text-red-500" size={24} />
            Báo cáo {targetUserName ? `"${targetUserName}"` : 'người dùng'}
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
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <p style={{ fontSize: '13.5px', color: '#ef4444', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
              Báo cáo của bạn được ẩn danh. Chúng tôi sẽ kiểm tra và có biện pháp xử lý nếu phát hiện vi phạm Tiêu chuẩn Cộng đồng.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Lý do báo cáo <span style={{ color: '#ef4444' }}>*</span></label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { value: 'spam_harassment', label: 'Spam / Lừa đảo / Quấy rối' },
                { value: 'impersonation', label: 'Tài khoản giả mạo' },
                { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
                { value: 'other', label: 'Lý do khác' }
              ].map(option => (
                <label key={option.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}>
                  <input 
                    type="radio" 
                    name="reportReason" 
                    value={option.value} 
                    checked={reason === option.value}
                    onChange={(e) => setReason(e.target.value as CreateReportPayload['reason'])}
                    style={{ cursor: 'pointer', accentColor: '#ef4444' }}
                  />
                  {option.label}
                </label>
              ))}
            </div>
          </div>

          {reason === 'other' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mô tả chi tiết <span className="text-red-500">*</span></label>
              <textarea 
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vui lòng mô tả rõ vi phạm của người này..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', resize: 'none' }}
                onFocus={e => e.target.style.borderColor = '#ef4444'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          {reason !== 'other' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Mô tả thêm (Không bắt buộc)</label>
              <textarea 
                value={optionalDescription}
                onChange={(e) => setOptionalDescription(e.target.value)}
                placeholder="Cung cấp thêm thông tin giúp chúng tôi xử lý nhanh hơn..."
                rows={2}
                style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', resize: 'none' }}
                onFocus={e => e.target.style.borderColor = '#ef4444'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}
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
            disabled={reportMutation.isPending || (reason === 'other' && !description.trim())}
            onClick={() => {
              const payload: CreateReportPayload = {
                targetUserId,
                reason,
              };
              if (reason === 'other') {
                payload.description = description.trim();
              } else if (optionalDescription.trim()) {
                payload.optionalDescription = optionalDescription.trim();
              }
              reportMutation.mutate(payload);
            }}
            style={{ 
              padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: '#fff', 
              background: '#ef4444', border: 'none', borderRadius: '6px', cursor: 'pointer', 
              opacity: (reportMutation.isPending || (reason === 'other' && !description.trim())) ? 0.6 : 1, 
              transition: 'background 0.2s' 
            }}
            onMouseEnter={e => { if (!(reportMutation.isPending || (reason === 'other' && !description.trim()))) e.currentTarget.style.background = '#dc2626'; }}
            onMouseLeave={e => { e.currentTarget.style.background = '#ef4444'; }}
          >
            {reportMutation.isPending ? 'Đang gửi...' : 'Gửi báo cáo'}
          </button>
        </div>
      </div>
    </div>
  );
}
