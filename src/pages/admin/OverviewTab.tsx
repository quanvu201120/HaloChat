import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { adminApi } from '../../services/admin';
import { Activity, HardDrive, TrendingUp } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { useMemo } from 'react';
import { MuiSelect } from '../../components/admin/MuiSelect';

export default function OverviewTab({ startDate, endDate }: { startDate?: string; endDate?: string }) {
  const [chartType, setChartType] = useState<'users' | 'messages' | 'activity'>('users');

  const autoTimeRange = useMemo<'daily' | 'weekly' | 'monthly' | 'yearly'>(() => {
    if (!startDate || !endDate) return 'daily';
    const start = new Date(startDate);
    const end = new Date(endDate);
    const diffTime = Math.abs(end.getTime() - start.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 90) return 'daily';
    if (diffDays <= 180) return 'weekly';
    return 'monthly';
  }, [startDate, endDate]);

  // Fetch overview data (Strictly no cache for admin panel)
  const { data: overview, isLoading } = useQuery({
    queryKey: ['admin_overview', startDate, endDate],
    queryFn: () => adminApi.getOverview(startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fetch chart data (Strictly no cache)
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['admin_chart', chartType, autoTimeRange, startDate, endDate],
    queryFn: () => adminApi.getChartData(autoTimeRange, chartType === 'activity' ? 'users' : chartType, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const fallbackOverview = {
    totals: { users: 0, logins: 0, messages: 0, conversations: 0, groups: 0, directs: 0, activeUsers: 0 },
    messageBreakdown: { text: 0, image: 0, video: 0, file: 0, voice: 0 },
    metrics: { peakOnlineUsers: 0, bandwidthUsage: 0, cloudinaryBandwidth: 0, r2Bandwidth: 0, uploadCloudinary: 0, uploadR2: 0, redisPeakClients: 0, redisPeakMemoryMB: 0, newUsersToday: 0 },
    storage: { cloudinaryUsed: 0, r2Used: 0, mongoUsedMB: 0, redisRamUsed: 0, redisRamTotal: 1024 },
    limits: { database: 'Unlimited', redis: 1024, cloudinary: 'Unlimited', r2: 'Unlimited' }
  };

  const safeOverview = {
    totals: { ...fallbackOverview.totals, ...overview?.totals },
    messageBreakdown: { ...fallbackOverview.messageBreakdown, ...overview?.messageBreakdown },
    metrics: { ...fallbackOverview.metrics, ...overview?.metrics },
    storage: { ...fallbackOverview.storage, ...overview?.storage },
    limits: { ...fallbackOverview.limits, ...overview?.limits }
  };

  const formattedChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData)) return [];
    return chartData.map((d: any) => ({
      ...d,
      conversations: (d.newGroups || 0) + (d.newDirects || 0),
      users: d.newUsers || 0,
      messages: (d.messagesText || 0) + (d.messagesImage || 0) + (d.messagesVideo || 0) + (d.messagesFile || 0) + (d.messagesVoice || 0),
      bandwidth: Number((((d.uploadBytesCloudinary || 0) + (d.uploadBytesR2 || 0)) / (1024 * 1024)).toFixed(2)),
      database: d.mongoStorageBytes ? Number((d.mongoStorageBytes / (1024 * 1024)).toFixed(2)) : 0,
      logins: d.logins || 0,
      ccu: d.peakOnlineUsers || 0,
    }));
  }, [chartData]);

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-gray-900 text-white p-3 rounded-xl shadow-lg text-sm border border-gray-800">
          <p className="font-semibold mb-2 text-center text-gray-400">{label}</p>
          {payload.map((entry: any, index: number) => (
            <div key={index} className="flex items-center justify-between gap-4 mb-1">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }}></span>
                <span className="text-gray-200 capitalize">{entry.name}</span>
              </div>
              <span className="font-medium text-white">{entry.value}</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  const isFiltered = !!startDate || !!endDate;

  return (
    <div className="flex flex-col gap-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* ROW 1: TỔNG QUAN NHANH */}
      <div className="grid grid-cols-1 xl:grid-cols-2 2xl:grid-cols-4 gap-6">
        <BreakdownCard 
          title={isFiltered ? 'Người dùng mới' : 'Người dùng (Tổng)'}
          total={safeOverview.totals.users} 
          subValue={safeOverview.metrics.newUsersToday > 0 ? `+${safeOverview.metrics.newUsersToday} hôm nay` : undefined}
          isLoading={isLoading}
          data={[
            { name: 'Tài khoản Local', value: safeOverview.totals.users, color: '#3b82f6' },
            { name: 'Tài khoản bên thứ 3', value: 0, color: '#ef4444', isComingSoon: true },
          ]}
        />
        <BreakdownCard 
          title={isFiltered ? 'Hội thoại' : 'Hội thoại (Tổng)'}
          total={safeOverview.totals.conversations} 
          isLoading={isLoading}
          data={[
            { name: 'Cá nhân', value: safeOverview.totals.directs, color: '#a855f7' },
            { name: 'Nhóm', value: safeOverview.totals.groups, color: '#ec4899' },
          ]}
        />
        <BreakdownCard 
          title={isFiltered ? 'Tin nhắn' : 'Tin nhắn (Tổng)'}
          total={safeOverview.totals.messages} 
          isLoading={isLoading}
          data={[
            { name: 'Văn bản', value: safeOverview.messageBreakdown.text, color: '#60a5fa' },
            { name: 'Hình ảnh', value: safeOverview.messageBreakdown.image, color: '#c084fc' },
            { name: 'Video', value: safeOverview.messageBreakdown.video, color: '#f472b6' },
            { name: 'Tài liệu', value: safeOverview.messageBreakdown.file, color: '#fbbf24' },
            { name: 'Ghi âm', value: safeOverview.messageBreakdown.voice, color: '#34d399' },
          ]}
        />

        {/* Cột 4: Interaction Activity */}
        <div style={{ padding: '12px', minHeight: '160px' }} className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] flex flex-col h-full overflow-hidden">
          <h3 className="text-[var(--text-secondary)] font-medium text-sm mb-4">Hoạt động - Tương tác</h3>
          
          <div className="flex flex-col gap-5 justify-center flex-1">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
                <HardDrive size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--text-secondary)] mb-0.5 truncate">Đăng nhập hệ thống</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{safeOverview.totals.logins.toLocaleString()}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
                <Activity size={18} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[13px] text-[var(--text-secondary)] mb-0.5 truncate">Truy cập đồng thời (CCU)</p>
                <p className="text-lg font-bold text-[var(--text-primary)]">{safeOverview.metrics.peakOnlineUsers.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ROW 2: BIỂU ĐỒ TĂNG TRƯỞNG */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-6 shadow-sm border border-[var(--border)] w-full flex flex-col">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
            <h3 className="text-lg font-semibold text-[var(--text-primary)] flex items-center gap-2">
              <TrendingUp size={20} className="text-indigo-500" />
              Biểu đồ tăng trưởng
            </h3>
            <div className="flex gap-2">
              <MuiSelect
                value={chartType}
                onChange={(v) => setChartType(v as any)}
                options={[
                  { value: 'users', label: 'Lượng Users & Hội thoại' },
                  { value: 'messages', label: 'Lượng Tin nhắn' },
                  { value: 'activity', label: 'Hoạt động (Logins & CCU)' },
                ]}
                minWidth={220}
                labelBgColor="var(--bg-card)"
                height="34px"
              />
            </div>
          </div>

          <div className="flex-1 w-full mt-4">
            <div className="w-full h-full overflow-x-auto custom-scrollbar">
              <div style={{ minWidth: '800px', height: '350px' }}>
                {isChartLoading ? (
                  <div className="w-full h-full flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
                  </div>
                ) : formattedChartData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <TrendingUp size={20} className="opacity-50" />
                    </div>
                    <p className="text-sm font-medium">Chưa có dữ liệu thống kê cho khoảng thời gian này</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="99%" height="100%">
                    <AreaChart data={formattedChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                      <defs>
                        <linearGradient id="colorUsers" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorConversations" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#ec4899" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#ec4899" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorMessages" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorLogins" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                        </linearGradient>
                        <linearGradient id="colorCcu" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.3}/>
                          <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} padding={{ left: 20, right: 20 }} />
                      <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dx={-10} />
                      <Tooltip content={<CustomTooltip />} />
                      
                      {chartType === 'users' ? (
                        <Area type="monotone" dataKey="users" name="Người dùng mới" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorUsers)" />
                      ) : null}
                      
                      {chartType === 'users' ? (
                        <Area type="monotone" dataKey="conversations" name="Hội thoại mới" stroke="#ec4899" strokeWidth={3} fillOpacity={1} fill="url(#colorConversations)" />
                      ) : null}
                      
                      {chartType === 'messages' ? (
                        <Area type="monotone" dataKey="messages" name="Tin nhắn gửi" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorMessages)" />
                      ) : null}

                      {chartType === 'activity' ? (
                        <Area type="monotone" dataKey="logins" name="Lượt đăng nhập" stroke="#0ea5e9" strokeWidth={3} fillOpacity={1} fill="url(#colorLogins)" />
                      ) : null}

                      {chartType === 'activity' ? (
                        <Area type="monotone" dataKey="ccu" name="Truy cập đồng thời (CCU)" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorCcu)" />
                      ) : null}

                      </AreaChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </div>
          </div>
        </div>
    </div>
  );
}

function BreakdownCard({ title, total, subValue, data, isLoading }: any) {
  const hasData = data.some((d: any) => d.value > 0);
  const displayData = hasData ? data : [{ name: 'Empty', value: 1, color: '#e5e7eb' }];

  return (
    <div style={{ padding: '12px', minHeight: '160px' }} className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] flex flex-col h-full overflow-hidden">
      <div className="flex justify-between items-start mb-4">
        <h3 className="text-[var(--text-secondary)] font-medium text-sm">{title}</h3>
        <div className="flex flex-col items-end min-h-[30px]">
          {isLoading ? (
            <span className="text-xl font-bold text-[var(--text-muted)] leading-tight animate-pulse">---</span>
          ) : (
            <>
              <span className="text-xl font-bold text-[var(--text-primary)] leading-tight">{total.toLocaleString()}</span>
              {subValue && (
                <span className="text-xs font-medium text-emerald-500 mt-1 leading-tight">{subValue}</span>
              )}
            </>
          )}
        </div>
      </div>
      
      <div className="flex items-center gap-4 flex-1">
        <div className="w-[85px] h-[85px] shrink-0">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={displayData}
                cx="50%"
                cy="50%"
                innerRadius={25}
                outerRadius={38}
                paddingAngle={2}
                dataKey="value"
                stroke="none"
              >
                {displayData.map((entry: any, index: number) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                content={({ active, payload }) => {
                  if (active && payload && payload.length) {
                    const data = payload[0].payload;
                    if (data.isComingSoon || data.name === 'Empty') return null;
                    return (
                      <div className="bg-gray-900 text-white px-3 py-2 rounded-lg shadow-lg text-sm border border-gray-800">
                        <span className="font-medium">{data.name}: </span>
                        <span>{data.value.toLocaleString()}</span>
                      </div>
                    );
                  }
                  return null;
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        </div>
        
        <div className="flex-1 min-w-0 space-y-2">
          {data.map((item: any, index: number) => (
            <div key={index} className={`flex items-center justify-between text-[13px] ${item.isComingSoon ? 'opacity-50' : ''}`}>
              <div className="flex items-center gap-2 truncate">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                <span className="text-[var(--text-secondary)] truncate">
                  {item.name} {item.isComingSoon && <span className="text-[11px] italic hidden 2xl:inline">(Soon)</span>}
                </span>
              </div>
              <span className="font-medium text-[var(--text-primary)] ml-2 shrink-0">
                {item.isComingSoon ? '-' : item.value.toLocaleString()}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
