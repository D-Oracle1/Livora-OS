'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { QrCode, CameraOff, X, Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface QrScannerModalProps {
  open: boolean;
  onClose: () => void;
  onScanned: (token: string) => void;
}

declare class BarcodeDetector {
  constructor(options?: { formats: string[] });
  detect(image: ImageBitmapSource): Promise<Array<{ rawValue: string }>>;
  static getSupportedFormats(): Promise<string[]>;
}

const hasBarcodeDetector = typeof window !== 'undefined' && 'BarcodeDetector' in window;

export function QrScannerModal({ open, onClose, onScanned }: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const detectorRef = useRef<BarcodeDetector | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [starting, setStarting] = useState(true);
  const [mode, setMode] = useState<'camera' | 'file'>('camera');

  const stopAll = useCallback(() => {
    if (rafRef.current != null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  }, []);

  const startCamera = useCallback(async () => {
    setCameraError(null);
    setStarting(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
      });
      streamRef.current = stream;

      if (!videoRef.current) { stream.getTracks().forEach(t => t.stop()); return; }
      videoRef.current.srcObject = stream;
      await videoRef.current.play();

      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      detectorRef.current = detector;
      setStarting(false);

      const scan = async () => {
        if (!videoRef.current || videoRef.current.readyState < 2) {
          rafRef.current = requestAnimationFrame(scan);
          return;
        }
        try {
          const results = await detector.detect(videoRef.current);
          if (results.length > 0) {
            stopAll();
            onScanned(results[0].rawValue);
            return;
          }
        } catch {
          // frame not ready — continue
        }
        rafRef.current = requestAnimationFrame(scan);
      };
      rafRef.current = requestAnimationFrame(scan);
    } catch (err: any) {
      setCameraError(
        err?.name === 'NotAllowedError'
          ? 'Camera permission denied. Please allow camera access and try again.'
          : 'Could not start camera. Try uploading an image of the QR code instead.',
      );
      setStarting(false);
    }
  }, [onScanned, stopAll]);

  useEffect(() => {
    if (!open) { stopAll(); return; }
    if (hasBarcodeDetector) {
      setMode('camera');
      startCamera();
    } else {
      setMode('file');
      setStarting(false);
    }
    return stopAll;
  }, [open]);  // eslint-disable-line react-hooks/exhaustive-deps

  const handleClose = () => { stopAll(); onClose(); };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!hasBarcodeDetector) {
      setCameraError('QR scanning not supported on this browser. Ask admin for the token.');
      return;
    }
    try {
      setStarting(true);
      const bitmap = await createImageBitmap(file);
      const detector = new BarcodeDetector({ formats: ['qr_code'] });
      const results = await detector.detect(bitmap);
      setStarting(false);
      if (results.length > 0) {
        onScanned(results[0].rawValue);
      } else {
        setCameraError('No QR code found in image. Try a clearer photo.');
      }
    } catch {
      setStarting(false);
      setCameraError('Could not read QR code from image.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <QrCode className="w-5 h-5" />
            Scan Attendance QR Code
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 p-2">
          <p className="text-sm text-center text-muted-foreground">
            {mode === 'camera'
              ? 'Point your camera at the QR code displayed by your admin to clock in.'
              : 'Take a photo of the QR code or upload an image to clock in.'}
          </p>

          {cameraError ? (
            <div className="flex flex-col items-center gap-3 py-4 text-center">
              <CameraOff className="w-12 h-12 text-muted-foreground" />
              <p className="text-sm text-destructive">{cameraError}</p>
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileInputRef.current?.click()}
                className="gap-2"
              >
                <Upload className="w-4 h-4" />
                Upload QR Image
              </Button>
            </div>
          ) : mode === 'camera' ? (
            <div className="relative w-full rounded-lg overflow-hidden bg-black" style={{ minHeight: 260 }}>
              {starting && (
                <div className="absolute inset-0 flex items-center justify-center z-10">
                  <Loader2 className="w-8 h-8 animate-spin text-white" />
                </div>
              )}
              {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
              <video
                ref={videoRef}
                playsInline
                muted
                className="w-full h-full object-cover"
                style={{ minHeight: 260 }}
              />
              {/* scanner overlay */}
              {!starting && (
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-44 h-44 border-2 border-white rounded-lg opacity-80" />
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 py-6">
              {starting ? (
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              ) : (
                <Button
                  variant="outline"
                  size="lg"
                  onClick={() => fileInputRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="w-5 h-5" />
                  Select QR Code Image
                </Button>
              )}
            </div>
          )}

          {/* hidden file input for image upload fallback */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={handleFileChange}
          />

          <Button variant="outline" className="w-full gap-2" onClick={handleClose}>
            <X className="w-4 h-4" />
            Cancel
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
