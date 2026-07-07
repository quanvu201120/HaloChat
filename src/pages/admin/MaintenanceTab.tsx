import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient, keepPreviousData } from '@tanstack/react-query';
import { adminApi, type CleanupJob } from '../../services/admin';
import { TerminalSquare, ChevronLeft, ChevronRight, X, Play, Info } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';

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

const getCleanedPayload = (payload: any) => {
  if (!payload) return null;
  if (typeof payload !== 'object') return payload;
  if (Array.isArray(payload)) return payload.length ? payload : null;
  
  const cleaned: any = {};
  Object.entries(payload).forEach(([k, v]) => {
    if (v === null || v === undefined || v === '') return;
    if (Array.isArray(v) && v.length === 0) return;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) return;
    cleaned[k] = v;
  });
  
  return Object.keys(cleaned).length > 0 ? cleaned : null;
};

const formatDate = (dateStr: string | Date) => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('vi-VN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
};

const LIMIT = 20;

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
        <span style={{
          position: 'absolute', right: '8px', top: '50%',
          transform: open ? 'translateY(-50%) rotate(180deg)' : 'translateY(-50%) rotate(0deg)',
          transition: 'transform 0.2s',
          color: open ? '#1976d2' : 'var(--text-muted)',
          pointerEvents: 'none',
          fontSize: '12px',
        }}>▾</span>
      </button>
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

function JobBadge({ status }: { status: string }) {
  const styles: any = {
    'PENDING': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    'RUNNING': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 animate-pulse',
    'RETRY': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'FAILED': 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    'IGNORED': 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700 line-through',
    'DONE': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  };

  const style = styles[status] || styles['PENDING'];

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${style}`}>
      {status}
    </span>
  );
}

const canExecuteJob = (job: CleanupJob) => {
  if (!['PENDING', 'RETRY', 'FAILED', 'IGNORED'].includes(job.status)) return false;
  if (job.lockedUntil && new Date(job.lockedUntil).getTime() > Date.now()) return false;
  return true;
};

export default function MaintenanceTab() {
  const queryClient = useQueryClient();
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortFilter, setSortFilter] = useState('created_desc');
  const [page, setPage] = useState(1);
  const [selectedJob, setSelectedJob] = useState<CleanupJob | null>(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['admin_jobs', page, typeFilter, statusFilter, sortFilter],
    queryFn: () => adminApi.getCleanupJobs({ 
      page, 
      limit: LIMIT, 
      type: typeFilter !== 'all' ? typeFilter : undefined, 
      status: statusFilter !== 'all' ? statusFilter : undefined,
      sort: sortFilter !== 'created_desc' ? sortFilter : undefined
    }),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    placeholderData: keepPreviousData,
  });

  const jobs = data?.items || [];
  const total = data?.total || 0;

  useEffect(() => {
    if (selectedJob && data?.items) {
      const updatedJob = data.items.find((j: any) => j._id === selectedJob._id);
      if (updatedJob) {
        setSelectedJob(prev => {
          if (JSON.stringify(prev) !== JSON.stringify(updatedJob)) {
            return updatedJob;
          }
          return prev;
        });
      }
    }
  }, [data?.items, selectedJob?._id]);

  const runJobMutation = useMutation({
    mutationFn: adminApi.runJobManually,
    onSuccess: () => {
      toast.success('Đã xếp hàng đợi Job');
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
    },
    onError: () => toast.error('Lỗi khi chạy Job')
  });

  const renderFilters = (idPrefix: string) => {
    const labelBgColor = idPrefix === 'mobile' ? 'var(--bg-card)' : 'var(--bg-primary)';

    return (
      <>
        {/* Type Filter */}
        <MuiSelect
          label="Loại tác vụ"
          value={typeFilter}
          onChange={setTypeFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'cloud', label: 'Cloudinary' },
            { value: 'r2', label: 'R2' },
            { value: 'redis', label: 'Redis' },
            { value: 'session', label: 'Session' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />

        {/* Sort */}
        <MuiSelect
          label="Sắp xếp"
          value={sortFilter}
          onChange={setSortFilter}
          options={[
            { value: 'created_desc', label: 'Mới nhất' },
            { value: 'created_asc', label: 'Cũ nhất' },
            { value: 'retry_asc', label: 'Hạn gần nhất' },
            { value: 'retry_desc', label: 'Hạn xa nhất' },
          ]}
          minWidth={190}
          labelBgColor={labelBgColor}
        />

        {/* Status */}
        <MuiSelect
          label="Trạng thái"
          value={statusFilter}
          onChange={setStatusFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'PENDING', label: 'PENDING' },
            { value: 'RETRY', label: 'RETRY' },
            { value: 'DONE', label: 'DONE' },
            { value: 'FAILED', label: 'FAILED' },
            { value: 'IGNORED', label: 'IGNORED' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />
      </>
    );
  };

  return (
    <>
      {!selectedJob && (
        <AdminMobileFilter 
          isOpen={isFilterOpen} 
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
        >
          {renderFilters('mobile')}
        </AdminMobileFilter>
      )}

      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500">
        {/* List View */}
        <div className={`flex flex-col h-full ${selectedJob ? 'hidden' : ''} relative`}>
          <div className="max-[1050px]:hidden min-[1050px]:flex flex-row flex-wrap gap-4 mb-6 mt-2 items-center w-full">
            {renderFilters('desktop')}
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-secondary)] text-sm">
                    <th className="px-6 py-4 font-medium w-[60px] text-center">STT</th>
                    <th className="px-6 py-4 font-medium">Tên Job (Action)</th>
                    <th className="px-6 py-4 font-medium">Ngày tạo</th>
                    <th className="px-6 py-4 font-medium">Lịch chạy lại</th>
                    <th className="px-6 py-4 font-medium">Trạng thái</th>
                    <th className="px-6 py-4 font-medium">Hoàn tất lúc</th>
                    <th className="px-6 py-4 font-medium w-[120px] text-center">Thao tác</th>
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[var(--text-muted)]">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500 mx-auto mb-4"></div>
                        Đang tải dữ liệu...
                      </td>
                    </tr>
                  ) : jobs.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-6 py-10 text-center text-[var(--text-muted)]">
                        Không tìm thấy Job nào.
                      </td>
                    </tr>
                  ) : (
                    jobs.map((job, index) => {
                      const isExecuting = runJobMutation.isPending && runJobMutation.variables === job._id;
                      return (
                        <tr 
                          key={job._id} 
                          className={`border-b border-[var(--border)] transition-colors cursor-pointer ${
                            isExecuting ? 'bg-indigo-50/50 dark:bg-indigo-900/10 animate-pulse pointer-events-none opacity-70' : 'hover:bg-[var(--bg-card-hover)]'
                          }`}
                          onClick={() => setSelectedJob(job)}
                        >
                        <td className="px-6 py-4 text-center text-[var(--text-secondary)] font-medium">
                          {(page - 1) * LIMIT + index + 1}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-[var(--text-primary)]">{job.action}</div>
                        </td>
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {job.createdAt ? formatDate(job.createdAt) : '-'}
                        </td>
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {job.nextRetryAt ? formatDate(job.nextRetryAt) : '-'}
                        </td>
                        <td className="px-6 py-4">
                          <JobBadge status={job.status} />
                        </td>
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {job.resolvedAt ? formatDate(job.resolvedAt) : '-'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          {canExecuteJob(job) && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                runJobMutation.mutate(job._id);
                              }}
                              disabled={runJobMutation.isPending}
                              title="Thực thi"
                              className="inline-flex items-center justify-center w-7 h-7 rounded shadow-sm text-white bg-[#2e7d32] hover:bg-[#1b5e20] hover:shadow-md active:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                            >
                              <Play size={14} fill="currentColor" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
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

        {/* Detail View */}
        {selectedJob && (() => {
          const isExecutingDetail = runJobMutation.isPending && runJobMutation.variables === selectedJob._id;
          return (
            <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-8 duration-300">
              <div className={`flex flex-col gap-5 overflow-y-auto flex-1 pb-4 pr-1 transition-all duration-300 ${isExecutingDetail ? 'animate-pulse opacity-70 pointer-events-none' : ''}`}>
                {/* Header bar */}
              <div 
                style={{padding:'5px'}}
                className="relative flex items-center bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm mb-4 mt-2 px-2 sm:px-5 py-1.5"
              >
                <button
                  onClick={() => setSelectedJob(null)}
                  className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2.5 py-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-all duration-200 font-medium text-sm z-10 cursor-pointer"
                >
                  <ChevronLeft size={16} />
                  Quay lại
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] pointer-events-auto">
                    Chi tiết tác vụ
                  </h2>
                </div>
              </div>
              
              {/* Info block */}
              <div className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm">
                <div style={{ padding: '10px' }} className="flex flex-col sm:flex-row items-center justify-between gap-6 text-center sm:text-left">
                  <div className="flex flex-col sm:flex-row items-center gap-5 flex-1 min-w-0">
                    <div className="relative shrink-0 flex items-center justify-center w-16 h-16 rounded-lg bg-indigo-500/10 text-indigo-500 border border-indigo-500/20">
                      <TerminalSquare size={32} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-xl font-bold text-[var(--text-primary)] truncate">{selectedJob.action}</h3>
                      <div className="flex flex-wrap items-center gap-2 justify-center sm:justify-start mt-2">
                        <JobBadge status={selectedJob.status} />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="shrink-0 flex flex-row gap-2.5 items-center justify-center sm:justify-end">
                    {canExecuteJob(selectedJob) && (
                      <button
                      style={{padding:'5px'}}
                        disabled={runJobMutation.isPending}
                        onClick={() => {
                          runJobMutation.mutate(selectedJob._id);
                        }}
                        className="inline-flex items-center justify-center gap-2 px-5 py-2 uppercase font-semibold text-sm tracking-wide rounded shadow-sm text-white bg-[#2e7d32] hover:bg-[#1b5e20] hover:shadow-md active:shadow-sm transition-all duration-200 disabled:opacity-50 disabled:shadow-none cursor-pointer disabled:cursor-not-allowed"
                      >
                        <Play size={18} fill="currentColor" /> {isExecutingDetail ? 'Đang chạy...' : 'Thực thi'}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Detailed Info */}
              <div className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm">
                <div className="border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
                  <Info size={18} className="text-[var(--text-secondary)]" />
                  <h3 className="font-semibold text-[var(--text-primary)]">Thông tin chi tiết</h3>
                </div>
                <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-y-4 gap-x-8">
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Ngày tạo</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">{selectedJob.createdAt ? formatDate(selectedJob.createdAt) : '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Ngày cập nhật</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">{selectedJob.updatedAt ? formatDate(selectedJob.updatedAt) : '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Lần chạy gần nhất</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">{selectedJob.lastTriedAt ? formatDate(selectedJob.lastTriedAt) : '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Lần chạy tiếp theo</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">{selectedJob.nextRetryAt ? formatDate(selectedJob.nextRetryAt) : '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Thời gian hoàn tất</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">{selectedJob.resolvedAt ? formatDate(selectedJob.resolvedAt) : '-'}</span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Số lần chạy</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">
                      {selectedJob.retryCount ?? 0} {selectedJob.maxRetries ? `/ ${selectedJob.maxRetries}` : ''}
                    </span>
                  </div>
                  <div className="flex flex-col gap-1">
                    <span className="text-xs font-medium text-[var(--text-muted)] uppercase tracking-wider">Đang thực hiện bởi</span>
                    <span className="text-[var(--text-primary)] font-medium text-sm">{selectedJob.lockedBy || '-'}</span>
                  </div>
                </div>
              </div>

              {/* Payload & Error */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                <div className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm">
                  <div className="border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-primary)]">Dữ liệu (Payload)</h3>
                  </div>
                  <div className="p-4 overflow-auto max-h-[400px]">
                    {(() => {
                      const cleanPayload = getCleanedPayload(selectedJob.payload);
                      return cleanPayload ? (
                        <pre className="text-xs font-mono text-gray-300 bg-[#1e1e1e] p-4 min-h-[120px] rounded overflow-x-auto whitespace-pre-wrap">
                          {JSON.stringify(cleanPayload, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-[var(--text-muted)] italic">Không có dữ liệu</span>
                      );
                    })()}
                  </div>
                </div>

                <div className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col">
                  <div className="border-b border-[var(--border)] px-4 py-3 flex items-center gap-2">
                    <h3 className="font-semibold text-[var(--text-primary)]">Lỗi (Error Logs)</h3>
                  </div>
                  <div className="p-4 overflow-auto flex-1 max-h-[400px]">
                    {selectedJob.error ? (
                      <pre className="text-xs font-mono text-red-400 bg-[#1e1e1e] p-4 min-h-[120px] rounded overflow-x-auto whitespace-pre-wrap h-full">
                        {selectedJob.error}
                      </pre>
                    ) : (
                      <span className="text-[var(--text-muted)] italic">Không có lỗi</span>
                    )}
                  </div>
                </div>
              </div>

              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
