import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Users, Sparkles, Sun, Moon, RefreshCw, CloudSync, LogOut, Server, Menu, ClipboardList, Flag } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMemo } from 'react';
import OverviewTab from './OverviewTab';
import UsersTab from './UsersTab';
import MaintenanceTab from './MaintenanceTab';
import InfrastructureTab from './InfrastructureTab';
import AuditLogsTab from './AuditLogsTab';
import ReportsTab from './ReportsTab';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { adminApi } from '../../services/admin';
import { toast } from 'react-hot-toast';
import SocketManager from '../../components/SocketManager';
import AdminSocketManager from '../../components/AdminSocketManager';
import { AdminMobileFilter } from '../../components/admin/AdminMobileFilter';
import { MuiSelect } from '../../components/admin/MuiSelect';
import { UI_MESSAGES } from '../../constants/messages';

const CustomCloudSync = ({ className, isSpinning }: { className?: string; isSpinning?: boolean }) => (
  <svg 
    xmlns="http://www.w3.org/2000/svg" 
    viewBox="0 0 24 24" 
    fill="none" 
    stroke="currentColor" 
    strokeWidth="2" 
    strokeLinecap="round" 
    strokeLinejoin="round" 
    className={className}
  >
    <path d="M20.996 15.251A4.5 4.5 0 0 0 17.495 8h-1.79a7 7 0 1 0-12.709 5.607" />
    <g 
      style={{ transformOrigin: '12px 16px' }} 
      className={isSpinning ? 'animate-spin [animation-direction:reverse]' : ''}
    >
      <path d="m17 18-1.535 1.605a5 5 0 0 1-8-1.5" />
      <path d="M17 22v-4h-4" />
      <path d="M7 10v4h4" />
      <path d="m7 14 1.535-1.605a5 5 0 0 1 8 1.5" />
    </g>
  </svg>
);

export type AdminTab = 'overview' | 'users' | 'maintenance' | 'infrastructure' | 'auditlogs' | 'reports';

export default function AdminLayout() {
  const { user, setAdminVerified } = useAuthStore();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const [filterMode, setFilterMode] = useState<'all' | '1d' | '7d' | '30d' | '90d' | '365d' | 'this_month' | 'month' | 'year' | 'custom'>('all');

  // Cập nhật lại filterMode nếu chuyển tab mà chế độ cũ không được hỗ trợ
  useEffect(() => {
    if (activeTab === 'infrastructure') {
      if (!['this_month', 'month', 'year'].includes(filterMode)) {
        setFilterMode('this_month');
      }
    } else {
      if (['this_month', 'month'].includes(filterMode)) {
        setFilterMode('30d');
      }
    }
  }, [activeTab, filterMode]);
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState(() => (new Date().getMonth() + 1).toString());
  const [customStartDate, setCustomStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [dateError, setDateError] = useState('');
  
  // The actual dates sent to the API
  const [effectiveDates, setEffectiveDates] = useState<{ start?: string, end?: string }>({});

  useEffect(() => {
    if (filterMode === 'custom') {
      // Do nothing automatically when switching to custom, wait for Apply button
      return;
    }
    
    if (filterMode === 'all') {
      setEffectiveDates({});
      return;
    }
    
    const today = new Date();
    const formatDate = (d: Date) => d.toISOString().split('T')[0];
    const todayStr = formatDate(today);
    
    if (filterMode === '1d') {
      setEffectiveDates({ start: todayStr, end: todayStr });
    } else if (filterMode === '7d') {
      const past = new Date(today);
      past.setDate(past.getDate() - 6);
      setEffectiveDates({ start: formatDate(past), end: todayStr });
    } else if (filterMode === '30d') {
      const past = new Date(today);
      past.setDate(past.getDate() - 29);
      setEffectiveDates({ start: formatDate(past), end: todayStr });
    } else if (filterMode === '90d') {
      const past = new Date(today);
      past.setDate(past.getDate() - 89);
      setEffectiveDates({ start: formatDate(past), end: todayStr });
    } else if (filterMode === '365d') {
      const past = new Date(today);
      past.setDate(past.getDate() - 364);
      setEffectiveDates({ start: formatDate(past), end: todayStr });
    } else if (filterMode === 'year') {
      const year = parseInt(selectedYear);
      const endStr = year === today.getFullYear() ? todayStr : `${selectedYear}-12-31`;
      setEffectiveDates({ start: `${selectedYear}-01-01`, end: endStr });
    } else if (filterMode === 'this_month') {
      const firstDay = new Date(today.getFullYear(), today.getMonth(), 1);
      // Giữ nguyên múi giờ local khi format (tránh lùi ngày do UTC)
      const firstDayStr = `${firstDay.getFullYear()}-${String(firstDay.getMonth() + 1).padStart(2, '0')}-01`;
      setEffectiveDates({ start: firstDayStr, end: todayStr });
    } else if (filterMode === 'month') {
      const year = parseInt(selectedYear);
      const month = parseInt(selectedMonth) - 1;
      const firstDayStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
      
      let lastDayStr;
      if (year === today.getFullYear() && month === today.getMonth()) {
        lastDayStr = todayStr;
      } else {
        const lastDay = new Date(year, month + 1, 0);
        lastDayStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay.getDate()).padStart(2, '0')}`;
      }
      setEffectiveDates({ start: firstDayStr, end: lastDayStr });
    }
  }, [filterMode, selectedYear, selectedMonth]);

  const handleApplyCustomDates = () => {
    if (customStartDate && customEndDate) {
      if (customEndDate < customStartDate) {
        setDateError('Thời gian đến không được nhỏ hơn thời gian bắt đầu');
        return;
      }
      const start = new Date(customStartDate);
      const end = new Date(customEndDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      
      if (diffDays > 365) {
        setDateError('Chỉ được phép chọn tối đa 1 năm (365 ngày)');
      } else {
        setDateError('');
        setEffectiveDates({ start: customStartDate, end: customEndDate });
      }
    }
  };

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  const handleLogoutAdmin = () => {
    setAdminVerified(false);
    navigate('/');
  };

  const renderDateFilters = (mode: 'desktop' | 'mobile') => {
    const inputClass = mode === 'mobile'
      ? "w-full bg-transparent border border-[var(--border)] text-[var(--text-primary)] rounded h-[40px] px-3 text-[14px] outline-none focus:border-[#1976d2] focus:ring-1 focus:ring-[#1976d2] transition-colors"
      : "bg-transparent border border-[var(--border)] text-[var(--text-primary)] rounded h-[36px] px-3 text-[14px] outline-none focus:border-[#1976d2] focus:ring-1 focus:ring-[#1976d2] transition-colors cursor-pointer w-[120px]";

    const labelBgColor = mode === 'mobile' ? 'var(--bg-card)' : 'var(--bg-header)';
    const selectHeight = mode === 'mobile' ? '40px' : '36px';

    const filterModeOptions = activeTab === 'infrastructure' ? [
      { value: 'this_month', label: 'Tháng này' },
      { value: 'month', label: 'Chọn tháng' },
      { value: 'year', label: 'Chọn năm' },
    ] : [
      { value: 'all', label: 'Tất cả' },
      { value: '1d', label: 'Hôm nay' },
      { value: '7d', label: '7 ngày' },
      { value: '30d', label: '30 ngày' },
      { value: '90d', label: '3 tháng' },
      { value: '365d', label: '1 năm' },
      { value: 'year', label: 'Theo năm' },
      { value: 'custom', label: 'Khác' },
    ];

    const monthOptions = Array.from({ length: 12 }, (_, i) => ({
      value: String(i + 1),
      label: `Tháng ${i + 1}`
    }));

    const yearOpts = yearOptions.map(year => ({
      value: year,
      label: `Năm ${year}`
    }));

    return (
      <>
        <MuiSelect
          value={filterMode}
          onChange={(v) => setFilterMode(v as any)}
          options={filterModeOptions}
          minWidth={mode === 'mobile' ? '100%' : 100}
          labelBgColor={labelBgColor}
          height={selectHeight}
        />

        {filterMode === 'month' && (
          <>
            <MuiSelect
              value={selectedMonth}
              onChange={setSelectedMonth}
              options={monthOptions}
              minWidth={mode === 'mobile' ? '100%' : 100}
              labelBgColor={labelBgColor}
              height={selectHeight}
            />
            <MuiSelect
              value={selectedYear}
              onChange={setSelectedYear}
              options={yearOpts}
              minWidth={mode === 'mobile' ? '100%' : 100}
              labelBgColor={labelBgColor}
              height={selectHeight}
            />
          </>
        )}

        {filterMode === 'year' && (
          <MuiSelect
            value={selectedYear}
            onChange={setSelectedYear}
            options={yearOpts}
            minWidth={mode === 'mobile' ? '100%' : 120}
            labelBgColor={labelBgColor}
            height={selectHeight}
          />
        )}

        {filterMode === 'custom' && (
          <div className={mode === 'mobile' ? 'flex flex-col gap-3 relative' : 'flex items-center gap-2 relative'}>
            <input 
              type="date" 
              style={{paddingLeft:'7px'}}
              value={customStartDate} 
              onChange={(e) => {
                setCustomStartDate(e.target.value);
                if (e.target.value && customEndDate && customEndDate < e.target.value) setDateError('Thời gian đến không được nhỏ hơn thời gian bắt đầu');
                else setDateError('');
              }}
              className={inputClass}
            />
            {mode === 'desktop' && <div className="w-2 h-[2px] rounded-full bg-[var(--border)]"></div>}
            <input 
              style={{paddingLeft:'7px'}}
              type="date" 
              value={customEndDate} 
              onChange={(e) => {
                setCustomEndDate(e.target.value);
                if (customStartDate && e.target.value && e.target.value < customStartDate) setDateError('Thời gian đến không được nhỏ hơn thời gian bắt đầu');
                else setDateError('');
              }}
              className={inputClass}
            />
            <button
              style={{padding:' 0 15px', cursor:'pointer'}}

              onClick={() => { handleApplyCustomDates(); if (mode === 'mobile') setIsMobileFilterOpen(false); }}
              className={`bg-indigo-600 hover:bg-indigo-700 text-white font-medium shadow-md shadow-indigo-500/30 active:scale-95 transition-all duration-300 flex items-center justify-center px-4 ${mode === 'mobile' ? 'h-10 rounded-lg w-full mt-2' : 'h-[36px] rounded text-[14px] ml-1 hover:shadow-lg hover:shadow-indigo-500/40'}`}
            >
              Áp dụng
            </button>
            {dateError && (
              <div className={`absolute left-0 text-red-500 text-xs font-medium bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded border border-red-100 dark:border-red-500/20 shadow-sm z-10 ${mode === 'mobile' ? 'relative mt-2 text-center' : 'top-full mt-2 whitespace-nowrap'}`}>
                {dateError}
              </div>
            )}
          </div>
        )}
      </>
    );
  };

  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Dọn dẹp Cache khi rời khỏi trang Admin
  useEffect(() => {
    return () => {
      queryClient.removeQueries({ queryKey: ['admin_overview'] });
      queryClient.removeQueries({ queryKey: ['admin_chart'] });
      queryClient.removeQueries({ queryKey: ['admin_health'] });
      queryClient.removeQueries({ queryKey: ['admin_users'] });
      queryClient.removeQueries({ queryKey: ['admin_jobs'] });
      queryClient.removeQueries({ queryKey: ['admin_audit_logs'] });
      queryClient.removeQueries({ queryKey: ['admin_reports'] });
    };
  }, [queryClient]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Chỉ làm mới dữ liệu của Tab đang mở
    if (activeTab === 'overview') {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin_overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin_chart'] })
      ]);
    } else if (activeTab === 'users') {
      await queryClient.invalidateQueries({ queryKey: ['admin_users'] });
    } else if (activeTab === 'infrastructure') {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin_overview'] }),
        queryClient.invalidateQueries({ queryKey: ['admin_health'] })
      ]);
    } else if (activeTab === 'maintenance') {
      await queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
    } else if (activeTab === 'reports') {
      await queryClient.invalidateQueries({ queryKey: ['admin_reports'] });
    } else if (activeTab === 'auditlogs') {
      await queryClient.invalidateQueries({ queryKey: ['admin_audit_logs'] });
    }

    toast.success(UI_MESSAGES.admin.refreshSuccess);
    setIsRefreshing(false);
  };

  const syncMutation = useMutation({
    mutationFn: adminApi.syncStats,
    onSuccess: () => {
      toast.success(UI_MESSAGES.admin.syncSuccess);
      handleRefresh(); // Tự động làm mới UI sau khi sync
    },
    onError: () => toast.error(UI_MESSAGES.admin.syncFailed)
  });

  return (
    <div className="flex w-full h-screen bg-[var(--bg-primary)] overflow-hidden">
      <AdminSocketManager  />
      
      {/* Mobile Backdrop */}
      <div 
        className={`md:hidden fixed inset-0 bg-black/50 z-[90] transition-opacity duration-300 ease-in-out ${isMobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsMobileMenuOpen(false)}
      />

      {/* Sidebar */}
      <aside className={`w-[260px] flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border)] shadow-sm shrink-0 fixed md:relative z-[100] h-full transition-transform duration-300 ease-in-out ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        <div 
          style={{padding:'10px', height:'60px'}}
          className="flex items-center gap-3 w-full pl-7 pr-4 py-6 border-b border-[var(--border)]">
          {user?.avatar ? (
            <img src={typeof user.avatar === 'object' ? user.avatar.url : user.avatar} className="w-11 h-11 rounded-full object-cover border border-[var(--border)] shadow-md shrink-0" alt="Admin Avatar" />
          ) : (
            <div className="w-11 h-11 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/20 shrink-0">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
          )}
          <div className="flex-1 overflow-hidden">
            <h2 className="text-[var(--text-primary)] font-semibold truncate text-[15px]">{user?.name}</h2>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
              <span className="text-xs text-[var(--text-secondary)] font-medium truncate">{user?.role}</span>
            </div>
          </div>
        </div>

        <nav className="flex-1 flex flex-col items-center gap-2 pt-4 overflow-y-auto w-full">
          <button
            onClick={() => { setActiveTab('overview'); setIsMobileMenuOpen(false); }}

            className={`flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg transition-all duration-200 border-none cursor-pointer ${
              activeTab === 'overview' 
                ? 'bg-transparent !text-[var(--accent-primary)] font-semibold' 
                : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <LayoutDashboard size={20} className="shrink-0" />
            <span className="text-[15px] font-medium">Tổng quan</span>
          </button>
          
          <button

            onClick={() => { setActiveTab('users'); setIsMobileMenuOpen(false); }}

            className={`flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg transition-all duration-200 border-none cursor-pointer ${
              activeTab === 'users' 
                ? 'bg-transparent !text-[var(--accent-primary)] font-semibold' 
                : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Users size={20} className="shrink-0" />
            <span className="text-[15px] font-medium">Quản lý người dùng</span>
          </button>
          
          

          <button
            onClick={() => { setActiveTab('infrastructure'); setIsMobileMenuOpen(false); }}

            className={`flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg transition-all duration-200 border-none cursor-pointer ${
              activeTab === 'infrastructure' 
                ? 'bg-transparent !text-[var(--accent-primary)] font-semibold' 
                : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Server size={20} className="shrink-0" />
            <span className="text-[15px] font-medium">Cơ sở hạ tầng</span>
          </button>
          
          <button

            onClick={() => { setActiveTab('maintenance'); setIsMobileMenuOpen(false); }}
            className={`flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg transition-all duration-200 border-none cursor-pointer ${
              activeTab === 'maintenance' 
                ? 'bg-transparent !text-[var(--accent-primary)] font-semibold' 
                : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Sparkles size={20} className="shrink-0" />
            <span className="text-[15px] font-medium">Xử lí tác vụ lỗi</span>
          </button>

          <button
            onClick={() => { setActiveTab('reports'); setIsMobileMenuOpen(false); }}
            className={`flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg transition-all duration-200 border-none cursor-pointer ${
              activeTab === 'reports' 
                ? 'bg-transparent !text-[var(--accent-primary)] font-semibold' 
                : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
            }`}
          >
            <Flag size={20} className="shrink-0" />
            <span className="text-[15px] font-medium">Báo cáo vi phạm</span>
          </button>

          {user?.role === 'SUPER_ADMIN' && (
            <button
              onClick={() => { setActiveTab('auditlogs'); setIsMobileMenuOpen(false); }}
              className={`flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg transition-all duration-200 border-none cursor-pointer ${
                activeTab === 'auditlogs' 
                  ? 'bg-transparent !text-[var(--accent-primary)] font-semibold' 
                  : 'bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]'
              }`}
            >
              <ClipboardList size={20} className="shrink-0" />
              <span className="text-[15px] font-medium">Audit Logs</span>
            </button>
          )}
        </nav>

        <div className="flex flex-col items-center gap-2 w-full pt-2 pb-4 border-t border-[var(--border)]">
          <button

            onClick={toggleTheme}
            className="flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg border-none cursor-pointer bg-transparent text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-all duration-200"
          >
            {isDark ? <Sun size={20} className="shrink-0" /> : <Moon size={20} className="shrink-0" />}
            <span className="text-[15px] font-medium">{isDark ? 'Chế độ sáng' : 'Chế độ tối'}</span>
          </button>
          <button
            onClick={handleLogoutAdmin}

            className="flex items-center justify-start w-[228px] h-[44px] gap-3 pl-7 pr-4 rounded-lg border-none cursor-pointer bg-transparent text-[var(--text-muted)] hover:bg-[rgba(220,38,38,0.1)] hover:text-[var(--error)] transition-all duration-200"
          >
            <LogOut size={20} className="shrink-0" />
            <span className="text-[15px] font-medium">Thoát Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main  className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header style={{padding:'0 20px 0 20px'}} className="h-[60px] sticky top-0 z-50 bg-[var(--bg-header)] backdrop-blur-md border-b border-[var(--border)] md:px-8 flex items-center justify-between shrink-0 gap-2">
          <div className="flex items-center gap-2 md:gap-3 w-auto md:w-[180px] shrink-0">
            <button 
              className="md:hidden p-1.5 -ml-1.5 text-[var(--text-secondary)] hover:text-[var(--text-primary)] rounded-lg active:bg-[var(--bg-primary)] transition-colors"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
            <h1 className="text-lg md:text-xl font-bold text-[var(--text-primary)] truncate">
              {activeTab === 'overview' && 'Trang tổng quan'}
              {activeTab === 'users' && 'Quản lý người dùng'}
              {activeTab === 'reports' && 'Báo cáo vi phạm'}
              {activeTab === 'auditlogs' && 'Audit Logs'}
              {activeTab === 'infrastructure' && 'Cơ sở hạ tầng'}
              {activeTab === 'maintenance' && 'Xử lí tác vụ lỗi'}
            </h1>
          </div>
          <div className="flex flex-wrap items-center gap-2 md:gap-4 flex-1 justify-end min-[1050px]:justify-between">
            {activeTab === 'overview' || activeTab === 'infrastructure' ? (
              <>
                <div
                className="max-[1050px]:hidden min-[1050px]:flex flex-wrap items-center justify-end gap-2 min-[1050px]:gap-3 relative w-auto">
                  {renderDateFilters('desktop')}
                </div>
                
                <AdminMobileFilter 
                  isOpen={isMobileFilterOpen} 
                  onToggle={() => setIsMobileFilterOpen(!isMobileFilterOpen)}
                >
                  {renderDateFilters('mobile')}
                </AdminMobileFilter>
              </>
            ) : <div />}
            
            <div className="flex items-center gap-6 md:gap-4">
              {activeTab === 'infrastructure' && (
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || isRefreshing}
                  className="flex items-center justify-center gap-2 px-3 h-10 md:h-9 !rounded-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                  title="Đồng bộ dữ liệu"
                >
                  <CustomCloudSync className="w-[20px] h-[20px] md:w-[16px] md:h-[16px]" isSpinning={syncMutation.isPending} />
                  <span className="font-medium text-sm hidden md:block">Đồng bộ</span>
                </button>
              )}

              <button
                onClick={handleRefresh}
                disabled={isRefreshing || syncMutation.isPending}
                className="flex items-center justify-center gap-2 px-3 h-10 md:h-9 !rounded-sm hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 text-[var(--text-primary)] active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-[20px] h-[20px] md:w-[16px] md:h-[16px] ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="font-medium text-sm hidden md:block">Làm mới</span>
              </button>
          </div>
        </div>
        </header>

        {/* Tab Content (Scrollable) */}
        <div className="flex-1 overflow-y-auto " style={{padding:'7px'}}>
          {activeTab === 'overview' && <OverviewTab startDate={effectiveDates.start} endDate={effectiveDates.end} />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'reports' && <ReportsTab />}
          {activeTab === 'auditlogs' && <AuditLogsTab />}
          {activeTab === 'infrastructure' && <InfrastructureTab startDate={effectiveDates.start} endDate={effectiveDates.end} filterMode={filterMode} />}
          {activeTab === 'maintenance' && <MaintenanceTab />}
        </div>
      </main>
    </div>
  );
}
