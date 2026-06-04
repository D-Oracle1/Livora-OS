'use client';

import { useEffect, useRef, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { ZoomIn, ZoomOut } from 'lucide-react';

const CW = 480;  // crop viewport width (px)
const CH = 360;  // crop viewport height (px)
const MIN = 40;  // min crop-box edge (px)
const HS = 14;   // handle hit-size (px)

type Rect = { x: number; y: number; w: number; h: number };

const PRESETS: { label: string; value: number | null }[] = [
  { label: 'Free', value: null },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '3:4', value: 3 / 4 },
];

const ALL_HANDLES = ['nw', 'n', 'ne', 'e', 'se', 's', 'sw', 'w'] as const;
const CORNER_HANDLES = ['nw', 'ne', 'se', 'sw'] as const;
type Handle = (typeof ALL_HANDLES)[number];

const clampN = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const CURSORS: Record<Handle, string> = {
  nw: 'nwse-resize', se: 'nwse-resize',
  ne: 'nesw-resize', sw: 'nesw-resize',
  n: 'ns-resize', s: 'ns-resize',
  e: 'ew-resize', w: 'ew-resize',
};

interface Props {
  file: File | null;
  /** Initial aspect-ratio preset (w/h). Omit for free-form. */
  aspectRatio?: number;
  onCrop: (croppedFile: File) => void;
  onClose: () => void;
}

/** Largest rect of the given aspect that fits inside `ir`, centred, at 90%. */
function fitBox(aspect: number | null, ir: Rect): Rect {
  let w = ir.w * 0.9;
  let h = ir.h * 0.9;
  if (aspect) {
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
  }
  return { x: ir.x + (ir.w - w) / 2, y: ir.y + (ir.h - h) / 2, w, h };
}

/** Keep a box inside the image rect, preserving aspect if locked. */
function clampBox(box: Rect, ir: Rect, aspect: number | null): Rect {
  let w = Math.min(box.w, ir.w);
  let h = Math.min(box.h, ir.h);
  if (aspect) {
    if (w / h > aspect) w = h * aspect;
    else h = w / aspect;
  }
  const x = clampN(box.x, ir.x, ir.x + ir.w - w);
  const y = clampN(box.y, ir.y, ir.y + ir.h - h);
  return { x, y, w, h };
}

export function ImageCropModal({ file, aspectRatio, onCrop, onClose }: Props) {
  const [src, setSrc] = useState('');
  const [nw, setNw] = useState(0);
  const [nh, setNh] = useState(0);
  const [zoom, setZoom] = useState(1);
  const [imgRect, setImgRect] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [box, setBox] = useState<Rect>({ x: 0, y: 0, w: 0, h: 0 });
  const [aspect, setAspect] = useState<number | null>(aspectRatio ?? null);

  const baseScale = useRef(1); // px-per-image-px at zoom = 1 (fit to viewport)

  // Live mirror of state for the global pointer handlers (avoids stale closures).
  const live = useRef({ box, imgRect, zoom, aspect, nw, nh });
  live.current = { box, imgRect, zoom, aspect, nw, nh };

  // Active drag gesture.
  const drag = useRef<
    | { mode: 'move' | 'pan'; sx: number; sy: number; box0: Rect; img0: Rect }
    | { mode: 'resize'; handle: Handle; sx: number; sy: number; box0: Rect; ir: Rect; aspect: number | null }
    | null
  >(null);

  // ── image source ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (!file) { setSrc(''); return; }
    const url = URL.createObjectURL(file);
    setSrc(url);
    setAspect(aspectRatio ?? null);
    setZoom(1);
    return () => URL.revokeObjectURL(url);
  }, [file, aspectRatio]);

  const onImgLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const iw = img.naturalWidth;
    const ih = img.naturalHeight;
    setNw(iw); setNh(ih);
    const bs = Math.min(CW / iw, CH / ih);
    baseScale.current = bs;
    const ir: Rect = { x: (CW - iw * bs) / 2, y: (CH - ih * bs) / 2, w: iw * bs, h: ih * bs };
    setImgRect(ir);
    setBox(fitBox(aspectRatio ?? null, ir));
    setZoom(1);
  };

  // ── global pointer move / up ────────────────────────────────────────────────
  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const dx = e.clientX - d.sx;
      const dy = e.clientY - d.sy;
      const { imgRect: ir, box: curBox } = live.current;

      if (d.mode === 'move') {
        setBox({
          x: clampN(d.box0.x + dx, ir.x, ir.x + ir.w - d.box0.w),
          y: clampN(d.box0.y + dy, ir.y, ir.y + ir.h - d.box0.h),
          w: d.box0.w,
          h: d.box0.h,
        });
        return;
      }

      if (d.mode === 'pan') {
        const nx = clampN(d.img0.x + dx, curBox.x + curBox.w - d.img0.w, curBox.x);
        const ny = clampN(d.img0.y + dy, curBox.y + curBox.h - d.img0.h, curBox.y);
        setImgRect({ ...d.img0, x: nx, y: ny });
        return;
      }

      if (d.mode !== 'resize') return;
      const { handle, box0, ir: rir, aspect: a } = d;
      const right0 = box0.x + box0.w;
      const bottom0 = box0.y + box0.h;

      if (a) {
        // aspect-locked: corner handles only, anchored at the opposite corner.
        const dirX = handle.includes('e') ? 1 : -1;
        const dirY = handle.includes('s') ? 1 : -1;
        const anchorX = dirX > 0 ? box0.x : right0;
        const anchorY = dirY > 0 ? box0.y : bottom0;
        const cornerX = (dirX > 0 ? right0 : box0.x) + dx;
        const cornerY = (dirY > 0 ? bottom0 : box0.y) + dy;
        let w = Math.abs(cornerX - anchorX);
        let h = Math.abs(cornerY - anchorY);
        if (w / h > a) w = h * a; else h = w / a;
        const maxW = dirX > 0 ? rir.x + rir.w - anchorX : anchorX - rir.x;
        const maxH = dirY > 0 ? rir.y + rir.h - anchorY : anchorY - rir.y;
        if (w > maxW) { w = maxW; h = w / a; }
        if (h > maxH) { h = maxH; w = h * a; }
        if (w < MIN) { w = MIN; h = w / a; }
        const x = dirX > 0 ? anchorX : anchorX - w;
        const y = dirY > 0 ? anchorY : anchorY - h;
        setBox({ x, y, w, h });
        return;
      }

      // free-form: only the edges named in the handle move; opposite edges stay.
      let left = box0.x, right = right0, top = box0.y, bottom = bottom0;
      if (handle.includes('w')) left = clampN(box0.x + dx, rir.x, right - MIN);
      if (handle.includes('e')) right = clampN(right0 + dx, left + MIN, rir.x + rir.w);
      if (handle.includes('n')) top = clampN(box0.y + dy, rir.y, bottom - MIN);
      if (handle.includes('s')) bottom = clampN(bottom0 + dy, top + MIN, rir.y + rir.h);
      setBox({ x: left, y: top, w: right - left, h: bottom - top });
    };

    const up = () => { drag.current = null; };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    return () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
  }, []);

  // ── gesture starters ────────────────────────────────────────────────────────
  const startMove = (e: React.PointerEvent) => {
    e.stopPropagation();
    drag.current = { mode: 'move', sx: e.clientX, sy: e.clientY, box0: { ...box }, img0: { ...imgRect } };
  };
  const startResize = (e: React.PointerEvent, handle: Handle) => {
    e.stopPropagation();
    drag.current = { mode: 'resize', handle, sx: e.clientX, sy: e.clientY, box0: { ...box }, ir: { ...imgRect }, aspect };
  };
  const startPan = (e: React.PointerEvent) => {
    drag.current = { mode: 'pan', sx: e.clientX, sy: e.clientY, box0: { ...box }, img0: { ...imgRect } };
  };

  // ── zoom (scales the image about the crop-box centre) ─────────────────────────
  const onZoom = (vals: number[]) => {
    const z = vals[0];
    if (!nw) return;
    const cx = box.x + box.w / 2;
    const cy = box.y + box.h / 2;
    const newW = nw * baseScale.current * z;
    const newH = nh * baseScale.current * z;
    const ratio = newW / imgRect.w;
    let nir: Rect = { x: cx - (cx - imgRect.x) * ratio, y: cy - (cy - imgRect.y) * ratio, w: newW, h: newH };
    const nbox = clampBox(box, nir, aspect);
    nir = {
      ...nir,
      x: clampN(nir.x, nbox.x + nbox.w - nir.w, nbox.x),
      y: clampN(nir.y, nbox.y + nbox.h - nir.h, nbox.y),
    };
    setZoom(z);
    setImgRect(nir);
    setBox(nbox);
  };

  const pickPreset = (value: number | null) => {
    setAspect(value);
    setBox(fitBox(value, imgRect));
  };

  // ── apply crop ──────────────────────────────────────────────────────────────
  const apply = () => {
    if (!nw || !src) return;
    const scale = imgRect.w / nw; // px-per-source-px currently displayed
    const srcX = clampN((box.x - imgRect.x) / scale, 0, nw);
    const srcY = clampN((box.y - imgRect.y) / scale, 0, nh);
    const srcW = clampN(box.w / scale, 1, nw - srcX);
    const srcH = clampN(box.h / scale, 1, nh - srcY);

    // Output at up to 2× for retina, capped at source resolution (ratio-preserving).
    let outScale = 2;
    if (srcW * outScale > nw) outScale = nw / srcW;
    if (srcH * outScale > nh) outScale = Math.min(outScale, nh / srcH);
    const outW = Math.max(1, Math.round(srcW * outScale));
    const outH = Math.max(1, Math.round(srcH * outScale));

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

  const handles = aspect ? CORNER_HANDLES : ALL_HANDLES;
  const handlePos = (h: Handle) => {
    const cx = h.includes('w') ? box.x : h.includes('e') ? box.x + box.w : box.x + box.w / 2;
    const cy = h.includes('n') ? box.y : h.includes('s') ? box.y + box.h : box.y + box.h / 2;
    return { left: cx - HS / 2, top: cy - HS / 2 };
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[556px] p-0 gap-0 overflow-hidden">
        <DialogHeader className="px-6 pt-5 pb-3">
          <DialogTitle>Crop Image</DialogTitle>
          <p className="text-xs text-muted-foreground">Drag the frame to move · drag handles to resize · drag the photo to reposition</p>
        </DialogHeader>

        {/* ── Aspect presets ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 px-6 pb-3">
          {PRESETS.map((p) => (
            <Button
              key={p.label}
              type="button"
              size="sm"
              variant={aspect === p.value ? 'default' : 'outline'}
              className="h-7 px-3 text-xs"
              onClick={() => pickPreset(p.value)}
            >
              {p.label}
            </Button>
          ))}
        </div>

        {/* ── Crop viewport ─────────────────────────────────────────────── */}
        <div
          style={{ width: CW, height: CH, maxWidth: '100%' }}
          className="relative overflow-hidden bg-zinc-900 select-none mx-auto touch-none cursor-grab active:cursor-grabbing"
          onPointerDown={startPan}
        >
          {src && (
            <img
              src={src}
              alt=""
              onLoad={onImgLoad}
              draggable={false}
              style={{
                position: 'absolute',
                left: imgRect.x,
                top: imgRect.y,
                width: imgRect.w,
                height: imgRect.h,
                pointerEvents: 'none',
              }}
            />
          )}

          {/* dim mask (4 strips around the crop box) */}
          <div className="absolute inset-0 pointer-events-none">
            <div style={{ position: 'absolute', inset: 0, bottom: CH - box.y, background: 'rgba(0,0,0,0.55)' }} />
            <div style={{ position: 'absolute', inset: 0, top: box.y + box.h, background: 'rgba(0,0,0,0.55)' }} />
            <div style={{ position: 'absolute', top: box.y, height: box.h, left: 0, width: box.x, background: 'rgba(0,0,0,0.55)' }} />
            <div style={{ position: 'absolute', top: box.y, height: box.h, left: box.x + box.w, right: 0, background: 'rgba(0,0,0,0.55)' }} />
          </div>

          {/* crop frame — drag body to move */}
          <div
            onPointerDown={startMove}
            style={{
              position: 'absolute', top: box.y, left: box.x, width: box.w, height: box.h,
              border: '2px solid white', boxSizing: 'border-box', cursor: 'move',
            }}
          >
            {/* rule-of-thirds */}
            <div style={{ position: 'absolute', top: '33.33%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', top: '66.66%', left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', left: '33.33%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
            <div style={{ position: 'absolute', left: '66.66%', top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.25)' }} />
          </div>

          {/* resize handles */}
          {src && nw > 0 && handles.map((h) => {
            const { left, top } = handlePos(h);
            return (
              <div
                key={h}
                onPointerDown={(e) => startResize(e, h)}
                style={{
                  position: 'absolute', left, top, width: HS, height: HS,
                  background: 'white', borderRadius: 2, boxShadow: '0 0 0 1px rgba(0,0,0,0.4)',
                  cursor: CURSORS[h], touchAction: 'none',
                }}
              />
            );
          })}
        </div>

        {/* ── Zoom slider ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-6 py-3">
          <ZoomOut className="w-4 h-4 text-muted-foreground shrink-0" />
          <Slider min={1} max={5} step={0.01} value={[zoom]} onValueChange={onZoom} className="flex-1" />
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
