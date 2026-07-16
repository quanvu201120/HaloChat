import { useEffect, useRef, useState } from 'react';
import { RefreshCw, Siren } from 'lucide-react';
import { useAuthStore } from '../store/authStore';

export default function SessionRestoreFallback() {
  const { sessionRestoreError, retrySessionRestore, isSessionRestoring } = useAuthStore();
  const [remainingSeconds, setRemainingSeconds] = useState(sessionRestoreError?.retryAfterSeconds || 0);
  const didAutoRetryRef = useRef(false);

  useEffect(() => {
    didAutoRetryRef.current = false;
    setRemainingSeconds(sessionRestoreError?.retryAfterSeconds || 0);
  }, [sessionRestoreError?.retryAfterSeconds]);

  useEffect(() => {
    if (remainingSeconds <= 0) return;

    const timer = window.setInterval(() => {
      setRemainingSeconds((current) => Math.max(current - 1, 0));
    }, 1000);

    return () => window.clearInterval(timer);
  }, [remainingSeconds]);

  useEffect(() => {
    if (remainingSeconds > 0 || isSessionRestoring || didAutoRetryRef.current) return;

    didAutoRetryRef.current = true;
    void retrySessionRestore();
  }, [isSessionRestoring, remainingSeconds, retrySessionRestore]);

  const waiting = remainingSeconds > 0;

  return (
    <div
      style={{
        minHeight: '100vh',
        background: `
          radial-gradient(circle at 50% -12%, rgba(239, 68, 68, 0.18), transparent 42%),
          linear-gradient(145deg, var(--bg-secondary), var(--bg-primary) 58%)
        `,
        color: 'var(--text-primary)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        perspective: '1200px',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '448px',
          position: 'relative',
          borderRadius: '22px',
          padding: '1px',
          background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.5), rgba(255, 255, 255, 0.2), rgba(245, 158, 11, 0.35))',
          boxShadow: '0 24px 70px rgba(15, 17, 26, 0.18)',
          transform: 'rotateX(2deg)',
        }}
      >
        <div
          style={{
            borderRadius: '21px',
            padding: '34px 30px',
            background: 'color-mix(in srgb, var(--bg-card) 92%, transparent)',
            border: '1px solid color-mix(in srgb, var(--border) 70%, transparent)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.28)',
            textAlign: 'center',
            backdropFilter: 'blur(14px)',
          }}
        >
          <div
            style={{
              width: '80px',
              height: '80px',
              margin: '0 auto 22px',
              borderRadius: '22px',
              display: 'grid',
              placeItems: 'center',
              background: 'linear-gradient(145deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.1))',
              boxShadow: '0 16px 34px rgba(239, 68, 68, 0.18), inset 0 1px 0 rgba(255,255,255,0.45)',
              color: '#ef4444',
            }}
          >
            <Siren size={42} strokeWidth={1.5} />
          </div>

          <h1 style={{ fontSize: '24px', fontWeight: 800, marginBottom: '10px', lineHeight: 1.25 }}>
            Bị bắn tốc độ!
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px', lineHeight: 1.65, fontSize: '15px' }}>
            Bạn vừa vượt quá tốc độ cho phép. 
          </p>

          <div
            style={{
              height: '48px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {waiting ? (
              <div
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '10px',
                  height: '44px',
                  padding: '0 20px',
                  borderRadius: '999px',
                  background: 'color-mix(in srgb, #ef4444 12%, transparent)',
                  color: '#ef4444',
                  fontWeight: 800,
                  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.12)',
                }}
              >
                <div style={{ position: 'relative', width: 16, height: 16, display: 'flex' }}>
                    <div style={{
                        position: 'absolute', inset: 0, border: '2px solid currentColor', borderRadius: '50%',
                        borderTopColor: 'transparent', animation: 'spin 1s linear infinite'
                    }} />
                </div>
                <span style={{width:'130px'}}>Tạm giữ xe {remainingSeconds}s</span>
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <RefreshCw size={17} style={{ animation: 'spin 1s linear infinite' }} />
                Đang nộp phạt và đi tiếp...
              </div>
            )}
          </div>
        </div>
      </div>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
