'use client';

import { useEffect, useState, useCallback } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { api } from '@/lib/api';
import { Ticket, X } from 'lucide-react';

interface RaffleCode {
  id: string;
  code: string;
  sentAt: string | null;
  redeemedAt: string | null;
  session: {
    id: string;
    name: string;
    description: string | null;
    isPublished: boolean;
  };
}

const DISMISSED_KEY = 'rms_dismissed_raffle_codes';

function getDismissed(): string[] {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || '[]');
  } catch {
    return [];
  }
}

function dismiss(codeId: string) {
  const current = getDismissed();
  if (!current.includes(codeId)) {
    localStorage.setItem(DISMISSED_KEY, JSON.stringify([...current, codeId]));
  }
}

export function RaffleCodeModal() {
  const [codes, setCodes] = useState<RaffleCode[]>([]);
  const [current, setCurrent] = useState<RaffleCode | null>(null);
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await api.get<{ data: RaffleCode[] }>('/raffle/my-active-code');
      const all: RaffleCode[] = res.data?.data ?? (res.data as any) ?? [];
      const dismissed = getDismissed();
      const pending = all.filter((c) => !dismissed.includes(c.id) && c.session?.isPublished);
      setCodes(pending);
      if (pending.length > 0) {
        setCurrent(pending[0]);
        setIndex(0);
        setOpen(true);
      }
    } catch {
      // silently ignore — user may not have any codes
    }
  }, []);

  useEffect(() => {
    fetchCodes();
  }, [fetchCodes]);

  const handleDismiss = () => {
    if (!current) return;
    dismiss(current.id);
    const next = codes.filter((c) => c.id !== current.id);
    setCodes(next);
    if (next.length > 0) {
      const nextIndex = Math.min(index, next.length - 1);
      setCurrent(next[nextIndex]);
      setIndex(nextIndex);
    } else {
      setOpen(false);
      setCurrent(null);
    }
  };

  if (!current) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleDismiss(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 shadow-2xl" hideClose>
        {/* Header */}
        <div className="bg-gradient-to-br from-blue-600 to-indigo-700 px-6 pt-6 pb-8 text-white relative">
          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 text-white/70 hover:text-white transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
              <Ticket className="w-5 h-5 text-white" />
            </div>
            <div>
              <p className="text-xs text-blue-200 uppercase tracking-wider font-medium">Raffle Code</p>
              <p className="font-semibold text-sm leading-tight">{current.session.name}</p>
            </div>
          </div>
        </div>

        {/* Code card */}
        <div className="px-6 -mt-4">
          <div className="bg-card border border-border rounded-xl shadow-sm p-5 text-center">
            <p className="text-xs text-muted-foreground mb-2">Your unique code</p>
            <p className="text-3xl font-bold tracking-widest font-mono text-blue-600 dark:text-blue-400 select-all">
              {current.code}
            </p>
            {current.redeemedAt && (
              <span className="mt-2 inline-block text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 px-2 py-0.5 rounded-full">
                Redeemed
              </span>
            )}
          </div>
        </div>

        {/* Body */}
        <div className="px-6 py-4">
          {current.session.description && (
            <p className="text-sm text-muted-foreground text-center mb-4">{current.session.description}</p>
          )}
          <p className="text-xs text-muted-foreground text-center mb-4">
            Keep this code safe — you may be asked to present it during the draw.
          </p>

          {codes.length > 1 && (
            <p className="text-xs text-center text-muted-foreground mb-3">
              {index + 1} of {codes.length} active codes
            </p>
          )}

          <div className="flex gap-2">
            {codes.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => {
                  const nextIdx = (index + 1) % codes.length;
                  setIndex(nextIdx);
                  setCurrent(codes[nextIdx]);
                }}
              >
                Next code
              </Button>
            )}
            <Button size="sm" className="flex-1" onClick={handleDismiss}>
              Got it
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
