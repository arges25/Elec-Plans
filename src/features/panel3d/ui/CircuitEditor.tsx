import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronRight, Sparkles, X } from 'lucide-react';
import type { LabelStyle, PlacedDevice } from '../types';
import { getProduct } from '../data/catalog';
import { CIRCUIT_PRESETS, QUICK_CIRCUITS, suggestShortLabel } from '../data/circuits';
import { SCHEMA_LABEL_H, SCHEMA_MODULE } from '../engine/schemaGeometry';
import { LABEL_ICONS, iconSvg, normalizeText, suggestIcon, suggestIcons } from '../render/icons';
import { LabelCell, layoutLabel } from '../render/LabelCell';
import { canvasMeasure } from '../../../utils/labelLayout';
import { displayLabel, usePanelEditor } from '../store/panelEditorStore';

/**
 * Édition d'un circuit : désignation (sous l'appareil), nom court facultatif,
 * repère (au-dessus), icône facultative, informations complémentaires.
 * Les modifications sont appliquées en une seule étape à la validation.
 */

export const STYLE_OPTIONS: { value: LabelStyle; label: string; hint: string }[] = [
  { value: 'text', label: 'Professionnel', hint: 'Texte uniquement' },
  { value: 'both', label: 'Visuel', hint: 'Icône + texte' },
  { value: 'icon', label: 'Icône', hint: 'Icône uniquement' },
];

function IconImg({ id, size, uid }: { id: string; size: number; uid: string }) {
  return <span className="inline-block shrink-0" style={{ width: size, height: size }} dangerouslySetInnerHTML={{ __html: iconSvg(id, size, uid) }} />;
}

type Draft = Pick<PlacedDevice, 'label' | 'shortLabel' | 'circuitRef' | 'icon' | 'notes'>;

interface Props {
  deviceId: string;
  /** Champ qui reçoit le focus à l'ouverture. */
  focus?: 'label' | 'ref';
  onDone: () => void;
  onCancel?: () => void;
  /** Passe au circuit suivant (touche Entrée). */
  onNext?: () => void;
}

const inputCls = 'min-h-12 w-full rounded-xl border border-slate-300 bg-white px-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100';

export function CircuitEditor({ deviceId, focus = 'label', onDone, onCancel, onNext }: Props) {
  const doc = usePanelEditor((s) => s.doc)!;
  const device = doc.devices.find((d) => d.id === deviceId);
  const product = device ? getProduct(device.productId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => ({
    label: device?.label ?? '',
    shortLabel: device?.shortLabel ?? '',
    circuitRef: device?.circuitRef ?? '',
    icon: device?.icon ?? null,
    notes: device?.notes ?? '',
  }));
  const [showIcons, setShowIcons] = useState(Boolean(device?.icon));
  const [iconQuery, setIconQuery] = useState('');
  const iconManual = useRef(Boolean(device?.icon));
  const labelRef = useRef<HTMLInputElement>(null);
  const refRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = focus === 'ref' ? refRef.current : labelRef.current;
    el?.focus({ preventScroll: true });
    el?.select();
  }, [focus]);

  const style = device?.labelStyle ?? doc.labelStyle;
  const showsIcon = style !== 'text';
  const suggestions = useMemo(() => suggestIcons(draft.label, 6), [draft.label]);
  const presetMatches = useMemo(() => {
    const q = normalizeText(draft.label);
    const list = q ? CIRCUIT_PRESETS.filter((p) => normalizeText(`${p.name} ${p.short}`).includes(q)) : QUICK_CIRCUITS.map((id) => CIRCUIT_PRESETS.find((p) => p.id === id)!);
    return list.slice(0, 8);
  }, [draft.label]);
  const allIcons = useMemo(() => {
    const q = normalizeText(iconQuery);
    return q ? LABEL_ICONS.filter((i) => normalizeText(`${i.name} ${i.keywords.join(' ')}`).includes(q)) : LABEL_ICONS;
  }, [iconQuery]);

  if (!device || !product) return <p className="p-4 text-sm text-slate-500">Appareil introuvable.</p>;

  const short = suggestShortLabel(draft.label);
  const shown = displayLabel(doc, draft);
  const widthUnits = device.moduleWidth * SCHEMA_MODULE;
  const lay = layoutLabel(widthUnits, SCHEMA_LABEL_H, shown, draft.icon, style, 10.5, canvasMeasure, undefined, 3);
  const truncated = Boolean(lay.text?.truncated);

  const setLabel = (label: string) => {
    setDraft((d) => {
      const next = { ...d, label };
      if (!iconManual.current && showsIcon) next.icon = suggestIcon(label);
      return next;
    });
  };
  const pickIcon = (id: string | null) => {
    iconManual.current = true;
    setDraft((d) => ({ ...d, icon: id }));
  };
  const submit = (then: () => void) => {
    const changes = {
      label: draft.label.trim(),
      shortLabel: draft.shortLabel.trim(),
      circuitRef: draft.circuitRef.trim(),
      icon: draft.icon,
      notes: draft.notes,
    };
    const same = (Object.keys(changes) as (keyof typeof changes)[]).every((k) => changes[k] === device[k]);
    if (!same) usePanelEditor.getState().updateDevice(deviceId, changes);
    then();
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !(e.target instanceof HTMLTextAreaElement)) {
      e.preventDefault();
      submit(onNext ?? onDone);
    }
  };

  return (
    <div className="space-y-4 p-4" data-testid="circuit-editor" onKeyDown={onKey}>
      {/* Aperçu : repère, appareil, étiquette */}
      <div className="flex items-center gap-3 rounded-xl bg-slate-100 p-3">
        <div className="flex flex-col items-center">
          <span className="min-h-6 text-lg font-extrabold text-slate-900">{draft.circuitRef || '—'}</span>
          <span className="rounded-md bg-white px-2 py-1 text-sm font-bold text-slate-800 shadow-sm">{product.shortName}</span>
        </div>
        <svg width={widthUnits * 3.6} height={SCHEMA_LABEL_H * 3.6} viewBox={`0 0 ${widthUnits} ${SCHEMA_LABEL_H}`} className="shrink-0 rounded bg-white shadow" aria-label="Aperçu de l’étiquette">
          <LabelCell x={0} y={0} w={widthUnits} h={SCHEMA_LABEL_H} label={shown} icon={draft.icon} style={style} fontPt={10.5} uid={`ce-${deviceId}`} maxLines={3} />
        </svg>
        <p className="min-w-0 text-xs text-slate-500">
          {String(device.moduleWidth).replace('.', ',')} module{device.moduleWidth > 1 ? 's' : ''} · rangée {device.row + 1} · position {String(device.startModule + 1).replace('.', ',')}
        </p>
      </div>

      <div className="grid grid-cols-[1fr_7rem] gap-3">
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-800">Nom du circuit</span>
          <input ref={labelRef} value={draft.label} onChange={(e) => setLabel(e.target.value)} placeholder="ex. Four, PC cuisine îlot…" className={inputCls} data-testid="circuit-label" enterKeyHint={onNext ? 'next' : 'done'} />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-800">Repère</span>
          <input
            ref={refRef}
            value={draft.circuitRef}
            onChange={(e) => setDraft((d) => ({ ...d, circuitRef: e.target.value }))}
            placeholder="1"
            className={`${inputCls} text-center font-bold`}
            data-testid="circuit-ref"
            enterKeyHint={onNext ? 'next' : 'done'}
          />
        </label>
      </div>

      {presetMatches.length > 0 && (
        <div className="-mt-1 flex flex-wrap gap-1.5" aria-label="Circuits prédéfinis">
          {presetMatches.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                iconManual.current = true;
                setDraft((d) => ({ ...d, label: p.name, shortLabel: p.short, icon: showsIcon || d.icon ? p.icon : d.icon }));
              }}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:border-blue-400 hover:text-blue-700"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div>
        <label className="block">
          <span className="mb-1 block text-sm font-semibold text-slate-800">
            Nom court <span className="font-normal text-slate-500">(facultatif)</span>
          </span>
          <input value={draft.shortLabel} onChange={(e) => setDraft((d) => ({ ...d, shortLabel: e.target.value }))} placeholder={short || 'ex. PC CUISINE'} className={inputCls} data-testid="circuit-short" />
        </label>
        {short && short !== draft.shortLabel && normalizeText(short) !== normalizeText(draft.label) && (
          <button type="button" onClick={() => setDraft((d) => ({ ...d, shortLabel: short }))} className="mt-1.5 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:underline">
            <Sparkles className="size-3.5" aria-hidden /> Proposer : {short}
          </button>
        )}
      </div>

      {truncated && (
        <div className="rounded-xl bg-amber-50 px-3 py-2 text-xs leading-snug text-amber-900" role="status">
          Texte trop long pour {String(device.moduleWidth).replace('.', ',')} module{device.moduleWidth > 1 ? 's' : ''} : il est réduit légèrement puis coupé. Solutions : retour à la ligne (espaces), nom court
          {doc.labelText === 'long' ? ' (affiché si « Nom court » est choisi dans la configuration)' : ''}, ou texte personnalisé.
          {short && !draft.shortLabel && (
            <button type="button" onClick={() => setDraft((d) => ({ ...d, shortLabel: short }))} className="ml-1 font-bold underline">
              Utiliser « {short} »
            </button>
          )}
        </div>
      )}

      <div>
        {!showIcons ? (
          <button type="button" onClick={() => setShowIcons(true)} className="text-sm font-semibold text-blue-700 hover:underline">
            + Ajouter une icône (facultatif)
          </button>
        ) : (
          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-semibold text-slate-800">
                Icône <span className="font-normal text-slate-500">(facultative{!showsIcon ? ' — affichée en mode Visuel ou Icône' : ''})</span>
              </span>
              {draft.icon && (
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
                  aria-pressed={draft.icon === i.id}
                  className={`flex items-center gap-1.5 rounded-xl border px-2 py-1 text-xs font-semibold ${draft.icon === i.id ? 'border-blue-500 bg-blue-50 text-blue-800' : 'border-slate-200 bg-white text-slate-700 hover:border-blue-300'}`}
                >
                  <IconImg id={i.id} size={24} uid={`cs-${i.id}`} />
                  {i.name}
                </button>
              ))}
            </div>
            <div className="mt-2 rounded-xl border border-slate-200 p-2">
              <input value={iconQuery} onChange={(e) => setIconQuery(e.target.value)} placeholder="Chercher une icône" aria-label="Chercher une icône" className="mb-2 min-h-9 w-full rounded-lg bg-slate-100 px-2 outline-none" />
              <div className="grid max-h-44 grid-cols-6 gap-1 overflow-y-auto sm:grid-cols-8">
                {allIcons.map((i) => (
                  <button
                    key={i.id}
                    type="button"
                    title={i.name}
                    aria-label={i.name}
                    aria-pressed={draft.icon === i.id}
                    onClick={() => pickIcon(i.id)}
                    className={`flex items-center justify-center rounded-lg p-1 ${draft.icon === i.id ? 'bg-blue-100 ring-2 ring-blue-400' : 'hover:bg-slate-100'}`}
                  >
                    <IconImg id={i.id} size={30} uid={`ca-${i.id}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      <label className="block">
        <span className="mb-1 block text-sm font-semibold text-slate-800">
          Informations complémentaires <span className="font-normal text-slate-500">(facultatif)</span>
        </span>
        <textarea value={draft.notes} onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))} rows={2} className="w-full rounded-xl border border-slate-300 px-3 py-2 outline-none focus:border-blue-500" placeholder="Section, liaison, remarque…" />
      </label>

      <div className="flex gap-2 pt-1">
        {onCancel && (
          <button type="button" onClick={onCancel} className="inline-flex min-h-12 flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white font-semibold text-slate-700 hover:bg-slate-50">
            Annuler
          </button>
        )}
        {onNext && (
          <button type="button" onClick={() => submit(onNext)} className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-300 bg-white font-semibold text-slate-800 hover:bg-slate-50">
            Suivant <ChevronRight className="size-4" aria-hidden />
          </button>
        )}
        <button type="button" onClick={() => submit(onDone)} data-testid="circuit-validate" className="inline-flex min-h-12 flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-600 font-semibold text-white hover:bg-blue-700">
          <Check className="size-4" aria-hidden /> Valider
        </button>
      </div>
    </div>
  );
}
