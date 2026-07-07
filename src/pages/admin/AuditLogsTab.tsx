import { useState, useEffect, useRef, useCallback } from 'react';
import { ChevronLeft, User, Clock, Activity, Globe, Monitor, FileJson, Hash, Shield, Mail, Phone, Info, Image, Box, Database, FileText } from 'lucide-react';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { adminApi, type AuditLogData, type UserAdminData } from '../../services/admin';
import { UserRole } from '../../constants/roles';
import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';
import { MuiSelect } from '../../components/admin/MuiSelect';

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
  const [selectedLog, setSelectedLog] = useState<any>(null);
  const [actorId, setActorId] = useState<string | undefined>();
  const [targetId, setTargetId] = useState<string | undefined>();
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
    isLoading
  } = useInfiniteQuery({
    queryKey: ['admin_audit_logs', actorId, targetId, actionFilter, roleFilter, targetTypeFilter, startDate, endDate, ipFilter],
    queryFn: ({ pageParam }) => adminApi.getAuditLogs({ 
      cursor: pageParam as string | undefined,
      actorId: actorId,
      targetId: targetId,
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

        <UserAutocomplete
          label="Đối tượng thực hiện"
          value={targetId}
          onChange={setTargetId}
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
            { value: 'DELETE_AVATAR', label: 'Xóa Avatar' },
            { value: 'RESET_DISPLAY_NAME', label: 'Reset Tên hiển thị' },
            { value: 'DELETE_BIO', label: 'Xóa Tiểu sử' },
            { value: 'FORCE_LOGOUT', label: 'Buộc đăng xuất' },
            { value: 'CREATE_USER', label: 'Tạo tài khoản' },
          ]}
          minWidth={160}
          labelBgColor={labelBgColor}
        />

        <MuiSelect
          label="Vai trò (Actor Role)"
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
                <tbody>
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
                            {log.target ? (typeof log.target === 'object' ? (log.target.name || log.target.email || log.target._id) : `ID: ${log.target}`) : 'Unknown'}
                          </div>
                          <div className="text-xs text-[var(--text-muted)] mt-1">{log.targetType}</div>
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

            {/* Content */}
            <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pb-10 w-full">
                
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
                      <img src={selectedLog.actor.avatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-[var(--border)] shadow-sm" />
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
                          <img src={selectedLog.target.avatar} alt="Avatar" className="w-14 h-14 rounded-full object-cover border-2 border-[var(--border)] shadow-sm" />
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
                {selectedLog.metadata && Object.keys(selectedLog.metadata).length > 0 && (
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
                        };
                        const translatedLabel = metadataTranslations[key] || key.replace(/([A-Z])/g, ' $1').trim();

                        return (
                          <InfoItem 
                            key={key}
                            icon={<Database size={16} />}
                            label={translatedLabel}
                            value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
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
    </>
  );
}
