import { useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi, type Report, ReportStatusEnum, ReportReasonEnum } from '../../services/admin';
import { UserRole } from '../../constants/roles';
import { MuiSelect } from '../../components/admin/MuiSelect';
import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';
import { Flag, ChevronRight, ChevronLeft, Clock, AlertCircle, FileText, CheckCircle, Hash, Image, User, Shield } from 'lucide-react';
import MediaLightbox from '../../components/MediaLightbox';
import ResolveReportModal from '../../components/admin/ResolveReportModal';
import { UI_LIMITS } from '../../constants/limits';
import { formatDateVN } from '../../utils/date';

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const handler = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(handler);
  }, [value, delay]);
  return debouncedValue;
}

function UserAutocomplete({ label, value, onChange, labelBgColor = 'var(--bg-primary)' }: { label: string, value: string | undefined, onChange: (v: string | undefined) => void, labelBgColor?: string }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, UI_LIMITS.SEARCH_DEBOUNCE_MS);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['admin_users_search', debouncedSearch],
    queryFn: () => adminApi.getUsers({ search: debouncedSearch, limit: UI_LIMITS.ADMIN_AUTOCOMPLETE_LIMIT }),
    enabled: debouncedSearch.length > 0 && open,
    staleTime: 0,
    gcTime: 0,
  });

  const [selectedLabel, setSelectedLabel] = useState<string>('');

  useEffect(() => {
    if (!value) {
      setSearch('');
      setSelectedLabel('');
    }
  }, [value]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} style={{ position: 'relative', minWidth: 200, marginBottom: '10px' }}>
      <div className="relative">
        <input 
          type="text" 
          placeholder=" "
          style={{padding:'2px 10px', borderRadius:'4px', height:'34px', width: '100%'}}
          value={open ? search : selectedLabel}
          onChange={(e) => {
            setSearch(e.target.value);
            if (!open) setOpen(true);
            if (e.target.value === '') {
              onChange(undefined);
              setSelectedLabel('');
            }
          }}
          onFocus={() => {
            setOpen(true);
            setSearch('');
          }}
          className="peer px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
        />
        <label 
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
          {label}
        </label>
        
        {value && !open && (
          <button 
            onClick={() => { onChange(undefined); setSelectedLabel(''); setSearch(''); }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 z-10"
          >
            ✕
          </button>
        )}
      </div>

      {open && data && data.items && data.items.length > 0 && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 2px)', left: 0, right: 0,
          background: 'var(--bg-card)',
          borderRadius: '4px',
          boxShadow: '0px 5px 5px -3px rgba(0,0,0,0.2), 0px 8px 10px 1px rgba(0,0,0,0.14), 0px 3px 14px 2px rgba(0,0,0,0.12)',
          paddingTop: '8px', paddingBottom: '8px',
          zIndex: 100,
          maxHeight: 200, overflowY: 'auto'
        }}>
          {data.items.map((opt: any) => (
            <button
              key={opt._id}
              type="button"
              onClick={() => { 
                onChange(opt._id); 
                setSelectedLabel(opt.name || opt.email);
                setOpen(false); 
              }}
              style={{
                width: '100%', textAlign: 'left',
                padding: '6px 16px',
                fontSize: '14px',
                border: 'none', cursor: 'pointer',
                background: 'transparent',
                color: 'var(--text-primary)'
              }}
              className="hover:bg-[var(--bg-secondary)]"
            >
              <div className="font-medium">{opt.name}</div>
              <div className="text-[12px] text-[var(--text-muted)]">{opt.email}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

interface InfoItemProps {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  placeholder?: string;
  valueClass?: string;
  children?: React.ReactNode;
}

function InfoItem({ icon, label, value, placeholder = 'Chưa xác định', valueClass = '', children }: InfoItemProps) {
  return (
    <div className="flex items-start sm:items-center gap-4 border-b border-[var(--border)] last:border-b-0" style={{ padding: '10px 0' }}>
      <div className="w-9 h-9 flex items-center justify-center bg-[var(--bg-primary)] rounded-sm text-[var(--text-secondary)] shrink-0 border border-[var(--border)] mt-1 sm:mt-0">
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <span className="block text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">{label}</span>
        {children ? (
          <div className="mt-0.5">{children}</div>
        ) : (
          <span className={`block text-sm font-semibold mt-0.5 break-words whitespace-normal ${value ? 'text-[var(--text-primary)]' : 'text-[var(--text-muted)] italic'} ${valueClass}`}>
            {value || placeholder}
          </span>
        )}
      </div>
    </div>
  );
}

export default function ReportsTab() {
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<string>('all');
  const [targetRole, setTargetRole] = useState<string>('all');
  const [reporterId, setReporterId] = useState<string | undefined>();
  const [targetUserId, setTargetUserId] = useState<string | undefined>();
  const [resolvedBy, setResolvedBy] = useState<string | undefined>();
  
  const [localStartDate, setLocalStartDate] = useState<string>('');
  const [localEndDate, setLocalEndDate] = useState<string>('');
  
  const [reportIdSearch, setReportIdSearch] = useState('');
  const debouncedReportId = useDebounce(reportIdSearch, UI_LIMITS.SEARCH_DEBOUNCE_MS);
  const [sortOrder, setSortOrder] = useState('newest');
  
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);
  const [lightboxData, setLightboxData] = useState<{ medias: any[], initialIndex: number } | null>(null);
  const [isResolveModalOpen, setIsResolveModalOpen] = useState(false);
  const LIMIT = UI_LIMITS.ADMIN_TABLE_PAGE_SIZE;

  const { data, isLoading } = useQuery({
    queryKey: ['admin_reports', page, LIMIT, status, targetRole, reporterId, targetUserId, resolvedBy, localStartDate, localEndDate, debouncedReportId, sortOrder],
    queryFn: () => adminApi.getReports({
      current: page.toString(),
      pageSize: LIMIT.toString(),
      status: status !== 'all' ? status : undefined,
      targetRole: targetRole !== 'all' ? targetRole : undefined,
      reporterId,
      targetUserId,
      resolvedBy,
      startDate: localStartDate ? new Date(`${localStartDate}T00:00:00`).toISOString() : undefined,
      endDate: localEndDate ? new Date(`${localEndDate}T23:59:59.999`).toISOString() : undefined,
      reportId: debouncedReportId || undefined,
      sort: sortOrder,
    }),
    staleTime: 0,
    gcTime: 0,
  });

  const reports = data?.reports || [];
  const total = data?.totalItems || 0;
  const totalPages = data?.totalPages || 1;
  const isProcessingReport = selectedReport?.status === ReportStatusEnum.RESOLVING;
  const canOpenResolveModal = selectedReport?.status === ReportStatusEnum.PENDING;

  useEffect(() => {
    if (selectedReport) {
      const updated = reports.find((r: Report) => r._id === selectedReport._id);
      if (updated && JSON.stringify(updated) !== JSON.stringify(selectedReport)) {
        setSelectedReport(updated);
      }
    }
  }, [reports, selectedReport]);

  const getStatusBadge = (status: string) => {
    const s = status?.toLowerCase();
    switch (s) {
      case ReportStatusEnum.PENDING:
      case ReportStatusEnum.APPEAL_PENDING:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-amber-100 text-amber-700 uppercase tracking-wider shadow-sm whitespace-nowrap">Chờ xử lý</span>;
      case ReportStatusEnum.RESOLVING:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-700 uppercase tracking-wider shadow-sm whitespace-nowrap">Đang xử lý</span>;
      case ReportStatusEnum.RESOLVED:
      case ReportStatusEnum.APPEAL_SUCCESS:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-green-100 text-green-700 uppercase tracking-wider shadow-sm whitespace-nowrap">Đã giải quyết</span>;
      case ReportStatusEnum.DISMISSED:
      case ReportStatusEnum.APPEAL_REJECTED:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 uppercase tracking-wider shadow-sm whitespace-nowrap">Bỏ qua</span>;
      default:
        return <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-gray-100 text-gray-700 uppercase tracking-wider shadow-sm whitespace-nowrap">{status}</span>;
    }
  };

  const getReasonText = (reason: string) => {
    const r = reason?.toLowerCase();
    switch (r) {
      case ReportReasonEnum.SPAM_HARASSMENT: return 'Spam / Quấy rối';
      case ReportReasonEnum.INAPPROPRIATE_CONTENT: return 'Nội dung phản cảm';
      case ReportReasonEnum.IMPERSONATION: return 'Mạo danh';
      case ReportReasonEnum.OTHER: return 'Khác';
      default: return reason;
    }
  };

  const getPenaltyText = (penalty: string) => {
    if (!penalty) return '';
    const p = penalty.toLowerCase();
    
    let duration = '';
    let untilDateStr = '';
    
    let isPermanent = false;
    const daysMatch = p.match(/for (\d+) days/i);
    if (daysMatch) {
      const dDays = parseInt(daysMatch[1]);
      if (dDays >= 3650) {
        isPermanent = true;
        duration = 'vĩnh viễn';
      } else {
        duration = `${dDays} ngày`;
      }
    }
    
    if (!isPermanent) {
      const untilMatch = penalty.match(/\(Until ([^)]+)\)/i);
      if (untilMatch) {
         try {
            const d = new Date(untilMatch[1]);
            untilDateStr = `(Đến ${formatDateVN(d)})`;
         } catch (e) {
            untilDateStr = `(Đến ${untilMatch[1]})`;
         }
      }
    }

    const timeInfo = (duration || untilDateStr) ? ` ${duration} ${untilDateStr}`.trim() : '';

    if (p.includes('reset info and account banned')) return `Gỡ thông tin & Khóa tài khoản ${timeInfo}`.trim();
    if (p.includes('account banned') || p.includes('ban applied')) return `Khóa tài khoản ${timeInfo}`.trim();
    if (p.includes('muted')) return `Cấm chat ${timeInfo}`.trim();
    if (p.includes('reset info and warning')) return 'Gỡ thông tin & Cảnh cáo';
    if (p.includes('warning')) return 'Cảnh cáo';
    
    if (p.includes('ban') || p.includes('account_ban')) return `Khóa tài khoản ${timeInfo}`.trim();
    if (p.includes('mute') || p.includes('chat_ban')) return `Cấm chat ${timeInfo}`.trim();
    if (p.includes('delete')) return 'Xóa nội dung vi phạm';
    if (p.includes('reset_avatar')) return 'Gỡ ảnh đại diện';
    if (p.includes('reset_bio')) return 'Gỡ tiểu sử';
    if (p.includes('reset_name')) return 'Gỡ tên hiển thị';
    if (p === 'none') return 'Không phạt';
    
    return penalty;
  };

  const renderMediaList = (mediaIds?: any[]) => {
    if (!mediaIds || mediaIds.length === 0) return null;
    return (
      <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-2">
        {mediaIds.map((media, idx) => (
          <button key={idx} onClick={() => setLightboxData({ medias: mediaIds, initialIndex: idx })} className="block aspect-square rounded-lg border border-[var(--border)] overflow-hidden hover:opacity-80 hover:shadow-md transition-all bg-[var(--bg-secondary)] relative group cursor-pointer p-0">
            {media.resource_type === 'video' ? (
               <>
                 <video src={media.url} className="w-full h-full object-cover" />
                 <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/40 transition-colors">
                   <div className="w-6 h-6 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center text-white text-xs">▶</div>
                 </div>
               </>
            ) : (
               <img src={media.url} alt="Media" className="w-full h-full object-cover" />
            )}
          </button>
        ))}
      </div>
    );
  };

  const renderUserInfo = (user: any) => {
    if (!user || typeof user === 'string') return <span className="text-[var(--text-muted)] italic">N/A</span>;
    return (
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-[var(--text-primary)] truncate max-w-[150px]">{user.name}</span>
        <span className="text-[11px] text-[var(--text-muted)] truncate max-w-[150px]">{user.email}</span>
      </div>
    );
  };

  const renderFilterContent = (isMobile: boolean) => (
    <div className="flex flex-col min-[1050px]:flex-row flex-wrap items-stretch min-[1050px]:items-center gap-4 w-full [&>div]:w-full min-[1050px]:[&>div]:w-auto">
      <MuiSelect
        label="Trạng thái"
        value={status}
        onChange={setStatus}
        options={[
          { value: 'all', label: 'Tất cả trạng thái' },
          { value: ReportStatusEnum.PENDING, label: 'Đang chờ xử lý' },
          { value: ReportStatusEnum.RESOLVING, label: 'Đang xử lý' },
          { value: ReportStatusEnum.RESOLVED, label: 'Đã giải quyết' },
          { value: ReportStatusEnum.DISMISSED, label: 'Đã bỏ qua' },
          { value: ReportStatusEnum.APPEAL_PENDING, label: 'Đang kháng cáo' },
          { value: ReportStatusEnum.APPEAL_SUCCESS, label: 'Kháng cáo thành công' },
          { value: ReportStatusEnum.APPEAL_REJECTED, label: 'Kháng cáo bị từ chối' },
        ]}
        minWidth={170}
        marginBottom="10px"
        labelBgColor={isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'}
      />
      <MuiSelect
        label="Loại đối tượng"
        value={targetRole}
        onChange={setTargetRole}
        options={[
          { value: 'all', label: 'Tất cả đối tượng' },
          { value: UserRole.USER, label: 'USER' },
          { value: UserRole.ADMIN, label: 'ADMIN' },
          { value: UserRole.SUPER_ADMIN, label: 'SUPER ADMIN' },
        ]}
        minWidth={150}
        marginBottom="10px"
        labelBgColor={isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'}
      />
      <UserAutocomplete label="Người báo cáo" value={reporterId} onChange={setReporterId} labelBgColor={isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'} />
      <UserAutocomplete label="Người bị báo cáo" value={targetUserId} onChange={setTargetUserId} labelBgColor={isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'} />
      <UserAutocomplete label="Người xử lý" value={resolvedBy} onChange={setResolvedBy} labelBgColor={isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'} />
      
      {/* Search by ID */}
      <div className="relative flex-1 min-[1050px]:flex-none" style={{marginBottom:'10px', minWidth:'175px'}}>
        <div className="relative">
          <input 
            type="text" 
            placeholder=" "
            style={{padding:'2px 10px', borderRadius:'4px', height:'34px'}}
            value={reportIdSearch}
            onChange={(e) => setReportIdSearch(e.target.value)}
            className="peer w-full px-4 py-2.5 bg-transparent border border-[var(--border)] rounded-sm text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
          />
          <label 
            style={{
              padding:'0 5px',
              background: isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'
            }}
            className={`absolute pointer-events-none transition-all duration-200 text-[var(--text-muted)] z-10 whitespace-nowrap
              top-1/2 left-3 -translate-y-1/2 text-sm
              peer-focus:top-0 peer-focus:left-3 peer-focus:text-[10px] peer-focus:font-medium peer-focus:text-indigo-500
              peer-[:not(:placeholder-shown)]:top-0 peer-[:not(:placeholder-shown)]:left-3 peer-[:not(:placeholder-shown)]:text-[11px] peer-[:not(:placeholder-shown)]:font-medium
            `}
          >
            Tìm ID báo cáo
          </label>
        </div>
      </div>
      
      {/* Sort */}
      <MuiSelect
        label="Thời gian"
        value={sortOrder}
        onChange={setSortOrder}
        options={[
          { value: 'newest', label: 'Mới nhất' },
          { value: 'oldest', label: 'Cũ nhất' },
        ]}
        minWidth={150}
        marginBottom="10px"
        labelBgColor={isMobile ? 'var(--bg-card)' : 'var(--bg-primary)'}
      />
      
      <div className="flex flex-col min-[1050px]:flex-row items-stretch min-[1050px]:items-center gap-2">
        <div style={{ position: 'relative', marginBottom: '10px' }} className="w-full min-[1050px]:w-[150px]">
          <input 
            type="date" 
            style={{padding:'2px 10px', borderRadius:'4px', height:'34px', width: '100%'}}
            className="peer bg-transparent border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
            value={localStartDate}
            onChange={(e) => setLocalStartDate(e.target.value)}
          />
          <label 
            style={{ padding:'0 5px', background: isMobile ? 'var(--bg-card)' : 'var(--bg-primary)' }}
            className="absolute pointer-events-none transition-all duration-200 text-[var(--text-muted)] z-10 whitespace-nowrap top-0 left-3 -translate-y-1/2 text-[11px] font-medium"
          >
            Từ ngày
          </label>
        </div>
        <span className="text-[var(--text-muted)] mb-[10px] hidden min-[1050px]:inline">-</span>
        <div style={{ position: 'relative', marginBottom: '10px' }} className="w-full min-[1050px]:w-[150px]">
          <input 
            type="date" 
            style={{padding:'2px 10px', borderRadius:'4px', height:'34px', width: '100%'}}
            className="peer bg-transparent border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors text-sm"
            value={localEndDate}
            onChange={(e) => setLocalEndDate(e.target.value)}
          />
          <label 
            style={{ padding:'0 5px', background: isMobile ? 'var(--bg-card)' : 'var(--bg-primary)' }}
            className="absolute pointer-events-none transition-all duration-200 text-[var(--text-muted)] z-10 whitespace-nowrap top-0 left-3 -translate-y-1/2 text-[11px] font-medium"
          >
            Đến ngày
          </label>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[var(--bg-primary)]">
      
      {!selectedReport && (
        <>
          <div className="hidden min-[1050px]:block flex-none p-4 pb-0">
            <div className="mb-4">
              {renderFilterContent(false)}
            </div>
          </div>
          
          <AdminMobileFilter 
            isOpen={isMobileFilterOpen} 
            onToggle={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
          >
            {renderFilterContent(true)}
          </AdminMobileFilter>
        </>
      )}

      {!selectedReport ? (
        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="bg-[var(--bg-card)] rounded-lg border border-[var(--border)] overflow-hidden shadow-sm flex flex-col h-full">
            <div className="flex-1 overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[900px]">
                <thead className="bg-[var(--bg-secondary)] text-[12px] uppercase text-[var(--text-muted)] font-semibold sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="py-3 px-4 w-12 text-center border-b border-[var(--border)]">#</th>
                    <th className="py-3 px-4 w-[150px] border-b border-[var(--border)]">Lý do</th>
                    <th className="py-3 px-4 w-[180px] border-b border-[var(--border)]">Người báo cáo</th>
                    <th className="py-3 px-4 w-[180px] border-b border-[var(--border)]">Người bị báo cáo</th>
                    <th className="py-3 px-4 w-[130px] border-b border-[var(--border)]">Trạng thái</th>
                    <th className="py-3 px-4 w-[150px] border-b border-[var(--border)]">Thời gian tạo</th>
                    <th className="py-3 px-4 w-[180px] border-b border-[var(--border)]">Người xử lý</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[var(--border)] text-sm">
                  {isLoading ? (
                    <tr><td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">Đang tải...</td></tr>
                  ) : reports.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-[var(--text-muted)]">Không tìm thấy báo cáo nào</td></tr>
                  ) : (
                    reports.map((report: Report, idx: number) => (
                      <tr key={report._id} className="hover:bg-[var(--bg-secondary)] transition-colors cursor-pointer group" onClick={() => setSelectedReport(report)}>
                        <td className="py-3 px-4 text-center text-[var(--text-muted)] font-mono text-xs">{(page - 1) * LIMIT + idx + 1}</td>
                        <td className="py-3 px-4"><span className="font-semibold text-[var(--text-primary)]">{getReasonText(report.reason)}</span></td>
                        <td className="py-3 px-4">{renderUserInfo(report.reporterId)}</td>
                        <td className="py-3 px-4">{renderUserInfo(report.targetUserId)}</td>
                        <td className="py-3 px-4">{getStatusBadge(report.status)}</td>
                        <td className="py-3 px-4 text-[12px] text-[var(--text-muted)] font-medium">{formatDateVN(report.createdAt)}</td>
                        <td className="py-3 px-4">{renderUserInfo(report.resolvedBy)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div className="p-2.5 sm:p-5 border-t border-[var(--border)] flex flex-col sm:grid sm:grid-cols-3 gap-2 sm:gap-4 items-center text-[13px] sm:text-sm text-[var(--text-secondary)] shrink-0">
              <div className="text-center sm:text-left">
                Hiển thị <span className="font-medium text-[var(--text-primary)]">{total === 0 ? 0 : (page - 1) * LIMIT + 1}</span> đến <span className="font-medium text-[var(--text-primary)]">{Math.min(page * LIMIT, total)}</span> trong tổng số <span className="font-medium text-[var(--text-primary)]">{total}</span>
              </div>
              
              <div className="flex items-center justify-center gap-1.5">
                <button 
                  disabled={page === 1} 
                  onClick={() => setPage(p => Math.max(1, p - 1))} 
                  className="w-8 h-8 rounded-full flex items-center justify-center border border-[var(--border)] bg-[var(--bg-card)] hover:bg-[var(--bg-card-hover)] hover:text-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shrink-0 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                </button>
                
                {(() => {
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
                  disabled={page >= totalPages || total === 0} 
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
      ) : (
        <div className="flex-1 overflow-auto px-4 pb-4 animate-in fade-in slide-in-from-right-4 duration-300">
          
           {/* Header*/}
            <div style={{padding:'5px', marginBottom:'20px'}} className="relative flex items-center bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm mb-4 mt-2 px-2 sm:px-5 py-1.5">
              <button onClick={() => setSelectedReport(null)} className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2.5 py-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-all duration-200 font-medium text-sm z-10 cursor-pointer">
                <ChevronLeft size={16} /> Quay lại
              </button>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none"><h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] pointer-events-auto">Chi tiết báo cáo</h2></div>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-10 w-full">

           
            
            <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
              <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">Thông tin báo cáo</h4>
              <div className="flex flex-col">
                <InfoItem icon={<Hash size={16} />} label="ID báo cáo" value={selectedReport._id} />
                <InfoItem icon={<AlertCircle size={16} />} label="Lý do" value={getReasonText(selectedReport.reason)} valueClass="text-red-500" />
                <InfoItem icon={<FileText size={16} />} label="Mô tả chi tiết" value={selectedReport.description} />
                <InfoItem icon={<Flag size={16} />} label="Trạng thái">{getStatusBadge(selectedReport.status)}</InfoItem>
                <InfoItem icon={<Clock size={16} />} label="Thời gian tạo" value={formatDateVN(selectedReport.createdAt)} />
                <InfoItem icon={<Clock size={16} />} label="Cập nhật cuối" value={formatDateVN(selectedReport.updatedAt)} />
                <InfoItem icon={<Image size={16} />} label="Bằng chứng vi phạm">
                  {selectedReport.evidenceMediaIds && selectedReport.evidenceMediaIds.length > 0 ? (
                    renderMediaList(selectedReport.evidenceMediaIds)
                  ) : (
                    <span className="text-[var(--text-muted)] italic text-sm mt-0.5 inline-block">Không xác định</span>
                  )}
                </InfoItem>
              </div>
            </div>
            <div className="flex flex-col gap-5">
              {/* Action Box */}
              <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold text-amber-500">Tiến trình xử lý</h4>
                
                {selectedReport.resolvedBy ? (
                  <div className="flex flex-col">
                    <InfoItem icon={<CheckCircle size={16} />} label="Người xử lý" value={typeof selectedReport.resolvedBy !== 'string' ? `${selectedReport.resolvedBy.name} (${selectedReport.resolvedBy.email})` : selectedReport.resolvedBy} />
                    <InfoItem icon={<Clock size={16} />} label="Thời gian xử lý" value={selectedReport.resolvedAt ? formatDateVN(selectedReport.resolvedAt) : undefined} />
                    {selectedReport.penaltyApplied && <InfoItem icon={<AlertCircle size={16} />} label="Hình phạt áp dụng" value={getPenaltyText(selectedReport.penaltyApplied)} valueClass="text-red-500 font-bold" />}
                    {selectedReport.adminNote && <InfoItem icon={<FileText size={16} />} label="Ghi chú của Admin" value={selectedReport.adminNote} />}
                  </div>
                ) : isProcessingReport ? (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">Báo cáo này đang được một admin khác xử lý.</p>
                    <p className="text-sm text-[var(--text-muted)]">Vui lòng chờ hoàn tất hoặc tải lại danh sách để xem trạng thái mới nhất.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    <p className="text-sm font-medium text-[var(--text-primary)]">Báo cáo này đang chờ giải quyết.</p>
                    <button 
                      onClick={() => setIsResolveModalOpen(true)}
                      disabled={!canOpenResolveModal}
                      className={`px-4 py-2 bg-amber-500 text-white font-bold rounded shadow-sm text-sm transition-colors self-start ${canOpenResolveModal ? 'cursor-pointer hover:bg-amber-600' : 'cursor-not-allowed opacity-60'}`}
                    >
                      Tiến hành xử lý
                    </button>
                  </div>
                )}
              </div>

              {/* Reporter and Target User Grid */}
              <div className="flex flex-col gap-5">
                <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">Người báo cáo</h4>
                  {typeof selectedReport.reporterId !== 'string' ? (
                    <div className="flex items-center gap-4 mt-2">
                      {selectedReport.reporterId?.avatar ? (
                        <img src={typeof selectedReport.reporterId.avatar === 'object' ? selectedReport.reporterId.avatar.url : selectedReport.reporterId.avatar} className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover border border-[var(--border)]" />
                      ) : (
                        <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-indigo-500 text-white flex items-center justify-center font-bold text-xl">{selectedReport.reporterId?.name?.charAt(0)?.toUpperCase()}</div>
                      )}
                      <div><div className="font-bold text-[var(--text-primary)]">{selectedReport.reporterId?.name}</div><div className="text-sm text-[var(--text-muted)] break-all">{selectedReport.reporterId?.email}</div></div>
                    </div>
                  ) : <span>{selectedReport.reporterId}</span>}
                </div>
                <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold text-red-500">Người bị báo cáo</h4>
                  {typeof selectedReport.targetUserId !== 'string' ? (
                    <div className="flex flex-col mt-2 gap-3">
                      <div className="flex items-center gap-4">
                        {selectedReport.targetUserId?.avatar ? (
                          <img src={typeof selectedReport.targetUserId.avatar === 'object' ? selectedReport.targetUserId.avatar.url : selectedReport.targetUserId.avatar} className="w-10 h-10 lg:w-12 lg:h-12 rounded-full object-cover border border-[var(--border)]" />
                        ) : (
                          <div className="w-10 h-10 lg:w-12 lg:h-12 rounded-full bg-red-500 text-white flex items-center justify-center font-bold text-xl">{selectedReport.targetUserId?.name?.charAt(0)?.toUpperCase()}</div>
                        )}
                        <div>
                          <div className="font-bold text-[var(--text-primary)] flex items-center gap-2">
                            {selectedReport.targetUserId?.name}
                            {(selectedReport.targetUserId as any)?.role === 'SUPER_ADMIN' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#e74c3c] text-white uppercase shadow-sm">Super Admin</span>
                            ) : (selectedReport.targetUserId as any)?.role === 'ADMIN' ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3498db] text-white uppercase shadow-sm">Admin</span>
                            ) : null}
                          </div>
                          <div className="text-sm text-[var(--text-muted)] break-all">{selectedReport.targetUserId?.email}</div>
                        </div>
                      </div>
                      <div className="text-sm text-[var(--text-primary)] bg-[var(--bg-primary)] p-2 rounded border border-[var(--border)]">
                        <span className="font-bold text-[var(--text-muted)] text-[10px] uppercase tracking-wider block mb-1">Tiểu sử</span>
                        {(selectedReport.targetUserId as any)?.bio || <span className="italic text-[var(--text-muted)]">Không có tiểu sử</span>}
                      </div>
                    </div>
                  ) : <span>{selectedReport.targetUserId}</span>}
                </div>
              </div>
            </div>
            
            {(selectedReport.appealDeadline || selectedReport.appealText || (selectedReport.appealEvidenceMediaIds && selectedReport.appealEvidenceMediaIds.length > 0)) && (
               <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start lg:col-span-2">
                 <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold text-amber-500">Thông tin kháng cáo</h4>
                 <div className="flex flex-col">
                   {selectedReport.status === ReportStatusEnum.APPEAL_PENDING && selectedReport.updatedAt && (
                     <InfoItem icon={<Clock size={16} />} label="Thời gian gửi" value={formatDateVN(selectedReport.updatedAt)} />
                   )}
                   {selectedReport.appealDeadline && <InfoItem icon={<Clock size={16} />} label="Hạn chót kháng cáo" value={formatDateVN(selectedReport.appealDeadline)} />}
                   {selectedReport.appealText && <InfoItem icon={<FileText size={16} />} label="Nội dung kháng cáo" value={selectedReport.appealText} />}
                   {selectedReport.appealEvidenceMediaIds && selectedReport.appealEvidenceMediaIds.length > 0 && (
                     <InfoItem icon={<Image size={16} />} label="Bằng chứng kháng cáo">
                       {renderMediaList(selectedReport.appealEvidenceMediaIds)}
                     </InfoItem>
                   )}
                 </div>
               </div>
            )}
            
            {selectedReport.snapshot && Object.keys(selectedReport.snapshot).length > 0 && (
               <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start lg:col-span-2">
                 <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">Dữ liệu tại thời điểm báo cáo</h4>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 mt-2">
                    <InfoItem icon={<Image size={16} />} label="Ảnh đại diện">
                      {selectedReport.snapshot.avatarMediaId && selectedReport.snapshot.avatarMediaId.url ? (
                        <button onClick={() => setLightboxData({ medias: [selectedReport.snapshot.avatarMediaId], initialIndex: 0 })} className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer border-none bg-transparent p-0 mt-1">
                          <img src={selectedReport.snapshot.avatarMediaId.url} className="w-12 h-12 rounded-full object-cover border border-[var(--border)] shadow-sm" alt="Avatar" />
                        </button>
                      ) : (
                        <img src={'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedReport.snapshot.displayName || 'User') + '&background=random'} className="w-12 h-12 rounded-full object-cover shrink-0 border border-[var(--border)] shadow-sm mt-1" alt="Avatar" />
                      )}
                    </InfoItem>
                    <InfoItem icon={<User size={16} />} label="Tên hiển thị" value={selectedReport.snapshot.displayName || 'Không rõ'} />
                    <InfoItem icon={<Shield size={16} />} label="Vai trò">
                      <div className="mt-1">
                        {selectedReport.snapshot.role === 'SUPER_ADMIN' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#e74c3c] text-white uppercase shadow-sm">Super Admin</span>
                        ) : selectedReport.snapshot.role === 'ADMIN' ? (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3498db] text-white uppercase shadow-sm">Admin</span>
                        ) : (
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#95a5a6] text-white uppercase shadow-sm">User</span>
                        )}
                      </div>
                    </InfoItem>
                    <InfoItem icon={<FileText size={16} />} label="Tiểu sử" value={selectedReport.snapshot.bio || 'Không có tiểu sử'} />
                 </div>
               </div>
            )}
          </div>
        </div>
      )}

      {lightboxData && (
        <MediaLightbox
          medias={lightboxData.medias}
          initialIndex={lightboxData.initialIndex}
          onClose={() => setLightboxData(null)}
        />
      )}

      {selectedReport && (
        <ResolveReportModal 
          key={`${selectedReport._id}-${isResolveModalOpen ? 'open' : 'closed'}`}
          isOpen={isResolveModalOpen} 
          onClose={() => setIsResolveModalOpen(false)} 
          reportId={selectedReport._id}
          reportStatus={selectedReport.status}
          isTargetSuperAdmin={(selectedReport.targetUserId as any)?.role === 'SUPER_ADMIN' || selectedReport.snapshot?.role === 'SUPER_ADMIN'} 
        />
      )}
    </div>
  );
}
