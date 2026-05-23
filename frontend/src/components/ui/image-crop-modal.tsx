'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut } from 'lucide-react';

const CW = 480; // crop viewport width (px)
const CH = 320; // crop viewport height (px)
const PAD = 24;  // padding from viewport edge to crop frame

interface Props {
  file: File | null;
  /** w/h ratio — 1 = square, 16/9 = landscape. Omit for free-form. */
  aspectRatio?: number;
  onCrop: (croppedFile: File) => void;
  onClose: () => void;
}

export function ImageCropModal({ file, aspectRatio, onCrop, onClose }: Props) {
  const [src, setSrc] = useState('');
  const [nw, setNw] = useState(0);
  const [nh, setNh] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [pos, setPos] = useState({ x: 0, y: 0 });
  const dragging = useRef(false);
  const dragOrigin = useRef({ mx: 0, my: 0, ox: 0, oy: 0 });

  // ── frame geometry ────────────────────────────────────────────────────────
  const frameW = CW - PAD * 2;
  const rawH = aspectRatio ? frameW / aspectRatio : CH - PAD * 2;
  const frameH = Math.min(rawH, CH - PAD * 2);
  const frameX = PAD;
  const frameY = (CH - frameH) / 2;

  // ── image source ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setSrc(''); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  // ── helpers ───────────────────────────────────────────────────────────────
  const minZoom = nw ? Math.max(frameW / nw, frameH / nh) : 1;
  const maxZoom = minZoom * 5;

  const clamp = useCallback((ox: number, oy: number, z: number) => ({
    x: Math.min(frameX, Math.max(frameX + frameW - nw * z, ox)),
    y: Math.min(frameY, Math.max(frameY + frameH - nh * z, oy)),
  }), [nw, nh, frameX, frameY, frameW, frameH]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    setNw(iw); setNh(ih);
    const z = Math.max(frameW / iw, frameH / ih);
    setZoom(z);
    setPos({ x: frameX + (frameW - iw * z) / 2, y: frameY + (frameH - ih * z) / 2 });
  };

  // ── drag (mouse) ──────────────────────────────────────────────────────────
  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true;
    dragOrigin.current = { mx: e.clientX, my: e.clientY, ox: pos.x, oy: pos.y };
    e.preventDefault();
  };

  useEffect(() => {
    const move = (e: MouseEvent) => {
      if (!dragging.current) return;
      const { mx, my, ox, oy } = dragOrigin.current;
      setPos(prev => clamp(ox + e.clientX - mx, oy + e.clientY - my, zoom));
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return () => { window.removeEventListener('mousemove', move); window.removeEventListener('mouseup', up); };
  }, [zoom, clamp]);

  // ── drag (touch) ─────────────────────────────────────────────────────────
  const onTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    dragging.current = true;
    dragOrigin.current = { mx: t.clientX, my: t.clientY, ox: pos.x, oy: pos.y };
  };

  useEffect(() => {
    const move = (e: TouchEvent) => {
      if (!dragging.current) return;
      const t = e.touches[0];
      const { mx, my, ox, oy } = dragOrigin.current;
      setPos(prev => clamp(ox + t.clientX - mx, oy + t.clientY - my, zoom));
      e.preventDefault();
    };
    const up = () => { dragging.current = false; };
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', up);
    return () => { window.removeEventListener('touchmove', move); window.removeEventListener('touchend', up); };
  }, [zoom, clamp]);

  // ── zoom slider ───────────────────────────────────────────────────────────
  const onZoom = (vals: number[]) => {
    const z = vals[0];
    // Zoom around crop-frame centre so it stays centred
    const cx = frameX + frameW / 2;
    const cy = frameY + frameH / 2;
    const rx = (cx - pos.x) / zoom;
    const ry = (cy - pos.y) / zoom;
    setZoom(z);
    setPos(clamp(cx - rx * z, cy - ry * z, z));
  };

  // ── apply crop ────────────────────────────────────────────────────────────
  const apply = () => {
    if (!nw || !src) return;
    const srcX = (frameX - pos.x) / zoom;
    const srcY = (frameY - pos.y) / zoom;
    const srcW = frameW / zoom;
    const srcH = frameH / zoom;

    // Output: 2× for retina, capped at source resolution
    const outW = Math.round(Math.min(srcW * 2, nw));
    const outH = Math.round(Math.min(srcH * 2, nh));

    const canvas = document.createElement('canvas');
    canvas.width = outW;
    canvas.height = outH;
    const ctx = canvas.getContext('2d')!;
    const img = new window.Image();
    img.onload = () => {
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, outW, outH);
      canvas.toBlob(
        (blob) => {
          if (!blob) return;
          onCrop(new File([blob], file!.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' }));
        },
        'image/jpeg',
        0.92,
      );
    };
    img.src = src;
  };

  if (!file) return null;

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[556px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>Crop Image</DialogTitle>
          <p className="text-xs text-muted-foreground">Drag to reposition · Use the slider to zoom</p>
        </DialogHeader>

        {/* ── Crop viewport ─────────────────────────────────────────────── */}
        <div
          style={{ width: CW, height: CH, maxWidth: '100%' }}
          className="relative overflow-hidden bg-zinc-900 cursor-grab active:cursor-grabbing select-none mx-auto"
          onMouseDown={onMouseDown}
          onTouchStart={onTouchStart}
        >
          {src && (
            <img
              src={src}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: pos.x,
                top: pos.y,
                width: nw * zoom,
                height: nh * zoom,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* dim mask + crop frame */}
          <div className="absolute inset-0 pointer-events-none">
            {/* top */}
            <div style={{ position: 'absolute', inset: 0, bottom: CH - frameY, background: 'rgba(0,0,0,0.55)' }} />
            {/* bottom */}
            <div style={{ position: 'absolute', inset: 0, top: frameY + frameH, background: 'rgba(0,0,0,0.55)' }} />
            {/* left */}
            <div style={{ position: 'absolute', top: frameY, height: frameH, left: 0, width: frameX, background: 'rgba(0,0,0,0.55)' }} />
            {/* right */}
            <div style={{ position: 'absolute', top: frameY, height: frameH, left: frameX + frameW, right: 0, background: 'rgba(0,0,0,0.55)' }} />

            {/* crop frame */}
            <div style={{ position: 'absolute', top: frameY, left: frameX, width: frameW, height: frameH, border: '2px solid white', boxSizing: 'border-box' }}>
              {/* rule-of-thirds lines */}
              <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
              <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
              {/* corner handles */}
              <div style={{ position: 'absolute', top: -3, left: -3, width: 14, height: 14, borderTop: '3px solid white', borderLeft: '3px solid white' }} />
              <div style={{ position: 'absolute', top: -3, right: -3, width: 14, height: 14, borderTop: '3px solid white', borderRight: '3px solid white' }} />
              <div style={{ position: 'absolute', bottom: -3, left: -3, width: 14, height: 14, borderBottom: '3px solid white', borderLeft: '3px solid white' }} />
              <div style={{ position: 'absolute', bottom: -3, right: -3, width: 14, height: 14, borderBottom: '3px solid white', borderRight: '3px solid white' }} />
            </div>
          </div>
        </div>

        {/* ── Zoom slider ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider
            min={minZoom}
            max={maxZoom}
            step={0.005}
            value={[zoom]}
            onValueChange={onZoom}
            className="flex-1"
          />
          <ZoomIn className="w-4 h-4 text-muted-foreground shrink-0" />
        </div>

        <div className="flex justify-end gap-2 px-6 pb-5">
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={apply} disabled={!nw}>Apply &amp; Upload</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
