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
  const chip = 'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-xl border px-3 text-sm font-semibold';
  return (
    <div className="z-20 border-t border-gray-200 bg-white pb-safe">
      <EditorToolbar orientation="horizontal" tools={['select', 'wall', 'door', 'window', 'room']} />
      <div className="no-scrollbar flex items-center gap-2 overflow-x-auto px-3 py-2">
        <button
          type="button"
          onClick={() => setLayer('original', { visible: !visible })}
          aria-pressed={visible}
          aria-label={visible ? 'Masquer le croquis original' : 'Afficher le croquis original'}
          className={`${chip} border-gray-300`}
        >
          {visible ? <Eye className="size-4" aria-hidden /> : <EyeOff className="size-4" aria-hidden />}
          Croquis
        </button>
        <label className="flex min-h-11 min-w-36 flex-1 items-center gap-2 text-xs font-semibold text-gray-700">
          <span className="sr-only">Opacité du croquis</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round(plan.backgroundOpacity * 100)}
            onChange={(e) => setPlanMeta({ backgroundOpacity: Number(e.target.value) / 100 })}
            className="h-11 min-w-20 flex-1 accent-brand-500"
            aria-label="Opacité du croquis (0 à 100 %)"
          />
          <span className="w-9 shrink-0 tabular-nums">{Math.round(plan.backgroundOpacity * 100)} %</span>
        </label>
        <button
          type="button"
          onClick={() => setLayer('original', { locked: !locked })}
          aria-pressed={locked}
          aria-label={locked ? 'Déverrouiller le croquis' : 'Verrouiller le croquis'}
          className={`${chip} ${locked ? 'border-brand-400 bg-brand-50 text-brand-700' : 'border-gray-300'}`}
        >
          {locked ? <Lock className="size-4" aria-hidden /> : <Unlock className="size-4" aria-hidden />}
          {locked ? 'Verrouillé' : 'Verrouiller'}
        </button>
        <button type="button" onClick={onFinish} className={`${chip} border-green-600 bg-green-600 text-white hover:bg-green-700`}>
          <Check className="size-5" aria-hidden /> Implantation électrique
        </button>
      </div>
    </div>
  );
}
