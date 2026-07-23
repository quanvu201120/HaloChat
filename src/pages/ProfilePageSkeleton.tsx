import { ChevronLeft } from 'lucide-react';

type ProfilePageSkeletonProps = {
  onBack: () => void;
};

export default function ProfilePageSkeleton({ onBack }: ProfilePageSkeletonProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', paddingBottom: '32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <button
          className="icon-btn mobile-back-btn"
          onClick={onBack}
          title="Quay lại"
        >
          <ChevronLeft size={24} />
        </button>
        <div style={{paddingLeft:'15px'}}>

          <h1 style={{ fontSize: '26px', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Hồ sơ cá nhân
          </h1>
          <p style={{ color: 'var(--text-muted)', fontSize: '14px' }}>
            Quản lý thông tin tài khoản của bạn
          </p>
        </div>
      </div>

      <div className="profile-section">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card profile-card-info" style={{ height: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="w-24 h-24 bg-gray-200 dark:bg-gray-700 rounded-full mt-2 animate-pulse" />
            <div className="h-6 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-4 animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 mt-2 animate-pulse" />
            <div className="w-16 h-5 bg-gray-200 dark:bg-gray-700 rounded mt-2 animate-pulse" />
            <div className="divider" style={{ width: '100%', margin: '16px 0 8px' }} />
            <div className="w-full h-10 bg-gray-200 dark:bg-gray-700 rounded animate-pulse" />
          </div>
          <div className="card" style={{ height: 'auto' }}>
            <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 mb-2 animate-pulse" />
            <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full mb-4 animate-pulse" />
            <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
          </div>
        </div>

        {/* Right column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div className="card" style={{ height: 'auto' }}>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[var(--border)]">
              <div className="w-11 h-11 bg-gray-200 dark:bg-gray-700 rounded-lg animate-pulse" />
              <div className="space-y-2">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-48 animate-pulse" />
              </div>
            </div>
            <div className="flex flex-col gap-4">
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                </div>
                <div className="space-y-2">
                  <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24 animate-pulse" />
                  <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-16 animate-pulse" />
                <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
              </div>
              <div className="h-10 bg-gray-200 dark:bg-gray-700 rounded w-32 mt-2 animate-pulse" />
            </div>
          </div>

          <div className="card" style={{ height: 'auto' }}>
            <div className="flex items-center justify-between mb-4 pb-4 border-b border-[var(--border)]">
              <div className="space-y-2 w-full max-w-[200px]">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              </div>
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-32 animate-pulse" />
            </div>
            <div className="flex items-center justify-between">
              <div className="space-y-2 w-full max-w-[200px]">
                <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-full animate-pulse" />
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4 animate-pulse" />
              </div>
              <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-40 animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
