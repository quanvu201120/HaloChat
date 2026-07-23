import React from 'react';
import { LogOut, Trash2, Monitor, Smartphone, TabletSmartphone, CircleHelp, RefreshCw } from 'lucide-react';
import { UI_MESSAGES } from '../constants/messages';
import type { ProfileSession } from './ProfilePage.helpers';

type ProfileSessionsCardProps = {
  sessions: ProfileSession[];
  sessionsLoading: boolean;
  sessionsError: string;
  setSessionsReloadKey: React.Dispatch<React.SetStateAction<number>>;
  logoutAllLoading: boolean;
  handleLogoutAll: () => void;
  logoutSessionId: string | null;
  handleLogoutSession: (session: ProfileSession) => void;
};

export default function ProfileSessionsCard({
  sessions,
  sessionsLoading,
  sessionsError,
  setSessionsReloadKey,
  logoutAllLoading,
  handleLogoutAll,
  logoutSessionId,
  handleLogoutSession,
}: ProfileSessionsCardProps) {
  return (
    <div className="card">
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', borderBottom: '1px solid var(--border)', paddingBottom: '16px', marginBottom: '16px' }}>
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: '4px' }}>
            {UI_MESSAGES.profile.sessionsTitle}
          </div>
          <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
            {UI_MESSAGES.profile.sessionsSubtitle}
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSessionsReloadKey((value) => value + 1)}
            disabled={sessionsLoading}
          >
            {sessionsLoading
              ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang tải...</>
              : <><RefreshCw size={15} /> Làm mới</>}
          </button>
          <button
            id="btn-logout-all"
            type="button"
            className="btn btn-secondary"
            onClick={handleLogoutAll}
            disabled={logoutAllLoading}
            style={{ color: 'var(--error)' }}
          >
            {logoutAllLoading
              ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
              : <><LogOut size={15} /> Đăng xuất tất cả</>}
          </button>
        </div>
      </div>

      {sessionsLoading && sessions.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-muted)', fontSize: '14px', padding: '8px 0' }}>
          <div className="loading-spinner" style={{ width: 14, height: 14 }} />
          <span>{UI_MESSAGES.profile.sessionsLoading}</span>
        </div>
      ) : sessionsError ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', padding: '8px 0' }}>
          <div style={{ color: 'var(--error)', fontSize: '14px' }}>{sessionsError || UI_MESSAGES.profile.sessionsLoadFailed}</div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setSessionsReloadKey((value) => value + 1)}
          >
            Thử lại
          </button>
        </div>
      ) : sessions.length === 0 ? (
        <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '8px 0' }}>
          {UI_MESSAGES.profile.sessionsEmpty}
        </div>
      ) : (
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          maxHeight: '480px',
          overflowY: 'auto',
          paddingRight: '4px'
        }}>
          {sessions.map((session) => (
            <div
              key={session.deviceId}
              style={{
                position: 'relative',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                padding: '14px 16px',
                background: session.isCurrent ? 'rgba(99,102,241,0.03)' : 'var(--bg-card)',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'nowrap' }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', minWidth: 0, flex: 1 }}>
                  <div style={{
                    width: 40,
                    height: 40,
                    borderRadius: 'var(--radius-md)',
                    background: session.isCurrent ? 'rgba(99,102,241,0.12)' : 'rgba(71,85,105,0.08)',
                    color: session.isCurrent ? 'var(--primary)' : 'var(--text-muted)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}>
                    {session.deviceCategory === 'mobile' ? (
                      <Smartphone size={20} />
                    ) : session.deviceCategory === 'tablet' ? (
                      <TabletSmartphone size={20} />
                    ) : session.deviceCategory === 'desktop' || session.deviceCategory === 'tv' ? (
                      <Monitor size={20} />
                    ) : (
                      <CircleHelp size={20} />
                    )}
                  </div>

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px' }}>
                        {session.deviceLabel}
                      </div>
                      {session.isCurrent && (
                        <span style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: '#0f766e',
                          background: 'rgba(45,212,191,0.16)',
                          padding: '3px 8px',
                          borderRadius: '999px',
                        }}>
                          Thiết bị hiện tại
                        </span>
                      )}
                    </div>

                    <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {session.deviceDetail}
                    </div>
                    <div style={{ marginTop: '4px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {session.lastActiveLabel}
                    </div>
                    <div style={{ marginTop: '2px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.6 }}>
                      {session.expiresLabel}
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn btn-secondary shrink-0 px-[2px] py-[2px] text-sm sm:self-center sm:px-4 sm:py-2 sm:text-base"
                  onClick={() => handleLogoutSession(session)}
                  disabled={logoutSessionId === session.deviceId}
                  style={{ color: 'var(--error)', alignSelf: 'center' }}
                >
                  {logoutSessionId === session.deviceId
                    ? <><div className="loading-spinner" style={{ width: 14, height: 14 }} /> Đang xử lý...</>
                    : <><Trash2 size={14} /><span className="hidden sm:inline">Xóa thiết bị</span></>}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
