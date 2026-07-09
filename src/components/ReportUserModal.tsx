import { useRef, useState, type ChangeEvent } from 'react';
import { X, AlertTriangle, Upload, Trash2 } from 'lucide-react';
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

const MAX_EVIDENCE_FILES = 5;
const MAX_EVIDENCE_FILE_SIZE_MB = 5;

export default function ReportUserModal({ isOpen, onClose, targetUserId, targetUserName }: ReportUserModalProps) {
  const [reason, setReason] = useState<CreateReportPayload['reason']>('spam_harassment');
  const [description, setDescription] = useState('');
  const [optionalDescription, setOptionalDescription] = useState('');
  const [evidenceFiles, setEvidenceFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const toast = useToast();

  const reportMutation = useMutation({
    mutationFn: (data: CreateReportPayload) => reportsApi.create(data),
    onSuccess: () => {
      toast.success('Báo cáo người dùng thành công. Chúng tôi sẽ xem xét sớm nhất.');
      onClose();
    },
    onError: (error: unknown) => {
      toast.error(parseError(error));
    },
  });

  const handleEvidenceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const pickedFiles = Array.from(event.target.files || []);
    event.target.value = '';

    if (pickedFiles.length === 0) {
      return;
    }

    const imageFiles = pickedFiles.filter((file) => file.type.startsWith('image/'));
    if (imageFiles.length !== pickedFiles.length) {
      toast.error('Chỉ được tải lên file ảnh cho chứng cứ.');
    }

    const validFiles = imageFiles.filter((file) => {
      if (file.size > MAX_EVIDENCE_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`Mỗi ảnh chỉ được tối đa ${MAX_EVIDENCE_FILE_SIZE_MB}MB.`);
        return false;
      }
      return true;
    });

    const remainingSlots = MAX_EVIDENCE_FILES - evidenceFiles.length;
    if (remainingSlots <= 0) {
      toast.error(`Tối đa ${MAX_EVIDENCE_FILES} ảnh chứng cứ.`);
      return;
    }

    const nextFiles = [...evidenceFiles, ...validFiles].slice(0, MAX_EVIDENCE_FILES);
    if (nextFiles.length < evidenceFiles.length + validFiles.length) {
      toast.error(`Tối đa ${MAX_EVIDENCE_FILES} ảnh chứng cứ.`);
    }

    setEvidenceFiles(nextFiles);
  };

  const removeEvidenceFile = (index: number) => {
    setEvidenceFiles((prev) => prev.filter((_, fileIndex) => fileIndex !== index));
  };

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
        <div style={{ padding: '24px 28px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle className="text-red-500" size={24} />
            Báo cáo {targetUserName ? `"${targetUserName}"` : 'người dùng'}
          </h3>
          <button
            onClick={onClose}
            style={{ background: 'transparent', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px', borderRadius: '50%' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: '0 28px 24px', display: 'flex', flexDirection: 'column', gap: '20px', maxHeight: '70vh', overflowY: 'auto' }}>
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>
            <p style={{ fontSize: '13.5px', color: '#ef4444', margin: 0, fontWeight: 500, lineHeight: 1.5 }}>
              Báo cáo của bạn được ẩn danh. Chúng tôi sẽ kiểm tra và có biện pháp xử lý nếu phát hiện vi phạm Tiêu chuẩn Cộng đồng.
            </p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
              Lý do báo cáo <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { value: 'spam_harassment', label: 'Spam / Lừa đảo / Quấy rối' },
                { value: 'impersonation', label: 'Tài khoản giả mạo' },
                { value: 'inappropriate_content', label: 'Nội dung không phù hợp' },
                { value: 'other', label: 'Lý do khác' },
              ].map((option) => (
                <label
                  key={option.value}
                  style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '14px', color: 'var(--text-primary)' }}
                >
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
              <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>
                Mô tả chi tiết <span className="text-red-500">*</span>
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Vui lòng mô tả rõ vi phạm của người này..."
                rows={3}
                style={{ width: '100%', padding: '10px 12px', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)', fontSize: '14px', outline: 'none', transition: 'border-color 0.2s', resize: 'none' }}
                onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
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
                onFocus={(e) => e.target.style.borderColor = '#ef4444'}
                onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
              />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <label style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>Ảnh chứng cứ</label>
                <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                  Tối đa {MAX_EVIDENCE_FILES} ảnh, mỗi ảnh không quá {MAX_EVIDENCE_FILE_SIZE_MB}MB.
                </p>
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-2 px-3 py-2 rounded border border-[var(--border)] text-sm font-medium text-[var(--text-primary)] hover:bg-[var(--bg-primary)] transition-colors"
              >
                <Upload size={16} />
                Chọn ảnh
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleEvidenceChange}
              className="hidden"
            />

            {evidenceFiles.length > 0 ? (
              <div className="flex flex-col gap-2">
                {evidenceFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.lastModified}-${index}`}
                    className="flex items-center justify-between gap-3 rounded border border-[var(--border)] px-3 py-2 bg-[var(--bg-primary)]"
                  >
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-[var(--text-primary)] truncate">{file.name}</div>
                      <div className="text-[12px] text-[var(--text-muted)]">{(file.size / (1024 * 1024)).toFixed(2)} MB</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeEvidenceFile(index)}
                      className="inline-flex items-center gap-1 px-2 py-1 rounded text-sm text-red-500 hover:bg-red-500/10 transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                      Xóa
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded border border-dashed border-[var(--border)] px-3 py-4 text-sm text-[var(--text-muted)] bg-[var(--bg-primary)]">
                Chưa có ảnh chứng cứ nào được chọn.
              </div>
            )}
          </div>
        </div>

        <div style={{ padding: '16px 28px', display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border)', background: 'var(--bg-card)' }}>
          <button
            onClick={onClose}
            style={{ padding: '8px 20px', fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', background: 'transparent', border: '1px solid var(--border)', borderRadius: '6px', cursor: 'pointer', transition: 'background 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-primary)')}
            onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
          >
            Hủy
          </button>
          <button
            disabled={reportMutation.isPending || (reason === 'other' && !description.trim())}
            onClick={() => {
              const payload: CreateReportPayload = {
                targetUserId,
                reason,
                evidenceFiles,
              };
              if (reason === 'other') {
                payload.description = description.trim();
              } else if (optionalDescription.trim()) {
                payload.optionalDescription = optionalDescription.trim();
              }
              reportMutation.mutate(payload);
            }}
            style={{
              padding: '8px 20px',
              fontSize: '14px',
              fontWeight: 500,
              color: '#fff',
              background: '#ef4444',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              opacity: (reportMutation.isPending || (reason === 'other' && !description.trim())) ? 0.6 : 1,
              transition: 'background 0.2s',
            }}
            onMouseEnter={(e) => { if (!(reportMutation.isPending || (reason === 'other' && !description.trim()))) e.currentTarget.style.background = '#dc2626'; }}
            onMouseLeave={(e) => { e.currentTarget.style.background = '#ef4444'; }}
          >
            {reportMutation.isPending ? 'Đang gửi...' : 'Gửi báo cáo'}
          </button>
        </div>
      </div>
    </div>
  );
}
