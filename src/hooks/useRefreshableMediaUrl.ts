/* eslint-disable react-hooks/set-state-in-effect */
import { useCallback, useEffect, useRef, useState } from 'react';
import { isMediaUrlExpired, mediaApi } from '../services/media';

type MediaLike = {
  _id?: string;
  url?: string;
  expiresAt?: string;
  provider?: string;
  objectKey?: string;
};

type UseRefreshableMediaUrlOptions = {
  // Mốc xin vé sớm trước khi URL hết hạn (mặc định 30s).
  refreshThresholdMs?: number;
  // Coi như media luôn ở trong khung nhìn (vd: đang mở trong lightbox/modal) →
  // không cần gắn `containerRef`, cứ chủ động giữ URL luôn tươi.
  assumeInView?: boolean;
  // Lề mở rộng quanh viewport để xin vé SỚM khi scroll GẦN tới, trước khi element
  // thật sự lọt vào màn hình (mặc định 400px).
  viewportRootMargin?: string;
};

// Media có hạn sử dụng khi backend trả kèm `expiresAt` (URL đã ký, TTL ngắn).
// Không phụ thuộc provider (R2/Cloudinary) — cứ có `expiresAt` là cần làm mới.
const hasExpiry = (media?: MediaLike | null) => Boolean(media?._id && media?.expiresAt);

// `GET /media/:id/url` chỉ nhận ObjectId hợp lệ. Media dựng tạm (vd avatar
// lightbox dùng `_id: 'avatar'`) không phải id thật → bỏ qua để tránh 400.
const isRealMediaId = (id?: string) => Boolean(id && /^[a-f0-9]{24}$/i.test(id));

export function useRefreshableMediaUrl(media?: MediaLike | null, options?: UseRefreshableMediaUrlOptions) {
  const refreshThresholdMs = options?.refreshThresholdMs ?? 30_000;
  const rootMargin = options?.viewportRootMargin ?? '400px';
  const assumeInView = Boolean(options?.assumeInView);

  const [currentUrl, setCurrentUrl] = useState(media?.url || '');
  const [currentExpiresAt, setCurrentExpiresAt] = useState(media?.expiresAt);
  const [inView, setInView] = useState(assumeInView);
  // Đang có một lượt xin vé chạy dở → UI có thể hiện thumbnail + loading thay vì
  // để khung media đen/vỡ trong lúc chờ URL mới về.
  const [isRefreshing, setIsRefreshing] = useState(false);

  const retryCountRef = useRef(0);
  const refreshPromiseRef = useRef<Promise<string> | null>(null);
  const observerRef = useRef<IntersectionObserver | null>(null);
  // Bản sao `expiresAt` mới nhất đọc được NGAY sau `await` (state React còn stale
  // trong cùng tick). Dùng để truyền hạn tươi kèm URL tươi khi mở lightbox.
  const expiresAtRef = useRef(media?.expiresAt);

  useEffect(() => {
    setCurrentUrl(media?.url || '');
    setCurrentExpiresAt(media?.expiresAt);
    expiresAtRef.current = media?.expiresAt;
    retryCountRef.current = 0;
    refreshPromiseRef.current = null;
  }, [media?._id, media?.url, media?.expiresAt]);

  const refreshUrl = useCallback(async () => {
    // Không có id thật thì không thể ký lại URL — dùng URL sẵn có.
    if (!isRealMediaId(media?._id)) {
      return currentUrl || media?.url || '';
    }

    if (!refreshPromiseRef.current) {
      setIsRefreshing(true);
      refreshPromiseRef.current = mediaApi.getUrl(media!._id!)
        .then((res) => {
          const payload = res.data as { data?: { url?: string; expiresAt?: string }; url?: string; expiresAt?: string };
          const nextPayload = payload.data ?? payload;
          const nextUrl = nextPayload.url || '';
          expiresAtRef.current = nextPayload.expiresAt;
          // Ghi vé tươi NGƯỢC vào chính object media nguồn (thường là bản trong
          // globalMediaCache / mảng sidebar — cùng reference). Nhờ vậy lần mở
          // lightbox sau đọc lại object này thấy vé CÒN HẠN → không xin vé lại.
          // Nếu không làm bước này, vé tươi chỉ sống trong state của lần mở hiện
          // tại → đóng/mở lại là xin vé mỗi lần (lỗi "click nào cũng load API").
          if (media && typeof media === 'object') {
            media.url = nextUrl;
            media.expiresAt = nextPayload.expiresAt;
          }
          setCurrentUrl(nextUrl);
          setCurrentExpiresAt(nextPayload.expiresAt);
          return nextUrl;
        })
        // Ký lại thất bại (hết hạn phiên, media đã xoá, lỗi mạng...) không được
        // làm sập UI: nuốt lỗi và giữ nguyên URL hiện tại.
        .catch(() => currentUrl || media?.url || '')
        .finally(() => {
          refreshPromiseRef.current = null;
          setIsRefreshing(false);
        });
    }

    return refreshPromiseRef.current;
  }, [currentUrl, media]);

  const ensureFreshUrl = useCallback(async (thresholdMs = refreshThresholdMs) => {
    if (!media) return '';
    if (!hasExpiry(media)) return currentUrl || media.url || '';
    if (!currentUrl || isMediaUrlExpired(currentExpiresAt || media.expiresAt, thresholdMs)) {
      return refreshUrl();
    }
    return currentUrl;
  }, [currentExpiresAt, currentUrl, media, refreshThresholdMs, refreshUrl]);

  // Như `ensureFreshUrl` nhưng trả về CẢ `url` và `expiresAt` tươi (đọc qua ref để
  // không dính state stale). Dùng khi cần chuyển media sang component khác (vd mở
  // lightbox) mà vẫn giữ đúng hạn — tránh nơi nhận tưởng đã hết hạn rồi xin vé lại.
  const ensureFreshMedia = useCallback(async (thresholdMs = refreshThresholdMs) => {
    const url = await ensureFreshUrl(thresholdMs);
    return { url, expiresAt: expiresAtRef.current };
  }, [ensureFreshUrl, refreshThresholdMs]);

  // Fallback khi tải media lỗi: refetch URL đúng 1 lần, kể cả media chưa có
  // `expiresAt` (đề phòng lệch giờ hệ thống hoặc TTL bật giữa các lần deploy).
  const retryOnError = useCallback(async () => {
    if (!media?._id || retryCountRef.current >= 1) {
      return currentUrl || media?.url || '';
    }
    retryCountRef.current += 1;
    return refreshUrl();
  }, [currentUrl, media, refreshUrl]);

  // Callback ref: gắn vào element media để theo dõi nó có (gần) trong khung nhìn
  // hay không. Nhờ `rootMargin`, observer báo "vào tầm" TRƯỚC khi element thật sự
  // hiện ra → kịp xin vé mới, người dùng không thấy khoảng loading.
  const containerRef = useCallback((node: Element | null) => {
    observerRef.current?.disconnect();
    observerRef.current = null;

    if (assumeInView) {
      setInView(true);
      return;
    }
    if (!node) return;
    if (typeof IntersectionObserver === 'undefined') {
      setInView(true); // môi trường không hỗ trợ → coi như luôn hiển thị.
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => setInView(entries.some((entry) => entry.isIntersecting)),
      { rootMargin },
    );
    observer.observe(node);
    observerRef.current = observer;
  }, [assumeInView, rootMargin]);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  // Chủ động giữ URL luôn tươi khi media đang (gần) trong khung nhìn:
  // - Đã/sắp hết hạn → xin vé NGAY.
  // - Còn hạn → hẹn giờ xin vé đúng ngay trước mốc hết hạn (không polling, chỉ MỘT
  //   timeout cho mỗi vòng đời vé). Vé mới về → effect chạy lại → hẹn vòng kế tiếp.
  // Khi cuộn ra khỏi tầm nhìn (`inView=false`) → cleanup huỷ timer, ngừng xin vé.
  useEffect(() => {
    const active = assumeInView || inView;
    if (!active || !hasExpiry(media) || !isRealMediaId(media?._id)) return;

    const exp = currentExpiresAt || media?.expiresAt;
    const expMs = exp ? new Date(exp).getTime() : NaN;
    if (Number.isNaN(expMs)) return;

    const fireIn = expMs - refreshThresholdMs - Date.now();
    if (fireIn <= 0) {
      void refreshUrl();
      return;
    }

    const timer = setTimeout(() => { void refreshUrl(); }, fireIn);
    return () => clearTimeout(timer);
  }, [assumeInView, inView, currentExpiresAt, media, refreshThresholdMs, refreshUrl]);

  return {
    url: currentUrl,
    currentUrl,
    isRefreshing,
    ensureFreshUrl,
    ensureFreshMedia,
    refreshOnError: retryOnError,
    retryOnError,
    hasExpiry: hasExpiry(media),
    // Gắn vào element media (img/video/wrapper) để bật auto-refresh theo khung nhìn.
    containerRef,
  };
}
