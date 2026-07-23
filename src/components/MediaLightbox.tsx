import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, PlayCircle } from 'lucide-react';
import { type MediaResponse, MediaResourceTypeEnum } from '../services/media';
import { api } from '../services/api';
import { sanitizeExternalUrl } from '../utils/url';
import { useRefreshableMediaUrl } from '../hooks/useRefreshableMediaUrl';

interface MediaLightboxProps {
  medias: MediaResponse[];
  initialIndex: number;
  onClose: () => void;
}

export default function MediaLightbox({ medias, initialIndex, onClose }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  // Video đã phát được frame THẬT hay chưa. Trước khi phát được, ta phủ thumbnail
  // đè lên <video> để không bao giờ lộ khung đen (poster của <video> không đáng
  // tin khi element remount vì đổi src hoặc lúc autoPlay đang buffer).
  const [videoReady, setVideoReady] = useState(false);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : medias.length - 1));
  }, [medias.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < medias.length - 1 ? prev + 1 : 0));
  }, [medias.length]);

  // Đóng khi click ra vùng nền. Chỉ đóng nếu click TRÚNG ĐÚNG element gắn handler
  // (`e.target === e.currentTarget`), không phải phần tử con nổi bọt lên. Nhờ vậy
  // click vào ảnh/video, nút, thanh điều hướng hay thumbnail sẽ KHÔNG đóng nhầm.
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    const activeMedia = medias[currentIndex] || medias[0];
    if (!activeMedia?.url) return;
    try {
      let blob: Blob;
      const isR2Media = Boolean(activeMedia.provider === 'r2' || (activeMedia.objectKey && activeMedia._id));
      if (isR2Media) {
        // R2 media: dùng backend để đảm bảo Content-Disposition: attachment
        const response = await api.get(`/media/${activeMedia._id}/download`, {
          responseType: 'blob',
        });
        blob = response.data instanceof Blob
          ? response.data
          : new Blob([response.data], { type: activeMedia.mimeType || 'application/octet-stream' });
      } else {
        // Cloudinary hoặc URL thông thường: đảm bảo URL còn hạn trước khi tải.
        const freshUrl = await ensureFreshUrl();
        const response = await fetch(freshUrl || activeMedia.url);
        blob = await response.blob();
      }
      const blobUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = blobUrl;
      a.download = activeMedia.fileName || 'download';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error('Download failed', err);
      const safeUrl = sanitizeExternalUrl(activeMedia.url);
      if (safeUrl) window.open(safeUrl, '_blank', 'noopener,noreferrer');
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') handlePrev();
      if (e.key === 'ArrowRight') handleNext();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, handlePrev, handleNext]);

  const activeMedia = medias?.[currentIndex] || medias?.[0] || null;
  const isVideo = activeMedia?.resourceType === MediaResourceTypeEnum.VIDEO;
  // Lightbox là modal → media đang mở luôn hiển thị: `assumeInView` để hook chủ
  // động giữ URL tươi (xin vé ngay trước hạn), không đợi click hay để ảnh đen.
  const { url, isRefreshing, ensureFreshUrl, refreshOnError } = useRefreshableMediaUrl(activeMedia, { assumeInView: true });
  const displayUrl = url || activeMedia?.url || '';

  // Đổi video (chuyển slide hoặc xin vé đổi src) → coi như chưa phát được frame
  // thật → phủ lại thumbnail cho tới khi `onPlaying`. Reset theo prop nguồn.
  /* eslint-disable-next-line react-hooks/set-state-in-effect */
  useEffect(() => { setVideoReady(false); }, [activeMedia?._id, displayUrl]);

  // Phủ thumbnail đè lên video khi: đang xin vé HOẶC video chưa phát được frame
  // thật. Nhờ vậy không bao giờ lộ khung đen (buffer/remount/xin vé).
  const showVideoOverlay = isVideo && (isRefreshing || !videoReady);

  if (!medias || medias.length === 0 || !activeMedia) return null;

  return (
    <div
      onClick={handleBackdropClick}
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        // Đen ĐẶC (không phải 0.9 hơi trong): video để `backgroundColor: transparent`
        // nên letterbox + vùng chưa có frame lộ đúng nền này. Nền đặc, đồng nhất →
        // không lệch tông với frame video (vốn đen), hết cảnh "chớp màu lệch tông".
        backgroundColor: 'rgb(0, 0, 0)',
        zIndex: 9999,
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none'
      }}
    >
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: '16px', position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10 }}>
        <button 
          onClick={onClose}
          style={{ 
            background: 'white', border: 'none', borderRadius: '50%', width: '40px', height: '40px', 
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' 
          }}
        >
          <X size={24} color="black" />
        </button>

        <div style={{ display: 'flex', gap: '16px' }}>
          <button 
            onClick={handleDownload}
            style={{ 
              background: 'transparent', border: 'none', color: 'white', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' 
            }}
          >
            <Download size={24} />
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div onClick={handleBackdropClick} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {medias.length > 1 && (
          <button 
            onClick={handlePrev}
            style={{ 
              position: 'absolute', left: '24px', background: 'rgba(255, 255, 255, 0.2)', border: 'none', 
              borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10
            }}
          >
            <ChevronLeft size={32} />
          </button>
        )}

        <div style={{ maxWidth: '80%', maxHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isVideo ? (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '80vw', height: '80vh' }}>
              <video
                // KHÔNG dùng `key={displayUrl}`. Nếu đặt key theo URL, mỗi lần hook
                // xin vé mới (đổi displayUrl) thẻ <video> bị HUỶ và TẠO LẠI → mất
                // frame đang vẽ → lộ khung đen một nhịp. Bỏ key → React chỉ cập nhật
                // thuộc tính `src` trên cùng một element, trình duyệt giữ nguyên frame
                // cũ đang vẽ cho tới khi có dữ liệu mới → không còn chớp đen do remount.
                src={displayUrl}
                // Video R2 không có `thumbUrl` từ backend → không có poster ảnh thật.
                // `preload="metadata"` để trình duyệt VẼ FRAME ĐẦU trước (như thumbnail).
                poster={activeMedia.thumbUrl || undefined}
                preload="metadata"
                controls
                // Đã có frame đầu để vẽ (không còn đen).
                onLoadedData={() => { setVideoReady(true); }}
                // CHỈ tự phát khi trình duyệt báo đã buffer ĐỦ để phát không khựng
                // (`canplay`). Gọi play() sớm ở `loadeddata` (mới có mỗi frame đầu)
                // làm video stall → hiện đen. Đợi `canplay` mới phát → mượt.
                onCanPlay={(e) => { void e.currentTarget.play().catch(() => {}); }}
                onPlay={() => { void ensureFreshUrl(); }}
                onError={() => { void refreshOnError(); }}
                // Khung cố định 80vw×80vh + `contain`: video luôn nằm gọn trong khung
                // với ĐÚNG tỉ lệ, phần thừa là letterbox. Khung KHÔNG đổi size dù đã
                // load metadata hay chưa → không còn giật/nhảy layout khi loading→phát.
                // `backgroundColor: transparent`: bỏ nền ĐEN mặc định của thẻ <video>,
                // để phần chưa có frame và letterbox lộ lớp overlay phía sau → hoà đúng
                // vào màu overlay thay vì là một ô đen đặc.
                // `opacity` + `transition`: chưa có frame đầu (`!videoReady`) thì ẩn
                // video (opacity 0) để chỉ thấy overlay + spinner; khi frame đầu vẽ
                // xong thì FADE lên (0→1) trong 0.25s → chuyển mượt, không còn cú cắt
                // cứng "chớp/giật" giữa loading và phát.
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                  backgroundColor: 'transparent',
                  opacity: videoReady ? 1 : 0,
                  transition: 'opacity 0.25s ease',
                }}
              />
              {/* Chỉ hiện spinner khi ĐANG xin vé HOẶC chưa có frame đầu để vẽ; khi
                  frame đầu đã vẽ (`videoReady`) thì gỡ, để lộ frame video thật. */}
              {showVideoOverlay && (
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                  <div className="loading-spinner" style={{ width: 40, height: 40 }} />
                </div>
              )}
            </div>
          ) : (
            <img
              src={displayUrl}
              alt={activeMedia.fileName || 'media'}
              onError={() => { void refreshOnError(); }}
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          )}
        </div>

        {medias.length > 1 && (
          <button 
            onClick={handleNext}
            style={{ 
              position: 'absolute', right: '24px', background: 'rgba(255, 255, 255, 0.2)', border: 'none', 
              borderRadius: '50%', width: '48px', height: '48px', display: 'flex', alignItems: 'center', 
              justifyContent: 'center', cursor: 'pointer', color: 'white', zIndex: 10
            }}
          >
            <ChevronRight size={32} />
          </button>
        )}
      </div>

      {/* Thumbnails */}
      {medias.length > 1 && (
        <div style={{ 
          height: '100px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
          padding: '16px', overflowX: 'auto', background: 'rgba(0,0,0,0.5)' 
        }}>
          {medias.map((media, idx) => (
            <div 
              key={media._id}
              onClick={() => setCurrentIndex(idx)}
              style={{
                width: '60px', height: '60px', borderRadius: '4px', overflow: 'hidden', cursor: 'pointer',
                border: currentIndex === idx ? '2px solid white' : '2px solid transparent',
                opacity: currentIndex === idx ? 1 : 0.5,
                transition: 'all 0.2s ease',
                position: 'relative'
              }}
            >
              <img 
                src={media.thumbUrl || media.url} 
                alt="thumb" 
                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
              />
              {media.resourceType === MediaResourceTypeEnum.VIDEO && (
                <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', color: 'white' }}>
                  <PlayCircle size={20} />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
