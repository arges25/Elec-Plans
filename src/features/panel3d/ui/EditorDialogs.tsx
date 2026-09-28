import { ArrowRightToLine, Replace, X } from 'lucide-react';
import { Sheet } from '../../../components/ui/Sheet';
import { getProduct } from '../data/catalog';
import { CIRCUIT_PRESETS, QUICK_CIRCUITS } from '../data/circuits';
import { iconSvg } from '../render/icons';
import { usePanelEditor } from '../store/panelEditorStore';
import { CircuitEditor } from './CircuitEditor';
import { useDragStore } from './dragStore';
import { useUiStore } from './uiStore';

/** Fenêtres du configurateur : édition directe, « Quel circuit ? », emplacement occupé. */
export function EditorDialogs() {
  return (
    <>
      <QuickEditDialog />
      <CircuitPromptDialog />
      <PlaceConflictDialog />
    </>
  );
}

function QuickEditDialog() {
  const quick = useUiStore((s) => s.quickEdit);
  const close = useUiStore((s) => s.closeQuickEdit);
  const device = usePanelEditor((s) => (quick ? s.doc?.devices.find((d) => d.id === quick.deviceId) : undefined));
  const product = device ? getProduct(device.productId) : undefined;
  return (
    <Sheet open={Boolean(quick && device)} onClose={close} title={product ? `Circuit — ${product.shortName}` : 'Circuit'} desktop="center" mobileHeight="full" widthClass="max-w-xl">
      {quick && device && <CircuitEditor key={quick.deviceId} deviceId={quick.deviceId} focus={quick.focus} onDone={close} onCancel={close} />}
    </Sheet>
  );
}

/** Proposé à la pose d'un disjoncteur ; jamais obligatoire. */
function CircuitPromptDialog() {
  const id = usePanelEditor((s) => s.circuitPromptFor);
  const device = usePanelEditor((s) => (id ? s.doc?.devices.find((d) => d.id === id) : undefined));
  const product = device ? getProduct(device.productId) : undefined;
  const close = () => usePanelEditor.getState().setCircuitPrompt(null);
  const presets = QUICK_CIRCUITS.map((p) => CIRCUIT_PRESETS.find((x) => x.id === p)!);
  return (
    <Sheet open={Boolean(id && device)} onClose={close} title={product ? `${product.shortName} posé — quel circuit ?` : 'Quel circuit ?'} desktop="center" widthClass="max-w-lg">
      <div className="space-y-3 p-4" data-testid="circuit-prompt">
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {presets.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                if (id) usePanelEditor.getState().applyPreset(id, p.id);
                close();
              }}
              className="flex min-h-12 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-left text-sm font-semibold text-slate-800 hover:border-blue-400 hover:bg-blue-50"
            >
              <span className="inline-block size-7 shrink-0" dangerouslySetInnerHTML={{ __html: iconSvg(p.icon, 28, `qp-${p.id}`) }} />
              {p.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => {
              close();
              if (id) useUiStore.getState().openQuickEdit(id, 'label');
            }}
            className="flex min-h-12 items-center justify-center rounded-xl border border-dashed border-slate-300 px-3 text-sm font-semibold text-slate-700 hover:border-blue-400"
          >
            Autre…
          </button>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          <button
            type="button"
            onClick={() => {
              usePanelEditor.getState().setSettings({ askCircuitOnDrop: false });
              close();
            }}
            className="text-sm font-semibold text-slate-500 underline hover:text-slate-800"
          >
            Ne plus demander
          </button>
          <button type="button" onClick={close} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-4 text-sm font-semibold hover:bg-slate-50" data-testid="circuit-prompt-skip">
            <X className="size-4" aria-hidden /> Plus tard
          </button>
        </div>
      </div>
    </Sheet>
  );
}

function PlaceConflictDialog() {
  const conflict = useDragStore((s) => s.conflict);
  const resolve = useDragStore((s) => s.resolveConflict);
  const product = conflict ? getProduct(conflict.productId) : undefined;
  return (
    <Sheet open={Boolean(conflict)} onClose={() => resolve(null)} title="Emplacement occupé" desktop="center" widthClass="max-w-md">
      {conflict && (
        <div className="space-y-2 p-4" data-testid="place-conflict">
          <p className="text-sm text-slate-600">
            Rangée {conflict.row + 1}, module {String(conflict.start + 1).replace('.', ',')} : que faire pour {conflict.action === 'add' ? 'installer' : 'déplacer'} {product?.shortName ?? 'l’appareil'} ?
          </p>
          {conflict.canShift && (
            <button type="button" onClick={() => resolve('shift')} className="flex min-h-12 w-full items-center gap-2 rounded-xl bg-blue-600 px-4 font-semibold text-white hover:bg-blue-700" data-testid="conflict-shift">
              <ArrowRightToLine className="size-5" aria-hidden /> Décaler les appareils suivants
            </button>
          )}
          {conflict.canReplace && (
            <button type="button" onClick={() => resolve('replace')} className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-4 font-semibold text-red-700 hover:bg-red-100" data-testid="conflict-replace">
              <Replace className="size-5" aria-hidden /> Remplacer l’emplacement (l’appareil en place est retiré)
            </button>
          )}
          <button type="button" onClick={() => resolve(null)} className="flex min-h-12 w-full items-center justify-center rounded-xl border border-slate-300 bg-white px-4 font-semibold hover:bg-slate-50">
            Annuler
          </button>
        </div>
      )}
    </Sheet>
  );
}
