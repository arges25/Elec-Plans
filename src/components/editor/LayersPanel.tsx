import { Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { LAYER_DEFS } from '../../utils/planFactory';
import { useEditorStore } from '../../store/editorStore';
import { Slider } from '../ui/Field';

/** Calques : visible / invisible, verrouillable ; opacité du plan original. */
export function LayersPanel() {
  const plan = useEditorStore((s) => s.plan);
  const setLayer = useEditorStore((s) => s.setLayer);
  const setPlanMeta = useEditorStore((s) => s.setPlanMeta);
  if (!plan) return null;
  const hasImage = Boolean(plan.processedImage ?? plan.originalImage);
  return (
    <div className="flex flex-col gap-2 p-4">
      {LAYER_DEFS.map((def, i) => {
        const l = plan.layers.find((x) => x.id === def.id) ?? { id: def.id, visible: true, locked: false };
        return (
          <div key={def.id} className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white p-2">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-sm font-bold text-gray-600">{i + 1}</span>
            <div className="min-w-0 flex-1">
              <p className={`font-semibold ${l.visible ? 'text-gray-900' : 'text-gray-400 line-through'}`}>{def.label}</p>
              <p className="truncate text-xs text-gray-500">{def.id === 'original' && !hasImage ? 'Aucune image importée' : def.description}</p>
            </div>
            <button
              type="button"
              aria-label={l.visible ? `Masquer ${def.label}` : `Afficher ${def.label}`}
              aria-pressed={l.visible}
              onClick={() => setLayer(def.id, { visible: !l.visible })}
              className={`inline-flex size-11 items-center justify-center rounded-xl ${l.visible ? 'text-gray-700 hover:bg-gray-100' : 'bg-gray-100 text-gray-400'}`}
            >
              {l.visible ? <Eye className="size-5" aria-hidden /> : <EyeOff className="size-5" aria-hidden />}
            </button>
            <button
              type="button"
              aria-label={l.locked ? `Déverrouiller ${def.label}` : `Verrouiller ${def.label}`}
              aria-pressed={l.locked}
              onClick={() => setLayer(def.id, { locked: !l.locked })}
              className={`inline-flex size-11 items-center justify-center rounded-xl ${l.locked ? 'bg-brand-100 text-brand-700' : 'text-gray-500 hover:bg-gray-100'}`}
            >
              {l.locked ? <Lock className="size-5" aria-hidden /> : <Unlock className="size-5" aria-hidden />}
            </button>
          </div>
        );
      })}
      {hasImage && (
        <div className="mt-2 rounded-xl border border-gray-200 bg-white p-3">
          <Slider
            label="Opacité du plan original"
            value={Math.round(plan.backgroundOpacity * 100)}
            min={0}
            max={100}
            onChange={(v) => setPlanMeta({ backgroundOpacity: v / 100 })}
            format={(v) => `${v} %`}
          />
        </div>
      )}
    </div>
  );
}
