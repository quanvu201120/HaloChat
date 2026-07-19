import { useEffect, useState } from 'react';
import { BellRing, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  isWebPushSupported,
  subscribeCurrentDeviceToPush,
} from '../services/pushNotifications';

const PUSH_PROMPT_DISMISSED_KEY = 'halochat_push_prompt_dismissed';
const CREATE_PASSWORD_PROMPT_KEY = 'halochat_create_password_prompt';
const CREATE_PASSWORD_PROMPT_CLOSED_EVENT = 'halochat_create_password_prompt_closed';

export default function PushNotificationsManager() {
  const accessToken = useAuthStore((state) => state.accessToken);
  const [permission, setPermission] = useState<NotificationPermission>(() =>
    'Notification' in window ? Notification.permission : 'default',
  );
  const [isDismissed, setIsDismissed] = useState(() =>
    sessionStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === '1',
  );
  const [isWaitingForCreatePassword, setIsWaitingForCreatePassword] = useState(() =>
    sessionStorage.getItem(CREATE_PASSWORD_PROMPT_KEY) === '1',
  );
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent)
    || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1);
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    || ('standalone' in navigator && Boolean((navigator as Navigator & { standalone?: boolean }).standalone));

  useEffect(() => {
    if (accessToken && isWebPushSupported() && permission === 'granted') {
      void subscribeCurrentDeviceToPush(accessToken).catch(() => {});
    }
  }, [accessToken, permission]);

  useEffect(() => {
    const syncPermission = () => {
      if ('Notification' in window) {
        setPermission(Notification.permission);
      }
    };

    window.addEventListener('focus', syncPermission);
    document.addEventListener('visibilitychange', syncPermission);

    return () => {
      window.removeEventListener('focus', syncPermission);
      document.removeEventListener('visibilitychange', syncPermission);
    };
  }, []);

  useEffect(() => {
    const handleCreatePasswordPromptClosed = () => {
      setIsWaitingForCreatePassword(false);
    };

    window.addEventListener(CREATE_PASSWORD_PROMPT_CLOSED_EVENT, handleCreatePasswordPromptClosed);
    return () => {
      window.removeEventListener(CREATE_PASSWORD_PROMPT_CLOSED_EVENT, handleCreatePasswordPromptClosed);
    };
  }, []);

  const requestPermission = async () => {
    if (!isWebPushSupported()) return;

    sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1');
    setIsDismissed(true);
    const nextPermission = await Notification.requestPermission();
    setPermission(nextPermission);
  };

  const dismissPrompt = () => {
    sessionStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, '1');
    setIsDismissed(true);
  };

  const requiresIosInstallation = isIos && !isStandalone;
  const canRequestPermission = isWebPushSupported() && permission === 'default';
  const isPermissionDenied = permission === 'denied';
  const isPushUnsupported = !isWebPushSupported();

  if (isDismissed || isWaitingForCreatePassword || !accessToken || permission === 'granted') return null;

  const description = requiresIosInstallation
    ? 'Trên iPhone, hãy chọn Chia sẻ > Thêm vào Màn hình chính, sau đó mở HaloChat từ biểu tượng vừa tạo để bật thông báo.'
    : isPermissionDenied
      ? 'Thông báo đang bị chặn. Hãy mở cài đặt của trình duyệt, cho phép thông báo của HaloChat rồi tải lại trang.'
      : isPushUnsupported
        ? 'Trình duyệt hoặc địa chỉ hiện tại chưa hỗ trợ thông báo.'
        : 'Cho phép HaloChat gửi thông báo để bạn luôn nhận được tin nhắn, cuộc gọi mới nhất.';
  return (
    <div
      className="fixed inset-0 z-[10000] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-[5px]"
      onMouseDown={dismissPrompt}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="push-notification-title"
        className="relative flex w-full flex-col items-center rounded-[24px] border border-white/70 bg-white text-center shadow-[0_26px_90px_rgba(15,23,42,0.28)] animate-in fade-in zoom-in-95 duration-200"
        style={{ maxWidth: 350, padding: '36px 28px 32px', boxSizing: 'border-box' }}
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          aria-label="Đóng"
          onClick={dismissPrompt}
          className="cursor-pointer absolute right-4 top-4 z-20 flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
        >
          <X size={17} />
        </button>

        <div
          className="relative flex h-[108px] w-[150px] shrink-0 items-center justify-center"
          style={{ margin: '0 auto 32px' }}
        >
          <div className="absolute h-24 w-24 rounded-full bg-violet-400/25 blur-2xl" />
          <div className="absolute left-3 top-9 h-9 w-5 rounded-l-full border-b-[3px] border-l-[3px] border-t-[3px] border-violet-300/70" />
          <div className="absolute right-3 top-9 h-9 w-5 rounded-r-full border-b-[3px] border-r-[3px] border-t-[3px] border-violet-300/70" />
          <div className="relative flex h-[86px] w-[86px] items-center justify-center text-violet-500 drop-shadow-[0_14px_18px_rgba(124,58,237,0.3)]">
            <BellRing size={78} strokeWidth={1.35} fill="currentColor" />
            <span className="absolute -right-2 -top-2 flex h-8 min-w-8 items-center justify-center rounded-full border-[3px] border-white bg-rose-500 px-1 text-sm font-extrabold text-white shadow-sm">
              1
            </span>
          </div>
        </div>

        <h2
          id="push-notification-title"
          className="w-full text-[22px] font-extrabold leading-tight tracking-[-0.025em] text-slate-800"
          style={{ margin: 0 }}
        >
          Đừng bỏ lỡ điều quan trọng
        </h2>
        <p
          className="w-full max-w-[290px] text-[13px] leading-[1.7] text-slate-500"
          style={{ margin: '14px auto 0' }}
        >
          {description}
        </p>

        <div
          className={`grid w-full gap-3 ${canRequestPermission ? 'grid-cols-2' : 'grid-cols-1'}`}
          style={{ marginTop: 32 }}
        >
          <button
            type="button"
            onClick={dismissPrompt}
            className="cursor-pointer min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100"
          >
            {canRequestPermission ? 'Để sau' : 'Đã hiểu'}
          </button>
          {canRequestPermission && (
            <button
              type="button"
              onClick={() => void requestPermission()}
              className="cursor-pointer flex min-h-11 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-3 text-sm font-extrabold text-white shadow-[0_10px_24px_rgba(109,40,217,0.28)] transition-[transform,filter] hover:brightness-105 active:scale-[0.98]"
            >
              <BellRing size={16} fill="currentColor" />
              Bật thông báo
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
