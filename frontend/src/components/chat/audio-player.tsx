'use client';

import { useState, useRef, useEffect } from 'react';
import { Play, Pause } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AudioPlayerProps {
  audioUrl: string;
  duration: number;      // seconds (server-computed)
  waveform: number[];    // 40 amplitude values 0.0–1.0
  isMe: boolean;
}

export function AudioPlayer({ audioUrl, duration, waveform, isMe }: AudioPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onPlay = () => setIsPlaying(true);
    const onPause = () => setIsPlaying(false);
    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
      if (audioRef.current) audioRef.current.currentTime = 0;
    };
    const onTime = () => setCurrentTime(audio.currentTime);

    audio.addEventListener('play', onPlay);
    audio.addEventListener('pause', onPause);
    audio.addEventListener('ended', onEnded);
    audio.addEventListener('timeupdate', onTime);

    return () => {
      audio.removeEventListener('play', onPlay);
      audio.removeEventListener('pause', onPause);
      audio.removeEventListener('ended', onEnded);
      audio.removeEventListener('timeupdate', onTime);
    };
  }, []);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    isPlaying ? audio.pause() : audio.play().catch(() => {});
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    audio.currentTime = ratio * audio.duration;
  };

  const formatTime = (s: number) => {
    const secs = Math.max(0, Math.round(s));
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
  };

  const totalDuration = audioRef.current?.duration || duration;
  const progress = totalDuration > 0 ? currentTime / totalDuration : 0;

  // Normalise waveform — fall back to flat if missing
  const bars: number[] = waveform?.length > 0
    ? waveform
    : Array.from({ length: 40 }, () => 0.5);

  return (
    <div className="flex items-center gap-2" style={{ minWidth: 200, maxWidth: 260 }}>
      <audio ref={audioRef} src={audioUrl} preload="none" />

      {/* Play / Pause */}
      <button
        onClick={togglePlay}
        className={cn(
          'w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors',
          isMe
            ? 'bg-white/20 hover:bg-white/30 text-white'
            : 'bg-primary/10 hover:bg-primary/20 text-primary',
        )}
      >
        {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
      </button>

      {/* Waveform + time */}
      <div className="flex-1 flex flex-col gap-0.5">
        {/* Waveform bars — clickable to seek */}
        <div
          className="flex items-center gap-[1.5px] h-8 cursor-pointer"
          onClick={handleSeek}
          title="Click to seek"
        >
          {bars.map((amp, i) => {
            const played = i / bars.length <= progress;
            return (
              <div
                key={i}
                className={cn(
                  'rounded-full transition-all shrink-0',
                  played
                    ? isMe ? 'bg-white' : 'bg-primary'
                    : isMe ? 'bg-white/35' : 'bg-gray-300 dark:bg-gray-600',
                )}
                style={{
                  width: 2.5,
                  height: `${Math.max(15, amp * 100)}%`,
                }}
              />
            );
          })}
        </div>

        {/* Time label */}
        <span
          className={cn(
            'text-[10px] tabular-nums',
            isMe ? 'text-white/60' : 'text-muted-foreground',
          )}
        >
          {currentTime > 0 ? formatTime(currentTime) : formatTime(duration)}
        </span>
      </div>
    </div>
  );
}
