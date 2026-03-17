'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowLeft,
  Loader2,
  QrCode,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Camera,
  RefreshCw,
  Users,
  Clock,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import Link from 'next/link';

interface CheckInResult {
  alreadyCheckedIn: boolean;
  checkedInAt: string | null;
  registrationCode: string;
  eventTitle?: string;
  message: string;
}

interface Analytics {
  viewsCount: number;
  registrationsCount: number;
  checkinsCount: number;
  conversionRate: number;
}

type ScanState = 'idle' | 'processing' | 'success' | 'duplicate' | 'error';

// ── RECENT CHECK-INS LIST ───────────────────────────────────────────────────

interface RecentItem {
  id: string;
  code: string;
  time: string;
  duplicate: boolean;
}

export default function CheckInPage() {
  const params = useParams<{ id: string }>();
  const eventId = params?.id || '';

  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [scanState, setScanState] = useState<ScanState>('idle');
  const [lastResult, setLastResult] = useState<CheckInResult | null>(null);
  const [manualToken, setManualToken] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const [recent, setRecent] = useState<RecentItem[]>([]);
  const scannerRef = useRef<HTMLDivElement>(null);
  const html5QrCodeRef = useRef<any>(null);
  const cooldownRef = useRef(false);

  const fetchAnalytics = useCallback(async () => {
    try {
      const res = await api.get<{ data: Analytics }>(`/events/${eventId}/analytics`);
      setAnalytics(res.data);
    } catch { /* silent */ }
  }, [eventId]);

  useEffect(() => {
    fetchAnalytics();
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, [fetchAnalytics]);

  // ── Process check-in (shared between manual + scanner) ───────────────────

  const processCheckIn = useCallback(
    async (token: string) => {
      if (cooldownRef.current || !token.trim()) return;
      cooldownRef.current = true;
      setScanState('processing');

      try {
        const res = await api.post<{ data: CheckInResult }>('/events/checkin', {
          qrToken: token.trim(),
        });
        const result = res.data;
        setLastResult(result);
        setScanState(result.alreadyCheckedIn ? 'duplicate' : 'success');

        setRecent((prev) => [
          {
            id: Date.now().toString(),
            code: result.registrationCode,
            time: new Date().toLocaleTimeString(),
            duplicate: result.alreadyCheckedIn,
          },
          ...prev.slice(0, 19),
        ]);

        if (!result.alreadyCheckedIn) {
          toast.success(`✓ ${result.registrationCode} checked in`);
          fetchAnalytics();
        } else {
          toast.warning(`Already checked in: ${result.registrationCode}`);
        }
      } catch (err: any) {
        setScanState('error');
        setLastResult(null);
        toast.error(err.message || 'Invalid QR code');
      } finally {
        // Reset after 3 seconds to allow next scan
        setTimeout(() => {
          setScanState('idle');
          cooldownRef.current = false;
        }, 3000);
      }
    },
    [fetchAnalytics],
  );

  // ── QR Scanner (html5-qrcode) ────────────────────────────────────────────

  const startScanner = useCallback(async () => {
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      if (!scannerRef.current) return;
      html5QrCodeRef.current = new Html5Qrcode('qr-scanner-container');
      await html5QrCodeRef.current.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText: string) => processCheckIn(decodedText),
        undefined,
      );
      setScannerActive(true);
    } catch (err: any) {
      toast.error(err.message || 'Camera not available');
    }
  }, [processCheckIn]);

  const stopScanner = useCallback(async () => {
    try {
      if (html5QrCodeRef.current) {
        await html5QrCodeRef.current.stop();
        html5QrCodeRef.current = null;
      }
    } catch { /* ignore */ }
    setScannerActive(false);
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  // ── Manual submission ─────────────────────────────────────────────────────

  async function handleManualSubmit(e: React.FormEvent) {
    e.preventDefault();
    await processCheckIn(manualToken);
    setManualToken('');
  }

  // ── Scan result overlay ───────────────────────────────────────────────────

  const scanResultConfig = {
    success: {
      icon: CheckCircle2,
      color: 'text-green-500',
      bg: 'bg-green-50 border-green-200',
      label: 'Check-in Successful',
    },
    duplicate: {
      icon: AlertTriangle,
      color: 'text-orange-500',
      bg: 'bg-orange-50 border-orange-200',
      label: 'Already Checked In',
    },
    error: {
      icon: XCircle,
      color: 'text-red-500',
      bg: 'bg-red-50 border-red-200',
      label: 'Invalid QR Code',
    },
    processing: {
      icon: Loader2,
      color: 'text-blue-500',
      bg: 'bg-blue-50 border-blue-200',
      label: 'Processing…',
    },
    idle: null,
  };

  const currentConfig = scanResultConfig[scanState];

  return (
    <div className="max-w-2xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/admin/events/${eventId}`}>
          <Button variant="ghost" size="icon">
            <ArrowLeft className="w-4 h-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-xl font-bold text-gray-900">QR Check-in Scanner</h1>
          <p className="text-sm text-gray-500">Scan attendee QR codes to check them in</p>
        </div>
      </div>

      {/* Live analytics */}
      {analytics && (
        <div className="grid grid-cols-3 gap-3">
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-blue-600">{analytics.registrationsCount}</div>
              <div className="text-xs text-gray-500">Registered</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-green-600">{analytics.checkinsCount}</div>
              <div className="text-xs text-gray-500">Checked In</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4 pb-3 text-center">
              <div className="text-2xl font-bold text-purple-600">
                {analytics.registrationsCount > 0
                  ? Math.round((analytics.checkinsCount / analytics.registrationsCount) * 100)
                  : 0}%
              </div>
              <div className="text-xs text-gray-500">Attendance</div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Scanner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Camera className="w-4 h-4" />
              Camera Scanner
            </CardTitle>
            <Button
              variant={scannerActive ? 'destructive' : 'default'}
              size="sm"
              onClick={scannerActive ? stopScanner : startScanner}
              className="gap-1.5"
            >
              {scannerActive ? (
                <><XCircle className="w-4 h-4" /> Stop Camera</>
              ) : (
                <><Camera className="w-4 h-4" /> Start Camera</>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="relative">
            <div
              id="qr-scanner-container"
              ref={scannerRef}
              className={`w-full rounded-lg overflow-hidden bg-black ${
                scannerActive ? 'min-h-64' : 'hidden'
              }`}
            />

            {!scannerActive && (
              <div className="flex flex-col items-center gap-3 py-10 text-gray-400 border-2 border-dashed rounded-lg">
                <QrCode className="w-12 h-12" />
                <p className="text-sm">Click "Start Camera" to begin scanning</p>
              </div>
            )}

            {/* Result overlay */}
            <AnimatePresence>
              {scanState !== 'idle' && scannerActive && currentConfig && (
                <motion.div
                  key={scanState}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={`absolute inset-0 flex flex-col items-center justify-center rounded-lg border-2 ${currentConfig.bg} backdrop-blur-sm gap-3`}
                >
                  {scanState === 'processing' ? (
                    <Loader2 className={`w-12 h-12 animate-spin ${currentConfig.color}`} />
                  ) : (
                    <currentConfig.icon className={`w-16 h-16 ${currentConfig.color}`} />
                  )}
                  <p className={`font-semibold text-lg ${currentConfig.color}`}>
                    {currentConfig.label}
                  </p>
                  {lastResult && (
                    <p className="font-mono text-sm text-gray-600">
                      {lastResult.registrationCode}
                    </p>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </CardContent>
      </Card>

      {/* Manual entry */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Manual Token Entry</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <Input
              placeholder="Scan code or enter EVT-... registration code"
              value={manualToken}
              onChange={(e) => setManualToken(e.target.value)}
              className="font-mono text-xs"
            />
            <Button
              type="submit"
              disabled={!manualToken.trim() || scanState === 'processing'}
              className="gap-1.5 flex-shrink-0"
            >
              {scanState === 'processing' ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              Check In
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Result card (non-scanner) */}
      <AnimatePresence>
        {scanState !== 'idle' && !scannerActive && currentConfig && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <Card className={`border-2 ${currentConfig.bg}`}>
              <CardContent className="pt-5 pb-4 flex items-center gap-4">
                {scanState === 'processing' ? (
                  <Loader2 className={`w-8 h-8 animate-spin flex-shrink-0 ${currentConfig.color}`} />
                ) : (
                  <currentConfig.icon className={`w-8 h-8 flex-shrink-0 ${currentConfig.color}`} />
                )}
                <div>
                  <p className={`font-semibold ${currentConfig.color}`}>{currentConfig.label}</p>
                  {lastResult && (
                    <>
                      <p className="font-mono text-xs text-gray-600 mt-0.5">
                        {lastResult.registrationCode}
                      </p>
                      {lastResult.checkedInAt && (
                        <p className="text-xs text-gray-500 flex items-center gap-1 mt-0.5">
                          <Clock className="w-3 h-3" />
                          {new Date(lastResult.checkedInAt).toLocaleTimeString()}
                        </p>
                      )}
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recent check-ins */}
      {recent.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Recent Check-ins</CardTitle>
              <Button variant="ghost" size="icon" onClick={() => setRecent([])}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {recent.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between text-sm py-1.5 border-b last:border-0"
              >
                <span className="font-mono text-xs text-gray-600">{item.code}</span>
                <div className="flex items-center gap-2">
                  {item.duplicate ? (
                    <Badge variant="outline" className="text-orange-600 border-orange-300 text-xs">
                      duplicate
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-green-600 border-green-300 text-xs">
                      ✓ checked in
                    </Badge>
                  )}
                  <span className="text-xs text-gray-400">{item.time}</span>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
