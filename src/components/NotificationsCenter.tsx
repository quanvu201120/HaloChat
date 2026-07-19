import { useEffect, useMemo, useState, type UIEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import {
  BadgeCheck,
  Bell,
  BellRing,
  CheckCheck,
  ChevronRight,
  Clock3,
  FileText,
  Info,
  Sparkles,
  Laptop,
  CircleHelp,
  Monitor,
  Smartphone,
  TabletSmartphone,
  TriangleAlert,
  X,
} from 'lucide-react';
import { formatDateVN } from '../utils/date';
import { getDeviceCategoryForDisplay } from '../utils/device';
import { UI_LIMITS } from '../constants/limits';
import {
  useNotifications,
  type NotificationItem,
  type NotificationType,
} from '../hooks/useNotifications';

interface NotificationsInboxProps {
  onClose: () => void;
  onSelect: (item: NotificationItem) => void;
  selectedId: string | null;
}

type NotificationMeta = {
  label: string;
  tone: string;
  softTone: string;
  icon: typeof Bell;
};

const NOTIFICATION_META: Record<string, NotificationMeta> = {
  REPORT_RESOLVED: {
    label: 'Đã xử lí',
    tone: 'var(--success)',
    softTone: 'rgba(5, 150, 105, 0.12)',
    icon: BadgeCheck,
  },
  REPORT_APPEAL_PENDING: {
    label: 'Đang kháng cáo',
    tone: 'var(--warning)',
    softTone: 'rgba(217, 119, 6, 0.12)',
    icon: Clock3,
  },
  REPORT_APPEAL_REJECTED: {
    label: 'Kháng cáo bị từ chối',
    tone: 'var(--error)',
    softTone: 'rgba(220, 38, 38, 0.12)',
    icon: TriangleAlert,
  },
  REPORT_APPEAL_SUCCESS: {
    label: 'Kháng cáo thành công',
    tone: 'var(--info)',
    softTone: 'rgba(37, 99, 235, 0.12)',
    icon: Sparkles,
  },
  SYSTEM: {
    label: 'Thông báo hệ thống',
    tone: 'var(--accent-primary)',
    softTone: 'rgba(99, 102, 241, 0.12)',
    icon: Info,
  },
  LOGIN: {
    label: 'Đăng nhập thiết bị mới',
    tone: 'var(--accent-primary)',
    softTone: 'rgba(99, 102, 241, 0.12)',
    icon: Laptop,
  },
};

function getNotificationMeta(type: NotificationType | string): NotificationMeta {
  return NOTIFICATION_META[type] || NOTIFICATION_META.SYSTEM;
}

const REPORT_REASON_LABELS: Record<string, string> = {
  spam_harassment: 'Spam / Quấy rối',
  inappropriate_content: 'Nội dung vi phạm tiêu chuẩn cộng đồng.',
  impersonation: 'Mạo danh',
  system_spam: 'Spam hệ thống',
  other: 'Khác',
};

const PENALTY_LABELS: Record<string, string> = {
  warning: 'Cảnh cáo',
  mute: 'Cấm chat',
  ban: 'Khóa tài khoản',
  reset_and_warning: 'Gỡ thông tin & Cảnh cáo',
  reset_and_ban: 'Gỡ thông tin & Khóa tài khoản',
};

function getReportReasonLabel(reason?: string) {
  if (!reason) return 'Không xác định';
  return REPORT_REASON_LABELS[reason] || reason;
}

function getPenaltyLabel(penalty?: string) {
  if (!penalty) return 'Chưa áp dụng';
  return PENALTY_LABELS[penalty] || penalty;
}

function getMediaUrl(media: any) {
  if (!media) return null;
  if (typeof media === 'string') return media;
  return media.url || media.secure_url || media.thumbUrl || null;
}

function getInitials(name?: string) {
  if (!name) return '?';
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return '?';
  return parts
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');
}

function getNotificationIcon(item: NotificationItem) {
  if (item.type !== 'LOGIN') {
    return getNotificationMeta(item.type).icon;
  }

  const category = getDeviceCategoryForDisplay(item.metadata?.deviceName);

  switch (category) {
    case 'mobile':
      return Smartphone;
    case 'tablet':
      return TabletSmartphone;
    case 'desktop':
    case 'tv':
      return Monitor;
    default:
      return CircleHelp;
  }
}

function countLabel(count: number) {
  if (count > UI_LIMITS.UNREAD_BADGE_MAX) {
    return `${UI_LIMITS.UNREAD_BADGE_MAX}+`;
  }
  return String(count);
}

function NotificationsInbox({ onClose, onSelect, selectedId }: NotificationsInboxProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    markRead,
    markAllRead,
    isMarkingAllRead,
  } = useNotifications();

  const [filter, setFilter] = useState<'all' | 'unread'>('all');

  const filteredNotifications = useMemo(() => {
    return filter === 'unread' ? notifications.filter((item) => !item.isRead) : notifications;
  }, [filter, notifications]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    if (scrollHeight - scrollTop - clientHeight < 80 && hasNextPage && !isFetchingNextPage) {
      void fetchNextPage();
    }
  };

  const openNotification = (item: NotificationItem) => {
    onSelect(item);

    if (!item.isRead) {
      void markRead(item._id).catch((err) => {
        console.error('Failed to mark notification as read:', err);
      });
    }
  };

  const unread = unreadCount ?? 0;

  return (
    <div className="notifications-panel-shell">
      <div className="notifications-aurora" />

      <div className="notifications-header">
        <div className="notifications-header-main">
          <div className="notifications-header-orb">
            <BellRing size={18} />
          </div>
          <div className="notifications-header-copy">
            <div className="notifications-header-title">Thông báo</div>
            <div className="notifications-header-subtitle">
              {unread > 0
                ? `${countLabel(unread)} thông báo chưa đọc`
                : 'Không có thông báo mới nào'}
            </div>
          </div>
        </div>

        <button className="notifications-close-btn" onClick={onClose} aria-label="Đóng">
          <X size={16} />
        </button>
      </div>

      <div className="notifications-toolbar">
        <div className="notifications-tabs">
          <button
            className={`notifications-tab ${filter === 'all' ? 'active' : ''}`}
            onClick={() => setFilter('all')}
          >
            Tất cả
          </button>
          <button
            className={`notifications-tab ${filter === 'unread' ? 'active' : ''}`}
            onClick={() => setFilter('unread')}
          >
            Chưa đọc
          </button>
        </div>

        <button
          className="notifications-markall-btn"
          onClick={() => void markAllRead()}
          disabled={unread === 0 || isMarkingAllRead}
        >
          <CheckCheck size={16} />
          Đánh dấu tất cả
        </button>
      </div>

      <div className="notifications-list notifications-list-panel" onScroll={handleScroll}>
        {isLoading && notifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-orb" />
            <div className="notifications-empty-title">Đang tải hộp thư...</div>
          </div>
        ) : filteredNotifications.length === 0 ? (
          <div className="notifications-empty">
            <div className="notifications-empty-orb" />
            <div className="notifications-empty-title">Chưa có thông báo nào</div>
            <div className="notifications-empty-desc">
              Hệ thống sẽ báo bạn ở đây khi có điều gì mới.
            </div>
          </div>
        ) : (
          <>
            {filteredNotifications.map((item) => {
              const meta = getNotificationMeta(item.type);
              const NotificationIcon = getNotificationIcon(item);
              const isSelected = selectedId === item._id;

              return (
                <button
                  key={item._id}
                  className={`notification-item ${item.isRead ? '' : 'unread'} ${isSelected ? 'selected' : ''}`}
                  onClick={() => void openNotification(item)}
                >
                  <div
                    className="notification-item-icon"
                    style={{ background: meta.softTone, color: meta.tone }}
                  >
                    <NotificationIcon size={16} />
                  </div>
                  <div className="notification-item-body">
                    <div className="notification-item-top">
                      <div className="notification-item-title">{item.title}</div>
                      {!item.isRead && <span className="notification-dot" />}
                    </div>
                    <div className="notification-item-meta">
                      <span>{formatDateVN(item.createdAt)}</span>
                    </div>
                  </div>
                </button>
              );
            })}

            {hasNextPage && (
              <button
                className="notifications-loadmore"
                onClick={() => void fetchNextPage()}
                disabled={isFetchingNextPage}
              >
                {isFetchingNextPage ? 'Đang tải thêm...' : 'Tải thêm'}
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function getAppealSuccessResult(penalty?: string): string {
  switch (penalty) {
    case 'mute': return 'Mở khóa chat';
    case 'ban': return 'Mở khóa tài khoản';
    case 'reset_and_ban': return 'Mở khóa tài khoản';
    case 'warning':
    case 'reset_and_warning': return 'Xóa án tích';
    default: return 'Xóa án phạt';
  }
}

interface NotificationDetailStageProps {
  item: NotificationItem;
  onClose: () => void;
}

function NotificationDetailStage({ item, onClose }: NotificationDetailStageProps) {
  const navigate = useNavigate();
  const meta = getNotificationMeta(item.type);
  const MetaIcon = meta.icon;
  const metadata = item.metadata;
  const avatarUrl = getMediaUrl(item.snapshot?.avatarMediaId);
  const showAppealButton =
    item.type === 'REPORT_RESOLVED' &&
    item.hasAppealed === false;

  return (
    <motion.div
      className="notifications-stage-container"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      onClick={(e) => e.stopPropagation()}
    >
      <button className="notifications-stage-close" onClick={onClose} aria-label="Đóng chi tiết">
        <X size={20} />
      </button>

      <div className="notifications-stage-perspective">
        <AnimatePresence>
          <motion.div
            key={item._id}
            className="notifications-stage-card"
            initial={{ y: -60, rotateZ: -5, opacity: 0 }}
            animate={{ y: 0, rotateZ: 0, opacity: 1 }}
            exit={{ y: 100, rotateZ: 10, opacity: 0 }}
            transition={{
              type: "spring",
              stiffness: 350,
              damping: 20
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
              <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                <div className="notifications-detail-badge" style={{ background: meta.softTone, color: meta.tone }}>
                  <MetaIcon size={16} />
                  <span>{meta.label}</span>
                </div>
                <div
                  className="notifications-detail-badge"
                  style={{
                    background: item.isRead ? 'rgba(5, 150, 105, 0.12)' : 'rgba(99, 102, 241, 0.12)',
                    color: item.isRead ? 'var(--success)' : 'var(--accent-primary)',
                  }}
                >
                  {item.isRead ? <CheckCheck size={16} /> : <div style={{width: 6, height: 6, borderRadius: '50%', background: 'currentColor'}} />}
                  <span>{item.isRead ? 'Đã đọc' : 'Chưa đọc'}</span>
                </div>
              </div>

              {showAppealButton && (
                <button 
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '6px 12px',
                    borderRadius: '14px',
                    background: 'rgba(99, 102, 241, 0.08)',
                    color: 'var(--accent-primary)',
                    fontSize: '13px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background 0.2s ease',
                  }}
                  onMouseOver={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.15)'}
                  onMouseOut={(e) => e.currentTarget.style.background = 'rgba(99, 102, 241, 0.08)'}
                  onClick={() => {
                    if (item.refId) {
                      navigate(`/appeal/${item.refId}`);
                    }
                  }}
                >
                  Kháng cáo
                  <ChevronRight size={14} />
                </button>
              )}
            </div>

            <div className="notifications-stage-hero">
              <div className="notifications-stage-hero-copy">
                <div className="notifications-detail-title">{item.title}</div>
                <div className="notifications-detail-time">{formatDateVN(item.createdAt)}</div>
              </div>
            </div>

            {item.type === 'LOGIN' ? (
              <div className="notifications-stage-section">
                <div className="notifications-stage-section-title">Thiết bị đăng nhập</div>
                <div
                  style={{
                    padding: '18px',
                    borderRadius: '22px',
                    border: '1px solid rgba(99, 102, 241, 0.16)',
                    background:
                      'radial-gradient(circle at top left, rgba(99, 102, 241, 0.10), transparent 42%), linear-gradient(135deg, var(--bg-card), var(--bg-secondary))',
                    boxShadow: '0 16px 32px rgba(99, 102, 241, 0.10)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      className="notifications-stage-avatar"
                      style={{
                        width: '68px',
                        height: '68px',
                        borderRadius: '20px',
                        background: 'rgba(99, 102, 241, 0.12)',
                        color: 'var(--accent-primary)',
                        border: '1px solid rgba(99, 102, 241, 0.18)',
                      }}
                    >
                      {(() => {
                        const DeviceIcon = getNotificationIcon(item);
                        return <DeviceIcon size={24} />;
                      })()}
                    </div>

                    <div style={{ minWidth: 0, flex: 1 }}>
                      
                      <div
                        style={{
                          marginTop: '10px',
                          fontSize: '18px',
                          fontWeight: 800,
                          color: 'var(--text-primary)',
                          lineHeight: 1.35,
                          wordBreak: 'break-word',
                        }}
                      >
                        {metadata?.deviceName || 'Thiết bị mới'}
                      </div>
                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '13px',
                          lineHeight: 1.6,
                          color: 'var(--text-secondary)',
                        }}
                      >
                        Thiết bị này vừa được dùng để đăng nhập vào tài khoản của bạn.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : item.snapshot ? (
              <>
                <div className="notifications-stage-grid">
                  
                  <div className="notifications-stage-stat-card">
                    <span>Lý do vi phạm</span>
                    <strong>{getReportReasonLabel(metadata?.reason)}</strong>
                  </div>
                  <div className="notifications-stage-stat-card">
                    <span>Phương thức xử lí</span>
                    <strong>{getPenaltyLabel(metadata?.penaltyApplied)}</strong>
                  </div>
                  <div className="notifications-stage-stat-card">
                    <span>
                      {item.type === 'REPORT_RESOLVED'
                        ? 'Thời hạn kháng cáo'
                        : item.type === 'REPORT_APPEAL_PENDING'
                          ? 'Thời gian xử lí'
                          : 'Kết quả'}
                    </span>
                    <strong>
                      {item.type === 'REPORT_RESOLVED' || item.type === 'REPORT_APPEAL_PENDING'
                        ? '30 ngày'
                        : item.type === 'REPORT_APPEAL_SUCCESS'
                          ? <span style={{ color: 'var(--success)' }}>{getAppealSuccessResult(metadata?.penaltyApplied)}</span>
                          : item.type === 'REPORT_APPEAL_REJECTED'
                            ? <span style={{ color: 'var(--error)' }}>Thất bại</span>
                            : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                    </strong>
                  </div>
                </div>

                <div className="notifications-stage-section">
                  <div className="notifications-stage-section-title">Dữ liệu tại thời điểm báo cáo</div>
                  <div className="notifications-stage-profile">
                    <div className="notifications-stage-profile-avatar">
                      {avatarUrl ? <img src={avatarUrl} alt="" /> : <span>{getInitials(item.snapshot.displayName)}</span>}
                    </div>
                    <div className="notifications-stage-profile-body">
                      <div className="notifications-stage-profile-name">
                        {item.snapshot.displayName || 'Không rõ tên'}
                      </div>
                      
                      {item.snapshot.bio && (
                        <div className="notifications-stage-profile-bio">{item.snapshot.bio}</div>
                      )}
                    </div>
                  </div>
                </div>
              </>
            ) : (
              <div className="notifications-stage-empty">
                <div className="notifications-stage-empty-icon">
                  <FileText size={20} />
                </div>
                <div className="notifications-stage-empty-title">Không có dữ liệu</div>
                
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export function NotificationsCenter() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const { unreadCount, notifications } = useNotifications();
  const count = unreadCount ?? 0;
  
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selectedNotification = useMemo(() => {
    return notifications.find((item) => item._id === selectedId) || null;
  }, [notifications, selectedId]);

  useEffect(() => {
    const updateMode = () => setIsMobile(window.innerWidth <= 767.98);
    updateMode();
    window.addEventListener('resize', updateMode);
    return () => window.removeEventListener('resize', updateMode);
  }, []);

  useEffect(() => {
    if (!isOpen) {
      const t = setTimeout(() => setSelectedId(null), 300);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (selectedId) setSelectedId(null);
        else setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, selectedId]);

  return (
    <>
      <button
        className={`icon-btn notifications-trigger ${count > 0 ? 'active' : ''}`}
        title="Thông báo"
        onClick={() => setIsOpen(true)}
      >
        <div className="relative">
          <Bell size={18} />
          {count > 0 && (
            <span className="notification-badge">
              {countLabel(count)}
            </span>
          )}
        </div>
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            className="notifications-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={() => setIsOpen(false)}
          >
            <AnimatePresence>
              {selectedNotification && !isMobile && (
                <NotificationDetailStage 
                  key="stage"
                  item={selectedNotification} 
                  onClose={() => setSelectedId(null)} 
                />
              )}
            </AnimatePresence>

            <motion.div
              className={`notifications-panel ${isMobile ? 'mobile' : 'desktop'}`}
              initial={isMobile ? { y: 32, opacity: 0 } : { x: 32, opacity: 0 }}
              animate={isMobile ? { y: 0, opacity: 1 } : { x: 0, opacity: 1 }}
              exit={isMobile ? { y: 32, opacity: 0 } : { x: 32, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              onClick={(e) => e.stopPropagation()}
              style={{
                display: (isMobile && selectedId) ? 'none' : 'flex'
              }}
            >
              <NotificationsInbox 
                onClose={() => setIsOpen(false)} 
                onSelect={(item) => setSelectedId(item._id)}
                selectedId={selectedId}
              />
            </motion.div>
            
            <AnimatePresence>
              {selectedNotification && isMobile && (
                <NotificationDetailStage 
                  key="stage-mobile"
                  item={selectedNotification} 
                  onClose={() => setSelectedId(null)} 
                />
              )}
            </AnimatePresence>

          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
