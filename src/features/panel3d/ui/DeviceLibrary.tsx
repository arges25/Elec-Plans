import { useMemo, useRef, useState } from 'react';
import { Plus, Search } from 'lucide-react';
import type { DeviceCategory, DeviceProduct } from '../types';
import { CATEGORY_LABELS, CATEGORY_ORDER, brandName, listDevices } from '../data/catalog';
import { DIN_MODULE_MM, REFERENCE_NOT_PROVIDED } from '../constants';
import { normalizeText } from '../render/icons';
import { SharedDefs } from '../render/BoardDefs';
import { usePanelEditor } from '../store/panelEditorStore';
import { trackDragOnWindow, useDragStore } from './dragStore';
import { DeviceThumb } from './DeviceThumb';
import { toast } from '../../../store/toastStore';
import { useUiStore } from './uiStore';

/**
 * Bibliothèque d'appareils de la marque du tableau.
 * Souris : glisser vers le rail, ou cliquer puis cliquer sur le rail.
 * Tactile : toucher = choisir puis toucher le rail ; appui long = glisser.
 */

const LONG_PRESS_MS = 320;

function formatModules(m: number): string {
  return `${String(m).replace('.', ',')} module${m > 1 ? 's' : ''}`;
}

interface ItemProps {
  product: DeviceProduct;
  armed: boolean;
  showBrand: boolean;
  onChoose: (p: DeviceProduct) => void;
  onAddAuto: (p: DeviceProduct) => void;
}

function LibraryItem({ product, armed, showBrand, onChoose, onAddAuto }: ItemProps) {
  const press = useRef<{ x: number; y: number; id: number; type: string; timer?: number; dragging: boolean } | null>(null);
  const dragged = useRef(false);

  const beginDrag = (pointerId: number, clientX: number, clientY: number) => {
    if (!press.current) return;
    press.current.dragging = true;
    navigator.vibrate?.(12);
    useDragStore.getState().begin({ productId: product.id, width: product.modules, source: 'library', clientX, clientY });
    trackDragOnWindow(pointerId);
  };

  return (
    <div
      className={`flex items-center rounded-xl border transition-colors ${armed ? 'border-blue-500 bg-blue-50 ring-2 ring-blue-200' : 'border-slate-200 bg-white hover:border-blue-300'}`}
      data-product-id={product.id}
    >
      <button
        type="button"
        className="flex min-w-0 flex-1 items-center gap-2.5 self-stretch rounded-l-xl p-2 text-left"
        style={{ touchAction: 'pan-y', WebkitTouchCallout: 'none', userSelect: 'none' }}
        aria-label={`${product.fullName} (${formatModules(product.modules)})`}
        onContextMenu={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          dragged.current = false;
          const p = { x: e.clientX, y: e.clientY, id: e.pointerId, type: e.pointerType, dragging: false, timer: undefined as number | undefined };
          if (e.pointerType !== 'mouse') {
            const { pointerId, clientX, clientY } = e;
            p.timer = window.setTimeout(() => {
              if (press.current === p) beginDrag(pointerId, clientX, clientY);
            }, LONG_PRESS_MS);
          }
          press.current = p;
        }}
        onPointerMove={(e) => {
          const p = press.current;
          if (!p || p.dragging || p.id !== e.pointerId) return;
          const dist = Math.hypot(e.clientX - p.x, e.clientY - p.y);
          if (p.type === 'mouse' && e.buttons === 1 && dist > 5) beginDrag(e.pointerId, e.clientX, e.clientY);
          else if (p.type !== 'mouse' && dist > 9) {
            // Défilement de la liste : pas de glisser
            window.clearTimeout(p.timer);
            press.current = null;
          }
        }}
        onPointerUp={(e) => {
          const p = press.current;
          if (!p || p.id !== e.pointerId) return;
          window.clearTimeout(p.timer);
          dragged.current = p.dragging;
          press.current = null;
        }}
        onPointerCancel={() => {
          if (press.current?.timer) window.clearTimeout(press.current.timer);
          if (!press.current?.dragging) press.current = null;
        }}
        // Choix sur « click » (et non au relâchement) : aucun click fantôme sur ce qui
        // apparaît sous le doigt quand la bibliothèque se ferme ; clavier compris.
        onClick={() => {
          if (dragged.current) {
            dragged.current = false;
            return;
          }
          onChoose(product);
        }}
      >
        <span className="flex h-14 w-16 shrink-0 items-center justify-center rounded-lg bg-slate-100">
          <DeviceThumb product={product} uid="lib" pxPerMm={product.modules > 2 ? 0.95 : 1.15} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-bold text-slate-900">{product.shortName}</span>
          <span className="block truncate text-xs text-slate-600">{product.fullName}</span>
          <span className="block truncate text-[11px] text-slate-500">
            {showBrand && `${brandName(product.brand)} · `}
            {formatModules(product.modules)} · {product.modules * DIN_MODULE_MM} mm · {product.reference ?? REFERENCE_NOT_PROVIDED}
          </span>
        </span>
      </button>
      <button
        type="button"
        aria-label={`Ajouter ${product.shortName} au premier emplacement libre`}
        title="Ajouter au premier emplacement libre"
        className="mr-2 inline-flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white hover:bg-blue-700"
        onClick={() => onAddAuto(product)}
      >
        <Plus className="size-5" aria-hidden />
      </button>
    </div>
  );
}

export function DeviceLibrary({ onChosen }: { onChosen?: () => void }) {
  const doc = usePanelEditor((s) => s.doc)!;
  const armedId = usePanelEditor((s) => s.armedProductId);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DeviceCategory | 'all'>('all');

  const devices = useMemo(() => listDevices(doc.brand, doc.showAllBrands), [doc.brand, doc.showAllBrands]);
  const filtered = useMemo(() => {
    const q = normalizeText(query);
    return devices.filter((d) => (category === 'all' || d.category === category) && (!q || normalizeText(`${d.shortName} ${d.fullName} ${d.reference ?? ''} ${brandName(d.brand)}`).includes(q)));
  }, [devices, query, category]);

  const choose = (p: DeviceProduct) => {
    const editor = usePanelEditor.getState();
    const next = editor.armedProductId === p.id ? null : p.id;
    editor.arm(next);
    if (next) onChosen?.();
  };
  const addAuto = (p: DeviceProduct) => {
    const res = usePanelEditor.getState().addDeviceAuto(p.id);
    if (!res.ok) toast.error(res.message ?? 'Impossible d’ajouter l’appareil');
    else {
      if (res.id) useUiStore.getState().focusDevice(res.id);
      onChosen?.();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-testid="device-library">
      <SharedDefs uid="lib" />
      <div className="shrink-0 space-y-2 border-b border-slate-200 p-3">
        <label className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search className="size-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher (ex. 20 A, différentiel…)"
            aria-label="Rechercher un appareil"
            className="min-h-10 min-w-0 flex-1 bg-transparent outline-none"
          />
        </label>
        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5" role="tablist" aria-label="Catégories">
          {(['all', ...CATEGORY_ORDER] as const).map((c) => (
            <button
              key={c}
              type="button"
              role="tab"
              aria-selected={category === c}
              onClick={() => setCategory(c)}
              className={`min-h-9 shrink-0 rounded-full px-3 text-xs font-semibold ${category === c ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-700 hover:bg-slate-200'}`}
            >
              {c === 'all' ? 'Tout' : CATEGORY_LABELS[c]}
            </button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain p-3">
        {CATEGORY_ORDER.map((cat) => {
          const items = filtered.filter((d) => d.category === cat);
          if (!items.length) return null;
          return (
            <section key={cat}>
              <h3 className="mb-1.5 text-xs font-bold uppercase tracking-wide text-slate-500">{CATEGORY_LABELS[cat]}</h3>
              <div className="space-y-1.5">
                {items.map((p) => (
                  <LibraryItem key={p.id} product={p} armed={armedId === p.id} showBrand={doc.showAllBrands} onChoose={choose} onAddAuto={addAuto} />
                ))}
              </div>
            </section>
          );
        })}
        {!filtered.length && <p className="py-6 text-center text-sm text-slate-500">Aucun appareil ne correspond.</p>}
        <p className="text-[11px] leading-snug text-slate-500">
          Largeurs modulaires standard (1 module = {DIN_MODULE_MM} mm). Les références fabricant non vérifiées sur la documentation officielle sont
          indiquées « {REFERENCE_NOT_PROVIDED} ».
        </p>
      </div>
    </div>
  );
}
