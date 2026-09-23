import { useEffect, useLayoutEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Quad } from '../../services/imageProcessing';

export interface CropEditorProps {
  /** Aperçu (déjà filtré) à afficher. */
  preview: HTMLCanvasElement | null;
  /** Dimensions de l'image de référence (coordonnées du quadrilatère). */
  imageWidth: number;
  imageHeight: number;
  quad: Quad;
  onQuadChange: (q: Quad) => void;
  /** Rotation libre d'aperçu (degrés). */
  rotation: number;
}

const HANDLE_LABELS = ['Coin haut gauche', 'Coin haut droit', 'Coin bas droit', 'Coin bas gauche'];

/**
 * Recadrage par 4 poignées (redressement de perspective).
 * Une loupe s'affiche pendant le déplacement d'un coin pour plus de précision au doigt.
 */
export function CropEditor({ preview, imageWidth, imageHeight, quad, onQuadChange, rotation }: CropEditorProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const loupeRef = useRef<HTMLCanvasElement>(null);
  const [box, setBox] = useState({ w: 300, h: 300 });
  const [drag, setDrag] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setBox({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setBox({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const pad = 24;
  const scale = Math.min((box.w - pad * 2) / imageWidth, (box.h - pad * 2) / imageHeight);
  const dw = imageWidth * scale;
  const dh = imageHeight * scale;
  const ox = (box.w - dw) / 2;
  const oy = (box.h - dh) / 2;

  useEffect(() => {
    const c = canvasRef.current;
    if (!c || !preview) return;
    const dpr = window.devicePixelRatio || 1;
    c.width = Math.max(1, Math.round(dw * dpr));
    c.height = Math.max(1, Math.round(dh * dpr));
    const ctx = c.getContext('2d');
    if (!ctx) return;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(preview, 0, 0, c.width, c.height);
  }, [preview, dw, dh]);

  useEffect(() => {
    if (drag === null || !preview || !loupeRef.current) return;
    const lc = loupeRef.current;
    const ctx = lc.getContext('2d');
    if (!ctx) return;
    const p = quad[drag];
    const k = preview.width / imageWidth;
    const zoomSrc = 60;
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, lc.width, lc.height);
    ctx.drawImage(preview, p.x * k - zoomSrc / 2, p.y * k - zoomSrc / 2, zoomSrc, zoomSrc, 0, 0, lc.width, lc.height);
    ctx.strokeStyle = '#f97316';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(lc.width / 2, 0);
    ctx.lineTo(lc.width / 2, lc.height);
    ctx.moveTo(0, lc.height / 2);
    ctx.lineTo(lc.width, lc.height / 2);
    ctx.stroke();
  }, [drag, quad, preview, imageWidth]);

  const toImage = (clientX: number, clientY: number) => {
    const r = wrapRef.current!.getBoundingClientRect();
    const x = (clientX - r.left - ox) / scale;
    const y = (clientY - r.top - oy) / scale;
    return { x: Math.max(0, Math.min(imageWidth, x)), y: Math.max(0, Math.min(imageHeight, y)) };
  };

  const onPointerMove = (e: ReactPointerEvent) => {
    if (drag === null) return;
    const p = toImage(e.clientX, e.clientY);
    const next = quad.map((q, i) => (i === drag ? p : q)) as Quad;
    onQuadChange(next);
  };

  const pts = quad.map((q) => ({ x: ox + q.x * scale, y: oy + q.y * scale }));
  const poly = pts.map((p) => `${p.x},${p.y}`).join(' ');

  return (
    <div
      ref={wrapRef}
      className="relative h-full w-full touch-none select-none overflow-hidden bg-ink-950"
      onPointerMove={onPointerMove}
      onPointerUp={() => setDrag(null)}
      onPointerCancel={() => setDrag(null)}
    >
      <canvas
        ref={canvasRef}
        style={{ position: 'absolute', left: ox, top: oy, width: dw, height: dh, transform: `rotate(${rotation}deg)` }}
        aria-label="Aperçu du plan"
      />
      <svg className="absolute inset-0 h-full w-full" aria-hidden={false}>
        <defs>
          <mask id="crop-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="white" />
            <polygon points={poly} fill="black" />
          </mask>
        </defs>
        <rect x="0" y="0" width="100%" height="100%" fill="rgba(11,17,32,0.55)" mask="url(#crop-mask)" />
        <polygon points={poly} fill="none" stroke="#f97316" strokeWidth="2.5" />
        {pts.map((p, i) => (
          <g
            key={i}
            role="slider"
            tabIndex={0}
            aria-label={HANDLE_LABELS[i]}
            aria-valuetext={`${Math.round(quad[i].x)}, ${Math.round(quad[i].y)}`}
            onPointerDown={(e) => {
              (e.target as Element).setPointerCapture?.(e.pointerId);
              setDrag(i);
            }}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 20 : 4;
              const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
              if (!d) return;
              e.preventDefault();
              const next = quad.map((q, k) =>
                k === i ? { x: Math.max(0, Math.min(imageWidth, q.x + d[0])), y: Math.max(0, Math.min(imageHeight, q.y + d[1])) } : q,
              ) as Quad;
              onQuadChange(next);
            }}
            style={{ cursor: 'grab' }}
          >
            <circle cx={p.x} cy={p.y} r={26} fill="transparent" />
            <circle cx={p.x} cy={p.y} r={13} fill="rgba(249,115,22,0.25)" stroke="#fff" strokeWidth="3" />
            <circle cx={p.x} cy={p.y} r={4} fill="#f97316" />
          </g>
        ))}
      </svg>
      {drag !== null && (
        <canvas
          ref={loupeRef}
          width={140}
          height={140}
          className={`pointer-events-none absolute top-3 size-[140px] rounded-full border-4 border-white shadow-2xl ${pts[drag].x < box.w / 2 ? 'right-3' : 'left-3'}`}
          aria-hidden
        />
      )}
    </div>
  );
}
