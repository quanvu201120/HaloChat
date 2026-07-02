import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { adminApi, type CleanupJob } from '../../services/admin';
import { Server, Database, Cloud, Activity, Play, Settings, TerminalSquare, X, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function MaintenanceTab() {
  const queryClient = useQueryClient();
  const [selectedJob, setSelectedJob] = useState<CleanupJob | null>(null);

  const { data: health, isLoading: isHealthLoading, refetch: refetchHealth } = useQuery({
    queryKey: ['admin_health'],
    queryFn: adminApi.getHealth,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
  });

  const { data: jobs, isLoading: isJobsLoading } = useQuery({
    queryKey: ['admin_jobs'],
    queryFn: adminApi.getCleanupJobs,
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchInterval: 10000, // Poll every 10s for job updates
  });

  const runJobMutation = useMutation({
    mutationFn: adminApi.runJobManually,
    onSuccess: () => {
      toast.success('Đã kích hoạt chạy Job');
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
    },
    onError: () => toast.error('Lỗi khi kích hoạt Job')
  });

  const ignoreJobMutation = useMutation({
    mutationFn: adminApi.ignoreJob,
    onSuccess: () => {
      toast.success('Đã bỏ qua Job');
      queryClient.invalidateQueries({ queryKey: ['admin_jobs'] });
    },
    onError: () => toast.error('Lỗi khi bỏ qua Job')
  });

  const syncMutation = useMutation({
    mutationFn: adminApi.syncStats,
    onSuccess: () => {
      toast.success('Đồng bộ trạng thái thành công');
      refetchHealth();
    },
    onError: () => toast.error('Lỗi đồng bộ')
  });

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

  const pendingJobs = Array.isArray(jobs) ? jobs.filter(j => ['IDLE', 'PENDING_RETRY', 'FAILED'].includes(j.status)) : [];
  const logs = Array.isArray(jobs) ? jobs.filter(j => ['DONE', 'IGNORED'].includes(j.status)) : [];

  return (
    <div className="flex flex-col gap-8 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* KHU VỰC 2: Scheduled Cleanup Jobs */}
      <section>
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Pending Cleanup Jobs</h2>
        
        {isJobsLoading ? (
          <div className="h-32 bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl flex items-center justify-center shadow-sm">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-500"></div>
          </div>
        ) : pendingJobs.length === 0 ? (
          <div className="bg-[var(--bg-card)] border border-[var(--border)] border-dashed rounded-2xl p-8 text-center text-[var(--text-muted)] shadow-sm">
            <div className="inline-flex w-12 h-12 bg-[var(--bg-secondary)] rounded-full items-center justify-center mb-3">
              <CheckCircle size={24} className="text-emerald-500" />
            </div>
            <p className="font-medium">Hệ thống đang sạch sẽ, không có job nào đang chờ.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {pendingJobs.map(job => (
              <div key={job._id} className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl p-5 shadow-sm hover:border-indigo-500/50 transition-colors">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="font-bold text-[var(--text-primary)] line-clamp-1 flex-1 pr-2" title={job.name}>
                    {job.name}
                  </h3>
                  <JobBadge status={job.status} />
                </div>
                
                <div className="space-y-2 mb-6">
                  <p className="text-sm text-[var(--text-secondary)]">
                    <span className="font-medium">Trigger By:</span> {job.triggerBy || 'AUTO'}
                  </p>
                  {job.nextRunAt && (
                    <p className="text-sm text-[var(--text-secondary)]">
                      <span className="font-medium">Next Run:</span> {new Date(job.nextRunAt).toLocaleString('vi-VN')}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-4 border-t border-[var(--border)]">
                  <button 
                    onClick={() => {
                      if (confirm(`Chạy manual job ${job.name}?`)) {
                        runJobMutation.mutate(job._id);
                      }
                    }}
                    disabled={job.status === 'RUNNING'}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-100 dark:hover:bg-indigo-500/20 font-medium rounded-lg transition-colors disabled:opacity-50"
                  >
                    <Play size={16} />
                    Run Manually
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Chuyển trạng thái job sang IGNORED?`)) {
                        ignoreJobMutation.mutate(job._id);
                      }
                    }}
                    disabled={job.status === 'RUNNING'}
                    className="flex-none p-2 text-[var(--text-muted)] hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] rounded-lg transition-colors disabled:opacity-50 tooltip"
                    title="Bỏ qua (Ignore)"
                  >
                    <Settings size={20} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* KHU VỰC 3: Execution Logs */}
      <section className="flex-1 min-h-[400px] flex flex-col">
        <h2 className="text-xl font-bold text-[var(--text-primary)] mb-4">Job Execution Logs</h2>
        
        <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-2xl shadow-sm flex-1 flex flex-col overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[var(--bg-secondary)] border-b border-[var(--border)] text-[var(--text-secondary)] text-sm">
                  <th className="px-6 py-4 font-medium w-[300px]">Tên Job</th>
                  <th className="px-6 py-4 font-medium">Người kích hoạt</th>
                  <th className="px-6 py-4 font-medium">Thời gian hoàn thành</th>
                  <th className="px-6 py-4 font-medium">Trạng thái</th>
                  <th className="px-6 py-4 font-medium text-right">Chi tiết</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-8 text-center text-[var(--text-muted)]">
                      Chưa có lịch sử chạy Job nào.
                    </td>
                  </tr>
                ) : (
                  logs.map(job => (
                    <tr key={job._id} className="border-b border-[var(--border)] hover:bg-[var(--bg-card-hover)] transition-colors">
                      <td className="px-6 py-4 font-medium text-[var(--text-primary)]">{job.name}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">{job.triggerBy || 'AUTO'}</td>
                      <td className="px-6 py-4 text-[var(--text-secondary)]">
                        {job.lastRunAt ? new Date(job.lastRunAt).toLocaleString('vi-VN') : '-'}
                      </td>
                      <td className="px-6 py-4">
                        <JobBadge status={job.status} />
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button 
                          onClick={() => setSelectedJob(job)}
                          className="p-2 text-[var(--text-muted)] hover:text-indigo-500 hover:bg-indigo-50 dark:hover:bg-indigo-500/10 rounded-lg transition-colors inline-flex items-center"
                        >
                          <TerminalSquare size={18} />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Terminal Drawer (Mocked as Modal for simplicity) */}
      {selectedJob && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 lg:justify-end lg:p-0 bg-black/50 backdrop-blur-sm animate-in fade-in">
          <div className="bg-[#1e1e1e] w-full lg:w-[600px] h-full max-h-[80vh] lg:max-h-full rounded-2xl lg:rounded-none lg:rounded-l-2xl shadow-2xl flex flex-col border-l border-white/10 animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-[#252526]">
              <div className="flex items-center gap-2 text-white">
                <TerminalSquare size={18} className="text-indigo-400" />
                <span className="font-mono text-sm font-semibold truncate max-w-[300px]">Logs: {selectedJob.name}</span>
              </div>
              <button 
                onClick={() => setSelectedJob(null)}
                className="text-gray-400 hover:text-white p-1 rounded hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="flex-1 p-4 overflow-y-auto font-mono text-sm text-gray-300">
              <div className="text-indigo-400 mb-2">$ cat job_details.json</div>
              <pre className="whitespace-pre-wrap break-words">
                {JSON.stringify(selectedJob, null, 2)}
              </pre>
              <div className="mt-4 text-emerald-400"># Process exited with code 0</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Sub components
function HealthCard({ title, value, icon }: any) {
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 flex items-center gap-4 shadow-sm">
      <div className="p-3 bg-[var(--bg-secondary)] rounded-lg">
        {icon}
      </div>
      <div>
        <div className="text-xs font-medium text-[var(--text-secondary)] uppercase tracking-wider mb-1">{title}</div>
        <div className="text-lg font-bold text-[var(--text-primary)]">{value}</div>
      </div>
    </div>
  );
}

function PingCard({ name, data, icon }: any) {
  const isOnline = data.status === 'online';
  const isPending = data.status === 'pending';
  
  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border)] rounded-xl p-4 shadow-sm flex items-center justify-between">
      <div className="flex items-center gap-3">
        <div className={`relative flex items-center justify-center w-8 h-8 rounded-full ${
          isOnline ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400' 
          : isPending ? 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
          : 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400'
        }`}>
          {icon}
          {isOnline && (
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[var(--bg-card)]"></span>
          )}
        </div>
        <div>
          <div className="font-semibold text-[var(--text-primary)] text-sm">{name}</div>
          <div className="text-xs text-[var(--text-secondary)]">{isOnline ? `${data.ping}ms ping` : isPending ? 'Checking...' : 'Disconnected'}</div>
        </div>
      </div>
      <div className={`text-xs font-bold px-2.5 py-1 rounded-full ${
        isOnline ? 'bg-emerald-50 dark:bg-emerald-900/10 text-emerald-600 dark:text-emerald-400' 
        : isPending ? 'bg-gray-100 dark:bg-gray-800/50 text-gray-500 dark:text-gray-400'
        : 'bg-red-50 dark:bg-red-900/10 text-red-600 dark:text-red-400'
      }`}>
        {isOnline ? 'ONLINE' : isPending ? 'PENDING' : 'OFFLINE'}
      </div>
    </div>
  );
}

function JobBadge({ status }: { status: string }) {
  const styles: any = {
    'IDLE': 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700',
    'RUNNING': 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 animate-pulse',
    'PENDING_RETRY': 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    'FAILED': 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
    'IGNORED': 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400 border-gray-200 dark:border-gray-700 line-through',
    'DONE': 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
  };

  const style = styles[status] || styles['IDLE'];

  return (
    <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${style}`}>
      {status === 'RUNNING' && <RefreshCw size={10} className="inline mr-1 animate-spin" />}
      {status}
    </span>
  );
}

// Icons
function HardDriveIcon(props: any) {
  return <Server {...props} />;
}
function CheckCircle(props: any) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
      <polyline points="22 4 12 14.01 9 11.01"></polyline>
    </svg>
  );
}
