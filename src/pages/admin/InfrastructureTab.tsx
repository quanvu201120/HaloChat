import { useState, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { adminApi } from '../../services/admin';
import { Server, Database, Cloud, Activity, RefreshCw, TrendingUp } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';

export default function InfrastructureTab({ startDate, endDate, filterMode }: { startDate?: string, endDate?: string, filterMode?: string }) {
  const [chartType, setChartType] = useState<'database' | 'redis' | 'upload' | 'bandwidth'>('database');

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

  // Fetch chart data (Strictly no cache)
  const { data: chartData, isLoading: isChartLoading } = useQuery({
    queryKey: ['admin_infra_chart', chartType, autoTimeRange, startDate, endDate],
    queryFn: () => adminApi.getChartData(autoTimeRange, chartType, startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const formattedChartData = useMemo(() => {
    if (!chartData || !Array.isArray(chartData)) return [];
    return chartData.map((d: any) => ({
      ...d,
      database: d.mongoStorageBytes ? Number((d.mongoStorageBytes / (1024 * 1024)).toFixed(2)) : 0,
      redis: d.redisPeakMemoryBytes ? Number((d.redisPeakMemoryBytes / (1024 * 1024)).toFixed(2)) : 0,
      uploadCloudinary: d.uploadBytesCloudinary ? Number((d.uploadBytesCloudinary / (1024 * 1024)).toFixed(2)) : 0,
      uploadR2: d.uploadBytesR2 ? Number((d.uploadBytesR2 / (1024 * 1024)).toFixed(2)) : 0,
      bandwidthCloudinary: d.cloudinaryBandwidthBytes ? Number((d.cloudinaryBandwidthBytes / (1024 * 1024)).toFixed(2)) : 0,
      bandwidthR2: d.r2BandwidthBytes ? Number((d.r2BandwidthBytes / (1024 * 1024)).toFixed(2)) : 0,
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
              <span className="font-medium text-white">{entry.value} MB</span>
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  // Fetch overview data for Storage progress bars
  const { data: overview, isLoading: isOverviewLoading } = useQuery({
    queryKey: ['admin_overview', startDate, endDate],
    queryFn: () => adminApi.getOverview(startDate, endDate),
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: true,
  });

  // Fetch health data for Ping and Uptime
  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['admin_health'],
    queryFn: adminApi.getHealth,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  // Fallback for Overview
  const fallbackOverview = {
    totals: { activeUsers: 0 },
    metrics: { peakOnlineUsers: 0, bandwidthUsage: 0, cloudinaryBandwidth: 0, r2Bandwidth: 0, uploadCloudinary: 0, uploadR2: 0, redisPeakClients: 0, redisPeakMemoryMB: 0, cloudinaryCredits: 0 },
    storage: { cloudinaryUsed: 0, cloudinaryPeak: 0, r2Used: 0, r2Peak: 0, mongoUsedMB: 0, redisRamUsed: 0, redisRamTotal: 1024 },
    limits: { database: 'Unlimited', redis: 1024, cloudinary: 'Unlimited', r2: 'Unlimited' }
  };

  const safeOverview = {
    totals: { ...fallbackOverview.totals, ...overview?.totals },
    metrics: { ...fallbackOverview.metrics, ...overview?.metrics },
    storage: { ...fallbackOverview.storage, ...overview?.storage },
    limits: { ...fallbackOverview.limits, ...overview?.limits }
  };

  const redisPercent = calculatePercentage(safeOverview.storage.redisRamUsed, safeOverview.storage.redisRamTotal);

  // Fallback for Health
  const fallbackHealth = {
    backendUptime: '0s',
    redisUptime: '0s',
    services: {
      mongodb: { status: 'pending', ping: 0 },
      redis: { status: 'pending', ping: 0 },
      cloudinary: { status: 'pending', ping: 0 },
      r2: { status: 'pending', ping: 0 },
    }
  };

  const safeHealth = {
    ...fallbackHealth,
    ...health,
    services: { ...fallbackHealth.services, ...health?.services }
  };

  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  
  const isCurrentMode = 
    filterMode === 'this_month' || 
    filterMode === 'all' || 
    (!startDate && !endDate) ||
    (filterMode === 'month' && startDate?.startsWith(currentMonthStr));

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Backend API */}
        <SystemCard 
          title="Backend API (Node.js)" 
          icon={<Server size={18} />} 
          pingData={{ status: 'online', ping: 'Local' }}
          stats={[
            { label: 'Thời gian hoạt động', value: safeHealth.backendUptime, color: '#3b82f6' },
            { label: 'Máy chủ', value: 'Main App Server', color: '#8b5cf6' },
          ]}
        />

        {/* MongoDB */}
        <SystemCard 
          title="MongoDB Database" 
          icon={<Database size={18} />} 
          pingData={safeHealth.services.mongodb}
          progressData={{
            used: safeOverview.storage.mongoUsedMB,
            total: safeOverview.limits.database === 'Unlimited' ? 'Unlimited' : Math.round(Number(safeOverview.limits.database)),
            usedLabel: isCurrentMode ? 'Lưu trữ' : 'Đỉnh điểm',
            totalLabel: isCurrentMode ? 'Giới hạn' : undefined,
            hideBar: !isCurrentMode,
            valueUnit: 'MB'
          }}
          stats={[]}
        />

        {/* Redis */}
        <SystemCard 
          title="Redis Server" 
          icon={<Activity size={18} />} 
          pingData={safeHealth.services.redis} 
          progressData={{
            used: safeOverview.storage.redisRamUsed,
            total: safeOverview.storage.redisRamTotal,
            usedLabel: isCurrentMode ? 'Sử dụng' : 'Đỉnh điểm',
            totalLabel: isCurrentMode ? 'Tổng RAM' : undefined,
            hideBar: !isCurrentMode,
            valueUnit: 'MB'
          }}
          stats={[
            { label: 'Mức sử dụng cao nhất', value: `${safeOverview.metrics.redisPeakMemoryMB} MB`, color: '#f59e0b' },
          ]}
        />

        {/* Cloudinary */}
        {(() => {
          const storageCredits = safeOverview.storage.cloudinaryUsed / 1024;
          const storagePeakCredits = safeOverview.storage.cloudinaryPeak / 1024;
          const bandwidthCredits = safeOverview.metrics.cloudinaryBandwidth / 1024;
          const totalCredits = safeOverview.metrics.cloudinaryCredits;
          
          const limitCredits = safeOverview.limits.cloudinary === 'Unlimited' 
            ? 'Unlimited' 
            : Math.round(Number(safeOverview.limits.cloudinary) / 1024);

          return (
            <SystemCard 
              title="Cloudinary" 
              icon={<Cloud size={18} />} 
              pingData={safeHealth.services.cloudinary}
              progressData={{
                used: Number((totalCredits).toFixed(2)),
                total: limitCredits,
                usedLabel: isCurrentMode ? 'Đã dùng' : 'Đỉnh điểm',
                totalLabel: isCurrentMode ? 'Giới hạn' : undefined,
                hideBar: !isCurrentMode,
                valueUnit: 'Credit'
              }}
              stats={[
                ...(isCurrentMode ? [{ label: 'Lưu trữ hiện tại', value: storageCredits < 1 ? `${safeOverview.storage.cloudinaryUsed.toFixed(2)} MB` : `${storageCredits.toFixed(2)} GB`, color: '#3b82f6' }] : []),
                { label: 'Lưu trữ cao nhất', value: storagePeakCredits < 1 ? `${safeOverview.storage.cloudinaryPeak.toFixed(2)} MB` : `${storagePeakCredits.toFixed(2)} GB` },
                { label: 'Download', value: bandwidthCredits < 1 ? `${safeOverview.metrics.cloudinaryBandwidth.toFixed(2)} MB` : `${bandwidthCredits.toFixed(2)} GB`, color: '#10b981' },
                { label: 'Upload', value: safeOverview.metrics.uploadCloudinary < 1024 ? `${safeOverview.metrics.uploadCloudinary.toFixed(2)} MB` : `${(safeOverview.metrics.uploadCloudinary / 1024).toFixed(2)} GB`, color: '#f59e0b' },
              ]}
            />
          );
        })()}

        {/* Cloudflare R2 */}
        <SystemCard 
          title="Cloudflare R2" 
          icon={<HardDriveIcon size={18} />} 
          pingData={safeHealth.services.r2}
          progressData={{
            used: safeOverview.storage.r2Used < 1024 ? safeOverview.storage.r2Used : Number((safeOverview.storage.r2Used / 1024).toFixed(2)),
            total: safeOverview.limits.r2 === 'Unlimited' ? 'Unlimited' : (safeOverview.storage.r2Used < 1024 ? safeOverview.limits.r2 : Math.round(Number(safeOverview.limits.r2) / 1024)),
            usedLabel: isCurrentMode ? 'Lưu trữ' : 'Đỉnh điểm',
            totalLabel: isCurrentMode ? 'Giới hạn' : undefined,
            hideBar: !isCurrentMode,
            valueUnit: safeOverview.storage.r2Used < 1024 ? 'MB' : 'GB'
          }}
          stats={[
            ...(isCurrentMode ? [{ label: 'Lưu trữ hiện tại', value: safeOverview.storage.r2Used < 1024 ? `${safeOverview.storage.r2Used.toFixed(2)} MB` : `${(safeOverview.storage.r2Used / 1024).toFixed(2)} GB`, color: '#3b82f6' }] : []),
            { label: 'Lưu trữ cao nhất', value: safeOverview.storage.r2Peak < 1024 ? `${safeOverview.storage.r2Peak.toFixed(2)} MB` : `${(safeOverview.storage.r2Peak / 1024).toFixed(2)} GB` },
            { label: 'Upload', value: safeOverview.metrics.uploadR2 < 1024 ? `${safeOverview.metrics.uploadR2.toFixed(2)} MB` : `${(safeOverview.metrics.uploadR2 / 1024).toFixed(2)} GB`, color: '#f59e0b' },
            { label: 'Download', value: safeOverview.metrics.r2Bandwidth < 1024 ? `${safeOverview.metrics.r2Bandwidth.toFixed(2)} MB` : `${(safeOverview.metrics.r2Bandwidth / 1024).toFixed(2)} GB`, color: '#10b981' },
          ]}
        />

      </div>

      {/* Infrastructure Chart */}
      <div className="bg-[var(--bg-card)] rounded-2xl p-6 shadow-sm border border-[var(--border)] w-full flex flex-col mt-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-50 dark:bg-indigo-900/30 flex items-center justify-center text-indigo-600 dark:text-indigo-400">
              <TrendingUp size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Biểu đồ cơ sở hạ tầng</h2>
            </div>
          </div>
          <div className="flex items-center shrink-0">
            <select 
              value={chartType} 
              onChange={(e) => setChartType(e.target.value as any)}
              style={{marginRight:'5px'}}
              
              className="bg-[var(--bg-primary)] border border-[var(--border)] text-[var(--text-primary)] rounded-sm px-3 py-1.5 text-sm outline-none focus:border-indigo-500"
            >
              <option value="database">Dung lượng Database (MB)</option>
              <option value="redis">Bộ nhớ Redis (MB)</option>
              <option value="upload">Dữ liệu Upload (MB)</option>
              <option value="bandwidth">Băng thông Cloud (MB)</option>
            </select>
          </div>
        </div>

        <div className="flex-1 w-full mt-4">
          {isChartLoading ? (
            <div className="w-full h-full flex items-center justify-center min-h-[300px]">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
            </div>
          ) : (
            <div className="w-full h-full overflow-x-auto custom-scrollbar">
              <div style={{ minWidth: '800px', height: '350px' }}>
                {formattedChartData.length === 0 ? (
                  <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 gap-3 min-h-[300px]">
                    <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                      <TrendingUp size={20} className="opacity-50" />
                    </div>
                    <p className="text-sm font-medium">Chưa có dữ liệu thống kê cho khoảng thời gian này</p>
                  </div>
                ) : (
                  <ResponsiveContainer width="99%" height="100%">
                    <AreaChart data={formattedChartData} margin={{ top: 20, right: 20, left: 0, bottom: 20 }}>
                    <defs>
                      <linearGradient id="colorDatabase" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorRedis" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorCloudinary" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorR2" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f97316" stopOpacity={0.3}/>
                        <stop offset="95%" stopColor="#f97316" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dy={10} padding={{ left: 20, right: 20 }} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: 'var(--text-muted)' }} dx={-10} />
                    <Tooltip content={<CustomTooltip />} />
                    
                    {chartType === 'database' ? (
                      <Area type="monotone" dataKey="database" name="Mức sử dụng cao nhất" stroke="#f59e0b" strokeWidth={3} fillOpacity={1} fill="url(#colorDatabase)" />
                    ) : null}

                    {chartType === 'redis' ? (
                      <Area type="monotone" dataKey="redis" name="Mức sử dụng cao nhất" stroke="#ef4444" strokeWidth={3} fillOpacity={1} fill="url(#colorRedis)" />
                    ) : null}

                    {chartType === 'upload' ? (
                      <Area type="monotone" dataKey="uploadCloudinary" name="Upload Cloudinary" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCloudinary)" />
                    ) : null}

                    {chartType === 'upload' ? (
                      <Area type="monotone" dataKey="uploadR2" name="Upload Cloudflare R2" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorR2)" />
                    ) : null}

                    {chartType === 'bandwidth' ? (
                      <Area type="monotone" dataKey="bandwidthCloudinary" name="Download Cloudinary" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorCloudinary)" />
                    ) : null}

                    {chartType === 'bandwidth' ? (
                      <Area type="monotone" dataKey="bandwidthR2" name="Download Cloudflare R2" stroke="#f97316" strokeWidth={3} fillOpacity={1} fill="url(#colorR2)" />
                    ) : null}

                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ======================= SUB COMPONENTS =======================

function calculatePercentage(used: number, total: number | string) {
  if (typeof total === 'string' && total === 'Unlimited') return 0;
  if (typeof total === 'number' && total > 0) return Math.min(100, Math.round((used / total) * 100));
  return 0;
}

function getStorageChartData(used: number, total: number | string, color: string) {
  if (typeof total === 'string' && total === 'Unlimited') return null;
  if (typeof total === 'number' && total > 0) {
    const free = Math.max(0, total - used);
    return [
      { name: 'Used', value: used, color: color },
      { name: 'Free', value: free, color: '#e5e7eb' }
    ];
  }
  return null;
}

function formatLimit(limit: number | string, unit: string) {
  if (limit === 'Unlimited') return 'Không giới hạn';
  if (typeof limit === 'number' && limit >= 1024 && unit === 'MB') {
    return `${Math.round(limit / 1024)} GB`;
  }
  return `${limit} ${unit}`;
}

function SystemCard({ title, icon, pingData, progressData, chartData, stats }: any) {
  const isOnline = pingData?.status === 'online';
  const isPending = pingData?.status === 'pending';
  
  let percent = 0;
  let progressColor = 'bg-emerald-500';
  
  if (progressData) {
    percent = calculatePercentage(progressData.used, progressData.total);
    progressColor = percent > 80 ? 'bg-red-500' : percent > 60 ? 'bg-amber-500' : 'bg-emerald-500';
  }
  
  return (
    <div style={{ padding: '24px' }} className="bg-[var(--bg-card)] rounded-2xl shadow-sm border border-[var(--border)] flex flex-col h-full overflow-hidden group hover:border-indigo-500/50 transition-colors relative">
      <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-10 transition-opacity group-hover:opacity-20 ${isOnline ? 'bg-emerald-500' : isPending ? 'bg-gray-500' : 'bg-red-500'}`}></div>

      <div className="flex justify-between items-start mb-10 relative z-10">
        <h3 className="text-[var(--text-primary)] font-semibold text-base flex items-center gap-2">
          <div className="text-indigo-500">
            {icon}
          </div>
          {title}
        </h3>
        <div className="flex flex-col items-end">
          {pingData && (
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${
              isOnline ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
              : isPending ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
              : 'bg-red-50 text-red-600 dark:bg-red-900/30 dark:text-red-400'
            }`}>
              {!isPending && (
                <span className={`w-1.5 h-1.5 rounded-full ${isOnline ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`}></span>
              )}
              {isOnline ? (typeof pingData.ping === 'number' ? `${pingData.ping}ms` : pingData.ping) : isPending ? '---' : 'OFFLINE'}
            </div>
          )}
        </div>
      </div>
      
      {progressData && (
        <div style={{ marginTop: '15px', marginBottom: '15px' }} className="relative z-10">
          <div className="flex justify-between text-[14px]">
            <span className="text-[var(--text-primary)] font-medium">{progressData.usedLabel}: <span className="font-bold">{progressData.used} {progressData.valueUnit}</span></span>
            {progressData.totalLabel && (
              <span className="text-[var(--text-primary)] font-medium">{progressData.totalLabel}: <span className="font-bold">{formatLimit(progressData.total, progressData.valueUnit)}</span></span>
            )}
          </div>
          {!progressData.hideBar && (
            <div className="w-full bg-gray-100 dark:bg-gray-700/50 border border-gray-200 dark:border-gray-700 rounded-full h-3.5 overflow-hidden">
              <div className={`h-full rounded-full ${progressColor} transition-all duration-1000`} style={{ width: `${progressData.total === 'Unlimited' ? 0 : percent}%` }}></div>
            </div>
          )}
        </div>
      )}

      <div className="flex items-center gap-4 flex-1 relative z-10">
        {chartData && (
          <div className="w-[85px] h-[85px] shrink-0 flex items-center justify-center">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Tooltip 
                  formatter={(value: number, name: string) => {
                    const mbValue = Number(value);
                    if (mbValue < 1024) return [`${mbValue.toFixed(2)} MB`, name];
                    return [`${(mbValue / 1024).toFixed(2)} GB`, name];
                  }}
                  contentStyle={{ borderRadius: '8px', fontSize: '12px', border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={25}
                  outerRadius={38}
                  paddingAngle={2}
                  dataKey="value"
                  stroke="none"
                >
                  {chartData.map((entry: any, index: number) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        
        <div className="flex-1 min-w-0 space-y-4">
          {stats.map((item: any, index: number) => (
            <div key={index} className="flex items-center justify-between text-[13px]">
              <div className="flex items-center gap-2 truncate">
                {item.color ? (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: item.color }}></span>
                ) : (
                  <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-gray-300 dark:bg-gray-700"></span>
                )}
                <span className="text-[var(--text-secondary)] truncate">
                  {item.label}
                </span>
              </div>
              <span className="font-medium text-[var(--text-primary)] ml-2 shrink-0">
                {item.value}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// Icons
function HardDriveIcon(props: any) {
  return <Server {...props} />;
}
