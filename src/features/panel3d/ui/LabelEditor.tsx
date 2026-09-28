import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Combine, Search, SplitSquareHorizontal, X } from 'lucide-react';
import type { LabelStyle } from '../types';
import { DIN_MODULE_MM } from '../constants';
import { nextMergeCandidate, zoneOf } from '../engine/placement';
import { LABEL_ICONS, iconSvg, normalizeText, suggestIcon, suggestIcons } from '../render/icons';
import { LabelCell } from '../render/LabelCell';
import { usePanelEditor } from '../store/panelEditorStore';
import { toast } from '../../../store/toastStore';

/**
 * Édition d'une zone d'étiquette : nom du circuit, icône (suggérée
 * automatiquement puis modifiable), style, fusion / séparation, aperçu.
 */

export const STYLE_OPTIONS: { value: LabelStyle; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'icon', label: 'Icône' },
  { value: 'both', label: 'Icône + texte' },
];

function IconImg({ id, size, uid }: { id: string; size: number; uid: string }) {
  return <span className="inline-block shrink-0" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: iconSvg(id, size, uid) }} />;
}

interface Props {
  leaderId: string;
  onDone?: () => void;
  /** Passe à l'étiquette suivante (touche Entrée). */
  onNext?: () => void;
  autoFocus?: boolean;
}

export function LabelEditor({ leaderId, onDone, onNext, autoFocus }: Props) {
  const project = usePanelEditor((s) => s.project)!;
  const updateLabel = usePanelEditor((s) => s.updateLabel);
  const zone = zoneOf(project.devices, leaderId, project.labelStyle);
  const leader = project.devices.find((d) => d.id === leaderId);
  const [iconQuery, setIconQuery] = useState('');
  const [showAll, setShowAll] = useState(false);
  // L'icône suit le texte tant que l'utilisateur ne l'a pas choisie lui-même
  const autoIcon = useRef(true);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const d = usePanelEditor.getState().project?.devices.find((x) => x.id === leaderId);
    autoIcon.current = !d?.icon || d.icon === suggestIcon(d.label) || (d.label === 'Différentiel' && d.icon === 'differentiel');
    setIconQuery('');
    if (autoFocus) inputRef.current?.focus({ preventScroll: true });
  }, [leaderId, autoFocus]);

  const suggestions = useMemo(() => suggestIcons(leader?.label ?? '', 6), [leader?.label]);
  const allIcons = useMemo(() => {
    const q = normalizeText(iconQuery);
    if (!q) return LABEL_ICONS;
    return LABEL_ICONS.filter((i) => normalizeText(`${i.name} ${i.keywords.join(' ')}`).includes(q));
  }, [iconQuery]);

  if (!zone || !leader) return <p className="p-4 text-sm text-slate-500">Étiquette introuvable.</p>;

  const style = leader.labelStyle ?? project.labelStyle;
  const widthMm = zone.width * DIN_MODULE_MM;
  const heightMm = project.print.labelHeightMm;
  const mergeCandidate = nextMergeCandidate(project.devices, zone);
  const coalesce = `label-${leaderId}`;

  const setText = (text: string) => {
    const changes: { label: string; icon?: string | null } = { label: text };
    if (autoIcon.current) {
      const s = suggestIcon(text);
      if (s || !text.trim()) changes.icon = s;
    }
    updateLabel(leaderId, changes, coalesce);
  };
  const pickIcon = (id: string | null) => {
    autoIcon.current = false;
    updateLabel(leaderId, { icon: id });
  };

  // Aperçu à l'échelle physique, agrandi pour l'écran
  const previewScale = Math.min(4.2, 260 / widthMm);

  return (
    <div className="space-y-4 p-4" data-testid="label-editor">
      <div className="flex justify-center rounded-xl bg-slate-100 p-3">
        <svg width={widthMm * previewScale} height={heightMm * previewScale} viewBox={`0 0 ${widthMm} ${heightMm}`} className="rounded-sm bg-white shadow" aria-label="Aperçu de l’étiquette">
          <rect x={0} y={0} width={widthMm} height={heightMm} fill="#fff" stroke="#94a3b8" strokeWidth={0.25} />
          <LabelCell x={0} y={0} w={widthMm} h={heightMm} label={leader.label} icon={leader.icon} style={style} fontPt={project.print.fontSizePt} uid={`pv-${leaderId}`} />
        </svg>
      </div>
      <p className="-mt-2 text-center text-xs text-slate-500">
        {String(zone.width).replace('.', ',')} module{zone.width > 1 ? 's' : ''} · {String(widthMm).replace('.', ',')} × {String(heightMm).replace('.', ',')} mm
        {zone.ids.length > 1 && ` · ${zone.ids.length} appareils regroupés`}
      </p>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-800">Nom du circuit</span>
        <input
          ref={inputRef}
          type="text"
          value={leader.label}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              (onNext ?? onDone)?.();
            }
          }}
          enterKeyHint={onNext ? 'next' : 'done'}
          placeholder="ex. Éclairage séjour, Four, Lave-linge…"
          className="min-h-12 w-full rounded-xl border border-slate-300 px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
          data-testid="label-input"
        />
      </label>

      <div>
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-slate-800">Icône</span>
          {leader.icon && (
            <button type="button" className="inline-flex items-center gap-1 text-xs font-semibold text-slate-500 hover:text-red-600" onClick={() => pickIcon(null)}>
              <X className="size-3.5" aria-hidden /> Sans icône
            </button>
          )}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((i) => (
            <button
              key={i.id}
              type="button"
              onClick={() => pickIcon(i.id)}
              aria-pressed={leader.icon === i.id}
              className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-semibold ${leader.icon === i.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}
            >
              <IconImg id={i.id} size={26} uid={`sg-${i.id}`} />
              {i.name}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="rounded-xl border border-dashed border-slate-300 px-3 py-1 text-xs font-semibold text-slate-600 hover:border-blue-400 hover:text-blue-700"
          >
            {showAll ? 'Masquer les icônes' : `Toutes les icônes (${LABEL_ICONS.length})`}
          </button>
        </div>
        {showAll && (
          <div className="mt-2 rounded-xl border border-slate-200 p-2">
            <label className="mb-2 flex items-center gap-2 rounded-lg bg-slate-100 px-2">
              <Search className="size-4 text-slate-400" aria-hidden />
              <input value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="Chercher une icône" aria-label="Chercher une icône" className="min-h-9 min-w-0 flex-1 bg-transparent outline-none" />
            </label>
            <div className="grid max-h-56 grid-cols-5 gap-1 overflow-y-auto sm:grid-cols-6">
              {allIcons.map((i) => (
                <button
                  key={i.id}
                  type="button"
                  title={i.name}
                  aria-label={i.name}
                  aria-pressed={leader.icon === i.id}
                  onClick={() => pickIcon(i.id)}
                  className={`flex flex-col items-center gap-0.5 rounded-lg p-1 text-[10px] leading-tight ${leader.icon === i.id ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-100'}`}
                >
                  <IconImg id={i.id} size={34} uid={`all-${i.id}`} />
                  <span className="line-clamp-2 text-center text-slate-600">{i.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div>
        <span className="mb-1.5 block text-sm font-semibold text-slate-800">Affichage</span>
        <div role="radiogroup" aria-label="Style de l’étiquette" className="inline-flex w-full rounded-xl bg-slate-100 p-1">
          {STYLE_OPTIONS.map((o) => (
            <button
              key={o.value}
              type="button"
              role="radio"
              aria-checked={style === o.value}
              onClick={() => updateLabel(leaderId, { labelStyle: o.value === project.labelStyle ? null : o.value })}
              className={`min-h-10 flex-1 rounded-lg px-2 text-sm font-semibold ${style === o.value ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600'}`}
            >
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {mergeCandidate && (
          <button
            type="button"
            onClick={() => {
              const r = usePanelEditor.getState().mergeWithNext(leaderId);
              if (!r.ok && r.message) toast.error(r.message);
            }}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Combine className="size-4" aria-hidden /> Fusionner avec l’appareil suivant
          </button>
        )}
        {zone.ids.length > 1 && (
          <button
            type="button"
            onClick={() => usePanelEditor.getState().splitZone(leaderId)}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            <SplitSquareHorizontal className="size-4" aria-hidden /> Séparer les étiquettes
          </button>
        )}
      </div>

      <div className="flex gap-2 pt-1">
        {onNext && (
          <button type="button" onClick={onNext} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50">
            Suivante <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
        {onDone && (
          <button type="button" onClick={onDone} data-testid="label-validate" className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
            <Check className="size-4" aria-hidden /> Valider
          </button>
        )}
      </div>
    </div>
  );
}
