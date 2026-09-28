import { getProduct } from '../data/catalog';
import { SharedDefs } from '../render/BoardDefs';
import { DeviceThumb } from './DeviceThumb';
import { useDragStore } from './dragStore';

/** Silhouette qui suit le doigt tant qu'elle n'est pas au-dessus du rail. */
export function DragGhost() {
  const drag = useDragStore((s) => s.drag);
  if (!drag || drag.target) return null;
  const product = getProduct(drag.productId);
  if (!product) return null;
  return (
    <div className="pointer-events-none fixed z-[60] -translate-x-1/2 -translate-y-[85%] opacity-80" style={{ left: drag.clientX, top: drag.clientY }} aria-hidden>
      <SharedDefs uid="ghost" />
      <div className="rounded-lg bg-white/60 p-1 shadow-xl ring-2 ring-blue-400">
        <DeviceThumb product={product} uid="ghost" pxPerMm={1.6} />
      </div>
    </div>
  );
}
