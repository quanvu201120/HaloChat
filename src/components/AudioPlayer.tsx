import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { useRefreshableMediaUrl } from '../hooks/useRefreshableMediaUrl';
import type { MessageMedia } from '../services/messages';
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  src: string;
  className?: string;
  isMe?: boolean;
  media?: MessageMedia | null;
}

export default function AudioPlayer({
  src,
  className = '',
  isMe = false,
  media,
}: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);
  // Đánh dấu "người dùng đã bấm play, đang chờ URL mới về để phát ngay" — tránh
  // phải bấm lần 2 sau khi xin vé (lần 1 đổi src làm gián đoạn play).
  const pendingPlayRef = useRef(false);
  const { url, ensureFreshUrl, refreshOnError, containerRef: mediaRef } = useRefreshableMediaUrl(media);
  const effectiveSrc = media ? (url || src) : src;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const setAudioData = () => {
      setDuration(audio.duration);
      setCurrentTime(audio.currentTime);
    };

    const setAudioTime = () => setCurrentTime(audio.currentTime);
    const onEnd = () => setIsPlaying(false);

    audio.addEventListener('loadeddata', setAudioData);
    audio.addEventListener('timeupdate', setAudioTime);
    audio.addEventListener('ended', onEnd);

    return () => {
      audio.removeEventListener('loadeddata', setAudioData);
      audio.removeEventListener('timeupdate', setAudioTime);
      audio.removeEventListener('ended', onEnd);
    };
  }, []);

  // `effectiveSrc` đổi (thường do xin vé mới xong) → reset trạng thái. Nếu người
  // dùng đang chờ phát (bấm play lúc URL còn cũ), phát NGAY khi src mới gắn vào
  // <audio> — không bắt bấm lần 2. Reset state theo prop nguồn là sync hợp lệ.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setDuration(0);
    setCurrentTime(0);
    const audio = audioRef.current;
    if (pendingPlayRef.current && audio && effectiveSrc) {
      pendingPlayRef.current = false;
      audio.play().then(() => setIsPlaying(true)).catch(() => setIsPlaying(false));
    } else {
      setIsPlaying(false);
    }
  }, [effectiveSrc]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const togglePlay = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
      setIsPlaying(false);
      return;
    }

    const prevSrc = effectiveSrc;
    const nextUrl = await ensureFreshUrl();
    // URL đổi → src sẽ cập nhật declaratively; đánh dấu để effect tự phát, tránh
    // vừa gán src imperative vừa để React đổi src (chính là nguyên nhân phải bấm 2 lần).
    if (nextUrl && nextUrl !== prevSrc) {
      pendingPlayRef.current = true;
      return;
    }

    try {
      await audio.play();
      setIsPlaying(true);
    } catch {
      setIsPlaying(false);
    }
  };

  const handleAudioError = async () => {
    const audio = audioRef.current;
    if (!audio) return;

    // Đang phát mà URL chết → xin vé, để effect [effectiveSrc] phát lại khi src mới về.
    if (isPlaying) pendingPlayRef.current = true;
    await refreshOnError();
  };

  // Remaining time to display
  const displayTime = duration > 0 ? Math.ceil(duration - currentTime) : 0;

  // Generate some fake bars for the waveform
  const bars = Array.from({ length: 14 }).map(() => {
    // Generate some random heights to make it look like a waveform
    const height = 30 + Math.random() * 70; // 30% to 100%
    return height;
  });

  return (
    <div ref={mediaRef} className={`audio-player-pill ${isMe ? 'me' : 'other'} ${className}`} onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={effectiveSrc} preload="metadata" style={{ display: 'none' }} onError={() => { void handleAudioError(); }} />
      
      <button className="audio-play-btn" onClick={togglePlay} title={isPlaying ? 'Tạm dừng' : 'Phát'}>
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </button>

      <div className="audio-waveform">
        {bars.map((height, i) => (
          <div 
            key={i} 
            className={`waveform-bar ${isPlaying ? 'playing' : ''}`} 
            style={{ 
              height: `${height}%`,
              animationDelay: `${i * 0.1}s`
            }} 
          />
        ))}
      </div>

      <div className="audio-time">
        {formatDuration(displayTime)}
      </div>
    </div>
  );
}
