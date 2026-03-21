'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, Square, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VoiceRecorderProps {
  onSend: (blob: Blob, duration: number, mimeType: string) => Promise<void>;
  disabled?: boolean;
}

export function VoiceRecorder({ onSend, disabled }: VoiceRecorderProps) {
  const [state, setState] = useState<'idle' | 'recording' | 'sending'>('idle');
  const [duration, setDuration] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const durationRef = useRef(0);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const startRecording = useCallback(async () => {
    if (disabled || state !== 'idle') return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : 'audio/mp4';

      const recorder = new MediaRecorder(stream, { mimeType });
      chunksRef.current = [];
      durationRef.current = 0;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(100);
      mediaRecorderRef.current = recorder;
      setState('recording');
      setDuration(0);

      timerRef.current = setInterval(() => {
        durationRef.current += 1;
        setDuration((d) => d + 1);
      }, 1000);
    } catch {
      // Mic access denied — silently fail
    }
  }, [disabled, state]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (recorder) {
      recorder.ondataavailable = null;
      recorder.onstop = null;
      recorder.stream.getTracks().forEach((t) => t.stop());
      recorder.stop();
      mediaRecorderRef.current = null;
    }
    chunksRef.current = [];
    durationRef.current = 0;
    setDuration(0);
    setState('idle');
  }, []);

  const stopAndSend = useCallback(() => {
    clearTimer();
    const recorder = mediaRecorderRef.current;
    if (!recorder) return;

    const capturedDuration = durationRef.current;

    recorder.onstop = async () => {
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
      mediaRecorderRef.current = null;
      chunksRef.current = [];
      durationRef.current = 0;
      setDuration(0);

      if (blob.size > 0 && capturedDuration >= 1) {
        setState('sending');
        try {
          await onSend(blob, capturedDuration, recorder.mimeType);
        } catch {
          // error toast handled upstream
        }
      }
      setState('idle');
    };

    recorder.stream.getTracks().forEach((t) => t.stop());
    recorder.stop();
  }, [onSend]);

  useEffect(() => {
    return () => {
      clearTimer();
      mediaRecorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const formatDuration = (s: number) =>
    `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  if (state === 'recording') {
    return (
      <div className="flex items-center gap-2 flex-1">
        {/* Recording indicator bar */}
        <div className="flex-1 flex items-center gap-2 px-3 py-2 rounded-full bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-800">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse shrink-0" />
          <span className="font-mono text-sm text-red-600 dark:text-red-400 tabular-nums">
            {formatDuration(duration)}
          </span>
          <span className="flex-1 text-xs text-red-500/70 text-center">Recording…</span>
        </div>

        {/* Cancel */}
        <button
          onClick={cancelRecording}
          className="w-9 h-9 rounded-full flex items-center justify-center bg-gray-100 dark:bg-gray-800 text-muted-foreground hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors shrink-0"
          title="Cancel"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Stop & Send */}
        <button
          onClick={stopAndSend}
          className="w-10 h-10 rounded-full flex items-center justify-center bg-primary text-white hover:bg-primary/90 transition-colors shrink-0"
          title="Send voice note"
        >
          <Square className="w-4 h-4 fill-current" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={startRecording}
      disabled={disabled || state === 'sending'}
      className={cn(
        'w-9 h-9 rounded-full flex items-center justify-center transition-colors shrink-0',
        'bg-gray-100 dark:bg-gray-800 text-muted-foreground',
        'hover:bg-gray-200 dark:hover:bg-gray-700',
        'disabled:opacity-40',
      )}
      title="Record voice note"
    >
      {state === 'sending' ? (
        <div className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      ) : (
        <Mic className="w-4 h-4" />
      )}
    </button>
  );
}
