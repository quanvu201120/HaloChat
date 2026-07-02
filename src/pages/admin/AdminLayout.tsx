import { useState, useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, LayoutDashboard, Users, Settings, Sun, Moon, RefreshCw, LogOut, Server } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
import { useMemo } from 'react';
import OverviewTab from './OverviewTab';
import UsersTab from './UsersTab';
import MaintenanceTab from './MaintenanceTab';
import InfrastructureTab from './InfrastructureTab';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { adminApi } from '../../services/admin';
import { toast } from 'react-hot-toast';
import SocketManager from '../../components/SocketManager';

export type AdminTab = 'overview' | 'users' | 'maintenance' | 'infrastructure';

export default function AdminLayout() {
  const { user, setAdminVerified } = useAuthStore();
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');

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
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['admin_health'] }),
        queryClient.invalidateQueries({ queryKey: ['admin_jobs'] })
      ]);
    }

    toast.success('Đã làm mới dữ liệu!');
    setIsRefreshing(false);
  };

  const syncMutation = useMutation({
    mutationFn: adminApi.syncStats,
    onSuccess: () => {
      toast.success('Đồng bộ dữ liệu thành công');
      handleRefresh(); // Tự động làm mới UI sau khi sync
    },
    onError: () => toast.error('Lỗi khi đồng bộ dữ liệu')
  });

  return (
    <div className="flex w-full h-screen bg-[var(--bg-primary)] overflow-hidden">
      <SocketManager />
      {/* Sidebar */}
      <aside className="w-[260px] flex flex-col bg-[var(--bg-sidebar)] border-r border-[var(--border)] shadow-sm shrink-0">
        <div className="p-6 pb-2">
          <div className="flex items-center gap-3 bg-gray-50 dark:bg-gray-800/50 p-3 rounded-2xl border border-gray-100 dark:border-gray-800">
            <div className="w-10 h-10 rounded-full bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-md shadow-indigo-600/20">
              {user?.name?.charAt(0)?.toUpperCase() || 'A'}
            </div>
            <div className="flex-1 overflow-hidden">
              <h2 className="text-[var(--text-primary)] font-semibold truncate text-sm">{user?.name}</h2>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span className="text-xs text-[var(--text-secondary)] font-medium">{user?.role}</span>
              </div>
            </div>
          </div>
        </div>

        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          <button
            onClick={() => setActiveTab('overview')}
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
              activeTab === 'overview' 
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20 shadow-sm' 
                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <LayoutDashboard size={20} />
            <span className="font-medium">Tổng quan</span>
          </button>
          
          <button
            onClick={() => setActiveTab('users')}
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
              activeTab === 'users' 
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20 shadow-sm' 
                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <Users size={20} />
            <span className="font-medium">Quản lý người dùng</span>
          </button>
          
          <button
            onClick={() => setActiveTab('infrastructure')}
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
              activeTab === 'infrastructure' 
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20 shadow-sm' 
                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <Server size={20} />
            <span className="font-medium">Cơ sở hạ tầng</span>
          </button>
          
          <button
            onClick={() => setActiveTab('maintenance')}
            className={`flex items-center w-full gap-3 px-4 py-3 rounded-xl transition-all duration-200 border ${
              activeTab === 'maintenance' 
                ? 'bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-100 dark:border-indigo-500/20 shadow-sm' 
                : 'border-transparent text-[var(--text-secondary)] hover:bg-[var(--bg-card-hover)]'
            }`}
          >
            <Settings size={20} />
            <span className="font-medium">Bảo trì hệ thống</span>
          </button>
        </nav>

        <div className="p-4 border-t border-[var(--border)]">
          <button
            onClick={handleLogoutAdmin}
            className="flex items-center w-full gap-3 px-4 py-3 rounded-xl text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Thoát Admin</span>
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-full overflow-hidden relative">
        {/* Header */}
        <header style={{padding:'0 20px 0 20px'}} className="h-[72px] sticky top-0 z-10 bg-[var(--bg-header)] backdrop-blur-md border-b border-[var(--border)] px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center w-[180px] shrink-0">
            <h1 className="text-xl font-bold text-[var(--text-primary)]">
              {activeTab === 'overview' && 'Trang tổng quan'}
              {activeTab === 'users' && 'Quản lý người dùng'}
              {activeTab === 'infrastructure' && 'Cơ sở hạ tầng'}
              {activeTab === 'maintenance' && 'Bảo trì hệ thống'}
            </h1>
          </div>
          <div className="flex items-center gap-4 flex-1 justify-between">
            {activeTab === 'overview' || activeTab === 'infrastructure' ? (
              <div className="flex flex-wrap items-center gap-3 relative">
                <select 
                  value={filterMode} 
                  onChange={(e) => setFilterMode(e.target.value as any)}
                  className="bg-[var(--bg-primary)] border border-gray-300 dark:border-gray-600 text-[var(--text-primary)] !rounded-sm h-9 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm cursor-pointer"
                >
                  {activeTab === 'infrastructure' ? (
                    <>
                      <option value="this_month">Tháng này</option>
                      <option value="month">Chọn tháng</option>
                      <option value="year">Chọn năm</option>
                    </>
                  ) : (
                    <>
                      <option value="all">Tất cả</option>
                      <option value="1d">Hôm nay</option>
                      <option value="7d">7 ngày</option>
                      <option value="30d">30 ngày</option>
                      <option value="90d">3 tháng</option>
                      <option value="365d">1 năm</option>
                      <option value="year">Theo năm</option>
                      <option value="custom">Tùy chọn khác</option>
                    </>
                  )}
                </select>

                {filterMode === 'month' && (
                  <>
                    <select 
                      value={selectedMonth} 
                      onChange={(e) => setSelectedMonth(e.target.value)}
                      className="bg-[var(--bg-primary)] border border-gray-300 dark:border-gray-600 text-[var(--text-primary)] !rounded-sm h-9 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      {Array.from({ length: 12 }, (_, i) => i + 1).map(m => (
                        <option key={m} value={m}>Tháng {m}</option>
                      ))}
                    </select>
                    <select 
                      value={selectedYear} 
                      onChange={(e) => setSelectedYear(e.target.value)}
                      className="bg-[var(--bg-primary)] border border-gray-300 dark:border-gray-600 text-[var(--text-primary)] !rounded-sm h-9 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm cursor-pointer"
                    >
                      {yearOptions.map(year => (
                        <option key={year} value={year}>Năm {year}</option>
                      ))}
                    </select>
                  </>
                )}

                {filterMode === 'year' && (
                  <select 
                    value={selectedYear} 
                    onChange={(e) => setSelectedYear(e.target.value)}
                    className="bg-[var(--bg-primary)] border border-gray-300 dark:border-gray-600 text-[var(--text-primary)] !rounded-sm h-9 px-4 text-sm font-medium outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500 hover:border-indigo-400 dark:hover:border-indigo-500 transition-all duration-300 shadow-sm cursor-pointer"
                  >
                    {yearOptions.map(year => (
                      <option key={year} value={year}>Năm {year}</option>
                    ))}
                  </select>
                )}

                {filterMode === 'custom' && (
                  <div className="flex items-center gap-2 relative">
                    <input 
                      type="date" 
                      style={{paddingLeft:'10px'}}
                      value={customStartDate} 
                      onChange={(e) => {
                        setCustomStartDate(e.target.value);
                        if (e.target.value && customEndDate && customEndDate < e.target.value) setDateError('Thời gian đến không được nhỏ hơn thời gian bắt đầu');
                        else setDateError('');
                      }}
                      className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-[var(--text-primary)] !rounded-sm h-9 px-2 text-sm font-medium outline-none transition-all duration-300 shadow-sm cursor-pointer"
                    />
                    <div className="w-2 h-[2px] rounded-full bg-gray-300 dark:bg-gray-600"></div>
                    <input 
                      type="date" 
                      style={{paddingLeft:'10px'}}
                      value={customEndDate} 
                      onChange={(e) => {
                        setCustomEndDate(e.target.value);
                        if (customStartDate && e.target.value && e.target.value < customStartDate) setDateError('Thời gian đến không được nhỏ hơn thời gian bắt đầu');
                        else setDateError('');
                      }}
                      className="bg-white dark:bg-gray-900 border border-gray-300 dark:border-gray-600 hover:border-indigo-400 dark:hover:border-indigo-500 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/30 text-[var(--text-primary)] !rounded-sm h-9 px-2 text-sm font-medium outline-none transition-all duration-300 shadow-sm cursor-pointer"
                    />
                    <button
                      style={{padding:'0 15px', cursor:'pointer'}}
                      onClick={handleApplyCustomDates}
                      className=" ml-1 bg-indigo-600 hover:bg-indigo-700 text-white h-9 !rounded-sm text-sm font-semibold shadow-md shadow-indigo-500/30 hover:shadow-lg hover:shadow-indigo-500/40 active:scale-95 transition-all duration-300 flex items-center gap-1.5"
                    >
                      Áp dụng
                    </button>
                    {dateError && (
                      <div className="absolute top-full left-0 mt-2 text-red-500 text-xs font-medium bg-red-50 dark:bg-red-500/10 px-3 py-1.5 rounded border border-red-100 dark:border-red-500/20 shadow-sm whitespace-nowrap z-10">
                        {dateError}
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : <div />}
            
            <div className="flex items-center gap-4">
              {activeTab === 'infrastructure' && (
                <button
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || isRefreshing}
                  className="flex items-center justify-center gap-2 !px-5 !h-9 !rounded-sm text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 transition-all duration-300 active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
                  title="Đồng bộ dữ liệu"
                >
                  <RefreshCw size={16} className={syncMutation.isPending ? 'animate-spin' : ''} />
                  <span className="font-medium text-sm">Đồng bộ</span>
                </button>
              )}

              <button
                onClick={handleRefresh}
                disabled={isRefreshing || syncMutation.isPending}
                className="flex items-center justify-center gap-2 !px-5 !h-9 !rounded-sm hover:text-indigo-600 dark:hover:text-indigo-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-all duration-300 text-[var(--text-primary)] active:scale-95 disabled:opacity-50 disabled:active:scale-100 cursor-pointer"
              >
                <RefreshCw size={16} className={isRefreshing ? 'animate-spin' : ''} />
                <span className="font-medium text-sm">Làm mới</span>
              </button>

            <button
              onClick={toggleTheme}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-[var(--bg-card-hover)] text-[var(--text-secondary)] transition-colors"
            >
              {isDark ? <Sun size={20} /> : <Moon size={20} />}
            </button>
          </div>
        </div>
        </header>

        {/* Tab Content (Scrollable) */}
        <div style={{padding:'10px'}} className="flex-1 overflow-y-auto">
          {activeTab === 'overview' && <OverviewTab startDate={effectiveDates.start} endDate={effectiveDates.end} />}
          {activeTab === 'users' && <UsersTab />}
          {activeTab === 'infrastructure' && <InfrastructureTab startDate={effectiveDates.start} endDate={effectiveDates.end} filterMode={filterMode} />}
          {activeTab === 'maintenance' && <MaintenanceTab />}
        </div>
      </main>
    </div>
  );
}
