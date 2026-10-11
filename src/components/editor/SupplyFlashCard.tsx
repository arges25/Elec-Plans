import { CircleAlert, RotateCcw, Settings2, X, Zap } from 'lucide-react';
import { useSupplyFlashStore, type MiniPanelRow } from '../../store/supplyFlashStore';
import { openSymbolProperties } from './editorActions';
import { showSupply } from './supplyActions';

const ERROR_COLOR = '#dc2626';

/** Mini-tableau : rangées du tableau du projet, le circuit de l'élément clignote. */
function MiniPanel({ rows, color }: { rows: MiniPanelRow[]; color: string }) {
  return (
    <div className="mt-2 rounded-lg bg-ink-900 p-1" aria-label="Tableau électrique" data-testid="supply-mini-panel">
      <div className="flex flex-col gap-1">
        {rows.map((r) => (
          <div key={r.id} className="flex h-6 gap-px overflow-hidden rounded bg-gray-600">
            {r.cells.map((c) => (
              <div
                key={c.id}
                title={c.name}
                style={{ flex: c.modules, ...(c.active ? { backgroundColor: color } : {}) }}
                className={`flex min-w-0 items-center justify-center text-[10px] font-bold tabular-nums ${
                  c.active
                    ? 'animate-supply-flash text-white shadow-[inset_0_0_0_2px_rgba(255,255,255,0.9)]'
                    : c.kind === 'circuit'
                      ? 'bg-gray-100 text-gray-700'
                      : 'bg-gray-300 text-gray-600'
                }`}
              >
                {c.number || (c.kind === 'differential' ? 'ID' : '')}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/**
 * Carte « Alimentation » affichée au-dessus du plan : type de câble (prise ou éclairage),
 * étiquette du circuit (« Circuit 3 – Prises salon – 2,5 mm² – 16 A ») et mini-tableau.
 */
export function SupplyFlashCard() {
  const flash = useSupplyFlashStore((s) => s.flash);
  if (!flash) return null;
  const clear = () => useSupplyFlashStore.getState().clear();
  const none = flash.status === 'none';
  const color = none ? ERROR_COLOR : flash.info.color;

  return (
    <div
      className="pointer-events-auto w-full max-w-md rounded-2xl border-2 bg-white/95 p-2.5 shadow-xl backdrop-blur animate-pop-in"
      style={{ borderColor: color }}
      role="status"
      aria-live="polite"
      data-testid="supply-card"
      data-status={flash.status}
      data-kind={flash.info.kind}
    >
      <div className="flex items-center gap-2">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-lg text-white" style={{ backgroundColor: color }}>
          {none ? <CircleAlert className="size-5" aria-hidden /> : <Zap className="size-5" aria-hidden />}
        </span>
        <p className="min-w-0 flex-1 text-xs font-bold uppercase leading-tight tracking-wide" style={{ color }}>
          {flash.info.title}
        </p>
        {!none && (
          <button
            type="button"
            aria-label="Rejouer"
            title="Rejouer"
            onClick={() => void showSupply(flash.symbolId)}
            className="-my-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gray-600 hover:bg-gray-100"
          >
            <RotateCcw className="size-5" aria-hidden />
          </button>
        )}
        <button
          type="button"
          aria-label="Fermer"
          onClick={clear}
          className="-my-1.5 -mr-1 inline-flex size-11 shrink-0 items-center justify-center rounded-xl text-gray-500 hover:bg-gray-100"
        >
          <X className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mt-1 text-[15px] font-extrabold leading-snug text-gray-900" data-testid="supply-label">
        {none ? 'Cet élément n’est relié à aucun circuit' : (flash.circuitLabel ?? 'Circuit non renseigné')}
      </p>
      <p className="text-xs leading-snug text-gray-600">
        {none ? 'Choisissez son circuit dans Propriétés, ou reliez-le au tableau avec « Relier ».' : flash.note}
      </p>

      {flash.panelRows.length > 0 && <MiniPanel rows={flash.panelRows} color={color} />}

      {none && (
        <button
          type="button"
          onClick={() => {
            clear();
            openSymbolProperties(flash.symbolId);
          }}
          className="mt-2 inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-xl bg-brand-500 px-3 text-sm font-bold text-white hover:bg-brand-600"
        >
          <Settings2 className="size-4" aria-hidden /> Choisir un circuit
        </button>
      )}
    </div>
  );
}
