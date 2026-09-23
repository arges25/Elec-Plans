import { Maximize, Minus, Plus } from 'lucide-react';
import { useViewStore } from '../../store/viewStore';

/** Boutons de zoom : +, −, adapter à l'écran, 100 %. */
export function ZoomControls({ className = '' }: { className?: string }) {
  const scale = useViewStore((s) => s.scale);
  const api = useViewStore((s) => s.api);
  const btn = 'inline-flex size-11 items-center justify-center text-gray-700 hover:bg-gray-100 active:bg-gray-200';
  return (
    <div className={`flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white/95 shadow-lg backdrop-blur ${className}`} role="group" aria-label="Zoom">
      <button type="button" className={btn} aria-label="Zoom avant" onClick={() => api?.zoomBy(1.25)}>
        <Plus className="size-5" aria-hidden />
      </button>
      <button type="button" className="min-h-9 border-y border-gray-100 px-1 text-[11px] font-bold tabular-nums text-gray-700 hover:bg-gray-100" aria-label="Zoom 100 %" onClick={() => api?.setZoom(1)}>
        {Math.round(scale * 100)} %
      </button>
      <button type="button" className={btn} aria-label="Zoom arrière" onClick={() => api?.zoomBy(1 / 1.25)}>
        <Minus className="size-5" aria-hidden />
      </button>
      <button type="button" className={`${btn} border-t border-gray-100`} aria-label="Adapter à l’écran" onClick={() => api?.fit()}>
        <Maximize className="size-5" aria-hidden />
      </button>
    </div>
  );
}
