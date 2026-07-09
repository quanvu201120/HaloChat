import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, User, Clock, Activity, Globe, Monitor, FileJson, Hash, Shield, Phone, Image, Box, Database, FileText, AlertTriangle, MessageSquare, Gavel } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminApi, type AuditLogData, type UserAdminData } from '../../services/admin';
import { UserRole } from '../../constants/roles';
import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';
import { MuiSelect } from '../../components/admin/MuiSelect';
import MediaLightbox from '../../components/MediaLightbox';

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

// User Autocomplete Component
function UserAutocomplete({ label, value, onChange, labelBgColor = 'var(--bg-primary)' }: { label: string, value: string | undefined, onChange: (v: string | undefined) => void, labelBgColor?: string }) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 500);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ['admin_users_search', debouncedSearch],
    queryFn: () => adminApi.getUsers({ search: debouncedSearch, limit: 10 }),
    enabled: debouncedSearch.length > 0 && open,
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
          {data.items.map((opt: UserAdminData) => (
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
                background: opt._id === value ? 'rgba(25,118,210,0.12)' : 'transparent',
                color: opt._id === value ? '#1976d2' : 'var(--text-primary)',
                fontWeight: opt._id === value ? 600 : 400,
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (opt._id !== value) e.currentTarget.style.background = 'rgba(25,118,210,0.08)'; }}
              onMouseLeave={e => { if (opt._id !== value) e.currentTarget.style.background = 'transparent'; }}
            >
              <div>{opt.name || opt.email}</div>
              <div style={{fontSize: 10, color: 'var(--text-muted)'}}>{opt.email} - {opt.phone || 'N/A'}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function MuiInput({ 
  label, 
  value, 
  onChange, 
  type = 'text',
  placeholder = ' ',
  labelBgColor = 'var(--bg-primary)',
  minWidth = 140
}: { 
  label: string; 
  value: string; 
  onChange: (v: string) => void; 
  type?: string;
  placeholder?: string;
  labelBgColor?: string;
  minWidth?: number;
}) {
  return (
    <div style={{ position: 'relative', minWidth, marginBottom: '10px' }}>
      <input 
        type={type}
        placeholder={placeholder}
        style={{ padding: '2px 10px', borderRadius: '4px', height: '34px', width: '100%' }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="peer bg-transparent border border-[var(--border)] text-[var(--text-primary)] focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
      />
      <label 
        style={{ padding: '0 5px', background: labelBgColor }}
        className={`absolute pointer-events-none transition-all duration-200 z-10 whitespace-nowrap
          -translate-y-1/2 left-3
          ${type === 'date' || value !== '' 
            ? 'top-0 text-[11px] font-medium'
            : 'top-1/2 text-sm'
          }
          peer-focus:top-0 peer-focus:text-[11px] peer-focus:font-medium
          text-[var(--text-muted)] peer-focus:text-indigo-500
        `}
      >
        {label}
      </label>
      
      {value && type !== 'date' && (
        <button 
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 z-10"
        >
          ✕
        </button>
      )}
    </div>
  );
}

export default function AuditLogsTab() {
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogData | null>(null);
  const [lightboxData, setLightboxData] = useState<{ medias: any[], initialIndex: number } | null>(null);
  const [actorId, setActorId] = useState<string | undefined>();
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [targetTypeFilter, setTargetTypeFilter] = useState('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [ipFilter, setIpFilter] = useState('');

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isFetching
  } = useInfiniteQuery({
    queryKey: ['admin_audit_logs', actorId, actionFilter, roleFilter, targetTypeFilter, startDate, endDate, ipFilter],
    queryFn: ({ pageParam }) => adminApi.getAuditLogs({ 
      cursor: pageParam as string | undefined,
      actorId: actorId,
      action: actionFilter !== 'all' ? actionFilter : undefined,
      actorRole: roleFilter !== 'all' ? roleFilter.toUpperCase() : undefined,
      targetType: targetTypeFilter !== 'all' ? targetTypeFilter : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      ip: ipFilter || undefined
    }),
    initialPageParam: undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor || undefined,
  });

  const logs = data?.pages.flatMap(p => p.items) || [];

  const renderCompactUser = (user: unknown, fallback = 'Không rõ') => {
    if (!user || typeof user !== 'object' || Array.isArray(user)) {
      return (
        <span className="block text-sm font-semibold mt-0.5 break-words whitespace-normal text-[var(--text-primary)]">
          {typeof user === 'string' && user ? user : fallback}
        </span>
      );
    }

    const userData = user as { name?: string; email?: string };

    return (
      <div className="flex flex-col">
        <span className="text-sm font-semibold text-[var(--text-primary)] break-words whitespace-normal">
          {userData.name || fallback}
        </span>
        <span className="text-xs text-[var(--text-muted)] break-words whitespace-normal">
          {userData.email || 'Không có email'}
        </span>
      </div>
    );
  };

  const observer = useRef<IntersectionObserver | null>(null);
  const lastLogElementRef = useCallback((node: HTMLTableRowElement) => {
    if (isLoading || isFetchingNextPage) return;
    if (observer.current) observer.current.disconnect();
    observer.current = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting && hasNextPage) {
        fetchNextPage();
      }
    });
    if (node) observer.current.observe(node);
  }, [isLoading, isFetchingNextPage, hasNextPage, fetchNextPage]);

  const renderFilters = (idPrefix: string) => {
    const labelBgColor = idPrefix === 'mobile' ? 'var(--bg-card)' : 'var(--bg-primary)';

    return (
      <>
        <UserAutocomplete
          label="Người thực hiện"
          value={actorId}
          onChange={setActorId}
          labelBgColor={labelBgColor}
        />

        <MuiSelect
          label="Hành động"
          value={actionFilter}
          onChange={setActionFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'LOCK_USER', label: 'Khóa tài khoản' },
            { value: 'UNLOCK_USER', label: 'Mở khóa tài khoản' },
            { value: 'UPDATE_ROLE', label: 'Đổi quyền' },
            { value: 'DELETE_AVATAR', label: 'Xóa avatar' },
            { value: 'RESET_DISPLAY_NAME', label: 'Reset tên hiển thị' },
            { value: 'DELETE_BIO', label: 'Xóa tiểu sử' },
            { value: 'FORCE_LOGOUT', label: 'Buộc đăng xuất' },
            { value: 'CREATE_USER', label: 'Tạo tài khoản' },
          ]}
          minWidth={160}
          labelBgColor={labelBgColor}
        />

        <MuiSelect
          label="Vai trò"
          value={roleFilter}
          onChange={setRoleFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: UserRole.ADMIN, label: 'ADMIN' },
            { value: UserRole.SUPER_ADMIN, label: 'SUPER_ADMIN' },
          ]}
          minWidth={150}
          labelBgColor={labelBgColor}
        />

        <MuiSelect
          label="Loại đối tượng"
          value={targetTypeFilter}
          onChange={setTargetTypeFilter}
          options={[
            { value: 'all', label: 'Tất cả' },
            { value: 'User', label: 'User' },
            { value: 'Report', label: 'Report' },
          ]}
          minWidth={140}
          labelBgColor={labelBgColor}
        />

        <MuiInput
          label="Từ ngày"
          type="date"
          value={startDate}
          onChange={setStartDate}
          labelBgColor={labelBgColor}
        />

        <MuiInput
          label="Đến ngày"
          type="date"
          value={endDate}
          onChange={setEndDate}
          labelBgColor={labelBgColor}
        />

        <MuiInput
          label="Địa chỉ IP"
          value={ipFilter}
          onChange={setIpFilter}
          labelBgColor={labelBgColor}
          minWidth={160}
        />
      </>
    );
  };

  return (
    <>
      {!selectedLog && (
        <AdminMobileFilter 
          isOpen={isFilterOpen} 
          onToggle={() => setIsFilterOpen(!isFilterOpen)}
        >
          {renderFilters('mobile')}
        </AdminMobileFilter>
      )}

      <div className="flex flex-col h-full animate-in fade-in slide-in-from-bottom-4 duration-500 relative">
        <div className={`flex flex-col h-full ${selectedLog ? 'hidden' : ''} relative`}>
          <div className="max-[1050px]:hidden min-[1050px]:flex flex-row flex-wrap gap-4 mb-6 mt-2 items-center w-full">
            {renderFilters('desktop')}
          </div>

          <div className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] overflow-hidden flex-1 flex flex-col">
            <div className="overflow-x-auto overflow-y-auto flex-1">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 z-10 bg-[var(--bg-secondary)] border-b border-[var(--border)]">
                  <tr className="text-[var(--text-secondary)] text-sm">
                    <th className="px-6 py-4 font-medium w-[200px]">Thời gian</th>
                    <th className="px-6 py-4 font-medium">Người thực hiện</th>
                    <th className="px-6 py-4 font-medium">Hành động</th>
                    <th className="px-6 py-4 font-medium">Đối tượng</th>
                    <th className="px-6 py-4 font-medium">IP</th>
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
                  ) : logs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-[var(--text-muted)]">
                        Không có lịch sử Audit Log.
                      </td>
                    </tr>
                  ) : (
                    logs.map((log: AuditLogData, index) => {
                      const isLastElement = logs.length === index + 1;
                      return (
                        <tr 
                          ref={isLastElement ? lastLogElementRef : null}
                          key={log._id} 
                          onClick={() => setSelectedLog(log)}
                          className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors cursor-pointer"
                        >
                        <td className="px-6 py-4 text-[var(--text-secondary)]">
                          {new Date(log.createdAt).toLocaleString('vi-VN')}
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[var(--text-primary)]">
                            {log.actor ? (typeof log.actor === 'object' ? (log.actor.name || log.actor.email) : `ID: ${log.actor}`) : 'Unknown'}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">{log.actorRole}</div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-medium bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                            {log.action}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="font-medium text-[var(--text-primary)]">
                            <span className="inline-flex items-center px-2.5 py-1 rounded text-xs font-bold bg-[var(--bg-secondary)] text-[var(--text-primary)] border border-[var(--border)] uppercase tracking-wider">
                              {log.targetType?.toUpperCase() || 'UNKNOWN'}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-[var(--text-secondary)]">{log.ip}</div>
                        </td>
                      </tr>
                    );
                  })
                )}
                
                {isFetchingNextPage && (
                  <tr>
                    <td colSpan={5} className="px-6 py-6 text-center text-[var(--text-muted)]">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-indigo-500 mx-auto"></div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Detail View */}
        {selectedLog && (
          <div className="flex flex-col h-full animate-in fade-in slide-in-from-right-4 duration-300">
            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-10 w-full">
                {/* Header */}
              <div 
                style={{padding:'5px'}}
                className="relative flex items-center bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm mb-4 mt-2 px-2 sm:px-5 py-1.5"
              >
                <button
                  onClick={() => setSelectedLog(null)}
                  className="flex items-center gap-1 sm:gap-2 px-1 sm:px-2.5 py-1 text-[var(--text-secondary)] hover:text-indigo-600 dark:hover:text-indigo-400 rounded transition-all duration-200 font-medium text-sm z-10 cursor-pointer"
                  title="Quay lại"
                >
                  <ChevronLeft size={16} />
                  Quay lại
                </button>
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] pointer-events-auto flex items-center gap-2">
                    Chi tiết
                    
                  </h2>
                </div>
              </div>
                {/* General Info */}
                <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                  
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">
                    Thông tin chung
                  </h4>
                  <div className="flex flex-col">
                    <InfoItem 
                      icon={<Clock size={16} />}
                      label="Thời gian"
                      value={new Date(selectedLog.createdAt).toLocaleString('vi-VN')}
                    />
                    <InfoItem 
                      icon={<Activity size={16} />}
                      label="Hành động"
                    >
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-indigo-100 text-indigo-700 uppercase tracking-wider shadow-sm">
                        {selectedLog.action}
                      </span>
                    </InfoItem>
                    <InfoItem 
                      icon={<Globe size={16} />}
                      label="Địa chỉ IP"
                      value={selectedLog.ip || 'N/A'}
                      valueClass="font-mono text-[13px]"
                    />
                    <InfoItem 
                      icon={<Monitor size={16} />}
                      label="User Agent"
                      value={selectedLog.userAgent || 'N/A'}
                      valueClass="font-mono text-xs leading-relaxed"
                    />
                  </div>
                </div>

                {/* Actor Info */}
                <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">
                    Người thực hiện
                  </h4>
                  
                  <div className="flex items-center gap-4 mb-3 pb-3 border-b border-[var(--border)] px-1 mt-1">
                    {selectedLog.actor && typeof selectedLog.actor === 'object' && selectedLog.actor.avatar ? (
                      <button onClick={() => setLightboxData({ medias: [selectedLog.actor.avatar], initialIndex: 0 })} className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer border-none bg-transparent p-0">
                        <img src={typeof selectedLog.actor.avatar === 'object' ? selectedLog.actor.avatar.url : selectedLog.actor.avatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-[var(--border)] shadow-sm" />
                      </button>
                    ) : (
                      <div className="w-14 h-14 rounded-full bg-gradient-to-br from-[#1b4d7e] to-[#2c3e50] text-white flex items-center justify-center text-xl font-semibold border-2 border-[#1b4d7e] shadow-md shrink-0">
                        {selectedLog.actor && typeof selectedLog.actor === 'object' && selectedLog.actor.name ? selectedLog.actor.name.charAt(0).toUpperCase() : 'A'}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                        {selectedLog.actor && typeof selectedLog.actor === 'object' ? (selectedLog.actor.name || 'N/A') : (selectedLog.actor || 'N/A')}
                      </h3>
                      <div className="text-sm text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                        {selectedLog.actor && typeof selectedLog.actor === 'object' ? (selectedLog.actor.email || 'N/A') : 'N/A'}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col">
                    <InfoItem 
                      icon={<Shield size={16} />}
                      label="Vai trò"
                    >
                      <span className={`inline-flex items-center rounded text-[10px] font-bold text-white uppercase tracking-wider shadow-sm px-2 py-0.5 ${
                        selectedLog.actorRole === 'SUPER_ADMIN' ? 'bg-[#e74c3c]' :
                        selectedLog.actorRole === 'ADMIN' ? 'bg-[#e67e22]' :
                        'bg-[#27ae60]'
                      }`}>
                        {selectedLog.actorRole}
                      </span>
                    </InfoItem>
                    
                  </div>
                </div>

                {/* Target Info */}
                <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start lg:col-span-2">
                  <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">
                    Đối tượng tác động
                  </h4>
                  
                  {selectedLog.targetType === 'User' ? (
                    <>
                      <div className="flex items-center gap-4 mb-3 pb-3 border-b border-[var(--border)] px-1 mt-1">
                        {selectedLog.target && typeof selectedLog.target === 'object' && selectedLog.target.avatar ? (
                          <button onClick={() => setLightboxData({ medias: [selectedLog.target.avatar], initialIndex: 0 })} className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer border-none bg-transparent p-0">
                            <img src={typeof selectedLog.target.avatar === 'object' ? selectedLog.target.avatar.url : selectedLog.target.avatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-[var(--border)] shadow-sm" />
                          </button>
                        ) : (
                          <div className="w-14 h-14 rounded-full bg-gradient-to-br from-slate-500 to-slate-700 text-white flex items-center justify-center text-xl font-semibold border-2 border-slate-600 shadow-md shrink-0">
                            {selectedLog.target && typeof selectedLog.target === 'object' && selectedLog.target.name ? selectedLog.target.name.charAt(0).toUpperCase() : 'U'}
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                            {selectedLog.target && typeof selectedLog.target === 'object' ? (selectedLog.target.name || 'N/A') : (selectedLog.target || 'N/A')}
                          </h3>
                          <div className="text-sm text-[var(--text-muted)] truncate flex items-center gap-1.5 mt-0.5">
                            {selectedLog.target && typeof selectedLog.target === 'object' ? (selectedLog.target.email || 'N/A') : 'N/A'}
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                        <div className="flex flex-col">
                          <InfoItem 
                            icon={<Shield size={16} />}
                            label="Vai trò"
                          >
                            {selectedLog.target && typeof selectedLog.target === 'object' && selectedLog.target.role ? (
                              <span className={`inline-flex items-center rounded text-[10px] font-bold text-white uppercase tracking-wider shadow-sm px-2 py-0.5 ${
                                selectedLog.target.role === 'SUPER_ADMIN' ? 'bg-[#e74c3c]' :
                                selectedLog.target.role === 'ADMIN' ? 'bg-[#e67e22]' :
                                'bg-[#27ae60]'
                              }`}>
                                {selectedLog.target.role}
                              </span>
                            ) : (
                              <span className="text-[var(--text-muted)] italic text-sm font-semibold mt-0.5">Chưa xác định</span>
                            )}
                          </InfoItem>
                          <InfoItem 
                            icon={<Phone size={16} />}
                            label="Số điện thoại"
                            value={selectedLog.target && typeof selectedLog.target === 'object' ? selectedLog.target.phone : undefined}
                          />
                        </div>
                        <div className="flex flex-col">
                          <InfoItem 
                            icon={<FileText size={16} />}
                            label="Tiểu sử"
                            value={selectedLog.target && typeof selectedLog.target === 'object' ? selectedLog.target.bio : undefined}
                            placeholder="Không có tiểu sử"
                          />
                        </div>
                      </div>
                    </>
                  ) : selectedLog.targetType?.toUpperCase() === 'REPORT' ? (
                    <>
                      <div className="flex items-center gap-4 mb-3 pb-3 border-b border-[var(--border)] px-1 mt-1">
                        <div className="w-14 h-14 rounded-full bg-gradient-to-br from-red-500 to-red-700 text-white flex items-center justify-center text-xl font-semibold border-2 border-red-600 shadow-md shrink-0">
                          <Shield size={24} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="text-lg font-bold text-[var(--text-primary)] truncate">
                            Báo cáo vi phạm
                          </h3>
                          
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-5">
                        {(() => {
                          const reportData = selectedLog.metadata || {};
                          return Object.entries(reportData)
                            .filter(([key]) => ['targetId', 'rp_reason', 'rp_description', 'rp_status', 'rp_adminNote', 'rp_penaltyApplied', 'rp_reporterId', 'rp_targetUserId'].includes(key))
                            .map(([key, value]) => {
                          const targetTranslations: Record<string, string> = {
                            targetId: 'ID Báo cáo',
                            rp_reason: 'Danh mục vi phạm',
                            rp_description: 'Mô tả báo cáo vi phạm',
                            rp_status: 'Trạng thái xử lý',
                            rp_adminNote: 'Ghi chú của Admin',
                            rp_penaltyApplied: 'Hình phạt áp dụng',
                            rp_reporterId: 'Người báo cáo',
                            rp_targetUserId: 'Người bị báo cáo',
                          };
                          
                          const label = targetTranslations[key] || key.replace(/([A-Z])/g, ' $1').trim();
                          const isReportUserField = key === 'rp_reporterId' || key === 'rp_targetUserId';
                          let displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);

                          if (key === 'rp_status') {
                            const statusMap: Record<string, { label: string; className: string }> = {
                              resolved: {
                                label: 'Đã xử lý',
                                className: 'bg-emerald-100 text-emerald-700 border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/25',
                              },
                              dismissed: {
                                label: 'Từ chối',
                                className: 'bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:border-rose-500/25',
                              },
                              appeal_rejected: {
                                label: 'Kháng cáo thất bại',
                                className: 'bg-orange-100 text-orange-700 border-orange-200 dark:bg-orange-500/15 dark:text-orange-300 dark:border-orange-500/25',
                              },
                              appeal_success: {
                                label: 'Kháng cáo thành công',
                                className: 'bg-violet-100 text-violet-700 border-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:border-violet-500/25',
                              },
                            };
                            const status = statusMap[displayValue] || {
                              label: displayValue,
                              className: 'bg-[var(--bg-secondary)] text-[var(--text-primary)] border-[var(--border)]',
                            };
                            displayValue = status.label;

                            return (
                              <InfoItem
                                key={key}
                                icon={<Activity size={16} />}
                                label={label}
                              >
                                <span
                                  className={`inline-flex items-center rounded px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border shadow-sm ${status.className}`}
                                >
                                  {displayValue}
                                </span>
                              </InfoItem>
                            );
                          } else if (key === 'rp_reason') {
                            const reasonMap: Record<string, string> = {
                              spam_harassment: 'Spam / Quấy rối',
                              inappropriate_content: 'Nội dung không phù hợp',
                              impersonation: 'Mạo danh',
                              other: 'Lý do khác'
                            };
                            displayValue = reasonMap[displayValue] || displayValue;
                          } else if (key === 'penaltyApplied') {
                            if (displayValue === 'Warning sent.') {
                               displayValue = 'Cảnh cáo';
                            } else if (displayValue === 'Reset info and warning sent.') {
                               displayValue = 'Cảnh cáo (kèm xóa thông tin)';
                            } else {
                               const matchBan = displayValue.match(/(Reset info and account banned for|Account banned for) (\d+) days/i);
                               const matchMute = displayValue.match(/Muted for (\d+) days/i);
                               if (matchBan) {
                                 const days = matchBan[2];
                                 const hasReset = matchBan[1].toLowerCase().includes('reset');
                                 if (days === '36500') {
                                   displayValue = `Khóa tài khoản vĩnh viễn${hasReset ? ' (kèm xóa thông tin)' : ''}`;
                                 } else {
                                   displayValue = `Khóa tài khoản ${days} ngày${hasReset ? ' (kèm xóa thông tin)' : ''}`;
                                 }
                               } else if (matchMute) {
                                 const days = matchMute[1];
                                 if (days === '36500') {
                                   displayValue = `Cấm chat vĩnh viễn`;
                                 } else {
                                   displayValue = `Cấm chat ${days} ngày`;
                                 }
                               }
                            }
                          }

                          let IconComponent = Database;
                          if (key === 'targetId') IconComponent = Hash;
                          else if (isReportUserField) IconComponent = User;
                          else if (key === 'rp_reason') IconComponent = AlertTriangle;
                          else if (key === 'rp_description') IconComponent = FileText;
                          else if (key === 'rp_status') IconComponent = Activity;
                          else if (key === 'rp_adminNote') IconComponent = MessageSquare;
                          else if (key === 'rp_penaltyApplied') IconComponent = Gavel;

                          if (isReportUserField) {
                            return (
                              <InfoItem 
                                key={key}
                                icon={<IconComponent size={16} />}
                                label={label}
                              >
                                {renderCompactUser(value)}
                              </InfoItem>
                            );
                          }

                          return (
                            <InfoItem 
                              key={key}
                              icon={<IconComponent size={16} />}
                              label={label}
                              value={displayValue}
                              valueClass={typeof value === 'object' ? "font-mono text-[11px] break-all text-xs" : undefined}
                            />
                          );
                        })})()}
                      </div>

                      {selectedLog.metadata && (selectedLog.metadata.oldAvatar || selectedLog.metadata.oldName || selectedLog.metadata.oldBio || selectedLog.metadata.oldRole) && (
                        <div className="mt-8 pt-6 border-t border-[var(--border)]">
                          <h4 className="text-[11px] font-bold text-[var(--text-primary)] uppercase tracking-wider mb-4 opacity-80">
                            Dữ liệu tại thời điểm báo cáo
                          </h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                            <InfoItem icon={<Image size={16} />} label="Ảnh đại diện">
                              {selectedLog.metadata.oldAvatar ? (
                                <button onClick={() => setLightboxData({ medias: [selectedLog.metadata.oldAvatar], initialIndex: 0 })} className="shrink-0 hover:opacity-80 transition-opacity cursor-pointer border-none bg-transparent p-0 mt-1">
                                  <img src={typeof selectedLog.metadata.oldAvatar === 'object' ? selectedLog.metadata.oldAvatar.url : selectedLog.metadata.oldAvatar} className="w-12 h-12 rounded-full object-cover border border-[var(--border)] shadow-sm" alt="Avatar" />
                                </button>
                              ) : (
                                <img src={'https://ui-avatars.com/api/?name=' + encodeURIComponent(selectedLog.metadata.oldName || 'User') + '&background=random'} className="w-12 h-12 rounded-full object-cover shrink-0 border border-[var(--border)] shadow-sm mt-1" alt="Avatar" />
                              )}
                            </InfoItem>
                            <InfoItem icon={<User size={16} />} label="Tên hiển thị" value={selectedLog.metadata.oldName || 'Không rõ'} />
                            <InfoItem icon={<Shield size={16} />} label="Vai trò">
                              <div className="mt-1">
                                {selectedLog.metadata.oldRole === 'SUPER_ADMIN' ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#e74c3c] text-white uppercase shadow-sm">Super Admin</span>
                                ) : selectedLog.metadata.oldRole === 'ADMIN' ? (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#3498db] text-white uppercase shadow-sm">Admin</span>
                                ) : (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#95a5a6] text-white uppercase shadow-sm">User</span>
                                )}
                              </div>
                            </InfoItem>
                            <InfoItem icon={<FileText size={16} />} label="Tiểu sử" value={selectedLog.metadata.oldBio || 'Không có tiểu sử'} />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      <div className="flex flex-col">
                        <InfoItem 
                          icon={<Box size={16} />}
                          label="Loại đối tượng"
                        >
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-[#27ae60] text-white uppercase tracking-wider shadow-sm">
                            {selectedLog.targetType || 'N/A'}
                          </span>
                        </InfoItem>
                      </div>
                      <div className="flex flex-col">
                        <InfoItem 
                          icon={<FileJson size={16} />}
                          label="Giá trị"
                          value={selectedLog.target && typeof selectedLog.target === 'object' ? JSON.stringify(selectedLog.target) : (selectedLog.target || 'N/A')}
                          valueClass="font-mono text-[13px] break-all"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Metadata Info */}
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && selectedLog.targetType?.toUpperCase() !== 'REPORT' && (
                  <div style={{ padding: '10px' }} className="bg-[var(--bg-card)] rounded-sm border border-[var(--border)] shadow-sm flex flex-col justify-start lg:col-span-2">
                    <h4 className="text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider mb-2 font-semibold">
                      Dữ liệu bổ sung
                    </h4>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8">
                      {Object.entries(selectedLog.metadata).map(([key, value]) => {
                        const metadataTranslations: Record<string, string> = {
                          oldRole: 'Vai trò cũ',
                          newRole: 'Vai trò mới',
                          reason: 'Lý do',
                          oldName: 'Tên cũ',
                          newName: 'Tên mới',
                          oldAvatar: 'Ảnh đại diện cũ',
                          newAvatar: 'Ảnh đại diện mới',
                          oldBio: 'Tiểu sử cũ',
                          newBio: 'Tiểu sử mới',
                          duration: 'Thời lượng',
                          action: 'Hành động',
                          reportStatus: 'Trạng thái xử lý',
                          adminNote: 'Ghi chú của Admin',
                          penaltyDurationDays: 'Thời gian phạt (ngày)',
                          penaltyApplied: 'Hình phạt áp dụng',
                          resetAvatar: 'Xóa ảnh đại diện',
                          resetBio: 'Xóa tiểu sử',
                          resetName: 'Đặt lại tên',
                        };
                        const translatedLabel = metadataTranslations[key] || key.replace(/([A-Z])/g, ' $1').trim();

                        let displayValue = typeof value === 'object' ? JSON.stringify(value) : String(value);
                        
                        if (key === 'reportStatus') {
                          if (displayValue === 'resolved') displayValue = 'Đã xử lý';
                          else if (displayValue === 'rejected') displayValue = 'Từ chối';
                          else if (displayValue === 'pending') displayValue = 'Chờ xử lý';
                        } else if (key === 'action') {
                          if (displayValue === 'unmute') displayValue = 'Bỏ cấm chat';
                          else if (displayValue === 'clear_strike') displayValue = 'Xóa cảnh cáo';
                        } else if (key === 'resetAvatar' || key === 'resetBio' || key === 'resetName') {
                          if (displayValue === 'true') displayValue = 'Có';
                          else if (displayValue === 'false') displayValue = 'Không';
                        } else if (key === 'penaltyApplied') {
                          if (displayValue === 'Warning sent.') {
                             displayValue = 'Cảnh cáo';
                          } else if (displayValue === 'Reset info and warning sent.') {
                             displayValue = 'Cảnh cáo (kèm xóa thông tin)';
                          } else {
                             const matchBan = displayValue.match(/(Reset info and account banned for|Account banned for) (\d+) days/i);
                             const matchMute = displayValue.match(/Muted for (\d+) days/i);
                             if (matchBan) {
                               const days = matchBan[2];
                               const hasReset = matchBan[1].toLowerCase().includes('reset');
                               if (days === '36500') {
                                 displayValue = `Khóa tài khoản vĩnh viễn${hasReset ? ' (kèm xóa thông tin)' : ''}`;
                               } else {
                                 displayValue = `Khóa tài khoản ${days} ngày${hasReset ? ' (kèm xóa thông tin)' : ''}`;
                               }
                             } else if (matchMute) {
                               const days = matchMute[1];
                               if (days === '36500') {
                                 displayValue = `Cấm chat vĩnh viễn`;
                               } else {
                                 displayValue = `Cấm chat ${days} ngày`;
                               }
                             }
                          }
                        }

                        return (
                          <InfoItem 
                            key={key}
                            icon={<Database size={16} />}
                            label={translatedLabel}
                            value={displayValue}
                          />
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      
      {lightboxData && (
        <MediaLightbox
          medias={lightboxData.medias}
          initialIndex={lightboxData.initialIndex}
          onClose={() => setLightboxData(null)}
        />
      )}
    </>
  );
}
