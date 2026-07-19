import { useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useLocation, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { AlertTriangle, ArrowLeft, Clock3, FileImage, LogIn, ShieldAlert, X } from 'lucide-react';
import { parseError, reportsApi } from '../services/api';
import { useAuthStore } from '../store/authStore';
import { useToast } from '../context/ToastContext';
import { formatDateVN, formatTimeRemaining } from '../utils/date';

function ImagePreview({ file, onRemove }: { file: File; onRemove: () => void }) {
  const [url, setUrl] = useState('');
  useEffect(() => {
    const objectUrl = URL.createObjectURL(file);
    setUrl(objectUrl);
    return () => URL.revokeObjectURL(objectUrl);
  }, [file]);
  return (
    <div style={{ position: 'relative', width: '80px', height: '80px', borderRadius: '10px', overflow: 'hidden', flexShrink: 0, background: 'var(--bg-secondary)' }}>
      {url && <img src={url} alt={file.name} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
      <button
        type="button"
        onClick={onRemove}
        style={{
          position: 'absolute', top: '4px', right: '4px',
          width: '20px', height: '20px',
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.55)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#fff',
          padding: 0,
        }}
        aria-label="Xóa ảnh"
      >
        <X size={12} />
      </button>
    </div>
  );
}

const STATUS_LABELS: Record<string, string> = {
  resolved: 'Đã giải quyết',
  appeal_pending: 'Kháng cáo đang chờ xử lý',
  appeal_rejected: 'Kháng cáo bị từ chối',
  appeal_success: 'Kháng cáo thành công',
};

const PENALTY_LABELS: Record<string, string> = {
  warning: 'Cảnh cáo',
  mute: 'Cấm chat',
  ban: 'Khóa tài khoản',
};

const REASON_LABELS: Record<string, string> = {
  spam_harassment: 'Spam / Lừa đảo / Quấy rối',
  inappropriate_content: 'Vi phạm Tiêu chuẩn Cộng đồng',
  impersonation: 'Mạo danh',
  system_spam: 'Spam hệ thống',
  other: 'Vi phạm khác',
};

export default function AppealPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { reportId } = useParams();
  const toast = useToast();
  const queryClient = useQueryClient();
  const { accessToken, bannedAppeal, setBannedAppeal } = useAuthStore();
  const [appealText, setAppealText] = useState('');
  const [files, setFiles] = useState<File[]>([]);
  const [submittedStatus, setSubmittedStatus] = useState<string | null>(null);

  const bannedContext = useMemo(() => {
    if (!reportId) return bannedAppeal;
    return bannedAppeal?.reportId === reportId ? bannedAppeal : null;
  }, [bannedAppeal, reportId]);
  const locationState = location.state as { bannedAppeal?: typeof bannedAppeal; banUntil?: string } | null;
  const locationBannedAppeal = locationState?.bannedAppeal;
  const activeBanUntil = bannedContext?.banUntil || locationState?.banUntil;

  const appealAccessQuery = useQuery({
    queryKey: ['appeal-access', reportId],
    queryFn: () => reportsApi.getAppealAccess(reportId!),
    enabled: !!reportId && !!accessToken,
  });

  const appealContext = (appealAccessQuery.data || bannedContext || locationBannedAppeal) ?? null;

  const submitAppealMutation = useMutation({
    mutationFn: async () => {
      if (!appealContext?.reportId || !appealContext.appealToken) {
        throw new Error('Không có quyền kháng cáo cho báo cáo này');
      }
      return await reportsApi.submitAppeal(appealContext.reportId, {
        appealText: appealText.trim(),
        files,
        appealToken: appealContext.appealToken,
      });
    },
    onSuccess: () => {
      toast.success('Gửi kháng cáo thành công');
      setSubmittedStatus('appeal_pending');
      void Promise.all([
        queryClient.invalidateQueries({ queryKey: ['notifications'] }),
        queryClient.invalidateQueries({ queryKey: ['notifications-unread-count'] }),
      ]);
      setBannedAppeal(
        appealContext
          ? {
              ...appealContext,
              status: 'appeal_pending',
              appealToken: undefined,
            }
          : null,
      );
      setFiles([]);
      setAppealText('');
    },
    onError: (error) => {
      toast.error(parseError(error));
    },
  });

  if (!accessToken && !bannedContext && !locationBannedAppeal && !activeBanUntil && !reportId) {
    return <Navigate to="/login" replace />;
  }

  const currentStatus = submittedStatus || appealContext?.status || 'resolved';
  const canSubmit =
    !submittedStatus &&
    currentStatus === 'resolved' &&
    !!appealContext?.appealToken &&
    !!appealContext?.appealDeadline &&
    new Date(appealContext.appealDeadline).getTime() > Date.now();

  return (
    <div className="login-page" style={{ position: 'relative' }}>
      <div className="login-bg-orb orb1" style={{ background: 'var(--accent-orange)' }} />
      <div className="login-bg-orb orb2" style={{ background: 'var(--accent-teal)' }} />

      <div className="login-card" style={{ maxWidth: '640px' }}>
        {accessToken && (
          <button
            type="button"
            onClick={() => navigate(-1)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontSize: '13px',
              fontWeight: 600,
              padding: '0 0 12px 0',
            }}
          >
            <ArrowLeft size={16} />
            Quay lại
          </button>
        )}
        <div className="login-header">
          <div
            className="login-icon"
            style={{ background: 'linear-gradient(135deg, var(--accent-orange), var(--accent-primary))' }}
          >
            <ShieldAlert size={24} />
          </div>
          <h1 className="login-title">Kháng cáo xử lý vi phạm</h1>
          <p className="login-subtitle">Gửi giải trình và bằng chứng để đội ngũ xem xét lại quyết định xử lý</p>
        </div>

        {activeBanUntil && (
          <div
            style={{
              display: 'flex',
              gap: '10px',
              alignItems: 'center',
              padding: '12px 14px',
              borderRadius: '14px',
              background: 'rgba(245, 158, 11, 0.12)',
              color: 'var(--text-primary)',
              marginBottom: '18px',
            }}
          >
            <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
            <div>
              <div style={{ fontWeight: 700 }}>Tài khoản đang bị khóa </div>
              <div style={{ fontWeight: 700 }}> Thời hạn: 
                {new Date(activeBanUntil).getFullYear() - new Date().getFullYear() >= 10
                  ? 'Vĩnh viễn'
                  : ` ${formatTimeRemaining(activeBanUntil)}`
                }
              </div>
            </div>
          </div>
        )}

        {appealAccessQuery.isLoading ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>Đang tải thông tin kháng cáo...</div>
        ) : !appealContext ? (
          <div style={{ color: 'var(--text-secondary)', textAlign: 'center' }}>
            Không tìm thấy thông tin kháng cáo cho báo cáo này.
          </div>
        ) : (
          <>
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '12px',
                marginBottom: '18px',
              }}
            >
              {appealContext.reason && (
                <div className="bg-[var(--bg-secondary)]" style={{ borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Lỗi vi phạm</div>
                  <div style={{ fontWeight: 700 }}>
                    {REASON_LABELS[appealContext.reason] || appealContext.reason}
                  </div>
                </div>
              )}
              {canSubmit && (
                <div className="bg-[var(--bg-secondary)]" style={{ borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Hạn gửi kháng cáo</div>
                  <div style={{ fontWeight: 700 }}>
                    {appealContext.appealDeadline ? formatDateVN(appealContext.appealDeadline) : 'Không có'}
                  </div>
                </div>
              )}
              {appealContext.appealReviewDeadline && (
                <div className="bg-[var(--bg-secondary)]" style={{ borderRadius: '14px', padding: '14px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '6px' }}>Thời gian xử lí</div>
                  <div style={{ fontWeight: 700 }}>
                    {formatTimeRemaining(appealContext.appealReviewDeadline)}
                  </div>
                </div>
              )}
            </div>

            {canSubmit ? (
              <form
                className="login-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!appealText.trim()) {
                    toast.error('Vui lòng nhập nội dung kháng cáo');
                    return;
                  }
                  void submitAppealMutation.mutate();
                }}
              >
                <div className="form-group">
                  <label className="form-label" htmlFor="appeal-text">Nội dung kháng cáo</label>
                  <textarea
                    id="appeal-text"
                    className="form-input"
                    value={appealText}
                    onChange={(e) => setAppealText(e.target.value)}
                    rows={5}
                    maxLength={1000}
                    placeholder="Trình bày lý do bạn cho rằng quyết định xử lý cần được xem xét lại"
                    style={{ resize: 'vertical', minHeight: '120px' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="appeal-files">Ảnh bằng chứng kháng cáo</label>
                  <input
                    id="appeal-files"
                    className="form-input"
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const picked = Array.from(e.target.files || []);
                      setFiles((prev) => {
                        const merged = [...prev, ...picked];
                        return merged.slice(0, 5);
                      });
                      e.target.value = '';
                    }}
                  />
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                    Tối đa 5 ảnh. Đã chọn: {files.length}
                  </div>
                  {files.length > 0 && (
                    <div style={{ marginTop: '10px', display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                      {files.map((file, idx) => (
                        <ImagePreview
                          key={`${file.name}-${idx}`}
                          file={file}
                          onRemove={() => setFiles((prev) => prev.filter((_, i) => i !== idx))}
                        />
                      ))}
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={submitAppealMutation.isPending}
                  style={{ width: '100%', justifyContent: 'center', padding: '11px', marginTop: '8px' }}
                >
                  {submitAppealMutation.isPending ? 'Đang gửi kháng cáo...' : 'Gửi kháng cáo'}
                </button>
              </form>
            ) : (
              <div
                style={{
                  display: 'flex',
                  gap: '10px',
                  alignItems: 'flex-start',
                  padding: '14px',
                  borderRadius: '14px',
                  background: 'var(--bg-secondary)',
                  color: 'var(--text-secondary)',
                }}
              >
                <Clock3 size={18} style={{ marginTop: '2px' }} />
                <div>
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
                    {currentStatus === 'appeal_pending'
                      ? 'Kháng cáo của bạn đang được xử lý'
                      : currentStatus === 'appeal_rejected'
                        ? 'Kháng cáo đã bị từ chối'
                        : currentStatus === 'appeal_success'
                          ? 'Kháng cáo đã thành công'
                          : 'Không thể gửi kháng cáo ở thời điểm này'}
                  </div>
                  
                </div>
              </div>
            )}

          </>
        )}

        {!accessToken && (
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '18px', fontSize: '13px' }}>
            <Link to="/login" style={{ color: 'var(--accent-primary)', textDecoration: 'none', fontWeight: 600 }}>
              <LogIn size={14} style={{ display: 'inline-block', marginRight: '6px', verticalAlign: 'text-bottom' }} />
              Quay lại đăng nhập
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
