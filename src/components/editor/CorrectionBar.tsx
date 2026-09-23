import { Check, Eye, EyeOff, Lock, Unlock } from 'lucide-react';
import { useEditorStore } from '../../store/editorStore';
import { EditorToolbar } from './EditorToolbar';

/** Correction du plan reconstruit : outils murs / ouvertures + réglages du croquis d'origine. */
export function CorrectionBar({ onFinish }: { onFinish: () => void }) {
  const plan = useEditorStore((s) => s.plan);
  const setLayer = useEditorStore((s) => s.setLayer);
  const setPlanMeta = useEditorStore((s) => s.setPlanMeta);
  if (!plan) return null;
  const original = plan.layers.find((l) => l.id === 'original');
  const visible = original?.visible ?? true;
  const locked = original?.locked ?? false;
  return (
    <div className="z-20 border-t border-gray-200 bg-white pb-safe">
      <EditorToolbar orientation="horizontal" tools={['select', 'wall', 'door', 'window', 'room']} />
      <div className="flex flex-wrap items-center gap-2 px-3 py-2">
        <button
          type="button"
          onClick={() => setLayer('original', { visible: !visible })}
          aria-pressed={visible}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-gray-300 px-3 text-sm font-semibold"
        >
          {visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
          {visible ? 'Masquer le croquis' : 'Afficher le croquis'}
        </button>
        <label className="flex min-h-11 flex-1 items-center gap-2 text-sm font-semibold text-gray-700">
          <span className="shrink-0">Opacité croquis</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(plan.backgroundOpacity * 100)}
            onChange={(e) => setPlanMeta({ backgroundOpacity: Number(e.target.value) / 100 })}
            className="h-11 min-w-24 flex-1 accent-brand-500"
            aria-label="Opacité du croquis"
          />
          <span className="w-10 tabular-nums">{Math.round(plan.backgroundOpacity * 100)} %</span>
        </label>
        <button
          type="button"
          onClick={() => setLayer('original', { locked: !locked })}
          aria-pressed={locked}
          className={`inline-flex min-h-11 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold ${locked ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-300'}`}
        >
          {locked ? <Lock className="size-4" aria-hidden /> : <Unlock className="size-4" aria-hidden />}
          {locked ? 'Croquis verrouillé' : 'Verrouiller le croquis'}
        </button>
        <button type="button" onClick={onFinish} className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-green-600 px-4 text-sm font-bold text-white hover:bg-green-700">
          <Check className="size-5" aria-hidden /> Implantation électrique
        </button>
      </div>
    </div>
  );
}
