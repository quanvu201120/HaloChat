import React, { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

interface AudioPlayerProps {
  src: string;
  className?: string;
  isMe?: boolean;
}

export default function AudioPlayer({ src, className = '', isMe = false }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

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

  const togglePlay = (e: React.MouseEvent) => {
    e.stopPropagation();
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
    setIsPlaying(!isPlaying);
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
    <div className={`audio-player-pill ${isMe ? 'me' : 'other'} ${className}`} onClick={(e) => e.stopPropagation()}>
      <audio ref={audioRef} src={src} preload="metadata" style={{ display: 'none' }} />
      
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
