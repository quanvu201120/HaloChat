import { useState, useEffect, useCallback } from 'react';
import { X, ChevronLeft, ChevronRight, Download, PlayCircle } from 'lucide-react';
import { type MediaResponse, MediaResourceTypeEnum } from '../services/media';
import { api } from '../services/api';

interface MediaLightboxProps {
  medias: MediaResponse[];
  initialIndex: number;
  onClose: () => void;
}

export default function MediaLightbox({ medias, initialIndex, onClose }: MediaLightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const handlePrev = useCallback(() => {
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : medias.length - 1));
  }, [medias.length]);

  const handleNext = useCallback(() => {
    setCurrentIndex((prev) => (prev < medias.length - 1 ? prev + 1 : 0));
  }, [medias.length]);

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
        // Cloudinary hoặc URL thông thường
        const response = await fetch(activeMedia.url);
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
      window.open(activeMedia.url, '_blank');
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

  if (!medias || medias.length === 0) return null;

  const activeMedia = medias[currentIndex] || medias[0];
  if (!activeMedia) return null;
  const isVideo = activeMedia.resourceType === MediaResourceTypeEnum.VIDEO;

  return (
    <div 
      style={{
        position: 'fixed',
        top: 0, left: 0, right: 0, bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.9)',
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
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
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
            <video 
              src={activeMedia.url} 
              controls 
              autoPlay 
              style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain' }}
            />
          ) : (
            <img 
              src={activeMedia.url} 
              alt={activeMedia.fileName || 'media'} 
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
